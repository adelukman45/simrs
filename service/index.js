const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });

const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const Joi = require('joi');
const { Pool } = require('pg');
const { verifyToken, authorizeRoles } = require('./middleware/authMiddleware');
const { validateBody } = require('./middleware/validateMiddleware');

const app = express();
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

// Simple In-Memory Cache untuk Dashboard (Skenario D.6 - Performa Query)
const dashboardCache = new Map();
const CACHE_TTL_MS = 15000; // 15 detik

// ============================================================================
// 1. HEALTH CHECK & DOKUMENTASI ENDPOINT API (Bagian C.5)
// ============================================================================
app.get('/api/health', async (req, res, next) => {
  try {
    const result = await pool.query('SELECT NOW()');
    res.json({
      status: 'success',
      service: 'Node.js SIMRS Integration & Analytics Service',
      database: process.env.DB_NAME,
      db_time: result.rows[0].now,
    });
  } catch (err) {
    next(err);
  }
});

app.get('/api/docs', (req, res) => {
  res.json({
    service: 'SIMRS Node.js Backend Services',
    version: '1.0.0',
    auth: 'Bearer JWT (Issued by Yii2 Core Backend)',
    endpoints: [
      { method: 'GET', path: '/api/health', role: 'Public', description: 'Cek status service & koneksi PostgreSQL' },
      { method: 'GET', path: '/api/lab', role: 'Authenticated', description: 'Daftar permintaan & hasil pemeriksaan laboratorium (filter ?status=DIMINTA|SELESAI)' },
      { method: 'PUT', path: '/api/lab/:id/hasil', role: 'LABORATORIUM, ADMIN', description: 'Input hasil pemeriksaan lab & sinkronisasi outbox' },
      { method: 'POST', path: '/api/lab/sync-outbox', role: 'LABORATORIUM, ADMIN', description: 'Retry sinkronisasi event integration_outbox yang tertunda (Skenario D.5)' },
      { method: 'GET', path: '/api/dashboard', role: 'Authenticated', description: 'Agregasi statistik kunjungan, poli, tindakan, pendapatan, obat, & status billing (?start_date=YYYY-MM-DD&end_date=YYYY-MM-DD)' },
    ],
  });
});

// ============================================================================
// 2. MODUL 6: PEMERIKSAAN PENUNJANG / LABORATORIUM
// ============================================================================

// GET /api/lab?status=DIMINTA&kunjungan_id=...
app.get('/api/lab', verifyToken, async (req, res, next) => {
  try {
    const { status, kunjungan_id } = req.query;
    const conditions = [];
    const params = [];

    if (status) {
      params.push(status.toUpperCase());
      conditions.push(`pl.status_lab = $${params.length}`);
    }
    if (kunjungan_id) {
      params.push(kunjungan_id);
      conditions.push(`pl.kunjungan_id = $${params.length}`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const sql = `
      SELECT 
        pl.*,
        tm.kode_tindakan, tm.nama_tindakan, tm.tarif,
        k.no_registrasi, k.tanggal_kunjungan,
        p.no_rm, p.nama_lengkap AS nama_pasien, p.jenis_kelamin, p.tanggal_lahir,
        d.nama_dokter, po.nama_poli,
        u.nama_lengkap AS nama_petugas_lab
      FROM pemeriksaan_lab pl
      INNER JOIN tindakan_medis tm ON tm.id = pl.tindakan_id
      INNER JOIN kunjungan k ON k.id = pl.kunjungan_id
      INNER JOIN pasien p ON p.id = k.pasien_id
      INNER JOIN dokter d ON d.id = k.dokter_id
      INNER JOIN poli po ON po.id = k.poli_id
      LEFT JOIN users u ON u.id = pl.petugas_lab_id
      ${whereClause}
      ORDER BY pl.waktu_permintaan DESC
    `;

    const { rows } = await pool.query(sql, params);
    res.json({ status: 'success', message: 'Data pemeriksaan laboratorium berhasil diambil.', data: rows });
  } catch (err) {
    next(err);
  }
});

// Schema validasi Joi untuk input hasil lab
const hasilLabSchema = Joi.object({
  hasil_pemeriksaan: Joi.string().min(2).required().messages({
    'string.empty': 'Hasil pemeriksaan wajib diisi.',
    'any.required': 'Hasil pemeriksaan wajib diisi.',
  }),
  nilai_rujukan: Joi.string().allow('', null).optional(),
});

// PUT /api/lab/:id/hasil -> Input hasil lab oleh Petugas Laboratorium
app.put(
  '/api/lab/:id/hasil',
  verifyToken,
  authorizeRoles('LABORATORIUM', 'ADMIN'),
  validateBody(hasilLabSchema),
  async (req, res, next) => {
    const client = await pool.connect();
    try {
      const labId = parseInt(req.params.id, 10);
      const { hasil_pemeriksaan, nilai_rujukan } = req.body;

      await client.query('BEGIN');

      const checkRes = await client.query('SELECT * FROM pemeriksaan_lab WHERE id = $1 FOR UPDATE', [labId]);
      if (checkRes.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ status: 'error', message: 'Permintaan pemeriksaan lab tidak ditemukan.' });
      }

      const updateRes = await client.query(
        `UPDATE pemeriksaan_lab 
         SET hasil_pemeriksaan = $1, 
             nilai_rujukan = $2, 
             status_lab = 'SELESAI', 
             petugas_lab_id = $3, 
             waktu_selesai = NOW()
         WHERE id = $4
         RETURNING *`,
        [hasil_pemeriksaan, nilai_rujukan || '-', req.user.uid, labId]
      );

      // Tandai event di integration_outbox (jika ada) sebagai SYNCED (Skenario D.5)
      await client.query(
        `UPDATE integration_outbox 
         SET status = 'SYNCED', synced_at = NOW() 
         WHERE event_type = 'LAB_ORDER_CREATED' 
           AND (payload->>'lab_id')::int = $1 
           AND status = 'PENDING_SYNC'`,
        [labId]
      );

      // Catat ke audit_logs
      await client.query(
        `INSERT INTO audit_logs (user_id, tabel_target, record_id, aksi, data_lama, data_baru, keterangan)
         VALUES ($1, 'pemeriksaan_lab', $2, 'UPDATE', $3, $4, 'Input hasil pemeriksaan laboratorium via Node.js service')`,
        [req.user.uid, labId, JSON.stringify(checkRes.rows[0]), JSON.stringify(updateRes.rows[0])]
      );

      await client.query('COMMIT');
      dashboardCache.clear(); // Invalidate cache dashboard

      res.json({
        status: 'success',
        message: 'Hasil pemeriksaan laboratorium berhasil disimpan.',
        data: updateRes.rows[0],
      });
    } catch (err) {
      await client.query('ROLLBACK');
      next(err);
    } finally {
      client.release();
    }
  }
);

// POST /api/lab/sync-outbox -> Pemulihan event tertunda saat service sempat down (Skenario D.5)
app.post('/api/lab/sync-outbox', verifyToken, authorizeRoles('LABORATORIUM', 'ADMIN'), async (req, res, next) => {
  try {
    const result = await pool.query(
      `UPDATE integration_outbox 
       SET status = 'SYNCED', synced_at = NOW(), retry_count = retry_count + 1
       WHERE status = 'PENDING_SYNC'
       RETURNING id, event_type, payload, synced_at`
    );

    res.json({
      status: 'success',
      message: `${result.rowCount} event integrasi berhasil disinkronkan ulang.`,
      data: result.rows,
    });
  } catch (err) {
    next(err);
  }
});

// ============================================================================
// 3. MODUL 8: DASHBOARD & LAPORAN OPERASIONAL RAWAT JALAN
// ============================================================================
app.get('/api/dashboard', verifyToken, async (req, res, next) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const startDate = req.query.start_date || today;
    const endDate = req.query.end_date || today;

    const cacheKey = `${startDate}_${endDate}`;
    const cached = dashboardCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      return res.json({ status: 'success', source: 'cache', data: cached.payload });
    }

    // Jalankan seluruh query agregasi secara paralel (Promise.all) untuk efisiensi performa (Skenario D.6)
    const [
      kunjunganTotalRes,
      kunjunganPerPoliRes,
      tindakanRes,
      pendapatanRes,
      rekapObatRes,
      statusBillingRes,
    ] = await Promise.all([
      // 1. Jumlah kunjungan pasien
      pool.query(
        `SELECT 
           COUNT(*)::int AS total_kunjungan,
           COUNT(*) FILTER (WHERE status_kunjungan = 'MENUNGGU')::int AS menunggu,
           COUNT(*) FILTER (WHERE status_kunjungan = 'SELESAI_PERIKSA')::int AS selesai_periksa,
           COUNT(*) FILTER (WHERE status_kunjungan = 'SELESAI')::int AS selesai
         FROM kunjungan
         WHERE tanggal_kunjungan BETWEEN $1 AND $2`,
        [startDate, endDate]
      ),

      // 2. Jumlah kunjungan berdasarkan poli
      pool.query(
        `SELECT po.kode_poli, po.nama_poli, COUNT(k.id)::int AS jumlah_kunjungan
         FROM poli po
         LEFT JOIN kunjungan k ON k.poli_id = po.id AND k.tanggal_kunjungan BETWEEN $1 AND $2
         GROUP BY po.id, po.kode_poli, po.nama_poli
         ORDER BY jumlah_kunjungan DESC`,
        [startDate, endDate]
      ),

      // 3. Jumlah & rincian tindakan medis
      pool.query(
        `SELECT tm.kode_tindakan, tm.nama_tindakan, COALESCE(SUM(kt.jumlah), 0)::int AS total_dilakukan, COALESCE(SUM(kt.subtotal), 0)::numeric AS total_nilai
         FROM kunjungan_tindakan kt
         INNER JOIN tindakan_medis tm ON tm.id = kt.tindakan_id
         INNER JOIN kunjungan k ON k.id = kt.kunjungan_id
         WHERE k.tanggal_kunjungan BETWEEN $1 AND $2
         GROUP BY tm.id, tm.kode_tindakan, tm.nama_tindakan
         ORDER BY total_dilakukan DESC`,
        [startDate, endDate]
      ),

      // 4. Ringkasan pendapatan (dari pembayaran masuk & total tagihan)
      pool.query(
        `SELECT 
           COALESCE(SUM(total_tagihan), 0)::numeric AS total_potensi_pendapatan,
           COALESCE(SUM(total_dibayar), 0)::numeric AS total_pendapatan_diterima,
           COALESCE(SUM(sisa_tagihan), 0)::numeric AS total_piutang
         FROM billing b
         INNER JOIN kunjungan k ON k.id = b.kunjungan_id
         WHERE k.tanggal_kunjungan BETWEEN $1 AND $2`,
        [startDate, endDate]
      ),

      // 5. Rekap penggunaan obat
      pool.query(
        `SELECT o.kode_obat, o.nama_obat, o.satuan, o.stok AS sisa_stok, COALESCE(SUM(rd.jumlah), 0)::int AS total_keluar
         FROM resep_detail rd
         INNER JOIN resep r ON r.id = rd.resep_id
         INNER JOIN obat o ON o.id = rd.obat_id
         WHERE r.status_resep = 'DISERAHKAN' AND DATE(r.waktu_serah) BETWEEN $1 AND $2
         GROUP BY o.id, o.kode_obat, o.nama_obat, o.satuan, o.stok
         ORDER BY total_keluar DESC`,
        [startDate, endDate]
      ),

      // 6. Status pembayaran
      pool.query(
        `SELECT b.status_pembayaran, COUNT(b.id)::int AS jumlah_tagihan, COALESCE(SUM(b.total_tagihan), 0)::numeric AS nominal
         FROM billing b
         INNER JOIN kunjungan k ON k.id = b.kunjungan_id
         WHERE k.tanggal_kunjungan BETWEEN $1 AND $2
         GROUP BY b.status_pembayaran`,
        [startDate, endDate]
      ),
    ]);

    const payload = {
      periode: { start_date: startDate, end_date: endDate },
      ringkasan_kunjungan: kunjunganTotalRes.rows[0],
      kunjungan_per_poli: kunjunganPerPoliRes.rows,
      rekap_tindakan: tindakanRes.rows,
      ringkasan_pendapatan: pendapatanRes.rows[0],
      rekap_penggunaan_obat: rekapObatRes.rows,
      status_pembayaran: statusBillingRes.rows,
    };

    dashboardCache.set(cacheKey, { timestamp: Date.now(), payload });

    res.json({ status: 'success', source: 'database', data: payload });
  } catch (err) {
    next(err);
  }
});

// ============================================================================
// 4. GLOBAL ERROR HANDLER KONSISTEN (Bagian C.4)
// ============================================================================
app.use((req, res) => {
  res.status(404).json({
    status: 'error',
    message: `Endpoint ${req.method} ${req.originalUrl} tidak ditemukan di Node.js service.`,
  });
});

app.use((err, req, res, next) => {
  console.error('[Node.js Error]:', err);
  res.status(err.status || 500).json({
    status: 'error',
    message: err.message || 'Terjadi kesalahan internal pada layanan Node.js.',
  });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Node.js service berjalan di http://127.0.0.1:${PORT}`);
});