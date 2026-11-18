import { useEffect, useState } from "react";
import { yiiApi } from "../api/client";
import Modal from "../components/Modal";
import {
  Plus,
  UserCheck,
  UserPlus,
  Search,
  X,
  CheckCircle2,
} from "lucide-react";

export default function PendaftaranPage() {
  const today = new Date().toISOString().split("T")[0];
  const [tanggalFilter, setTanggalFilter] = useState(today);
  const [searchAntrean, setSearchAntrean] = useState("");
  const [poliList, setPoliList] = useState([]);
  const [dokterList, setDokterList] = useState([]);
  const [kunjungan, setKunjungan] = useState([]);

  // State Modal & Form
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [tipePasien, setTipePasien] = useState("LAMA");

  // State Pencarian Autocomplete Pasien Lama
  const [pasienQuery, setPasienQuery] = useState("");
  const [pasienResults, setPasienResults] = useState([]);
  const [selectedPasien, setSelectedPasien] = useState(null);
  const [isSearchingPasien, setIsSearchingPasien] = useState(false);

  const [form, setForm] = useState({
    pasien_id: "",
    nik: "",
    nama_lengkap: "",
    tanggal_lahir: "",
    jenis_kelamin: "L",
    no_telepon: "",
    alamat: "",
    poli_id: "",
    dokter_id: "",
    tanggal_kunjungan: today,
  });
  const [feedback, setFeedback] = useState({ type: "", text: "" });
  const [modalError, setModalError] = useState("");
  const [saving, setSaving] = useState(false);

  const loadAll = async () => {
    const [plRes, dRes, kRes] = await Promise.all([
      yiiApi.get("/master/poli"),
      yiiApi.get("/master/dokter"),
      yiiApi.get("/pendaftaran", { params: { tanggal: tanggalFilter } }),
    ]);
    setPoliList(plRes.data.data.items);
    setDokterList(dRes.data.data.items);
    setKunjungan(kRes.data.data);
  };

  useEffect(() => {
    loadAll();
  }, [tanggalFilter]);

  // Live Search ke API Master Pasien saat petugas mengetik (debounce 300ms)
  useEffect(() => {
    if (!isModalOpen || tipePasien !== "LAMA" || selectedPasien) return;

    const keyword = pasienQuery.trim();
    if (keyword.length < 2) {
      setPasienResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearchingPasien(true);
      try {
        const res = await yiiApi.get("/master/pasien", {
          params: { q: keyword, limit: 8 },
        });
        setPasienResults(res.data.data.items || []);
      } catch (err) {
        console.error(err);
      } finally {
        setIsSearchingPasien(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [pasienQuery, isModalOpen, tipePasien, selectedPasien]);

  const filteredDokter = dokterList.filter(
    (d) => String(d.poli_id) === String(form.poli_id),
  );

  const filteredKunjungan = kunjungan.filter(
    (k) =>
      k.nama_pasien.toLowerCase().includes(searchAntrean.toLowerCase()) ||
      k.no_rm.toLowerCase().includes(searchAntrean.toLowerCase()) ||
      k.kode_antrean.toLowerCase().includes(searchAntrean.toLowerCase()),
  );

  const handleOpenModal = () => {
    setModalError("");
    setTipePasien("LAMA");
    setPasienQuery("");
    setPasienResults([]);
    setSelectedPasien(null);
    setForm({
      pasien_id: "",
      nik: "",
      nama_lengkap: "",
      tanggal_lahir: "",
      jenis_kelamin: "L",
      no_telepon: "",
      alamat: "",
      poli_id: "",
      dokter_id: "",
      tanggal_kunjungan: tanggalFilter,
    });
    setIsModalOpen(true);
  };

  const handleSelectPasien = (pasien) => {
    setSelectedPasien(pasien);
    setForm((prev) => ({ ...prev, pasien_id: pasien.id }));
    setPasienQuery("");
    setPasienResults([]);
  };

  const handleClearPasien = () => {
    setSelectedPasien(null);
    setForm((prev) => ({ ...prev, pasien_id: "" }));
    setPasienQuery("");
  };

  const switchToPasienBaru = () => {
    setTipePasien("BARU");
    setForm((prev) => ({
      ...prev,
      pasien_id: "",
      nama_lengkap: isNaN(Number(pasienQuery)) ? pasienQuery : "",
      nik: !isNaN(Number(pasienQuery)) ? pasienQuery : "",
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setModalError("");
    setFeedback({ type: "", text: "" });

    if (tipePasien === "LAMA" && !form.pasien_id) {
      setModalError("Silakan cari dan pilih pasien terlebih dahulu.");
      return;
    }

    setSaving(true);
    try {
      const res = await yiiApi.post("/pendaftaran", {
        ...form,
        tipe_pasien: tipePasien,
      });
      const infoRm = res.data.data.no_rm
        ? ` | No. RM Baru: ${res.data.data.no_rm}`
        : "";
      setFeedback({
        type: "success",
        text: `Pendaftaran berhasil! No. Reg: ${res.data.data.no_registrasi} | Antrean: ${res.data.data.kode_antrean}${infoRm}`,
      });
      setIsModalOpen(false);
      await loadAll();
    } catch (err) {
      setModalError(
        err.response?.data?.message || "Gagal memproses pendaftaran.",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      {feedback.text && (
        <div className={`alert alert-${feedback.type}`}>{feedback.text}</div>
      )}

      <div className="card">
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "1rem",
            marginBottom: "1.25rem",
          }}
        >
          <div>
            <h3 style={{ fontSize: "1.1rem", fontWeight: 700 }}>
              Antrean & Registrasi Rawat Jalan
            </h3>
            <p style={{ fontSize: "0.82rem", color: "var(--text-secondary)" }}>
              Penerimaan pasien lama maupun registrasi pasien baru secara
              langsung
            </p>
          </div>
          <div
            style={{
              display: "flex",
              gap: "0.6rem",
              alignItems: "center",
              flexWrap: "wrap",
            }}
          >
            <div style={{ position: "relative", width: "230px" }}>
              <Search
                size={15}
                style={{
                  position: "absolute",
                  left: "10px",
                  top: "11px",
                  color: "var(--text-secondary)",
                }}
              />
              <input
                placeholder="Cari antrean / pasien..."
                value={searchAntrean}
                onChange={(e) => setSearchAntrean(e.target.value)}
                style={{ paddingLeft: "2rem" }}
              />
            </div>
            <input
              type="date"
              value={tanggalFilter}
              onChange={(e) => setTanggalFilter(e.target.value)}
              style={{ width: "auto" }}
            />
            <button className="btn btn-primary" onClick={handleOpenModal}>
              <Plus size={16} /> Daftarkan Kunjungan
            </button>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th>Antrean</th>
              <th>No. Registrasi</th>
              <th>Identitas Pasien</th>
              <th>Poliklinik</th>
              <th>Dokter Pemeriksa</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {filteredKunjungan.length === 0 ? (
              <tr>
                <td
                  colSpan="6"
                  style={{
                    textAlign: "center",
                    color: "var(--text-secondary)",
                    padding: "2.5rem",
                  }}
                >
                  Belum ada antrean kunjungan pada tanggal ini.
                </td>
              </tr>
            ) : (
              filteredKunjungan.map((k) => (
                <tr key={k.id}>
                  <td>
                    <span
                      className="badge badge-info"
                      style={{ fontSize: "0.85rem", fontWeight: 700 }}
                    >
                      {k.kode_antrean}
                    </span>
                  </td>
                  <td style={{ fontWeight: 600 }}>{k.no_registrasi}</td>
                  <td>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "0.65rem",
                      }}
                    >
                      <div
                        style={{
                          width: "34px",
                          height: "34px",
                          borderRadius: "50%",
                          background: "var(--teal-soft)",
                          color: "var(--teal-icon)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontWeight: 700,
                          fontSize: "0.78rem",
                        }}
                      >
                        {k.nama_pasien.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <div style={{ fontWeight: 600 }}>{k.nama_pasien}</div>
                        <small style={{ color: "var(--text-secondary)" }}>
                          {k.no_rm}
                        </small>
                      </div>
                    </div>
                  </td>
                  <td>{k.nama_poli}</td>
                  <td>{k.nama_dokter}</td>
                  <td>
                    <span
                      className={`badge ${
                        k.status_kunjungan === "SELESAI"
                          ? "badge-success"
                          : "badge-warning"
                      }`}
                    >
                      {k.status_kunjungan}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Modal Pendaftaran (Autocomplete Pasien Lama vs Form Pasien Baru) */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Registrasi Kunjungan Rawat Jalan"
        size="lg"
      >
        {modalError && <div className="alert alert-error">{modalError}</div>}

        {/* Toggle Pasien Lama / Pasien Baru */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "0.6rem",
            background: "var(--bg)",
            padding: "0.35rem",
            borderRadius: "10px",
            marginBottom: "1.25rem",
          }}
        >
          <button
            type="button"
            onClick={() => setTipePasien("LAMA")}
            className="btn"
            style={{
              justifyContent: "center",
              background: tipePasien === "LAMA" ? "#fff" : "transparent",
              color:
                tipePasien === "LAMA"
                  ? "var(--primary)"
                  : "var(--text-secondary)",
              boxShadow:
                tipePasien === "LAMA" ? "0 2px 6px rgba(0,0,0,0.06)" : "none",
            }}
          >
            <UserCheck size={16} /> Pasien Lama (Cari Data)
          </button>
          <button
            type="button"
            onClick={() => setTipePasien("BARU")}
            className="btn"
            style={{
              justifyContent: "center",
              background: tipePasien === "BARU" ? "#fff" : "transparent",
              color:
                tipePasien === "BARU"
                  ? "var(--primary)"
                  : "var(--text-secondary)",
              boxShadow:
                tipePasien === "BARU" ? "0 2px 6px rgba(0,0,0,0.06)" : "none",
            }}
          >
            <UserPlus size={16} /> Pasien Baru (Input Identitas)
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          {tipePasien === "LAMA" ? (
            <div className="form-group" style={{ position: "relative" }}>
              <label>
                Cari Pasien (Ketik Nama, No. RM, atau NIK minimal 2 karakter) *
              </label>

              {selectedPasien ? (
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "0.85rem 1rem",
                    borderRadius: "10px",
                    background: "var(--primary-soft)",
                    border: "1px solid var(--primary)",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.75rem",
                    }}
                  >
                    <CheckCircle2 size={22} color="var(--primary)" />
                    <div>
                      <div style={{ fontWeight: 700, color: "var(--text)" }}>
                        {selectedPasien.nama_lengkap}{" "}
                        <span
                          className="badge badge-info"
                          style={{ marginLeft: "0.4rem" }}
                        >
                          {selectedPasien.no_rm}
                        </span>
                      </div>
                      <small style={{ color: "var(--text)" }}>
                        NIK: {selectedPasien.nik} • Tgl Lahir:{" "}
                        {selectedPasien.tanggal_lahir} (
                        {selectedPasien.jenis_kelamin})
                      </small>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={handleClearPasien}
                  >
                    <X size={14} /> Ganti Pasien
                  </button>
                </div>
              ) : (
                <>
                  <div style={{ position: "relative" }}>
                    <Search
                      size={16}
                      style={{
                        position: "absolute",
                        left: "12px",
                        top: "11px",
                        color: "var(--text-secondary)",
                      }}
                    />
                    <input
                      placeholder="Ketik nama pasien, contoh: Ahmad atau RM-2026..."
                      value={pasienQuery}
                      onChange={(e) => setPasienQuery(e.target.value)}
                      style={{ paddingLeft: "2.25rem" }}
                      autoFocus
                    />
                  </div>

                  {/* Dropdown Hasil Pencarian Melayang (Anti-Layout Shift) */}
                  {pasienQuery.trim().length >= 2 && (
                    <div
                      style={{
                        position: "absolute",
                        top: "100%",
                        left: 0,
                        right: 0,
                        marginTop: "0.35rem",
                        border: "1px solid #cbd5e1",
                        borderRadius: "10px",
                        background: "#ffffff",
                        boxShadow: "0 12px 28px rgba(15, 23, 42, 0.15)",
                        maxHeight: "220px",
                        overflowY: "auto",
                        zIndex: 50,
                      }}
                    >
                      {isSearchingPasien ? (
                        <div
                          style={{
                            padding: "0.85rem 1rem",
                            fontSize: "0.85rem",
                            color: "var(--text-secondary)",
                          }}
                        >
                          Mencari data pasien...
                        </div>
                      ) : pasienResults.length === 0 ? (
                        <div
                          style={{
                            padding: "0.85rem 1rem",
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            gap: "0.5rem",
                          }}
                        >
                          <span
                            style={{
                              fontSize: "0.84rem",
                              color: "var(--text-secondary)",
                            }}
                          >
                            Pasien "<strong>{pasienQuery}</strong>" tidak
                            ditemukan.
                          </span>
                          <button
                            type="button"
                            className="btn btn-primary btn-sm"
                            onClick={switchToPasienBaru}
                          >
                            + Daftarkan Pasien Baru
                          </button>
                        </div>
                      ) : (
                        pasienResults.map((p) => (
                          <div
                            key={p.id}
                            onClick={() => handleSelectPasien(p)}
                            style={{
                              padding: "0.7rem 1rem",
                              borderBottom: "1px solid #f1f5f9",
                              cursor: "pointer",
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center",
                            }}
                            onMouseEnter={(e) =>
                              (e.currentTarget.style.background = "#f1f5f9")
                            }
                            onMouseLeave={(e) =>
                              (e.currentTarget.style.background = "#ffffff")
                            }
                          >
                            <div>
                              <div
                                style={{ fontWeight: 700, fontSize: "0.9rem" }}
                              >
                                {p.nama_lengkap}
                              </div>
                              <small style={{ color: "var(--text-secondary)" }}>
                                NIK: {p.nik} • Lahir: {p.tanggal_lahir} •{" "}
                                {p.alamat || "Alamat tidak tercatat"}
                              </small>
                            </div>
                            <span className="badge badge-info">{p.no_rm}</span>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          ) : (
            <div
              style={{
                background: "#f8fafc",
                padding: "1rem",
                borderRadius: "10px",
                border: "1px solid #e2e8f0",
                marginBottom: "1rem",
              }}
            >
              <div
                style={{
                  fontSize: "0.8rem",
                  fontWeight: 700,
                  color: "var(--primary)",
                  marginBottom: "0.75rem",
                }}
              >
                IDENTITAS PASIEN BARU (No. RM diterbitkan otomatis)
              </div>
              <div className="grid-2">
                <div className="form-group">
                  <label>NIK (16 Digit) *</label>
                  <input
                    maxLength={16}
                    placeholder="Contoh: 327301..."
                    value={form.nik}
                    onChange={(e) => setForm({ ...form, nik: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Nama Lengkap Sesuai KTP *</label>
                  <input
                    placeholder="Nama lengkap pasien"
                    value={form.nama_lengkap}
                    onChange={(e) =>
                      setForm({ ...form, nama_lengkap: e.target.value })
                    }
                    required
                  />
                </div>
              </div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr 1fr",
                  gap: "0.75rem",
                }}
              >
                <div className="form-group">
                  <label>Tanggal Lahir *</label>
                  <input
                    type="date"
                    value={form.tanggal_lahir}
                    onChange={(e) =>
                      setForm({ ...form, tanggal_lahir: e.target.value })
                    }
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Jenis Kelamin *</label>
                  <select
                    value={form.jenis_kelamin}
                    onChange={(e) =>
                      setForm({ ...form, jenis_kelamin: e.target.value })
                    }
                  >
                    <option value="L">Laki-laki</option>
                    <option value="P">Perempuan</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>No. Telepon / WhatsApp</label>
                  <input
                    placeholder="0812..."
                    value={form.no_telepon}
                    onChange={(e) =>
                      setForm({ ...form, no_telepon: e.target.value })
                    }
                  />
                </div>
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>Alamat Domisili</label>
                <input
                  placeholder="Alamat lengkap pasien"
                  value={form.alamat}
                  onChange={(e) => setForm({ ...form, alamat: e.target.value })}
                />
              </div>
            </div>
          )}

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1.2fr 1.2fr",
              gap: "0.75rem",
            }}
          >
            <div className="form-group">
              <label>Tanggal Kunjungan *</label>
              <input
                type="date"
                value={form.tanggal_kunjungan}
                onChange={(e) =>
                  setForm({ ...form, tanggal_kunjungan: e.target.value })
                }
                required
              />
            </div>

            <div className="form-group">
              <label>Poliklinik Tujuan *</label>
              <select
                value={form.poli_id}
                onChange={(e) =>
                  setForm({ ...form, poli_id: e.target.value, dokter_id: "" })
                }
                required
              >
                <option value="">-- Pilih Poli --</option>
                {poliList.map((pl) => (
                  <option key={pl.id} value={pl.id}>
                    {pl.nama_poli} (Rp{" "}
                    {Number(pl.biaya_pendaftaran).toLocaleString("id-ID")})
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>Dokter Praktik *</label>
              <select
                value={form.dokter_id}
                onChange={(e) =>
                  setForm({ ...form, dokter_id: e.target.value })
                }
                required
              >
                <option value="">-- Pilih Dokter --</option>
                {filteredDokter.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.nama_dokter}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              gap: "0.6rem",
              marginTop: "1.25rem",
            }}
          >
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setIsModalOpen(false)}
            >
              Batal
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? "Memproses..." : "Simpan & Terbitkan Antrean"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
