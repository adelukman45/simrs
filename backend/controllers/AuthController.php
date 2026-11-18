<?php

namespace app\controllers;

use Yii;
use yii\rest\Controller;
use yii\db\Query;

class AuthController extends Controller
{
    public function actionLogin()
    {
        $body = Yii::$app->request->getBodyParams();
        $username = trim($body['username'] ?? '');
        $password = $body['password'] ?? '';

        if ($username === '' || $password === '') {
            Yii::$app->response->statusCode = 400;
            return ['status' => 'error', 'message' => 'Username dan password wajib diisi.'];
        }

        $user = (new Query())
            ->from('users')
            ->where(['username' => $username, 'is_active' => true])
            ->one();

        if (!$user || !password_verify($password, $user['password_hash'])) {
            Yii::$app->response->statusCode = 401;
            return ['status' => 'error', 'message' => 'Username atau password salah.'];
        }

        // Ambil profil dokter jika role user adalah DOKTER
        $dokter = null;
        if ($user['role'] === 'DOKTER') {
            $dokter = (new Query())->from('dokter')->where(['user_id' => $user['id']])->one();
        }

        $now = time();
        $payload = [
            'iss' => 'simrs-inova-medika',
            'iat' => $now,
            'exp' => $now + (60 * 60 * 12), // Berlaku 12 jam
            'uid' => (int) $user['id'],
            'username' => $user['username'],
            'nama_lengkap' => $user['nama_lengkap'],
            'role' => $user['role'],
            'dokter_id' => $dokter ? (int) $dokter['id'] : null,
        ];

        $token = self::generateJwt($payload, Yii::$app->jwt->key);

        return [
            'status' => 'success',
            'message' => 'Login berhasil',
            'data' => [
                'token' => $token,
                'user' => [
                    'id' => (int) $user['id'],
                    'username' => $user['username'],
                    'nama_lengkap' => $user['nama_lengkap'],
                    'role' => $user['role'],
                    'dokter_id' => $dokter ? (int) $dokter['id'] : null,
                ],
            ],
        ];
    }

    public static function generateJwt(array $payload, string $secret): string
    {
        $header = self::base64UrlEncode(json_encode(['typ' => 'JWT', 'alg' => 'HS256']));
        $body = self::base64UrlEncode(json_encode($payload));
        $signature = self::base64UrlEncode(hash_hmac('sha256', "$header.$body", $secret, true));
        return "$header.$body.$signature";
    }

    public static function verifyJwt(string $token, string $secret): ?array
    {
        $parts = explode('.', $token);
        if (count($parts) !== 3) {
            return null;
        }
        [$header, $body, $signature] = $parts;
        $expectedSig = self::base64UrlEncode(hash_hmac('sha256', "$header.$body", $secret, true));

        if (!hash_equals($expectedSig, $signature)) {
            return null;
        }

        $payload = json_decode(base64_decode(strtr($body, '-_', '+/')), true);
        if (!$payload || (isset($payload['exp']) && $payload['exp'] < time())) {
            return null;
        }

        return $payload;
    }

    private static function base64UrlEncode(string $data): string
    {
        return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
    }
}
