# Forge Simplified API

REST API for managing users, encrypted Git credentials, and local Git repository
copies. The service is built with Express, Sequelize, MySQL, and `simple-git`.

> [!IMPORTANT]
> The word **tocken** is misspelled in the current source code and is therefore
> part of the public API. Use `/api/tockens` and `tockenID` exactly as shown.

## Contents

- [Quick start](#quick-start)
- [Configuration](#configuration)
- [Conventions](#conventions)
- [Endpoint summary](#endpoint-summary)
- [Health check](#health-check)
- [Users](#users)
- [Git credentials](#git-credentials)
- [Repositories](#repositories)
- [Errors](#errors)
- [Data models](#data-models)
- [Security and operational notes](#security-and-operational-notes)

## Quick start

### Requirements

- Node.js and npm
- MySQL
- Git available on the server's `PATH`

Install dependencies:

```bash
npm install
```

Create a `.env` file in the project root:

```dotenv
PORT=3000
NODE_ENV=development

DB_HOST=localhost
DB_PORT=3306
DB_NAME=forge_simplified
DB_USER=root
DB_PASSWORD=change-me

# Exactly 32 random bytes represented by 64 hexadecimal characters.
TOKEN_ENCRYPTION_KEY=replace-with-a-64-character-hexadecimal-key
```

Generate an encryption key with Node.js:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Start the server:

```bash
# Production-style start
npm start

# Development mode with automatic restart
npm run dev
```

At startup, the service authenticates with MySQL and runs
`sequelize.sync()`. The default address is `http://localhost:3000`, and all
API routes are under `/api`.

## Configuration

| Variable | Required | Default | Description |
| --- | --- | --- | --- |
| `PORT` | No | `3000` | HTTP server port. |
| `NODE_ENV` | No | — | Set to `development` to include stack traces in error responses. |
| `DB_HOST` | Yes | — | MySQL host. |
| `DB_PORT` | No | `3306` | MySQL port. |
| `DB_NAME` | Yes | — | MySQL database name. The database must already exist. |
| `DB_USER` | Yes | — | MySQL username. |
| `DB_PASSWORD` | Yes | — | MySQL password. |
| `TOKEN_ENCRYPTION_KEY` | Yes for credential operations | — | A 64-character hexadecimal AES-256 key. |

Keep `TOKEN_ENCRYPTION_KEY` stable. Credentials encrypted with one key cannot
be decrypted after the key is changed or lost.

## Conventions

### Base URL

```text
http://localhost:3000/api
```

### Request format

Endpoints that accept a body expect JSON:

```http
Content-Type: application/json
```

URL-encoded bodies are also enabled. CORS currently permits requests from any
origin.

### Authentication

The API itself currently has no authentication or authorization middleware.
The Git credentials stored through this API are used only when cloning or
updating repositories.

### Dates and IDs

- IDs are auto-incrementing integers.
- Sequelize serializes timestamps as ISO 8601 strings.
- Unknown request fields are generally ignored unless application validation
  explicitly rejects them.

## Endpoint summary

| Method | Path | Description | Success |
| --- | --- | --- | --- |
| `GET` | `/api` | Check API availability. | `200` |
| `POST` | `/api/users` | Create a user. | `201` |
| `GET` | `/api/users` | List users. | `200` |
| `GET` | `/api/users/:id` | Get one user. | `200` |
| `PUT` | `/api/users/:id` | Update a user (see current limitation). | `200` |
| `DELETE` | `/api/users/:id` | Delete a user. | `200` |
| `POST` | `/api/tockens` | Store an encrypted Git credential. | `201` |
| `GET` | `/api/tockens` | List credential metadata. | `200` |
| `DELETE` | `/api/tockens/:id` | Delete a credential. | `200` |
| `POST` | `/api/repos/clone` | Clone or synchronize a repository. | `200` or `201` |

## Health check

### `GET /api`

Confirms that the Express API is running.

**Response — `200 OK`**

```json
{
  "success": true,
  "message": "API is running"
}
```

This endpoint does not perform a separate database or Git health check.

## Users

### User object

| Field | Type | Notes |
| --- | --- | --- |
| `id` | integer | Generated primary key. |
| `firstName` | string | Required, maximum database length 100. |
| `lastName` | string | Required by the database, maximum length 100. |
| `username` | string | Required, maximum length 100. Not unique. |
| `email` | string | Required, valid email, maximum length 150, unique. |
| `password` | string | Bcrypt hash stored in the database. |
| `createdAt` | string | Creation timestamp. |
| `updatedAt` | string | Last update timestamp. |

> [!WARNING]
> Current user create, list, get, and update responses serialize the complete
> Sequelize user, including the bcrypt password hash. Do not expose these
> endpoints to untrusted clients until password fields are excluded.

### Create a user

`POST /api/users`

**Body**

```json
{
  "firstName": "Ada",
  "lastName": "Lovelace",
  "email": "ada@example.com",
  "username": "ada",
  "password": "a-strong-password"
}
```

| Field | Required | Validation |
| --- | --- | --- |
| `firstName` | Yes | Non-empty at controller level. |
| `lastName` | Yes | Required by the model. |
| `email` | Yes | Non-empty, valid email, and unique. |
| `username` | Yes | Non-empty. |
| `password` | Yes | Non-empty; hashed with bcrypt cost factor 10. |

The controller's initial missing-field message says “All fields are required”
but does not explicitly check `lastName`. Omitting `lastName` still produces a
`400 Validation failed` response from Sequelize.

**Response — `201 Created`**

```json
{
  "success": true,
  "message": "User created successfully",
  "data": {
    "id": 1,
    "firstName": "Ada",
    "lastName": "Lovelace",
    "email": "ada@example.com",
    "username": "ada",
    "password": "$2b$10$...",
    "updatedAt": "2026-07-29T10:00:00.000Z",
    "createdAt": "2026-07-29T10:00:00.000Z"
  }
}
```

Possible errors include `400` for missing/invalid fields and `409` when the
email is already registered.

### List users

`GET /api/users`

Returns all users ordered by `id` descending. There is no pagination.

**Response — `200 OK`**

```json
{
  "success": true,
  "count": 1,
  "data": [
    {
      "id": 1,
      "firstName": "Ada",
      "lastName": "Lovelace",
      "username": "ada",
      "email": "ada@example.com",
      "password": "$2b$10$...",
      "createdAt": "2026-07-29T10:00:00.000Z",
      "updatedAt": "2026-07-29T10:00:00.000Z"
    }
  ]
}
```

### Get a user

`GET /api/users/:id`

| Parameter | Location | Description |
| --- | --- | --- |
| `id` | Path | User ID. |

**Response — `200 OK`**

```json
{
  "success": true,
  "data": {
    "id": 1,
    "firstName": "Ada",
    "lastName": "Lovelace",
    "username": "ada",
    "email": "ada@example.com",
    "password": "$2b$10$...",
    "createdAt": "2026-07-29T10:00:00.000Z",
    "updatedAt": "2026-07-29T10:00:00.000Z"
  }
}
```

Returns `404 User not found` when no matching record exists.

### Update a user

`PUT /api/users/:id`

The current controller accepts `name`, `email`, and `age`:

```json
{
  "name": "Ada Byron",
  "email": "ada.byron@example.com",
  "age": 30
}
```

> [!CAUTION]
> The User model contains `firstName`, `lastName`, and `username`, but does not
> contain `name` or `age`. Sequelize ignores those unknown fields, so only
> `email` is effectively updateable through this endpoint. Password updates
> are not supported. This mismatch should be fixed before clients rely on a
> full user update.

**Response — `200 OK`**

```json
{
  "success": true,
  "message": "User updated successfully",
  "data": {
    "id": 1,
    "firstName": "Ada",
    "lastName": "Lovelace",
    "username": "ada",
    "email": "ada.byron@example.com",
    "password": "$2b$10$...",
    "createdAt": "2026-07-29T10:00:00.000Z",
    "updatedAt": "2026-07-29T11:00:00.000Z"
  }
}
```

Returns `404 User not found`, `400` for an invalid email, or `409` if the new
email conflicts with another user.

### Delete a user

`DELETE /api/users/:id`

**Response — `200 OK`**

```json
{
  "success": true,
  "message": "User deleted successfully"
}
```

Returns `404 User not found` when no matching record exists.

## Git credentials

Git credentials are stored encrypted with AES-256-GCM. The plaintext token is
never returned by the API. Supported platform values are `github` and `gitea`.

### Credential metadata object

| Field | Type | Notes |
| --- | --- | --- |
| `id` | integer | Generated primary key. |
| `name` | string | User-defined label, trimmed. |
| `platform` | string | `github` or `gitea`, normalized to lowercase. |
| `username` | string | Git account username, trimmed. |
| `createdAt` | string | Creation timestamp; list response only. |
| `updatedAt` | string | Last update timestamp; list response only. |

### Store a credential

`POST /api/tockens`

**Body**

```json
{
  "name": "GitHub automation",
  "platform": "github",
  "username": "octocat",
  "tocken": "github-personal-access-token"
}
```

All four fields are required. `platform` is trimmed and converted to lowercase;
`name` and `username` are trimmed. The plaintext `tocken` is encrypted before
it is written to MySQL.

**Response — `201 Created`**

```json
{
  "success": true,
  "message": "Git token saved successfully",
  "data": {
    "id": 1,
    "name": "GitHub automation",
    "platform": "github",
    "username": "octocat"
  }
}
```

Returns `400` when a field is missing or the platform is unsupported. A
missing or invalid server encryption key currently surfaces as `500`.

### List credentials

`GET /api/tockens`

Returns credential metadata ordered by creation time descending. Encrypted and
plaintext token values are both excluded.

**Response — `200 OK`**

```json
{
  "success": true,
  "count": 1,
  "data": [
    {
      "id": 1,
      "name": "GitHub automation",
      "platform": "github",
      "username": "octocat",
      "createdAt": "2026-07-29T10:00:00.000Z",
      "updatedAt": "2026-07-29T10:00:00.000Z"
    }
  ]
}
```

### Delete a credential

`DELETE /api/tockens/:id`

**Response — `200 OK`**

```json
{
  "success": true,
  "message": "Tocken deleted successfully"
}
```

Returns `404 Tocken not found` when no matching credential exists.

## Repositories

### Clone or synchronize a repository

`POST /api/repos/clone`

Clones a repository into the server's `<project-root>/repos` directory. If the
local directory already contains the requested repository, it is synchronized
to the remote. The resulting repository metadata is saved to MySQL.

**Body**

```json
{
  "name": "example-project",
  "url": "https://github.com/example/example-project.git",
  "tockenID": 1,
  "branch": "main"
}
```

| Field | Required | Description |
| --- | --- | --- |
| `name` | Yes | Local folder name. Unsafe characters become `-`; a trailing `.git` is removed. |
| `url` | Yes | HTTPS Git URL. A missing `.git` suffix is added automatically. Embedded URL credentials are removed. |
| `tockenID` | Yes | ID of a stored Git credential. |
| `branch` | No | Branch to clone/synchronize. If omitted, the remote default branch is used, falling back to `main` if it cannot be detected. |

For a credential whose platform is `github`, the URL host must be exactly
`github.com`. Gitea credentials accept any HTTPS host.

The stored username and decrypted token are sent to Git through an HTTP Basic
`Authorization` header. The token is not inserted into the repository URL.

#### Actions

The response's `action` field explains what happened:

| Action | Meaning |
| --- | --- |
| `cloned` | The local folder did not exist and was cloned. |
| `updated` | The folder contained the requested repository and was synchronized. |
| `recloned` | The folder existed but was not a Git repository; it was removed and cloned again. |
| `replaced` | The folder contained a repository with a different origin; it was removed and replaced. |

> [!WARNING]
> Updating is destructive to the local repository copy. The API fetches and
> prunes, recreates the local branch from `origin/<branch>`, hard-resets it,
> and removes all untracked files and directories. Recloning and replacing
> remove the existing local directory recursively.

**Response — `201 Created`**

Returned when a new database record is created:

```json
{
  "success": true,
  "message": "Repository cloned successfully",
  "data": {
    "id": 1,
    "name": "example-project",
    "url": "https://github.com/example/example-project.git",
    "branch": "main",
    "savedLocation": "C:\\path\\to\\api\\repos\\example-project",
    "lastCommit": "a1b2c3d4e5f6...",
    "lastUpdated": "2026-07-29T10:00:00.000Z",
    "action": "cloned"
  }
}
```

**Response — `200 OK`**

Returned when the repository URL already has a database record. The same
schema is used, with `action` commonly set to `updated`. The message is
`Repository updated successfully` only for `updated`; `recloned` and
`replaced` use `Repository cloned successfully`.

Common errors:

| Status | Condition |
| --- | --- |
| `400` | Missing `name`, `url`, or `tockenID`; invalid name/URL; non-HTTPS URL; unsupported platform; GitHub host mismatch. |
| `404` | Credential does not exist, or the requested remote branch does not exist during an update. |
| `409` | A different repository database record already uses the computed local folder. |
| `500` | Credential decryption fails, local repository has no `origin`, Git fails, or a filesystem/database operation fails. |

Operational details:

- Repository URLs are unique in the database.
- A local folder may not be shared by two different repository URLs.
- The last checked-out commit hash is stored in `lastCommit`.
- An authentication header temporarily added to an existing repository's
  local Git configuration is removed in a `finally` block.
- Clone failures and other partial failures are not transactionally rolled
  back across the filesystem and database.

## Errors

All routed errors use this envelope:

```json
{
  "success": false,
  "message": "Human-readable error message",
  "errors": null
}
```

Sequelize validation errors return field details:

```json
{
  "success": false,
  "message": "Validation failed",
  "errors": [
    {
      "field": "email",
      "message": "Validation isEmail on email failed"
    }
  ]
}
```

Unique constraint errors use status `409` and the message
`The provided value already exists`. When `NODE_ENV=development`, the response
also contains a `stack` property.

Unknown routes return `404`:

```json
{
  "success": false,
  "message": "Route not found: GET /api/unknown",
  "errors": null
}
```

## Data models

MySQL table names and columns are generated by Sequelize with underscored
timestamps.

### `users`

`id`, `first_name`, `last_name`, `username`, `email`, `password`,
`created_at`, `updated_at`

### `Tocken`

`id`, `name`, `platform`, `username`, `tocken`, `created_at`, `updated_at`

The encrypted value format is:

```text
ivHex:authenticationTagHex:ciphertextHex
```

### `Repo`

`id`, `repo_name`, `saved_location`, `repo_url`, `branch`, `last_commit`,
`last_updated`, `created_at`, `updated_at`

No model associations or foreign-key constraints are currently defined.
Deleting a credential does not delete repository records that previously used
it.

## Security and operational notes

- Add authentication and role-based authorization before deployment. Every
  endpoint is currently public.
- Exclude password hashes from all user responses.
- Treat `TOKEN_ENCRYPTION_KEY` as a production secret and store it outside
  source control.
- Restrict CORS to trusted origins.
- Apply request-size limits, rate limiting, audit logging, and TLS at the
  application or reverse-proxy layer.
- Git clone/sync makes outbound network requests and writes to disk. Run the
  service with limited filesystem permissions and monitor disk usage.
- The repository URL validator restricts GitHub credentials to `github.com`,
  but arbitrary HTTPS hosts are accepted for Gitea. Use an allowlist if API
  clients are untrusted to reduce server-side request forgery risk.
- Database schema synchronization runs automatically on every startup. Use
  migrations for controlled production schema changes.

## cURL examples

```bash
# Health
curl http://localhost:3000/api

# Create a credential
curl -X POST http://localhost:3000/api/tockens \
  -H "Content-Type: application/json" \
  -d '{"name":"GitHub automation","platform":"github","username":"octocat","tocken":"YOUR_TOKEN"}'

# Clone or update a repository
curl -X POST http://localhost:3000/api/repos/clone \
  -H "Content-Type: application/json" \
  -d '{"name":"example-project","url":"https://github.com/example/example-project.git","tockenID":1,"branch":"main"}'
```
