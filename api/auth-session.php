<?php
declare(strict_types=1);

function startApiSession(?string $token = null): void
{
    if ($token !== null) {
        session_id($token);
    }
    if (!session_start(['use_cookies' => 0, 'use_only_cookies' => 0, 'use_strict_mode' => 1, 'cache_limiter' => ''])) {
        throw new RuntimeException('No se pudo iniciar la sesion.');
    }
}

function issueAuthToken(int $userId): string
{
    session_id('');
    startApiSession();
    session_regenerate_id(true);
    $_SESSION = ['user_id' => $userId, 'expires_at' => time() + 86400];
    $token = session_id();
    session_write_close();
    return $token;
}

function requireSessionUser(PDO $pdo): array
{
    $header = apiAuthorizationHeader();
    if (!preg_match('/^Bearer ([a-zA-Z0-9,-]{22,128})$/D', $header, $matches)) {
        sendError('Vuelve a iniciar sesion para acceder al historial clinico.', 401);
    }
    startApiSession($matches[1]);
    $userId = (int)($_SESSION['user_id'] ?? 0);
    $expires = (int)($_SESSION['expires_at'] ?? 0);
    if ($userId <= 0 || $expires <= time()) {
        $_SESSION = [];
        session_destroy();
        sendError('La sesion vencio. Vuelve a iniciar sesion.', 401);
    }
    session_write_close();
    return getUserById($pdo, $userId);
}

function logoutSession(PDO $pdo): void
{
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') sendError('Metodo no permitido.', 405);
    requireSessionUser($pdo);
    $header = apiAuthorizationHeader();
    startApiSession(substr($header, 7));
    $_SESSION = [];
    session_destroy();
    sendJson(['success' => true]);
}

function apiAuthorizationHeader(): string
{
    $header = $_SERVER['HTTP_AUTHORIZATION'] ?? $_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ?? '';
    if ($header !== '') return $header;
    foreach (function_exists('getallheaders') ? getallheaders() : [] as $name => $value) {
        if (strtolower($name) === 'authorization') return $value;
    }
    return '';
}
