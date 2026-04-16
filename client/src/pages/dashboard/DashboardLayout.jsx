import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { BarChart3, CloudSun, Home, LogOut, MapPinned, ScanLine, Shield, Users } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useFarmers } from '../../context/FarmerContext';

const navClass = ({ isActive }) =>
  `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition ${
    isActive ? 'bg-green-50 text-green-700 font-semibold' : 'text-gray-600 hover:bg-gray-100'
  }`;

export default function DashboardLayout() {
  const navigate = useNavigate();
  const { admin, logout } = useAuth();
  const { activeFarmers } = useFarmers();

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className="min-h-screen bg-[#f9fafb]">
      <div className="mx-auto flex max-w-7xl gap-6 px-4 py-6 sm:px-6">
        <aside className="sticky top-6 h-[calc(100vh-3rem)] w-64 shrink-0 rounded-3xl bg-white p-4 shadow-sm flex flex-col">
          <Link to="/dashboard" className="mb-6 flex items-center gap-2 px-2">
            <Shield size={20} className="text-[#16a34a]" />
            <span className="text-lg font-bold text-[#16a34a]">AeroGuard AI</span>
          </Link>

          <nav className="space-y-1 flex-1">
            <NavLink to="/dashboard" end className={navClass}>
              <Home size={16} />
              Command Center
            </NavLink>
            <NavLink to="/dashboard/analyze" className={navClass}>
              <ScanLine size={16} />
              Analyze
            </NavLink>
            <NavLink to="/dashboard/history" className={navClass}>
              <BarChart3 size={16} />
              History
            </NavLink>
            <NavLink to="/dashboard/map" className={navClass}>
              <MapPinned size={16} />
              Global Map
            </NavLink>
            <NavLink to="/dashboard/weather" className={navClass}>
              <CloudSun size={16} />
              Weather Intel
            </NavLink>

            {/* ── Active Farmer Workspaces ── */}
            {activeFarmers.length > 0 && (
              <>
                <div className="mt-4 mb-2 px-3">
                  <p className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold flex items-center gap-1.5">
                    <Users size={10} />
                    Farmer Workspaces
                  </p>
                </div>
                {activeFarmers.slice(0, 5).map((f) => (
                  <NavLink
                    key={f.sessionId}
                    to={`/dashboard/workspace/${f.sessionId}`}
                    className={navClass}
                  >
                    <div className="flex h-5 w-5 items-center justify-center rounded-md bg-green-100 text-green-700 text-[10px] font-bold uppercase">
                      {f.email.charAt(0)}
                    </div>
                    <span className="truncate max-w-[140px]">{f.email.split('@')[0]}</span>
                  </NavLink>
                ))}
                {activeFarmers.length > 5 && (
                  <p className="px-3 text-[10px] text-gray-400">
                    +{activeFarmers.length - 5} more
                  </p>
                )}
              </>
            )}
          </nav>

          <div className="mt-auto border-t pt-4">
            <p className="px-2 text-xs text-gray-500">{admin?.email || 'Admin session'}</p>
            <button
              onClick={handleLogout}
              className="mt-3 flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-sm text-red-600 hover:bg-red-50"
            >
              <LogOut size={16} />
              Logout
            </button>
          </div>
        </aside>

        <main className="min-w-0 flex-1 space-y-4 rounded-3xl bg-white p-6 shadow-sm">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
