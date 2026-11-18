import React, { useEffect, useState } from "react";
import { nodeApi } from "../api/client";

export default function LabPage() {
  const [orders, setOrders] = useState([]);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [hasil, setHasil] = useState("");
  const [nilaiRujukan, setNilaiRujukan] = useState("");
  const [notif, setNotif] = useState({ type: "", message: "" });
  const [loading, setLoading] = useState(false);

  const fetchLabOrders = async () => {
    try {
      const res = await nodeApi.get("/lab");
      setOrders(res.data?.data || []);
    } catch (err) {
      setNotif({
        type: "error",
        message:
          err.response?.data?.message ||
          "Gagal memuat daftar pemeriksaan laboratorium.",
      });
    }
  };

  useEffect(() => {
    fetchLabOrders();
  }, []);

  const handleOpenModal = (item) => {
    setNotif({ type: "", message: "" });
    setSelectedOrder(item);
    setHasil(item.hasil_pemeriksaan || "");
    setNilaiRujukan(item.nilai_rujukan || "");
  };

  const handleSimpanHasil = async (e) => {
    e.preventDefault();
    if (!selectedOrder) return;

    // Validasi: jika hasil pemeriksaan kosong -> tampilkan notifikasi ERROR (merah)
    if (!hasil.trim()) {
      setNotif({
        type: "error",
        message: "Hasil pemeriksaan laboratorium wajib diisi sebelum disimpan!",
      });
      return;
    }

    setLoading(true);
    setNotif({ type: "", message: "" });

    try {
      const res = await nodeApi.put(`/lab/${selectedOrder.id}/hasil`, {
        hasil_pemeriksaan: hasil.trim(),
        nilai_rujukan: nilaiRujukan.trim() || "-",
      });

      setSelectedOrder(null);
      await fetchLabOrders();

      // Notifikasi BERHASIL (hijau)
      setNotif({
        type: "success",
        message:
          res.data?.message ||
          "Hasil pemeriksaan laboratorium berhasil disimpan.",
      });
    } catch (err) {
      // Notifikasi ERROR dari server (merah)
      setNotif({
        type: "error",
        message:
          err.response?.data?.message ||
          "Gagal menyimpan hasil pemeriksaan laboratorium.",
      });
    } finally {
      setLoading(false);
    }
  };

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
        <h3 style={{ marginTop: 0, marginBottom: "16px", color: "#0F172A" }}>
          Daftar Permintaan & Hasil Laboratorium
        </h3>

        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            fontSize: "13.5px",
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
              <th style={{ padding: "10px 8px" }}>PASIEN</th>
              <th style={{ padding: "10px 8px" }}>JENIS PEMERIKSAAN</th>
              <th style={{ padding: "10px 8px" }}>HASIL & RUJUKAN</th>
              <th style={{ padding: "10px 8px" }}>STATUS</th>
              <th style={{ padding: "10px 8px", textAlign: "right" }}>AKSI</th>
            </tr>
          </thead>
          <tbody>
            {orders.length === 0 ? (
              <tr>
                <td
                  colSpan="5"
                  style={{
                    textAlign: "center",
                    padding: "24px",
                    color: "#64748B",
                  }}
                >
                  Belum ada permintaan pemeriksaan laboratorium.
                </td>
              </tr>
            ) : (
              orders.map((item) => {
                const isSelesai = item.status_lab === "SELESAI";
                return (
                  <tr
                    key={item.id}
                    style={{ borderBottom: "1px solid #F1F5F9" }}
                  >
                    <td style={{ padding: "12px 8px" }}>
                      <div style={{ fontWeight: 600, color: "#0F172A" }}>
                        {item.nama_pasien}
                      </div>
                      <div style={{ fontSize: "12px", color: "#64748B" }}>
                        {item.no_rm} • {item.no_registrasi}
                      </div>
                    </td>
                    <td style={{ padding: "12px 8px", fontWeight: 600 }}>
                      {item.nama_tindakan}
                    </td>
                    <td style={{ padding: "12px 8px" }}>
                      {isSelesai ? (
                        <div>
                          <strong>{item.hasil_pemeriksaan}</strong>{" "}
                          <span style={{ color: "#64748B", fontSize: "12px" }}>
                            (Rujukan: {item.nilai_rujukan || "-"})
                          </span>
                        </div>
                      ) : (
                        <span style={{ color: "#94A3B8", fontStyle: "italic" }}>
                          Menunggu input hasil
                        </span>
                      )}
                    </td>
                    <td style={{ padding: "12px 8px" }}>
                      <span
                        style={{
                          padding: "4px 10px",
                          borderRadius: "999px",
                          fontSize: "11.5px",
                          fontWeight: 700,
                          backgroundColor: isSelesai ? "#DCFCE7" : "#FEF3C7",
                          color: isSelesai ? "#166534" : "#B45309",
                        }}
                      >
                        {item.status_lab}
                      </span>
                    </td>
                    <td style={{ padding: "12px 8px", textAlign: "right" }}>
                      <button
                        type="button"
                        onClick={() => handleOpenModal(item)}
                        style={{
                          padding: "6px 14px",
                          borderRadius: "6px",
                          border: "none",
                          cursor: "pointer",
                          fontWeight: 600,
                          fontSize: "12.5px",
                          backgroundColor: isSelesai ? "#E2E8F0" : "#0D9488",
                          color: isSelesai ? "#334155" : "#FFFFFF",
                        }}
                      >
                        {isSelesai ? "Edit Hasil" : "Input Hasil"}
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* FORM INPUT HASIL LAB */}
      {selectedOrder && (
        <div
          style={{
            marginTop: "20px",
            background: "#fff",
            borderRadius: "12px",
            padding: "22px",
            border: "1px solid #CBD5E1",
            boxShadow: "0 4px 12px rgba(0,0,0,0.06)",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "14px",
            }}
          >
            <h4 style={{ margin: 0, color: "#0F172A" }}>
              Input Hasil Lab: {selectedOrder.nama_tindakan} —{" "}
              {selectedOrder.nama_pasien}
            </h4>
            <button
              type="button"
              onClick={() => setSelectedOrder(null)}
              style={{
                border: "none",
                background: "transparent",
                fontSize: "16px",
                cursor: "pointer",
                color: "#64748B",
              }}
            >
              ✕
            </button>
          </div>

          <form onSubmit={handleSimpanHasil}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "14px",
                marginBottom: "14px",
              }}
            >
              <div>
                <label
                  style={{
                    display: "block",
                    fontSize: "13px",
                    fontWeight: 600,
                    marginBottom: "4px",
                  }}
                >
                  Hasil Pemeriksaan *
                </label>
                <input
                  type="text"
                  placeholder="Contoh: Hb 13.8 g/dL, Leukosit 7.200 /uL"
                  value={hasil}
                  onChange={(e) => setHasil(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "9px 12px",
                    borderRadius: "6px",
                    border:
                      notif.type === "error" && !hasil.trim()
                        ? "1.5px solid #DC2626"
                        : "1px solid #CBD5E1",
                  }}
                />
              </div>
              <div>
                <label
                  style={{
                    display: "block",
                    fontSize: "13px",
                    fontWeight: 600,
                    marginBottom: "4px",
                  }}
                >
                  Nilai Rujukan Normal
                </label>
                <input
                  type="text"
                  placeholder="Contoh: 12.0 - 16.0 g/dL"
                  value={nilaiRujukan}
                  onChange={(e) => setNilaiRujukan(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "9px 12px",
                    borderRadius: "6px",
                    border: "1px solid #CBD5E1",
                  }}
                />
              </div>
            </div>

            <div style={{ display: "flex", gap: "10px" }}>
              <button
                type="submit"
                disabled={loading}
                style={{
                  padding: "9px 18px",
                  borderRadius: "8px",
                  border: "none",
                  backgroundColor: "#0D9488",
                  color: "#FFFFFF",
                  fontWeight: 700,
                  cursor: loading ? "not-allowed" : "pointer",
                }}
              >
                {loading ? "Menyimpan..." : "Simpan Hasil Lab"}
              </button>
              <button
                type="button"
                onClick={() => setSelectedOrder(null)}
                style={{
                  padding: "9px 16px",
                  borderRadius: "8px",
                  border: "1px solid #CBD5E1",
                  backgroundColor: "#FFFFFF",
                  color: "#475569",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Batal
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
