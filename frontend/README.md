# Forge Simplified Frontend

PHP 8.2 frontend for the Forge Simplified API.

## Setup

```powershell
npm install
npm run build
php -S localhost:8080 -t public
```

Open `http://localhost:8080`. The API defaults to
`http://localhost:3000/api`. Override it for the PHP process with the
`FORGE_API_URL` environment variable.

The PHP `curl`, `json`, and `session` extensions are required. Serve the
application over HTTPS in production so the session cookie receives the
`Secure` flag.
