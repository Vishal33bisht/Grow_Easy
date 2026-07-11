import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import multer from 'multer';
import dotenv from 'dotenv';
import { corsOptions } from './config/cors';
import importRouter from './routes/import';

dotenv.config();

// Loud, clear logs on startup if GEMINI_API_KEY environment variable is not defined
if (!process.env.GEMINI_API_KEY) {
  console.error("==========================================================================");
  console.error("WARNING: GEMINI_API_KEY environment variable is not defined or is empty!");
  console.error("Google Gemini AI features will fail. Please add it to your .env file.");
  console.error("==========================================================================");
}

const app = express();
const port = process.env.PORT || 4000;

app.use(cors(corsOptions));
app.use(express.json());

// API route mount points
app.use('/api', importRouter);

// Global Error Handling Middleware catching CORS and Multer validations
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ error: "File size exceeds the 5MB limit." });
    }
    return res.status(400).json({ error: `Upload error: ${err.message}` });
  }

  if (err.message === "Only CSV files (.csv) are allowed.") {
    return res.status(400).json({ error: err.message });
  }

  if (err.message === "Not allowed by CORS") {
    return res.status(403).json({ error: "CORS policy restriction: origin not allowed." });
  }

  console.error("Unhandled Server Error:", err);
  return res.status(err.status || 500).json({
    error: err.message || "An unexpected server error occurred."
  });
});

app.listen(port, () => {
  console.log(`Backend server is running on http://localhost:${port}`);
});
