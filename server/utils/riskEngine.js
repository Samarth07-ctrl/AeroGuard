function haversineDistanceKm(lat1, lon1, lat2, lon2) {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const R = 6371; // km
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function calculateRiskScore(distanceKm, humidity) {
  const cappedDistance = Math.max(0, Math.min(5, distanceKm));
  const distanceFactor = 1 - (cappedDistance / 5); // closer = higher
  const humidityFactor = Math.max(0, Math.min(1, Number(humidity || 0) / 100));
  const score = ((distanceFactor * 0.65) + (humidityFactor * 0.35)) * 100;
  return Math.max(0, Math.min(100, Math.round(score)));
}

function destinationPoint(lat, lon, bearingDeg, distanceKm) {
  const R = 6371;
  const toRad = (deg) => (deg * Math.PI) / 180;
  const toDeg = (rad) => (rad * 180) / Math.PI;

  const brng = toRad(bearingDeg);
  const dByR = distanceKm / R;
  const lat1 = toRad(lat);
  const lon1 = toRad(lon);

  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(dByR) +
    Math.cos(lat1) * Math.sin(dByR) * Math.cos(brng)
  );
  const lon2 = lon1 + Math.atan2(
    Math.sin(brng) * Math.sin(dByR) * Math.cos(lat1),
    Math.cos(dByR) - Math.sin(lat1) * Math.sin(lat2)
  );

  return { lat: toDeg(lat2), lon: toDeg(lon2) };
}

/**
 * applyBboxOffset
 * Converts a YOLO bounding box [x, y, w, h] (pixel coords, normalised 0–1
 * or absolute pixels given imageWidth/imageHeight) into a micro GPS offset
 * from the drone's EXIF centre coordinate.
 *
 * The drone's GSD (Ground Sample Distance) at typical agricultural altitude
 * (~50 m AGL, 12 MP sensor) is roughly 2–3 cm/px.  We use a conservative
 * 0.00001° per pixel offset (≈ 1.1 m) so that bbox centres spread across
 * the image map to distinct GPS points without over-exaggerating distances.
 *
 * @param {number} baseLat   - EXIF latitude of the drone centre
 * @param {number} baseLon   - EXIF longitude of the drone centre
 * @param {number[]|null} bbox - [x, y, width, height] in pixels or normalised
 * @param {number} [imgW=640] - image width in pixels (default YOLO input size)
 * @param {number} [imgH=640] - image height in pixels
 * @returns {{ lat: number, lon: number }}
 */
function applyBboxOffset(baseLat, baseLon, bbox, imgW = 640, imgH = 640) {
  if (!bbox || !Array.isArray(bbox) || bbox.length < 4) {
    return { lat: baseLat, lon: baseLon };
  }

  let [bx, by, bw, bh] = bbox.map(Number);

  // If values are normalised (0–1), convert to pixels
  if (bx <= 1 && by <= 1 && bw <= 1 && bh <= 1) {
    bx *= imgW;
    by *= imgH;
    bw *= imgW;
    bh *= imgH;
  }

  // Centre of the bounding box in pixels
  const cx = bx + bw / 2;
  const cy = by + bh / 2;

  // Offset from image centre (positive = right/down)
  const dx = cx - imgW / 2;
  const dy = cy - imgH / 2;

  // 0.00001° ≈ 1.11 m at equator — fine-grained but not absurd
  const DEG_PER_PX = 0.00001;

  const shiftedLat = baseLat - dy * DEG_PER_PX; // north is negative dy
  const shiftedLon = baseLon + dx * DEG_PER_PX;

  return {
    lat: Number(shiftedLat.toFixed(7)),
    lon: Number(shiftedLon.toFixed(7)),
  };
}

module.exports = {
  haversineDistanceKm,
  calculateRiskScore,
  destinationPoint,
  applyBboxOffset,
};
