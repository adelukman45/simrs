import React, { useEffect, useState } from "react";
import { yiiApi } from "../api/client";

export default function FarmasiPage() {
  const [resepList, setResepList] = useState([]);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("ALL"); // 'ALL' | 'MENUNGGU' | 'DISERAHKAN'
  const [notif, setNotif] = useState({ type: "", message: "" });
  const [loadingId, setLoadingId] = useState(null);

  const fetchResep = async () => {
    try {
      const res = await yiiApi.get("/farmasi");
      setResepList(res.data?.data || []);
    } catch (err) {
      setNotif({
        type: "error",
        message:
          err.response?.data?.message || "Gagal memuat daftar resep farmasi.",
      });
    }
  };

  useEffect(() => {
    fetchResep();
  }, []);

  const handleSerahkan = async (resepId) => {
    setLoadingId(resepId);
    setNotif({ type: "", message: "" });
    try {
      const res = await yiiApi.post(`/farmasi/${resepId}/serahkan`);
      await fetchResep();
      setNotif({
        type: "success",
        message:
          res.data?.message ||
          "Obat berhasil diserahkan dan stok telah diperbarui.",
      });
    } catch (err) {
      setNotif({
        type: "error",
        message:
          err.response?.data?.message || "Gagal memproses penyerahan obat.",
      });
    } finally {
      setLoadingId(null);
    }
  };

  const countMenunggu = resepList.filter(
    (r) => r.status_resep === "MENUNGGU",
  ).length;
  const countDiserahkan = resepList.filter(
    (r) => r.status_resep === "DISERAHKAN",
  ).length;

  const filteredList = resepList.filter((r) => {
    if (filterStatus !== "ALL" && r.status_resep !== filterStatus) return false;
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    const matchHeader =
      (r.no_resep || "").toLowerCase().includes(q) ||
      (r.nama_pasien || "").toLowerCase().includes(q) ||
      (r.no_rm || "").toLowerCase().includes(q) ||
      (r.nama_dokter || "").toLowerCase().includes(q) ||
      (r.nama_poli || "").toLowerCase().includes(q);
    const matchObat = (r.items || []).some((it) =>
      (it.nama_obat || "").toLowerCase().includes(q),
    );
    return matchHeader || matchObat;
  });

  return (
    <div style={{ padding: "20px" }}>
      {/* NOTIFIKASI BERBEDA WARNA: HIJAU (SUCCESS) vs MERAH (ERROR) */}
      {notif.message && (
        <div
          style={{
            marginBottom: "16px",
            padding: "14px 18px",
            borderRadius: "10px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            backgroundColor: notif.type === "success" ? "#DCFCE7" : "#FEE2E2",
            border: `1px solid ${notif.type === "success" ? "#16A34A" : "#DC2626"}`,
            color: notif.type === "success" ? "#166534" : "#991B1B",
            fontWeight: 600,
          }}
        >
          <span>
            {notif.type === "success" ? "✓ " : "⚠ "}
            {notif.message}
          </span>
          <button
            type="button"
            onClick={() => setNotif({ type: "", message: "" })}
            style={{
              background: "transparent",
              border: "none",
              fontSize: "16px",
              cursor: "pointer",
              color: "inherit",
              fontWeight: "bold",
            }}
          >
            ✕
          </button>
        </div>
      )}

      <div
        style={{
          background: "#fff",
          borderRadius: "12px",
          padding: "20px",
          boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
        }}
      >
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "12px",
            marginBottom: "16px",
          }}
        >
          <div>
            <h3 style={{ margin: 0, color: "#0F172A" }}>
              Instalasi Farmasi & Penyerahan Resep
            </h3>
            <div
              style={{ fontSize: "12.5px", color: "#64748B", marginTop: "2px" }}
            >
              Obat dapat diserahkan setelah status tagihan pasien{" "}
              <strong>LUNAS</strong> di Kasir.
            </div>
          </div>

          {/* FILTER TAB STATUS */}
          <div
            style={{
              display: "flex",
              gap: "6px",
              backgroundColor: "#F1F5F9",
              padding: "4px",
              borderRadius: "8px",
            }}
          >
            {[
              { key: "ALL", label: `Semua (${resepList.length})` },
              { key: "MENUNGGU", label: `Menunggu (${countMenunggu})` },
              { key: "DISERAHKAN", label: `Diserahkan (${countDiserahkan})` },
            ].map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setFilterStatus(tab.key)}
                style={{
                  padding: "6px 12px",
                  borderRadius: "6px",
                  border: "none",
                  cursor: "pointer",
                  fontWeight: 600,
                  fontSize: "12.5px",
                  backgroundColor:
                    filterStatus === tab.key ? "#0D9488" : "transparent",
                  color: filterStatus === tab.key ? "#FFFFFF" : "#475569",
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* KOLOM PENCARIAN */}
        <div style={{ marginBottom: "16px" }}>
          <input
            type="text"
            placeholder="Cari No. Resep, nama pasien, No. RM, dokter, atau nama obat..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              width: "100%",
              padding: "10px 14px",
              borderRadius: "8px",
              border: "1px solid #CBD5E1",
              fontSize: "13.5px",
              boxSizing: "border-box",
            }}
          />
        </div>

        {filteredList.length === 0 ? (
          <div
            style={{
              textAlign: "center",
              padding: "28px",
              color: "#64748B",
              background: "#F8FAFC",
              borderRadius: "8px",
            }}
          >
            {search
              ? "Data resep yang dicari tidak ditemukan."
              : "Belum ada data resep obat."}
          </div>
        ) : (
          <div
            style={{ display: "flex", flexDirection: "column", gap: "14px" }}
          >
            {filteredList.map((resep) => {
              const isMenunggu = resep.status_resep === "MENUNGGU";
              const isLunas = resep.status_pembayaran === "LUNAS";
              return (
                <div
                  key={resep.id}
                  style={{
                    border: "1px solid #E2E8F0",
                    borderRadius: "10px",
                    padding: "16px",
                    backgroundColor: isMenunggu ? "#FFFFFF" : "#F8FAFC",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: "10px",
                      marginBottom: "10px",
                    }}
                  >
                    <div>
                      <span
                        style={{
                          fontWeight: 700,
                          color: "#0F766E",
                          fontSize: "14px",
                        }}
                      >
                        {resep.no_resep}
                      </span>
                      <span style={{ margin: "0 8px", color: "#CBD5E1" }}>
                        |
                      </span>
                      <strong style={{ color: "#0F172A" }}>
                        {resep.nama_pasien}
                      </strong>{" "}
                      <span style={{ color: "#64748B", fontSize: "13px" }}>
                        ({resep.no_rm})
                      </span>
                      <div
                        style={{
                          fontSize: "12.5px",
                          color: "#64748B",
                          marginTop: "2px",
                        }}
                      >
                        {resep.nama_poli} • {resep.nama_dokter}
                      </div>
                    </div>

                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        flexWrap: "wrap",
                      }}
                    >
                      {/* BADGE STATUS PEMBAYARAN KASIR */}
                      <span
                        style={{
                          padding: "4px 10px",
                          borderRadius: "999px",
                          fontSize: "11.5px",
                          fontWeight: 700,
                          backgroundColor: isLunas ? "#DCFCE7" : "#FEE2E2",
                          color: isLunas ? "#166534" : "#991B1B",
                        }}
                      >
                        Kasir: {resep.status_pembayaran || "BELUM_DIBAYAR"}
                      </span>

                      {/* BADGE STATUS RESEP */}
                      <span
                        style={{
                          padding: "4px 10px",
                          borderRadius: "999px",
                          fontSize: "11.5px",
                          fontWeight: 700,
                          backgroundColor: isMenunggu ? "#FEF3C7" : "#E0F2FE",
                          color: isMenunggu ? "#B45309" : "#0369A1",
                        }}
                      >
                        Resep: {resep.status_resep}
                      </span>

                      {isMenunggu && (
                        <button
                          type="button"
                          disabled={loadingId === resep.id || !isLunas}
                          title={
                            !isLunas
                              ? "Pasien harus melunasi tagihan di Kasir terlebih dahulu"
                              : "Serahkan obat ke pasien"
                          }
                          onClick={() => handleSerahkan(resep.id)}
                          style={{
                            padding: "8px 14px",
                            borderRadius: "8px",
                            border: "none",
                            backgroundColor: !isLunas ? "#CBD5E1" : "#0D9488",
                            color: !isLunas ? "#475569" : "#FFFFFF",
                            fontWeight: 700,
                            fontSize: "12.5px",
                            cursor:
                              loadingId === resep.id || !isLunas
                                ? "not-allowed"
                                : "pointer",
                          }}
                        >
                          {loadingId === resep.id
                            ? "Memproses..."
                            : !isLunas
                              ? "Menunggu Bayar Kasir"
                              : "Serahkan Obat"}
                        </button>
                      )}
                    </div>
                  </div>

                  <table
                    style={{
                      width: "100%",
                      borderCollapse: "collapse",
                      fontSize: "13px",
                      marginTop: "8px",
                    }}
                  >
                    <thead>
                      <tr
                        style={{
                          borderBottom: "1px solid #E2E8F0",
                          textAlign: "left",
                          color: "#64748B",
                        }}
                      >
                        <th style={{ padding: "6px" }}>NAMA OBAT</th>
                        <th style={{ padding: "6px" }}>DOSIS & ATURAN</th>
                        <th style={{ padding: "6px" }}>JUMLAH</th>
                        <th style={{ padding: "6px" }}>STOK GUDANG</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(resep.items || []).map((item) => (
                        <tr
                          key={item.id}
                          style={{ borderBottom: "1px solid #F1F5F9" }}
                        >
                          <td style={{ padding: "6px", fontWeight: 600 }}>
                            {item.nama_obat}
                          </td>
                          <td style={{ padding: "6px" }}>
                            {item.dosis} • {item.frekuensi}
                          </td>
                          <td style={{ padding: "6px" }}>
                            {item.jumlah} {item.satuan}
                          </td>
                          <td
                            style={{
                              padding: "6px",
                              color:
                                Number(item.stok_tersedia) < Number(item.jumlah)
                                  ? "#DC2626"
                                  : "#16A34A",
                              fontWeight: 600,
                            }}
                          >
                            {item.stok_tersedia} {item.satuan}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
