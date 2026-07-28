<?php
declare(strict_types=1);

final class ApiClient
{
    public function request(string $method, string $path, ?array $payload = null, bool $authenticated = true, int $timeout = 20): array
    {
        $handle = curl_init(API_BASE_URL . '/' . ltrim($path, '/'));
        $headers = ['Accept: application/json', 'Content-Type: application/json'];
        if ($authenticated && !empty($_SESSION['access_token'])) {
            $headers[] = 'Authorization: Bearer ' . $_SESSION['access_token'];
        }

        curl_setopt_array($handle, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_CUSTOMREQUEST => strtoupper($method),
            CURLOPT_HTTPHEADER => $headers,
            CURLOPT_CONNECTTIMEOUT => 5,
            CURLOPT_TIMEOUT => $timeout,
            CURLOPT_FOLLOWLOCATION => false,
        ]);
        if ($payload !== null) {
            curl_setopt($handle, CURLOPT_POSTFIELDS, json_encode($payload, JSON_UNESCAPED_SLASHES));
        }

        $raw = curl_exec($handle);
        $status = (int) curl_getinfo($handle, CURLINFO_RESPONSE_CODE);
        $curlError = curl_error($handle);
        curl_close($handle);

        if ($raw === false) {
            return ['status' => 503, 'body' => [
                'success' => false,
                'message' => $curlError ?: 'The API is unavailable',
                'errors' => null,
            ]];
        }

        $body = json_decode($raw, true);
        if (!is_array($body)) {
            return ['status' => 502, 'body' => [
                'success' => false,
                'message' => 'The API returned an invalid response',
                'errors' => null,
            ]];
        }

        if ($authenticated && $status === 401) {
            clear_auth_session();
        }

        return ['status' => $status ?: 502, 'body' => $body];
    }
}
