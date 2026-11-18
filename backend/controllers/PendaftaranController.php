<?php

namespace app\controllers;

use Yii;
use yii\db\Query;
use yii\db\IntegrityException;

class PendaftaranController extends BaseApiController
{
    private const HARI_INDONESIA = [
        'Sunday' => 'Minggu',
        'Monday' => 'Senin',
        'Tuesday' => 'Selasa',
        'Wednesday' => 'Rabu',
        'Thursday' => 'Kamis',
        'Friday' => 'Jumat',
        'Saturday' => 'Sabtu',
    ];

    // GET /pendaftaran?tanggal=2026-11-15&poli_id=...&status=...
    public function actionIndex()
    {
        $tanggal = Yii::$app->request->get('tanggal', date('Y-m-d'));
        $poliId = Yii::$app->request->get('poli_id');
        $dokterId = Yii::$app->request->get('dokter_id');
        $status = Yii::$app->request->get('status');

        $query = (new Query())
            ->select([
                'k.*',
                'p.no_rm',
                'p.nik',
                'p.nama_lengkap AS nama_pasien',
                'p.jenis_kelamin',
                'p.tanggal_lahir',
                'pl.kode_poli',
                'pl.nama_poli',
                'd.nama_dokter',
                'd.spesialisasi',
                'b.id AS billing_id',
                'b.no_invoice',
                'b.total_tagihan',
                'b.status_pembayaran'
            ])
            ->from('kunjungan k')
            ->innerJoin('pasien p', 'p.id = k.pasien_id')
            ->innerJoin('poli pl', 'pl.id = k.poli_id')
            ->innerJoin('dokter d', 'd.id = k.dokter_id')
            ->leftJoin('billing b', 'b.kunjungan_id = k.id');

        if ($tanggal !== 'ALL') {
            $query->andWhere(['k.tanggal_kunjungan' => $tanggal]);
        }
        if ($poliId) {
            $query->andWhere(['k.poli_id' => $poliId]);
        }
        if ($dokterId) {
            $query->andWhere(['k.dokter_id' => $dokterId]);
        }
        if ($status) {
            $query->andWhere(['k.status_kunjungan' => $status]);
        }

        // Jika yang login adalah DOKTER, otomatis filter hanya pasien miliknya kecuali minta semua
        $user = $this->currentUser();
        if (($user['role'] ?? '') === 'DOKTER' && !empty($user['dokter_id']) && !$dokterId) {
            $query->andWhere(['k.dokter_id' => $user['dokter_id']]);
        }

        $items = $query->orderBy(['k.no_antrean' => SORT_ASC, 'k.id' => SORT_DESC])->all();
        return $this->successResponse($items);
    }

    // POST /pendaftaran
    // POST /pendaftaran (Mendukung Pasien Lama maupun Pasien Baru dalam 1 transaksi)
    public function actionCreate()
    {
        $role = $this->currentUser()['role'] ?? '';
        if (!in_array($role, ['ADMIN', 'PENDAFTARAN'], true)) {
            return $this->errorResponse('Hanya Petugas Pendaftaran atau Admin yang dapat mendaftarkan kunjungan.', 403);
        }

        $body = Yii::$app->request->getBodyParams();
        $tipePasien = strtoupper(trim($body['tipe_pasien'] ?? 'LAMA'));
        $pasienId = (int) ($body['pasien_id'] ?? 0);
        $poliId = (int) ($body['poli_id'] ?? 0);
        $dokterId = (int) ($body['dokter_id'] ?? 0);
        $tanggal = $body['tanggal_kunjungan'] ?? date('Y-m-d');

        if (!$poliId || !$dokterId) {
            return $this->errorResponse('Poliklinik dan Dokter tujuan wajib dipilih.', 400);
        }

        // 1. Validasi Jadwal Praktik Dokter pada hari kunjungan
        $namaHari = self::HARI_INDONESIA[date('l', strtotime($tanggal))] ?? '';
        $jadwal = (new Query())
            ->from('jadwal_dokter')
            ->where(['dokter_id' => $dokterId, 'hari' => $namaHari])
            ->one();

        if (!$jadwal) {
            return $this->errorResponse("Dokter tidak memiliki jadwal praktik pada hari {$namaHari} ({$tanggal}).", 422);
        }

        $db = Yii::$app->db;
        $transaction = $db->beginTransaction();

        try {
            // Jika PASIEN BARU, buat data pasien & No. RM otomatis dalam transaksi yang sama
            $noRmBaru = null;
            if ($tipePasien === 'BARU') {
                $nik = trim($body['nik'] ?? '');
                $namaLengkap = trim($body['nama_lengkap'] ?? '');
                $tglLahir = trim($body['tanggal_lahir'] ?? '');
                $jk = strtoupper(trim($body['jenis_kelamin'] ?? 'L'));

                if ($nik === '' || $namaLengkap === '' || $tglLahir === '') {
                    $transaction->rollBack();
                    return $this->errorResponse('NIK, Nama Lengkap, dan Tanggal Lahir wajib diisi untuk pasien baru.', 400);
                }

                $nextPasienId = (int) $db->createCommand("SELECT COALESCE(MAX(id), 0) + 1 FROM pasien")->queryScalar();
                $noRmBaru = sprintf('RM-%s-%04d', date('Y'), $nextPasienId);

                $db->createCommand()->insert('pasien', [
                    'no_rm' => $noRmBaru,
                    'nik' => $nik,
                    'nama_lengkap' => $namaLengkap,
                    'tanggal_lahir' => $tglLahir,
                    'jenis_kelamin' => in_array($jk, ['L', 'P'], true) ? $jk : 'L',
                    'alamat' => $body['alamat'] ?? null,
                    'no_telepon' => $body['no_telepon'] ?? null,
                ])->execute();

                $pasienId = (int) $db->getLastInsertID();
            } elseif (!$pasienId) {
                $transaction->rollBack();
                return $this->errorResponse('Silakan pilih pasien lama yang terdaftar.', 400);
            }

            // 2. SKENARIO D.1: Pessimistic Lock pada baris dokter agar nomor antrean tidak bentrok
            $dokter = $db->createCommand('SELECT * FROM dokter WHERE id = :id AND poli_id = :poli FOR UPDATE', [
                ':id' => $dokterId,
                ':poli' => $poliId,
            ])->queryOne();

            if (!$dokter) {
                $transaction->rollBack();
                return $this->errorResponse('Dokter tidak ditemukan atau tidak sesuai dengan poli yang dipilih.', 404);
            }

            $poli = (new Query())->from('poli')->where(['id' => $poliId])->one();

            $lastAntrean = (int) $db->createCommand(
                'SELECT COALESCE(MAX(no_antrean), 0) FROM kunjungan WHERE dokter_id = :dokter AND tanggal_kunjungan = :tgl',
                [':dokter' => $dokterId, ':tgl' => $tanggal]
            )->queryScalar();

            if ($lastAntrean >= (int) $jadwal['kuota_harian']) {
                $transaction->rollBack();
                return $this->errorResponse('Kuota praktik dokter untuk tanggal tersebut sudah penuh.', 422);
            }

            $noAntrean = $lastAntrean + 1;
            $kodeAntrean = sprintf('%s-%03d', $poli['kode_poli'], $noAntrean);
            $noRegistrasi = sprintf('REG-%s-%04d', date('Ymd', strtotime($tanggal)), random_int(1000, 9999));

            // 3. Insert Kunjungan
            $db->createCommand()->insert('kunjungan', [
                'no_registrasi' => $noRegistrasi,
                'pasien_id' => $pasienId,
                'poli_id' => $poliId,
                'dokter_id' => $dokterId,
                'tanggal_kunjungan' => $tanggal,
                'no_antrean' => $noAntrean,
                'kode_antrean' => $kodeAntrean,
                'status_kunjungan' => 'MENUNGGU',
                'created_by' => $this->currentUser()['id'] ?? null,
            ])->execute();

            $kunjunganId = (int) $db->getLastInsertID();

            // 4. Buat Draft Billing & masukkan Biaya Pendaftaran Poli secara otomatis
            $biayaDaftar = (float) $poli['biaya_pendaftaran'];
            $noInvoice = sprintf('INV-%s-%04d', date('Ymd', strtotime($tanggal)), $kunjunganId);

            $db->createCommand()->insert('billing', [
                'no_invoice' => $noInvoice,
                'kunjungan_id' => $kunjunganId,
                'total_tagihan' => $biayaDaftar,
                'total_dibayar' => 0,
                'sisa_tagihan' => $biayaDaftar,
                'status_pembayaran' => 'BELUM_DIBAYAR',
            ])->execute();

            $billingId = (int) $db->getLastInsertID();

            $db->createCommand()->insert('billing_items', [
                'billing_id' => $billingId,
                'jenis_item' => 'PENDAFTARAN',
                'referensi_id' => $kunjunganId,
                'deskripsi' => 'Biaya Pendaftaran ' . $poli['nama_poli'],
                'jumlah' => 1,
                'harga_satuan' => $biayaDaftar,
                'subtotal' => $biayaDaftar,
            ])->execute();

            $transaction->commit();

            return $this->successResponse([
                'id' => $kunjunganId,
                'no_rm' => $noRmBaru,
                'no_registrasi' => $noRegistrasi,
                'kode_antrean' => $kodeAntrean,
                'no_antrean' => $noAntrean,
                'no_invoice' => $noInvoice,
                'biaya_pendaftaran' => $biayaDaftar,
            ], 'Pendaftaran kunjungan berhasil.', 201);
        } catch (IntegrityException $e) {
            $transaction->rollBack();
            return $this->errorResponse(
                'Duplikasi data terdeteksi: NIK sudah terdaftar atau pasien sudah memiliki kunjungan aktif pada poli & tanggal yang sama.',
                409
            );
        } catch (\Throwable $e) {
            $transaction->rollBack();
            return $this->errorResponse('Gagal memproses pendaftaran: ' . $e->getMessage(), 500);
        }
    }
}
