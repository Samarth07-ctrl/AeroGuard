import { Navigate, Route, Routes } from 'react-router-dom';
import ProtectedRoute from './components/ProtectedRoute';
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import AnalyzePage from './pages/dashboard/AnalyzePage';
import DashboardHome from './pages/dashboard/DashboardHome';
import DashboardLayout from './pages/dashboard/DashboardLayout';
import FarmerWorkspace from './pages/dashboard/FarmerWorkspace';
import HistoryPage from './pages/dashboard/HistoryPage';
import MapPage from './pages/dashboard/MapPage';
import WeatherPage from './pages/dashboard/WeatherPage';

function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />

      <Route element={<ProtectedRoute />}>
        <Route path="/dashboard" element={<DashboardLayout />}>
          <Route index element={<DashboardHome />} />
          <Route path="analyze" element={<AnalyzePage />} />
          <Route path="history" element={<HistoryPage />} />
          <Route path="map" element={<MapPage />} />
          <Route path="weather" element={<WeatherPage />} />
          <Route path="workspace/:sessionId" element={<FarmerWorkspace />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
