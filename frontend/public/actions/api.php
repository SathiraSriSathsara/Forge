<?php
declare(strict_types=1);
require_once dirname(__DIR__, 2) . '/includes/bootstrap.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    json_response(['success' => false, 'message' => 'Method not allowed'], 405);
}

$input = json_decode(file_get_contents('php://input') ?: '{}', true);
if (!is_array($input)) {
    json_response(['success' => false, 'message' => 'Invalid JSON body'], 400);
}

$csrf = $_SERVER['HTTP_X_CSRF_TOKEN'] ?? '';
if (!hash_equals(csrf_token(), $csrf)) {
    json_response(['success' => false, 'message' => 'Your form session expired. Refresh and try again.'], 419);
}

$action = (string) ($input['action'] ?? '');
$data = is_array($input['data'] ?? null) ? $input['data'] : [];
$client = new ApiClient();

if ($action === 'login') {
    $result = $client->request('POST', '/auth/login', [
        'email' => $data['email'] ?? '',
        'password' => $data['password'] ?? '',
    ], false);
    if ($result['status'] === 200 && !empty($result['body']['data']['accessToken'])) {
        session_regenerate_id(true);
        $_SESSION['access_token'] = $result['body']['data']['accessToken'];
        $_SESSION['user'] = $result['body']['data']['user'];
        $_SESSION['csrf'] = bin2hex(random_bytes(32));
        $result['body']['data'] = ['user' => $_SESSION['user'], 'redirect' => '/dashboard.php'];
    }
    json_response($result['body'], $result['status']);
}

if ($action === 'register') {
    $result = $client->request('POST', '/users', [
        'firstName' => $data['firstName'] ?? '',
        'lastName' => $data['lastName'] ?? '',
        'email' => $data['email'] ?? '',
        'username' => $data['username'] ?? '',
        'password' => $data['password'] ?? '',
    ], false);
    json_response($result['body'], $result['status']);
}

if ($action === 'logout') {
    clear_auth_session();
    json_response(['success' => true, 'message' => 'Signed out', 'redirect' => '/login.php']);
}

if (empty($_SESSION['access_token'])) {
    json_response(['success' => false, 'message' => 'Authentication required', 'sessionExpired' => true], 401);
}

if ($action === 'health') {
    $result = $client->request('GET', '/', null, false);
    json_response($result['body'], $result['status']);
}

if ($action === 'dashboard') {
    $users = $client->request('GET', '/users');
    $credentials = $client->request('GET', '/tockens');
    $repos = $client->request('GET', '/repos');
    foreach ([$users, $credentials, $repos] as $result) {
        if ($result['status'] === 401) {
            json_response(['success' => false, 'message' => 'Your session expired', 'sessionExpired' => true], 401);
        }
    }
    json_response([
        'success' => true,
        'data' => [
            'users' => $users['body']['data'] ?? [],
            'credentials' => $credentials['body']['data'] ?? [],
            'repositories' => $repos['body']['data'] ?? [],
            'partialFailure' => max($users['status'], $credentials['status'], $repos['status']) >= 400,
        ],
    ]);
}

$id = filter_var($data['id'] ?? null, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]);
$routes = [
    'list_users' => ['GET', '/users', null, 20],
    'create_user' => ['POST', '/users', $data, 20],
    'update_user' => ['PUT', $id ? "/users/$id" : '', $data, 20],
    'delete_user' => ['DELETE', $id ? "/users/$id" : '', null, 20],
    'list_credentials' => ['GET', '/tockens', null, 20],
    'create_credential' => ['POST', '/tockens', $data, 20],
    'delete_credential' => ['DELETE', $id ? "/tockens/$id" : '', null, 20],
    'list_repositories' => ['GET', '/repos', null, 20],
    'clone_repository' => ['POST', '/repos/clone', $data, 150],
];

if (!isset($routes[$action])) {
    json_response(['success' => false, 'message' => 'Unsupported action'], 400);
}

[$method, $path, $payload, $timeout] = $routes[$action];
if ($path === '') {
    json_response(['success' => false, 'message' => 'A valid record ID is required'], 400);
}

if (in_array($action, ['update_user', 'create_user'], true)) {
    unset($payload['id']);
}

$result = $client->request($method, $path, $payload, true, $timeout);
if ($result['status'] === 401) {
    $result['body']['sessionExpired'] = true;
}
if ($action === 'delete_user' && $result['status'] < 300 && $id === (int) ($_SESSION['user']['id'] ?? 0)) {
    clear_auth_session();
    $result['body']['redirect'] = '/login.php';
}
if ($action === 'update_user' && $result['status'] < 300 && $id === (int) ($_SESSION['user']['id'] ?? 0)) {
    $_SESSION['user'] = $result['body']['data'];
}
json_response($result['body'], $result['status']);
