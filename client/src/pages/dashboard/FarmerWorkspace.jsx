import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import axios from 'axios';
import {
  MapContainer, TileLayer, Rectangle, Marker, Popup, Tooltip, useMap
} from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  Activity, AlertTriangle, ArrowLeft, Bell, CloudRain,
  Crosshair, Droplets, FileArchive, Loader2, MapPin,
  Shield, Thermometer, UploadCloud, Zap
} from 'lucide-react';
import { useFarmers } from '../../context/FarmerContext';

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
    iconSize: [20, 20],
    iconAnchor: [10, 10],
    html: `<div style="width:12px;height:12px;border-radius:50%;background:${color};border:2px solid white;box-shadow:0 0 8px ${color}60;"></div>`,
  });

function FitBounds({ bounds }) {
  const map = useMap();
  useEffect(() => {
    if (bounds && bounds.length) {
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 18 });
    }
  }, [bounds, map]);
  return null;
}

export default function FarmerWorkspace() {
  const { sessionId } = useParams();
  const { getFarmer } = useFarmers();
  const farmer = getFarmer(sessionId);

  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState('');
  const [dragActive, setDragActive] = useState(false);
  const [activeUploadId, setActiveUploadId] = useState(null); // uploadId from last upload
  const fileRef = useRef(null);

  const [weather, setWeather] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [clusterData, setClusterData] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${PUNE_LAT}&longitude=${PUNE_LON}&current=temperature_2m,relative_humidity_2m,weather_code`
        );
        const json = await res.json();
        setWeather(json.current || null);
      } catch { /* silent */ }
    })();
  }, []);

  useEffect(() => {
    if (!sessionId) return;

    const poll = async () => {
      try {
        // Poll the active uploadId if we just uploaded, otherwise poll by OTP sessionId
        // GET /api/alerts merges DB + live in-memory
        const pollId = activeUploadId || sessionId;
        const res = await fetch(`${API}/alerts?sessionId=${encodeURIComponent(pollId)}`);
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) setAlerts(data);
      } catch { /* silent */ }
    };

    poll();
    const iv = setInterval(poll, 4000);
    return () => clearInterval(iv);
  }, [sessionId, activeUploadId]);

  useEffect(() => {
    if (!sessionId) return;
    const fetchClusters = async () => {
      try {
        const res = await axios.get(`${API}/clusters/${sessionId}`);
        setClusterData(res.data);
      } catch { /* silent */ }
    };
    fetchClusters();
    const iv = setInterval(fetchClusters, 8000);
    return () => clearInterval(iv);
  }, [sessionId]);

  const handleDrag = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(e.type === 'dragenter' || e.type === 'dragover');
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files?.[0]) setFile(e.dataTransfer.files[0]);
  }, []);

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    setUploadMsg('');
    try {
      const form = new FormData();
      form.append('drone_data', file);
      form.append('sessionId', sessionId); // OTP auth sessionId
      const res = await axios.post(`${API}/upload`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      // Server returns a unique uploadId — use it for polling this specific upload
      const uploadId = res.data.sessionId;
      setActiveUploadId(uploadId);
      setUploadMsg('Upload successful — C++ engine triggered.');
      setFile(null);
    } catch (err) {
      setUploadMsg('Upload failed: ' + (err.response?.data?.error || err.message));
    } finally {
      setUploading(false);
    }
  };

  const mapBounds = (() => {
    const clusters = clusterData?.clusters || [];
    if (clusters.length > 0) {
      let minLat = Infinity, maxLat = -Infinity, minLon = Infinity, maxLon = -Infinity;
      for (const c of clusters) {
        const q = c.quarantinePerimeter;
        if (q.minLat < minLat) minLat = q.minLat;
        if (q.maxLat > maxLat) maxLat = q.maxLat;
        if (q.minLon < minLon) minLon = q.minLon;
        if (q.maxLon > maxLon) maxLon = q.maxLon;
      }
      return [[minLat, minLon], [maxLat, maxLon]];
    }
    if (alerts.length > 0) {
      const lats = alerts.map((a) => a.lat);
      const lons = alerts.map((a) => a.long || a.lon);
      return [
        [Math.min(...lats) - 0.001, Math.min(...lons) - 0.001],
        [Math.max(...lats) + 0.001, Math.max(...lons) + 0.001],
      ];
    }
    return null;
  })();

  const humidity = weather?.relative_humidity_2m ?? clusterData?.humidity ?? null;
  const fungalRisk = humidity !== null ? (humidity > 70 ? 'HIGH' : humidity > 50 ? 'MODERATE' : 'LOW') : '--';
  const fungalColor = fungalRisk === 'HIGH' ? 'text-red-600' : fungalRisk === 'MODERATE' ? 'text-amber-600' : 'text-green-600';

  return (
    <div className="space-y-4">

      {/* Top Bar */}
      <div className="flex items-center justify-between">
        <Link
          to="/dashboard"
          className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 hover:border-gray-300"
        >
          <ArrowLeft size={14} />
          Back to Dashboard
        </Link>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500" />
            </span>
            <span className="text-xs font-semibold text-green-600">LIVE</span>
          </div>
          <span className="rounded-lg bg-gray-100 px-3 py-1 text-xs font-mono text-gray-600">
            {sessionId?.slice(0, 12)}…
          </span>
        </div>
      </div>

      {/* Farmer identity banner */}
      {farmer && (
        <div className="rounded-2xl border border-green-100 bg-gradient-to-r from-green-50 to-white px-4 py-3">
          <div className="flex items-center gap-2">
            <Shield size={16} className="text-green-600" />
            <span className="text-sm font-semibold text-green-900">Farmer: {farmer.email}</span>
            <span className="text-xs text-gray-500 ml-auto">
              Verified {new Date(farmer.verifiedAt).toLocaleString()}
            </span>
          </div>
        </div>
      )}

      {/* 2x2 Grid */}
      <div className="grid gap-4 lg:grid-cols-2">

        {/* Widget 1: Drone Dock */}
        <div className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm transition hover:shadow-md">
          <div className="flex items-center gap-2 mb-4">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-green-50">
              <UploadCloud size={16} className="text-green-600" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-gray-900">Drone Dock</h3>
              <p className="text-[10px] text-gray-500">Upload scan imagery</p>
            </div>
          </div>

          <div
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            onClick={() => fileRef.current?.click()}
            className={`rounded-2xl border-2 border-dashed p-8 text-center cursor-pointer transition-all ${
              dragActive
                ? 'border-green-400 bg-green-50/60 scale-[1.01]'
                : file
                ? 'border-green-300 bg-green-50/30'
                : 'border-gray-200 bg-gray-50/50 hover:border-gray-300 hover:bg-gray-50'
            }`}
          >
            <input
              ref={fileRef}
              type="file"
              className="hidden"
              accept=".zip,.jpg,.jpeg,.png,.tiff,.tif"
              onChange={(e) => e.target.files?.[0] && setFile(e.target.files[0])}
            />
            {file ? (
              <div className="flex flex-col items-center">
                <FileArchive size={24} className="text-green-600 mb-2" />
                <p className="text-sm font-semibold text-gray-800 truncate max-w-[200px]">{file.name}</p>
                <p className="text-xs text-gray-500 font-mono">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
              </div>
            ) : (
              <div className="flex flex-col items-center">
                <UploadCloud size={24} className="text-gray-400 mb-2" />
                <p className="text-sm text-gray-600">Drag scan data here</p>
                <p className="text-xs text-gray-400 mt-1">ZIP, JPG, TIFF</p>
              </div>
            )}
          </div>

          <button
            onClick={handleUpload}
            disabled={!file || uploading}
            className="mt-3 w-full rounded-xl bg-[#15803d] py-2.5 text-sm font-semibold text-white transition hover:bg-green-800 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {uploading ? <Loader2 size={14} className="animate-spin" /> : <Zap size={14} />}
            {uploading ? 'Transmitting…' : 'Upload & Analyze'}
          </button>

          {uploadMsg && (
            <p className={`mt-2 text-xs ${uploadMsg.includes('failed') ? 'text-red-600' : 'text-green-600'}`}>
              {uploadMsg}
            </p>
          )}
        </div>

        {/* Widget 2: Weather Intel */}
        <div className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm transition hover:shadow-md">
          <div className="flex items-center gap-2 mb-4">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-50">
              <CloudRain size={16} className="text-blue-600" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-gray-900">Weather Intel — Pune</h3>
              <p className="text-[10px] text-gray-500">Live conditions &amp; fungal risk</p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="rounded-2xl bg-gray-50 p-4 text-center">
              <Thermometer size={16} className="mx-auto mb-1 text-gray-500" />
              <p className="text-xs text-gray-500">Temperature</p>
              <p className="text-xl font-bold text-gray-900">
                {weather ? `${weather.temperature_2m}°` : '--'}
              </p>
            </div>
            <div className="rounded-2xl bg-gray-50 p-4 text-center">
              <Droplets size={16} className="mx-auto mb-1 text-blue-500" />
              <p className="text-xs text-gray-500">Humidity</p>
              <p className="text-xl font-bold text-blue-700">
                {humidity !== null ? `${humidity}%` : '--'}
              </p>
            </div>
            <div className="rounded-2xl bg-gray-50 p-4 text-center">
              <AlertTriangle size={16} className={`mx-auto mb-1 ${fungalColor}`} />
              <p className="text-xs text-gray-500">Fungal Risk</p>
              <p className={`text-xl font-bold ${fungalColor}`}>{fungalRisk}</p>
            </div>
          </div>

          {humidity !== null && humidity > 70 ? (
            <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 font-medium">
              <AlertTriangle size={14} />
              HIGH FUNGAL SPREAD RISK — Humidity above 70%. Quarantine zones expanded.
            </div>
          ) : (
            <div className="flex items-center gap-2 rounded-xl border border-green-200 bg-green-50 p-3 text-xs text-green-800 font-medium">
              <Shield size={14} />
              Conditions favorable — standard quarantine perimeters active.
            </div>
          )}
        </div>

        {/* Widget 3: Live Alert Feed */}
        <div className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm transition hover:shadow-md">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-red-50">
                <Bell size={16} className="text-red-600" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-gray-900">Live Alert Feed</h3>
                <p className="text-[10px] text-gray-500">Session-scoped detections</p>
              </div>
            </div>
            <span className="rounded-full bg-red-50 border border-red-100 px-2.5 py-1 text-xs font-semibold text-red-600">
              {alerts.length} alerts
            </span>
          </div>

          <div className="max-h-[280px] space-y-2 overflow-y-auto pr-1">
            {alerts.length === 0 && (
              <div className="flex flex-col items-center justify-center py-10 opacity-50">
                <Crosshair size={24} />
                <p className="text-xs mt-2 text-gray-500">Waiting for C++ engine detections…</p>
              </div>
            )}
            {alerts.map((alert, i) => {
              const sev = SEV[alert.severity] || SEV.High;
              return (
                <div
                  key={`alert-${i}`}
                  className="rounded-xl border border-gray-100 p-3 transition hover:bg-gray-50"
                >
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <div
                        className="h-2 w-2 rounded-full"
                        style={{ background: sev.color, boxShadow: `0 0 6px ${sev.color}60` }}
                      />
                      <span className="text-xs font-bold text-gray-800">{alert.disease}</span>
                    </div>
                    <span
                      className="text-[9px] font-bold uppercase px-2 py-0.5 rounded border"
                      style={{ color: sev.color, borderColor: sev.color + '30', background: sev.color + '10' }}
                    >
                      {sev.label}
                    </span>
                  </div>
                  <p className="text-[10px] font-mono text-gray-500">
                    📍 {alert.lat?.toFixed(5)}, {(alert.long || alert.lon)?.toFixed(5)}
                  </p>
                  {alert.pesticide && (
                    <p className="text-[10px] text-green-600 mt-0.5">💊 {alert.pesticide}</p>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Widget 4: Tactical Map */}
        <div className="rounded-3xl border border-gray-100 bg-white shadow-sm transition hover:shadow-md overflow-hidden">
          <div className="flex items-center justify-between p-5 pb-3">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-50">
                <MapPin size={16} className="text-emerald-600" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-gray-900">Tactical Map</h3>
                <p className="text-[10px] text-gray-500">Adaptive clustering — precision zones</p>
              </div>
            </div>
            {clusterData && (
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-red-50 border border-red-100 px-2 py-0.5 text-[10px] font-semibold text-red-600">
                  {clusterData.clusters?.length || 0} clusters
                </span>
                <span className="rounded-full bg-amber-50 border border-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-600">
                  {clusterData.totalDetections || 0} detections
                </span>
              </div>
            )}
          </div>

          <div className="h-[340px]">
            <MapContainer
              center={[PUNE_LAT, PUNE_LON]}
              zoom={16}
              style={{ width: '100%', height: '100%' }}
              zoomControl={false}
            >
              <TileLayer
                url="http://{s}.google.com/vt/lyrs=s,h&x={x}&y={y}&z={z}"
                subdomains={['mt0','mt1','mt2','mt3']}
                attribution="&copy; Google Maps"
                maxZoom={20}
              />

              {mapBounds && <FitBounds bounds={mapBounds} />}

              {/* Cluster Zones — infection box + quarantine perimeter */}
              {(clusterData?.clusters || []).map((cluster) => {
                const iz = cluster.infectionZone;
                const qp = cluster.quarantinePerimeter;
                const sev = SEV[cluster.worstSeverity] || SEV.High;
                return (
                  <React.Fragment key={cluster.clusterId}>
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
                          Adaptive Quarantine Zone | {cluster.plantCount} plant{cluster.plantCount !== 1 ? 's' : ''} infected | Perimeter expanded by humidity ({clusterData.humidity}%)
                        </span>
                      </Tooltip>
                    </Rectangle>

                    <Rectangle
                      bounds={[[iz.minLat, iz.minLon], [iz.maxLat, iz.maxLon]]}
                      pathOptions={{
                        color: '#ef4444',
                        fillColor: '#ef4444',
                        fillOpacity: 0.5,
                        weight: 2,
                      }}
                    >
                      <Tooltip sticky>
                        <span style={{ fontSize: '11px', fontWeight: 600 }}>
                          🦠 Infection Zone | {cluster.dominantDisease} | {cluster.worstSeverity}
                        </span>
                      </Tooltip>
                    </Rectangle>

                    {cluster.points.map((pt, pi) => (
                      <Marker
                        key={`${cluster.clusterId}-pt-${pi}`}
                        position={[pt.lat, pt.lon]}
                        icon={createIcon(sev.color)}
                      >
                        <Popup>
                          <div style={{ padding: '8px', fontSize: '12px' }}>
                            <strong>{pt.disease}</strong><br />
                            <span style={{ color: sev.color }}>{sev.label}</span><br />
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

              {/* Fallback raw markers when no clusters yet */}
              {!clusterData?.clusters?.length && alerts.map((alert, i) => {
                const sev = SEV[alert.severity] || SEV.High;
                return (
                  <Marker
                    key={`raw-${i}`}
                    position={[alert.lat, alert.long || alert.lon]}
                    icon={createIcon(sev.color)}
                  >
                    <Popup>
                      <div style={{ padding: '8px', fontSize: '12px' }}>
                        <strong>{alert.disease}</strong><br />
                        <span style={{ color: sev.color }}>{sev.label}</span>
                      </div>
                    </Popup>
                  </Marker>
                );
              })}
            </MapContainer>
          </div>

          {/* Legend */}
          <div className="flex items-center gap-4 px-5 py-3 border-t border-gray-100 bg-gray-50/50">
            <div className="flex items-center gap-1.5">
              <div className="h-3 w-5 rounded-sm bg-red-500/40 border border-red-500" />
              <span className="text-[10px] text-gray-600">Infection Zone</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="h-3 w-5 rounded-sm bg-orange-500/10 border border-orange-400" style={{ borderStyle: 'dashed' }} />
              <span className="text-[10px] text-gray-600">Quarantine Perimeter</span>
            </div>
            <div className="flex items-center gap-1.5 ml-auto">
              <Activity size={10} className="text-gray-400" />
              <span className="text-[10px] text-gray-400">Buffer: {clusterData?.humidityBufferMeters || '--'}m</span>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
