import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { ShieldCheck, Radio, Activity, AlertTriangle, Crosshair, Bell } from 'lucide-react';

const API = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';

// ── Severity Config ──
const SEV_CONFIG = {
  Severe:  { color: '#dc2626', bg: '#dc262620', label: 'CRITICAL', glow: '#dc262680' },
  High:    { color: '#f97316', bg: '#f9731620', label: 'HIGH',     glow: '#f9731680' },
  Medium:  { color: '#eab308', bg: '#eab30820', label: 'MEDIUM',   glow: '#eab30880' },
  Low:     { color: '#22c55e', bg: '#22c55e20', label: 'LOW',      glow: '#22c55e80' },
};

// ── Custom Leaflet marker icons ──
const createDiseaseIcon = (severity) => {
  const sev = SEV_CONFIG[severity] || SEV_CONFIG.High;
  return L.divIcon({
    className: '',
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    popupAnchor: [0, -16],
    html: `
      <div style="position:relative;width:28px;height:28px;display:flex;align-items:center;justify-content:center;">
        <div style="position:absolute;inset:0;border-radius:50%;background:${sev.color};opacity:0.25;animation:ping 2s cubic-bezier(0,0,0.2,1) infinite;"></div>
        <div style="width:14px;height:14px;border-radius:50%;background:${sev.color};border:2px solid white;box-shadow:0 0 12px ${sev.glow},0 0 24px ${sev.glow};"></div>
      </div>
      <style>@keyframes ping{75%,100%{transform:scale(2);opacity:0}}</style>
    `
  });
};

// ── Component to recenter map when alerts update ──
function MapRecenter({ center }) {
  const map = useMap();
  useEffect(() => {
    if (center) map.flyTo(center, 17, { duration: 1.5 });
  }, [center, map]);
  return null;
}

export default function DroneDashboard() {
  const [alerts, setAlerts] = useState([]);
  const [selectedAlert, setSelectedAlert] = useState(null);
  const [mapCenter, setMapCenter] = useState(null);
  const [isLive] = useState(true);
  const [activeSessionId, setActiveSessionId] = useState(() => localStorage.getItem('activeSessionId') || '');

  useEffect(() => {
    const refreshSession = () => {
      setActiveSessionId(localStorage.getItem('activeSessionId') || '');
    };
    refreshSession();
    window.addEventListener('storage', refreshSession);
    const interval = setInterval(refreshSession, 1000);
    return () => {
      window.removeEventListener('storage', refreshSession);
      clearInterval(interval);
    };
  }, []);

  // ── Poll GET /api/alerts every 3 seconds (scoped by active session) ──
  useEffect(() => {
    if (!activeSessionId) {
      return;
    }

    const fetchAlerts = async () => {
      try {
        const res = await fetch(`${API}/alerts?sessionId=${encodeURIComponent(activeSessionId)}`);
        const data = await res.json();
        if (Array.isArray(data)) {
          setAlerts((prev) => {
            // Only update center if we got new alerts
            if (data.length > prev.length && data.length > 0) {
              const latest = data[data.length - 1];
              setMapCenter([latest.lat, latest.long]);
            }
            return data;
          });
        }
      } catch (err) {
        console.error('Alert poll error:', err);
      }
    };

    fetchAlerts(); // Initial fetch
    const interval = setInterval(fetchAlerts, 3000);
    return () => clearInterval(interval);
  }, [activeSessionId]);

  // Default center (Pune, India — matches our EXIF injection)
  const defaultCenter = alerts.length > 0 ? [alerts[0].lat, alerts[0].long] : [18.5204, 73.8567];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#0a0a0a', color: '#e4e4e7', fontFamily: "'Inter', sans-serif" }}>

      {/* ══════ Top Nav Bar ══════ */}
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 20px', borderBottom: '1px solid rgba(255,255,255,0.05)', background: 'rgba(10,10,10,0.95)', backdropFilter: 'blur(12px)', zIndex: 1000 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <ShieldCheck size={20} color="#06b6d4" />
          <div>
            <h1 style={{ fontSize: '14px', fontWeight: 800, letterSpacing: '-0.02em', margin: 0 }}>
              AEROGUARD <span style={{ color: '#06b6d4', fontWeight: 600 }}>AI</span>
            </h1>
            <p style={{ fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.2em', color: '#52525b', margin: 0 }}>Drone Intelligence Dashboard</p>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ fontSize: '10px', fontFamily: 'monospace', color: '#71717a', background: 'rgba(255,255,255,0.02)', padding: '4px 10px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Radio size={12} color="#06b6d4" />
            {alerts.length} detections
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '10px', fontWeight: 600, color: isLive ? '#06b6d4' : '#ef4444', background: isLive ? 'rgba(6,182,212,0.06)' : 'rgba(239,68,68,0.06)', padding: '4px 10px', borderRadius: '6px', border: `1px solid ${isLive ? 'rgba(6,182,212,0.15)' : 'rgba(239,68,68,0.15)'}` }}>
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: isLive ? '#06b6d4' : '#ef4444', animation: 'pulse 2s infinite' }}></span>
            {isLive ? 'LIVE' : 'OFFLINE'}
          </div>
        </div>
      </header>

      {/* ══════ Main Content ══════ */}
      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>

        {/* ── LEFT: Alert List Panel ── */}
        <div style={{ width: '340px', borderRight: '1px solid rgba(255,255,255,0.04)', display: 'flex', flexDirection: 'column', background: 'rgba(10,10,10,0.6)', backdropFilter: 'blur(8px)' }}>
          <div style={{ padding: '16px 16px 12px', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
            <h2 style={{ fontSize: '13px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
              <AlertTriangle size={14} color="#f97316" />
              Disease Alerts
            </h2>
            <p style={{ fontSize: '10px', color: '#52525b', margin: '4px 0 0' }}>
              {alerts.length === 0 ? 'Waiting for C++ Engine...' : `${alerts.length} hotspots detected`}
            </p>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: '8px' }}>
            {alerts.length === 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', opacity: 0.4 }}>
                <Crosshair size={32} />
                <p style={{ fontSize: '11px', marginTop: '12px' }}>No detections yet</p>
                <p style={{ fontSize: '9px', color: '#52525b' }}>Run the C++ Engine to begin</p>
              </div>
            )}
            {alerts.map((alert, i) => {
              const sev = SEV_CONFIG[alert.severity] || SEV_CONFIG.High;
              return (
                <div
                  key={i}
                  onClick={() => {
                    setSelectedAlert(alert);
                    setMapCenter([alert.lat, alert.long]);
                  }}
                  style={{
                    padding: '12px',
                    marginBottom: '4px',
                    background: selectedAlert === alert ? 'rgba(6,182,212,0.06)' : 'rgba(255,255,255,0.02)',
                    border: `1px solid ${selectedAlert === alert ? 'rgba(6,182,212,0.15)' : 'rgba(255,255,255,0.04)'}`,
                    borderRadius: '10px',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = selectedAlert === alert ? 'rgba(6,182,212,0.06)' : 'rgba(255,255,255,0.02)'; }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: sev.color, boxShadow: `0 0 8px ${sev.glow}` }}></div>
                      <span style={{ fontSize: '12px', fontWeight: 700 }}>{alert.disease}</span>
                    </div>
                    <span style={{
                      fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em',
                      padding: '2px 8px', borderRadius: '4px', color: sev.color, border: `1px solid ${sev.color}30`,
                      background: sev.bg
                    }}>{sev.label}</span>
                  </div>
                  <div style={{ fontSize: '10px', fontFamily: 'monospace', color: '#52525b' }}>
                    📍 {alert.lat.toFixed(5)}, {alert.long.toFixed(5)}
                  </div>
                  {alert.pesticide && (
                    <div style={{ fontSize: '9px', color: '#06b6d4', marginTop: '4px' }}>
                      💊 {alert.pesticide}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* ── RIGHT: Leaflet Satellite Map ── */}
        <div style={{ flex: 1, position: 'relative' }}>
          {/* Hotspot Badge */}
          {alerts.length > 0 && (
            <div style={{ position: 'absolute', top: '16px', left: '16px', zIndex: 1000, display: 'flex', gap: '8px' }}>
              <div style={{ background: 'rgba(10,10,10,0.85)', backdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.08)', padding: '6px 12px', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Crosshair size={14} color="#06b6d4" />
                <span style={{ fontSize: '11px', fontWeight: 700 }}>Detection Heatmap</span>
              </div>
              <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', padding: '6px 12px', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Activity size={12} color="#ef4444" />
                <span style={{ fontSize: '10px', fontWeight: 600, color: '#f87171' }}>{alerts.length} HOTSPOTS</span>
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
            {mapCenter && <MapRecenter center={mapCenter} />}

            {alerts.map((alert, i) => (
              <Marker
                key={i}
                position={[alert.lat, alert.long]}
                icon={createDiseaseIcon(alert.severity)}
                eventHandlers={{ click: () => setSelectedAlert(alert) }}
              >
                <Popup>
                  <div style={{
                    background: '#0a0a0a', borderRadius: '12px', padding: '14px', minWidth: '220px',
                    border: '1px solid rgba(255,255,255,0.08)', fontFamily: "'Inter', sans-serif"
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px', paddingBottom: '8px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                      <div style={{
                        width: '8px', height: '8px', borderRadius: '50%',
                        background: (SEV_CONFIG[alert.severity] || SEV_CONFIG.High).color,
                        boxShadow: `0 0 8px ${(SEV_CONFIG[alert.severity] || SEV_CONFIG.High).glow}`
                      }}></div>
                      <span style={{ fontWeight: 700, fontSize: '13px', color: '#e4e4e7' }}>{alert.disease}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                      <span style={{ fontSize: '10px', color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Severity</span>
                      <span style={{
                        fontSize: '10px', fontWeight: 700, textTransform: 'uppercase',
                        color: (SEV_CONFIG[alert.severity] || SEV_CONFIG.High).color
                      }}>{(SEV_CONFIG[alert.severity] || SEV_CONFIG.High).label}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <span style={{ fontSize: '10px', color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Treatment</span>
                      <span style={{ fontSize: '10px', color: '#06b6d4' }}>{alert.pesticide || 'N/A'}</span>
                    </div>
                    <div style={{ fontSize: '9px', fontFamily: 'monospace', color: '#52525b', background: 'rgba(255,255,255,0.02)', padding: '6px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.04)', marginBottom: '10px' }}>
                      📍 {alert.lat.toFixed(6)}, {alert.long.toFixed(6)}
                    </div>
                    <button style={{
                      width: '100%', padding: '8px', borderRadius: '8px', border: 'none', cursor: 'pointer',
                      background: 'linear-gradient(135deg, #06b6d4, #0891b2)', color: '#0a0a0a',
                      fontSize: '11px', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                      transition: 'all 0.2s'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.opacity = '0.85'}
                    onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
                    onClick={() => window.alert(`🚨 Alert dispatched for ${alert.disease} at ${alert.lat.toFixed(5)}, ${alert.long.toFixed(5)}`)}
                    >
                      <Bell size={12} /> Dispatch Alert
                    </button>
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        </div>
      </div>
    </div>
  );
}
