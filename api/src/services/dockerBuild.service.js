const ApiError = require("../utils/ApiError");

function getDockerBuildApiUrl() {
  const configuredUrl = process.env.DOCKER_BUILD_API_URL;

  if (!configuredUrl) {
    throw new ApiError(500, "Docker build API is not configured");
  }

  let parsedUrl;

  try {
    parsedUrl = new URL(configuredUrl);
  } catch {
    throw new ApiError(500, "Docker build API URL is invalid");
  }

  if (!["http:", "https:"].includes(parsedUrl.protocol)) {
    throw new ApiError(500, "Docker build API URL must use HTTP or HTTPS");
  }

  return parsedUrl.toString();
}

function getBuildTimeout() {
  const configuredTimeout = Number(process.env.DOCKER_BUILD_API_TIMEOUT_MS);

  if (
    Number.isInteger(configuredTimeout) &&
    configuredTimeout >= 1000
  ) {
    return configuredTimeout;
  }

  return 120000;
}

async function buildDockerImage({
  dockerfilePath,
  imageName,
}) {
  const dockerBuildApiUrl = getDockerBuildApiUrl();
  const controller = new AbortController();
  const timeout = setTimeout(() => {
    controller.abort();
  }, getBuildTimeout());

  let response;

  try {
    response = await fetch(dockerBuildApiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        dockerfile_path: dockerfilePath,
        image_name: imageName,
      }),
      signal: controller.signal,
    });
  } catch (error) {
    if (error.name === "AbortError") {
      throw new ApiError(502, "Docker build API request timed out");
    }

    throw new ApiError(502, "Could not reach the Docker build API");
  } finally {
    clearTimeout(timeout);
  }

  let result;

  try {
    result = await response.json();
  } catch {
    throw new ApiError(502, "Docker build API returned invalid JSON");
  }

  if (!response.ok || result.success !== true) {
    throw new ApiError(
      502,
      `Docker build API failed with status ${response.status}`,
    );
  }

  return {
    success: true,
    message: result.message,
    imageName: result.image_name || imageName,
    zipFile: result.zip_file || null,
  };
}

module.exports = {
  buildDockerImage,
};
