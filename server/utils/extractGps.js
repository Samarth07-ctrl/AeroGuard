/**
 * extractGps.js
 * Bulletproof EXIF GPS extraction with Pune fallback.
 *
 * Usage:
 *   const { lat, lon, source } = await extractGps(absoluteImagePath);
 *
 * Returns:
 *   { lat: number, lon: number, source: 'exif' | 'fallback' }
 *
 * Never throws — always returns valid coordinates.
 */

const PUNE_LAT = 18.5204;
const PUNE_LON = 73.8567;

/**
 * @param {string} imagePath  Absolute path to the uploaded image file.
 * @returns {Promise<{ lat: number, lon: number, source: 'exif'|'fallback' }>}
 */
async function extractGps(imagePath) {
  try {
    // exifr is an ES module in newer versions — use dynamic import so it works
    // in a CommonJS server without transpilation.
    const exifr = await import('exifr');
    const parse = exifr.default ?? exifr;

    const gps = await parse.gps(imagePath);

    if (
      gps &&
      typeof gps.latitude  === 'number' && isFinite(gps.latitude)  &&
      typeof gps.longitude === 'number' && isFinite(gps.longitude)
    ) {
      console.log(`[GPS] EXIF extracted: ${gps.latitude.toFixed(6)}, ${gps.longitude.toFixed(6)}`);
      return {
        lat: gps.latitude,
        lon: gps.longitude,
        source: 'exif',
      };
    }

    // GPS block present but empty / zero
    console.log('[GPS] EXIF present but no valid GPS — using Pune fallback');
  } catch (err) {
    // File has no EXIF, is a ZIP, or exifr couldn't parse it — all safe to ignore
    console.log(`[GPS] EXIF parse skipped (${err.message?.slice(0, 60)}) — using Pune fallback`);
  }

  return { lat: PUNE_LAT, lon: PUNE_LON, source: 'fallback' };
}

module.exports = { extractGps, PUNE_LAT, PUNE_LON };
