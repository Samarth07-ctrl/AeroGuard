/**
 * Dynamic Spatial Clustering Engine (USP)
 * 
 * Replaces the old 5km-radius heatmap circles with precision agriculture:
 * 1. Fetches all high/severe detections for a sessionId
 * 2. Clusters nearby coordinates (within ~100m)
 * 3. Calculates tight bounding boxes around infection zones
 * 4. Expands with a humidity-driven quarantine perimeter
 */
const ScanSession = require('../models/ScanSession');

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
 */
exports.getSessionClusters = async (req, res) => {
  try {
    const { sessionId } = req.params;
    if (!sessionId) {
      return res.status(400).json({ error: 'sessionId is required' });
    }

    // 1. Fetch session results
    const session = await ScanSession.findOne({ sessionId });
    const results = session?.results || [];

    // Also merge in-memory alerts if available
    // (provided via req.app for live C++ engine data)
    let liveAlerts = [];
    try {
      const alertsRes = await fetch(`http://localhost:${process.env.PORT || 5000}/api/alerts?sessionId=${sessionId}`);
      liveAlerts = await alertsRes.json();
    } catch {
      // In-memory alerts endpoint not reachable, skip
    }

    // Combine both sources, normalize to {lat, lon, disease, severity}
    const allDetections = [];

    for (const r of results) {
      allDetections.push({
        lat: r.lat,
        lon: r.long || r.lon,
        disease: r.disease,
        severity: r.severity,
      });
    }

    for (const a of (Array.isArray(liveAlerts) ? liveAlerts : [])) {
      // Avoid duplicates by approximate coordinates
      const isDupe = allDetections.some(
        (d) => Math.abs(d.lat - a.lat) < 0.00001 && Math.abs(d.lon - (a.long || a.lon)) < 0.00001
      );
      if (!isDupe) {
        allDetections.push({
          lat: a.lat,
          lon: a.long || a.lon,
          disease: a.disease,
          severity: a.severity,
        });
      }
    }

    // 2. Filter to high/severe only for clustering
    const highSevere = allDetections.filter((d) =>
      ['high', 'severe'].includes(String(d.severity || '').toLowerCase())
    );

    // If no high/severe, cluster everything
    const toCluster = highSevere.length > 0 ? highSevere : allDetections;

    if (toCluster.length === 0) {
      return res.status(200).json({
        sessionId,
        humidity: null,
        humidityBufferMeters: 0,
        clusters: [],
        totalDetections: 0,
      });
    }

    // 3. Fetch live humidity from Open-Meteo (Pune)
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

    // 4. Calculate humidity-driven quarantine buffer
    // Higher humidity = faster disease spread = wider perimeter
    // Base: 50m, scales up to 200m at 100% humidity
    const humidityBufferMeters = Math.round(50 + (humidity / 100) * 150);

    // 5. Cluster the detections
    const rawClusters = clusterPoints(toCluster, 100);

    // 6. Build cluster response objects
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
