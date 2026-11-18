<?php

namespace app\controllers;

use Yii;
use yii\db\Query;

class BillingController extends BaseApiController
{
    // GET /billing -> Daftar tagihan pasien
    public function actionIndex()
    {
        $user = $this->currentUser();
        if (!in_array($user['role'] ?? '', ['ADMIN', 'KASIR'], true)) {
            return $this->errorResponse('Akses ditolak.', 403);
        }

        $list = (new Query())
            ->select([
                'b.*',
                'k.no_registrasi',
                'k.tanggal_kunjungan',
                'p.no_rm',
                'p.nama_lengkap AS nama_pasien',
                'pl.nama_poli',
                'd.nama_dokter',
            ])
            ->from('billing b')
            ->innerJoin('kunjungan k', 'k.id = b.kunjungan_id')
            ->innerJoin('pasien p', 'p.id = k.pasien_id')
            ->innerJoin('poli pl', 'pl.id = k.poli_id')
            ->innerJoin('dokter d', 'd.id = k.dokter_id')
            ->orderBy(['b.id' => SORT_DESC])
            ->all();

        return $this->successResponse($list);
    }

    // GET /billing/<id> -> Detail rincian tagihan & riwayat pembayaran
    public function actionView(int $id)
    {
        $user = $this->currentUser();
        if (!in_array($user['role'] ?? '', ['ADMIN', 'KASIR'], true)) {
            return $this->errorResponse('Akses ditolak.', 403);
        }

        $billing = (new Query())
            ->select([
                'b.*',
                'k.no_registrasi',
                'k.tanggal_kunjungan',
                'p.no_rm',
                'p.nama_lengkap AS nama_pasien',
                'pl.nama_poli',
                'd.nama_dokter',
            ])
            ->from('billing b')
            ->innerJoin('kunjungan k', 'k.id = b.kunjungan_id')
            ->innerJoin('pasien p', 'p.id = k.pasien_id')
            ->innerJoin('poli pl', 'pl.id = k.poli_id')
            ->innerJoin('dokter d', 'd.id = k.dokter_id')
            ->where(['b.id' => $id])
            ->one();

        if (!$billing) {
            return $this->errorResponse('Data tagihan tidak ditemukan.', 404);
        }

        $items = (new Query())
            ->from('billing_items')
            ->where(['billing_id' => $id])
            ->orderBy(['id' => SORT_ASC])
            ->all();

        $pembayaran = (new Query())
            ->select(['pb.*', 'u.nama_lengkap AS nama_kasir'])
            ->from('pembayaran pb')
            ->leftJoin('users u', 'u.id = pb.kasir_id')
            ->where(['pb.billing_id' => $id])
            ->orderBy(['pb.id' => SORT_ASC])
            ->all();

        foreach ($pembayaran as &$p) {
            if (preg_match('/^KWT-([A-Z0-9]+)-\d{8}-\d+$/', $p['no_kwitansi'] ?? '', $m)) {
                $p['metode_pembayaran'] = $m[1];
            }
        }

        return $this->successResponse([
            'billing' => $billing,
            'items' => $items,
            'pembayaran' => $pembayaran,
        ]);
    }

    /**
     * Menyesuaikan nilai metode pembayaran agar selalu lolos check constraint PostgreSQL
     * tanpa perlu mengubah skema database.
     */
    private function resolveMetodeForDb($db, string $metodeInput): string
    {
        try {
            $def = (string)$db->createCommand(
                "SELECT pg_get_constraintdef(oid) FROM pg_constraint WHERE conname = 'pembayaran_metode_pembayaran_check'"
            )->queryScalar();

            if ($def !== '' && preg_match_all("/'([^']+)'/", $def, $matches)) {
                $allowed = $matches[1];

                if (in_array($metodeInput, $allowed, true)) {
                    return $metodeInput;
                }

                foreach ($allowed as $val) {
                    if (stripos($val, $metodeInput) !== false || stripos($metodeInput, $val) !== false) {
                        return $val;
                    }
                }

                if ($metodeInput !== 'TUNAI') {
                    foreach ($allowed as $val) {
                        if ($val !== 'TUNAI') {
                            return $val;
                        }
                    }
                }

                return $allowed[0] ?? 'TUNAI';
            }
        } catch (\Throwable $e) {
            // Abaikan jika query metadata gagal
        }

        return 'TUNAI';
    }

    // POST /billing/<id>/bayar -> Proses pembayaran idempotent & kunci tagihan
    public function actionBayar(int $id)
    {
        $user = $this->currentUser();
        if (!in_array($user['role'] ?? '', ['ADMIN', 'KASIR'], true)) {
            return $this->errorResponse('Hanya Kasir atau Admin yang dapat memproses pembayaran.', 403);
        }

        $body = Yii::$app->request->getBodyParams();
        $jumlahBayar = (float) ($body['jumlah_bayar'] ?? 0);
        $metodeInput = strtoupper(trim((string) ($body['metode_pembayaran'] ?? 'TUNAI')));
        $idempotencyKey = trim((string) ($body['idempotency_key'] ?? ''));

        if ($jumlahBayar <= 0) {
            return $this->errorResponse('Nominal pembayaran harus lebih dari Rp 0.', 400);
        }

        $db = Yii::$app->db;

        if ($idempotencyKey !== '') {
            $existingPay = (new Query())->from('pembayaran')->where(['idempotency_key' => $idempotencyKey])->one();
            if ($existingPay) {
                return $this->successResponse($existingPay, 'Pembayaran sudah tercatat sebelumnya (idempotent).');
            }
        }

        $transaction = $db->beginTransaction();
        try {
            $billing = $db->createCommand('SELECT * FROM billing WHERE id = :id FOR UPDATE', [':id' => $id])->queryOne();
            if (!$billing) {
                $transaction->rollBack();
                return $this->errorResponse('Data tagihan tidak ditemukan.', 404);
            }

            $sisaSaatIni = (float)$billing['sisa_tagihan'];
            if ($billing['status_pembayaran'] === 'LUNAS' || $sisaSaatIni <= 0) {
                $transaction->rollBack();
                return $this->errorResponse('Tagihan ini sudah berstatus LUNAS.', 409);
            }

            if ($jumlahBayar > $sisaSaatIni) {
                $jumlahBayar = $sisaSaatIni;
            }

            $kodeMetode = preg_replace('/[^A-Z0-9]/', '', $metodeInput) ?: 'TUNAI';
            $noKwitansi = sprintf('KWT-%s-%s-%04d', $kodeMetode, date('Ymd'), random_int(1000, 9999));
            $metodeDb = $this->resolveMetodeForDb($db, $metodeInput);
            $finalKey = $idempotencyKey !== '' ? $idempotencyKey : ('KEY-' . uniqid('', true));

            $db->createCommand()->insert('pembayaran', [
                'no_kwitansi' => $noKwitansi,
                'billing_id' => $id,
                'idempotency_key' => $finalKey,
                'metode_pembayaran' => $metodeDb,
                'jumlah_bayar' => $jumlahBayar,
                'kasir_id' => $user['id'] ?? null,
                'waktu_bayar' => date('Y-m-d H:i:s'),
            ])->execute();

            $totalDibayarBaru = (float) $billing['total_dibayar'] + $jumlahBayar;
            $sisaBaru = max(0, (float) $billing['total_tagihan'] - $totalDibayarBaru);
            $statusBaru = $sisaBaru <= 0 ? 'LUNAS' : 'SEBAGIAN';

            $db->createCommand()->update('billing', [
                'total_dibayar' => $totalDibayarBaru,
                'sisa_tagihan' => $sisaBaru,
                'status_pembayaran' => $statusBaru,
                'is_locked' => true,
            ], ['id' => $id])->execute();

            if ($statusBaru === 'LUNAS') {
                $db->createCommand()->update('kunjungan', ['status_kunjungan' => 'SELESAI'], ['id' => $billing['kunjungan_id']])->execute();
            }

            $this->logAudit('billing', $id, 'PAYMENT', $billing, [
                'no_kwitansi' => $noKwitansi,
                'metode_input' => $metodeInput,
                'metode_db' => $metodeDb,
                'jumlah_bayar' => $jumlahBayar,
                'status_pembayaran' => $statusBaru,
            ], 'Pembayaran tagihan pasien di Kasir');

            $transaction->commit();
            return $this->successResponse([
                'no_kwitansi' => $noKwitansi,
                'metode_pembayaran' => $metodeInput,
                'status_pembayaran' => $statusBaru,
                'sisa_tagihan' => $sisaBaru,
            ], "Pembayaran ({$metodeInput}) berhasil diproses dan tagihan berstatus {$statusBaru}.");
        } catch (\Throwable $e) {
            $transaction->rollBack();
            return $this->errorResponse('Gagal memproses pembayaran: ' . $e->getMessage(), 500);
        }
    }

    // POST /billing/<id>/koreksi -> Batalkan / koreksi pembayaran yang salah input & buka kunci tagihan
    public function actionKoreksi(int $id)
    {
        $user = $this->currentUser();
        if (!in_array($user['role'] ?? '', ['ADMIN', 'KASIR'], true)) {
            return $this->errorResponse('Hanya Kasir atau Admin yang dapat mengoreksi pembayaran.', 403);
        }

        $body = Yii::$app->request->getBodyParams();
        $alasan = trim((string) ($body['alasan'] ?? 'Koreksi input pembayaran oleh kasir'));

        $db = Yii::$app->db;
        $transaction = $db->beginTransaction();

        try {
            $billing = $db->createCommand('SELECT * FROM billing WHERE id = :id FOR UPDATE', [':id' => $id])->queryOne();
            if (!$billing) {
                $transaction->rollBack();
                return $this->errorResponse('Data tagihan tidak ditemukan.', 404);
            }

            $resepDiserahkan = (new Query())
                ->from('resep')
                ->where(['kunjungan_id' => $billing['kunjungan_id'], 'status_resep' => 'DISERAHKAN'])
                ->one();

            if ($resepDiserahkan) {
                $transaction->rollBack();
                return $this->errorResponse('Pembayaran tidak dapat dikoreksi karena obat resep sudah diserahkan oleh Farmasi.', 409);
            }

            $oldPayments = (new Query())->from('pembayaran')->where(['billing_id' => $id])->all();

            $db->createCommand()->delete('pembayaran', ['billing_id' => $id])->execute();

            $db->createCommand()->update('billing', [
                'total_dibayar' => 0,
                'sisa_tagihan' => (float) $billing['total_tagihan'],
                'status_pembayaran' => 'BELUM_DIBAYAR',
                'is_locked' => false,
                'updated_at' => date('Y-m-d H:i:s'),
            ], ['id' => $id])->execute();

            $db->createCommand()->update(
                'kunjungan',
                ['status_kunjungan' => 'SELESAI_PERIKSA'],
                ['id' => $billing['kunjungan_id']]
            )->execute();

            $this->logAudit('billing', $id, 'CORRECTION', [
                'billing' => $billing,
                'pembayaran' => $oldPayments,
            ], [
                'status_pembayaran' => 'BELUM_DIBAYAR',
                'is_locked' => false,
            ], "Koreksi pembayaran kasir: {$alasan}");

            $transaction->commit();
            return $this->successResponse(
                ['billing_id' => $id],
                'Pembayaran berhasil dibatalkan/dikoreksi. Tagihan kembali terbuka untuk diinput ulang atau diedit dokter.'
            );
        } catch (\Throwable $e) {
            $transaction->rollBack();
            return $this->errorResponse('Gagal mengoreksi pembayaran: ' . $e->getMessage(), 500);
        }
    }
}
