# GrowEasy — AI-Powered CSV CRM Importer

A premium, full-stack, AI-powered CSV lead importer designed for **GrowEasy CRM**. This tool allows businesses to upload any lead export CSV, preview mapped data, and validate arbitrary layouts against the strict 15-field CRM schema using Google's Gemini generative AI engine.

---

## 🚀 Live Demo

*   **Frontend (Vercel)**: [https://frontend-ten-liard-61.vercel.app](https://frontend-ten-liard-61.vercel.app)
*   **Backend API (Render)**: [https://grow-easy-backend.onrender.com](https://grow-easy-backend.onrender.com)

---

## ✨ Features

### 🎨 Dark Mode Theme Integration
*   **Tailwind CSS v4 Class Variant**: Configured with class-based theme selector `@variant dark (&:where(.dark, .dark *));`.
*   **Persistent Preferences**: Automatically detects system theme preferences and persists changes across reloads in `localStorage`.
*   **High-Contrast Premium UI**: Features customized color schemes for cards, tables, loading state indicators, and error accordions.

### 🧠 Smart Gemini Mapping & Rotational Fallbacks
*   **AI Column Mapping**: Uses Gemini models to translate arbitrary header names (e.g., `work_email`, `mobile_no`) into standardized CRM schema properties.
*   **Sequential Batch Processing**: Processes leads in sequential batches with a 5-second pacing delay to remain strictly within the free-tier rate limits (15 RPM).
*   **Model Rotation Queue**: Prioritizes `gemini-3.5-flash` and `gemini-flash-latest` as fallbacks to ensure zero interruption when standard project quotas are exhausted.

### 🛡️ Hardened Validation & Defense in Depth
*   **5MB Size Limits**: Dual client-side and server-side checks reject files exceeding 5MB instantly.
*   **Mimetype Whitelists**: Blocks non-CSV uploads at the upload routing layer.
*   **Empty Sheets Handling**: Gracefully handles headers-only CSV files, returning `200 OK` with 0 records mapped instead of crashing.
*   **CORS Fail-Safes**: Dynamic port binding whitelist matching dynamic development hostnames.

### ⚡ Performance Optimizations
*   **Client-Side Slice Render**: Limits the initial HTML preview table to the first 100 rows to keep response times under 50ms, even on 500+ row sheets.
*   **State Cleanups**: Resets all state memory cleanly upon clicking "Import Another File" to prevent cross-contamination.

---

## 📁 Project Structure

```
Grow_Easy/
├── frontend/         # Next.js App Router, Tailwind CSS, TypeScript
├── backend/          # Express API, Google GenAI SDK, csv-parse, TS
├── vercel.json       # Monorepo Vercel routing configuration
└── README.md         # Project documentation
```

---

## 🛠️ Local Installation

### Prerequisites
*   Node.js (v18+)
*   NPM or Yarn
*   A Gemini API Key (obtained from Google AI Studio)

### 1. Backend Setup
1.  Navigate to the backend directory:
    ```bash
    cd backend
    ```
2.  Install dependencies:
    ```bash
    npm install
    ```
3.  Configure your environment variables:
    Create a `.env` file in the root of the `backend` directory:
    ```env
    PORT=4000
    GEMINI_API_KEY=your_gemini_api_key_here
    ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3001
    ```
4.  Start the development server:
    ```bash
    npm run dev
    ```
    The API service will launch at `http://localhost:4000`.

### 2. Frontend Setup
1.  Navigate to the frontend directory:
    ```bash
    cd frontend
    ```
2.  Install dependencies:
    ```bash
    npm install
    ```
3.  Configure your environment variables:
    Create a `.env.local` file in the root of the `frontend` directory:
    ```env
    NEXT_PUBLIC_API_URL=http://localhost:4000
    ```
4.  Start the Next.js development server:
    ```bash
    npm run dev
    ```
    Open `http://localhost:3001` (or the port specified in your console logs) in your browser.
