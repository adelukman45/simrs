import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Activity, ShieldCheck, Stethoscope, Database } from "lucide-react";

const QUICK_ACCOUNTS = [
  { label: "Admin", username: "admin" },
  { label: "Pendaftaran", username: "daftar1" },
  { label: "Dokter (dr. Budi)", username: "dr_budi" },
  { label: "Lab", username: "lab1" },
  { label: "Farmasi", username: "farmasi1" },
  { label: "Kasir", username: "kasir1" },
];

export default function LoginPage() {
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("password123");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(username, password);
      navigate("/");
    } catch (err) {
      setError(
        err.response?.data?.message || "Gagal terhubung ke server autentikasi.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "grid",
        gridTemplateColumns: "1.35fr 1fr",
        background: "#fff",
      }}
    >
      {/* Sisi Kiri: Ilustrasi Kartu Ringkasan Sistem Medis */}
      <div
        style={{
          background: "var(--bg)",
          padding: "2.5rem",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.75rem",
            fontWeight: 800,
            fontSize: "1.2rem",
          }}
        >
          <div className="brand-logo">
            <Activity size={20} />
          </div>
          <span>INOVA MEDIKA SIMRS</span>
        </div>

        <div style={{ maxWidth: "460px", margin: "0 auto", width: "100%" }}>
          <div className="card" style={{ marginBottom: "1rem" }}>
            <div className="stat-row">
              <div className="icon-box icon-teal">
                <Stethoscope size={22} />
              </div>
              <div>
                <div
                  style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}
                >
                  Alur Rawat Jalan Terpadu
                </div>
                <strong>Admisi • Poliklinik • Lab • Farmasi • Kasir</strong>
              </div>
            </div>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "1rem",
            }}
          >
            <div className="card" style={{ marginBottom: 0 }}>
              <div
                className="icon-box icon-green"
                style={{ marginBottom: "0.6rem" }}
              >
                <ShieldCheck size={20} />
              </div>
              <div
                style={{ fontSize: "0.78rem", color: "var(--text-secondary)" }}
              >
                Keamanan & RBAC
              </div>
              <strong>JWT + 6 Peran Aktif</strong>
            </div>
            <div className="card" style={{ marginBottom: 0 }}>
              <div
                className="icon-box icon-amber"
                style={{ marginBottom: "0.6rem" }}
              >
                <Database size={20} />
              </div>
              <div
                style={{ fontSize: "0.78rem", color: "var(--text-secondary)" }}
              >
                Arsitektur Hybrid
              </div>
              <strong>Yii2 + Node.js + PG17</strong>
            </div>
          </div>
        </div>

        <div style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>
          © 2026 PT Inova Medika Solusindo — Sistem Informasi Manajemen Rumah
          Sakit
        </div>
      </div>

      {/* Sisi Kanan: Form Login */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "2.5rem",
        }}
      >
        <div style={{ width: "100%", maxWidth: "380px" }}>
          <h2
            style={{
              fontSize: "1.5rem",
              fontWeight: 700,
              marginBottom: "0.3rem",
            }}
          >
            Selamat Datang! 👋
          </h2>
          <p
            style={{
              color: "var(--text-secondary)",
              fontSize: "0.88rem",
              marginBottom: "1.5rem",
            }}
          >
            Silakan masuk menggunakan akun unit layanan Anda
          </p>

          {error && <div className="alert alert-error">{error}</div>}

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label>Username</label>
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <label>Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <button
              type="submit"
              className="btn btn-primary"
              style={{
                width: "100%",
                justifyContent: "center",
                padding: "0.7rem",
              }}
              disabled={loading}
            >
              {loading ? "Memverifikasi..." : "LOG IN"}
            </button>
          </form>

          <div
            style={{
              marginTop: "1.75rem",
              paddingTop: "1.25rem",
              borderTop: "1px solid #f1f5f9",
            }}
          >
            <div
              style={{
                fontSize: "0.78rem",
                color: "var(--text-secondary)",
                marginBottom: "0.6rem",
              }}
            >
              Pilih cepat akun pengujian (Password: <code>password123</code>):
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.45rem" }}>
              {QUICK_ACCOUNTS.map((acc) => (
                <button
                  key={acc.username}
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => {
                    setUsername(acc.username);
                    setPassword("password123");
                  }}
                >
                  {acc.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
