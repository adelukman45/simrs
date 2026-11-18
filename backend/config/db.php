<?php

return [
    'class' => \yii\db\Connection::class,
    'dsn' => 'pgsql:host=127.0.0.1;port=5432;dbname=simrs',
    'username' => 'postgres',
    'password' => 'alc',
    'charset' => 'utf8',
    'schemaMap' => [
        'pgsql' => [
            'class' => 'yii\db\pgsql\Schema',
            'defaultSchema' => 'public',
        ],
    ],

    // Schema cache options (for production environment)
    //'enableSchemaCache' => true,
    //'schemaCacheDuration' => 60,
    //'schemaCache' => 'cache',
];
