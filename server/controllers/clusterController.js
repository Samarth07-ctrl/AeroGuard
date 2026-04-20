/**
 * Dynamic Spatial Clustering Engine (USP)
 * 
 * Reads from AnalysisSession (primary — covers single + batch uploads)
 * and merges with ScanSession.results + live in-memory alerts.
 *
 * FIX: Always resolves farmer email first so ALL uploads for that farmer
 *      are included — single uploads, batch uploads, multiple batches.
 */

// ── Haversine distance in meters ──
function haversineMeters(lat1, lon1, lat2, lon2) {
  const toRad = (d) => (d * Math.PI) / 180;
  const R = 6371000; // Earth radius in meters
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ── Simple DBSCAN-lite clustering ──
// Groups points within `radiusMeters` of each other
function clusterPoints(points, radiusMeters = 100) {
  const visited = new Set();
  const clusters = [];

  for (let i = 0; i < points.length; i++) {
    if (visited.has(i)) continue;
    visited.add(i);

    const cluster = [points[i]];

    // Expand cluster: find all neighbors recursively
    const queue = [i];
    while (queue.length > 0) {
      const current = queue.shift();
      for (let j = 0; j < points.length; j++) {
        if (visited.has(j)) continue;
        const dist = haversineMeters(
          points[current].lat, points[current].lon,
          points[j].lat, points[j].lon
        );
        if (dist <= radiusMeters) {
          visited.add(j);
          cluster.push(points[j]);
          queue.push(j);
        }
      }
    }

    clusters.push(cluster);
  }

  return clusters;
}

// ── Calculate bounding box for a cluster ──
function getBoundingBox(cluster) {
  let minLat = Infinity, maxLat = -Infinity;
  let minLon = Infinity, maxLon = -Infinity;

  for (const p of cluster) {
    if (p.lat < minLat) minLat = p.lat;
    if (p.lat > maxLat) maxLat = p.lat;
    if (p.lon < minLon) minLon = p.lon;
    if (p.lon > maxLon) maxLon = p.lon;
  }

  return { minLat, maxLat, minLon, maxLon };
}

// ── Expand bounding box by buffer in meters ──
function expandBounds(bounds, bufferMeters) {
  // 1 degree latitude ≈ 111,320 meters
  const latBuffer = bufferMeters / 111320;
  // 1 degree longitude varies by latitude
  const avgLat = (bounds.minLat + bounds.maxLat) / 2;
  const lonBuffer = bufferMeters / (111320 * Math.cos((avgLat * Math.PI) / 180));

  return {
    minLat: bounds.minLat - latBuffer,
    maxLat: bounds.maxLat + latBuffer,
    minLon: bounds.minLon - lonBuffer,
    maxLon: bounds.maxLon + lonBuffer,
  };
}

/**
 * GET /api/clusters/:sessionId
 * Returns adaptive spatial clusters for a farmer workspace.
 *
 * Strategy (in order of priority):
 *   1. If ?email= provided → query ALL AnalysisSessions for that email (fastest)
 *   2. Try direct match: sessionId OR batchId on AnalysisSession
 *   3. Resolve farmerEmail from ScanSession → query by email
 *   4. Resolve farmerEmail from AnalysisSession → query by email
 */
exports.getSessionClusters = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { email: queryEmail } = req.query;

    if (!sessionId) {
      return res.status(400).json({ error: 'sessionId is required' });
    }

    const AnalysisSession = require('../models/AnalysisSession');
    const ScanSession = require('../models/ScanSession');

    let sessionsToUse = [];

    // ── Strategy 1: Direct email lookup (fastest, used by FarmerWorkspace) ──
    if (queryEmail) {
      const normalizedEmail = String(queryEmail).trim().toLowerCase();
      sessionsToUse = await AnalysisSession.find({ farmerEmail: normalizedEmail }).lean();
      console.log(`[CLUSTER] By email=${normalizedEmail} → ${sessionsToUse.length} sessions`);
    }

    // ── Strategy 2: Direct sessionId / batchId match ──
    if (sessionsToUse.length === 0) {
      sessionsToUse = await AnalysisSession.find({
        $or: [
          { sessionId },
          { batchId: sessionId },
        ]
      }).lean();
      if (sessionsToUse.length > 0) {
        console.log(`[CLUSTER] By sessionId/batchId=${sessionId.slice(0, 8)} → ${sessionsToUse.length} sessions`);
      }
    }

    // ── Strategy 3: Resolve email via ScanSession → query by email ──
    if (sessionsToUse.length === 0) {
      const scan = await ScanSession.findOne({ sessionId });
      if (scan?.farmerEmail) {
        sessionsToUse = await AnalysisSession.find({
          farmerEmail: scan.farmerEmail,
        }).lean();
        console.log(`[CLUSTER] By ScanSession email=${scan.farmerEmail} → ${sessionsToUse.length} sessions`);
      }
    }

    // ── Strategy 4: Resolve email from any AnalysisSession that references this farmer ──
    if (sessionsToUse.length === 0) {
      const single = await AnalysisSession.findOne({ sessionId }).lean();
      if (single?.farmerEmail) {
        sessionsToUse = await AnalysisSession.find({
          farmerEmail: single.farmerEmail,
        }).lean();
        console.log(`[CLUSTER] By AnalysisSession email=${single.farmerEmail} → ${sessionsToUse.length} sessions`);
      }
    }

    // ── Also read ScanSession.results for backward compat ──
    const scanSession = await ScanSession.findOne({ sessionId });
    const scanResults = scanSession?.results || [];

    // ── Merge all sources into a flat detection list ──
    const allDetections = [];
    const SAFE_NAMES = ['healthy field / no anomalies found', 'no disease detected / invalid image'];

    // From AnalysisSession diseases
    for (const s of sessionsToUse) {
      for (const d of (s.diseases || [])) {
        const sev  = (d.severity || '').toLowerCase();
        const name = (d.name || '').toLowerCase();
        if (sev === 'safe' || SAFE_NAMES.some(n => name.includes(n))) continue;
        if (!d.lat || !d.lon) continue;
        allDetections.push({
          lat:      Number(d.lat),
          lon:      Number(d.lon),
          disease:  d.name,
          severity: d.severity,
        });
      }
    }

    // From ScanSession.results (dedup)
    for (const r of scanResults) {
      if (!r.lat || !r.long) continue;
      const isDupe = allDetections.some(d =>
        Math.abs(d.lat - r.lat) < 0.00001 && Math.abs(d.lon - r.long) < 0.00001
      );
      if (!isDupe) allDetections.push({ lat: Number(r.lat), lon: Number(r.long), disease: r.disease, severity: r.severity });
    }

    if (allDetections.length === 0) {
      return res.status(200).json({ sessionId, humidity: null, humidityBufferMeters: 0, clusters: [], totalDetections: 0 });
    }

    // ── Fetch live humidity from Open-Meteo (Pune) ──
    let humidity = 50; // default fallback
    try {
      const weatherRes = await fetch(
        'https://api.open-meteo.com/v1/forecast?latitude=18.5204&longitude=73.8567&current=relative_humidity_2m'
      );
      const weatherJson = await weatherRes.json();
      humidity = Number(weatherJson?.current?.relative_humidity_2m || 50);
    } catch {
      // Use fallback
    }

    // ── Calculate humidity-driven quarantine buffer ──
    const humidityBufferMeters = Math.round(50 + (humidity / 100) * 150);

    // ── Filter to high/severe for clustering, fallback to all ──
    const highSevere = allDetections.filter(d =>
      ['high', 'severe'].includes(String(d.severity || '').toLowerCase())
    );
    const toCluster = highSevere.length > 0 ? highSevere : allDetections;

    // ── Cluster the detections ──
    const rawClusters = clusterPoints(toCluster, 100);

    // ── Build cluster response objects ──
    const clusters = rawClusters.map((cluster, idx) => {
      const infectionBounds = getBoundingBox(cluster);
      const quarantineBounds = expandBounds(infectionBounds, humidityBufferMeters);

      // Dominant disease in cluster
      const diseaseCount = {};
      for (const p of cluster) {
        diseaseCount[p.disease] = (diseaseCount[p.disease] || 0) + 1;
      }
      const dominantDisease = Object.entries(diseaseCount)
        .sort((a, b) => b[1] - a[1])[0]?.[0] || 'Unknown';

      // Worst severity
      const hasSevere = cluster.some((p) =>
        String(p.severity || '').toLowerCase() === 'severe'
      );

      return {
        clusterId: `cluster-${idx}`,
        plantCount: cluster.length,
        dominantDisease,
        worstSeverity: hasSevere ? 'Severe' : 'High',
        infectionZone: {
          minLat: Number(infectionBounds.minLat.toFixed(7)),
          maxLat: Number(infectionBounds.maxLat.toFixed(7)),
          minLon: Number(infectionBounds.minLon.toFixed(7)),
          maxLon: Number(infectionBounds.maxLon.toFixed(7)),
        },
        quarantinePerimeter: {
          minLat: Number(quarantineBounds.minLat.toFixed(7)),
          maxLat: Number(quarantineBounds.maxLat.toFixed(7)),
          minLon: Number(quarantineBounds.minLon.toFixed(7)),
          maxLon: Number(quarantineBounds.maxLon.toFixed(7)),
        },
        points: cluster.map((p) => ({
          lat: p.lat,
          lon: p.lon,
          disease: p.disease,
          severity: p.severity,
        })),
      };
    });

    return res.status(200).json({
      sessionId,
      humidity,
      humidityBufferMeters,
      totalDetections: allDetections.length,
      clusters,
    });
  } catch (error) {
    console.error('[CLUSTER] error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
