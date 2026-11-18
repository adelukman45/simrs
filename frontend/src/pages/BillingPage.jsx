import React, { useEffect, useState } from "react";
import { yiiApi } from "../api/client";
import { useAuth } from "../context/AuthContext";

export default function BillingPage() {
  const { user } = useAuth();
  const [billings, setBillings] = useState([]);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("ALL");
  const [selectedId, setSelectedId] = useState(null);
  const [detail, setDetail] = useState(null);

  const [metodeBayar, setMetodeBayar] = useState("TUNAI");
  const [jumlahBayar, setJumlahBayar] = useState("");
  const [notif, setNotif] = useState({ type: "", message: "" });
  const [loadingBayar, setLoadingBayar] = useState(false);

  // State Modal Koreksi Pembayaran
  const [showKoreksiModal, setShowKoreksiModal] = useState(false);
  const [alasanKoreksi, setAlasanKoreksi] = useState("");
  const [errorModalKoreksi, setErrorModalKoreksi] = useState("");

  const fetchBillings = async () => {
    try {
      const res = await yiiApi.get("/billing");
      setBillings(res.data?.data || []);
    } catch (err) {
      setNotif({
        type: "error",
        message:
          err.response?.data?.message || "Gagal memuat daftar tagihan pasien.",
      });
    }
  };

  useEffect(() => {
    fetchBillings();
  }, []);

  const handleSelectBilling = async (id) => {
    setNotif({ type: "", message: "" });
    setSelectedId(id);
    try {
      const res = await yiiApi.get(`/billing/${id}`);
      const d = res.data?.data;
      setDetail(d);
      const sisa = Number(d?.billing?.sisa_tagihan ?? d?.sisa_tagihan ?? 0);
      setJumlahBayar(sisa > 0 ? String(sisa) : "");
    } catch (err) {
      setNotif({
        type: "error",
        message:
          err.response?.data?.message || "Gagal membuka rincian tagihan.",
      });
    }
  };

  const handleBayar = async (e) => {
    e.preventDefault();
    if (!selectedId) return;

    const nominal = Number(jumlahBayar);
    if (!nominal || nominal <= 0) {
      setNotif({
        type: "error",
        message: "Nominal pembayaran harus lebih dari 0.",
      });
      return;
    }

    setLoadingBayar(true);
    setNotif({ type: "", message: "" });

    try {
      const idempotencyKey = `PAY-${selectedId}-${Date.now()}`;
      const res = await yiiApi.post(`/billing/${selectedId}/bayar`, {
        metode_pembayaran: metodeBayar,
        jumlah_bayar: nominal,
        idempotency_key: idempotencyKey,
      });

      await fetchBillings();
      await handleSelectBilling(selectedId);

      setNotif({
        type: "success",
        message: res.data?.message || "Pembayaran berhasil dicatat.",
      });
    } catch (err) {
      setNotif({
        type: "error",
        message: err.response?.data?.message || "Gagal memproses pembayaran.",
      });
    } finally {
      setLoadingBayar(false);
    }
  };

  const openKoreksiModal = () => {
    setAlasanKoreksi("");
    setErrorModalKoreksi("");
    setShowKoreksiModal(true);
  };

  const handleSubmitKoreksi = async (e) => {
    e.preventDefault();
    if (!selectedId) return;

    if (!alasanKoreksi.trim()) {
      setErrorModalKoreksi(
        "Harap pilih atau isi alasan koreksi pembayaran terlebih dahulu.",
      );
      return;
    }

    setLoadingBayar(true);
    setErrorModalKoreksi("");
    setNotif({ type: "", message: "" });

    try {
      const res = await yiiApi.post(`/billing/${selectedId}/koreksi`, {
        alasan: alasanKoreksi.trim(),
      });
      setShowKoreksiModal(false);
      await fetchBillings();
      await handleSelectBilling(selectedId);
      setNotif({
        type: "success",
        message: res.data?.message || "Pembayaran berhasil dikoreksi.",
      });
    } catch (err) {
      setShowKoreksiModal(false);
      setNotif({
        type: "error",
        message: err.response?.data?.message || "Gagal mengoreksi pembayaran.",
      });
    } finally {
      setLoadingBayar(false);
    }
  };

  const formatRupiah = (angka) =>
    `Rp ${Number(angka || 0).toLocaleString("id-ID")}`;

  const filteredBillings = billings.filter((b) => {
    if (filterStatus === "LUNAS" && b.status_pembayaran !== "LUNAS")
      return false;
    if (filterStatus === "BELUM_DIBAYAR" && b.status_pembayaran === "LUNAS")
      return false;
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      (b.no_invoice || "").toLowerCase().includes(q) ||
      (b.nama_pasien || "").toLowerCase().includes(q) ||
      (b.no_rm || "").toLowerCase().includes(q)
    );
  });

  const billObj = detail?.billing || detail || {};
  const itemsList = detail?.items || detail?.billing_items || [];
  const paymentsList = detail?.pembayaran || detail?.payments || [];
  const isLunas = billObj.status_pembayaran === "LUNAS";

  // Ambil langsung dari AuthContext (user yang sedang login saat ini)
  const namaPetugasKasir =
    user?.nama_lengkap ||
    user?.name ||
    user?.username ||
    (paymentsList.length > 0 &&
      paymentsList[paymentsList.length - 1]?.nama_kasir) ||
    "Petugas Kasir";

  const presetAlasan = [
    "Salah pilih metode pembayaran",
    "Salah input nominal bayar",
    "Revisi tindakan / resep dari dokter",
  ];

  return (
    <div style={{ padding: "20px" }}>
      <style>{`
        @media print {
          body * {
            visibility: hidden !important;
          }
          #printable-invoice-area,
          #printable-invoice-area * {
            visibility: visible !important;
          }
          #printable-invoice-area {
            position: fixed !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            max-width: 100% !important;
            margin: 0 !important;
            padding: 24px !important;
            box-shadow: none !important;
            border: none !important;
            background: #FFFFFF !important;
            z-index: 99999 !important;
          }
          .no-print {
            display: none !important;
          }
          .print-only-header {
            display: block !important;
          }
        }
      `}</style>

      {notif.message && (
        <div
          className="no-print"
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
          display: "grid",
          gridTemplateColumns: "minmax(440px, 490px) 1fr",
          gap: "20px",
          alignItems: "start",
        }}
      >
        {/* PANEL KIRI: DAFTAR TAGIHAN PASIEN */}
        <div
          className="no-print"
          style={{
            background: "#fff",
            borderRadius: "12px",
            padding: "18px",
            boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "12px",
            }}
          >
            <h3 style={{ margin: 0, fontSize: "16px", color: "#0F172A" }}>
              Daftar Tagihan Pasien
            </h3>
            <div
              style={{
                display: "flex",
                gap: "4px",
                background: "#F1F5F9",
                padding: "3px",
                borderRadius: "7px",
              }}
            >
              {[
                { key: "ALL", label: "Semua" },
                { key: "BELUM_DIBAYAR", label: "Belum Lunas" },
                { key: "LUNAS", label: "Lunas" },
              ].map((t) => (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setFilterStatus(t.key)}
                  style={{
                    padding: "4px 9px",
                    borderRadius: "5px",
                    border: "none",
                    fontSize: "11.5px",
                    fontWeight: 600,
                    cursor: "pointer",
                    backgroundColor:
                      filterStatus === t.key ? "#0D9488" : "transparent",
                    color: filterStatus === t.key ? "#FFFFFF" : "#475569",
                  }}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <input
            type="text"
            placeholder="Cari No. Invoice, nama pasien, atau No. RM..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              width: "100%",
              padding: "8px 12px",
              borderRadius: "8px",
              border: "1px solid #CBD5E1",
              fontSize: "13px",
              marginBottom: "12px",
              boxSizing: "border-box",
            }}
          />

          <div style={{ overflowX: "auto" }}>
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                fontSize: "12.5px",
              }}
            >
              <thead>
                <tr
                  style={{
                    borderBottom: "1px solid #E2E8F0",
                    textAlign: "left",
                    color: "#64748B",
                    fontSize: "11px",
                  }}
                >
                  <th style={{ padding: "8px 6px" }}>INVOICE & PASIEN</th>
                  <th style={{ padding: "8px 6px", textAlign: "right" }}>
                    TOTAL
                  </th>
                  <th style={{ padding: "8px 6px", textAlign: "center" }}>
                    STATUS
                  </th>
                  <th style={{ padding: "8px 6px", textAlign: "right" }}>
                    AKSI
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredBillings.length === 0 ? (
                  <tr>
                    <td
                      colSpan="4"
                      style={{
                        textAlign: "center",
                        padding: "24px",
                        color: "#64748B",
                      }}
                    >
                      Tidak ada data tagihan pasien.
                    </td>
                  </tr>
                ) : (
                  filteredBillings.map((item) => {
                    const lunas = item.status_pembayaran === "LUNAS";
                    const isSelected = selectedId === item.id;
                    return (
                      <tr
                        key={item.id}
                        style={{
                          borderBottom: "1px solid #F1F5F9",
                          backgroundColor: isSelected
                            ? "#F0FDFA"
                            : "transparent",
                        }}
                      >
                        <td style={{ padding: "10px 6px" }}>
                          <div
                            style={{
                              fontWeight: 700,
                              color: "#0F172A",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {item.no_invoice}
                          </div>
                          <div
                            style={{
                              fontWeight: 600,
                              color: "#334155",
                              marginTop: "2px",
                            }}
                          >
                            {item.nama_pasien}
                          </div>
                          <div style={{ fontSize: "11px", color: "#94A3B8" }}>
                            {item.tanggal_kunjungan || ""}
                          </div>
                        </td>
                        <td
                          style={{
                            padding: "10px 6px",
                            textAlign: "right",
                            fontWeight: 700,
                            color: "#0F172A",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {formatRupiah(item.total_tagihan)}
                        </td>
                        <td
                          style={{
                            padding: "10px 6px",
                            textAlign: "center",
                            whiteSpace: "nowrap",
                          }}
                        >
                          <span
                            style={{
                              display: "inline-block",
                              padding: "3px 8px",
                              borderRadius: "999px",
                              fontSize: "10.5px",
                              fontWeight: 700,
                              backgroundColor: lunas ? "#DCFCE7" : "#FEF3C7",
                              color: lunas ? "#166534" : "#B45309",
                            }}
                          >
                            {lunas ? "LUNAS" : "BELUM LUNAS"}
                          </span>
                        </td>
                        <td
                          style={{
                            padding: "10px 6px",
                            textAlign: "right",
                            whiteSpace: "nowrap",
                          }}
                        >
                          <button
                            type="button"
                            onClick={() => handleSelectBilling(item.id)}
                            style={{
                              padding: "6px 12px",
                              borderRadius: "6px",
                              border: "none",
                              backgroundColor: "#0D9488",
                              color: "#FFFFFF",
                              fontWeight: 600,
                              fontSize: "12px",
                              cursor: "pointer",
                            }}
                          >
                            Detail
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* PANEL KANAN: AREA INVOICE */}
        <div
          id="printable-invoice-area"
          style={{
            background: "#fff",
            borderRadius: "12px",
            padding: "22px",
            boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
          }}
        >
          {!selectedId || !detail ? (
            <div
              className="no-print"
              style={{
                textAlign: "center",
                padding: "48px 20px",
                color: "#64748B",
                fontSize: "13.5px",
              }}
            >
              Pilih tagihan pasien di sebelah kiri untuk melihat rincian biaya,
              memproses pembayaran, atau mencetak kwitansi.
            </div>
          ) : (
            <div>
              {/* KOP INVOICE KHUSUS SAAT DICETAK */}
              <div
                className="print-only-header"
                style={{
                  display: "none",
                  borderBottom: "2px solid #0F766E",
                  paddingBottom: "12px",
                  marginBottom: "16px",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <div>
                    <div
                      style={{
                        fontSize: "18px",
                        fontWeight: 800,
                        color: "#0F766E",
                      }}
                    >
                      KLINIK / RS INOVA MEDIKA
                    </div>
                    <div style={{ fontSize: "12px", color: "#475569" }}>
                      Sistem Informasi Manajemen Rumah Sakit (SIMRS Rawat Jalan)
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div
                      style={{
                        fontSize: "16px",
                        fontWeight: 800,
                        color: "#0F172A",
                      }}
                    >
                      INVOICE & KWITANSI
                    </div>
                    <div
                      style={{
                        fontSize: "12px",
                        fontWeight: 700,
                        color: isLunas ? "#16A34A" : "#DC2626",
                      }}
                    >
                      STATUS: {isLunas ? "LUNAS" : "BELUM LUNAS"}
                    </div>
                  </div>
                </div>
              </div>

              {/* HEADER IDENTITAS PASIEN */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  borderBottom: "1px solid #E2E8F0",
                  paddingBottom: "14px",
                  marginBottom: "16px",
                }}
              >
                <div>
                  <div
                    style={{
                      fontSize: "12px",
                      fontWeight: 700,
                      color: "#0D9488",
                    }}
                  >
                    {billObj.no_invoice}
                  </div>
                  <h2
                    style={{
                      margin: "2px 0 4px",
                      fontSize: "18px",
                      color: "#0F172A",
                    }}
                  >
                    {billObj.nama_pasien} ({billObj.no_rm})
                  </h2>
                  <div style={{ fontSize: "12.5px", color: "#64748B" }}>
                    No. Reg: {billObj.no_registrasi} • {billObj.nama_poli} •{" "}
                    {billObj.nama_dokter}
                  </div>
                </div>
                <div
                  className="no-print"
                  style={{ display: "flex", gap: "8px", alignItems: "center" }}
                >
                  <button
                    type="button"
                    onClick={() => window.print()}
                    style={{
                      padding: "7px 12px",
                      borderRadius: "6px",
                      border: "1px solid #CBD5E1",
                      backgroundColor: "#F8FAFC",
                      color: "#334155",
                      fontWeight: 600,
                      fontSize: "12px",
                      cursor: "pointer",
                    }}
                  >
                    🖨 Cetak Invoice
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedId(null);
                      setDetail(null);
                    }}
                    style={{
                      padding: "7px 10px",
                      borderRadius: "6px",
                      border: "1px solid #CBD5E1",
                      backgroundColor: "#FFFFFF",
                      color: "#64748B",
                      fontWeight: 600,
                      fontSize: "12px",
                      cursor: "pointer",
                    }}
                  >
                    ✕
                  </button>
                </div>
              </div>

              {/* TABEL KOMPONEN BIAYA */}
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  fontSize: "13px",
                  marginBottom: "16px",
                }}
              >
                <thead>
                  <tr
                    style={{
                      borderBottom: "1px solid #E2E8F0",
                      backgroundColor: "#F8FAFC",
                      textAlign: "left",
                      color: "#64748B",
                    }}
                  >
                    <th style={{ padding: "8px" }}>KATEGORI</th>
                    <th style={{ padding: "8px" }}>DESKRIPSI LAYANAN</th>
                    <th style={{ padding: "8px", textAlign: "center" }}>QTY</th>
                    <th style={{ padding: "8px", textAlign: "right" }}>
                      HARGA
                    </th>
                    <th style={{ padding: "8px", textAlign: "right" }}>
                      SUBTOTAL
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {itemsList.map((it, i) => (
                    <tr key={i} style={{ borderBottom: "1px solid #F1F5F9" }}>
                      <td
                        style={{
                          padding: "8px",
                          fontWeight: 600,
                          fontSize: "11.5px",
                          color: "#0F766E",
                        }}
                      >
                        {it.jenis_item}
                      </td>
                      <td style={{ padding: "8px" }}>{it.deskripsi}</td>
                      <td style={{ padding: "8px", textAlign: "center" }}>
                        {it.jumlah}
                      </td>
                      <td
                        style={{
                          padding: "8px",
                          textAlign: "right",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {formatRupiah(it.harga_satuan)}
                      </td>
                      <td
                        style={{
                          padding: "8px",
                          textAlign: "right",
                          fontWeight: 600,
                          whiteSpace: "nowrap",
                        }}
                      >
                        {formatRupiah(it.subtotal)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* RINGKASAN TOTAL */}
              <div
                style={{
                  backgroundColor: "#F8FAFC",
                  borderRadius: "10px",
                  padding: "14px 16px",
                  marginBottom: "18px",
                  border: "1px solid #E2E8F0",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    marginBottom: "6px",
                    fontSize: "13.5px",
                  }}
                >
                  <span style={{ color: "#475569" }}>Total Tagihan</span>
                  <strong>{formatRupiah(billObj.total_tagihan)}</strong>
                </div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    marginBottom: "6px",
                    fontSize: "13.5px",
                  }}
                >
                  <span style={{ color: "#475569" }}>Sudah Dibayar</span>
                  <strong style={{ color: "#16A34A" }}>
                    {formatRupiah(billObj.total_dibayar)}
                  </strong>
                </div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    borderTop: "1px dashed #CBD5E1",
                    paddingTop: "8px",
                    fontSize: "15px",
                  }}
                >
                  <span style={{ fontWeight: 700, color: "#0F172A" }}>
                    Sisa Tagihan
                  </span>
                  <strong style={{ color: isLunas ? "#16A34A" : "#DC2626" }}>
                    {formatRupiah(billObj.sisa_tagihan)}
                  </strong>
                </div>
              </div>

              {/* FORM PELUNASAN */}
              {!isLunas && (
                <form
                  className="no-print"
                  onSubmit={handleBayar}
                  style={{
                    border: "1px solid #CCFBF1",
                    backgroundColor: "#F0FDFA",
                    borderRadius: "10px",
                    padding: "16px",
                    marginBottom: "18px",
                  }}
                >
                  <h4
                    style={{
                      margin: "0 0 12px",
                      color: "#0F766E",
                      fontSize: "14px",
                    }}
                  >
                    Proses Pembayaran Kasir
                  </h4>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr auto",
                      gap: "10px",
                      alignItems: "end",
                    }}
                  >
                    <div>
                      <label
                        style={{
                          display: "block",
                          fontSize: "12px",
                          fontWeight: 600,
                          marginBottom: "4px",
                        }}
                      >
                        Metode Pembayaran
                      </label>
                      <select
                        value={metodeBayar}
                        onChange={(e) => setMetodeBayar(e.target.value)}
                        style={{
                          width: "100%",
                          padding: "9px",
                          borderRadius: "6px",
                          border: "1px solid #CBD5E1",
                          background: "#fff",
                        }}
                      >
                        <option value="TUNAI">TUNAI</option>
                        <option value="QRIS">QRIS</option>
                        <option value="DEBIT">DEBIT</option>
                        <option value="TRANSFER">TRANSFER</option>
                        <option value="BPJS">BPJS</option>
                      </select>
                    </div>
                    <div>
                      <label
                        style={{
                          display: "block",
                          fontSize: "12px",
                          fontWeight: 600,
                          marginBottom: "4px",
                        }}
                      >
                        Nominal Bayar (Rp)
                      </label>
                      <input
                        type="number"
                        required
                        min="1"
                        value={jumlahBayar}
                        onChange={(e) => setJumlahBayar(e.target.value)}
                        style={{
                          width: "100%",
                          padding: "9px",
                          borderRadius: "6px",
                          border: "1px solid #CBD5E1",
                          boxSizing: "border-box",
                        }}
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={loadingBayar}
                      style={{
                        padding: "9px 18px",
                        borderRadius: "6px",
                        border: "none",
                        backgroundColor: "#0D9488",
                        color: "#FFFFFF",
                        fontWeight: 700,
                        cursor: loadingBayar ? "not-allowed" : "pointer",
                        height: "38px",
                      }}
                    >
                      {loadingBayar ? "Memproses..." : "Bayar & Lunasi"}
                    </button>
                  </div>
                </form>
              )}

              {/* RIWAYAT KWITANSI PEMBAYARAN + TOMBOL KOREKSI */}
              {paymentsList.length > 0 && (
                <div>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginBottom: "8px",
                    }}
                  >
                    <h4
                      style={{
                        margin: 0,
                        fontSize: "13.5px",
                        color: "#0F172A",
                      }}
                    >
                      Riwayat Kwitansi Pembayaran
                    </h4>
                    <button
                      type="button"
                      className="no-print"
                      disabled={loadingBayar}
                      onClick={openKoreksiModal}
                      style={{
                        padding: "5px 10px",
                        borderRadius: "6px",
                        border: "1px solid #FCA5A5",
                        backgroundColor: "#FEF2F2",
                        color: "#DC2626",
                        fontWeight: 600,
                        fontSize: "11.5px",
                        cursor: "pointer",
                      }}
                    >
                      ↺ Koreksi / Ulangi Pembayaran
                    </button>
                  </div>
                  <table
                    style={{
                      width: "100%",
                      borderCollapse: "collapse",
                      fontSize: "12.5px",
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
                        <th style={{ padding: "6px" }}>NO. KWITANSI</th>
                        <th style={{ padding: "6px" }}>METODE</th>
                        <th style={{ padding: "6px" }}>WAKTU</th>
                        <th style={{ padding: "6px", textAlign: "right" }}>
                          JUMLAH
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {paymentsList.map((p, idx) => (
                        <tr
                          key={idx}
                          style={{ borderBottom: "1px solid #F1F5F9" }}
                        >
                          <td style={{ padding: "6px", fontWeight: 600 }}>
                            {p.no_kwitansi}
                          </td>
                          <td style={{ padding: "6px" }}>
                            {p.metode_pembayaran}
                          </td>
                          <td style={{ padding: "6px", color: "#64748B" }}>
                            {p.waktu_bayar}
                          </td>
                          <td
                            style={{
                              padding: "6px",
                              textAlign: "right",
                              fontWeight: 700,
                              color: "#16A34A",
                            }}
                          >
                            {formatRupiah(p.jumlah_bayar)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* FOOTER TANDA TANGAN OTOMATIS NAMA KASIR DARI USEAUTH */}
              <div
                className="print-only-header"
                style={{
                  display: "none",
                  marginTop: "36px",
                  paddingTop: "12px",
                  borderTop: "1px dashed #CBD5E1",
                  fontSize: "12px",
                  color: "#475569",
                }}
              >
                <div
                  style={{ display: "flex", justifyContent: "space-between" }}
                >
                  <div>
                    Terima kasih atas kepercayaan Anda berobat di Inova Medika.
                  </div>
                  <div style={{ textAlign: "center", minWidth: "180px" }}>
                    <div>Petugas Kasir,</div>
                    <div
                      style={{
                        marginTop: "48px",
                        fontWeight: 700,
                        color: "#0F172A",
                        borderTop: "1px solid #94A3B8",
                        paddingTop: "4px",
                      }}
                    >
                      ( {namaPetugasKasir} )
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* MODAL DIALOG KOREKSI PEMBAYARAN */}
      {showKoreksiModal && (
        <div
          className="no-print"
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(15, 23, 42, 0.55)",
            backdropFilter: "blur(2px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
            padding: "16px",
          }}
        >
          <div
            style={{
              backgroundColor: "#FFFFFF",
              borderRadius: "14px",
              width: "100%",
              maxWidth: "460px",
              padding: "22px",
              boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.15)",
              border: "1px solid #E2E8F0",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "10px",
              }}
            >
              <div
                style={{ display: "flex", alignItems: "center", gap: "8px" }}
              >
                <span
                  style={{
                    width: "28px",
                    height: "28px",
                    borderRadius: "8px",
                    backgroundColor: "#FEE2E2",
                    color: "#DC2626",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontWeight: 800,
                    fontSize: "14px",
                  }}
                >
                  ↺
                </span>
                <h3 style={{ margin: 0, fontSize: "16px", color: "#0F172A" }}>
                  Koreksi / Batalkan Pembayaran
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowKoreksiModal(false)}
                style={{
                  border: "none",
                  background: "transparent",
                  fontSize: "16px",
                  color: "#64748B",
                  cursor: "pointer",
                }}
              >
                ✕
              </button>
            </div>

            <p
              style={{
                margin: "0 0 14px",
                fontSize: "13px",
                color: "#475569",
                lineHeight: 1.5,
              }}
            >
              Tagihan <strong>{billObj.no_invoice}</strong> (
              {billObj.nama_pasien}) akan dibuka kembali agar metode pembayaran
              atau rincian medis dokter dapat diperbaiki.
            </p>

            <div style={{ marginBottom: "12px" }}>
              <div
                style={{
                  fontSize: "11.5px",
                  fontWeight: 600,
                  color: "#64748B",
                  marginBottom: "6px",
                }}
              >
                Pilih alasan cepat:
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                {presetAlasan.map((item) => {
                  const active = alasanKoreksi === item;
                  return (
                    <button
                      key={item}
                      type="button"
                      onClick={() => {
                        setAlasanKoreksi(item);
                        setErrorModalKoreksi("");
                      }}
                      style={{
                        padding: "5px 10px",
                        borderRadius: "999px",
                        fontSize: "11.5px",
                        fontWeight: 600,
                        cursor: "pointer",
                        border: active
                          ? "1px solid #0D9488"
                          : "1px solid #CBD5E1",
                        backgroundColor: active ? "#F0FDFA" : "#F8FAFC",
                        color: active ? "#0F766E" : "#334155",
                      }}
                    >
                      {item}
                    </button>
                  );
                })}
              </div>
            </div>

            <form onSubmit={handleSubmitKoreksi}>
              <label
                style={{
                  display: "block",
                  fontSize: "12.5px",
                  fontWeight: 600,
                  color: "#0F172A",
                  marginBottom: "6px",
                }}
              >
                Keterangan / Alasan Koreksi *
              </label>
              <textarea
                rows="3"
                placeholder="Tuliskan alasan pembatalan/koreksi untuk dicatat di Audit Log..."
                value={alasanKoreksi}
                onChange={(e) => {
                  setAlasanKoreksi(e.target.value);
                  setErrorModalKoreksi("");
                }}
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  borderRadius: "8px",
                  border: errorModalKoreksi
                    ? "1.5px solid #DC2626"
                    : "1px solid #CBD5E1",
                  fontSize: "13px",
                  boxSizing: "border-box",
                  resize: "vertical",
                  fontFamily: "inherit",
                }}
              />

              {errorModalKoreksi && (
                <div
                  style={{
                    color: "#DC2626",
                    fontSize: "12px",
                    fontWeight: 600,
                    marginTop: "6px",
                  }}
                >
                  ⚠ {errorModalKoreksi}
                </div>
              )}

              <div
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  gap: "10px",
                  marginTop: "18px",
                }}
              >
                <button
                  type="button"
                  onClick={() => setShowKoreksiModal(false)}
                  style={{
                    padding: "8px 16px",
                    borderRadius: "8px",
                    border: "1px solid #CBD5E1",
                    backgroundColor: "#FFFFFF",
                    color: "#475569",
                    fontWeight: 600,
                    fontSize: "13px",
                    cursor: "pointer",
                  }}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={loadingBayar}
                  style={{
                    padding: "8px 16px",
                    borderRadius: "8px",
                    border: "none",
                    backgroundColor: "#DC2626",
                    color: "#FFFFFF",
                    fontWeight: 700,
                    fontSize: "13px",
                    cursor: loadingBayar ? "not-allowed" : "pointer",
                  }}
                >
                  {loadingBayar ? "Memproses..." : "Konfirmasi Koreksi"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
