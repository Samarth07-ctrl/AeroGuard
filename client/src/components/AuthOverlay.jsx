import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import {
  Mail, ShieldCheck, Loader2, Lock,
  Fingerprint, Wifi, ArrowRight
} from 'lucide-react';

const API = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';

export default function AuthOverlay({ onVerified }) {
  const [step, setStep] = useState(1);
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState(['', '', '', '']);
  const [sessionId, setSessionId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [emailValid, setEmailValid] = useState(null);
  const otpRefs = [useRef(), useRef(), useRef(), useRef()];

  useEffect(() => {
    if (email === '') { setEmailValid(null); return; }
    setEmailValid(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email));
  }, [email]);

  // ── Request OTP ──
  const handleRequestSession = async (e) => {
    e.preventDefault();
    if (!email || !emailValid) return;
    setLoading(true);
    setError('');
    try {
      const res = await axios.post(`${API}/auth/request-otp`, { email });
      setSessionId(res.data.sessionId);
      setStep(2);
      setTimeout(() => otpRefs[0].current?.focus(), 300);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to initialize session');
    } finally {
      setLoading(false);
    }
  };

  // ── OTP input handlers ──
  const handleOtpChange = (i, val) => {
    if (!/^\d?$/.test(val)) return;
    const next = [...otp];
    next[i] = val;
    setOtp(next);
    if (val && i < 3) otpRefs[i + 1].current?.focus();
  };

  const handleOtpKeyDown = (i, e) => {
    if (e.key === 'Backspace' && !otp[i] && i > 0) otpRefs[i - 1].current?.focus();
  };

  const handleOtpPaste = (e) => {
    const paste = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 4);
    if (paste.length === 4) {
      setOtp(paste.split(''));
      otpRefs[3].current?.focus();
    }
  };

  // ── Verify OTP ──
  const handleVerifyUplink = async (e) => {
    e.preventDefault();
    const code = otp.join('');
    if (code.length < 4) return;
    setLoading(true);
    setError('');
    try {
      await axios.post(`${API}/auth/verify-otp`, { sessionId, otpCode: code });
      onVerified({ sessionId, isVerified: true, status: 'pending', email });
    } catch (err) {
      setError(err.response?.data?.error || 'Invalid OTP');
      setOtp(['', '', '', '']);
      otpRefs[0].current?.focus();
    } finally {
      setLoading(false);
    }
  };

  // ── Animation variants ──
  const cardV = {
    hidden: { opacity: 0, y: 30, scale: 0.96 },
    visible: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.55, ease: [0.16, 1, 0.3, 1] } },
  };
  const stepV = {
    enter: { opacity: 0, x: 50 },
    center: { opacity: 1, x: 0, transition: { duration: 0.4, ease: [0.16, 1, 0.3, 1] } },
    exit: { opacity: 0, x: -50, transition: { duration: 0.25 } },
  };

  const borderColor = emailValid === null
    ? 'border-white/[0.08]'
    : emailValid ? 'border-cyan-500/40' : 'border-rose-500/40';

  return (
    <motion.div variants={cardV} initial="hidden" animate="visible" className="w-full max-w-[440px]">
      <div className="card-glass rounded-2xl overflow-hidden shadow-2xl shadow-black/50 relative noise">

        {/* ── Header bar ── */}
        <div className="px-6 py-4 flex items-center justify-between border-b border-white/[0.04]">
          <div className="flex items-center gap-2.5">
            <ShieldCheck className="w-5 h-5 text-cyan-400" />
            <div>
              <h1 className="text-sm font-extrabold tracking-tight leading-none uppercase">
                AEROGUARD <span className="text-cyan-400 font-semibold">AI</span>
              </h1>
              <p className="text-[9px] uppercase tracking-[0.2em] text-zinc-600 font-medium mt-0.5">
                Command Center v2.0
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            {step === 1 ? (
              <div className="flex items-center gap-1.5 text-[10px] font-semibold text-amber-400/80 bg-amber-500/[0.06] py-1 px-2.5 rounded-md border border-amber-500/10">
                <Wifi className="w-3 h-3" style={{ animation: 'softPulse 2s ease-in-out infinite' }} />
                AWAITING AUTH
              </div>
            ) : (
              <div className="flex items-center gap-1.5 text-[10px] font-semibold text-cyan-400 bg-cyan-500/[0.06] py-1 px-2.5 rounded-md border border-cyan-500/10">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-cyan-400" />
                </span>
                VERIFYING
              </div>
            )}
          </div>
        </div>

        {/* ── Body ── */}
        <div className="px-6 pt-6 pb-2">

          {/* Icon + Title */}
          <div className="text-center mb-6">
            <motion.div
              initial={{ scale: 0, rotate: -10 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ delay: 0.15, type: 'spring', stiffness: 180, damping: 14 }}
              className="w-14 h-14 mx-auto mb-4 rounded-xl bg-cyan-500/[0.08] border border-cyan-500/[0.15] flex items-center justify-center"
            >
              {step === 1 ? <Fingerprint className="w-7 h-7 text-cyan-400" /> : <Lock className="w-7 h-7 text-cyan-400" />}
            </motion.div>
            <h2 className="text-lg font-bold tracking-tight">
              {step === 1 ? 'Secure Session Request' : 'Enter Authorization Code'}
            </h2>
            <p className="text-zinc-500 text-xs mt-1">
              {step === 1
                ? 'Link a farmer to begin drone scan mission'
                : <>Code dispatched to <span className="text-cyan-400 font-mono text-[11px]">{email}</span></>}
            </p>
          </div>

          {/* Error */}
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, height: 0, marginBottom: 0 }}
                animate={{ opacity: 1, height: 'auto', marginBottom: 16 }}
                exit={{ opacity: 0, height: 0, marginBottom: 0 }}
              >
                <div className="p-2.5 bg-rose-500/[0.08] border border-rose-500/[0.15] rounded-lg text-rose-400 text-xs flex items-center gap-2">
                  <span className="shrink-0 text-sm">✕</span>{error}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Steps */}
          <AnimatePresence mode="wait">
            {step === 1 ? (
              <motion.form key="s1" variants={stepV} initial="enter" animate="center" exit="exit" onSubmit={handleRequestSession} className="space-y-4">
                <div>
                  <label className="flex items-center justify-between mb-2">
                    <span className="text-[10px] uppercase tracking-[0.15em] text-zinc-500 font-semibold">Farmer Email</span>
                    {emailValid !== null && (
                      <motion.span initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }}
                        className={`text-[10px] font-semibold ${emailValid ? 'text-cyan-400' : 'text-rose-400'}`}>
                        {emailValid ? '✓ VALID' : '✕ INVALID'}
                      </motion.span>
                    )}
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600" />
                    <input
                      type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                      className={`otp-caret w-full bg-white/[0.02] border rounded-xl py-3 pl-10 pr-4 text-zinc-100 placeholder-zinc-700 focus-cyan transition-all text-sm ${borderColor}`}
                      placeholder="Enter registered farmer email" required autoFocus
                    />
                  </div>
                </div>
                <button disabled={loading || !emailValid} type="submit"
                  className="w-full bg-cyan-500 hover:bg-cyan-400 disabled:bg-zinc-800 disabled:text-zinc-600 text-zinc-950 font-bold py-3 rounded-xl transition-all flex items-center justify-center gap-2 group disabled:cursor-not-allowed text-sm">
                  {loading ? <Loader2 className="w-4 h-4 animate-spin text-zinc-400" /> : (
                    <><Lock className="w-3.5 h-3.5" /> REQUEST SESSION <ArrowRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" /></>
                  )}
                </button>
                <button type="button"
                  className="w-full bg-white/[0.02] border border-white/[0.06] hover:bg-white/[0.04] text-zinc-400 font-medium py-2.5 rounded-xl transition-all flex items-center justify-center gap-2 text-xs">
                  <Fingerprint className="w-3.5 h-3.5 text-cyan-400/60" /> BIOMETRIC UPLINK
                </button>
              </motion.form>
            ) : (
              <motion.form key="s2" variants={stepV} initial="enter" animate="center" exit="exit" onSubmit={handleVerifyUplink} className="space-y-5">
                <div>
                  <label className="block text-[10px] uppercase tracking-[0.15em] text-zinc-500 mb-3 font-semibold text-center">4-Digit Secure Code</label>
                  <div className="flex justify-center gap-3" onPaste={handleOtpPaste}>
                    {otp.map((d, i) => (
                      <motion.input key={i} ref={otpRefs[i]} type="text" inputMode="numeric" maxLength={1}
                        value={d} onChange={(e) => handleOtpChange(i, e.target.value)} onKeyDown={(e) => handleOtpKeyDown(i, e)}
                        initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 + i * 0.07 }}
                        className={`otp-caret w-[60px] h-[60px] text-center text-2xl font-bold font-mono bg-white/[0.02] border rounded-xl transition-all focus-cyan ${d ? 'border-cyan-500/40 text-cyan-300 shadow-[0_0_12px_rgba(34,211,238,0.08)]' : 'border-white/[0.08] text-zinc-100'}`}
                      />
                    ))}
                  </div>
                </div>
                <button disabled={loading || otp.join('').length < 4} type="submit"
                  className="w-full bg-cyan-500 hover:bg-cyan-400 disabled:bg-zinc-800 disabled:text-zinc-600 text-zinc-950 font-bold py-3 rounded-xl transition-all flex items-center justify-center gap-2 disabled:cursor-not-allowed text-sm">
                  {loading ? <Loader2 className="w-4 h-4 animate-spin text-zinc-400" /> : <><ShieldCheck className="w-4 h-4" /> VERIFY UPLINK</>}
                </button>
                <button type="button" onClick={() => { setStep(1); setError(''); setOtp(['', '', '', '']); }}
                  className="w-full text-[11px] text-zinc-600 hover:text-zinc-400 transition-colors py-1">← Change email</button>
              </motion.form>
            )}
          </AnimatePresence>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 mt-2 border-t border-white/[0.03] flex items-center justify-center gap-2">
          <ShieldCheck className="w-3 h-3 text-zinc-700" />
          <span className="text-[10px] text-zinc-700 font-mono tracking-wider">ZERO-TRUST PROTOCOL ACTIVE</span>
        </div>
      </div>
    </motion.div>
  );
}
