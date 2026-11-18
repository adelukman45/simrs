import React, { useEffect, useState } from "react";
import { yiiApi } from "../api/client";

export default function PemeriksaanPage() {
  const [antrean, setAntrean] = useState([]);
  const [activeTab, setActiveTab] = useState("MENUNGGU"); // 'MENUNGGU' | 'SELESAI'
  const [searchSelesai, setSearchSelesai] = useState("");
  const [selectedId, setSelectedId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [masterTindakan, setMasterTindakan] = useState([]);
  const [masterLab, setMasterLab] = useState([]);
  const [masterObat, setMasterObat] = useState([]);

  const [notif, setNotif] = useState({ type: "", message: "" });
  const [loadingSave, setLoadingSave] = useState(false);

  const [form, setForm] = useState({
    keluhan_utama: "",
    anamnesis: "",
    tekanan_darah: "",
    nadi: "",
    suhu_tubuh: "",
    pemeriksaan_fisik: "",
    diagnosis_utama: "",
    catatan_dokter: "",
  });
  const [tindakanList, setTindakanList] = useState([]);
  const [labList, setLabList] = useState([]);
  const [resepList, setResepList] = useState([]);

  const fetchInitialData = async () => {
    const [resAntrean, resMaster, resTindakanAlt, resObatAlt] =
      await Promise.allSettled([
        yiiApi.get("/pendaftaran?tanggal=ALL"),
        yiiApi.get("/pemeriksaan/master"),
        yiiApi.get("/master/tindakan-medis"),
        yiiApi.get("/master/obat"),
      ]);

    if (resAntrean.status === "fulfilled") {
      const rawA = resAntrean.value.data?.data ?? resAntrean.value.data ?? [];
      setAntrean(Array.isArray(rawA) ? rawA : rawA.items || []);
    }

    if (resMaster.status === "fulfilled" && resMaster.value.data?.data) {
      const mData = resMaster.value.data.data;
      const listT = Array.isArray(mData.tindakan) ? mData.tindakan : [];
      const listO = Array.isArray(mData.obat) ? mData.obat : [];

      setMasterTindakan(
        listT.filter((t) => (t.kategori || "").toUpperCase() === "POLIKLINIK"),
      );
      setMasterLab(
        listT.filter(
          (t) => (t.kategori || "").toUpperCase() === "LABORATORIUM",
        ),
      );
      setMasterObat(listO);
      return;
    }

    if (resTindakanAlt.status === "fulfilled") {
      const rawT =
        resTindakanAlt.value.data?.data ?? resTindakanAlt.value.data ?? [];
      const listT = Array.isArray(rawT) ? rawT : rawT.items || [];
      setMasterTindakan(
        listT.filter((t) => (t.kategori || "").toUpperCase() === "POLIKLINIK"),
      );
      setMasterLab(
        listT.filter(
          (t) => (t.kategori || "").toUpperCase() === "LABORATORIUM",
        ),
      );
    }

    if (resObatAlt.status === "fulfilled") {
      const rawO = resObatAlt.value.data?.data ?? resObatAlt.value.data ?? [];
      const listO = Array.isArray(rawO) ? rawO : rawO.items || [];
      setMasterObat(listO);
    }
  };

  useEffect(() => {
    fetchInitialData();
  }, []);

  // Tab 1: Antrean menunggu -> urut berdasarkan nomor antrean (1, 2, 3...)
  const daftarMenunggu = antrean
    .filter(
      (item) =>
        item.status_kunjungan !== "SELESAI_PERIKSA" &&
        item.status_kunjungan !== "SELESAI",
    )
    .sort((a, b) => Number(a.no_antrean || 0) - Number(b.no_antrean || 0));

  // Tab 2: Sudah diperiksa -> dilengkapi filter pencarian
  const daftarSudahPeriksa = antrean.filter(
    (item) =>
      item.status_kunjungan === "SELESAI_PERIKSA" ||
      item.status_kunjungan === "SELESAI",
  );

  const daftarSudahPeriksaFiltered = daftarSudahPeriksa.filter((item) => {
    if (!searchSelesai.trim()) return true;
    const q = searchSelesai.toLowerCase();
    return (
      (item.nama_pasien || "").toLowerCase().includes(q) ||
      (item.no_rm || "").toLowerCase().includes(q) ||
      (item.kode_antrean || "").toLowerCase().includes(q) ||
      (item.nama_poli || "").toLowerCase().includes(q)
    );
  });

  const listDitampilkan =
    activeTab === "MENUNGGU" ? daftarMenunggu : daftarSudahPeriksaFiltered;

  const handleSelectKunjungan = async (kunjunganId) => {
    setNotif({ type: "", message: "" });
    setSelectedId(kunjunganId);
    try {
      const res = await yiiApi.get(`/pemeriksaan/${kunjunganId}`);
      const d = res.data?.data;
      setDetail(d);

      const emr = d?.pemeriksaan_medis || {};
      setForm({
        keluhan_utama: emr.keluhan_utama || "",
        anamnesis: emr.anamnesis || "",
        tekanan_darah: emr.tekanan_darah || "120/80",
        nadi: emr.nadi || "80",
        suhu_tubuh: emr.suhu_tubuh || "36.5",
        pemeriksaan_fisik: emr.pemeriksaan_fisik || "",
        diagnosis_utama: emr.diagnosis_utama || "",
        catatan_dokter: emr.catatan_dokter || "",
      });

      setTindakanList(
        (d?.tindakan || []).map((t) => ({
          tindakan_id: t.tindakan_id,
          jumlah: t.jumlah || 1,
        })),
      );
      setLabList([]);
      setResepList(
        (d?.resep?.items || []).map((r) => ({
          obat_id: r.obat_id,
          dosis: r.dosis || "3x1",
          frekuensi: r.frekuensi || "Sesudah makan",
          jumlah: r.jumlah || 1,
        })),
      );
    } catch (err) {
      setNotif({
        type: "error",
        message:
          err.response?.data?.message ||
          "Gagal membuka detail pemeriksaan pasien.",
      });
    }
  };

  const handleCloseCard = () => {
    setSelectedId(null);
    setDetail(null);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!selectedId) return;

    setLoadingSave(true);
    setNotif({ type: "", message: "" });

    try {
      const payload = {
        ...form,
        tindakan: tindakanList.filter((t) => t.tindakan_id),
        lab_orders: labList.filter((l) => l.tindakan_id),
        resep: resepList.filter((r) => r.obat_id),
      };

      const res = await yiiApi.post(`/pemeriksaan/${selectedId}`, payload);
      const namaPasien = detail?.kunjungan?.nama_pasien || "Pasien";

      await fetchInitialData();
      setSelectedId(null);
      setDetail(null);

      setNotif({
        type: "success",
        message:
          res.data?.message ||
          `Pemeriksaan medis untuk ${namaPasien} berhasil disimpan dan dipindahkan ke daftar Sudah Diperiksa.`,
      });

      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      setNotif({
        type: "error",
        message:
          err.response?.data?.message || "Gagal menyimpan pemeriksaan medis.",
      });
    } finally {
      setLoadingSave(false);
    }
  };

  return (
    <div style={{ padding: "20px" }}>
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
          display: "grid",
          gridTemplateColumns: selectedId ? "360px 1fr" : "1fr",
          gap: "20px",
          alignItems: "start",
        }}
      >
        {/* PANEL KIRI: PEMISAH ANTREAN VS SUDAH DIPERIKSA */}
        <div
          style={{
            background: "#fff",
            borderRadius: "12px",
            padding: "18px",
            boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
          }}
        >
          <h3 style={{ marginTop: 0, marginBottom: "12px", color: "#0F172A" }}>
            Daftar Kunjungan Pasien
          </h3>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "6px",
              backgroundColor: "#F1F5F9",
              padding: "4px",
              borderRadius: "8px",
              marginBottom: "14px",
            }}
          >
            <button
              type="button"
              onClick={() => {
                setActiveTab("MENUNGGU");
                handleCloseCard();
              }}
              style={{
                padding: "8px 10px",
                borderRadius: "6px",
                border: "none",
                cursor: "pointer",
                fontWeight: 700,
                fontSize: "12.5px",
                backgroundColor:
                  activeTab === "MENUNGGU" ? "#0D9488" : "transparent",
                color: activeTab === "MENUNGGU" ? "#FFFFFF" : "#475569",
              }}
            >
              Antrean ({daftarMenunggu.length})
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveTab("SELESAI");
                handleCloseCard();
              }}
              style={{
                padding: "8px 10px",
                borderRadius: "6px",
                border: "none",
                cursor: "pointer",
                fontWeight: 700,
                fontSize: "12.5px",
                backgroundColor:
                  activeTab === "SELESAI" ? "#0F766E" : "transparent",
                color: activeTab === "SELESAI" ? "#FFFFFF" : "#475569",
              }}
            >
              Sudah Diperiksa ({daftarSudahPeriksa.length})
            </button>
          </div>

          {activeTab === "SELESAI" && (
            <div style={{ marginBottom: "12px" }}>
              <input
                type="text"
                placeholder="Cari nama pasien, No. RM, kode antrean, atau poli..."
                value={searchSelesai}
                onChange={(e) => setSearchSelesai(e.target.value)}
                style={{
                  width: "100%",
                  padding: "9px 12px",
                  borderRadius: "8px",
                  border: "1px solid #CBD5E1",
                  fontSize: "13px",
                  boxSizing: "border-box",
                }}
              />
            </div>
          )}

          {listDitampilkan.length === 0 ? (
            <div
              style={{
                textAlign: "center",
                padding: "28px 12px",
                color: "#64748B",
                fontSize: "13px",
                background: "#F8FAFC",
                borderRadius: "8px",
              }}
            >
              {activeTab === "MENUNGGU"
                ? "Tidak ada pasien yang sedang menunggu pemeriksaan."
                : searchSelesai
                  ? "Pasien yang dicari tidak ditemukan."
                  : "Belum ada pasien yang selesai diperiksa."}
            </div>
          ) : (
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                fontSize: "13px",
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
                  <th style={{ padding: "8px 4px" }}>ANTREAN</th>
                  <th style={{ padding: "8px 4px" }}>PASIEN</th>
                  <th style={{ padding: "8px 4px", textAlign: "right" }}>
                    AKSI
                  </th>
                </tr>
              </thead>
              <tbody>
                {listDitampilkan.map((item) => {
                  const isSelected = selectedId === item.id;
                  const sudahPeriksa = activeTab === "SELESAI";
                  return (
                    <tr
                      key={item.id}
                      style={{
                        borderBottom: "1px solid #F1F5F9",
                        backgroundColor: isSelected ? "#F0FDFA" : "transparent",
                      }}
                    >
                      <td
                        style={{
                          padding: "10px 4px",
                          fontWeight: 700,
                          color: "#0F766E",
                        }}
                      >
                        {item.kode_antrean}
                        <div
                          style={{
                            fontSize: "10.5px",
                            fontWeight: 600,
                            marginTop: "2px",
                            color: sudahPeriksa ? "#16A34A" : "#D97706",
                          }}
                        >
                          {sudahPeriksa ? "SELESAI" : "MENUNGGU"}
                        </div>
                      </td>
                      <td style={{ padding: "10px 4px" }}>
                        <div style={{ fontWeight: 600, color: "#1E293B" }}>
                          {item.nama_pasien}
                        </div>
                        <div style={{ fontSize: "12px", color: "#64748B" }}>
                          {item.no_rm ? `${item.no_rm} • ` : ""}
                          {item.nama_poli}
                        </div>
                      </td>
                      <td style={{ padding: "10px 4px", textAlign: "right" }}>
                        <button
                          type="button"
                          onClick={() => handleSelectKunjungan(item.id)}
                          style={{
                            padding: "6px 12px",
                            borderRadius: "6px",
                            border: sudahPeriksa ? "1px solid #CBD5E1" : "none",
                            cursor: "pointer",
                            fontWeight: 600,
                            fontSize: "12px",
                            backgroundColor: sudahPeriksa
                              ? "#F8FAFC"
                              : "#0D9488",
                            color: sudahPeriksa ? "#334155" : "#FFFFFF",
                          }}
                        >
                          {sudahPeriksa ? "Detail / Edit" : "Periksa"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* PANEL KANAN: FORM PEMERIKSAAN MEDIS */}
        {selectedId && detail && (
          <div
            style={{
              background: "#fff",
              borderRadius: "12px",
              padding: "22px",
              boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                marginBottom: "16px",
                borderBottom: "1px solid #E2E8F0",
                paddingBottom: "12px",
              }}
            >
              <div>
                <h2 style={{ margin: 0, fontSize: "18px", color: "#0F172A" }}>
                  {detail.kunjungan?.nama_pasien} ({detail.kunjungan?.no_rm})
                </h2>
                <div
                  style={{
                    fontSize: "13px",
                    color: "#64748B",
                    marginTop: "4px",
                  }}
                >
                  No. Reg: {detail.kunjungan?.no_registrasi} |{" "}
                  {detail.kunjungan?.nama_poli} -{" "}
                  {detail.kunjungan?.nama_dokter}
                </div>
              </div>

              <button
                type="button"
                onClick={handleCloseCard}
                style={{
                  padding: "6px 12px",
                  borderRadius: "6px",
                  border: "1px solid #CBD5E1",
                  backgroundColor: "#F8FAFC",
                  color: "#475569",
                  fontWeight: 600,
                  fontSize: "12px",
                  cursor: "pointer",
                }}
              >
                ✕ Tutup Form
              </button>
            </div>

            <form onSubmit={handleSave}>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "14px",
                  marginBottom: "12px",
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
                    Keluhan Utama *
                  </label>
                  <input
                    type="text"
                    required
                    value={form.keluhan_utama}
                    onChange={(e) =>
                      setForm({ ...form, keluhan_utama: e.target.value })
                    }
                    style={{
                      width: "100%",
                      padding: "8px 10px",
                      borderRadius: "6px",
                      border: "1px solid #CBD5E1",
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
                    Diagnosis Utama *
                  </label>
                  <input
                    type="text"
                    required
                    value={form.diagnosis_utama}
                    onChange={(e) =>
                      setForm({ ...form, diagnosis_utama: e.target.value })
                    }
                    style={{
                      width: "100%",
                      padding: "8px 10px",
                      borderRadius: "6px",
                      border: "1px solid #CBD5E1",
                    }}
                  />
                </div>
              </div>

              <div style={{ marginBottom: "12px" }}>
                <label
                  style={{
                    display: "block",
                    fontSize: "13px",
                    fontWeight: 600,
                    marginBottom: "4px",
                  }}
                >
                  Anamnesis & Riwayat Penyakit *
                </label>
                <textarea
                  rows="2"
                  required
                  value={form.anamnesis}
                  onChange={(e) =>
                    setForm({ ...form, anamnesis: e.target.value })
                  }
                  style={{
                    width: "100%",
                    padding: "8px 10px",
                    borderRadius: "6px",
                    border: "1px solid #CBD5E1",
                  }}
                />
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(4, 1fr)",
                  gap: "12px",
                  marginBottom: "16px",
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
                    Tekanan Darah
                  </label>
                  <input
                    type="text"
                    value={form.tekanan_darah}
                    onChange={(e) =>
                      setForm({ ...form, tekanan_darah: e.target.value })
                    }
                    style={{
                      width: "100%",
                      padding: "8px 10px",
                      borderRadius: "6px",
                      border: "1px solid #CBD5E1",
                    }}
                  />
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
                    Nadi (x/mnt)
                  </label>
                  <input
                    type="number"
                    value={form.nadi}
                    onChange={(e) => setForm({ ...form, nadi: e.target.value })}
                    style={{
                      width: "100%",
                      padding: "8px 10px",
                      borderRadius: "6px",
                      border: "1px solid #CBD5E1",
                    }}
                  />
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
                    Suhu (°C)
                  </label>
                  <input
                    type="text"
                    value={form.suhu_tubuh}
                    onChange={(e) =>
                      setForm({ ...form, suhu_tubuh: e.target.value })
                    }
                    style={{
                      width: "100%",
                      padding: "8px 10px",
                      borderRadius: "6px",
                      border: "1px solid #CBD5E1",
                    }}
                  />
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
                    Pemeriksaan Fisik
                  </label>
                  <input
                    type="text"
                    value={form.pemeriksaan_fisik}
                    onChange={(e) =>
                      setForm({ ...form, pemeriksaan_fisik: e.target.value })
                    }
                    style={{
                      width: "100%",
                      padding: "8px 10px",
                      borderRadius: "6px",
                      border: "1px solid #CBD5E1",
                    }}
                  />
                </div>
              </div>

              {/* TINDAKAN POLIKLINIK */}
              <div
                style={{
                  marginBottom: "14px",
                  borderTop: "1px solid #F1F5F9",
                  paddingTop: "10px",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: "8px",
                  }}
                >
                  <strong style={{ fontSize: "13px" }}>
                    Tindakan Poliklinik
                  </strong>
                  <button
                    type="button"
                    onClick={() =>
                      setTindakanList([
                        ...tindakanList,
                        { tindakan_id: "", jumlah: 1 },
                      ])
                    }
                    style={{
                      padding: "4px 10px",
                      borderRadius: "6px",
                      border: "1px solid #CBD5E1",
                      background: "#F8FAFC",
                      cursor: "pointer",
                      fontSize: "12px",
                    }}
                  >
                    + Tambah Tindakan
                  </button>
                </div>
                {tindakanList.map((t, idx) => (
                  <div
                    key={idx}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 90px 36px",
                      gap: "8px",
                      marginBottom: "6px",
                    }}
                  >
                    <select
                      value={t.tindakan_id}
                      onChange={(e) => {
                        const copy = [...tindakanList];
                        copy[idx].tindakan_id = e.target.value;
                        setTindakanList(copy);
                      }}
                      style={{
                        padding: "7px",
                        borderRadius: "6px",
                        border: "1px solid #CBD5E1",
                      }}
                    >
                      <option value="">-- Pilih Tindakan --</option>
                      {masterTindakan.map((mt) => (
                        <option key={mt.id} value={mt.id}>
                          {mt.nama_tindakan} (Rp{" "}
                          {Number(mt.tarif).toLocaleString("id-ID")})
                        </option>
                      ))}
                    </select>
                    <input
                      type="number"
                      min="1"
                      value={t.jumlah}
                      onChange={(e) => {
                        const copy = [...tindakanList];
                        copy[idx].jumlah = e.target.value;
                        setTindakanList(copy);
                      }}
                      style={{
                        padding: "7px",
                        borderRadius: "6px",
                        border: "1px solid #CBD5E1",
                      }}
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setTindakanList(
                          tindakanList.filter((_, i) => i !== idx),
                        )
                      }
                      style={{
                        border: "none",
                        background: "#FEE2E2",
                        color: "#DC2626",
                        borderRadius: "6px",
                        cursor: "pointer",
                      }}
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>

              {/* PERMINTAAN LABORATORIUM */}
              <div
                style={{
                  marginBottom: "14px",
                  borderTop: "1px solid #F1F5F9",
                  paddingTop: "10px",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: "8px",
                  }}
                >
                  <strong style={{ fontSize: "13px" }}>
                    Permintaan Pemeriksaan Laboratorium
                  </strong>
                  <button
                    type="button"
                    onClick={() =>
                      setLabList([
                        ...labList,
                        { tindakan_id: "", catatan_permintaan: "" },
                      ])
                    }
                    style={{
                      padding: "4px 10px",
                      borderRadius: "6px",
                      border: "1px solid #CBD5E1",
                      background: "#F8FAFC",
                      cursor: "pointer",
                      fontSize: "12px",
                    }}
                  >
                    + Order Lab
                  </button>
                </div>
                {labList.map((l, idx) => (
                  <div
                    key={idx}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr 36px",
                      gap: "8px",
                      marginBottom: "6px",
                    }}
                  >
                    <select
                      value={l.tindakan_id}
                      onChange={(e) => {
                        const copy = [...labList];
                        copy[idx].tindakan_id = e.target.value;
                        setLabList(copy);
                      }}
                      style={{
                        padding: "7px",
                        borderRadius: "6px",
                        border: "1px solid #CBD5E1",
                      }}
                    >
                      <option value="">-- Pilih Tes Lab --</option>
                      {masterLab.map((ml) => (
                        <option key={ml.id} value={ml.id}>
                          {ml.nama_tindakan} (Rp{" "}
                          {Number(ml.tarif).toLocaleString("id-ID")})
                        </option>
                      ))}
                    </select>
                    <input
                      type="text"
                      placeholder="Catatan permintaan lab..."
                      value={l.catatan_permintaan}
                      onChange={(e) => {
                        const copy = [...labList];
                        copy[idx].catatan_permintaan = e.target.value;
                        setLabList(copy);
                      }}
                      style={{
                        padding: "7px",
                        borderRadius: "6px",
                        border: "1px solid #CBD5E1",
                      }}
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setLabList(labList.filter((_, i) => i !== idx))
                      }
                      style={{
                        border: "none",
                        background: "#FEE2E2",
                        color: "#DC2626",
                        borderRadius: "6px",
                        cursor: "pointer",
                      }}
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>

              {/* RESEP OBAT ELEKTRONIK */}
              <div
                style={{
                  marginBottom: "18px",
                  borderTop: "1px solid #F1F5F9",
                  paddingTop: "10px",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: "8px",
                  }}
                >
                  <strong style={{ fontSize: "13px" }}>
                    Resep Obat Elektronik
                  </strong>
                  <button
                    type="button"
                    onClick={() =>
                      setResepList([
                        ...resepList,
                        {
                          obat_id: "",
                          dosis: "3x1",
                          frekuensi: "Sesudah makan",
                          jumlah: 1,
                        },
                      ])
                    }
                    style={{
                      padding: "4px 10px",
                      borderRadius: "6px",
                      border: "1px solid #CBD5E1",
                      background: "#F8FAFC",
                      cursor: "pointer",
                      fontSize: "12px",
                    }}
                  >
                    + Tambah Obat
                  </button>
                </div>
                {resepList.map((r, idx) => (
                  <div
                    key={idx}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1.4fr 0.8fr 1fr 70px 36px",
                      gap: "8px",
                      marginBottom: "6px",
                    }}
                  >
                    <select
                      value={r.obat_id}
                      onChange={(e) => {
                        const copy = [...resepList];
                        copy[idx].obat_id = e.target.value;
                        setResepList(copy);
                      }}
                      style={{
                        padding: "7px",
                        borderRadius: "6px",
                        border: "1px solid #CBD5E1",
                      }}
                    >
                      <option value="">-- Pilih Obat --</option>
                      {masterObat.map((mo) => (
                        <option key={mo.id} value={mo.id}>
                          {mo.nama_obat} (Stok: {mo.stok})
                        </option>
                      ))}
                    </select>
                    <input
                      type="text"
                      placeholder="Dosis"
                      value={r.dosis}
                      onChange={(e) => {
                        const copy = [...resepList];
                        copy[idx].dosis = e.target.value;
                        setResepList(copy);
                      }}
                      style={{
                        padding: "7px",
                        borderRadius: "6px",
                        border: "1px solid #CBD5E1",
                      }}
                    />
                    <input
                      type="text"
                      placeholder="Aturan pakai"
                      value={r.frekuensi}
                      onChange={(e) => {
                        const copy = [...resepList];
                        copy[idx].frekuensi = e.target.value;
                        setResepList(copy);
                      }}
                      style={{
                        padding: "7px",
                        borderRadius: "6px",
                        border: "1px solid #CBD5E1",
                      }}
                    />
                    <input
                      type="number"
                      min="1"
                      value={r.jumlah}
                      onChange={(e) => {
                        const copy = [...resepList];
                        copy[idx].jumlah = e.target.value;
                        setResepList(copy);
                      }}
                      style={{
                        padding: "7px",
                        borderRadius: "6px",
                        border: "1px solid #CBD5E1",
                      }}
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setResepList(resepList.filter((_, i) => i !== idx))
                      }
                      style={{
                        border: "none",
                        background: "#FEE2E2",
                        color: "#DC2626",
                        borderRadius: "6px",
                        cursor: "pointer",
                      }}
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>

              <div style={{ display: "flex", gap: "10px" }}>
                <button
                  type="submit"
                  disabled={loadingSave}
                  style={{
                    padding: "10px 18px",
                    borderRadius: "8px",
                    border: "none",
                    backgroundColor: "#0D9488",
                    color: "#FFFFFF",
                    fontWeight: 700,
                    cursor: loadingSave ? "not-allowed" : "pointer",
                  }}
                >
                  {loadingSave
                    ? "Menyimpan..."
                    : "Simpan Pemeriksaan & Kirim ke Farmasi / Lab"}
                </button>
                <button
                  type="button"
                  onClick={handleCloseCard}
                  style={{
                    padding: "10px 16px",
                    borderRadius: "8px",
                    border: "1px solid #CBD5E1",
                    backgroundColor: "#FFFFFF",
                    color: "#475569",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  Batal / Tutup
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
