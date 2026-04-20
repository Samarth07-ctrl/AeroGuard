import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { CheckCircle2, FileImage, RefreshCw, ShieldAlert } from 'lucide-react';

const API = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';

function badgeClass(severity = '') {
  const key = (severity || '').toLowerCase();
  if (key === 'safe')   return 'bg-green-100 text-green-800 border border-green-200';
  if (key === 'severe') return 'bg-red-200 text-red-900 border border-red-300';
  if (key === 'high')   return 'bg-red-100 text-red-700 border border-red-200';
  if (key === 'medium') return 'bg-amber-100 text-amber-700 border border-amber-200';
  if (key === 'low')    return 'bg-yellow-100 text-yellow-700 border border-yellow-200';
  return 'bg-gray-100 text-gray-600 border border-gray-200';
}

const SAFE_NAMES = [
  'healthy field / no anomalies found',
  'no disease detected / invalid image',
];

function isSafe(disease) {
  return (
    (disease.severity || '').toLowerCase() === 'safe' ||
    SAFE_NAMES.includes((disease.name || '').toLowerCase())
  );
}

function DiseaseBadge({ disease }) {
  const safe = isSafe(disease);
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${badgeClass(disease.severity)}`}>
      {safe ? <CheckCircle2 size={11} /> : <ShieldAlert size={11} />}
      {disease.name}
      {!safe && disease.severity && <span className="opacity-60">({disease.severity})</span>}
    </span>
  );
}

export default function HistoryPage() {
  const { token } = useAuth();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API}/analysis-sessions`, {
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Server returned ${res.status}`);
      }

      const data = await res.json();
      setRows(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message || 'Failed to load analysis history');
    } finally {
      setLoading(false);
    }
  }, [token]);

  // Fetch on mount and every 10s so new uploads appear automatically
  useEffect(() => {
    fetchHistory();
    const iv = setInterval(fetchHistory, 10000);
    return () => clearInterval(iv);
  }, [fetchHistory]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Analysis History</h1>
          <p className="mt-1 text-sm text-gray-600">
            One row per image upload — diseases that passed the 60% confidence gate.
          </p>
        </div>
        <button
          onClick={fetchHistory}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="overflow-x-auto rounded-2xl border border-gray-200 shadow-sm">
        <table className="min-w-full bg-white text-sm">
          <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
            <tr>
              <th className="px-4 py-3 font-semibold">Date &amp; Time</th>
              <th className="px-4 py-3 font-semibold">Farmer</th>
              <th className="px-4 py-3 font-semibold">Session ID</th>
              <th className="px-4 py-3 font-semibold">Image</th>
              <th className="px-4 py-3 font-semibold">Detected Diseases</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td className="px-4 py-8 text-center text-gray-400" colSpan={5}>
                  <RefreshCw size={18} className="mx-auto mb-1 animate-spin opacity-40" />
                  Loading…
                </td>
              </tr>
            )}

            {!loading && rows.length === 0 && (
              <tr>
                <td className="px-4 py-10 text-center text-gray-400" colSpan={5}>
                  <FileImage size={28} className="mx-auto mb-2 opacity-40" />
                  No analysis sessions yet.
                </td>
              </tr>
            )}

            {!loading && rows.map((row) => {
              const diseases = row.diseases || [];
              const safeSession =
                diseases.length === 0 ||
                (diseases.length === 1 && isSafe(diseases[0]));

              return (
                <tr
                  key={row._id || row.sessionId}
                  className={`border-t border-gray-100 align-top transition hover:bg-gray-50 ${safeSession ? 'bg-green-50/30' : ''}`}
                >
                  <td className="px-4 py-3 text-gray-700 whitespace-nowrap">
                    {new Date(row.createdAt).toLocaleString()}
                  </td>

                  <td className="px-4 py-3 text-gray-700">
                    {row.farmerId?.email || row.farmerEmail || <span className="text-gray-400">—</span>}
                  </td>

                  <td className="px-4 py-3">
                    <span className="font-mono text-[11px] text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                      {(row.sessionId || '').slice(0, 12)}…
                    </span>
                  </td>

                  <td className="px-4 py-3">
                    {(row.imageUrl || row.imagePath) ? (
                      <img
                        src={
                          row.imageUrl
                            ? row.imageUrl
                            : `http://localhost:5000/${row.imagePath.replace(/\\/g, '/')}`
                        }
                        alt="scan"
                        className="h-14 w-20 rounded-lg border border-gray-200 object-cover"
                        onError={(e) => { e.currentTarget.style.display = 'none'; }}
                      />
                    ) : <span className="text-gray-400">—</span>}
                  </td>

                  <td className="px-4 py-3">
                    {diseases.length === 0 ? (
                      <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold bg-green-100 text-green-800 border border-green-200">
                        <CheckCircle2 size={11} />
                        Healthy Field / No Anomalies Found
                      </span>
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                        {diseases.map((d, i) => <DiseaseBadge key={i} disease={d} />)}
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
