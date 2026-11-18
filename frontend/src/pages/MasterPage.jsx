import { useEffect, useState } from "react";
import { yiiApi } from "../api/client";
import { useAuth } from "../context/AuthContext";
import Modal from "../components/Modal";
import { Plus, Pencil, Trash2, Search, Download } from "lucide-react";

const ALL_TABS = [
  { key: "pasien", label: "Data Pasien", roles: ["ADMIN", "PENDAFTARAN"] },
  { key: "dokter", label: "Dokter", roles: ["ADMIN", "PENDAFTARAN"] },
  { key: "poli", label: "Poliklinik", roles: ["ADMIN", "PENDAFTARAN"] },
  {
    key: "tindakan-medis",
    label: "Tindakan & Lab",
    roles: ["ADMIN", "PENDAFTARAN"],
  },
  { key: "obat", label: "Obat & Stok", roles: ["ADMIN", "PENDAFTARAN"] },
  { key: "users", label: "Manajemen User", roles: ["ADMIN"] },
];

export default function MasterPage() {
  const { user } = useAuth();
  const role = user?.role || "";

  const visibleTabs = ALL_TABS.filter((t) => t.roles.includes(role));
  const [activeTab, setActiveTab] = useState("pasien");
  const [items, setItems] = useState([]);
  const [poliList, setPoliList] = useState([]);
  const [q, setQ] = useState("");
  const [toast, setToast] = useState({ type: "", text: "" });

  // State Modal Tambah / Edit
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editId, setEditId] = useState(null);
  const [formData, setFormData] = useState({});
  const [saving, setSaving] = useState(false);

  // Aturan RBAC di UI agar selaras dengan MasterController.php
  const canCreateOrEdit =
    role === "ADMIN" || (role === "PENDAFTARAN" && activeTab === "pasien");
  const canDelete = role === "ADMIN";

  const loadData = async (searchQuery = q) => {
    try {
      const res = await yiiApi.get(`/master/${activeTab}`, {
        params: { q: searchQuery, limit: 100 },
      });
      setItems(res.data.data.items || []);
      if (activeTab === "dokter") {
        const pRes = await yiiApi.get("/master/poli");
        setPoliList(pRes.data.data.items || []);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    setQ("");
    setToast({ type: "", text: "" });
    loadData("");
  }, [activeTab]);

  const openCreateModal = () => {
    setEditId(null);
    if (activeTab === "pasien")
      setFormData({
        nik: "",
        nama_lengkap: "",
        tanggal_lahir: "",
        jenis_kelamin: "L",
        alamat: "",
        no_telepon: "",
      });
    if (activeTab === "dokter")
      setFormData({
        poli_id: poliList[0]?.id || 1,
        kode_dokter: "",
        nama_dokter: "",
        spesialisasi: "",
        no_str: "",
      });
    if (activeTab === "poli")
      setFormData({ kode_poli: "", nama_poli: "", biaya_pendaftaran: 25000 });
    if (activeTab === "tindakan-medis")
      setFormData({
        kode_tindakan: "",
        nama_tindakan: "",
        kategori: "POLIKLINIK",
        tarif: 50000,
      });
    if (activeTab === "obat")
      setFormData({
        kode_obat: "",
        nama_obat: "",
        satuan: "Strip",
        stok: 50,
        harga_satuan: 10000,
      });
    if (activeTab === "users")
      setFormData({
        username: "",
        password: "",
        nama_lengkap: "",
        role: "PENDAFTARAN",
        is_active: true,
      });
    setIsModalOpen(true);
  };

  const openEditModal = (item) => {
    setEditId(item.id);
    const clean = { ...item };

    // Hapus kolom hasil JOIN hanya jika sedang mengedit Dokter
    if (activeTab === "dokter") {
      delete clean.nama_poli;
      delete clean.kode_poli;
    }

    // Normalisasi angka desimal dari database agar bersih di input type="number"
    const toCleanNumber = (val) => {
      if (val === null || val === undefined || val === "") return 0;
      const normalized = String(val).replace(",", ".");
      const num = Number(normalized);
      return Number.isNaN(num) ? 0 : num;
    };

    if (activeTab === "poli") {
      clean.biaya_pendaftaran = toCleanNumber(item.biaya_pendaftaran);
    }
    if (activeTab === "tindakan-medis") {
      clean.tarif = toCleanNumber(item.tarif);
    }
    if (activeTab === "obat") {
      clean.stok = toCleanNumber(item.stok);
      clean.harga_satuan = toCleanNumber(item.harga_satuan);
    }
    if (activeTab === "users") {
      clean.password = "";
    }

    setFormData(clean);
    setIsModalOpen(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setToast({ type: "", text: "" });
    try {
      const payload = { ...formData };
      if (activeTab === "users" && editId && !payload.password) {
        delete payload.password;
      }

      if (editId) {
        await yiiApi.put(`/master/${activeTab}/${editId}`, payload);
        setToast({
          type: "success",
          text: "Perubahan data berhasil disimpan.",
        });
      } else {
        await yiiApi.post(`/master/${activeTab}`, payload);
        setToast({ type: "success", text: "Data baru berhasil ditambahkan." });
      }
      setIsModalOpen(false);
      await loadData();
    } catch (err) {
      setToast({
        type: "error",
        text: err.response?.data?.message || "Gagal menyimpan data.",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Hapus data ini secara permanen?")) return;
    try {
      await yiiApi.delete(`/master/${activeTab}/${id}`);
      setItems((prev) => prev.filter((item) => item.id !== id));
      setToast({ type: "success", text: "Data berhasil dihapus." });
    } catch (err) {
      setToast({
        type: "error",
        text:
          err.response?.data?.message ||
          "Data tidak dapat dihapus karena terkait transaksi.",
      });
    }
  };

  const handleExportCsv = () => {
    if (items.length === 0) return;
    const headers = Object.keys(items[0]).join(",");
    const rows = items.map((obj) =>
      Object.values(obj)
        .map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`)
        .join(","),
    );
    const csvContent =
      "data:text/csv;charset=utf-8," + [headers, ...rows].join("\n");
    const link = document.createElement("a");
    link.setAttribute("href", encodeURI(csvContent));
    link.setAttribute(
      "download",
      `simrs_${activeTab}_${new Date().toISOString().slice(0, 10)}.csv`,
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const showActionColumn = canCreateOrEdit || canDelete;

  return (
    <div>
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
          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
            {visibleTabs.map((t) => (
              <button
                key={t.key}
                className={`btn ${activeTab === t.key ? "btn-primary" : "btn-secondary"}`}
                onClick={() => setActiveTab(t.key)}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div style={{ display: "flex", gap: "0.5rem" }}>
            <button className="btn btn-secondary" onClick={handleExportCsv}>
              <Download size={15} /> Export CSV
            </button>
            {canCreateOrEdit && (
              <button className="btn btn-primary" onClick={openCreateModal}>
                <Plus size={16} /> Tambah{" "}
                {visibleTabs.find((t) => t.key === activeTab)?.label}
              </button>
            )}
          </div>
        </div>

        <div style={{ display: "flex", gap: "0.5rem", maxWidth: "380px" }}>
          <input
            placeholder="Cari data..."
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              loadData(e.target.value);
            }}
          />
          <button className="btn btn-secondary" onClick={() => loadData()}>
            <Search size={16} />
          </button>
        </div>
      </div>

      {toast.text && (
        <div className={`alert alert-${toast.type}`}>{toast.text}</div>
      )}

      <div className="card">
        <table>
          <thead>
            {activeTab === "pasien" && (
              <tr>
                <th>No. RM</th>
                <th>NIK</th>
                <th>Nama Pasien</th>
                <th>JK</th>
                <th>Tgl Lahir</th>
                <th>Telepon</th>
                {showActionColumn && <th>Aksi</th>}
              </tr>
            )}
            {activeTab === "dokter" && (
              <tr>
                <th>Kode</th>
                <th>Nama Dokter</th>
                <th>Poliklinik</th>
                <th>Spesialisasi</th>
                <th>No. STR</th>
                {showActionColumn && <th>Aksi</th>}
              </tr>
            )}
            {activeTab === "poli" && (
              <tr>
                <th>Kode</th>
                <th>Nama Poliklinik</th>
                <th>Biaya Pendaftaran</th>
                {showActionColumn && <th>Aksi</th>}
              </tr>
            )}
            {activeTab === "tindakan-medis" && (
              <tr>
                <th>Kode</th>
                <th>Nama Tindakan</th>
                <th>Kategori</th>
                <th>Tarif</th>
                {showActionColumn && <th>Aksi</th>}
              </tr>
            )}
            {activeTab === "obat" && (
              <tr>
                <th>Kode</th>
                <th>Nama Obat</th>
                <th>Satuan</th>
                <th>Stok</th>
                <th>Harga Satuan</th>
                {showActionColumn && <th>Aksi</th>}
              </tr>
            )}
            {activeTab === "users" && (
              <tr>
                <th>Username</th>
                <th>Nama Lengkap</th>
                <th>Role</th>
                <th>Status</th>
                {showActionColumn && <th>Aksi</th>}
              </tr>
            )}
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td
                  colSpan="7"
                  style={{
                    textAlign: "center",
                    color: "var(--text-secondary)",
                    padding: "2rem",
                  }}
                >
                  Belum ada data pada kategori ini.
                </td>
              </tr>
            ) : (
              items.map((item) => (
                <tr key={item.id}>
                  {activeTab === "pasien" && (
                    <>
                      <td>
                        <strong>{item.no_rm}</strong>
                      </td>
                      <td>{item.nik}</td>
                      <td>{item.nama_lengkap}</td>
                      <td>{item.jenis_kelamin}</td>
                      <td>{item.tanggal_lahir}</td>
                      <td>{item.no_telepon}</td>
                    </>
                  )}
                  {activeTab === "dokter" && (
                    <>
                      <td>{item.kode_dokter}</td>
                      <td>
                        <strong>{item.nama_dokter}</strong>
                      </td>
                      <td>{item.nama_poli}</td>
                      <td>{item.spesialisasi}</td>
                      <td>{item.no_str}</td>
                    </>
                  )}
                  {activeTab === "poli" && (
                    <>
                      <td>
                        <strong>{item.kode_poli}</strong>
                      </td>
                      <td>{item.nama_poli}</td>
                      <td>
                        Rp{" "}
                        {Number(item.biaya_pendaftaran).toLocaleString("id-ID")}
                      </td>
                    </>
                  )}
                  {activeTab === "tindakan-medis" && (
                    <>
                      <td>{item.kode_tindakan}</td>
                      <td>{item.nama_tindakan}</td>
                      <td>
                        <span className="badge badge-info">
                          {item.kategori}
                        </span>
                      </td>
                      <td>Rp {Number(item.tarif).toLocaleString("id-ID")}</td>
                    </>
                  )}
                  {activeTab === "obat" && (
                    <>
                      <td>{item.kode_obat}</td>
                      <td>
                        <strong>{item.nama_obat}</strong>
                      </td>
                      <td>{item.satuan}</td>
                      <td>
                        <span
                          className={`badge ${
                            item.stok <= 5 ? "badge-danger" : "badge-success"
                          }`}
                        >
                          {item.stok}
                        </span>
                      </td>
                      <td>
                        Rp {Number(item.harga_satuan).toLocaleString("id-ID")}
                      </td>
                    </>
                  )}
                  {activeTab === "users" && (
                    <>
                      <td>
                        <strong>@{item.username}</strong>
                      </td>
                      <td>{item.nama_lengkap}</td>
                      <td>
                        <span className="badge badge-info">{item.role}</span>
                      </td>
                      <td>
                        <span
                          className={`badge ${
                            item.is_active ? "badge-success" : "badge-danger"
                          }`}
                        >
                          {item.is_active ? "Aktif" : "Nonaktif"}
                        </span>
                      </td>
                    </>
                  )}
                  {showActionColumn && (
                    <td>
                      <div style={{ display: "flex", gap: "0.4rem" }}>
                        {canCreateOrEdit && (
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => openEditModal(item)}
                            title="Edit Data"
                          >
                            <Pencil size={14} />
                          </button>
                        )}
                        {canDelete && (
                          <button
                            className="btn btn-danger btn-sm"
                            onClick={() => handleDelete(item.id)}
                            title="Hapus Data"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Modal Tambah / Edit Dinamis */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={`${editId ? "Edit" : "Tambah"} ${
          visibleTabs.find((t) => t.key === activeTab)?.label
        }`}
      >
        <form onSubmit={handleSave}>
          {activeTab === "pasien" && (
            <>
              <div className="grid-2">
                <div className="form-group">
                  <label>NIK (16 Digit)</label>
                  <input
                    maxLength={16}
                    value={formData.nik || ""}
                    onChange={(e) =>
                      setFormData({ ...formData, nik: e.target.value })
                    }
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Nama Lengkap</label>
                  <input
                    value={formData.nama_lengkap || ""}
                    onChange={(e) =>
                      setFormData({ ...formData, nama_lengkap: e.target.value })
                    }
                    required
                  />
                </div>
              </div>
              <div className="grid-2">
                <div className="form-group">
                  <label>Tanggal Lahir</label>
                  <input
                    type="date"
                    value={formData.tanggal_lahir || ""}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        tanggal_lahir: e.target.value,
                      })
                    }
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Jenis Kelamin</label>
                  <select
                    value={formData.jenis_kelamin || "L"}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        jenis_kelamin: e.target.value,
                      })
                    }
                  >
                    <option value="L">Laki-laki</option>
                    <option value="P">Perempuan</option>
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label>No. Telepon</label>
                <input
                  value={formData.no_telepon || ""}
                  onChange={(e) =>
                    setFormData({ ...formData, no_telepon: e.target.value })
                  }
                />
              </div>
              <div className="form-group">
                <label>Alamat</label>
                <textarea
                  rows={2}
                  value={formData.alamat || ""}
                  onChange={(e) =>
                    setFormData({ ...formData, alamat: e.target.value })
                  }
                />
              </div>
            </>
          )}

          {activeTab === "dokter" && (
            <>
              <div className="grid-2">
                <div className="form-group">
                  <label>Kode Dokter</label>
                  <input
                    value={formData.kode_dokter || ""}
                    onChange={(e) =>
                      setFormData({ ...formData, kode_dokter: e.target.value })
                    }
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Poliklinik</label>
                  <select
                    value={formData.poli_id || ""}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        poli_id: Number(e.target.value),
                      })
                    }
                    required
                  >
                    {poliList.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.nama_poli}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label>Nama Dokter & Gelar</label>
                <input
                  value={formData.nama_dokter || ""}
                  onChange={(e) =>
                    setFormData({ ...formData, nama_dokter: e.target.value })
                  }
                  required
                />
              </div>
              <div className="grid-2">
                <div className="form-group">
                  <label>Spesialisasi</label>
                  <input
                    value={formData.spesialisasi || ""}
                    onChange={(e) =>
                      setFormData({ ...formData, spesialisasi: e.target.value })
                    }
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Nomor STR</label>
                  <input
                    value={formData.no_str || ""}
                    onChange={(e) =>
                      setFormData({ ...formData, no_str: e.target.value })
                    }
                    required
                  />
                </div>
              </div>
            </>
          )}

          {activeTab === "poli" && (
            <>
              <div className="grid-2">
                <div className="form-group">
                  <label>Kode Poli</label>
                  <input
                    value={formData.kode_poli || ""}
                    onChange={(e) =>
                      setFormData({ ...formData, kode_poli: e.target.value })
                    }
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Biaya Pendaftaran (Rp)</label>
                  <input
                    type="number"
                    value={formData.biaya_pendaftaran ?? 0}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        biaya_pendaftaran: Number(e.target.value),
                      })
                    }
                    required
                  />
                </div>
              </div>
              <div className="form-group">
                <label>Nama Poliklinik</label>
                <input
                  value={formData.nama_poli || ""}
                  onChange={(e) =>
                    setFormData({ ...formData, nama_poli: e.target.value })
                  }
                  required
                />
              </div>
            </>
          )}

          {activeTab === "tindakan-medis" && (
            <>
              <div className="grid-2">
                <div className="form-group">
                  <label>Kode Tindakan</label>
                  <input
                    value={formData.kode_tindakan || ""}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        kode_tindakan: e.target.value,
                      })
                    }
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Kategori</label>
                  <select
                    value={formData.kategori || "POLIKLINIK"}
                    onChange={(e) =>
                      setFormData({ ...formData, kategori: e.target.value })
                    }
                  >
                    <option value="POLIKLINIK">POLIKLINIK</option>
                    <option value="LABORATORIUM">LABORATORIUM</option>
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label>Nama Tindakan / Pemeriksaan</label>
                <input
                  value={formData.nama_tindakan || ""}
                  onChange={(e) =>
                    setFormData({ ...formData, nama_tindakan: e.target.value })
                  }
                  required
                />
              </div>
              <div className="form-group">
                <label>Tarif (Rp)</label>
                <input
                  type="number"
                  value={formData.tarif ?? 0}
                  onChange={(e) =>
                    setFormData({ ...formData, tarif: Number(e.target.value) })
                  }
                  required
                />
              </div>
            </>
          )}

          {activeTab === "obat" && (
            <>
              <div className="grid-2">
                <div className="form-group">
                  <label>Kode Obat</label>
                  <input
                    value={formData.kode_obat || ""}
                    onChange={(e) =>
                      setFormData({ ...formData, kode_obat: e.target.value })
                    }
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Satuan</label>
                  <input
                    value={formData.satuan || ""}
                    onChange={(e) =>
                      setFormData({ ...formData, satuan: e.target.value })
                    }
                    required
                  />
                </div>
              </div>
              <div className="form-group">
                <label>Nama Obat</label>
                <input
                  value={formData.nama_obat || ""}
                  onChange={(e) =>
                    setFormData({ ...formData, nama_obat: e.target.value })
                  }
                  required
                />
              </div>
              <div className="grid-2">
                <div className="form-group">
                  <label>Stok Tersedia</label>
                  <input
                    type="number"
                    min="0"
                    value={formData.stok ?? 0}
                    onChange={(e) =>
                      setFormData({ ...formData, stok: Number(e.target.value) })
                    }
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Harga Satuan (Rp)</label>
                  <input
                    type="number"
                    min="0"
                    value={formData.harga_satuan ?? 0}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        harga_satuan: Number(e.target.value),
                      })
                    }
                    required
                  />
                </div>
              </div>
            </>
          )}

          {activeTab === "users" && (
            <>
              <div className="grid-2">
                <div className="form-group">
                  <label>Username</label>
                  <input
                    value={formData.username || ""}
                    onChange={(e) =>
                      setFormData({ ...formData, username: e.target.value })
                    }
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Role Unit Layanan</label>
                  <select
                    value={formData.role || "PENDAFTARAN"}
                    onChange={(e) =>
                      setFormData({ ...formData, role: e.target.value })
                    }
                  >
                    <option value="ADMIN">ADMIN</option>
                    <option value="PENDAFTARAN">PENDAFTARAN</option>
                    <option value="DOKTER">DOKTER</option>
                    <option value="LABORATORIUM">LABORATORIUM</option>
                    <option value="FARMASI">FARMASI</option>
                    <option value="KASIR">KASIR</option>
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label>Nama Lengkap</label>
                <input
                  value={formData.nama_lengkap || ""}
                  onChange={(e) =>
                    setFormData({ ...formData, nama_lengkap: e.target.value })
                  }
                  required
                />
              </div>
              <div className="form-group">
                <label>
                  Password{" "}
                  {editId ? "(Kosongkan jika tidak ingin mengubah)" : "*"}
                </label>
                <input
                  type="password"
                  value={formData.password || ""}
                  onChange={(e) =>
                    setFormData({ ...formData, password: e.target.value })
                  }
                  required={!editId}
                />
              </div>
            </>
          )}

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
              {saving ? "Menyimpan..." : "Simpan Data"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
