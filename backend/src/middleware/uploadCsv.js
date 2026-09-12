/**
 * Multer Upload Middleware
 * =========================
 * Configures multer for in-memory CSV uploads.
 * Files are held in memory (Buffer) and passed to downstream handlers —
 * no disk writes, no cleanup required.
 *
 * Limits:
 *  - Max file size: 5 MB
 *  - Accepted MIME types: text/csv, text/plain, application/vnd.ms-excel
 *  - Only one file per request (single field: "file")
 */
const multer = require('multer');
const path = require('path');

const ALLOWED_MIME_TYPES = new Set([
  'text/csv',
  'text/plain',
  'application/csv',
  'application/vnd.ms-excel',
  'application/octet-stream', // Some browsers send this for .csv
]);

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  if (ext !== '.csv' && ext !== '.txt') {
    return cb(
      Object.assign(new Error('Only CSV files are accepted (.csv or .txt)'), { status: 422 }),
      false
    );
  }
  if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
    return cb(
      Object.assign(new Error(`Invalid MIME type: ${file.mimetype}. Please upload a CSV file.`), { status: 422 }),
      false
    );
  }
  cb(null, true);
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: MAX_FILE_SIZE_BYTES, files: 1 },
});

/**
 * Single-file CSV upload middleware.
 * Field name must be "file" in the multipart form-data.
 * Wraps multer errors into a consistent 422 JSON response.
 */
const uploadCsv = (req, res, next) => {
  upload.single('file')(req, res, (err) => {
    if (!err) return next();

    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({
        success: false,
        error: `File too large. Maximum allowed size is ${MAX_FILE_SIZE_BYTES / 1024 / 1024} MB.`,
      });
    }
    if (err.code === 'LIMIT_UNEXPECTED_FILE') {
      return res.status(422).json({
        success: false,
        error: 'Unexpected file field. Use field name "file".',
      });
    }
    return res.status(err.status || 422).json({
      success: false,
      error: err.message || 'File upload error.',
    });
  });
};

module.exports = uploadCsv;
