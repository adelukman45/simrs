<?php

namespace app\controllers;

use Yii;
use yii\rest\Controller;
use app\components\JwtAuthFilter;

class BaseApiController extends Controller
{
    /**
     * Override di masing-masing controller anak untuk membatasi role.
     */
    protected array $allowedRoles = [];

    public function behaviors()
    {
        $behaviors = parent::behaviors();

        // Hilangkan authenticator bawaan Yii agar digantikan JwtAuthFilter kita
        unset($behaviors['authenticator']);

        // Pastikan OPTIONS preflight dari browser (CORS) selalu lolos tanpa token
        if (Yii::$app->request->isOptions) {
            return $behaviors;
        }

        $behaviors['jwtAuth'] = [
            'class' => JwtAuthFilter::class,
            'allowedRoles' => $this->allowedRoles,
        ];

        return $behaviors;
    }

    public function actionOptions()
    {
        Yii::$app->response->statusCode = 200;
        return ['status' => 'ok'];
    }

    protected function currentUser(): array
    {
        return Yii::$app->params['currentUser'] ?? [];
    }

    protected function successResponse($data = null, string $message = 'Berhasil', int $code = 200): array
    {
        Yii::$app->response->statusCode = $code;
        return [
            'status' => 'success',
            'message' => $message,
            'data' => $data,
        ];
    }

    protected function errorResponse(string $message, int $code = 400, $errors = null): array
    {
        Yii::$app->response->statusCode = $code;
        return [
            'status' => 'error',
            'message' => $message,
            'errors' => $errors,
        ];
    }

    /**
     * Helper pencatat Audit Trail (Skenario D.4)
     */
    protected function logAudit(string $tabel, int $recordId, string $aksi, ?array $dataLama, ?array $dataBaru, string $keterangan = ''): void
    {
        $userId = $this->currentUser()['id'] ?? null;
        Yii::$app->db->createCommand()->insert('audit_logs', [
            'user_id' => $userId,
            'tabel_target' => $tabel,
            'record_id' => $recordId,
            'aksi' => $aksi,
            'data_lama' => $dataLama ? json_encode($dataLama) : null,
            'data_baru' => $dataBaru ? json_encode($dataBaru) : null,
            'keterangan' => $keterangan,
        ])->execute();
    }
}
