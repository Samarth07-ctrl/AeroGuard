import React, { useCallback, useEffect, useRef, useState } from 'react';
import { MapContainer, Marker, Popup, Rectangle, TileLayer, Tooltip, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Activity, Droplets, MapPin, RefreshCw, Shield } from 'lucide-react';

const API = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';
const PUNE_LAT = 18.5204;
const PUNE_LON = 73.8567;

const SEV = {
  Severe: { color: '#dc2626', label: 'CRITICAL' },
  High:   { color: '#ef4444', label: 'HIGH' },
  Medium: { color: '#f97316', label: 'MEDIUM' },
  Low:    { color: '#22c55e', label: 'LOW' },
};

const createIcon = (color) =>
  L.divIcon({
    className: '',
    iconSize: [18, 18],
    iconAnchor: [9, 9],
    html: `<div style="width:10px;height:10px;border-radius:50%;background:${color};border:2px solid white;box-shadow:0 0 6px ${color}60;margin:4px;"></div>`,
  });

// Auto-fit map to all cluster bounds
function FitAll({ clusters }) {
  const map = useMap();
  useEffect(() => {
    if (!clusters || clusters.length === 0) return;
    let minLat = Infinity, maxLat = -Infinity, minLon = Infinity, maxLon = -Infinity;
    for (const c of clusters) {
      const q = c.quarantinePerimeter;
      if (q.minLat < minLat) minLat = q.minLat;
      if (q.maxLat > maxLat) maxLat = q.maxLat;
      if (q.minLon < minLon) minLon = q.minLon;
      if (q.maxLon > maxLon) maxLon = q.maxLon;
    }
    if (isFinite(minLat)) {
      map.fitBounds([[minLat, minLon], [maxLat, maxLon]], { padding: [40, 40], maxZoom: 17 });
    }
  }, [clusters, map]);
  return null;
}

export default function MapPage() {
  const [clusters, setClusters] = useState([]);
  const [humidity, setHumidity] = useState(null);
  const [humidityBuffer, setHumidityBuffer] = useState(null);
  const [totalDetections, setTotalDetections] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [lastRefresh, setLastRefresh] = useState(Date.now());

  const loadClusters = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const sessionsRes = await fetch(`${API}/analysis-sessions`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('adminToken') || ''}` },
      });
      const sessions = await sessionsRes.json();

      if (!Array.isArray(sessions) || sessions.length === 0) {
        setClusters([]);
        setLoading(false);
        return;
      }

      // Group sessions by farmerEmail to avoid duplicate cluster requests
      const farmerMap = {};
      for (const s of sessions) {
        const diseases = s.diseases || [];
        const hasReal = diseases.some((d) => {
          const sev  = (d.severity || '').toLowerCase();
          const name = (d.name || '').toLowerCase();
          return sev !== 'safe' &&
            !name.includes('healthy field') &&
            !name.includes('no disease') &&
            !name.includes('no anomalies');
        });
        if (!hasReal) continue;

        const email = s.farmerEmail || s.farmerId?.email || '';
        if (!email) continue;
        if (!farmerMap[email]) {
          farmerMap[email] = s.sessionId; // use one sessionId per farmer for the request
        }
      }

      const uniqueFarmers = Object.entries(farmerMap);
      if (uniqueFarmers.length === 0) {
        setClusters([]);
        setLoading(false);
        return;
      }

      const results = await Promise.allSettled(
        uniqueFarmers.map(([email, sid]) =>
          fetch(`${API}/clusters/${sid}?email=${encodeURIComponent(email)}`).then((r) => r.json())
        )
      );

      let allClusters = [];
      let latestHumidity = null;
      let latestBuffer = null;
      let detectionCount = 0;

      for (const result of results) {
        if (result.status === 'fulfilled' && result.value?.clusters) {
          allClusters = allClusters.concat(result.value.clusters);
          detectionCount += result.value.totalDetections || 0;
          if (latestHumidity === null) {
            latestHumidity = result.value.humidity;
            latestBuffer = result.value.humidityBufferMeters;
          }
        }
      }

      setClusters(allClusters);
      setHumidity(latestHumidity);
      setHumidityBuffer(latestBuffer);
      setTotalDetections(detectionCount);
    } catch (err) {
      setError('Failed to load global cluster data');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Load on mount and whenever lastRefresh changes
  useEffect(() => {
    loadClusters();
  }, [loadClusters, lastRefresh]);

  // Auto-refresh every 30s so batch results appear without manual reload
  useEffect(() => {
    const iv = setInterval(() => setLastRefresh(Date.now()), 30000);
    // Also refresh immediately when any batch completes (cross-component event)
    const onBatchComplete = () => setLastRefresh(Date.now());
    window.addEventListener('aeroguard:batch-complete', onBatchComplete);
    return () => {
      clearInterval(iv);
      window.removeEventListener('aeroguard:batch-complete', onBatchComplete);
    };
  }, []);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Global Tactical Map</h1>
        <p className="mt-1 text-sm text-gray-600">
          Precision infection zones and adaptive quarantine perimeters across all farmer sessions.
        </p>
      </div>

      {/* Stats bar */}
      <div className="flex flex-wrap items-center gap-3">
        {humidity !== null && (
          <div className="flex items-center gap-2 rounded-xl border border-blue-100 bg-blue-50 px-3 py-2 text-sm text-blue-800">
            <Droplets size={14} />
            Live humidity: <span className="font-semibold ml-1">{humidity}%</span>
          </div>
        )}
        {humidityBuffer !== null && (
          <div className="flex items-center gap-2 rounded-xl border border-amber-100 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            <Shield size={14} />
            Quarantine buffer: <span className="font-semibold ml-1">{humidityBuffer}m</span>
          </div>
        )}
        <div className="flex items-center gap-2 rounded-xl border border-gray-100 bg-gray-50 px-3 py-2 text-sm text-gray-700">
          <MapPin size={14} />
          <span className="font-semibold">{clusters.length}</span> clusters &nbsp;·&nbsp;
          <span className="font-semibold">{totalDetections}</span> detections
        </div>
        {loading && (
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <Activity size={14} className="animate-pulse" />
            Loading clusters…
          </div>
        )}
        <button
          onClick={() => setLastRefresh(Date.now())}
          disabled={loading}
          className="ml-auto inline-flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition"
        >
          <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>
      )}

      {/* Map */}
      <div className="h-[560px] overflow-hidden rounded-2xl border border-gray-200 shadow-sm">
        <MapContainer
          center={[PUNE_LAT, PUNE_LON]}
          zoom={13}
          style={{ height: '100%', width: '100%' }}
          zoomControl={true}
        >
          <TileLayer
            url="http://{s}.google.com/vt/lyrs=s,h&x={x}&y={y}&z={z}"
            subdomains={['mt0','mt1','mt2','mt3']}
            attribution="&copy; Google Maps"
            maxZoom={20}
          />

          {clusters.length > 0 && <FitAll clusters={clusters} />}

          {clusters.map((cluster, idx) => {
            const iz = cluster.infectionZone;
            const qp = cluster.quarantinePerimeter;
            const sev = SEV[cluster.worstSeverity] || SEV.High;

            return (
              <React.Fragment key={`global-cluster-${idx}`}>
                {/* Quarantine perimeter — outer dashed orange */}
                <Rectangle
                  bounds={[[qp.minLat, qp.minLon], [qp.maxLat, qp.maxLon]]}
                  pathOptions={{
                    color: '#f97316',
                    fillColor: '#f97316',
                    fillOpacity: 0.08,
                    weight: 2,
                    dashArray: '5,10',
                  }}
                >
                  <Tooltip sticky>
                    <span style={{ fontSize: '11px', fontWeight: 600 }}>
                      Adaptive Quarantine Zone | {cluster.plantCount} plant{cluster.plantCount !== 1 ? 's' : ''} infected | Buffer: {humidity}% humidity
                    </span>
                  </Tooltip>
                </Rectangle>

                {/* Infection zone — inner solid red */}
                <Rectangle
                  bounds={[[iz.minLat, iz.minLon], [iz.maxLat, iz.maxLon]]}
                  pathOptions={{
                    color: '#ef4444',
                    fillColor: '#ef4444',
                    fillOpacity: 0.5,
                    weight: 2,
                  }}
                >
                  <Popup>
                    <div style={{ padding: '8px', minWidth: '180px', fontSize: '12px', fontFamily: 'Inter, sans-serif' }}>
                      <div style={{ fontWeight: 700, marginBottom: '6px', color: sev.color }}>
                        🦠 {cluster.dominantDisease}
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                        <span style={{ color: '#71717a' }}>Severity</span>
                        <span style={{ fontWeight: 700, color: sev.color }}>{cluster.worstSeverity}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                        <span style={{ color: '#71717a' }}>Plants infected</span>
                        <span style={{ fontWeight: 600 }}>{cluster.plantCount}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: '#71717a' }}>Humidity</span>
                        <span style={{ fontWeight: 600 }}>{humidity ?? '--'}%</span>
                      </div>
                    </div>
                  </Popup>
                  <Tooltip>
                    <span style={{ fontSize: '11px', fontWeight: 600 }}>
                      🦠 Infection Zone | {cluster.dominantDisease} | {cluster.worstSeverity}
                    </span>
                  </Tooltip>
                </Rectangle>

                {/* Individual detection markers */}
                {cluster.points.map((pt, pi) => (
                  <Marker
                    key={`global-pt-${idx}-${pi}`}
                    position={[pt.lat, pt.lon]}
                    icon={createIcon(sev.color)}
                  >
                    <Popup>
                      <div style={{ padding: '6px', fontSize: '12px' }}>
                        <strong>{pt.disease}</strong><br />
                        <span style={{ color: sev.color }}>{pt.severity}</span><br />
                        <span style={{ fontFamily: 'monospace', fontSize: '10px', color: '#666' }}>
                          {pt.lat.toFixed(6)}, {pt.lon.toFixed(6)}
                        </span>
                      </div>
                    </Popup>
                  </Marker>
                ))}
              </React.Fragment>
            );
          })}

          {/* Empty state overlay */}
          {!loading && clusters.length === 0 && (
            <div style={{
              position: 'absolute', inset: 0, zIndex: 1000,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'rgba(0,0,0,0.4)', pointerEvents: 'none',
            }}>
              <div style={{
                background: 'white', borderRadius: '16px', padding: '24px 32px',
                textAlign: 'center', boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
              }}>
                <MapPin size={28} style={{ margin: '0 auto 8px', color: '#9ca3af' }} />
                <p style={{ fontWeight: 600, color: '#374151', margin: 0 }}>No clusters yet</p>
                <p style={{ fontSize: '12px', color: '#9ca3af', marginTop: '4px' }}>
                  Run a scan from a Farmer Workspace to see precision zones here.
                </p>
              </div>
            </div>
          )}
        </MapContainer>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-6 px-1">
        <div className="flex items-center gap-2">
          <div className="h-3 w-6 rounded-sm bg-red-500/50 border border-red-500" />
          <span className="text-xs text-gray-600">Infection Zone</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-3 w-6 rounded-sm bg-orange-500/10 border border-orange-400" style={{ borderStyle: 'dashed' }} />
          <span className="text-xs text-gray-600">Quarantine Perimeter</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded-full bg-red-500 border-2 border-white shadow" />
          <span className="text-xs text-gray-600">Detection Point</span>
        </div>
      </div>
    </div>
  );
}
