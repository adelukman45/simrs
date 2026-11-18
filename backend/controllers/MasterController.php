<?php

namespace app\controllers;

use Yii;
use yii\db\Query;
use yii\db\IntegrityException;

class MasterController extends BaseApiController
{
    private const ALLOWED_ENTITIES = [
        'pasien' => ['pk' => 'id', 'searchCols' => ['no_rm', 'nik', 'nama_lengkap'], 'order' => 'id DESC'],
        'poli' => ['pk' => 'id', 'searchCols' => ['kode_poli', 'nama_poli'], 'order' => 'id ASC'],
        'dokter' => ['pk' => 'id', 'searchCols' => ['kode_dokter', 'nama_dokter', 'spesialisasi'], 'order' => 'id ASC'],
        'jadwal-dokter' => ['table' => 'jadwal_dokter', 'pk' => 'id', 'searchCols' => ['hari'], 'order' => 'id ASC'],
        'tindakan-medis' => ['table' => 'tindakan_medis', 'pk' => 'id', 'searchCols' => ['kode_tindakan', 'nama_tindakan', 'kategori'], 'order' => 'id ASC'],
        'obat' => ['pk' => 'id', 'searchCols' => ['kode_obat', 'nama_obat'], 'order' => 'id ASC'],
        'users' => ['pk' => 'id', 'searchCols' => ['username', 'nama_lengkap', 'role'], 'order' => 'id ASC'],
    ];

    private function resolveTable(string $entity): ?array
    {
        if (!isset(self::ALLOWED_ENTITIES[$entity])) {
            return null;
        }
        $cfg = self::ALLOWED_ENTITIES[$entity];
        $cfg['table'] = $cfg['table'] ?? $entity;
        return $cfg;
    }

    private function authorizeWrite(string $entity): bool
    {
        $role = $this->currentUser()['role'] ?? '';
        if ($role === 'ADMIN') {
            return true;
        }
        if ($entity === 'pasien' && $role === 'PENDAFTARAN') {
            return true;
        }
        return false;
    }

    /**
     * Menyaring payload hanya untuk kolom yang benar-benar ada pada tabel PostgreSQL
     * (menghindari error Undefined column akibat field hasil JOIN seperti kode_poli / nama_poli).
     */
    private function filterValidColumns(string $table, array $data, bool $isUpdate = false): array
    {
        $schema = Yii::$app->db->getTableSchema($table, true);
        if (!$schema) {
            return $data;
        }

        $validColumns = $schema->columnNames;
        $filtered = [];

        foreach ($data as $key => $value) {
            if ($key === 'id' || $key === 'created_at') {
                continue;
            }
            if (in_array($key, $validColumns, true)) {
                $filtered[$key] = ($value === '') ? null : $value;
            }
        }

        if ($isUpdate && in_array('updated_at', $validColumns, true)) {
            $filtered['updated_at'] = date('Y-m-d H:i:s');
        }

        return $filtered;
    }

    // GET /master/<entity>?q=...&page=1&limit=20
    public function actionIndex(string $entity)
    {
        $cfg = $this->resolveTable($entity);
        if (!$cfg) {
            return $this->errorResponse('Entitas master tidak ditemukan.', 404);
        }

        $q = trim(Yii::$app->request->get('q', ''));
        $kategori = trim(Yii::$app->request->get('kategori', ''));
        $page = max(1, (int) Yii::$app->request->get('page', 1));
        $limit = min(100, max(1, (int) Yii::$app->request->get('limit', 20)));
        $offset = ($page - 1) * $limit;

        $query = (new Query())->from($cfg['table']);

        if ($entity === 'users') {
            $query->select(['id', 'username', 'nama_lengkap', 'role', 'is_active', 'created_at']);
        } elseif ($entity === 'dokter') {
            $query->select(['dokter.*', 'poli.nama_poli', 'poli.kode_poli'])
                ->leftJoin('poli', 'poli.id = dokter.poli_id');
        } elseif ($entity === 'jadwal-dokter') {
            $query->select(['jadwal_dokter.*', 'dokter.nama_dokter', 'dokter.poli_id', 'poli.nama_poli'])
                ->innerJoin('dokter', 'dokter.id = jadwal_dokter.dokter_id')
                ->innerJoin('poli', 'poli.id = dokter.poli_id');
        }

        if ($q !== '') {
            $orConditions = ['or'];
            foreach ($cfg['searchCols'] as $col) {
                $prefix = str_contains($col, '.') ? '' : $cfg['table'] . '.';
                $orConditions[] = ['ilike', $prefix . $col, $q];
            }
            $query->andWhere($orConditions);
        }

        if ($kategori !== '' && $entity === 'tindakan-medis') {
            $query->andWhere(['kategori' => strtoupper($kategori)]);
        }

        $total = (int) $query->count();
        $rows = $query->orderBy($cfg['table'] . '.' . $cfg['order'])->limit($limit)->offset($offset)->all();

        return $this->successResponse([
            'items' => $rows,
            'pagination' => [
                'page' => $page,
                'limit' => $limit,
                'total' => $total,
                'total_pages' => (int) ceil($total / $limit),
            ],
        ]);
    }

    // POST /master/<entity>
    public function actionCreate(string $entity)
    {
        $cfg = $this->resolveTable($entity);
        if (!$cfg) {
            return $this->errorResponse('Entitas master tidak ditemukan.', 404);
        }
        if (!$this->authorizeWrite($entity)) {
            return $this->errorResponse('Anda tidak memiliki hak akses untuk menambah data ini.', 403);
        }

        $body = Yii::$app->request->getBodyParams();

        if ($entity === 'pasien' && empty($body['no_rm'])) {
            $nextId = (int) Yii::$app->db->createCommand("SELECT COALESCE(MAX(id), 0) + 1 FROM pasien")->queryScalar();
            $body['no_rm'] = sprintf('RM-%s-%04d', date('Y'), $nextId);
        }

        if ($entity === 'users') {
            if (empty($body['username']) || empty($body['password']) || empty($body['nama_lengkap']) || empty($body['role'])) {
                return $this->errorResponse('Username, password, nama_lengkap, dan role wajib diisi.', 400);
            }
            $body['password_hash'] = password_hash($body['password'], PASSWORD_BCRYPT);
            unset($body['password']);
        }

        $cleanData = $this->filterValidColumns($cfg['table'], $body, false);

        try {
            Yii::$app->db->createCommand()->insert($cfg['table'], $cleanData)->execute();
            $newId = (int) Yii::$app->db->getLastInsertID();
            $this->logAudit($cfg['table'], $newId, 'CREATE', null, $cleanData, "Tambah data {$entity}");

            return $this->successResponse(['id' => $newId] + $cleanData, 'Data berhasil ditambahkan.', 201);
        } catch (IntegrityException $e) {
            return $this->errorResponse('Data duplikat atau melanggar aturan relasi database: ' . $e->getMessage(), 409);
        } catch (\Throwable $e) {
            return $this->errorResponse('Gagal menyimpan data: ' . $e->getMessage(), 400);
        }
    }

    // PUT /master/<entity>/<id>
    public function actionUpdate(string $entity, int $id)
    {
        $cfg = $this->resolveTable($entity);
        if (!$cfg) {
            return $this->errorResponse('Entitas master tidak ditemukan.', 404);
        }
        if (!$this->authorizeWrite($entity)) {
            return $this->errorResponse('Anda tidak memiliki hak akses untuk mengubah data ini.', 403);
        }

        $old = (new Query())->from($cfg['table'])->where(['id' => $id])->one();
        if (!$old) {
            return $this->errorResponse('Data tidak ditemukan.', 404);
        }

        $body = Yii::$app->request->getBodyParams();
        unset($body['id']);

        if ($entity === 'users') {
            if (!empty($body['password'])) {
                $body['password_hash'] = password_hash($body['password'], PASSWORD_BCRYPT);
            }
            unset($body['password']);
        }

        $cleanData = $this->filterValidColumns($cfg['table'], $body, true);

        try {
            Yii::$app->db->createCommand()->update($cfg['table'], $cleanData, ['id' => $id])->execute();
            $this->logAudit($cfg['table'], $id, 'UPDATE', $old, $cleanData, "Ubah data {$entity}");
            return $this->successResponse(['id' => $id] + $cleanData, 'Data berhasil diperbarui.');
        } catch (IntegrityException $e) {
            return $this->errorResponse('Data duplikat atau tidak valid: ' . $e->getMessage(), 409);
        } catch (\Throwable $e) {
            return $this->errorResponse('Gagal memperbarui data: ' . $e->getMessage(), 400);
        }
    }

    // DELETE /master/<entity>/<id>
    public function actionDelete(string $entity, int $id)
    {
        $cfg = $this->resolveTable($entity);
        if (!$cfg) {
            return $this->errorResponse('Entitas master tidak ditemukan.', 404);
        }
        if (($this->currentUser()['role'] ?? '') !== 'ADMIN') {
            return $this->errorResponse('Hanya Administrator yang dapat menghapus data master.', 403);
        }

        $old = (new Query())->from($cfg['table'])->where(['id' => $id])->one();
        if (!$old) {
            return $this->errorResponse('Data tidak ditemukan.', 404);
        }

        try {
            Yii::$app->db->createCommand()->delete($cfg['table'], ['id' => $id])->execute();
            $this->logAudit($cfg['table'], $id, 'DELETE', $old, null, "Hapus data {$entity}");
            return $this->successResponse(null, 'Data berhasil dihapus.');
        } catch (IntegrityException $e) {
            return $this->errorResponse('Data tidak dapat dihapus karena sudah digunakan pada transaksi.', 409);
        }
    }
}
