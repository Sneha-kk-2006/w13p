const multer  = require('multer');
const path    = require('path');
const fs      = require('fs');


const uploadDir = 'public/uploads/products';
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, path.join(__dirname, '../public/uploads/products'));
    },
    filename: (req, file, cb) => {
        let ext = path.extname(file.originalname).toLowerCase();
        
        if (!ext || ext === '.') {
            const mimeToExt = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'image/gif': '.gif' };
            ext = mimeToExt[file.mimetype] || '.jpg';
        }
        cb(null, Date.now() + '-' + Math.round(Math.random() * 1e9) + ext);
    }
});

const fileFilter = (req, file, cb) => {
    // Accept by MIME type (covers blobs from Cropper.js)
    if (file.mimetype && file.mimetype.startsWith('image/')) {
        return cb(null, true);
    }
    // Fallback: accept by file extension
    const allowed = /jpeg|jpg|png|webp|gif/;
    if (allowed.test(path.extname(file.originalname).toLowerCase())) {
        return cb(null, true);
    }
    cb(new Error('Only image files are allowed'));
};

const upload = multer({ storage, fileFilter });

module.exports = upload;