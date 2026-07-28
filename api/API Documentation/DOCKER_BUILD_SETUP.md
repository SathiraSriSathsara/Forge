# Docker Build Integration

After every successful manual repository clone/update and every accepted Gitea
push synchronization, this API calls the configured Docker build service.

## Configuration

Add the complete build endpoint to `.env`:

```dotenv
DOCKER_BUILD_API_URL=http://localhost:8000/build

# Optional; defaults to 120000 milliseconds.
DOCKER_BUILD_API_TIMEOUT_MS=120000
```

`DOCKER_BUILD_API_URL` must use HTTP or HTTPS and must include `/build`.

The API sends:

```http
POST /build
Content-Type: application/json
Accept: application/json
```

```json
{
  "dockerfile_path": "C:\\path\\to\\api\\repos\\example-project",
  "image_name": "forge-example-project"
}
```

`dockerfile_path` is the absolute `Repo.saved_location`. The Docker build
service must run on the same host or have that exact path available through a
shared filesystem mount.

## Image names

Image names are generated from the sanitized repository name:

1. Convert the name to lowercase.
2. Replace groups of characters other than letters and numbers with `-`.
3. Remove leading and trailing `-`.
4. Prefix the result with `forge-`.

For example, `My Backend_API` becomes `forge-my-backend-api`. The generated
name is stored in `Repo.image_name` and reused for later webhook builds.

## Successful build

The build service must return HTTP `200` JSON:

```json
{
  "success": true,
  "message": "Docker image built successfully",
  "image_name": "forge-example-project",
  "zip_file": "/output/forge-example-project.zip"
}
```

The clone and webhook responses include the persisted `imageName` and a safe
copy of the builder result:

```json
{
  "imageName": "forge-example-project",
  "dockerBuild": {
    "success": true,
    "message": "Docker image built successfully",
    "imageName": "forge-example-project",
    "zipFile": "/output/forge-example-project.zip"
  }
}
```

## Failure behavior

The API returns `502` when the builder cannot be reached, times out, returns
non-JSON, returns a non-success status, or responds with `success` other than
`true`.

Git synchronization and repository metadata are committed before the external
build request. Therefore, a `502` can mean the source repository was updated
successfully but its image was not built. Retrying the clone request or
redelivering the webhook safely synchronizes to the latest commit and attempts
the build again.

Run the database update in
[DOCKER_BUILD_DATABASE.md](DOCKER_BUILD_DATABASE.md) before deploying this
change to an existing database.
