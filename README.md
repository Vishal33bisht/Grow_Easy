# GrowEasy CSV Importer

A full-stack AI-powered CSV Importer that allows users to upload any CSV (leads, CRM exports, arbitrary column layouts), preview the content client-side, and import the mapped data into a strict 15-field GrowEasy CRM schema.

## Project Structure

```
groweasy-csv-importer/
├── frontend/         # Next.js 14 App Router, Tailwind CSS, TypeScript
├── backend/          # Express API, csv-parse, Zod validation, TypeScript
└── README.md         # This root README file
```

## Setup Instructions

### Backend (Express API)
1. Navigate to the backend directory:
   ```bash
   cd backend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the development server:
   ```bash
   npm run dev
   ```
   The backend API will run at `http://localhost:4000`.

### Frontend (Next.js)
1. Navigate to the frontend directory:
   ```bash
   cd frontend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the development server:
   ```bash
   npm run dev
   ```
   The frontend application will run at `http://localhost:3000`.
