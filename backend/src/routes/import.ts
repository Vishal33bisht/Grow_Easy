import { Router } from 'express';
import multer from 'multer';
import { handleImport } from '../controllers/import';

const router = Router();

// Multer upload configurations with file size and type filters
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB Limit
  },
  fileFilter: (req, file, cb) => {
    const originalName = file.originalname.toLowerCase();
    const hasCsvExt = originalName.endsWith('.csv');
    const hasCsvMime = [
      'text/csv', 
      'application/vnd.ms-excel', 
      'text/x-csv', 
      'application/csv', 
      'text/comma-separated-values',
      'text/plain',
      'application/octet-stream'
    ].includes(file.mimetype);

    if (hasCsvExt && hasCsvMime) {
      cb(null, true);
    } else {
      cb(new Error("Only CSV files (.csv) are allowed."));
    }
  }
});

// Bind post route
router.post('/import', upload.single('file'), handleImport);

export default router;
