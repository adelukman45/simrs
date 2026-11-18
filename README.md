# Sistem Informasi Manajemen Rumah Sakit (SIMRS) — Modul Rawat Jalan Terintegrasi

Proyek ini dikembangkan sebagai solusi **Technical Case Test — Senior Programmer** untuk **PT Inova Medika Solusindo**, mengimplementasikan arsitektur _Hybrid Backend_ (**Yii2 PHP Framework** & **Node.js Express**), **PostgreSQL 17**, dan **React.js (Vite)**.

---

## 1. Arsitektur Sistem & Pembagian Tanggung Jawab

| Komponen            | Teknologi                  | Port / Domain           | Tanggung Jawab Utama                                                                                                                              |
| :------------------ | :------------------------- | :---------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Database**        | PostgreSQL 17 (`pgcrypto`) | `127.0.0.1:5432`        | Penyimpanan relasional, _row-level locking_ (`FOR UPDATE`), _partial unique index_, _audit logs_ (`JSONB`), dan _transactional outbox_.           |
| **Core Backend**    | PHP 8.x + Yii2 Framework   | `http://simrs-api.test` | Autentikasi JWT & RBAC (6 Role), Master Data CRUD, Pendaftaran & Antrean, EMR Dokter, Farmasi, dan Billing/Kasir Idempotent.                      |
| **Backend Service** | Node.js + Express + Joi    | `http://127.0.0.1:3001` | Integrasi Pemeriksaan Penunjang (Laboratorium), Pemulihan Outbox, dan Dashboard Agregasi Operasional dengan TTL Caching.                          |
| **Frontend**        | React.js (Vite) + Axios    | `http://localhost:5173` | Antarmuka pengguna berbasis peran (RBAC), _live autocomplete_ pendaftaran pasien, modal CRUD tanpa _reload_, dan pencetakan Invoice/Kwitansi PDF. |

---

## 2. Akun Demo Pengujian (6 Peran Wajib)

Seluruh akun bawaan pada `database/simrs.sql` menggunakan kata sandi yang sama: **`password123`**

| Role           | Username   | Nama Pengguna           | Kewenangan Utama                                                     |
| :------------- | :--------- | :---------------------- | :------------------------------------------------------------------- |
| `ADMIN`        | `admin`    | Administrator SIMRS     | Akses penuh ke seluruh modul, master data, & manajemen user          |
| `PENDAFTARAN`  | `daftar1`  | Siti Aminah (Admisi)    | Registrasi pasien baru/lama, pendaftaran kunjungan, & antrean        |
| `DOKTER`       | `dr_budi`  | dr. Budi Santoso, Sp.PD | Input EMR, diagnosis, tindakan medis, order lab, & resep elektronik  |
| `LABORATORIUM` | `lab1`     | Andi Analis (Lab)       | Penerimaan order lab, input hasil pemeriksaan, & sinkronisasi outbox |
| `FARMASI`      | `farmasi1` | Rina Apt. (Farmasi)     | Verifikasi resep, penyerahan obat, & pemotongan stok atomik          |
| `KASIR`        | `kasir1`   | Dewi Kasir              | Pelunasan tagihan bertahap/penuh & cetak invoice/kwitansi PDF        |

---

## 3. Panduan Instalasi & Menjalankan Sistem

### A. Database PostgreSQL 17

1. Buat database baru bernama `simrs` di PostgreSQL 17.
2. Jalankan seluruh script SQL pada `database/simrs.sql` (mencakup ekstensi `pgcrypto`, 18 tabel, indeks performa, dan data awal).

### B. Core Backend (`backend/` - Yii2)

```bash
cd backend
composer install
# Sesuaikan koneksi database pada backend/config/db.php
# Pastikan virtual host / Laravel Herd mengarah ke backend/web ([http://simrs-api.test](http://simrs-api.test))
```
