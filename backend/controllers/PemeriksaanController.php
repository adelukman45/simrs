<?php

namespace app\controllers;

use Yii;
use yii\db\Query;

class PemeriksaanController extends BaseApiController
{
    // GET /pemeriksaan/master -> Katalog tindakan poliklinik, lab, dan obat untuk dokter
    public function actionMaster()
    {
        $user = $this->currentUser();
        if (!in_array($user['role'] ?? '', ['ADMIN', 'DOKTER'], true)) {
            return $this->errorResponse('Akses ditolak.', 403);
        }

        $tindakan = (new Query())
            ->from('tindakan_medis')
            ->orderBy(['nama_tindakan' => SORT_ASC])
            ->all();

        $obat = (new Query())
            ->from('obat')
            ->orderBy(['nama_obat' => SORT_ASC])
            ->all();

        return $this->successResponse([
            'tindakan' => $tindakan,
            'obat' => $obat,
        ]);
    }

    // GET /pemeriksaan/<kunjungan_id> -> Melihat detail lengkap EMR, Tindakan, Lab, Resep, & Riwayat Pasien
    public function actionView(int $kunjunganId)
    {
        $kunjungan = (new Query())
            ->select(['k.*', 'p.no_rm', 'p.nama_lengkap AS nama_pasien', 'p.tanggal_lahir', 'p.jenis_kelamin', 'pl.nama_poli', 'd.nama_dokter'])
            ->from('kunjungan k')
            ->innerJoin('pasien p', 'p.id = k.pasien_id')
            ->innerJoin('poli pl', 'pl.id = k.poli_id')
            ->innerJoin('dokter d', 'd.id = k.dokter_id')
            ->where(['k.id' => $kunjunganId])
            ->one();

        if (!$kunjungan) {
            return $this->errorResponse('Data kunjungan tidak ditemukan.', 404);
        }

        $emr = (new Query())->from('pemeriksaan_medis')->where(['kunjungan_id' => $kunjunganId])->one();
        $tindakan = (new Query())
            ->select(['kt.*', 'tm.kode_tindakan', 'tm.nama_tindakan'])
            ->from('kunjungan_tindakan kt')
            ->innerJoin('tindakan_medis tm', 'tm.id = kt.tindakan_id')
            ->where(['kt.kunjungan_id' => $kunjunganId])
            ->all();

        $lab = (new Query())
            ->select(['pl.*', 'tm.kode_tindakan', 'tm.nama_tindakan', 'tm.tarif'])
            ->from('pemeriksaan_lab pl')
            ->innerJoin('tindakan_medis tm', 'tm.id = pl.tindakan_id')
            ->where(['pl.kunjungan_id' => $kunjunganId])
            ->all();

        $resep = (new Query())->from('resep')->where(['kunjungan_id' => $kunjunganId])->one();
        $resepDetail = [];
        if ($resep) {
            $resepDetail = (new Query())
                ->select(['rd.*', 'o.kode_obat', 'o.nama_obat', 'o.satuan'])
                ->from('resep_detail rd')
                ->innerJoin('obat o', 'o.id = rd.obat_id')
                ->where(['rd.resep_id' => $resep['id']])
                ->all();
        }

        $riwayat = (new Query())
            ->select(['k.id', 'k.no_registrasi', 'k.tanggal_kunjungan', 'pl.nama_poli', 'd.nama_dokter', 'pm.diagnosis_utama', 'pm.keluhan_utama'])
            ->from('kunjungan k')
            ->innerJoin('poli pl', 'pl.id = k.poli_id')
            ->innerJoin('dokter d', 'd.id = k.dokter_id')
            ->leftJoin('pemeriksaan_medis pm', 'pm.kunjungan_id = k.id')
            ->where(['k.pasien_id' => $kunjungan['pasien_id']])
            ->andWhere(['<>', 'k.id', $kunjunganId])
            ->orderBy(['k.tanggal_kunjungan' => SORT_DESC])
            ->all();

        return $this->successResponse([
            'kunjungan' => $kunjungan,
            'pemeriksaan_medis' => $emr,
            'tindakan' => $tindakan,
            'laboratorium' => $lab,
            'resep' => $resep ? array_merge($resep, ['items' => $resepDetail]) : null,
            'riwayat_kunjungan_pasien' => $riwayat,
        ]);
    }

    // POST /pemeriksaan/<kunjungan_id> -> Simpan / Update Pemeriksaan Dokter, Tindakan, Resep, & Order Lab
    public function actionSave(int $kunjunganId)
    {
        $user = $this->currentUser();
        if (!in_array($user['role'] ?? '', ['ADMIN', 'DOKTER'], true)) {
            return $this->errorResponse('Hanya Dokter atau Admin yang dapat mengisi pemeriksaan medis.', 403);
        }

        $body = Yii::$app->request->getBodyParams();
        $db = Yii::$app->db;
        $transaction = $db->beginTransaction();

        try {
            $kunjungan = $db->createCommand('SELECT * FROM kunjungan WHERE id = :id FOR UPDATE', [':id' => $kunjunganId])->queryOne();
            if (!$kunjungan) {
                $transaction->rollBack();
                return $this->errorResponse('Kunjungan tidak ditemukan.', 404);
            }

            $billing = $db->createCommand('SELECT * FROM billing WHERE kunjungan_id = :kid FOR UPDATE', [':kid' => $kunjunganId])->queryOne();
            if ($billing && $billing['is_locked']) {
                $transaction->rollBack();
                return $this->errorResponse(
                    'Tagihan kunjungan ini sudah memiliki pembayaran (terkunci). Perubahan medis/tindakan tidak dapat dilakukan langsung agar tagihan tetap konsisten.',
                    409
                );
            }

            $suhu = (isset($body['suhu_tubuh']) && $body['suhu_tubuh'] !== '')
                ? (float) str_replace(',', '.', (string) $body['suhu_tubuh'])
                : null;
            $nadi = (isset($body['nadi']) && $body['nadi'] !== '') ? (int)$body['nadi'] : null;

            // 1. Simpan atau Update Rekam Medis Elektronik (EMR)
            $emrData = [
                'kunjungan_id' => $kunjunganId,
                'dokter_id' => $kunjungan['dokter_id'],
                'anamnesis' => $body['anamnesis'] ?? '',
                'keluhan_utama' => $body['keluhan_utama'] ?? '',
                'tekanan_darah' => $body['tekanan_darah'] ?? null,
                'nadi' => $nadi,
                'suhu_tubuh' => $suhu,
                'pernapasan' => $body['pernapasan'] ?? null,
                'berat_badan' => $body['berat_badan'] ?? null,
                'tinggi_badan' => $body['tinggi_badan'] ?? null,
                'pemeriksaan_fisik' => $body['pemeriksaan_fisik'] ?? null,
                'diagnosis_utama' => $body['diagnosis_utama'] ?? '',
                'diagnosis_sekunder' => $body['diagnosis_sekunder'] ?? null,
                'catatan_dokter' => $body['catatan_dokter'] ?? null,
                'updated_at' => date('Y-m-d H:i:s'),
            ];

            if (trim($emrData['anamnesis']) === '' || trim($emrData['diagnosis_utama']) === '') {
                $transaction->rollBack();
                return $this->errorResponse('Anamnesis dan Diagnosis Utama wajib diisi.', 400);
            }

            $existingEmr = (new Query())->from('pemeriksaan_medis')->where(['kunjungan_id' => $kunjunganId])->one();
            if ($existingEmr) {
                $db->createCommand()->update('pemeriksaan_medis', $emrData, ['id' => $existingEmr['id']])->execute();
                $this->logAudit('pemeriksaan_medis', (int)$existingEmr['id'], 'UPDATE', $existingEmr, $emrData, 'Dokter memperbarui data pemeriksaan sebelum lunas');
            } else {
                $db->createCommand()->insert('pemeriksaan_medis', $emrData)->execute();
                $newEmrId = (int) $db->getLastInsertID();
                $this->logAudit('pemeriksaan_medis', $newEmrId, 'CREATE', null, $emrData, 'Input pemeriksaan medis baru');
            }

            // 2. Sinkronisasi Tindakan Medis & Komponen Billing
            if (isset($body['tindakan']) && is_array($body['tindakan'])) {
                $db->createCommand()->delete('kunjungan_tindakan', ['kunjungan_id' => $kunjunganId])->execute();
                if ($billing) {
                    $db->createCommand()->delete('billing_items', ['billing_id' => $billing['id'], 'jenis_item' => 'TINDAKAN'])->execute();
                }

                foreach ($body['tindakan'] as $item) {
                    $tindakan = (new Query())->from('tindakan_medis')->where(['id' => $item['tindakan_id'], 'kategori' => 'POLIKLINIK'])->one();
                    if (!$tindakan) {
                        continue;
                    }
                    $qty = max(1, (int) ($item['jumlah'] ?? 1));
                    $tarif = (float) $tindakan['tarif'];
                    $subtotal = $qty * $tarif;

                    $db->createCommand()->insert('kunjungan_tindakan', [
                        'kunjungan_id' => $kunjunganId,
                        'tindakan_id' => $tindakan['id'],
                        'jumlah' => $qty,
                        'tarif_saat_ini' => $tarif,
                        'subtotal' => $subtotal,
                    ])->execute();
                    $ktId = (int)$db->getLastInsertID();

                    if ($billing) {
                        $db->createCommand()->insert('billing_items', [
                            'billing_id' => $billing['id'],
                            'jenis_item' => 'TINDAKAN',
                            'referensi_id' => $ktId,
                            'deskripsi' => $tindakan['nama_tindakan'],
                            'jumlah' => $qty,
                            'harga_satuan' => $tarif,
                            'subtotal' => $subtotal,
                        ])->execute();
                    }
                }
            }

            // 3. Permintaan Pemeriksaan Lab (jika ada) + Outbox Pattern
            if (!empty($body['lab_orders']) && is_array($body['lab_orders'])) {
                foreach ($body['lab_orders'] as $labItem) {
                    $tindakanLab = (new Query())->from('tindakan_medis')->where(['id' => $labItem['tindakan_id'], 'kategori' => 'LABORATORIUM'])->one();
                    if (!$tindakanLab) {
                        continue;
                    }
                    $noOrderLab = sprintf('LAB-\%s-\%04d', date('Ymd'), random_int(1000, 9999));
                    $db->createCommand()->insert('pemeriksaan_lab', [
                        'no_order_lab' => $noOrderLab,
                        'kunjungan_id' => $kunjunganId,
                        'tindakan_id' => $tindakanLab['id'],
                        'catatan_permintaan' => $labItem['catatan_permintaan'] ?? null,
                        'status_lab' => 'DIMINTA',
                    ])->execute();
                    $labId = (int)$db->getLastInsertID();

                    if ($billing) {
                        $db->createCommand()->insert('billing_items', [
                            'billing_id' => $billing['id'],
                            'jenis_item' => 'LABORATORIUM',
                            'referensi_id' => $labId,
                            'deskripsi' => 'Lab: ' . $tindakanLab['nama_tindakan'],
                            'jumlah' => 1,
                            'harga_satuan' => $tindakanLab['tarif'],
                            'subtotal' => $tindakanLab['tarif'],
                        ])->execute();
                    }

                    $db->createCommand()->insert('integration_outbox', [
                        'event_type' => 'LAB_ORDER_CREATED',
                        'payload' => json_encode([
                            'lab_id' => $labId,
                            'no_order_lab' => $noOrderLab,
                            'kunjungan_id' => $kunjunganId,
                            'tindakan_id' => $tindakanLab['id'],
                        ]),
                        'status' => 'PENDING_SYNC',
                    ])->execute();
                }
            }

            // 4. Resep Obat -> langsung masukkan ke billing_items agar dibayar di Kasir sebelum obat diserahkan
            if (!empty($body['resep']) && is_array($body['resep'])) {
                $existingResep = (new Query())->from('resep')->where(['kunjungan_id' => $kunjunganId])->one();
                if ($existingResep && $existingResep['status_resep'] === 'DISERAHKAN') {
                    $transaction->rollBack();
                    return $this->errorResponse('Resep sudah diserahkan oleh farmasi dan tidak dapat diubah.', 409);
                }

                if ($existingResep) {
                    $resepId = (int)$existingResep['id'];
                    $db->createCommand()->delete('resep_detail', ['resep_id' => $resepId])->execute();
                } else {
                    $noResep = sprintf('RSP-%s-%04d', date('Ymd'), $kunjunganId);
                    $db->createCommand()->insert('resep', [
                        'no_resep' => $noResep,
                        'kunjungan_id' => $kunjunganId,
                        'dokter_id' => $kunjungan['dokter_id'],
                        'status_resep' => 'MENUNGGU',
                    ])->execute();
                    $resepId = (int)$db->getLastInsertID();
                }

                if ($billing) {
                    $db->createCommand()->delete('billing_items', ['billing_id' => $billing['id'], 'jenis_item' => 'OBAT'])->execute();
                }

                foreach ($body['resep'] as $rx) {
                    $obat = (new Query())->from('obat')->where(['id' => $rx['obat_id']])->one();
                    if (!$obat) {
                        $transaction->rollBack();
                        return $this->errorResponse("Obat dengan ID {$rx['obat_id']} tidak ditemukan.", 404);
                    }
                    $qty = max(1, (int) ($rx['jumlah'] ?? 1));
                    if ((int) $obat['stok'] < $qty) {
                        $transaction->rollBack();
                        return $this->errorResponse("Stok obat '{$obat['nama_obat']}' tidak mencukupi (tersedia: {$obat['stok']}).", 422);
                    }

                    $harga = (float) $obat['harga_satuan'];
                    $subtotalObat = $qty * $harga;
                    $dosis = $rx['dosis'] ?? '1x1';
                    $frekuensi = $rx['frekuensi'] ?? 'Sesudah makan';

                    $db->createCommand()->insert('resep_detail', [
                        'resep_id' => $resepId,
                        'obat_id' => $obat['id'],
                        'dosis' => $dosis,
                        'frekuensi' => $frekuensi,
                        'jumlah' => $qty,
                        'harga_satuan' => $harga,
                        'subtotal' => $subtotalObat,
                    ])->execute();
                    $rdId = (int)$db->getLastInsertID();

                    if ($billing) {
                        $db->createCommand()->insert('billing_items', [
                            'billing_id' => $billing['id'],
                            'jenis_item' => 'OBAT',
                            'referensi_id' => $rdId,
                            'deskripsi' => "Obat: {$obat['nama_obat']} ({$dosis} - {$frekuensi})",
                            'jumlah' => $qty,
                            'harga_satuan' => $harga,
                            'subtotal' => $subtotalObat,
                        ])->execute();
                    }
                }
            }

            // 5. Hitung ulang total tagihan billing secara otomatis & update status kunjungan
            if ($billing) {
                $totalTagihan = (float)$db->createCommand(
                    'SELECT COALESCE(SUM(subtotal), 0) FROM billing_items WHERE billing_id = :bid',
                    [':bid' => $billing['id']]
                )->queryScalar();

                $sisa = max(0, $totalTagihan - (float) $billing['total_dibayar']);
                $db->createCommand()->update('billing', [
                    'total_tagihan' => $totalTagihan,
                    'sisa_tagihan' => $sisa,
                    'updated_at' => date('Y-m-d H:i:s'),
                ], ['id' => $billing['id']])->execute();
            }

            $db->createCommand()->update('kunjungan', ['status_kunjungan' => 'SELESAI_PERIKSA'], ['id' => $kunjunganId])->execute();

            $transaction->commit();
            return $this->successResponse(['kunjungan_id' => $kunjunganId], 'Pemeriksaan medis berhasil disimpan.');
        } catch (\Throwable $e) {
            $transaction->rollBack();
            return $this->errorResponse('Gagal menyimpan pemeriksaan: ' . $e->getMessage(), 500);
        }
    }
}
