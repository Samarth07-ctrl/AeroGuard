import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import Map, { Marker, NavigationControl, Popup } from 'react-map-gl/mapbox';
import 'mapbox-gl/dist/mapbox-gl.css';
import {
  UploadCloud, Loader2, HardDrive, FileArchive, Zap,
  Activity, ShieldCheck, Radio, CheckCircle2, Target, AlertTriangle
} from 'lucide-react';

const API = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';
const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN || '';

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
  const [selectedPin, setSelectedPin] = useState(null);
  const fileRef = useRef(null);

  const results = session.results || [];
  const hasResults = session.status === 'completed' && results.length > 0;

  // ── Map viewport ──
  const defaultCenter = results.length > 0
    ? { longitude: results[0].long, latitude: results[0].lat }
    : { longitude: -71.0589, latitude: 42.3601 };

  const [viewState, setViewState] = useState({
    ...defaultCenter,
    zoom: 14,
    pitch: 45,
    bearing: -15,
  });

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
                setViewState(v => ({
                  ...v,
                  longitude: res.data.results[0].long,
                  latitude: res.data.results[0].lat,
                  zoom: 15,
                }));
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
                          setViewState(v => ({ ...v, longitude: r.long, latitude: r.lat, zoom: 16 }));
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

        {/* ── RIGHT: Mapbox Satellite ── */}
        <div className="flex-1 relative">

          {/* Hotspot badges floating on top of map */}
          {hasResults && (
            <div className="absolute top-4 left-4 z-10 flex items-center gap-2">
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

          {!MAPBOX_TOKEN ? (
            /* Missing token overlay */
            <div className="absolute inset-0 flex items-center justify-center bg-zinc-950/90 z-20 p-6">
              <div className="card-glass rounded-xl p-8 max-w-sm text-center noise">
                <AlertTriangle className="w-9 h-9 text-amber-400 mx-auto mb-4" />
                <h3 className="font-bold text-base mb-2">Mapbox Token Required</h3>
                <p className="text-zinc-400 text-xs mb-4">
                  Set your token in <code className="text-cyan-400 bg-white/[0.04] px-1.5 py-0.5 rounded text-[11px] font-mono">client/.env</code>
                </p>
                <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-3 text-left font-mono text-[11px] text-zinc-500">
                  VITE_MAPBOX_TOKEN="pk.your_token"
                </div>
              </div>
            </div>
          ) : null}

          <Map
            {...viewState}
            onMove={(evt) => setViewState(evt.viewState)}
            mapboxAccessToken={MAPBOX_TOKEN}
            mapStyle="mapbox://styles/mapbox/satellite-streets-v12"
            style={{ width: '100%', height: '100%' }}
            attributionControl={false}
          >
            <NavigationControl position="top-right" showCompass />

            {/* ── Pulsating Disease Markers ── */}
            {results.map((point, i) => {
              const sev = SEV[point.severity] || SEV.High;
              return (
                <Marker key={i} longitude={point.long} latitude={point.lat} anchor="center"
                  onClick={(e) => { e.originalEvent.stopPropagation(); setSelectedPin(point); }}>
                  <div className="relative flex items-center justify-center cursor-pointer" style={{ width: 40, height: 40 }}>
                    {/* Radar ring */}
                    <div className="absolute inset-0 rounded-full opacity-40 animate-ping"
                      style={{ border: `2px solid ${sev.color}`, animationDuration: '2s', animationDelay: `${i * 0.3}s` }} />
                    {/* Core pulsating dot */}
                    <div className="w-4 h-4 rounded-full animate-pulse border-2 border-white shadow-lg"
                      style={{ background: sev.color, boxShadow: `0 0 14px ${sev.color}80, 0 0 28px ${sev.color}40` }} />
                  </div>
                </Marker>
              );
            })}

            {/* ── Popup on pin click ── */}
            {selectedPin && (
              <Popup longitude={selectedPin.long} latitude={selectedPin.lat} anchor="bottom"
                onClose={() => setSelectedPin(null)} closeButton={false} closeOnClick maxWidth="240px">
                <div className="bg-zinc-950/95 backdrop-blur-xl border border-white/[0.06] rounded-xl p-3.5 min-w-[200px]"
                  style={{ fontFamily: "'Inter', sans-serif" }}>
                  <div className="flex items-center gap-2 mb-2.5 pb-2 border-b border-white/[0.05]">
                    <div className="w-2 h-2 rounded-full"
                      style={{ background: (SEV[selectedPin.severity] || SEV.High).color,
                        boxShadow: `0 0 8px ${(SEV[selectedPin.severity] || SEV.High).color}80` }} />
                    <span className="font-bold text-[13px] text-zinc-100">{selectedPin.disease}</span>
                  </div>
                  <div className="flex justify-between items-center mb-1.5">
                    <span className="text-[10px] text-zinc-500 uppercase tracking-wider">Severity</span>
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border bg-white/[0.02]"
                      style={{ color: (SEV[selectedPin.severity] || SEV.High).color,
                        borderColor: (SEV[selectedPin.severity] || SEV.High).color + '30' }}>
                      {(SEV[selectedPin.severity] || SEV.High).label}
                    </span>
                  </div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-[10px] text-zinc-500 uppercase tracking-wider">Type</span>
                    <span className="text-[10px] text-zinc-400">Crop Disease</span>
                  </div>
                  <div className="text-[9px] text-zinc-600 font-mono bg-white/[0.02] p-1.5 rounded border border-white/[0.03]">
                    📍 {selectedPin.lat.toFixed(5)}, {selectedPin.long.toFixed(5)}
                  </div>
                </div>
              </Popup>
            )}
          </Map>
        </div>
      </div>
    </div>
  );
}
