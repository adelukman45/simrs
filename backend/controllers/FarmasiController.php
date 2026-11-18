<?php

namespace app\controllers;

use Yii;
use yii\db\Query;

class FarmasiController extends BaseApiController
{
    // GET /farmasi?status=MENUNGGU
    public function actionIndex()
    {
        $status = Yii::$app->request->get('status', '');
        $query = (new Query())
            ->select([
                'r.*',
                'k.no_registrasi',
                'k.tanggal_kunjungan',
                'p.no_rm',
                'p.nama_lengkap AS nama_pasien',
                'pl.nama_poli',
                'd.nama_dokter',
                'b.no_invoice',
                'b.total_tagihan',
                'b.status_pembayaran',
            ])
            ->from('resep r')
            ->innerJoin('kunjungan k', 'k.id = r.kunjungan_id')
            ->innerJoin('pasien p', 'p.id = k.pasien_id')
            ->innerJoin('poli pl', 'pl.id = k.poli_id')
            ->innerJoin('dokter d', 'd.id = r.dokter_id')
            ->leftJoin('billing b', 'b.kunjungan_id = r.kunjungan_id')
            ->orderBy(['r.id' => SORT_DESC]);

        if ($status !== '') {
            $query->andWhere(['r.status_resep' => $status]);
        }

        $reseps = $query->all();

        foreach ($reseps as &$r) {
            $r['items'] = (new Query())
                ->select(['rd.*', 'o.kode_obat', 'o.nama_obat', 'o.satuan', 'o.stok AS stok_tersedia'])
                ->from('resep_detail rd')
                ->innerJoin('obat o', 'o.id = rd.obat_id')
                ->where(['rd.resep_id' => $r['id']])
                ->all();
        }

        return $this->successResponse($reseps);
    }

    // POST /farmasi/<id>/serahkan
    public function actionSerahkan(int $id)
    {
        $user = $this->currentUser();
        if (!in_array($user['role'] ?? '', ['ADMIN', 'FARMASI'], true)) {
            return $this->errorResponse('Hanya Petugas Farmasi atau Admin yang dapat menyerahkan obat.', 403);
        }

        $db = Yii::$app->db;
        $transaction = $db->beginTransaction();

        try {
            // Kunci baris resep agar tidak diproses dua kali
            $resep = $db->createCommand('SELECT * FROM resep WHERE id = :id FOR UPDATE', [':id' => $id])->queryOne();
            if (!$resep) {
                $transaction->rollBack();
                return $this->errorResponse('Data resep tidak ditemukan.', 404);
            }
            if ($resep['status_resep'] !== 'MENUNGGU') {
                $transaction->rollBack();
                return $this->errorResponse("Resep ini berstatus {$resep['status_resep']} dan tidak dapat diproses ulang.", 409);
            }

            // Validasi alur: Pasien wajib LUNAS di Kasir terlebih dahulu sebelum obat diserahkan
            $billing = $db->createCommand('SELECT * FROM billing WHERE kunjungan_id = :kid FOR UPDATE', [':kid' => $resep['kunjungan_id']])->queryOne();
            if (!$billing || $billing['status_pembayaran'] !== 'LUNAS') {
                $transaction->rollBack();
                $statusSaatIni = $billing['status_pembayaran'] ?? 'BELUM_DIBAYAR';
                return $this->errorResponse(
                    "Obat belum dapat diserahkan karena tagihan pasien berstatus {$statusSaatIni}. Harap selesaikan pembayaran di Kasir terlebih dahulu.",
                    409
                );
            }

            $details = (new Query())->from('resep_detail')->where(['resep_id' => $id])->all();

            // SKENARIO D.2: Kunci baris setiap obat dengan FOR UPDATE sebelum cek & kurangi stok
            foreach ($details as $item) {
                $obat = $db->createCommand('SELECT * FROM obat WHERE id = :oid FOR UPDATE', [':oid' => $item['obat_id']])->queryOne();
                if (!$obat || (int) $obat['stok'] < (int) $item['jumlah']) {
                    $transaction->rollBack();
                    $namaObat = $obat['nama_obat'] ?? 'Obat';
                    $sisaStok = $obat['stok'] ?? 0;
                    return $this->errorResponse(
                        "Transaksi dibatalkan: Stok '{$namaObat}' tidak mencukupi (tersisa: {$sisaStok}, diminta: {$item['jumlah']}).",
                        409
                    );
                }

                // Kurangi stok obat secara aman
                $db->createCommand('UPDATE obat SET stok = stok - :qty, updated_at = NOW() WHERE id = :oid', [
                    ':qty' => $item['jumlah'],
                    ':oid' => $item['obat_id'],
                ])->execute();
            }

            // Update status resep menjadi DISERAHKAN
            $db->createCommand()->update('resep', [
                'status_resep' => 'DISERAHKAN',
                'petugas_farmasi_id' => $user['id'],
                'waktu_serah' => date('Y-m-d H:i:s'),
            ], ['id' => $id])->execute();

            $transaction->commit();
            return $this->successResponse(['resep_id' => $id], 'Penyerahan obat berhasil dan stok gudang farmasi telah diperbarui.');
        } catch (\Throwable $e) {
            $transaction->rollBack();
            return $this->errorResponse('Gagal memproses penyerahan obat: ' . $e->getMessage(), 500);
        }
    }
}
