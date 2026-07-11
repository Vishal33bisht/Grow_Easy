import { GoogleGenerativeAI, Schema, SchemaType } from '@google/generative-ai';

let genAI: GoogleGenerativeAI | null = null;

function getGenAIClient(): GoogleGenerativeAI {
  if (!genAI) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("Gemini API Key is not configured on the server.");
    }
    console.log("INITIALIZING GEMINI SDK CLIENT WITH KEY PREFIX:", apiKey.substring(0, 15));
    genAI = new GoogleGenerativeAI(apiKey);
  }
  return genAI;
}

// TS interface representing the clean mapped record returned by the Gemini AI
export interface AICRMRecord {
  created_at: string | null;
  name: string | null;
  email: string | null;
  country_code: string | null;
  mobile_without_country_code: string | null;
  company: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  lead_owner: string | null;
  crm_status: string | null;
  crm_note: string | null;
  data_source: string | null;
  possession_time: string | null;
  description: string | null;
}

export interface AIBatchRowResponse {
  status: 'success' | 'skipped';
  reason: string | null;
  data: AICRMRecord | null;
}

// Strictly structured OpenAPI Response Schema for Gemini
const responseSchema: Schema = {
  type: SchemaType.ARRAY,
  description: "List of processed CSV rows mapped to standard CRM fields.",
  items: {
    type: SchemaType.OBJECT,
    properties: {
      status: {
        type: SchemaType.STRING,
        enum: ["success", "skipped"],
        description: "Whether the row mapping succeeded or was skipped due to missing email and phone numbers.",
        format: "enum"
      },
      reason: {
        type: SchemaType.STRING,
        nullable: true,
        description: "Reason for skipping, if applicable."
      },
      data: {
        type: SchemaType.OBJECT,
        nullable: true,
        description: "The mapped 15 standard CRM fields. Always present and populated with null when values are unknown.",
        properties: {
          created_at: { type: SchemaType.STRING, nullable: true },
          name: { type: SchemaType.STRING, nullable: true },
          email: { type: SchemaType.STRING, nullable: true },
          country_code: { type: SchemaType.STRING, nullable: true },
          mobile_without_country_code: { type: SchemaType.STRING, nullable: true },
          company: { type: SchemaType.STRING, nullable: true },
          city: { type: SchemaType.STRING, nullable: true },
          state: { type: SchemaType.STRING, nullable: true },
          country: { type: SchemaType.STRING, nullable: true },
          lead_owner: { type: SchemaType.STRING, nullable: true },
          crm_status: {
            type: SchemaType.STRING,
            enum: ["GOOD_LEAD_FOLLOW_UP", "DID_NOT_CONNECT", "BAD_LEAD", "SALE_DONE"],
            nullable: true,
            format: "enum"
          },
          crm_note: { type: SchemaType.STRING, nullable: true },
          data_source: {
            type: SchemaType.STRING,
            enum: ["leads_on_demand", "meridian_tower", "eden_park", "varah_swamy", "sarjapur_plots"],
            nullable: true,
            format: "enum"
          },
          possession_time: { type: SchemaType.STRING, nullable: true },
          description: { type: SchemaType.STRING, nullable: true }
        },
        required: [
          "created_at", "name", "email", "country_code", "mobile_without_country_code",
          "company", "city", "state", "country", "lead_owner", "crm_status",
          "crm_note", "data_source", "possession_time", "description"
        ]
      }
    },
    required: ["status", "reason", "data"]
  }
};

// System instruction prompt mapping rules
const systemPrompt = `You are a CRM data extraction engine for GrowEasy. You will receive a batch of raw CSV rows as a JSON array, where each row is an object whose keys are the ORIGINAL column headers from the source file (these vary between files and are never standardized) and whose values are the raw cell contents.

For EACH row, map available data onto this exact CRM schema:
- created_at: string, must be parseable by JavaScript \`new Date(...)\`. Prefer "YYYY-MM-DD HH:mm:ss". Use null if no date is present.
- name: string or null
- email: string or null (first email only, see rule 2). Extract the raw value exactly as is. Do NOT null it out or omit it just because its format is malformed or invalid (e.g. missing @ or double @). Keep it intact.
- country_code: string or null (e.g. "+91")
- mobile_without_country_code: string or null (digits only, no country code, no spaces or dashes). Extract the raw value exactly as is. Do NOT null it out or omit it just because it has too few digits or formatting symbols. Keep it intact.
- company: string or null
- city: string or null
- state: string or null
- country: string or null
- lead_owner: string or null
- crm_status: MUST be exactly one of "GOOD_LEAD_FOLLOW_UP", "DID_NOT_CONNECT", "BAD_LEAD", "SALE_DONE", or null. Never guess — only set it if there is clear textual evidence in the row.
- crm_note: string or null (see rule 4). Map interaction-specific status remarks or follow-up logs from columns like "Status Notes", "Interaction Log", "Call Notes" here (e.g. "Called but no response yet", "Following up next week").
- data_source: MUST be exactly one of "leads_on_demand", "meridian_tower", "eden_park", "varah_swamy", "sarjapur_plots", or null. Never guess — leave null if nothing matches confidently.
- possession_time: string or null
- description: string or null. Capture any general freeform comments, requirements, interest details, or remarks from columns like "Additional Comments", "Comments", or "Remarks" here (e.g. "Interested in 2BHK", "Budget conscious buyer"). Do not leave this null if there is a general comments/remarks column in the source CSV.

Rules:
1. Column names vary across files (Facebook Ads exports, Google Ads exports, real-estate CRM exports, manual spreadsheets, etc). Use SEMANTIC understanding of header names and values, not exact string matching. Example: "Phone", "Contact No", "WhatsApp Number", "Mobile" all map to mobile_without_country_code.
2. If multiple email addresses are present in the row — whether in the same cell (comma/semicolon separated) or in distinct columns (e.g. "Alternate Email", "Secondary Email", "Email 2") — use the first/primary one for \`email\` and append all secondary/alternate emails to \`crm_note\` prefixed with "Additional email(s): ...".
3. If multiple phone numbers are present in the row — whether in the same cell or in distinct columns (e.g. "Alternate Phone", "Secondary Phone", "Phone 2") — use the first/primary one (excluding country code) for \`mobile_without_country_code\` and append all secondary/alternate numbers to \`crm_note\` prefixed with "Additional number(s): ...".
4. Map general comments/remarks from columns like "Additional Comments" or "Comments" to \`description\`. Map interaction/call logs or follow-up notes (e.g. "Called but no response yet", "Booking confirmed") to \`crm_note\`. Concatenate multiple notes/comments using " | ".
5. If a row has NEITHER an email NOR a mobile number present in the raw data, mark that row as skipped. Do NOT skip or null out contact fields just because their format looks malformed or imperfect. Keep the raw contact data intact exactly as written in the source column if it is present. Never fabricate data to avoid a skip.
6. Escape any newline characters within a field's value as \\n so every record stays a single valid row.

Output ONLY a JSON array, same length and same order as the input batch, no markdown fences, no extra text. Each element:
{
  "status": "success" | "skipped",
  "reason": string | null,
  "data": { <all 15 schema fields, always present, null where unknown> } | null
}`;

// Helper to make Gemini API requests with concurrency retries and model fallback
export async function callGeminiWithRetry(batch: Record<string, string>[], batchNumber: number): Promise<AIBatchRowResponse[]> {
  const client = getGenAIClient();
  let attempts = 0;
  const maxAttempts = 4; // 1 initial + 3 retries

  while (attempts < maxAttempts) {
    try {
      attempts++;
      console.log(`[Batch ${batchNumber}] Starting attempt ${attempts}...`);

      // Robust model rotation: cycle through valid models on subsequent retries
      const modelsList = ["gemini-3.5-flash", "gemini-flash-latest", "gemini-3.5-flash", "gemini-flash-latest"];
      const modelName = modelsList[attempts - 1] || "gemini-3.5-flash";
      
      const model = client.getGenerativeModel({
        model: modelName,
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: responseSchema,
        }
      });

      const prompt = `Process this batch of CSV rows:\n\n${JSON.stringify(batch)}`;

      const result = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        systemInstruction: systemPrompt
      });

      const textResponse = result.response.text();
      const parsedResponse = JSON.parse(textResponse);

      if (!Array.isArray(parsedResponse) || parsedResponse.length !== batch.length) {
        throw new Error("Returned content is not a JSON array of matching batch length.");
      }

      console.log(`[Batch ${batchNumber}] Succeeded on attempt ${attempts}`);
      return parsedResponse as AIBatchRowResponse[];

    } catch (err: any) {
      console.error(`[Batch ${batchNumber}] Attempt ${attempts} failed:`, err.message);

      if (attempts >= maxAttempts) {
        throw new Error(`AI extraction failed after 3 retries: ${err.message}`);
      }

      // Check if error contains a recommended wait time (e.g. "Please retry in 13.38s.")
      const delayMatch = err.message ? err.message.match(/Please retry in (\d+(?:\.\d+)?)s/i) : null;
      const jitter = Math.floor(Math.random() * 1500) + 500; // 500ms to 2000ms jitter to prevent concurrent collision
      let delay = Math.pow(2, attempts - 1) * 3000 + jitter; // Default exponential backoff + jitter

      if (delayMatch) {
        const seconds = parseFloat(delayMatch[1]);
        delay = Math.ceil(seconds * 1000) + 1000 + jitter; // Convert to ms and add 1s safety buffer + jitter
        console.log(`[Batch ${batchNumber}] Rate limit tripped. Using extracted API Retry-After delay: ${delay}ms`);
      }

      console.log(`[Batch ${batchNumber}] Delaying for ${delay}ms before next retry...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw new Error("AI extraction failed.");
}
