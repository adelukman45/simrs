import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import Layout from "./components/Layout";
import LoginPage from "./pages/LoginPage";
import DashboardPage from "./pages/DashboardPage";
import MasterPage from "./pages/MasterPage";
import PendaftaranPage from "./pages/PendaftaranPage";
import PemeriksaanPage from "./pages/PemeriksaanPage";
import LabPage from "./pages/LabPage";
import FarmasiPage from "./pages/FarmasiPage";
import BillingPage from "./pages/BillingPage";

function ProtectedRoute({ children }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route index element={<DashboardPage />} />
            <Route path="master" element={<MasterPage />} />
            <Route path="pendaftaran" element={<PendaftaranPage />} />
            <Route path="pemeriksaan" element={<PemeriksaanPage />} />
            <Route path="laboratorium" element={<LabPage />} />
            <Route path="farmasi" element={<FarmasiPage />} />
            <Route path="billing" element={<BillingPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
