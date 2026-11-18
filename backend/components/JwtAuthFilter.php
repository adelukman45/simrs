<?php

namespace app\components;

use Yii;
use yii\base\ActionFilter;
use yii\web\UnauthorizedHttpException;
use yii\web\ForbiddenHttpException;
use app\controllers\AuthController;

class JwtAuthFilter extends ActionFilter
{
    public array $allowedRoles = [];

    public function beforeAction($action)
    {
        $authHeader = Yii::$app->request->headers->get('Authorization');

        if (!$authHeader || !preg_match('/^Bearer\s+(.*?)$/', $authHeader, $matches)) {
            throw new UnauthorizedHttpException('Token autentikasi tidak ditemukan.');
        }

        $payload = AuthController::verifyJwt($matches[1], Yii::$app->jwt->key);

        if (!$payload) {
            throw new UnauthorizedHttpException('Token tidak valid atau sudah kedaluwarsa.');
        }

        Yii::$app->params['currentUser'] = [
            'id' => $payload['uid'],
            'username' => $payload['username'],
            'nama_lengkap' => $payload['nama_lengkap'],
            'role' => $payload['role'],
            'dokter_id' => $payload['dokter_id'] ?? null,
        ];

        if (!empty($this->allowedRoles) && !in_array($payload['role'], $this->allowedRoles, true)) {
            throw new ForbiddenHttpException(
                "Akses ditolak. Peran '{$payload['role']}' tidak memiliki kewenangan pada fitur ini."
            );
        }

        return true;
    }
}
