import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { QRCode } from 'react-qr-code';
import {
  AlertTriangle, ArrowRight, CheckCircle2, Clock,
  Fingerprint, Loader2, Mail, Plus, QrCode,
  RefreshCw, Smartphone, Trash2, Users, X, Zap,
} from 'lucide-react';
import { useFarmers } from '../../context/FarmerContext';

const API = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';

// ── QR Code Modal ──────────────────────────────────────────────────────────
function QrModal({ farmer, onClose }) {
  // Resolve the value once — never pass undefined to QRCode
  const qrValue = farmer?.qrToken || farmer?.sessionId || null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-sm rounded-3xl bg-white p-7 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close */}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-xl p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition"
        >
          <X size={16} />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3 mb-5">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-green-100">
            <QrCode size={20} className="text-green-700" />
          </div>
          <div>
            <h3 className="text-base font-bold text-gray-900">Connection Ticket</h3>
            <p className="text-xs text-gray-500">{farmer?.email}</p>
          </div>
        </div>

        {/* QR Code — only render when value is a non-empty string */}
        <div className="flex justify-center mb-5">
          <div className="rounded-2xl border-2 border-green-100 bg-white p-4 shadow-inner">
            {qrValue ? (
              <QRCode
                value={qrValue}
                size={200}
                fgColor="#15803d"
                bgColor="#ffffff"
              />
            ) : (
              <div className="flex h-[200px] w-[200px] items-center justify-center text-xs text-gray-400">
                Generating QR…
              </div>
            )}
          </div>
        </div>

        {/* Token display */}
        <div className="mb-4 rounded-xl bg-gray-50 border border-gray-200 px-4 py-3 text-center">
          <p className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold mb-1">QR Token</p>
          <p className="font-mono text-sm font-bold text-green-700 break-all">
            {qrValue ?? '—'}
          </p>
        </div>

        {/* Instructions */}
        <div className="flex items-start gap-3 rounded-xl border border-amber-100 bg-amber-50 p-3">
          <Smartphone size={16} className="text-amber-600 mt-0.5 shrink-0" />
          <p className="text-xs text-amber-800 leading-relaxed">
            Farmer can scan this code from the <strong>AeroGuard app</strong> to instantly connect,
            or use the <strong>6-digit OTP</strong> sent to their email.
          </p>
        </div>
      </div>
    </div>
  );
}

// ── Status Badge ───────────────────────────────────────────────────────────
function StatusBadge({ status }) {
  if (status === 'app_linked') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-green-100 border border-green-200 px-2.5 py-0.5 text-[10px] font-semibold text-green-700">
        <CheckCircle2 size={10} />
        App Linked
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 border border-amber-200 px-2.5 py-0.5 text-[10px] font-semibold text-amber-700">
      <Clock size={10} />
      Pending App Install
    </span>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────
export default function DashboardHome() {
  const navigate = useNavigate();
  const { activeFarmers, addFarmer, removeFarmer, updateFarmer } = useFarmers();

  // Invite form state
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [ticketFarmer, setTicketFarmer] = useState(null); // farmer just invited — shows QR inline
  const [recovering, setRecovering] = useState(false);

  // QR modal state
  const [qrModalFarmer, setQrModalFarmer] = useState(null);

  const emailRef = useRef(null);

  // ── Auto-recover sessions from DB on mount ──
  useEffect(() => {
    if (activeFarmers.length > 0) return;
    const recover = async () => {
      setRecovering(true);
      try {
        const res = await axios.get(`${API}/workspaces`);
        const workspaces = res.data || [];
        for (const w of workspaces) {
          if (w.sessionId && w.email) {
            addFarmer(w.email, w.sessionId, {
              qrToken:       w.qrToken       ?? null,
              appLinkStatus: w.appLinkStatus ?? 'pending_app_install',
            });
          }
        }
      } catch { /* silent */ }
      finally { setRecovering(false); }
    };
    recover();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Live poll: detect when mobile app verifies OTP directly in MongoDB ──
  useEffect(() => {
    const hasPending = activeFarmers.some(f => f.appLinkStatus !== 'app_linked');
    if (!hasPending) return; // nothing to poll for

    const interval = setInterval(async () => {
      try {
        const res = await axios.get(`${API}/workspaces`);
        const workspaces = res.data || [];
        for (const w of workspaces) {
          const local = activeFarmers.find(f => f.sessionId === w.sessionId);
          if (local && local.appLinkStatus !== 'app_linked' && w.appLinkStatus === 'app_linked') {
            console.log(`[POLL] Farmer ${w.email} verified via app! Updating dashboard.`);
            updateFarmer(w.sessionId, { appLinkStatus: 'app_linked' });
          }
        }
      } catch { /* silent */ }
    }, 5000); // poll every 5 seconds

    return () => clearInterval(interval);
  }, [activeFarmers, updateFarmer]);

  // ── Send invite (OTP + QR token generated server-side) ──
  const sendInvite = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setTicketFarmer(null);

    let res;
    try {
      res = await axios.post(`${API}/farmer/request-otp`, { email });
      console.log('[DashboardHome] Full API Response:', res.data);
    } catch (err) {
      // Network error or genuine 500 — show message, do NOT crash
      const msg = err.response?.data?.error || err.message || 'Failed to send invite';
      setError(msg);
      setLoading(false);
      return;
    }

    try {
      const sessionId   = res.data?.sessionId   ?? null;
      const qrToken     = res.data?.qrToken     ?? null;
      const otpCode     = res.data?.otpCode     ?? null;
      const emailStatus = res.data?.emailStatus ?? 'sent';

      if (!sessionId) {
        setError('Server did not return a session ID. Check backend logs.');
        setLoading(false);
        return;
      }

      addFarmer(email, sessionId, {
        qrToken,
        appLinkStatus: 'pending_app_install',
      });

      setTicketFarmer({
        email,
        sessionId,
        qrToken,
        otpCode,
        emailStatus,
        appLinkStatus: 'pending_app_install',
      });
      setEmail('');
    } catch (parseErr) {
      // Should never happen, but guard against any unexpected state mutation error
      console.error('[DashboardHome] Unexpected error after API call:', parseErr);
      setError('Unexpected error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* QR Modal */}
      {qrModalFarmer && (
        <QrModal farmer={qrModalFarmer} onClose={() => setQrModalFarmer(null)} />
      )}

      <div className="space-y-6">
        {/* Header */}
        <section className="overflow-hidden rounded-3xl border border-green-100 bg-gradient-to-br from-green-50 via-emerald-50/50 to-white p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-green-100">
              <Users size={20} className="text-green-700" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-green-900">Multi-Tenant Command Center</h2>
              <p className="text-sm text-green-700/80">
                Invite farmers via email — they connect using the QR code or OTP from the AeroGuard app.
              </p>
            </div>
          </div>
        </section>

        {/* ── Invite Section ── */}
        <section className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm transition hover:shadow-md">
          <div className="flex items-center gap-2 mb-4">
            <Plus size={16} className="text-green-600" />
            <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wide">
              Invite New Farmer
            </h3>
          </div>

          {/* How it works */}
          <div className="mb-5 grid grid-cols-3 gap-3">
            {[
              { icon: Mail,       label: 'Enter email',          desc: 'Admin enters farmer email' },
              { icon: QrCode,     label: 'Ticket generated',     desc: 'OTP emailed + QR code shown' },
              { icon: Smartphone, label: 'Farmer connects',      desc: 'Scan QR or enter OTP in app' },
            ].map(({ icon: Icon, label, desc }) => (
              <div key={label} className="rounded-2xl border border-gray-100 bg-gray-50/60 p-3 text-center">
                <Icon size={16} className="mx-auto mb-1.5 text-green-600" />
                <p className="text-xs font-semibold text-gray-700">{label}</p>
                <p className="text-[10px] text-gray-400 mt-0.5">{desc}</p>
              </div>
            ))}
          </div>

          {/* Email form */}
          <form onSubmit={sendInvite} className="flex items-end gap-3">
            <div className="flex-1">
              <label className="mb-1.5 block text-xs font-medium text-gray-600">Farmer Email</label>
              <div className="relative">
                <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  ref={emailRef}
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 bg-gray-50/50 px-9 py-2.5 text-sm outline-none transition focus:border-green-400 focus:ring-2 focus:ring-green-100"
                  placeholder="farmer@example.com"
                  required
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={loading || !email}
              className="inline-flex items-center gap-2 rounded-xl bg-[#15803d] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-green-800 disabled:opacity-50"
            >
              {loading ? <Loader2 size={14} className="animate-spin" /> : <Fingerprint size={14} />}
              Send Invite
            </button>
          </form>

          {error && (
            <div className="mt-3 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              <AlertTriangle size={14} />
              {error}
            </div>
          )}

          {/* Inline ticket confirmation after invite */}
          {ticketFarmer && (
            <div className="mt-4 rounded-2xl border border-green-200 bg-green-50/60 p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <CheckCircle2 size={16} className="text-green-600" />
                  <span className="text-sm font-semibold text-green-800">
                    Invite created for {ticketFarmer.email}
                  </span>
                </div>
                <button
                  onClick={() => setTicketFarmer(null)}
                  className="text-gray-400 hover:text-gray-600 transition"
                >
                  <X size={14} />
                </button>
              </div>

              {/* Email not configured warning */}
              {ticketFarmer.emailStatus === 'skipped' && (
                <div className="mb-3 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-2.5 text-xs text-amber-800">
                  <AlertTriangle size={13} className="mt-0.5 shrink-0" />
                  <span>
                    Email not configured — OTP was <strong>not</strong> emailed.
                    Share the QR code or OTP manually:{' '}
                    <span className="font-mono font-bold tracking-widest">{ticketFarmer.otpCode}</span>
                  </span>
                </div>
              )}

              <div className="flex items-center gap-4">
                {/* Mini QR preview — only render when qrToken is a real string */}
                <div className="rounded-xl border border-green-200 bg-white p-2 shrink-0">
                  {ticketFarmer.qrToken ? (
                    <QRCode
                      value={ticketFarmer.qrToken}
                      size={72}
                      fgColor="#15803d"
                      bgColor="#ffffff"
                    />
                  ) : (
                    <div className="flex h-[72px] w-[72px] items-center justify-center text-[10px] text-gray-400 text-center leading-tight">
                      QR not<br />available
                    </div>
                  )}
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-green-700 font-medium mb-1">Connection ticket ready</p>
                  <p className="text-[11px] text-gray-600 leading-relaxed">
                    {ticketFarmer.emailStatus === 'skipped'
                      ? 'Share the QR code with the farmer to connect via the AeroGuard app.'
                      : 'OTP emailed to farmer. They can also scan this QR from the AeroGuard app.'}
                  </p>
                  <button
                    onClick={() => setQrModalFarmer(ticketFarmer)}
                    className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-green-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-800 transition"
                  >
                    <QrCode size={12} />
                    View Full QR Code
                  </button>
                </div>
              </div>
            </div>
          )}
        </section>

        {/* ── Active Farmer Workspaces Grid ── */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Zap size={16} className="text-green-600" />
              <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wide">
                Active Workspaces
              </h3>
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
              <p className="text-xs text-gray-400 mt-1">Invite a farmer above to create their workspace.</p>
            </div>
          ) : activeFarmers.length === 0 && recovering ? (
            <div className="rounded-3xl border border-gray-100 bg-gray-50/50 p-10 text-center">
              <RefreshCw size={24} className="mx-auto mb-2 animate-spin text-green-500 opacity-60" />
              <p className="text-sm text-gray-400">Loading workspaces from database…</p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {activeFarmers.map((farmer) => {
                const isPending = farmer.appLinkStatus !== 'app_linked';
                return (
                  <div
                    key={farmer.sessionId}
                    className={`group rounded-3xl border bg-white p-5 shadow-sm transition hover:shadow-lg ${
                      isPending
                        ? 'border-amber-200 hover:border-amber-300'
                        : 'border-gray-100 hover:border-green-200'
                    }`}
                  >
                    {/* Farmer Identity */}
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className={`flex h-10 w-10 items-center justify-center rounded-2xl font-bold text-sm uppercase border ${
                          isPending
                            ? 'bg-amber-50 text-amber-600 border-amber-100'
                            : 'bg-green-50 text-green-600 border-green-100'
                        }`}>
                          {farmer.email.charAt(0)}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-gray-900 truncate max-w-[150px]">
                            {farmer.email}
                          </p>
                          <p className="text-[10px] font-mono text-gray-400 truncate max-w-[150px]">
                            {farmer.sessionId.slice(0, 12)}…
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Status badge */}
                    <div className="mb-3">
                      <StatusBadge status={farmer.appLinkStatus ?? 'pending_app_install'} />
                    </div>

                    {/* Meta */}
                    <div className="mb-4 rounded-xl bg-gray-50 px-3 py-2">
                      <p className="text-[10px] uppercase tracking-wider text-gray-500 font-medium">
                        {isPending ? 'Invited at' : 'Verified at'}
                      </p>
                      <p className="text-xs text-gray-700 font-medium">
                        {new Date(farmer.verifiedAt).toLocaleString()}
                      </p>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2">
                      {/* Show QR button for pending farmers */}
                      {isPending && farmer.qrToken && (
                        <button
                          onClick={() => setQrModalFarmer(farmer)}
                          className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2.5 text-xs font-semibold text-amber-700 transition hover:bg-amber-100"
                        >
                          <QrCode size={13} />
                          Show QR Code
                        </button>
                      )}

                      {/* Open workspace — always available */}
                      <button
                        onClick={() => {
                          localStorage.setItem('activeSessionId', farmer.sessionId);
                          navigate(`/dashboard/workspace/${farmer.sessionId}`);
                        }}
                        className={`inline-flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-xs font-semibold text-white transition ${
                          isPending
                            ? 'bg-gray-400 hover:bg-gray-500 flex-none'
                            : 'bg-[#15803d] hover:bg-green-800 flex-1'
                        }`}
                        title={isPending ? 'Workspace available — farmer not yet connected via app' : 'Open Workspace'}
                      >
                        {!isPending && 'Open Workspace'}
                        <ArrowRight size={13} />
                      </button>

                      {/* Remove */}
                      <button
                        onClick={() => removeFarmer(farmer.sessionId)}
                        className="inline-flex items-center justify-center rounded-xl border border-red-200 bg-white px-3 py-2.5 text-red-500 transition hover:bg-red-50 hover:border-red-300"
                        title="Remove farmer"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </>
  );
}
