import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { nodeApi } from "../api/client";
import { useAuth } from "../context/AuthContext";
import {
  Users,
  Stethoscope,
  Wallet,
  Clock,
  CheckCircle2,
  Activity,
} from "lucide-react";

const formatRp = (val) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(val || 0);

export default function DashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const today = new Date().toISOString().split("T")[0];
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchDashboard = async () => {
    setLoading(true);
    try {
      const res = await nodeApi.get("/dashboard", {
        params: { start_date: startDate, end_date: endDate },
      });
      setData(res.data.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
  }, []);

  const maxPoli = data
    ? Math.max(...data.kunjungan_per_poli.map((p) => p.jumlah_kunjungan), 1)
    : 1;

  return (
    <div>
      {/* Filter Bar Ringkas */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "1.25rem",
          flexWrap: "wrap",
          gap: "0.75rem",
        }}
      >
        <div>
          <h2 style={{ fontSize: "1.25rem", fontWeight: 700 }}>
            Ringkasan Operasional Rawat Jalan
          </h2>
          <p style={{ fontSize: "0.82rem", color: "var(--text-secondary)" }}>
            Analitik real-time terintegrasi dari PostgreSQL & Node.js Service
          </p>
        </div>
        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            style={{ width: "auto" }}
          />
          <span style={{ color: "var(--text-secondary)" }}>s/d</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            style={{ width: "auto" }}
          />
          <button className="btn btn-primary" onClick={fetchDashboard}>
            Terapkan
          </button>
        </div>
      </div>

      {loading || !data ? (
        <div className="card">Memuat data analitik rumah sakit...</div>
      ) : (
        <>
          {/* Baris Atas: Bento 2 Kolom (Welcome Card + 4 KPI Icons) */}
          <div className="bento-top">
            <div
              className="card"
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 0,
              }}
            >
              <div>
                <h3 style={{ fontSize: "1.1rem", fontWeight: 700 }}>
                  Halo, {user?.nama_lengkap}!
                </h3>
                <p
                  style={{
                    fontSize: "0.82rem",
                    color: "var(--text-secondary)",
                    marginBottom: "0.85rem",
                  }}
                >
                  Total Pendapatan Diterima Periode Ini
                </p>
                <div
                  style={{
                    fontSize: "1.65rem",
                    fontWeight: 800,
                    color: "var(--primary)",
                    marginBottom: "0.85rem",
                  }}
                >
                  {formatRp(
                    data.ringkasan_pendapatan.total_pendapatan_diterima,
                  )}
                </div>
                <button
                  className="btn btn-primary btn-sm"
                  onClick={() => navigate("/pendaftaran")}
                >
                  LIHAT ANTREAN PASIEN
                </button>
              </div>
              <div
                style={{
                  width: "84px",
                  height: "84px",
                  borderRadius: "50%",
                  background: "var(--primary-soft)",
                  color: "var(--primary)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Activity size={42} />
              </div>
            </div>

            <div className="card" style={{ marginBottom: 0 }}>
              <h3
                style={{
                  fontSize: "1.05rem",
                  fontWeight: 700,
                  marginBottom: "0.2rem",
                }}
              >
                Statistik Pelayanan
              </h3>
              <p
                style={{
                  fontSize: "0.82rem",
                  color: "var(--text-secondary)",
                  marginBottom: "1.25rem",
                }}
              >
                Rekapitulasi aktivitas medis dan administrasi rawat jalan
              </p>
              <div className="grid-4">
                <div className="stat-row">
                  <div className="icon-box icon-teal">
                    <Users size={22} />
                  </div>
                  <div>
                    <div
                      style={{
                        fontSize: "0.76rem",
                        color: "var(--text-secondary)",
                      }}
                    >
                      Total Pasien
                    </div>
                    <strong style={{ fontSize: "1.15rem" }}>
                      {data.ringkasan_kunjungan.total_kunjungan}
                    </strong>
                  </div>
                </div>
                <div className="stat-row">
                  <div className="icon-box icon-amber">
                    <Clock size={22} />
                  </div>
                  <div>
                    <div
                      style={{
                        fontSize: "0.76rem",
                        color: "var(--text-secondary)",
                      }}
                    >
                      Menunggu
                    </div>
                    <strong style={{ fontSize: "1.15rem" }}>
                      {data.ringkasan_kunjungan.menunggu}
                    </strong>
                  </div>
                </div>
                <div className="stat-row">
                  <div className="icon-box icon-green">
                    <CheckCircle2 size={22} />
                  </div>
                  <div>
                    <div
                      style={{
                        fontSize: "0.76rem",
                        color: "var(--text-secondary)",
                      }}
                    >
                      Selesai Lunas
                    </div>
                    <strong style={{ fontSize: "1.15rem" }}>
                      {data.ringkasan_kunjungan.selesai}
                    </strong>
                  </div>
                </div>
                <div className="stat-row">
                  <div className="icon-box icon-rose">
                    <Stethoscope size={22} />
                  </div>
                  <div>
                    <div
                      style={{
                        fontSize: "0.76rem",
                        color: "var(--text-secondary)",
                      }}
                    >
                      Jenis Tindakan
                    </div>
                    <strong style={{ fontSize: "1.15rem" }}>
                      {data.rekap_tindakan.length}
                    </strong>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Baris Bawah: Bento 3 Kolom */}
          <div className="bento-bottom">
            {/* Kartu 1: Distribusi Kunjungan per Poli (Visual Bar Chart CSS) */}
            <div className="card" style={{ marginBottom: 0 }}>
              <h4
                style={{
                  fontSize: "1rem",
                  fontWeight: 700,
                  marginBottom: "1rem",
                }}
              >
                Distribusi Kunjungan Poli
              </h4>
              <div
                style={{
                  display: "flex",
                  alignItems: "flex-end",
                  justifyContent: "space-around",
                  height: "150px",
                  padding: "0.5rem 0",
                  borderBottom: "1px solid #f1f5f9",
                }}
              >
                {data.kunjungan_per_poli.map((poli) => {
                  const pct = Math.max(
                    12,
                    Math.round((poli.jumlah_kunjungan / maxPoli) * 100),
                  );
                  return (
                    <div
                      key={poli.kode_poli}
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        gap: "0.4rem",
                        width: "60px",
                      }}
                    >
                      <span style={{ fontSize: "0.78rem", fontWeight: 700 }}>
                        {poli.jumlah_kunjungan}
                      </span>
                      <div
                        style={{
                          width: "18px",
                          height: `${pct}px`,
                          background: "var(--primary-gradient)",
                          borderRadius: "999px",
                          transition: "height 0.4s",
                        }}
                      />
                      <span
                        style={{
                          fontSize: "0.75rem",
                          color: "var(--text-secondary)",
                          fontWeight: 600,
                        }}
                      >
                        {poli.kode_poli}
                      </span>
                    </div>
                  );
                })}
              </div>
              <p
                style={{
                  fontSize: "0.8rem",
                  color: "var(--text-secondary)",
                  marginTop: "0.85rem",
                }}
              >
                Perbandingan volume pasien antar poliklinik rawat jalan.
              </p>
            </div>

            {/* Kartu 2: Rincian Keuangan & Progress Pelunasan */}
            <div className="card" style={{ marginBottom: 0 }}>
              <h4
                style={{
                  fontSize: "1rem",
                  fontWeight: 700,
                  marginBottom: "0.25rem",
                }}
              >
                Total Potensi Tagihan
              </h4>
              <div
                style={{
                  fontSize: "1.5rem",
                  fontWeight: 800,
                  marginBottom: "1rem",
                }}
              >
                {formatRp(data.ringkasan_pendapatan.total_potensi_pendapatan)}
              </div>

              <div style={{ marginBottom: "0.9rem" }}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    fontSize: "0.82rem",
                  }}
                >
                  <span>Terbayar (Kasir)</span>
                  <strong style={{ color: "#16a34a" }}>
                    {formatRp(
                      data.ringkasan_pendapatan.total_pendapatan_diterima,
                    )}
                  </strong>
                </div>
                <div className="progress-track">
                  <div
                    className="progress-fill"
                    style={{
                      width: `${Math.min(100, (Number(data.ringkasan_pendapatan.total_pendapatan_diterima) / Math.max(1, Number(data.ringkasan_pendapatan.total_potensi_pendapatan))) * 100)}%`,
                      background: "#16a34a",
                    }}
                  />
                </div>
              </div>

              <div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    fontSize: "0.82rem",
                  }}
                >
                  <span>Sisa Belum Dibayar</span>
                  <strong style={{ color: "#d97706" }}>
                    {formatRp(data.ringkasan_pendapatan.total_piutang)}
                  </strong>
                </div>
                <div className="progress-track">
                  <div
                    className="progress-fill"
                    style={{
                      width: `${Math.min(100, (Number(data.ringkasan_pendapatan.total_piutang) / Math.max(1, Number(data.ringkasan_pendapatan.total_potensi_pendapatan))) * 100)}%`,
                      background: "#d97706",
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Kartu 3: Rekap Pemakaian Obat Farmasi */}
            <div className="card" style={{ marginBottom: 0 }}>
              <h4
                style={{
                  fontSize: "1rem",
                  fontWeight: 700,
                  marginBottom: "0.85rem",
                }}
              >
                Pemakaian Obat Terbanyak
              </h4>
              {data.rekap_penggunaan_obat.length === 0 ? (
                <p
                  style={{
                    fontSize: "0.82rem",
                    color: "var(--text-secondary)",
                  }}
                >
                  Belum ada obat diserahkan pada periode ini.
                </p>
              ) : (
                data.rekap_penggunaan_obat.slice(0, 4).map((o) => (
                  <div
                    key={o.kode_obat}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "0.45rem 0",
                      borderBottom: "1px solid #f1f5f9",
                    }}
                  >
                    <div>
                      <div style={{ fontSize: "0.85rem", fontWeight: 600 }}>
                        {o.nama_obat}
                      </div>
                      <small style={{ color: "var(--text-secondary)" }}>
                        Sisa stok: {o.sisa_stok} {o.satuan}
                      </small>
                    </div>
                    <span className="badge badge-info">
                      {o.total_keluar} keluar
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
