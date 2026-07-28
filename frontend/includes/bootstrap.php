<?php
declare(strict_types=1);

$secure = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off');
ini_set('session.use_strict_mode', '1');
ini_set('session.use_only_cookies', '1');
session_name('forge_session');
session_set_cookie_params([
    'lifetime' => 0,
    'path' => '/',
    'secure' => $secure,
    'httponly' => true,
    'samesite' => 'Strict',
]);
session_start();

const FRONTEND_NAME = 'Forge Simplified';
define('API_BASE_URL', rtrim(getenv('FORGE_API_URL') ?: 'http://localhost:3000/api', '/'));

require_once __DIR__ . '/api-client.php';

function csrf_token(): string
{
    if (empty($_SESSION['csrf'])) {
        $_SESSION['csrf'] = bin2hex(random_bytes(32));
    }
    return $_SESSION['csrf'];
}

function require_auth(): void
{
    if (empty($_SESSION['access_token']) || empty($_SESSION['user'])) {
        header('Location: /login.php');
        exit;
    }
}

function redirect_if_authenticated(): void
{
    if (!empty($_SESSION['access_token']) && !empty($_SESSION['user'])) {
        header('Location: /dashboard.php');
        exit;
    }
}

function json_response(array $body, int $status = 200): never
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    echo json_encode($body, JSON_UNESCAPED_SLASHES);
    exit;
}

function clear_auth_session(): void
{
    unset($_SESSION['access_token'], $_SESSION['user']);
    session_regenerate_id(true);
}
