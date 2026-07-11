import { Request, Response } from 'express';
import { parse } from 'csv-parse/sync';
import { z } from 'zod';
import { callGeminiWithRetry, AIBatchRowResponse, AICRMRecord } from '../services/gemini';

// Strict Enums defined in PRD
const CrmStatusEnum = z.enum(["GOOD_LEAD_FOLLOW_UP", "DID_NOT_CONNECT", "BAD_LEAD", "SALE_DONE"]);
const DataSourceEnum = z.enum(["leads_on_demand", "meridian_tower", "eden_park", "varah_swamy", "sarjapur_plots"]);

// CRM Schema matching exact 15 fields
const CRMRecordSchema = z.object({
  created_at: z.string().optional().nullable().transform(val => val || new Date().toISOString()),
  name: z.string().trim().min(1, "Name is required"),
  email: z.string().trim().optional().nullable().or(z.literal("")),
  country_code: z.string().trim().optional().nullable(),
  mobile_without_country_code: z.string().trim().optional().nullable(),
  company: z.string().trim().optional().nullable(),
  city: z.string().trim().optional().nullable(),
  state: z.string().trim().optional().nullable(),
  country: z.string().trim().optional().nullable(),
  lead_owner: z.string().trim().optional().nullable(),
  crm_status: CrmStatusEnum.optional().nullable().or(z.literal("")),
  crm_note: z.string().trim().optional().nullable(),
  data_source: DataSourceEnum.optional().nullable().or(z.literal("")),
  possession_time: z.string().trim().optional().nullable(),
  description: z.string().trim().optional().nullable(),
}).refine(data => {
  // Skip logic: A record is skipped ONLY if it has NEITHER email nor mobile number
  const hasEmail = data.email && data.email.trim().length > 0;
  const hasMobile = data.mobile_without_country_code && data.mobile_without_country_code.trim().length > 0;
  return hasEmail || hasMobile;
}, {
  message: "Record must contain either a valid email or mobile number",
  path: ["email", "mobile_without_country_code"],
});

type CRMRecord = z.infer<typeof CRMRecordSchema>;

interface SkippedRecord {
  rowIndex: number;
  row: Record<string, string>;
  reason: string;
}

// Normalization mappings for status and datasource
function normalizeStatus(val: string): string | null {
  if (!val) return null;
  const cleaned = val.toUpperCase().trim().replace(/[\s-]/g, '_');
  if (["GOOD_LEAD_FOLLOW_UP", "DID_NOT_CONNECT", "BAD_LEAD", "SALE_DONE"].includes(cleaned)) {
    return cleaned;
  }
  if (cleaned.includes("FOLLOW") || cleaned.includes("GOOD") || cleaned.includes("NEW")) {
    return "GOOD_LEAD_FOLLOW_UP";
  }
  if (cleaned.includes("NOT_CONNECT") || cleaned.includes("NO_ANSWER") || cleaned.includes("BUSY")) {
    return "DID_NOT_CONNECT";
  }
  if (cleaned.includes("BAD") || cleaned.includes("JUNK") || cleaned.includes("SPAM")) {
    return "BAD_LEAD";
  }
  if (cleaned.includes("SALE") || cleaned.includes("DONE") || cleaned.includes("WON") || cleaned.includes("CLOSE")) {
    return "SALE_DONE";
  }
  return null;
}

function normalizeDataSource(val: string): string | null {
  if (!val) return null;
  const cleaned = val.toLowerCase().trim().replace(/[\s-]/g, '_');
  if (["leads_on_demand", "meridian_tower", "eden_park", "varah_swamy", "sarjapur_plots"].includes(cleaned)) {
    return cleaned;
  }
  if (cleaned.includes("demand") || cleaned.includes("lead")) return "leads_on_demand";
  if (cleaned.includes("meridian") || cleaned.includes("tower")) return "meridian_tower";
  if (cleaned.includes("eden") || cleaned.includes("park")) return "eden_park";
  if (cleaned.includes("varah") || cleaned.includes("swamy")) return "varah_swamy";
  if (cleaned.includes("sarjapur") || cleaned.includes("plot")) return "sarjapur_plots";
  return null;
}

export async function handleImport(req: Request, res: Response) {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No CSV file uploaded." });
    }

    const csvContent = req.file.buffer.toString('utf-8');
    
    // Parse the file buffer securely, catching parse exceptions
    let records: string[][];
    try {
      records = parse(csvContent, {
        columns: false,
        skip_empty_lines: true,
        relax_column_count: true
      });
    } catch (err) {
      return res.status(400).json({ error: "Unable to parse file as CSV" });
    }

    // Edge Case: Completely empty file
    if (records.length === 0) {
      return res.status(400).json({ error: "CSV file is empty." });
    }

    const rawHeaders: string[] = records[0];
    
    // Edge case: CSV containing headers only but zero data rows
    if (records.length === 1) {
      return res.status(200).json({
        totalRows: 0,
        totalImported: 0,
        totalSkipped: 0,
        batchesProcessed: 0,
        batchesFailed: 0,
        records: [],
        skipped: []
      });
    }

    const dataRows = records.slice(1);

    // Map 2D array row fields into clean key-value object array for Gemini
    const csvRows = dataRows.map((row: string[]) => {
      const obj: Record<string, string> = {};
      rawHeaders.forEach((header, colIdx) => {
        obj[header] = colIdx < row.length ? row[colIdx] : "";
      });
      return obj;
    });

    // Batch segmentation: groups of 40
    const batches: Record<string, string>[][] = [];
    for (let i = 0; i < csvRows.length; i += 40) {
      batches.push(csvRows.slice(i, i + 40));
    }

    const batchResults: Array<{ success: boolean; response?: AIBatchRowResponse[]; error?: string }> = new Array(batches.length);
    let nextBatchIdx = 0;

    // Process batches with concurrency limits and stagger delay
    async function worker() {
      while (nextBatchIdx < batches.length) {
        const currentIdx = nextBatchIdx++;
        const batch = batches[currentIdx];
        try {
          const result = await callGeminiWithRetry(batch, currentIdx + 1);
          batchResults[currentIdx] = { success: true, response: result };
        } catch (err: unknown) {
          const errMsg = err instanceof Error ? err.message : "Failed";
          batchResults[currentIdx] = { success: false, error: errMsg };
        }

        // Pacing delay spacing (5s delay to keep total RPM strictly under 15 when running sequentially)
        if (nextBatchIdx < batches.length) {
          await new Promise(resolve => setTimeout(resolve, 5000));
        }
      }
    }

    const workers = [];
    const concurrency = 1;
    for (let w = 0; w < concurrency; w++) {
      workers.push(worker());
    }
    await Promise.all(workers);

    const imported: CRMRecord[] = [];
    const skipped: SkippedRecord[] = [];
    let batchesProcessed = 0;
    let batchesFailed = 0;

    // Process batch responses and run the operational validation pipeline
    batchResults.forEach((batchResult, batchIdx) => {
      const startRowIdx = batchIdx * 40;
      const batchRows = csvRows.slice(startRowIdx, startRowIdx + 40);

      if (!batchResult.success) {
        batchesFailed++;
        batchRows.forEach((row: Record<string, string>, rowInBatchIdx: number) => {
          const globalRowIndex = startRowIdx + rowInBatchIdx + 1;
          skipped.push({
            rowIndex: globalRowIndex,
            row: row,
            reason: "AI extraction failed after retries: " + (batchResult.error || "Network error")
          });
        });
      } else {
        batchesProcessed++;
        const aiBatchData = batchResult.response!;
        batchRows.forEach((row: Record<string, string>, rowInBatchIdx: number) => {
          const globalRowIndex = startRowIdx + rowInBatchIdx + 1;
          const aiRowItem = aiBatchData[rowInBatchIdx];

          if (!aiRowItem || aiRowItem.status === 'skipped') {
            skipped.push({
              rowIndex: globalRowIndex,
              row: row,
              reason: aiRowItem?.reason || "Neither email nor mobile number present."
            });
            return;
          }

          // Operational validation sequence:
          const raw: Partial<AICRMRecord> = aiRowItem.data || {};

          // 2. Rebuild the object explicitly (safeRecord) by property name
          const safeRecord = {
            created_at: raw.created_at ?? null,
            name: raw.name ?? null,
            email: raw.email ?? null,
            country_code: raw.country_code ?? null,
            mobile_without_country_code: raw.mobile_without_country_code ?? null,
            company: raw.company ?? null,
            city: raw.city ?? null,
            state: raw.state ?? null,
            country: raw.country ?? null,
            lead_owner: raw.lead_owner ?? null,
            crm_status: raw.crm_status ?? null,
            crm_note: raw.crm_note ?? null,
            data_source: raw.data_source ?? null,
            possession_time: raw.possession_time ?? null,
            description: raw.description ?? null,
          };

          // Special normalization mapping for enums if AI mappings contain minor casing/spacing offsets
          if (safeRecord.crm_status) {
            safeRecord.crm_status = normalizeStatus(safeRecord.crm_status);
          }
          if (safeRecord.data_source) {
            safeRecord.data_source = normalizeDataSource(safeRecord.data_source);
          }

          // 3. Formatting warning checks (malformed email/phone → crm_note, don't skip)
          const concerns: string[] = [];
          const rawEmail = safeRecord.email?.trim() || "";
          const rawPhone = safeRecord.mobile_without_country_code?.trim() || "";

          // Safe fallback presence check
          if (!rawEmail && !rawPhone) {
            skipped.push({
              rowIndex: globalRowIndex,
              row: row,
              reason: "Neither email nor mobile number present."
            });
            return;
          }

          if (rawEmail) {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(rawEmail)) {
              concerns.push(`Malformed email format: "${rawEmail}"`);
            }
          }

          if (rawPhone) {
            const cleanedPhone = rawPhone.replace(/[^0-9]/g, '');
            if (cleanedPhone.length < 7) {
              concerns.push(`Malformed mobile number: "${rawPhone}"`);
            }
          }

          if (concerns.length > 0) {
            const notePrefix = concerns.map(c => `[Warning: ${c}]`).join(' ');
            safeRecord.crm_note = safeRecord.crm_note
              ? `${notePrefix} | ${safeRecord.crm_note}`
              : notePrefix;
          }

          // Fallback name logic
          if (!safeRecord.name || !safeRecord.name.trim()) {
            safeRecord.name = "Unknown Lead";
          }

          // 4. Validate schema against Zod CRMRecordSchema
          const validation = CRMRecordSchema.safeParse(safeRecord);
          if (validation.success) {
            imported.push(validation.data);
          } else {
            const errorMessages = validation.error.issues.map(issue => `${issue.path.join('.')}: ${issue.message}`).join(', ');
            skipped.push({
              rowIndex: globalRowIndex,
              row: row,
              reason: errorMessages
            });
          }
        });
      }
    });

    return res.status(200).json({
      totalRows: dataRows.length,
      totalImported: imported.length,
      totalSkipped: skipped.length,
      batchesProcessed,
      batchesFailed,
      records: imported,
      skipped
    });

  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : "An unexpected server error occurred.";
    console.error("AI Import Process failed:", error);
    return res.status(500).json({ error: "API Import Process failed: " + errMsg });
  }
}
