/**
 * cloudinaryClient.js
 * Singleton Cloudinary v2 client.
 * Reads credentials from .env — never throws on missing config,
 * just returns null so callers can skip the upload gracefully.
 */
const cloudinary = require('cloudinary').v2;

const { CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET } = process.env;

let configured = false;

if (CLOUDINARY_CLOUD_NAME && CLOUDINARY_API_KEY && CLOUDINARY_API_SECRET) {
  cloudinary.config({
    cloud_name: CLOUDINARY_CLOUD_NAME,
    api_key:    CLOUDINARY_API_KEY,
    api_secret: CLOUDINARY_API_SECRET,
  });
  configured = true;
  console.log('[Cloudinary] Configured ✅');
} else {
  console.warn('[Cloudinary] Missing credentials — uploads will be skipped.');
}

/**
 * Upload an image file to Cloudinary.
 * @param {string} filePath  Absolute local path
 * @param {string} folder    Cloudinary folder name
 * @param {object} [opts]    Extra cloudinary upload options
 * @returns {Promise<{secure_url: string, public_id: string}|null>}
 */
async function uploadImage(filePath, folder = 'aeroguard/detections', opts = {}) {
  if (!configured) return null;
  try {
    const result = await cloudinary.uploader.upload(filePath, {
      folder,
      resource_type: 'image',
      ...opts,
    });
    return { secure_url: result.secure_url, public_id: result.public_id };
  } catch (err) {
    console.error('[Cloudinary] Image upload failed:', err.message);
    return null;
  }
}

/**
 * Upload a raw file (ZIP, binary) to Cloudinary.
 * @param {string} filePath  Absolute local path
 * @param {string} folder    Cloudinary folder name
 * @returns {Promise<{secure_url: string, public_id: string}|null>}
 */
async function uploadRaw(filePath, folder = 'aeroguard/zips') {
  if (!configured) return null;
  try {
    const result = await cloudinary.uploader.upload(filePath, {
      folder,
      resource_type: 'raw',
    });
    return { secure_url: result.secure_url, public_id: result.public_id };
  } catch (err) {
    console.error('[Cloudinary] Raw upload failed:', err.message);
    return null;
  }
}

module.exports = { uploadImage, uploadRaw, configured };
