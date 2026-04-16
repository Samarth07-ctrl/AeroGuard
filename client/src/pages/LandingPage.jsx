import { Link } from 'react-router-dom';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#f9fafb] text-gray-900">
      <nav className="sticky top-0 z-40 border-b border-green-200/80 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4">
          <div className="text-xl font-bold text-[#16a34a]">AeroGuard AI</div>
          <div className="flex items-center gap-6 text-sm text-gray-700">
            <a href="#" className="hover:text-green-600">Home</a>
            <a href="#" className="hover:text-green-600">About</a>
            <Link to="/login" className="rounded-2xl bg-[#f0fdf4] px-4 py-2 font-medium text-[#15803d] hover:bg-green-100">
              Admin Login
            </Link>
            <Link to="/register" className="rounded-2xl bg-[#15803d] px-4 py-2 font-medium text-white hover:bg-green-800">
              Sign Up
            </Link>
          </div>
        </div>
      </nav>

      <main className="mx-auto grid max-w-6xl gap-10 px-6 py-16 md:grid-cols-2 md:py-20">
        <div className="space-y-6">
          <p className="inline-flex rounded-full bg-green-50 px-4 py-1 text-xs font-semibold uppercase tracking-wide text-green-700">
            AI-Driven Crop Protection
          </p>
          <h1 className="text-4xl font-extrabold leading-tight md:text-5xl">
            AeroGuard AI: Precision Crop Intelligence.
          </h1>
          <p className="text-base leading-7 text-gray-600">
            A production-ready agri-intelligence platform blending real-time drone observations with AI diagnosis. AeroGuard helps teams detect outbreaks early, triage risk zones, and protect yield with data-backed action.
          </p>
          <p className="text-base leading-7 text-gray-600">
            Built on C++ Edge Computing for real-time triage, the system triggers single-image YOLO inference workflows from the backend and maps every disease coordinate into actionable field intelligence.
          </p>
          <div className="flex gap-3">
            <Link to="/login" className="rounded-2xl bg-[#15803d] px-5 py-3 font-semibold text-white shadow-sm hover:bg-green-800">
              Go to Admin Login
            </Link>
            <Link to="/register" className="rounded-2xl bg-[#f0fdf4] px-5 py-3 font-semibold text-[#15803d] hover:bg-green-100">
              Create Admin
            </Link>
          </div>
          <div className="grid grid-cols-3 gap-3 pt-2">
            <div className="rounded-3xl bg-white p-3 shadow-sm transition hover:shadow-md">
              <p className="text-xl font-bold text-[#16a34a]">99.2%</p>
              <p className="text-xs text-gray-500">Detection Precision</p>
            </div>
            <div className="rounded-3xl bg-white p-3 shadow-sm transition hover:shadow-md">
              <p className="text-xl font-bold text-[#16a34a]">&lt; 30s</p>
              <p className="text-xs text-gray-500">Alert Turnaround</p>
            </div>
            <div className="rounded-3xl bg-white p-3 shadow-sm transition hover:shadow-md">
              <p className="text-xl font-bold text-[#16a34a]">24/7</p>
              <p className="text-xs text-gray-500">Field Monitoring</p>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="overflow-hidden rounded-3xl bg-white shadow-sm transition hover:shadow-md">
            <img
              src="https://images.unsplash.com/photo-1464226184884-fa280b87c399?auto=format&fit=crop&w=1400&q=80"
              alt="Drone over agricultural field"
              className="h-64 w-full object-cover"
            />
            <div className="p-5">
              <h2 className="text-lg font-semibold text-green-700">Operational Intelligence Layer</h2>
              <p className="mt-2 text-sm leading-6 text-gray-600">
                Verify farmer identity, execute edge inference, and convert detections into map-based crop risk indicators for fast response operations.
              </p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-3xl bg-white p-4 shadow-sm transition hover:shadow-md">
              <p className="text-sm font-semibold text-gray-900">Secure Admin Access</p>
              <p className="mt-1 text-xs text-gray-600">JWT-protected dashboard and role-based operations.</p>
            </div>
            <div className="rounded-3xl bg-white p-4 shadow-sm transition hover:shadow-md">
              <p className="text-sm font-semibold text-gray-900">Farmer OTP Verification</p>
              <p className="mt-1 text-xs text-gray-600">Email + OTP flow before running any mission-critical scan.</p>
            </div>
            <div className="rounded-3xl bg-white p-4 shadow-sm transition hover:shadow-md">
              <p className="text-sm font-semibold text-gray-900">C++ Edge Triage</p>
              <p className="mt-1 text-xs text-gray-600">Single-image command execution from Node.js backend.</p>
            </div>
            <div className="rounded-3xl bg-white p-4 shadow-sm transition hover:shadow-md">
              <p className="text-sm font-semibold text-gray-900">Global Disease Map</p>
              <p className="mt-1 text-xs text-gray-600">Track historical detections across coordinates and sessions.</p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
