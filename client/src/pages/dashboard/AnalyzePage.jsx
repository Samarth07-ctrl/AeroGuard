import { useMemo, useRef, useState } from 'react';
import axios from 'axios';
import { Loader2, Radar, Search, ShieldCheck, UploadCloud } from 'lucide-react';

const API = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';

export default function AnalyzePage() {
  const [step, setStep] = useState(1);
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [sessionId, setSessionId] = useState('');
  const [farmerId, setFarmerId] = useState('');
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const otpRefs = useRef(Array.from({ length: 6 }, () => null));

  const canUpload = useMemo(() => Boolean(file && sessionId), [file, sessionId]);

  const requestOtp = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setMessage('');
    try {
      const res = await axios.post(`${API}/farmer/request-otp`, { email });
      setSessionId(res.data.sessionId);
      setFarmerId(res.data.farmer?.farmerId || '');
      setMessage('OTP sent to farmer email. Please enter the code to continue.');
      setStep(2);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to request OTP');
    } finally {
      setLoading(false);
    }
  };

  const verifyOtp = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setMessage('');
    try {
      const otpCode = otp.join('');
      const res = await axios.post(`${API}/farmer/verify-otp`, {
        email,
        otp: otpCode,
        sessionId
      });
      setFarmerId(res.data.farmer?.farmerId || farmerId);
      setMessage('Farmer verified. Upload image to trigger AI analysis.');
      setStep(3);
    } catch (err) {
      setError(err.response?.data?.error || 'OTP verification failed');
    } finally {
      setLoading(false);
    }
  };

  const onOtpChange = (index, value) => {
    if (!/^\d?$/.test(value)) return;
    const next = [...otp];
    next[index] = value;
    setOtp(next);
    if (value && index < otpRefs.current.length - 1) {
      otpRefs.current[index + 1]?.focus();
    }
  };

  const onOtpKeyDown = (index, event) => {
    if (event.key === 'Backspace' && !otp[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  };

  const upload = async () => {
    if (!canUpload) return;
    setLoading(true);
    setError('');
    setMessage('');
    try {
      const form = new FormData();
      form.append('drone_data', file);
      form.append('sessionId', sessionId);
      if (farmerId) form.append('farmerId', farmerId);
      await axios.post(`${API}/upload`, form, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setMessage('Upload successful. C++ engine trigger started.');
    } catch (err) {
      setError(err.response?.data?.error || 'Upload failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Analyze for Farmer</h1>
        <p className="mt-1 text-sm text-gray-600">
          Verify farmer via OTP, then upload one image to run C++ YOLO analysis.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className={`rounded-3xl border p-4 shadow-sm transition hover:shadow-md ${step >= 1 ? 'border-green-300 bg-green-50/60' : 'border-gray-200 bg-white'}`}>
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Step 1</p>
          <p className="mt-1 font-semibold text-gray-900">Identify Farmer</p>
        </div>
        <div className={`rounded-3xl border p-4 shadow-sm transition hover:shadow-md ${step >= 2 ? 'border-green-300 bg-green-50/60' : 'border-gray-200 bg-white'}`}>
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Step 2</p>
          <p className="mt-1 font-semibold text-gray-900">Verify OTP</p>
        </div>
        <div className={`rounded-3xl border p-4 shadow-sm transition hover:shadow-md ${step >= 3 ? 'border-green-300 bg-green-50/60' : 'border-gray-200 bg-white'}`}>
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Step 3</p>
          <p className="mt-1 font-semibold text-gray-900">Drone Dock Analyze</p>
        </div>
      </div>

      {step === 1 && (
        <form onSubmit={requestOtp} className="max-w-xl space-y-4 rounded-3xl border border-gray-200 bg-white p-5 shadow-sm transition hover:shadow-md">
          <label className="text-sm font-medium text-gray-700">Farmer Email ID</label>
          <div className="relative">
            <Search size={16} className={`absolute left-3 top-1/2 -translate-y-1/2 ${loading ? 'animate-pulse text-[#15803d]' : 'text-gray-400'}`} />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-2xl border border-gray-200 px-10 py-3 outline-none focus:ring-2 focus:ring-green-500"
              placeholder="farmer@example.com"
              required
            />
          </div>
          <button disabled={loading} className="inline-flex items-center gap-2 rounded-2xl bg-[#15803d] px-5 py-2.5 font-semibold text-white hover:bg-green-800">
            {loading ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
            {loading ? 'Searching Farmer...' : 'Search & Send OTP'}
          </button>
        </form>
      )}

      {step === 2 && (
        <form onSubmit={verifyOtp} className="max-w-xl space-y-4 rounded-3xl border border-gray-200 bg-white p-5 shadow-sm transition hover:shadow-md">
          <p className="text-sm text-gray-600">Enter the OTP sent to <span className="font-semibold">{email}</span>.</p>
          <div className="flex gap-2">
            {otp.map((digit, index) => (
              <input
                key={index}
                ref={(el) => { otpRefs.current[index] = el; }}
                value={digit}
                onChange={(e) => onOtpChange(index, e.target.value)}
                onKeyDown={(e) => onOtpKeyDown(index, e)}
                className="h-12 w-12 rounded-2xl border border-gray-200 text-center text-lg font-bold outline-none focus:ring-2 focus:ring-green-500"
                maxLength={1}
                inputMode="numeric"
                required
              />
            ))}
          </div>
          <button disabled={loading || otp.join('').length !== 6} className="inline-flex items-center gap-2 rounded-2xl bg-[#15803d] px-5 py-2.5 font-semibold text-white hover:bg-green-800 disabled:opacity-60">
            {loading ? <Loader2 size={16} className="animate-spin" /> : <ShieldCheck size={16} />}
            {loading ? 'Verifying...' : 'Verify OTP'}
          </button>
        </form>
      )}

      {step === 3 && (
        <div className="max-w-xl space-y-4 rounded-3xl border border-gray-200 bg-white p-5 shadow-sm transition hover:shadow-md">
          <p className="text-sm text-gray-600">Session: <span className="font-mono">{sessionId}</span></p>
          {farmerId && <p className="text-sm text-gray-600">Farmer ID: <span className="font-semibold">{farmerId}</span></p>}
          <div className="animate-pulse rounded-3xl border border-dashed border-green-300 bg-[#f0fdf4] p-5">
            <div className="mb-2 flex items-center gap-2 text-[#15803d]">
              <Radar size={18} />
              <p className="font-semibold">Drone Dock</p>
            </div>
            <label className="block cursor-pointer rounded-2xl border border-green-200 bg-white px-4 py-6 text-center text-sm text-gray-600">
              <UploadCloud size={18} className="mx-auto mb-2 text-[#15803d]" />
              Drag & drop image or click to browse
              <input
                type="file"
                accept=".jpg,.jpeg,.png,.tiff,.tif,.zip"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                className="hidden"
              />
            </label>
          </div>
          {file && <p className="text-sm text-gray-600">Selected: <span className="font-semibold">{file.name}</span></p>}
          <button
            onClick={upload}
            disabled={loading || !canUpload}
            className="inline-flex items-center gap-2 rounded-2xl bg-[#15803d] px-5 py-2.5 font-semibold text-white hover:bg-green-800 disabled:opacity-60"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : <UploadCloud size={16} />}
            {loading ? 'Uploading...' : 'Upload & Analyze'}
          </button>
        </div>
      )}

      {message && <div className="rounded-xl border border-green-200 bg-green-50 p-3 text-sm text-green-700">{message}</div>}
      {error && <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
    </div>
  );
}
