const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const multer = require('multer');
const sharp = require('sharp');

const UPLOAD_DIR = path.join(__dirname, '..', '..', '..', 'frontend', 'uploads');
const MAX_FILES = 10;
const MAX_IMAGE_DIMENSION = 1920;
const IMAGE_QUALITY = 78;

const ALLOWED_TYPES = {
    'image/jpeg': 'image',
    'image/png': 'image',
    'image/webp': 'image',
    'image/gif': 'image',
    'video/mp4': 'video',
    'video/webm': 'video',
    'video/quicktime': 'video',
};

const upload = multer({
    storage: multer.memoryStorage(),
    // Ограничения по размеру файла нет — только по количеству файлов за раз.
    limits: { files: MAX_FILES },
    fileFilter: (req, file, cb) => {
        if (!ALLOWED_TYPES[file.mimetype]) {
            return cb(new Error('Недопустимый тип файла. Разрешены изображения (jpg, png, webp, gif) и видео (mp4, webm, mov).'));
        }
        cb(null, true);
    },
});

// Изображения пережимаются в webp и уменьшаются до разумного размера,
// чтобы не раздувать хранилище. GIF сохраняется как есть — пережатие через
// sharp берёт только первый кадр и анимация теряется. Видео тоже сохраняется
// как есть — на сервере нет ffmpeg для транскодирования.
async function saveMediaFile(file) {
    const type = ALLOWED_TYPES[file.mimetype];
    const id = crypto.randomBytes(16).toString('hex');

    if (type === 'image' && file.mimetype !== 'image/gif') {
        const filename = `${id}.webp`;
        await sharp(file.buffer)
            .rotate()
            .resize({
                width: MAX_IMAGE_DIMENSION,
                height: MAX_IMAGE_DIMENSION,
                fit: 'inside',
                withoutEnlargement: true,
            })
            .webp({ quality: IMAGE_QUALITY })
            .toFile(path.join(UPLOAD_DIR, filename));
        return { url: `/uploads/${filename}`, type };
    }

    const extByMime = { 'image/gif': '.gif', 'video/webm': '.webm', 'video/mp4': '.mp4', 'video/quicktime': '.mov' };
    const filename = `${id}${extByMime[file.mimetype] || '.mp4'}`;
    await fs.promises.writeFile(path.join(UPLOAD_DIR, filename), file.buffer);
    return { url: `/uploads/${filename}`, type };
}

module.exports = { upload, saveMediaFile, ALLOWED_TYPES, UPLOAD_DIR, MAX_FILES };
