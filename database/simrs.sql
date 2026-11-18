-- ============================================================================
-- DATABASE SCHEMA & SEED DATA: SIMRS RAWAT JALAN TERINTEGRASI
-- Target: PostgreSQL 17 | PT Inova Medika Solusindo Case Test
-- ============================================================================

-- Bersihkan tabel jika sudah ada (urutan terbalik dari relasi foreign key)
DROP TABLE IF EXISTS integration_outbox CASCADE;
DROP TABLE IF EXISTS audit_logs CASCADE;
DROP TABLE IF EXISTS pembayaran CASCADE;
DROP TABLE IF EXISTS billing_items CASCADE;
DROP TABLE IF EXISTS billing CASCADE;
DROP TABLE IF EXISTS resep_detail CASCADE;
DROP TABLE IF EXISTS resep CASCADE;
DROP TABLE IF EXISTS pemeriksaan_lab CASCADE;
DROP TABLE IF EXISTS kunjungan_tindakan CASCADE;
DROP TABLE IF EXISTS pemeriksaan_medis CASCADE;
DROP TABLE IF EXISTS kunjungan CASCADE;
DROP TABLE IF EXISTS obat CASCADE;
DROP TABLE IF EXISTS tindakan_medis CASCADE;
DROP TABLE IF EXISTS jadwal_dokter CASCADE;
DROP TABLE IF EXISTS dokter CASCADE;
DROP TABLE IF EXISTS poli CASCADE;
DROP TABLE IF EXISTS pasien CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- ============================================================================
-- 1. MANAJEMEN PENGGUNA & HAK AKSES (6 ROLE WAJIB)
-- ============================================================================
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    nama_lengkap VARCHAR(100) NOT NULL,
    role VARCHAR(30) NOT NULL CHECK (
        role IN ('ADMIN', 'PENDAFTARAN', 'DOKTER', 'FARMASI', 'LABORATORIUM', 'KASIR')
    ),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- 2. MASTER DATA SIMRS
-- ============================================================================
CREATE TABLE pasien (
    id SERIAL PRIMARY KEY,
    no_rm VARCHAR(20) UNIQUE NOT NULL, -- Contoh: RM-2026-0001
    nik VARCHAR(16) UNIQUE NOT NULL,
    nama_lengkap VARCHAR(100) NOT NULL,
    tanggal_lahir DATE NOT NULL,
    jenis_kelamin CHAR(1) NOT NULL CHECK (jenis_kelamin IN ('L', 'P')),
    alamat TEXT,
    no_telepon VARCHAR(20),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE poli (
    id SERIAL PRIMARY KEY,
    kode_poli VARCHAR(10) UNIQUE NOT NULL, -- Contoh: POL-UMUM, POL-GIGI
    nama_poli VARCHAR(100) NOT NULL,
    biaya_pendaftaran NUMERIC(12, 2) NOT NULL DEFAULT 25000.00 CHECK (biaya_pendaftaran >= 0),
    is_active BOOLEAN DEFAULT TRUE
);

CREATE TABLE dokter (
    id SERIAL PRIMARY KEY,
    user_id INT UNIQUE REFERENCES users(id) ON DELETE SET NULL, -- Terhubung ke akun login dokter
    poli_id INT NOT NULL REFERENCES poli(id) ON DELETE RESTRICT,
    kode_dokter VARCHAR(20) UNIQUE NOT NULL,
    nama_dokter VARCHAR(100) NOT NULL,
    spesialisasi VARCHAR(100) NOT NULL,
    no_str VARCHAR(50) UNIQUE NOT NULL,
    is_active BOOLEAN DEFAULT TRUE
);

CREATE TABLE jadwal_dokter (
    id SERIAL PRIMARY KEY,
    dokter_id INT NOT NULL REFERENCES dokter(id) ON DELETE CASCADE,
    hari VARCHAR(15) NOT NULL CHECK (
        hari IN ('Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu')
    ),
    jam_mulai TIME NOT NULL,
    jam_selesai TIME NOT NULL,
    kuota_harian INT NOT NULL DEFAULT 30 CHECK (kuota_harian > 0),
    CONSTRAINT uq_jadwal_dokter UNIQUE (dokter_id, hari, jam_mulai)
);

CREATE TABLE tindakan_medis (
    id SERIAL PRIMARY KEY,
    kode_tindakan VARCHAR(20) UNIQUE NOT NULL,
    nama_tindakan VARCHAR(150) NOT NULL,
    kategori VARCHAR(30) NOT NULL CHECK (kategori IN ('POLIKLINIK', 'LABORATORIUM')),
    tarif NUMERIC(12, 2) NOT NULL CHECK (tarif >= 0),
    is_active BOOLEAN DEFAULT TRUE
);

CREATE TABLE obat (
    id SERIAL PRIMARY KEY,
    kode_obat VARCHAR(20) UNIQUE NOT NULL,
    nama_obat VARCHAR(150) NOT NULL,
    satuan VARCHAR(30) NOT NULL, -- Tablet, Kapsul, Botol, Strip
    stok INT NOT NULL DEFAULT 0 CHECK (stok >= 0), -- SKENARIO D.2: Mencegah stok minus di level DB
    harga_satuan NUMERIC(12, 2) NOT NULL CHECK (harga_satuan >= 0),
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- 3. PENDAFTARAN & ANTREAN RAWAT JALAN
-- ============================================================================
CREATE TABLE kunjungan (
    id SERIAL PRIMARY KEY,
    no_registrasi VARCHAR(30) UNIQUE NOT NULL, -- Contoh: REG-20261115-001
    pasien_id INT NOT NULL REFERENCES pasien(id) ON DELETE RESTRICT,
    poli_id INT NOT NULL REFERENCES poli(id) ON DELETE RESTRICT,
    dokter_id INT NOT NULL REFERENCES dokter(id) ON DELETE RESTRICT,
    tanggal_kunjungan DATE NOT NULL DEFAULT CURRENT_DATE,
    no_antrean INT NOT NULL,
    kode_antrean VARCHAR(15) NOT NULL, -- Contoh: U-001
    status_kunjungan VARCHAR(30) NOT NULL DEFAULT 'MENUNGGU' CHECK (
        status_kunjungan IN ('MENUNGGU', 'DIPERIKSA', 'SELESAI_PERIKSA', 'SELESAI', 'BATAL')
    ),
    created_by INT REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    -- SKENARIO D.1: Mencegah duplikasi nomor antrean pada dokter & tanggal yang sama
    CONSTRAINT uq_antrean_dokter_harian UNIQUE (dokter_id, tanggal_kunjungan, no_antrean)
);

-- SKENARIO D.1: Partial Unique Index mencegah pendaftaran ganda pasien yang sama
-- di poli dan hari yang sama selama kunjungan sebelumnya belum SELESAI atau BATAL
CREATE UNIQUE INDEX idx_prevent_duplicate_registration
ON kunjungan (pasien_id, poli_id, tanggal_kunjungan)
WHERE status_kunjungan IN ('MENUNGGU', 'DIPERIKSA');

-- ============================================================================
-- 4. PEMERIKSAAN MEDIS (EMR) & TINDAKAN
-- ============================================================================
CREATE TABLE pemeriksaan_medis (
    id SERIAL PRIMARY KEY,
    kunjungan_id INT UNIQUE NOT NULL REFERENCES kunjungan(id) ON DELETE CASCADE,
    dokter_id INT NOT NULL REFERENCES dokter(id),
    anamnesis TEXT NOT NULL,
    keluhan_utama TEXT NOT NULL,
    tekanan_darah VARCHAR(20), -- Contoh: 120/80 mmHg
    nadi INT,                  -- x/menit
    suhu_tubuh NUMERIC(4, 1),  -- Celcius
    pernapasan INT,            -- x/menit
    berat_badan NUMERIC(5, 2), -- kg
    tinggi_badan NUMERIC(5, 2),-- cm
    pemeriksaan_fisik TEXT,
    diagnosis_utama VARCHAR(255) NOT NULL,
    diagnosis_sekunder VARCHAR(255),
    catatan_dokter TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE kunjungan_tindakan (
    id SERIAL PRIMARY KEY,
    kunjungan_id INT NOT NULL REFERENCES kunjungan(id) ON DELETE CASCADE,
    tindakan_id INT NOT NULL REFERENCES tindakan_medis(id) ON DELETE RESTRICT,
    jumlah INT NOT NULL DEFAULT 1 CHECK (jumlah > 0),
    tarif_saat_ini NUMERIC(12, 2) NOT NULL,
    subtotal NUMERIC(12, 2) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- 5. PEMERIKSAAN PENUNJANG (LABORATORIUM - INTEGRASI NODE.JS)
-- ============================================================================
CREATE TABLE pemeriksaan_lab (
    id SERIAL PRIMARY KEY,
    no_order_lab VARCHAR(30) UNIQUE NOT NULL, -- Contoh: LAB-20261115-001
    kunjungan_id INT NOT NULL REFERENCES kunjungan(id) ON DELETE CASCADE,
    tindakan_id INT NOT NULL REFERENCES tindakan_medis(id) ON DELETE RESTRICT,
    catatan_permintaan TEXT,
    hasil_pemeriksaan TEXT,
    nilai_rujukan VARCHAR(100),
    status_lab VARCHAR(20) NOT NULL DEFAULT 'DIMINTA' CHECK (
        status_lab IN ('DIMINTA', 'DIPROSES', 'SELESAI')
    ),
    petugas_lab_id INT REFERENCES users(id),
    waktu_permintaan TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    waktu_selesai TIMESTAMP
);

-- ============================================================================
-- 6. FARMASI & RESEP OBAT
-- ============================================================================
CREATE TABLE resep (
    id SERIAL PRIMARY KEY,
    no_resep VARCHAR(30) UNIQUE NOT NULL, -- Contoh: RSP-20261115-001
    kunjungan_id INT UNIQUE NOT NULL REFERENCES kunjungan(id) ON DELETE CASCADE,
    dokter_id INT NOT NULL REFERENCES dokter(id),
    status_resep VARCHAR(20) NOT NULL DEFAULT 'MENUNGGU' CHECK (
        status_resep IN ('MENUNGGU', 'DISERAHKAN', 'BATAL')
    ),
    petugas_farmasi_id INT REFERENCES users(id),
    waktu_resep TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    waktu_serah TIMESTAMP
);

CREATE TABLE resep_detail (
    id SERIAL PRIMARY KEY,
    resep_id INT NOT NULL REFERENCES resep(id) ON DELETE CASCADE,
    obat_id INT NOT NULL REFERENCES obat(id) ON DELETE RESTRICT,
    dosis VARCHAR(50) NOT NULL,      -- Contoh: 500 mg
    frekuensi VARCHAR(50) NOT NULL,  -- Contoh: 3 x 1 sehari sesudah makan
    jumlah INT NOT NULL CHECK (jumlah > 0),
    harga_satuan NUMERIC(12, 2) NOT NULL,
    subtotal NUMERIC(12, 2) NOT NULL
);

-- ============================================================================
-- 7. BILLING & PEMBAYARAN (IDEMPOTENT)
-- ============================================================================
CREATE TABLE billing (
    id SERIAL PRIMARY KEY,
    no_invoice VARCHAR(30) UNIQUE NOT NULL, -- Contoh: INV-20261115-001
    kunjungan_id INT UNIQUE NOT NULL REFERENCES kunjungan(id) ON DELETE RESTRICT,
    total_tagihan NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (total_tagihan >= 0),
    total_dibayar NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (total_dibayar >= 0),
    sisa_tagihan NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (sisa_tagihan >= 0),
    status_pembayaran VARCHAR(25) NOT NULL DEFAULT 'BELUM_DIBAYAR' CHECK (
        status_pembayaran IN ('BELUM_DIBAYAR', 'DIBAYAR_SEBAGIAN', 'LUNAS')
    ),
    is_locked BOOLEAN DEFAULT FALSE, -- SKENARIO D.4: Mengunci perubahan medis jika sudah ada pembayaran
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE billing_items (
    id SERIAL PRIMARY KEY,
    billing_id INT NOT NULL REFERENCES billing(id) ON DELETE CASCADE,
    jenis_item VARCHAR(20) NOT NULL CHECK (
        jenis_item IN ('PENDAFTARAN', 'TINDAKAN', 'LABORATORIUM', 'OBAT')
    ),
    referensi_id INT, -- ID dari kunjungan / kunjungan_tindakan / pemeriksaan_lab / resep_detail
    deskripsi VARCHAR(200) NOT NULL,
    jumlah INT NOT NULL DEFAULT 1,
    harga_satuan NUMERIC(12, 2) NOT NULL,
    subtotal NUMERIC(12, 2) NOT NULL
);

CREATE TABLE pembayaran (
    id SERIAL PRIMARY KEY,
    no_kwitansi VARCHAR(30) UNIQUE NOT NULL,
    billing_id INT NOT NULL REFERENCES billing(id) ON DELETE RESTRICT,
    -- SKENARIO D.3: Idempotency Key wajib unik dari frontend untuk cegah double payment saat retry
    idempotency_key VARCHAR(100) UNIQUE NOT NULL,
    metode_pembayaran VARCHAR(20) NOT NULL CHECK (metode_pembayaran IN ('TUNAI', 'NON_TUNAI')),
    jumlah_bayar NUMERIC(12, 2) NOT NULL CHECK (jumlah_bayar > 0),
    kasir_id INT NOT NULL REFERENCES users(id),
    waktu_bayar TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- 8. TABEL PENDUKUNG SKENARIO TEKNIS (AUDIT TRAIL & OUTBOX PATTERN)
-- ============================================================================
-- SKENARIO D.4: Mencatat setiap perubahan data medis/billing
CREATE TABLE audit_logs (
    id SERIAL PRIMARY KEY,
    user_id INT REFERENCES users(id),
    tabel_target VARCHAR(50) NOT NULL,
    record_id INT NOT NULL,
    aksi VARCHAR(20) NOT NULL, -- CREATE, UPDATE, DELETE, REVISI_BILLING
    data_lama JSONB,
    data_baru JSONB,
    keterangan TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- SKENARIO D.5: Menjamin ketahanan data jika layanan API eksternal/Node.js down
CREATE TABLE integration_outbox (
    id SERIAL PRIMARY KEY,
    event_type VARCHAR(50) NOT NULL, -- Contoh: LAB_ORDER_SYNC
    payload JSONB NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING_SYNC' CHECK (
        status IN ('PENDING_SYNC', 'SYNCED', 'FAILED')
    ),
    retry_count INT NOT NULL DEFAULT 0,
    last_error TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    synced_at TIMESTAMP
);

-- ============================================================================
-- 9. INDEXING UNTUK PERFORMA QUERY (SKENARIO D.6)
-- ============================================================================
CREATE INDEX idx_pasien_nama ON pasien(nama_lengkap);
CREATE INDEX idx_kunjungan_tanggal_status ON kunjungan(tanggal_kunjungan, status_kunjungan);
CREATE INDEX idx_kunjungan_dokter ON kunjungan(dokter_id, tanggal_kunjungan);
CREATE INDEX idx_billing_status ON billing(status_pembayaran);
CREATE INDEX idx_pembayaran_waktu ON pembayaran(waktu_bayar);

-- ============================================================================
-- 10. DUMMY DATA AWAL UNTUK PENGUJIAN
-- Password default untuk semua akun dummy di bawah ini adalah: "password123"
-- Hash bcrypt valid untuk "password123": $2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi
-- ============================================================================
INSERT INTO users (username, password_hash, nama_lengkap, role) VALUES
('admin', '$2y$10$MBZIbrZjH2m6R6RhVUrehuEeJQHD4mr9bFNMtSFzqeGgmfILAlbLK', 'Administrator SIMRS', 'ADMIN'),
('daftar1', '$2y$10$MBZIbrZjH2m6R6RhVUrehuEeJQHD4mr9bFNMtSFzqeGgmfILAlbLK', 'Siti Aminah (Admisi)', 'PENDAFTARAN'),
('dr_budi', '$2y$10$MBZIbrZjH2m6R6RhVUrehuEeJQHD4mr9bFNMtSFzqeGgmfILAlbLK', 'dr. Budi Santoso, Sp.PD', 'DOKTER'),
('dr_citra', '$2y$10$MBZIbrZjH2m6R6RhVUrehuEeJQHD4mr9bFNMtSFzqeGgmfILAlbLK', 'drg. Citra Lestari', 'DOKTER'),
('farmasi1', '$2y$10$MBZIbrZjH2m6R6RhVUrehuEeJQHD4mr9bFNMtSFzqeGgmfILAlbLK', 'Rina Apt. (Farmasi)', 'FARMASI'),
('lab1', '$2y$10$MBZIbrZjH2m6R6RhVUrehuEeJQHD4mr9bFNMtSFzqeGgmfILAlbLK', 'Andi Analis (Lab)', 'LABORATORIUM'),
('kasir1', '$2y$10$MBZIbrZjH2m6R6RhVUrehuEeJQHD4mr9bFNMtSFzqeGgmfILAlbLK', 'Dewi Kasir', 'KASIR');

INSERT INTO poli (kode_poli, nama_poli, biaya_pendaftaran) VALUES
('U', 'Poliklinik Umum', 25000.00),
('PD', 'Poliklinik Penyakit Dalam', 40000.00),
('GG', 'Poliklinik Gigi & Mulut', 35000.00);

INSERT INTO dokter (user_id, poli_id, kode_dokter, nama_dokter, spesialisasi, no_str) VALUES
(3, 2, 'DOK-001', 'dr. Budi Santoso, Sp.PD', 'Penyakit Dalam', 'STR-11029384'),
(4, 3, 'DOK-002', 'drg. Citra Lestari', 'Kedokteran Gigi', 'STR-22039485');

INSERT INTO jadwal_dokter (dokter_id, hari, jam_mulai, jam_selesai, kuota_harian) VALUES
(1, 'Senin', '08:00:00', '14:00:00', 25),
(1, 'Rabu', '08:00:00', '14:00:00', 25),
(1, 'Minggu', '08:00:00', '17:00:00', 25),
(2, 'Selasa', '09:00:00', '15:00:00', 20),
(2, 'Minggu', '09:00:00', '17:00:00', 20);

INSERT INTO pasien (no_rm, nik, nama_lengkap, tanggal_lahir, jenis_kelamin, alamat, no_telepon) VALUES
('RM-2026-0001', '3273011205900001', 'Ahmad Fauzi', '1990-05-12', 'L', 'Jl. Soekarno Hatta No. 102, Bandung', '081234567890'),
('RM-2026-0002', '3273024508950002', 'Nadia Putri', '1995-08-25', 'P', 'Jl. Buah Batu No. 45, Bandung', '081298765432'),
('RM-2026-0003', '3273031011880003', 'Hendra Wijaya', '1988-11-10', 'L', 'Jl. Dago Asri No. 12, Bandung', '081345678901');

INSERT INTO tindakan_medis (kode_tindakan, nama_tindakan, kategori, tarif) VALUES
('TND-001', 'Konsultasi & Pemeriksaan Dokter Spesialis', 'POLIKLINIK', 100000.00),
('TND-002', 'Nebulizer / Terapi Uap', 'POLIKLINIK', 75000.00),
('TND-003', 'Pembersihan Karang Gigi (Scaling)', 'POLIKLINIK', 250000.00),
('LAB-001', 'Cek Darah Lengkap (Hematologi Rutin)', 'LABORATORIUM', 120000.00),
('LAB-002', 'Cek Gula Darah Sewaktu (GDS)', 'LABORATORIUM', 35000.00),
('LAB-003', 'Profil Lipid (Kolesterol Total, LDL, HDL)', 'LABORATORIUM', 185000.00);

INSERT INTO obat (kode_obat, nama_obat, satuan, stok, harga_satuan) VALUES
('OBT-001', 'Paracetamol 500 mg', 'Strip (10 Tab)', 150, 8000.00),
('OBT-002', 'Amoxicillin 500 mg', 'Strip (10 Kap)', 80, 15000.00),
('OBT-003', 'Omeprazole 20 mg', 'Strip (10 Kap)', 60, 22000.00),
('OBT-004', 'Amlodipine 5 mg', 'Strip (10 Tab)', 100, 18000.00),
('OBT-005', 'Obat Batuk Sirup 60 ml', 'Botol', 1, 28000.00); -- Sengaja stok 1 untuk uji skenario D.2!