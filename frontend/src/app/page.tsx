'use client';

import React, { useState, useRef, useEffect } from 'react';
import Papa from 'papaparse';
import { 
  Upload, 
  FileSpreadsheet, 
  X, 
  ArrowRight, 
  ArrowLeft, 
  CheckCircle, 
  AlertTriangle, 
  Database,
  RefreshCw,
  Search,
  Info,
  Sun,
  Moon
} from 'lucide-react';

// Exact CRM fields from PRD
const CRM_FIELDS = [
  'created_at',
  'name',
  'email',
  'country_code',
  'mobile_without_country_code',
  'company',
  'city',
  'state',
  'country',
  'lead_owner',
  'crm_status',
  'crm_note',
  'data_source',
  'possession_time',
  'description'
] as const;

type Step = 'upload' | 'preview' | 'confirm' | 'result';

interface PreviewData {
  headers: string[];
  rows: string[][];
}

interface ImportSummary {
  totalRows: number;
  totalImported: number;
  totalSkipped: number;
}

interface SkippedRecord {
  rowIndex?: number;
  row: Record<string, string>;
  reason: string;
}

interface CRMRecord {
  created_at: string | null;
  name: string;
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

export default function CSVImporterWizard() {
  const [step, setStep] = useState<Step>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [previewData, setPreviewData] = useState<PreviewData | null>(null);
  
  // Theme state
  const [darkMode, setDarkMode] = useState(false);

  useEffect(() => {
    const savedTheme = localStorage.getItem('theme');
    const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    if (savedTheme === 'dark' || (!savedTheme && systemPrefersDark)) {
      setDarkMode(true);
      document.documentElement.classList.add('dark');
    } else {
      setDarkMode(false);
      document.documentElement.classList.remove('dark');
    }
  }, []);

  const toggleDarkMode = () => {
    if (darkMode) {
      setDarkMode(false);
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    } else {
      setDarkMode(true);
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    }
  };
  
  // Progress/Confirm states
  const [importing, setImporting] = useState(false);
  const [progressBatch, setProgressBatch] = useState(1);
  const [totalBatches, setTotalBatches] = useState(1);
  const [progressPercent, setProgressPercent] = useState(0);

  // Client-side and import validation error states
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);

  // Result states
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [importedRecords, setImportedRecords] = useState<CRMRecord[]>([]);
  const [skippedRecords, setSkippedRecords] = useState<SkippedRecord[]>([]);

  // Search/Filter in Step 4
  const [resultSearchTerm, setResultSearchTerm] = useState('');
  const [resultFilter, setResultFilter] = useState<'all' | 'imported' | 'skipped'>('all');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);

  // Stricter file validation
  const validateFile = (fileObj: File): boolean => {
    setUploadError(null);

    // Limit to 5MB
    const maxSize = 5 * 1024 * 1024;
    if (fileObj.size > maxSize) {
      setUploadError("File size exceeds the 5MB limit. Please upload a smaller CSV.");
      return false;
    }

    // Reject non-csv extensions
    if (!fileObj.name.toLowerCase().endsWith('.csv')) {
      setUploadError("Only CSV files (.csv) are allowed.");
      return false;
    }

    return true;
  };

  // Handle Drag Events
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  // Handle Drop
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const droppedFile = e.dataTransfer.files[0];
      if (validateFile(droppedFile)) {
        setFile(droppedFile);
        parseCSV(droppedFile);
      }
    }
  };

  // Handle File Selector Change
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      if (validateFile(selectedFile)) {
        setFile(selectedFile);
        parseCSV(selectedFile);
      }
    }
  };

  const removeFile = () => {
    setFile(null);
    setPreviewData(null);
    setUploadError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const parseCSV = (fileToParse: File) => {
    setUploadError(null);
    Papa.parse(fileToParse, {
      skipEmptyLines: true,
      complete: (results) => {
        const rawData = results.data as string[][];
        if (rawData.length > 0) {
          const headers = rawData[0];
          const rows = rawData.slice(1);
          setPreviewData({ headers, rows });
        } else {
          setUploadError("CSV file is empty.");
          setFile(null);
        }
      },
      error: (error) => {
        console.error("Papaparse error:", error);
        setUploadError("Error reading CSV file.");
        setFile(null);
      }
    });
  };

  // Format File Size
  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = 2;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  };

  // Step 3 - Start Import and simulate progress bar over single request
  const triggerImport = async () => {
    if (!file) return;
    
    setStep('confirm');
    setImporting(true);
    setImportError(null);
    setProgressBatch(1);
    setProgressPercent(5);

    const totalRows = previewData?.rows.length || 0;
    const calculatedTotalBatches = Math.max(1, Math.ceil(totalRows / 20));
    setTotalBatches(calculatedTotalBatches);

    let currentBatch = 1;
    const interval = setInterval(() => {
      setProgressPercent((prev) => {
        const next = prev + Math.floor(Math.random() * 4) + 1;
        return next > 95 ? 95 : next;
      });
      setProgressBatch((prev) => {
        if (prev < calculatedTotalBatches) {
          return prev + 1;
        }
        return prev;
      });
    }, 600);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('http://localhost:4000/api/import', {
        method: 'POST',
        body: formData,
      });

      const responseData = await response.json();

      if (!response.ok) {
        throw new Error(responseData.error || 'Server returned an error.');
      }

      clearInterval(interval);
      setProgressBatch(calculatedTotalBatches);
      setProgressPercent(100);

      setTimeout(() => {
        setSummary({
          totalRows: responseData.totalRows,
          totalImported: responseData.totalImported,
          totalSkipped: responseData.totalSkipped,
        });
        setImportedRecords(responseData.records || []);
        setSkippedRecords(responseData.skipped || []);
        setImporting(false);
        setStep('result');
      }, 400);

    } catch (error: unknown) {
      clearInterval(interval);
      setImporting(false);
      const errMsg = error instanceof Error ? error.message : "An unexpected error occurred during import.";
      setImportError(errMsg);
    }
  };

  const handleReset = () => {
    setFile(null);
    setPreviewData(null);
    setSummary(null);
    setImportedRecords([]);
    setSkippedRecords([]);
    setUploadError(null);
    setImportError(null);
    setStep('upload');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Filtered lists in result
  const filteredImported = importedRecords.filter(rec => 
    Object.values(rec).some(val => 
      String(val || '').toLowerCase().includes(resultSearchTerm.toLowerCase())
    )
  );

  const filteredSkipped = skippedRecords.filter(rec => 
    rec.reason.toLowerCase().includes(resultSearchTerm.toLowerCase()) ||
    (rec.row && Object.entries(rec.row).some(([key, val]) => 
      String(val || '').toLowerCase().includes(resultSearchTerm.toLowerCase())
    ))
  );

  return (
    <div className="flex-1 min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col font-sans transition-colors duration-200">
      {/* Premium Header */}
      <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-6 py-4 sticky top-0 z-30 shadow-xs transition-colors duration-200">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="bg-primary/10 p-2 rounded-xl text-primary">
              <Database className="w-6 h-6 stroke-[2.5]" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100 tracking-tight flex items-center gap-2">
                GrowEasy <span className="text-slate-400 font-normal">|</span> <span className="text-primary font-semibold">AI CSV Importer</span>
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Clean, validate & import arbitrary CSV data into GrowEasy CRM schema</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Stepper Navigation Indicator */}
            <nav className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400 font-semibold select-none">
              <span className={`px-3 py-1.5 rounded-lg transition ${step === 'upload' ? 'bg-primary/10 text-primary' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'}`}>1. Upload</span>
              <ArrowRight className="w-4 h-4 text-slate-300 dark:text-slate-700" />
              <span className={`px-3 py-1.5 rounded-lg transition ${step === 'preview' ? 'bg-primary/10 text-primary' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'}`}>2. Preview</span>
              <ArrowRight className="w-4 h-4 text-slate-300 dark:text-slate-700" />
              <span className={`px-3 py-1.5 rounded-lg transition ${step === 'confirm' ? 'bg-primary/10 text-primary' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'}`}>3. Confirm</span>
              <ArrowRight className="w-4 h-4 text-slate-300 dark:text-slate-700" />
              <span className={`px-3 py-1.5 rounded-lg transition ${step === 'result' ? 'bg-primary/10 text-primary' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'}`}>4. Results</span>
            </nav>

            {/* Dark Mode Toggle */}
            <button
              onClick={toggleDarkMode}
              className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition cursor-pointer"
              title="Toggle Theme"
              aria-label="Toggle Theme"
            >
              {darkMode ? <Sun className="w-4.5 h-4.5" /> : <Moon className="w-4.5 h-4.5" />}
            </button>
          </div>
        </div>
      </header>

    {/* Main content container */}
    <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 py-8 flex flex-col justify-center">
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-6 sm:p-8 flex flex-col min-h-[500px] transition-colors duration-200">
        
        {/* STEP 1: Upload CSV */}
        {step === 'upload' && (
          <div className="flex-1 flex flex-col justify-center items-center">
            <div className="max-w-xl w-full text-center">
              <h2 className="text-2xl font-extrabold text-slate-800 dark:text-slate-100 tracking-tight mb-2">Upload Your Contact File</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-8 leading-relaxed">
                Select any CSV file containing leads. We will let you preview the data before performing smart CRM attribute mapping.
              </p>

              {/* Upload Area */}
              <div 
                className={`border-2 border-dashed rounded-2xl p-8 flex flex-col items-center justify-center cursor-pointer transition relative group ${
                  dragActive ? 'border-primary bg-primary/5' : 'border-slate-300 dark:border-slate-700 hover:border-primary hover:bg-slate-50/50 dark:hover:bg-slate-800/20'
                }`}
                  onDragEnter={handleDrag}
                  onDragOver={handleDrag}
                  onDragLeave={handleDrag}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <input 
                    ref={fileInputRef}
                    type="file" 
                    accept=".csv"
                    className="hidden" 
                    onChange={handleFileChange}
                  />

                  <div className="bg-primary/10 p-4 rounded-full text-primary mb-4 group-hover:scale-110 transition duration-300">
                    <Upload className="w-8 h-8" />
                  </div>

                <p className="font-semibold text-slate-700 dark:text-slate-200 mb-1">
                  Drag and drop your CSV here, or <span className="text-primary hover:underline">browse files</span>
                </p>
                <p className="text-xs text-slate-400 dark:text-slate-500">Only .csv files are supported</p>
              </div>

              {/* Selected File Chip */}
              {file && (
                <div className="mt-6 flex items-center justify-between p-3.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 rounded-xl max-w-lg mx-auto animate-in fade-in slide-in-from-bottom-2 duration-300">
                  <div className="flex items-center gap-3 overflow-hidden">
                    <div className="bg-emerald-100 dark:bg-emerald-950/50 p-2 rounded-lg text-emerald-600 dark:text-emerald-400 shrink-0">
                      <FileSpreadsheet className="w-5 h-5" />
                    </div>
                    <div className="text-left overflow-hidden">
                      <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 truncate max-w-[240px] sm:max-w-[320px]">{file.name}</p>
                      <span className="inline-block text-[10px] font-bold bg-slate-200/80 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded-full mt-0.5">
                        {formatBytes(file.size)}
                      </span>
                    </div>
                  </div>
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      removeFile();
                    }}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-200/50 dark:hover:bg-slate-700/50 transition cursor-pointer"
                    title="Remove file"
                  >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}

                {uploadError && (
                  <div className="mt-4 p-3 bg-rose-50 border border-rose-200 text-rose-600 rounded-xl text-sm font-medium flex items-center justify-center gap-2 max-w-lg mx-auto animate-in fade-in duration-200">
                    <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0" />
                    <span>{uploadError}</span>
                  </div>
                )}

                {/* Action button to Preview */}
                <div className="mt-8">
                  <button
                    disabled={!file}
                    onClick={() => setStep('preview')}
                    className={`inline-flex items-center gap-2 px-6 py-3 font-semibold rounded-xl transition select-none shadow-sm cursor-pointer ${
                    file 
                      ? 'bg-primary text-white hover:bg-primary-hover hover:shadow-md' 
                      : 'bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-600 cursor-not-allowed'
                  }`}
                  >
                    Next to Preview
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: Preview (Client-side Only) */}
          {step === 'preview' && previewData && (
            <div className="flex-grow flex flex-col h-full">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
                <div>
                  <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">CSV Raw Data Preview</h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Showing file rows as-is. Verify the headers look correct before validation.</p>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setStep('upload')}
                    className="inline-flex items-center gap-1.5 px-4 py-2 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 font-semibold text-sm rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    Back
                  </button>
                  <button
                    onClick={triggerImport}
                    className="inline-flex items-center gap-1.5 px-5 py-2 bg-primary text-white font-semibold text-sm rounded-lg hover:bg-primary-hover shadow-sm hover:shadow transition cursor-pointer"
                  >
                    Confirm Import
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Table Wrapper with Sticky Headers & Scrollbars */}
              <div className="flex-1 min-h-[350px] max-h-[500px] overflow-auto border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50 dark:bg-slate-900/50">
                <table className="w-full text-left border-collapse text-sm">
                  <thead className="sticky top-0 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 z-10 shadow-xs">
                    <tr>
                      <th className="p-3 text-slate-400 dark:text-slate-500 text-xs font-bold uppercase tracking-wider text-center bg-slate-100/50 dark:bg-slate-800/50 w-16">#</th>
                      {previewData.headers.map((header, idx) => (
                        <th 
                          key={idx} 
                          className="p-3 text-slate-700 dark:text-slate-300 font-bold uppercase tracking-wider bg-white dark:bg-slate-900 text-xs border-r border-slate-200 dark:border-slate-800 last:border-0"
                        >
                          {header || `Column ${idx + 1}`}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {previewData.rows.slice(0, 100).map((row, rowIdx) => (
                      <tr key={rowIdx} className="hover:bg-slate-100/50 dark:hover:bg-slate-800/30 transition">
                        <td className="p-3 text-center text-xs font-semibold text-slate-400 dark:text-slate-500 bg-slate-100/20 dark:bg-slate-800/20">{rowIdx + 1}</td>
                        {previewData.headers.map((_, colIdx) => (
                          <td key={colIdx} className="p-3 text-slate-600 dark:text-slate-300 border-r border-slate-100 dark:border-slate-800 last:border-0 whitespace-nowrap">
                            {row[colIdx] || <span className="text-slate-300 dark:text-slate-600 italic">empty</span>}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="mt-4 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 bg-slate-100/60 dark:bg-slate-800/40 p-3 rounded-lg border border-slate-200 dark:border-slate-800">
                <div className="flex items-center gap-1.5">
                  <Info className="w-4 h-4 text-primary" />
                  <span>Showing <span className="font-semibold text-slate-700 dark:text-slate-300">{previewData.rows.slice(0, 100).length}</span> of <span className="font-semibold text-slate-700 dark:text-slate-300">{previewData.rows.length}</span> data rows and <span className="font-semibold text-slate-700 dark:text-slate-300">{previewData.headers.length}</span> columns.</span>
                </div>
                <span>Source: {file?.name}</span>
              </div>
            </div>
          )}

          {/* STEP 3: Confirm Loading Screen or Error Recovery */}
          {step === 'confirm' && (
            <div className="flex-1 flex flex-col justify-center items-center py-12">
              {importing ? (
                <div className="max-w-md w-full text-center">
                  <div className="relative flex justify-center mb-6">
                    {/* Outer spinning ring */}
                    <div className="w-20 h-20 border-4 border-slate-200 dark:border-slate-800 border-t-primary rounded-full animate-spin"></div>
                    {/* Inner icon */}
                    <div className="absolute inset-0 flex justify-center items-center text-primary">
                      <RefreshCw className="w-7 h-7 animate-pulse" />
                    </div>
                  </div>

                  <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-2">Processing CSV Import</h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mb-8">Intelligently validating CRM fields and checking email & phone parameters...</p>

                  {/* Progress bar info */}
                  <div className="flex justify-between text-sm font-semibold text-slate-600 dark:text-slate-400 mb-2">
                    <span>Processing batch {progressBatch} of {totalBatches}...</span>
                    <span>{progressPercent}%</span>
                  </div>

                  {/* Progress track */}
                  <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-3 border border-slate-200 dark:border-slate-700 overflow-hidden shadow-inner">
                    <div 
                      className="bg-primary h-full transition-all duration-300 ease-out" 
                      style={{ width: `${progressPercent}%` }}
                    ></div>
                  </div>
                </div>
              ) : importError ? (
                <div className="max-w-md w-full text-center bg-rose-50/30 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900 rounded-2xl p-8 shadow-sm animate-in fade-in duration-300">
                  <div className="inline-flex p-4 rounded-full bg-rose-100 dark:bg-rose-950 text-rose-600 dark:text-rose-400 mb-4 animate-bounce">
                    <AlertTriangle className="w-8 h-8 font-bold" />
                  </div>
                  <h3 className="text-xl font-bold text-rose-800 dark:text-rose-400 mb-2">Import Process Failed</h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mb-6 leading-relaxed">
                    The server was unable to complete the import mapping.
                  </p>
                  
                  <div className="p-3.5 bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300 text-xs font-semibold rounded-xl border border-rose-100 dark:border-rose-900/50 mb-8 text-left break-words max-h-48 overflow-y-auto font-mono">
                    {importError}
                  </div>

                  <div className="flex items-center justify-center gap-3">
                    <button
                      onClick={() => {
                        setStep('preview');
                        setImportError(null);
                      }}
                      className="inline-flex items-center justify-center px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-bold text-sm rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer shadow-xs transition"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={triggerImport}
                      className="inline-flex items-center justify-center gap-1.5 px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold text-sm rounded-lg cursor-pointer shadow-sm transition"
                    >
                      <RefreshCw className="w-4 h-4 shrink-0" />
                      Try Again
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          )}

          {/* STEP 4: Results Dashboard */}
          {step === 'result' && summary && (
            <div className="flex-grow flex flex-col h-full animate-in fade-in duration-300">
              {summary.totalRows === 0 ? (
                <div className="flex-grow flex flex-col justify-center items-center py-16 text-center">
                  <div className="bg-blue-50 dark:bg-blue-950/50 text-blue-500 p-5 rounded-full mb-6">
                    <Database className="w-10 h-10 animate-pulse" />
                  </div>
                  <h3 className="text-2xl font-black text-slate-800 dark:text-slate-100 tracking-tight mb-2">No Leads to Import</h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md mb-8 leading-relaxed">
                    The uploaded file has headers but contains zero rows of lead data. Please make sure your spreadsheet has at least one valid row.
                  </p>
                  <button
                    onClick={handleReset}
                    className="inline-flex items-center gap-1.5 px-6 py-3 bg-primary text-white font-semibold rounded-xl hover:bg-primary-hover shadow-sm hover:shadow transition cursor-pointer"
                  >
                    <RefreshCw className="w-4 h-4" />
                    Upload Another File
                  </button>
                </div>
              ) : <>
                  {/* Heading */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                    <div>
                      <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">Import Complete</h2>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Results of mapping arbitrary columns into the CRM schema.</p>
                    </div>
                    <button
                      onClick={handleReset}
                      className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary text-white font-semibold text-sm rounded-lg hover:bg-primary-hover shadow-sm hover:shadow transition cursor-pointer"
                    >
                      <RefreshCw className="w-4 h-4" />
                      Import Another File
                    </button>
                  </div>

              {/* Summary stats bar */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
                {/* Total Rows Card */}
                <div className="bg-slate-50 dark:bg-slate-800/40 p-4 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center justify-between transition-colors duration-200">
                  <div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider">Total Rows</p>
                    <h4 className="text-2xl font-black text-slate-800 dark:text-slate-100 mt-0.5">{summary.totalRows}</h4>
                  </div>
                  <div className="bg-slate-200 dark:bg-slate-700 p-2.5 rounded-lg text-slate-600 dark:text-slate-305">
                    <Database className="w-5 h-5" />
                  </div>
                </div>

                {/* Total Imported Card */}
                <div className="bg-emerald-50/50 dark:bg-emerald-950/20 p-4 rounded-xl border border-emerald-100 dark:border-emerald-900/30 flex items-center justify-between transition-colors duration-200">
                  <div>
                    <p className="text-xs text-emerald-600 dark:text-emerald-400 font-bold uppercase tracking-wider">Total Imported</p>
                    <h4 className="text-2xl font-black text-emerald-800 dark:text-emerald-305 mt-0.5">{summary.totalImported}</h4>
                  </div>
                  <div className="bg-emerald-100 dark:bg-emerald-900/50 p-2.5 rounded-lg text-emerald-600 dark:text-emerald-400">
                    <CheckCircle className="w-5 h-5" />
                  </div>
                </div>

                {/* Total Skipped Card */}
                <div className="bg-rose-50/50 dark:bg-rose-950/20 p-4 rounded-xl border border-rose-100 dark:border-rose-900/30 flex items-center justify-between transition-colors duration-200">
                  <div>
                    <p className="text-xs text-rose-600 dark:text-rose-400 font-bold uppercase tracking-wider">Total Skipped</p>
                    <h4 className="text-2xl font-black text-rose-800 dark:text-rose-300 mt-0.5">{summary.totalSkipped}</h4>
                  </div>
                  <div className="bg-rose-100 dark:bg-rose-900/50 p-2.5 rounded-lg text-rose-600 dark:text-rose-400">
                    <AlertTriangle className="w-5 h-5" />
                  </div>
                </div>
              </div>

              {/* Filtering & Search Controls */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 mb-4">
                <div className="flex border border-slate-200 dark:border-slate-800 rounded-lg p-0.5 bg-slate-100 dark:bg-slate-800 self-start">
                  <button
                    onClick={() => setResultFilter('all')}
                    className={`px-3 py-1.5 text-xs font-bold rounded-md transition ${resultFilter === 'all' ? 'bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 shadow-xs' : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'}`}
                  >
                    All Records ({summary.totalRows})
                  </button>
                  <button
                    onClick={() => setResultFilter('imported')}
                    className={`px-3 py-1.5 text-xs font-bold rounded-md transition ${resultFilter === 'imported' ? 'bg-white dark:bg-slate-700 text-emerald-700 dark:text-emerald-450 shadow-xs' : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'}`}
                  >
                    Imported ({summary.totalImported})
                  </button>
                  <button
                    onClick={() => setResultFilter('skipped')}
                    className={`px-3 py-1.5 text-xs font-bold rounded-md transition ${resultFilter === 'skipped' ? 'bg-white dark:bg-slate-700 text-rose-700 dark:text-rose-455 shadow-xs' : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'}`}
                  >
                    Skipped ({summary.totalSkipped})
                  </button>
                </div>

                <div className="relative max-w-sm w-full">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Search results..."
                    value={resultSearchTerm}
                    onChange={(e) => setResultSearchTerm(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 border border-slate-200 dark:border-slate-800 rounded-lg text-sm bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-primary transition"
                  />
                </div>
              </div>

              {/* Result Lists */}
              <div className="flex-1 flex flex-col gap-6">

                {/* MAPPED RECORDS TABLE (Step 4 - Successfully Mapped CRM fields) */}
                {(resultFilter === 'all' || resultFilter === 'imported') && (
                  <div className="flex flex-col border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden bg-white dark:bg-slate-900">
                    <div className="bg-slate-50 dark:bg-slate-850 border-b border-slate-200 dark:border-slate-850 px-4 py-3 flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Successfully Mapped CRM Records</span>
                      <span className="bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 px-2 py-0.5 rounded-full text-[10px] font-bold">CRM Mapped</span>
                    </div>
                    {filteredImported.length === 0 ? (
                      <div className="py-8 text-center text-sm text-slate-400 dark:text-slate-600">No imported records found.</div>
                    ) : (
                      <div className="overflow-x-auto max-h-[350px]">
                        <table className="w-full text-left border-collapse text-xs">
                          <thead className="sticky top-0 bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 z-10">
                            <tr>
                              <th className="p-2.5 text-slate-400 dark:text-slate-500 text-[10px] font-bold uppercase tracking-wider text-center w-12 bg-slate-100/50 dark:bg-slate-800/50">#</th>
                              {CRM_FIELDS.map((field) => (
                                <th 
                                  key={field} 
                                  className="p-2.5 text-slate-700 dark:text-slate-300 font-bold uppercase tracking-wider bg-slate-50 dark:bg-slate-800 border-r border-slate-100 dark:border-slate-800 last:border-0 whitespace-nowrap"
                                >
                                  {field}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {filteredImported.map((record, idx) => (
                              <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/20 transition">
                                <td className="p-2.5 text-center text-[10px] font-semibold text-slate-400 dark:text-slate-500 bg-slate-50/50 dark:bg-slate-800/50">{idx + 1}</td>
                                {CRM_FIELDS.map((field) => {
                                  // Explicitly access the field by its key name, defaulting to null if it doesn't exist
                                  const val = record[field] !== undefined ? record[field] : null;
                                  const isEmpty = val === null || val === "";
                                  
                                  // Check formatting concerns noted in crm_note
                                  const note = String(record['crm_note'] || "");
                                  const hasEmailWarning = field === 'email' && (
                                    note.toLowerCase().includes('email format') || 
                                    note.toLowerCase().includes('malformed email')
                                  );
                                  const hasPhoneWarning = field === 'mobile_without_country_code' && (
                                    note.toLowerCase().includes('mobile number') || 
                                    note.toLowerCase().includes('malformed mobile') ||
                                    note.toLowerCase().includes('phone format')
                                  );
                                  
                                  // Style badges for status/datasource/note
                                  const isStatus = field === 'crm_status';
                                  const isSource = field === 'data_source';
                                  const isNote = field === 'crm_note';
                                  const isWarningNote = isNote && (
                                    note.startsWith('[Warning:') ||
                                    note.toLowerCase().includes('issue') ||
                                    note.toLowerCase().includes('warning')
                                  );

                                  const isLongField = field === 'crm_note' || field === 'description';

                                  return (
                                    <td 
                                      key={field} 
                                      className={`p-2.5 border-r border-slate-100 dark:border-slate-850 last:border-0 transition ${
                                        isLongField 
                                          ? 'min-w-[260px] max-w-[400px] whitespace-normal break-words text-xs' 
                                          : 'whitespace-nowrap max-w-[200px] truncate'
                                      } ${
                                        hasEmailWarning || hasPhoneWarning ? 'bg-amber-50 dark:bg-amber-950/20 text-amber-855 dark:text-amber-300' : 'text-slate-600 dark:text-slate-300'
                                      }`}
                                    >
                                      {isEmpty ? (
                                        <span className="text-blue-400 italic font-semibold">null</span>
                                      ) : isStatus ? (
                                        <span className={`inline-block px-2 py-0.5 rounded-full font-bold text-[9px] ${
                                          val === 'GOOD_LEAD_FOLLOW_UP' ? 'bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-900/50' :
                                          val === 'SALE_DONE' ? 'bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/50' :
                                          val === 'DID_NOT_CONNECT' ? 'bg-amber-50 dark:bg-amber-955 text-amber-600 dark:text-amber-400 border border-amber-100 dark:border-amber-900/50' :
                                          'bg-slate-100 dark:bg-slate-805 text-slate-600 dark:text-slate-300'
                                        }`}>
                                          {val}
                                        </span>
                                      ) : isSource ? (
                                        <span className="inline-block bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900/30 px-1.5 py-0.5 rounded font-bold text-[9px]">
                                          {val}
                                        </span>
                                      ) : isWarningNote ? (
                                        <span className="inline-flex items-start gap-1 bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-900/50 px-2.5 py-1.5 rounded-lg text-[10px] font-semibold whitespace-normal break-words">
                                          <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
                                          <span>{String(val)}</span>
                                        </span>
                                      ) : (
                                        <div className="flex items-center gap-1.5">
                                          {(hasEmailWarning || hasPhoneWarning) && (
                                            <span title={
                                              hasEmailWarning 
                                                ? "Warning: Malformed email address format" 
                                                : "Warning: Malformed mobile number format"
                                            }>
                                              <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                                            </span>
                                          )}
                                          <span className={hasEmailWarning || hasPhoneWarning ? 'font-semibold' : ''}>
                                            {String(val)}
                                          </span>
                                        </div>
                                      )}
                                    </td>
                                  );
                                })}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}

                {/* SKIPPED RECORDS ACCORDION SECTION (Step 4 - Expandable section for skipped records with reasons) */}
                {(resultFilter === 'all' || resultFilter === 'skipped') && (
                  <div className="flex flex-col border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden bg-white dark:bg-slate-900">
                    <div className="bg-slate-50 dark:bg-slate-850 border-b border-slate-200 dark:border-slate-850 px-4 py-3 flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Skipped Records Details</span>
                      <span className="bg-rose-100 dark:bg-rose-955 text-rose-800 dark:text-rose-300 px-2 py-0.5 rounded-full text-[10px] font-bold">Errors</span>
                    </div>

                    {filteredSkipped.length === 0 ? (
                      <div className="py-8 text-center text-sm text-slate-400 dark:text-slate-600">No skipped records found.</div>
                    ) : (
                      <div className="divide-y divide-slate-200 dark:divide-slate-800 max-h-[300px] overflow-auto">
                        {filteredSkipped.map((record, idx) => (
                          <div key={idx} className="p-4 hover:bg-rose-50/10 dark:hover:bg-rose-950/10 transition flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                            <div className="w-full">
                              <div className="flex items-center gap-2">
                                <span className="inline-flex justify-center items-center w-14 h-6 rounded bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-455 text-xs font-bold px-1.5">
                                  Row {record.rowIndex || idx + 1}
                                </span>
                                <h5 className="text-sm font-semibold text-slate-800 dark:text-slate-200">Validation Failure</h5>
                              </div>
                              <p className="text-xs text-rose-600 dark:text-rose-400 font-medium mt-1 bg-rose-50 dark:bg-rose-955 border border-rose-100 dark:border-rose-900/50 rounded px-2.5 py-1 inline-block">
                                Reason: {record.reason}
                              </p>
                              
                              {/* Show raw values mapped to CSV columns */}
                              <div className="mt-3">
                                <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1.5">Raw CSV Row Content:</p>
                                <div className="flex flex-wrap gap-2">
                                  {Object.entries(record.row || {}).map(([key, cell]) => (
                                    <span key={key} className="text-[10px] bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-2 py-0.5 rounded text-slate-600 dark:text-slate-300 max-w-[200px] truncate" title={`${key}: ${cell}`}>
                                      <span className="font-semibold text-slate-400">{key}:</span> {cell || <span className="text-slate-300 dark:text-slate-600 italic text-[9px]">empty</span>}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            </div>
                          </div>
                        ))
                      }
                      </div>
                    )}
                  </div>
                )}
              </div>
            </>
          }
        </div>
      )}

        </div>
      </main>

      {/* Footer */}
      <footer className="bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 py-6 text-center text-xs text-slate-400 dark:text-slate-500 mt-auto">
        <div className="max-w-7xl mx-auto px-6">
          <p>© 2026 GrowEasy. All rights reserved. Premium Dashboard UI Engine.</p>
        </div>
      </footer>
    </div>
  );
}
