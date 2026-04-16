import { useState } from 'react';
import axios from 'axios';
import { Link, useNavigate } from 'react-router-dom';

const API = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';

export default function RegisterPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await axios.post(`${API}/auth/register`, form);
      navigate('/login', { replace: true });
    } catch (err) {
      setError(err.response?.data?.error || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f9fafb] px-4 py-10">
      <div className="grid w-full max-w-5xl overflow-hidden rounded-3xl bg-white shadow-sm md:grid-cols-2">
        <div className="hidden md:block">
          <img
            src="https://images.unsplash.com/photo-1622383563227-04401ab4e5ea?auto=format&fit=crop&w=1200&q=80"
            alt="Drone farming"
            className="h-full w-full object-cover"
          />
        </div>
        <div className="p-8">
          <h1 className="text-2xl font-bold text-gray-900">Create Admin Account</h1>
          <p className="mt-1 text-sm text-gray-500">Register a new admin user.</p>
          <form className="mt-6 space-y-4" onSubmit={submit}>
            <input
              type="email"
              placeholder="Email"
              className="w-full rounded-2xl border border-gray-200 px-4 py-3 outline-none focus:ring-2 focus:ring-green-500"
              value={form.email}
              onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
              required
            />
            <input
              type="password"
              placeholder="Password"
              className="w-full rounded-2xl border border-gray-200 px-4 py-3 outline-none focus:ring-2 focus:ring-green-500"
              value={form.password}
              onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
              required
            />
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-2xl bg-[#15803d] py-3 font-semibold text-white hover:bg-green-800 disabled:opacity-70"
            >
              {loading ? 'Creating account...' : 'Register'}
            </button>
          </form>
          <p className="mt-4 text-sm text-gray-600">
            Already have an account? <Link to="/login" className="text-green-700 hover:underline">Login</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
