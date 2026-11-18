<?php

$params = require __DIR__ . '/params.php';
$db = require __DIR__ . '/db.php';

$config = [
    'id' => 'basic',
    'basePath' => dirname(__DIR__),
    'bootstrap' => ['log'],
    'container' => [
        'singletons' => [
            \yii\mail\MailerInterface::class => [
                'class' => \yii\symfonymailer\Mailer::class,
                // send all mails to a file by default.
                'useFileTransport' => true,
                'viewPath' => '@app/mail',
            ],
        ],
    ],
    'aliases' => [
        '@bower' => '@vendor/bower-asset',
        '@npm'   => '@vendor/npm-asset',
    ],
    'components' => [
        'request' => [
            // !!! insert a secret key in the following (if it is empty) - this is required by cookie validation
            'cookieValidationKey' => 'a3uQy3TJVD1NruAKbFQ5ZCj-S9bQ-Ru_',
            'parsers' => [
                'application/json' => 'yii\web\JsonParser',
            ],
        ],
        'response' => [
            'format' => yii\web\Response::FORMAT_JSON,
            'charset' => 'utf-8',
        ],
        'jwt' => [
            'class' => \sizeg\jwt\Jwt::class,
            'key' => 'INOVA_MEDIKA_SUPER_SECRET_JWT_KEY_2026', // <-- KUNCI JWT (HARUS SAMA DENGAN NODE.JS)
        ],
        'cache' => [
            'class' => \yii\caching\FileCache::class,
        ],
        'user' => [
            'identityClass' => \app\models\User::class,
            'enableSession' => false,
            'loginUrl' => null,
        ],
        'errorHandler' => [
            'errorAction' => 'site/error',
        ],
        'mailer' => \yii\mail\MailerInterface::class,
        'log' => [
            'traceLevel' => YII_DEBUG ? 3 : 0,
            'targets' => [
                [
                    'class' => \yii\log\FileTarget::class,
                    'levels' => ['error', 'warning'],
                ],
            ],
        ],
        'db' => $db,
        'urlManager' => [
            'enablePrettyUrl' => true,
            'showScriptName' => false,
            'rules' => [
                'OPTIONS <path:.*>' => 'master/options',
                'POST auth/login' => 'auth/login',

                // Master Data
                'GET master/<entity:[\w-]+>' => 'master/index',
                'POST master/<entity:[\w-]+>' => 'master/create',
                'PUT master/<entity:[\w-]+>/<id:\d+>' => 'master/update',
                'DELETE master/<entity:[\w-]+>/<id:\d+>' => 'master/delete',

                // Pendaftaran & Antrean
                'GET pendaftaran' => 'pendaftaran/index',
                'POST pendaftaran' => 'pendaftaran/create',

                // Pemeriksaan Medis (EMR, Tindakan, Lab, Resep & Katalog Master Dokter)
                'GET pemeriksaan/master' => 'pemeriksaan/master',
                'GET pemeriksaan/<kunjunganId:\d+>' => 'pemeriksaan/view',
                'POST pemeriksaan/<kunjunganId:\d+>' => 'pemeriksaan/save',

                // Farmasi
                'GET farmasi' => 'farmasi/index',
                'POST farmasi/<id:\d+>/serahkan' => 'farmasi/serahkan',

                // Billing & Kasir
                'GET billing' => 'billing/index',
                'GET billing/<id:\d+>' => 'billing/view',
                'POST billing/<id:\d+>/bayar' => 'billing/bayar',
                'POST billing/<id:\d+>/koreksi' => 'billing/koreksi',
            ],
        ],
        /*
        'urlManager' => [
            'enablePrettyUrl' => true,
            'showScriptName' => false,
            'rules' => [
            ],
        ],
        */
    ],
    'as corsFilter' => [
        'class' => \yii\filters\Cors::class,
        'cors' => [
            'Origin' => ['*'],
            'Access-Control-Request-Method' => ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'],
            'Access-Control-Request-Headers' => ['*'],
        ],
    ],
    'params' => $params,
];

if (YII_ENV_DEV) {
    // configuration adjustments for 'dev' environment
    $config['bootstrap'][] = 'debug';
    $config['modules']['debug'] = [
        'class' => \yii\debug\Module::class,
        // uncomment the following to add your IP if you are not connecting from localhost.
        //'allowedIPs' => ['127.0.0.1', '::1'],
    ];

    $config['bootstrap'][] = 'gii';
    $config['modules']['gii'] = [
        'class' => \yii\gii\Module::class,
        // uncomment the following to add your IP if you are not connecting from localhost.
        //'allowedIPs' => ['127.0.0.1', '::1'],
    ];
}

return $config;
