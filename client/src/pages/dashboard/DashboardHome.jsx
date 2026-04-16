import { useRef, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
  AlertTriangle, ArrowRight, CheckCircle2, Fingerprint,
  Loader2, Lock, Mail, Plus, RefreshCw, Shield, Trash2, Users, Zap
} from 'lucide-react';
import { useFarmers } from '../../context/FarmerContext';

const API = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';

export default function DashboardHome() {
  const navigate = useNavigate();
  const { activeFarmers, addFarmer, removeFarmer } = useFarmers();

  // ── Stepper state ──
  const [step, setStep] = useState(1);
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [sessionId, setSessionId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [recovering, setRecovering] = useState(false);
  const otpRefs = useRef(Array.from({ length: 6 }, () => null));

  // ── Auto-recover sessions from DB if localStorage is empty ──
  useEffect(() => {
    if (activeFarmers.length > 0) return; // already have sessions, skip
    const recover = async () => {
      setRecovering(true);
      try {
        const res = await axios.get(`${API}/workspaces`);
        const workspaces = res.data || [];
        for (const w of workspaces) {
          if (w.sessionId && w.email) {
            addFarmer(w.email, w.sessionId);
          }
        }
      } catch {
        // silent — server may not be reachable yet
      } finally {
        setRecovering(false);
      }
    };
    recover();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Request OTP ──
  const requestOtp = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      const res = await axios.post(`${API}/farmer/request-otp`, { email });
      setSessionId(res.data.sessionId);
      setSuccess('OTP dispatched to farmer email.');
      setStep(2);
      setTimeout(() => otpRefs.current[0]?.focus(), 200);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to request OTP');
    } finally {
      setLoading(false);
    }
  };

  // ── Verify OTP ──
  const verifyOtp = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      const otpCode = otp.join('');
      await axios.post(`${API}/farmer/verify-otp`, { email, otp: otpCode, sessionId });
      addFarmer(email, sessionId);
      setSuccess('Farmer verified! Workspace created.');
      setTimeout(() => {
        setStep(1);
        setEmail('');
        setOtp(['', '', '', '', '', '']);
        setSessionId('');
        setSuccess('');
      }, 2000);
    } catch (err) {
      setError(err.response?.data?.error || 'OTP verification failed');
    } finally {
      setLoading(false);
    }
  };

  const onOtpChange = (i, val) => {
    if (!/^\d?$/.test(val)) return;
    const next = [...otp];
    next[i] = val;
    setOtp(next);
    if (val && i < 5) otpRefs.current[i + 1]?.focus();
  };

  const onOtpKeyDown = (i, e) => {
    if (e.key === 'Backspace' && !otp[i] && i > 0) otpRefs.current[i - 1]?.focus();
  };

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <section className="overflow-hidden rounded-3xl border border-green-100 bg-gradient-to-br from-green-50 via-emerald-50/50 to-white p-6 shadow-sm">
        <div className="flex items-center gap-3 mb-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-green-100">
            <Users size={20} className="text-green-700" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-green-900">Multi-Tenant Command Center</h2>
            <p className="text-sm text-green-700/80">
              Verify farmers, manage workspaces, and run precision agriculture scans.
            </p>
          </div>
        </div>
      </section>

      {/* ── New Farmer Verification Stepper ── */}
      <section className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm transition hover:shadow-md">
        <div className="flex items-center gap-2 mb-4">
          <Plus size={16} className="text-green-600" />
          <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wide">New Farmer Verification</h3>
        </div>

        {/* Step indicators */}
        <div className="grid grid-cols-2 gap-3 mb-5">
          <div className={`rounded-2xl border p-3 transition ${step >= 1 ? 'border-green-300 bg-green-50/60' : 'border-gray-200 bg-gray-50'}`}>
            <div className="flex items-center gap-2">
              <Mail size={14} className={step >= 1 ? 'text-green-600' : 'text-gray-400'} />
              <span className="text-xs font-semibold text-gray-600">Step 1 — Farmer Email</span>
            </div>
          </div>
          <div className={`rounded-2xl border p-3 transition ${step >= 2 ? 'border-green-300 bg-green-50/60' : 'border-gray-200 bg-gray-50'}`}>
            <div className="flex items-center gap-2">
              <Lock size={14} className={step >= 2 ? 'text-green-600' : 'text-gray-400'} />
              <span className="text-xs font-semibold text-gray-600">Step 2 — Verify OTP</span>
            </div>
          </div>
        </div>

        {/* Forms */}
        {step === 1 && (
          <form onSubmit={requestOtp} className="flex items-end gap-3">
            <div className="flex-1">
              <label className="mb-1.5 block text-xs font-medium text-gray-600">Farmer Email</label>
              <div className="relative">
                <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 bg-gray-50/50 px-9 py-2.5 text-sm outline-none transition focus:border-green-400 focus:ring-2 focus:ring-green-100"
                  placeholder="farmer@example.com"
                  required
                  autoFocus
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={loading || !email}
              className="inline-flex items-center gap-2 rounded-xl bg-[#15803d] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-green-800 disabled:opacity-50"
            >
              {loading ? <Loader2 size={14} className="animate-spin" /> : <Fingerprint size={14} />}
              Send OTP
            </button>
          </form>
        )}

        {step === 2 && (
          <form onSubmit={verifyOtp} className="space-y-4">
            <p className="text-sm text-gray-600">
              Enter the 6-digit OTP sent to <span className="font-semibold text-green-700">{email}</span>
            </p>
            <div className="flex gap-2">
              {otp.map((digit, i) => (
                <input
                  key={i}
                  ref={(el) => { otpRefs.current[i] = el; }}
                  value={digit}
                  onChange={(e) => onOtpChange(i, e.target.value)}
                  onKeyDown={(e) => onOtpKeyDown(i, e)}
                  className="h-11 w-11 rounded-xl border border-gray-200 bg-gray-50/50 text-center text-lg font-bold outline-none transition focus:border-green-400 focus:ring-2 focus:ring-green-100"
                  maxLength={1}
                  inputMode="numeric"
                />
              ))}
            </div>
            <div className="flex items-center gap-3">
              <button
                type="submit"
                disabled={loading || otp.join('').length !== 6}
                className="inline-flex items-center gap-2 rounded-xl bg-[#15803d] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-green-800 disabled:opacity-50"
              >
                {loading ? <Loader2 size={14} className="animate-spin" /> : <Shield size={14} />}
                Verify OTP
              </button>
              <button
                type="button"
                onClick={() => { setStep(1); setError(''); setOtp(['', '', '', '', '', '']); }}
                className="text-xs text-gray-500 hover:text-gray-700 transition"
              >
                ← Change email
              </button>
            </div>
          </form>
        )}

        {/* Messages */}
        {error && (
          <div className="mt-3 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            <AlertTriangle size={14} />
            {error}
          </div>
        )}
        {success && (
          <div className="mt-3 flex items-center gap-2 rounded-xl border border-green-200 bg-green-50 p-3 text-sm text-green-700">
            <CheckCircle2 size={14} />
            {success}
          </div>
        )}
      </section>

      {/* ── Active Farmer Workspaces Grid ── */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Zap size={16} className="text-green-600" />
            <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wide">Active Workspaces</h3>
            {recovering && (
              <span className="flex items-center gap-1 text-xs text-gray-400">
                <RefreshCw size={11} className="animate-spin" />
                Restoring from database…
              </span>
            )}
          </div>
          <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-700">
            {activeFarmers.length} session{activeFarmers.length !== 1 ? 's' : ''}
          </span>
        </div>

        {activeFarmers.length === 0 && !recovering ? (
          <div className="rounded-3xl border-2 border-dashed border-gray-200 bg-gray-50/50 p-10 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-gray-100">
              <Users size={20} className="text-gray-400" />
            </div>
            <p className="text-sm font-medium text-gray-500">No active farmer workspaces</p>
            <p className="text-xs text-gray-400 mt-1">Verify a farmer above to create their workspace.</p>
          </div>
        ) : activeFarmers.length === 0 && recovering ? (
          <div className="rounded-3xl border border-gray-100 bg-gray-50/50 p-10 text-center">
            <RefreshCw size={24} className="mx-auto mb-2 animate-spin text-green-500 opacity-60" />
            <p className="text-sm text-gray-400">Loading workspaces from database…</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {activeFarmers.map((farmer) => (
              <div
                key={farmer.sessionId}
                className="group rounded-3xl border border-gray-100 bg-white p-5 shadow-sm transition hover:shadow-lg hover:border-green-200"
              >
                {/* Farmer Identity */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-green-50 text-green-600 font-bold text-sm uppercase border border-green-100">
                      {farmer.email.charAt(0)}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-900 truncate max-w-[160px]">
                        {farmer.email}
                      </p>
                      <p className="text-[10px] font-mono text-gray-400 truncate max-w-[160px]">
                        {farmer.sessionId.slice(0, 12)}…
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="relative flex h-2 w-2">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
                      <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500" />
                    </span>
                  </div>
                </div>

                {/* Meta */}
                <div className="mb-4 rounded-xl bg-gray-50 px-3 py-2">
                  <p className="text-[10px] uppercase tracking-wider text-gray-500 font-medium">Verified at</p>
                  <p className="text-xs text-gray-700 font-medium">
                    {new Date(farmer.verifiedAt).toLocaleString()}
                  </p>
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      localStorage.setItem('activeSessionId', farmer.sessionId);
                      navigate(`/dashboard/workspace/${farmer.sessionId}`);
                    }}
                    className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-[#15803d] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-green-800"
                  >
                    Open Workspace
                    <ArrowRight size={14} />
                  </button>
                  <button
                    onClick={() => removeFarmer(farmer.sessionId)}
                    className="inline-flex items-center justify-center rounded-xl border border-red-200 bg-white px-3 py-2.5 text-red-500 transition hover:bg-red-50 hover:border-red-300"
                    title="Remove farmer"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
