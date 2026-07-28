# Gitea Webhook Setup

This API can synchronize a configured Gitea repository automatically after a
push to its selected branch. Pull-request merges are handled by the push event
that Gitea emits for the target branch.

## Prerequisites

- The repository must first be registered through `POST /api/repos/clone`.
- The selected `Tocken` record must use the `gitea` platform.
- The API must be reachable from the Gitea server over HTTPS.
- Existing databases must be updated using
  [GITEA_WEBHOOK_DATABASE.md](GITEA_WEBHOOK_DATABASE.md).

## 1. Generate a webhook secret

The API requires a secret between 32 and 255 characters. Generate a 32-byte
hexadecimal secret with Node.js:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Store the secret securely. The exact same value must be supplied to the clone
endpoint and the Gitea webhook configuration.

## 2. Register or update the repository

```http
POST /api/repos/clone
Content-Type: application/json
Authorization: Bearer <access-token>
```

```json
{
  "name": "repository-name",
  "url": "https://git.example.com/user/repository.git",
  "tockenID": 1,
  "branch": "main",
  "webhookSecret": "replace-with-a-secret-containing-at-least-32-characters"
}
```

The response includes the relative webhook endpoint:

```json
{
  "success": true,
  "data": {
    "id": 1,
    "webhookEndpoint": "/api/webhooks/gitea/1"
  }
}
```

The Git token and webhook secret are never included in the response.

## 3. Configure Gitea

Open the repository in Gitea, then go to **Settings → Webhooks → Add Webhook →
Gitea** and use:

| Setting | Value |
| --- | --- |
| Target URL | `https://<api-host>/api/webhooks/gitea/<repo-id>` |
| HTTP method | `POST` |
| POST content type | `application/json` |
| Secret | The same secret sent as `webhookSecret` |
| Trigger on | Push Events |
| Branch filter | The configured branch, for example `main` |
| Active | Enabled |

The repository clone endpoint requires JWT authentication. Do not add JWT or
login credentials to the Gitea webhook target itself; its authentication
mechanism is the signed webhook body.

## Signature verification

Gitea signs the exact request bytes using HMAC-SHA256 and the configured
secret. It sends the lowercase hexadecimal digest in `X-Gitea-Signature`
without a `sha256=` prefix. The API calculates the digest from the preserved
raw JSON body and compares the two binary digests with a constant-time
comparison.

Changing whitespace or re-serializing the JSON before calculating a manual
test signature produces a different digest.

## Test a normal push

1. Commit a change on the configured branch.
2. Push that branch to Gitea.
3. Open the webhook's **Recent Deliveries** page and confirm a `200` response.
4. Confirm the local repository under `<project-root>/repos` matches the remote
   branch.
5. Confirm `last_commit` and `last_updated` changed in the `Repo` table.
6. Confirm the Docker build service built the persisted `image_name`.

A successful response resembles:

```json
{
  "success": true,
  "message": "Repository synchronized successfully",
  "data": {
    "id": 1,
    "name": "repository-name",
    "branch": "main",
    "action": "updated",
    "lastCommit": "0123456789abcdef",
    "lastUpdated": "2026-07-29T10:00:00.000Z",
    "imageName": "forge-repository-name",
    "dockerBuild": {
      "success": true,
      "message": "Docker image built successfully",
      "imageName": "forge-repository-name",
      "zipFile": "/output/forge-repository-name.zip"
    }
  }
}
```

## Test a merged pull request

1. Create a pull request whose target is the configured branch.
2. Merge the pull request in Gitea.
3. Inspect the resulting `push` delivery for the target branch.
4. Confirm the API returns `200` and checks out the merge commit locally.

No pull-request event subscription is required.

## Expected terminal output

After a successful synchronization, the API prints `Hey` exactly, followed by
safe repository metadata:

```text
Hey
{
  repository: 'repository-name',
  branch: 'main',
  action: 'updated',
  commit: '0123456789abcdef'
}
```

Tokens, webhook secrets, request headers, payloads, and authorization headers
are not logged.

## Intentionally ignored deliveries

The API returns `200` without running Git operations for:

- Events other than `push`
- Tags and other non-branch refs
- Pushes to branches other than the configured branch
- Branch deletions, identified by an all-zero `after` commit

## Common errors

### `401 Invalid webhook signature`

- Confirm Gitea and the clone request use the identical secret.
- Confirm the POST content type is `application/json`.
- Do not add `sha256=` to `X-Gitea-Signature`.
- Re-register the repository if the stored secret must be rotated.

### Branch ignored

The webhook branch and `Repo.branch` must match exactly. Check both the Gitea
branch filter and the branch supplied to `/api/repos/clone`.

### `404 Repository not found`

The repository ID in the target URL does not exist. Use the
`webhookEndpoint` returned by the clone endpoint.

### Git authentication failed

Confirm the related `Tocken` is for the correct Gitea server, its username and
access token remain valid, and the token can read the repository.

### `202 Repository update already in progress`

Another webhook is currently synchronizing the same repository in this API
process. Gitea may retry later; a later push will also synchronize to the
latest remote commit.

The lock is process-local. Deployments with multiple Node.js processes should
replace it with shared coordination such as Redis and BullMQ.
