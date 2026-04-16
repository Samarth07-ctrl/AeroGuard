import React, { useState, useEffect, useRef, useCallback } from 'react';
import { AnimatePresence } from 'framer-motion';
import axios from 'axios';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  UploadCloud, Loader2, HardDrive, FileArchive, Zap,
  Activity, ShieldCheck, Radio, CheckCircle2, Target, AlertTriangle
} from 'lucide-react';

const API = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';

// Custom Leaflet icon factory
const createIcon = (color) => L.divIcon({
  className: '',
  iconSize: [28, 28],
  iconAnchor: [14, 14],
  popupAnchor: [0, -16],
  html: `<div style="position:relative;width:28px;height:28px;display:flex;align-items:center;justify-content:center;"><div style="position:absolute;inset:0;border-radius:50%;background:${color};opacity:0.25;animation:ping 2s cubic-bezier(0,0,0.2,1) infinite;"></div><div style="width:14px;height:14px;border-radius:50%;background:${color};border:2px solid white;box-shadow:0 0 12px ${color}80;"></div></div><style>@keyframes ping{75%,100%{transform:scale(2);opacity:0}}</style>`
});

// Helper to recenter map
function MapRecenter({ center, zoom }) {
  const map = useMap();
  useEffect(() => {
    if (center) map.flyTo(center, zoom || 16, { duration: 1.5 });
  }, [center, zoom, map]);
  return null;
}

// ── Severity color config ──
const SEV = {
  Severe: { color: '#e11d48', label: 'CRITICAL' },
  High:   { color: '#ef4444', label: 'HIGH' },
  Medium: { color: '#f97316', label: 'MEDIUM' },
  Low:    { color: '#eab308', label: 'LOW' },
};

export default function Dashboard({ session, setSession }) {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [dragActive, setDragActive] = useState(false);
  const [, setSelectedPin] = useState(null);
  const fileRef = useRef(null);

  const results = session.results || [];
  const hasResults = session.status === 'completed' && results.length > 0;

  // Keep active session ID available for other views (e.g. DroneDashboard)
  useEffect(() => {
    if (session.sessionId) {
      localStorage.setItem('activeSessionId', session.sessionId);
    }
  }, [session.sessionId]);

  // ── Map center ──
  const defaultCenter = results.length > 0
    ? [results[0].lat, results[0].long]
    : [18.5204, 73.8567];

  const [mapCenter, setMapCenter] = useState(null);
  const [mapZoom, setMapZoom] = useState(16);

  // ── Poll for processing completion ──
  useEffect(() => {
    let interval, progressInterval;
    if (session.status === 'processing') {
      let prog = 0;
      progressInterval = setInterval(() => {
        prog += Math.random() * 10;
        if (prog > 95) prog = 95;
        setUploadProgress(Math.min(prog, 95));
      }, 500);

      interval = setInterval(async () => {
        try {
          const res = await axios.get(`${API}/session/${session.sessionId}`);
          if (res.data.status === 'completed') {
            setUploadProgress(100);
            clearInterval(progressInterval);
            setTimeout(() => {
              setSession(prev => ({ ...prev, status: 'completed', results: res.data.results }));
              // Re-center map on first result
              if (res.data.results?.[0]) {
                setMapCenter([res.data.results[0].lat, res.data.results[0].long]);
                setMapZoom(17);
              }
            }, 600);
            clearInterval(interval);
          }
        } catch (err) {
          console.error('Poll error:', err);
        }
      }, 2000);

      return () => { clearInterval(interval); clearInterval(progressInterval); };
    }
  }, [session.status, session.sessionId, setSession]);

  // ── Drag & Drop ──
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

  // ── Upload ──
  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    setUploadProgress(0);
    const formData = new FormData();
    formData.append('drone_data', file);
    formData.append('sessionId', session.sessionId);
    try {
      await axios.post(`${API}/upload`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setSession(prev => ({ ...prev, status: 'processing' }));
    } catch (err) {
      alert('Upload failed: ' + (err.response?.data?.error || err.message));
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-screen">

      {/* ══════ Top Nav ══════ */}
      <header className="card-glass border-t-0 border-x-0 px-5 py-3 flex items-center justify-between shrink-0 relative noise z-20">
        <div className="flex items-center gap-2.5">
          <ShieldCheck className="w-5 h-5 text-cyan-400" />
          <div>
            <h1 className="text-sm font-extrabold tracking-tight leading-none uppercase">
              AEROGUARD <span className="text-cyan-400 font-semibold">AI</span>
            </h1>
            <p className="text-[9px] uppercase tracking-[0.2em] text-zinc-600 font-medium mt-0.5">Mission Control</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="text-[10px] font-mono text-zinc-500 bg-white/[0.02] py-1 px-2.5 rounded-md border border-white/[0.06] flex items-center gap-1.5">
            <Radio className="w-3 h-3 text-cyan-400" />
            {session.sessionId?.slice(0, 10)}…
          </div>
          <div className="flex items-center gap-1.5 text-[10px] font-semibold text-cyan-400 bg-cyan-500/[0.06] py-1 px-2.5 rounded-md border border-cyan-500/10">
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-cyan-400" />
            </span>
            UPLINK ACTIVE
          </div>
        </div>
      </header>

      {/* ══════ Two-Column Layout ══════ */}
      <div className="flex-1 flex min-h-0">

        {/* ── LEFT: Upload Panel ── */}
        <div className="w-[380px] shrink-0 border-r border-white/[0.04] flex flex-col bg-zinc-950/50 backdrop-blur-sm overflow-y-auto">
          <div className="p-5 flex flex-col flex-1">

            {/* Section Title */}
            <div className="mb-5">
              <h2 className="text-base font-bold tracking-tight flex items-center gap-2">
                <HardDrive className="w-4 h-4 text-cyan-400" />
                Mission Data
              </h2>
              <p className="text-zinc-600 text-[11px] mt-1">Upload drone imagery or ZIP archives</p>
            </div>

            {/* Processing overlay */}
            {session.status === 'processing' ? (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="flex-1 flex flex-col items-center justify-center text-center">
                <div className="relative w-16 h-16 mb-6">
                  <div className="absolute inset-0 border-2 border-cyan-500/20 rounded-full animate-ping" />
                  <div className="absolute inset-3 border border-cyan-500/10 rounded-full animate-pulse" />
                  <div className="relative w-full h-full flex items-center justify-center">
                    <Zap className="w-8 h-8 text-cyan-400" />
                  </div>
                </div>
                <h3 className="text-sm font-bold tracking-tight mb-1">C++ Engine Active</h3>
                <p className="text-zinc-600 text-[11px] mb-5">Analyzing spatial data…</p>
                <div className="w-full bg-zinc-800/60 rounded-full h-1.5 overflow-hidden mb-2">
                  <motion.div className="h-full bg-gradient-to-r from-cyan-600 to-cyan-400 rounded-full relative"
                    initial={{ width: '0%' }} animate={{ width: `${uploadProgress}%` }}
                    transition={{ duration: 0.4, ease: 'easeOut' }}>
                    <div className="absolute inset-0 shimmer-bar rounded-full" />
                  </motion.div>
                </div>
                <p className="text-[10px] text-zinc-700 font-mono">{Math.round(uploadProgress)}% COMPLETE</p>
              </motion.div>
            ) : session.status === 'completed' ? (
              /* Results summary */
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex-1 flex flex-col">
                <div className="flex items-center gap-2 mb-4 p-3 bg-cyan-500/[0.04] border border-cyan-500/[0.08] rounded-xl">
                  <CheckCircle2 className="w-4 h-4 text-cyan-400 shrink-0" />
                  <span className="text-xs text-cyan-300 font-medium">Analysis complete — {results.length} hotspots detected</span>
                </div>

                <div className="space-y-2 flex-1">
                  {results.map((r, i) => {
                    const sev = SEV[r.severity] || SEV.High;
                    return (
                      <motion.div key={i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.1 }}
                        onClick={() => {
                          setSelectedPin(r);
                          setMapCenter([r.lat, r.long]);
                          setMapZoom(17);
                        }}
                        className="p-3 bg-white/[0.02] border border-white/[0.05] rounded-xl cursor-pointer hover:bg-white/[0.04] hover:border-white/[0.08] transition-all group">
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="flex items-center gap-2">
                            <div className="w-2.5 h-2.5 rounded-full" style={{ background: sev.color, boxShadow: `0 0 8px ${sev.color}60` }} />
                            <span className="text-xs font-bold text-zinc-200">{r.disease}</span>
                          </div>
                          <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border bg-white/[0.02]"
                            style={{ color: sev.color, borderColor: sev.color + '30' }}>{sev.label}</span>
                        </div>
                        <p className="text-[10px] text-zinc-600 font-mono">📍 {r.lat.toFixed(5)}, {r.long.toFixed(5)}</p>
                      </motion.div>
                    );
                  })}
                </div>
              </motion.div>
            ) : (
              /* Upload dropzone */
              <>
                <div
                  onDragEnter={handleDrag} onDragLeave={handleDrag} onDragOver={handleDrag} onDrop={handleDrop}
                  onClick={() => fileRef.current?.click()}
                  className={`flex-1 min-h-[200px] rounded-xl border-2 border-dashed flex flex-col items-center justify-center text-center cursor-pointer transition-all duration-300
                    ${dragActive ? 'border-cyan-500/50 bg-cyan-500/[0.04] scale-[1.01]'
                      : file ? 'border-cyan-500/20 bg-cyan-500/[0.02]'
                      : 'border-zinc-700/60 bg-white/[0.01] hover:border-zinc-600 hover:bg-white/[0.015]'}`}
                >
                  <input ref={fileRef} type="file" className="hidden" accept=".zip,.jpg,.jpeg,.png,.tiff,.tif"
                    onChange={(e) => e.target.files?.[0] && setFile(e.target.files[0])} />

                  <AnimatePresence mode="wait">
                    {file ? (
                      <motion.div key="f" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0 }} className="flex flex-col items-center px-4">
                        <div className="w-11 h-11 rounded-xl bg-cyan-500/[0.08] border border-cyan-500/[0.15] flex items-center justify-center mb-3">
                          <FileArchive className="w-5 h-5 text-cyan-400" />
                        </div>
                        <p className="text-sm font-semibold text-zinc-200 truncate max-w-[200px]">{file.name}</p>
                        <p className="text-[11px] text-zinc-500 font-mono mt-0.5">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                      </motion.div>
                    ) : (
                      <motion.div key="e" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="flex flex-col items-center px-4">
                        <div className={`w-11 h-11 rounded-xl border flex items-center justify-center mb-3 transition-all
                          ${dragActive ? 'bg-cyan-500/[0.08] border-cyan-500/[0.2]' : 'bg-white/[0.02] border-white/[0.06]'}`}>
                          <UploadCloud className={`w-5 h-5 transition-colors ${dragActive ? 'text-cyan-400' : 'text-zinc-600'}`} />
                        </div>
                        <p className="text-sm font-medium text-zinc-300">Drag scan data here</p>
                        <p className="text-[11px] text-zinc-600 mt-1">ZIP, JPG, TIFF</p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                <motion.button onClick={handleUpload} disabled={!file || uploading}
                  whileHover={file ? { scale: 1.01 } : {}} whileTap={file ? { scale: 0.99 } : {}}
                  className="mt-4 w-full bg-cyan-500 hover:bg-cyan-400 disabled:bg-zinc-800 disabled:text-zinc-600 text-zinc-950 font-bold py-3 rounded-xl transition-colors flex items-center justify-center gap-2 disabled:cursor-not-allowed text-sm">
                  {uploading
                    ? <><Loader2 className="w-4 h-4 animate-spin" /> TRANSMITTING…</>
                    : <><Activity className="w-4 h-4" /> COMMENCE AI PROCESSING</>}
                </motion.button>
              </>
            )}
          </div>

          {/* Footer badge */}
          <div className="px-5 py-3 border-t border-white/[0.03] flex items-center justify-center gap-2 shrink-0">
            <CheckCircle2 className="w-3 h-3 text-zinc-700" />
            <span className="text-[10px] text-zinc-700 font-mono tracking-wider">SESSION AUTHENTICATED</span>
          </div>
        </div>

        {/* ── RIGHT: Leaflet Satellite Map ── */}
        <div className="flex-1 relative">

          {/* Hotspot badges floating on top of map */}
          {hasResults && (
            <div className="absolute top-4 left-4 z-[1000] flex items-center gap-2">
              <div className="card-glass px-3 py-2 rounded-lg flex items-center gap-2 noise">
                <Target className="w-4 h-4 text-cyan-400" />
                <span className="text-xs font-bold tracking-tight">Detection Heatmap</span>
              </div>
              <div className="flex items-center gap-1.5 text-[10px] font-semibold text-rose-400 bg-rose-500/[0.06] py-1.5 px-2.5 rounded-lg border border-rose-500/[0.15] backdrop-blur-md">
                <Activity className="w-3 h-3" />
                {results.length} HOTSPOTS
              </div>
            </div>
          )}

          <MapContainer
            center={defaultCenter}
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
            {mapCenter && <MapRecenter center={mapCenter} zoom={mapZoom} />}

            {/* ── Pulsating Disease Markers ── */}
            {results.map((point, i) => {
              const sev = SEV[point.severity] || SEV.High;
              return (
                <Marker key={i} position={[point.lat, point.long]}
                  icon={createIcon(sev.color)}
                  eventHandlers={{ click: () => setSelectedPin(point) }}>
                  <Popup>
                    <div style={{ background: '#0a0a0a', borderRadius: '12px', padding: '14px', minWidth: '200px', border: '1px solid rgba(255,255,255,0.08)', fontFamily: "'Inter', sans-serif" }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px', paddingBottom: '8px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                        <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: sev.color, boxShadow: `0 0 8px ${sev.color}80` }}></div>
                        <span style={{ fontWeight: 700, fontSize: '13px', color: '#e4e4e7' }}>{point.disease}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                        <span style={{ fontSize: '10px', color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Severity</span>
                        <span style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', color: sev.color }}>{sev.label}</span>
                      </div>
                      <div style={{ fontSize: '9px', fontFamily: 'monospace', color: '#71717a', background: 'rgba(255,255,255,0.02)', padding: '6px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.04)' }}>
                        📍 {point.lat.toFixed(5)}, {point.long.toFixed(5)}
                      </div>
                    </div>
                  </Popup>
                </Marker>
              );
            })}
          </MapContainer>
        </div>
      </div>
    </div>
  );
}
