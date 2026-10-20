<?php
declare(strict_types=1);

const AUTH_TOKEN_LIFETIME_DAYS = 30;

function ensureAuthSessionsTable(PDO $pdo): void
{
    static $initialized = false;
    if ($initialized) return;

    $pdo->exec("
        CREATE TABLE IF NOT EXISTS auth_sessions (
            token_hash CHAR(64) NOT NULL,
            user_id INT NOT NULL,
            expires_at DATETIME NOT NULL,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            last_used_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (token_hash),
            KEY idx_auth_sessions_user_id (user_id),
            KEY idx_auth_sessions_expires_at (expires_at),
            CONSTRAINT fk_auth_sessions_user FOREIGN KEY (user_id)
                REFERENCES users(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ");
    $initialized = true;
}

function issueAuthToken(PDO $pdo, int $userId): string
{
    ensureAuthSessionsTable($pdo);
    $pdo->exec('DELETE FROM auth_sessions WHERE expires_at <= CURRENT_TIMESTAMP');
    $token = bin2hex(random_bytes(32));
    $stmt = $pdo->prepare("
        INSERT INTO auth_sessions (token_hash, user_id, expires_at)
        VALUES (?, ?, DATE_ADD(CURRENT_TIMESTAMP, INTERVAL " . AUTH_TOKEN_LIFETIME_DAYS . " DAY))
    ");
    $stmt->execute([hash('sha256', $token), $userId]);
    return $token;
}

function requireSessionUser(PDO $pdo): array
{
    ensureAuthSessionsTable($pdo);
    $header = apiAuthorizationHeader();
    if (!preg_match('/^Bearer\s+([a-f0-9]{64})$/i', $header, $matches)) {
        if (preg_match('/^Bearer\s+([A-Za-z0-9,-]{1,128})$/', $header, $legacyMatches)) {
            $legacyUserId = legacySessionUserId($legacyMatches[1]);
            if ($legacyUserId > 0) {
                header('X-Auth-Token: ' . issueAuthToken($pdo, $legacyUserId));
                return getUserById($pdo, $legacyUserId);
            }
        }
        sendError('Vuelve a iniciar sesión para continuar.', 401);
    }

    $tokenHash = hash('sha256', $matches[1]);
    $stmt = $pdo->prepare("
        SELECT user_id
        FROM auth_sessions
        WHERE token_hash = ? AND expires_at > CURRENT_TIMESTAMP
        LIMIT 1
    ");
    $stmt->execute([$tokenHash]);
    $userId = (int)$stmt->fetchColumn();
    if ($userId <= 0) {
        $delete = $pdo->prepare('DELETE FROM auth_sessions WHERE token_hash = ?');
        $delete->execute([$tokenHash]);
        sendError('Tu sesión venció o dejó de ser válida. Inicia sesión de nuevo para continuar.', 401);
    }

    $refresh = $pdo->prepare("
        UPDATE auth_sessions
        SET expires_at = DATE_ADD(CURRENT_TIMESTAMP, INTERVAL " . AUTH_TOKEN_LIFETIME_DAYS . " DAY),
            last_used_at = CURRENT_TIMESTAMP
        WHERE token_hash = ?
    ");
    $refresh->execute([$tokenHash]);

    return getUserById($pdo, $userId);
}

function logoutSession(PDO $pdo): void
{
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') sendError('Metodo no permitido.', 405);
    ensureAuthSessionsTable($pdo);
    $header = apiAuthorizationHeader();
    if (!preg_match('/^Bearer\s+([a-f0-9]{64})$/i', $header, $matches)) {
        if (preg_match('/^Bearer\s+([A-Za-z0-9,-]{1,128})$/', $header, $legacyMatches)) {
            startLegacyApiSession($legacyMatches[1]);
            $_SESSION = [];
            session_destroy();
            sendJson(['success' => true]);
        }
        sendError('Vuelve a iniciar sesión para continuar.', 401);
    }

    $stmt = $pdo->prepare('DELETE FROM auth_sessions WHERE token_hash = ?');
    $stmt->execute([hash('sha256', $matches[1])]);
    if ($stmt->rowCount() === 0) sendError('La sesión ya no está activa.', 401);
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

function legacySessionUserId(string $token): int
{
    startLegacyApiSession($token);
    $userId = (int)($_SESSION['user_id'] ?? 0);
    $expiresAt = (int)($_SESSION['expires_at'] ?? 0);
    session_write_close();
    return $userId > 0 && $expiresAt > time() ? $userId : 0;
}

function startLegacyApiSession(string $token): void
{
    if (session_status() !== PHP_SESSION_NONE) {
        throw new RuntimeException('No se pudo validar la sesión anterior.');
    }
    session_id($token);
    if (!session_start(['use_cookies' => 0, 'use_only_cookies' => 0, 'use_strict_mode' => 1, 'cache_limiter' => ''])) {
        throw new RuntimeException('No se pudo validar la sesión anterior.');
    }
}
