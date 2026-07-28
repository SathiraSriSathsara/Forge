const fs = require("fs/promises");
const path = require("path");
const crypto = require("crypto");
const { Buffer } = require("buffer");
const simpleGit = require("simple-git");

const { Repo, Tocken } = require("../models");
const asyncHandler = require("../utils/asyncHandler");
const ApiError = require("../utils/ApiError");
const { decryptToken } = require("../utils/tokenCrypto");
const {
  buildDockerImage,
} = require("../services/dockerBuild.service");

// Repository storage directory:
// API/repos
const REPOS_ROOT = path.resolve(process.cwd(), "repos");
const activeRepositoryUpdates = new Set();

function resolveRepositoryPath(savedLocation) {
  if (!savedLocation || typeof savedLocation !== "string") {
    throw new ApiError(500, "Repository location is not configured");
  }

  const repositoryPath = path.resolve(savedLocation);

  if (!repositoryPath.startsWith(`${REPOS_ROOT}${path.sep}`)) {
    throw new ApiError(500, "Repository location is outside the repositories root");
  }

  return repositoryPath;
}

function validateWebhookSecret(webhookSecret) {
  if (
    typeof webhookSecret !== "string" ||
    webhookSecret.length < 32 ||
    webhookSecret.length > 255
  ) {
    throw new ApiError(
      400,
      "webhookSecret must be between 32 and 255 characters",
    );
  }

  return webhookSecret;
}

function createDockerImageName(repositoryName) {
  const normalizedName = repositoryName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return `forge-${normalizedName || "repository"}`;
}

function verifyGiteaSignature(rawBody, signature, secret) {
  if (
    !Buffer.isBuffer(rawBody) ||
    typeof signature !== "string" ||
    typeof secret !== "string" ||
    !/^[a-f0-9]{64}$/.test(signature)
  ) {
    return false;
  }

  const expectedDigest = crypto
    .createHmac("sha256", secret)
    .update(rawBody)
    .digest();
  const suppliedDigest = Buffer.from(signature, "hex");

  return (
    expectedDigest.length === suppliedDigest.length &&
    crypto.timingSafeEqual(expectedDigest, suppliedDigest)
  );
}

/**
 * Convert a value into a safe folder name.
 */
function sanitizeRepositoryName(name) {
  if (!name || typeof name !== "string") {
    throw new ApiError(400, "Repository name is required");
  }

  const sanitizedName = name
    .trim()
    .replace(/\.git$/i, "")
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .replace(/-+/g, "-");

  if (!sanitizedName || sanitizedName === "." || sanitizedName === "..") {
    throw new ApiError(400, "Invalid repository name");
  }

  return sanitizedName;
}

/**
 * Validate repository URL.
 */
function validateRepositoryUrl(repoUrl, platform) {
  let parsedUrl;

  try {
    parsedUrl = new URL(repoUrl);
  } catch {
    throw new ApiError(400, "Invalid repository URL");
  }

  if (parsedUrl.protocol !== "https:") {
    throw new ApiError(
      400,
      "Only HTTPS repository URLs are currently supported",
    );
  }

  if (platform === "github" && parsedUrl.hostname !== "github.com") {
    throw new ApiError(400, "The token is for GitHub, but the URL is not GitHub");
  }

  if (!parsedUrl.pathname.endsWith(".git")) {
    parsedUrl.pathname = `${parsedUrl.pathname.replace(/\/$/, "")}.git`;
  }

  // Remove any credentials supplied by the client.
  parsedUrl.username = "";
  parsedUrl.password = "";

  return parsedUrl.toString();
}

/**
 * Create HTTP Basic authorization header.
 *
 * The token will not be placed directly inside the repository URL.
 */
function createAuthenticationHeader(username, token) {
  const credentials = Buffer.from(`${username}:${token}`).toString("base64");

  return `Authorization: Basic ${credentials}`;
}

/**
 * Check whether a directory exists.
 */
async function directoryExists(directoryPath) {
  try {
    const stats = await fs.stat(directoryPath);
    return stats.isDirectory();
  } catch (error) {
    if (error.code === "ENOENT") {
      return false;
    }

    throw error;
  }
}

/**
 * Check whether a directory is a valid Git repository.
 */
async function isGitRepository(repositoryPath) {
  try {
    const git = simpleGit(repositoryPath);
    return await git.checkIsRepo();
  } catch {
    return false;
  }
}

/**
 * Determine the remote default branch.
 */
async function getDefaultBranch(git) {
  try {
    const result = await git.raw([
      "symbolic-ref",
      "--short",
      "refs/remotes/origin/HEAD",
    ]);

    return result.trim().replace(/^origin\//, "");
  } catch {
    return "main";
  }
}

/**
 * Clone a new repository.
 */
async function cloneRepository({
  repoUrl,
  repositoryPath,
  authHeader,
  requestedBranch,
}) {
  const git = simpleGit();

  const cloneOptions = [
    "--origin",
    "origin",
    "--config",
    `http.extraHeader=${authHeader}`,
  ];

  if (requestedBranch) {
    cloneOptions.push("--branch", requestedBranch);
    cloneOptions.push("--single-branch");
  }

  try {
    await git.clone(repoUrl, repositoryPath, cloneOptions);
  } finally {
    /*
     * Git persists clone --config values in the new repository. Remove the
     * authorization header even when a clone leaves a partial repository.
     */
    try {
      const clonedGit = simpleGit(repositoryPath);
      await clonedGit.raw(["config", "--unset-all", "http.extraHeader"]);
    } catch {
      // The clone may have failed before a Git repository was created.
    }
  }

  if (requestedBranch) {
    return requestedBranch;
  }

  const clonedGit = simpleGit(repositoryPath);
  return getDefaultBranch(clonedGit);
}

/**
 * Update an existing repository.
 *
 * This operation:
 * - downloads the latest remote changes;
 * - resets local files to the remote branch;
 * - removes old untracked files and folders.
 */
async function updateRepository({
  repositoryPath,
  authHeader,
  requestedBranch,
}) {
  const git = simpleGit(repositoryPath);

  const remotes = await git.getRemotes(true);
  const originExists = remotes.some((remote) => remote.name === "origin");

  if (!originExists) {
    throw new ApiError(500, "The local repository does not have an origin");
  }

  await git.addConfig("http.extraHeader", authHeader, false, "local");

  try {
    await git.fetch(["origin", "--prune"]);

    const branch = requestedBranch || (await getDefaultBranch(git));

    const remoteBranchExists = await git.raw([
      "ls-remote",
      "--heads",
      "origin",
      branch,
    ]);

    if (!remoteBranchExists.trim()) {
      throw new ApiError(
        404,
        `The branch '${branch}' was not found in the remote repository`,
      );
    }

    // Create or replace the local branch from the remote branch.
    await git.raw(["checkout", "-B", branch, `origin/${branch}`]);

    // Remove local changes and synchronize exactly with the remote.
    await git.reset(["--hard", `origin/${branch}`]);

    // Remove untracked files and directories.
    await git.clean("f", ["-d"]);

    return branch;
  } finally {
    /*
     * Do not permanently leave the token-containing authorization header
     * inside .git/config.
     */
    try {
      await git.raw(["config", "--unset-all", "http.extraHeader"]);
    } catch {
      // It may already be absent.
    }
  }
}

/**
 * POST /api/repos/clone
 */
exports.cloneRepo = asyncHandler(async (req, res) => {
  const { name, url, tockenID, branch, webhookSecret } = req.body;

  if (!name || !url || !tockenID || webhookSecret === undefined) {
    throw new ApiError(
      400,
      "name, url, tockenID and webhookSecret fields are required",
    );
  }

  const validatedWebhookSecret = validateWebhookSecret(webhookSecret);
  const tocken = await Tocken.findByPk(tockenID);

  if (!tocken) {
    throw new ApiError(404, "Tocken not found");
  }

  const platform = String(tocken.platform).trim().toLowerCase();

  if (!["github", "gitea"].includes(platform)) {
    throw new ApiError(400, "Unsupported Git platform");
  }

  let decryptedTocken;

  try {
    decryptedTocken = decryptToken(tocken.tocken);
  } catch {
    throw new ApiError(500, "Could not decrypt the stored Git token");
  }

  const repoName = sanitizeRepositoryName(name);
  const repositoryPath = path.join(REPOS_ROOT, repoName);
  const imageName = createDockerImageName(repoName);

  /*
   * This additional check prevents path traversal.
   */
  if (!repositoryPath.startsWith(`${REPOS_ROOT}${path.sep}`)) {
    throw new ApiError(400, "Invalid repository location");
  }

  const repoUrl = validateRepositoryUrl(url, platform);

  const existingRepoForUrl = await Repo.findOne({
    where: {
      repo_url: repoUrl,
    },
  });

  /*
   * Prevent two different database entries from using the same folder.
   */
  const repoUsingSameLocation = await Repo.findOne({
    where: {
      saved_location: repositoryPath,
    },
  });

  if (
    repoUsingSameLocation &&
    repoUsingSameLocation.repo_url !== repoUrl
  ) {
    throw new ApiError(
      409,
      "Another repository is already using this local folder",
    );
  }

  await fs.mkdir(REPOS_ROOT, {
    recursive: true,
  });

  const authHeader = createAuthenticationHeader(
    tocken.username,
    decryptedTocken,
  );

  let action;
  let selectedBranch;

  const localDirectoryExists = await directoryExists(repositoryPath);

  if (localDirectoryExists) {
    const validGitRepository = await isGitRepository(repositoryPath);

    if (!validGitRepository) {
      /*
       * A folder exists, but it is not a Git repository.
       * Remove it and clone a clean copy.
       */
      await fs.rm(repositoryPath, {
        recursive: true,
        force: true,
      });

      selectedBranch = await cloneRepository({
        repoUrl,
        repositoryPath,
        authHeader,
        requestedBranch: branch,
      });

      action = "recloned";
    } else {
      const localGit = simpleGit(repositoryPath);
      const remoteUrl = await localGit.remote(["get-url", "origin"]);

      /*
       * Make sure the existing local folder belongs to the requested URL.
       */
      const normalizedRemoteUrl = remoteUrl
        .trim()
        .replace(/\/$/, "");

      const normalizedRequestedUrl = repoUrl
        .trim()
        .replace(/\/$/, "");

      if (normalizedRemoteUrl !== normalizedRequestedUrl) {
        /*
         * The folder contains another repository.
         * Remove the old repository and clone the requested one.
         */
        await fs.rm(repositoryPath, {
          recursive: true,
          force: true,
        });

        selectedBranch = await cloneRepository({
          repoUrl,
          repositoryPath,
          authHeader,
          requestedBranch: branch,
        });

        action = "replaced";
      } else {
        selectedBranch = await updateRepository({
          repositoryPath,
          authHeader,
          requestedBranch: branch,
        });

        action = "updated";
      }
    }
  } else {
    selectedBranch = await cloneRepository({
      repoUrl,
      repositoryPath,
      authHeader,
      requestedBranch: branch,
    });

    action = "cloned";
  }

  const repositoryGit = simpleGit(repositoryPath);

  const lastCommit = (
    await repositoryGit.revparse(["HEAD"])
  ).trim();

  const [repoRecord, created] = await Repo.findOrCreate({
    where: {
      repo_url: repoUrl,
    },
    defaults: {
      repo_name: repoName,
      repo_url: repoUrl,
      saved_location: repositoryPath,
      branch: selectedBranch,
      tocken_id: tocken.id,
      webhook_secret: validatedWebhookSecret,
      image_name: imageName,
      last_commit: lastCommit,
      last_updated: new Date(),
    },
  });

  if (!created) {
    await repoRecord.update({
      repo_name: repoName,
      saved_location: repositoryPath,
      branch: selectedBranch,
      tocken_id: tocken.id,
      webhook_secret: validatedWebhookSecret,
      image_name: imageName,
      last_commit: lastCommit,
      last_updated: new Date(),
    });
  }

  /*
   * Remove the decrypted token reference as soon as possible.
   * JavaScript strings cannot be securely zeroed, but this reduces its scope.
   */
  decryptedTocken = null;

  const dockerBuild = await buildDockerImage({
    dockerfilePath: repositoryPath,
    imageName: repoRecord.image_name,
  });

  return res.status(created ? 201 : 200).json({
    success: true,
    message:
      action === "updated"
        ? "Repository updated successfully"
        : "Repository cloned successfully",
    data: {
      id: repoRecord.id,
      name: repoRecord.repo_name,
      url: repoRecord.repo_url,
      branch: repoRecord.branch,
      savedLocation: repoRecord.saved_location,
      lastCommit: repoRecord.last_commit,
      lastUpdated: repoRecord.last_updated,
      action,
      webhookEndpoint: `/api/webhooks/gitea/${repoRecord.id}`,
      imageName: repoRecord.image_name,
      dockerBuild,
    },
  });
});

/**
 * GET /api/repos
 */
exports.getRepos = asyncHandler(async (req, res) => {
  const repos = await Repo.findAll({
    attributes: [
      "id",
      "repo_name",
      "repo_url",
      "saved_location",
      "branch",
      "image_name",
      "last_commit",
      "last_updated",
      "createdAt",
      "updatedAt",
    ],
    include: [{
      model: Tocken,
      as: "tocken",
      attributes: ["id", "name", "platform", "username"],
      required: false,
    }],
    order: [["last_updated", "DESC"]],
  });

  const data = repos.map((repo) => ({
    id: repo.id,
    name: repo.repo_name,
    url: repo.repo_url,
    savedLocation: repo.saved_location,
    branch: repo.branch,
    imageName: repo.image_name,
    lastCommit: repo.last_commit,
    lastUpdated: repo.last_updated,
    createdAt: repo.createdAt,
    updatedAt: repo.updatedAt,
    webhookEndpoint: `/api/webhooks/gitea/${repo.id}`,
    credential: repo.tocken
      ? {
          id: repo.tocken.id,
          name: repo.tocken.name,
          platform: repo.tocken.platform,
          username: repo.tocken.username,
        }
      : null,
  }));

  return res.status(200).json({
    success: true,
    count: data.length,
    data,
  });
});

/**
 * POST /api/webhooks/gitea/:repoId
 */
exports.handleGiteaWebhook = asyncHandler(async (req, res) => {
  const { repoId } = req.params;

  if (!/^[1-9]\d*$/.test(repoId)) {
    throw new ApiError(400, "Invalid repository ID");
  }

  const repo = await Repo.findByPk(repoId, {
    include: [{
      model: Tocken,
      as: "tocken",
      required: false,
    }],
  });

  if (!repo) {
    throw new ApiError(404, "Repository not found");
  }

  if (!repo.tocken) {
    throw new ApiError(404, "Tocken not found");
  }

  if (String(repo.tocken.platform).trim().toLowerCase() !== "gitea") {
    throw new ApiError(400, "Repository is not configured with a Gitea tocken");
  }

  const event = req.get("x-gitea-event");
  const signature = req.get("x-gitea-signature");

  if (
    !verifyGiteaSignature(
      req.rawBody,
      signature,
      repo.webhook_secret,
    )
  ) {
    throw new ApiError(401, "Invalid webhook signature");
  }

  if (event !== "push") {
    return res.status(200).json({
      success: true,
      message: "Webhook event ignored",
    });
  }

  const { ref, after } = req.body || {};

  if (typeof ref !== "string" || !ref.trim()) {
    throw new ApiError(400, "Invalid webhook ref");
  }

  if (!ref.startsWith("refs/")) {
    throw new ApiError(400, "Invalid webhook ref");
  }

  if (!ref.startsWith("refs/heads/")) {
    return res.status(200).json({
      success: true,
      message: "Non-branch ref ignored",
    });
  }

  const pushedBranch = ref.slice("refs/heads/".length);

  if (!pushedBranch) {
    throw new ApiError(400, "Invalid webhook ref");
  }

  if (pushedBranch !== repo.branch) {
    return res.status(200).json({
      success: true,
      message: "Push to another branch ignored",
    });
  }

  if (typeof after !== "string" || !/^[a-fA-F0-9]+$/.test(after)) {
    throw new ApiError(400, "Invalid webhook payload");
  }

  if (/^0+$/.test(after)) {
    return res.status(200).json({
      success: true,
      message: "Branch deletion ignored",
    });
  }

  const updateKey = String(repo.id);

  if (activeRepositoryUpdates.has(updateKey)) {
    return res.status(202).json({
      success: true,
      message: "Repository update already in progress",
    });
  }

  activeRepositoryUpdates.add(updateKey);

  let decryptedTocken;

  try {
    try {
      decryptedTocken = decryptToken(repo.tocken.tocken);
    } catch {
      throw new ApiError(500, "Could not decrypt the stored Git token");
    }

    const repositoryPath = resolveRepositoryPath(repo.saved_location);
    const authHeader = createAuthenticationHeader(
      repo.tocken.username,
      decryptedTocken,
    );
    const localDirectoryExists = await directoryExists(repositoryPath);
    let action;

    if (
      localDirectoryExists &&
      await isGitRepository(repositoryPath)
    ) {
      await updateRepository({
        repositoryPath,
        authHeader,
        requestedBranch: repo.branch,
      });
      action = "updated";
    } else {
      if (localDirectoryExists) {
        await fs.rm(repositoryPath, {
          recursive: true,
          force: true,
        });
      }

      await fs.mkdir(REPOS_ROOT, {
        recursive: true,
      });

      await cloneRepository({
        repoUrl: repo.repo_url,
        repositoryPath,
        authHeader,
        requestedBranch: repo.branch,
      });
      action = "cloned";
    }

    const repositoryGit = simpleGit(repositoryPath);
    const lastCommit = (
      await repositoryGit.revparse(["HEAD"])
    ).trim();
    const lastUpdated = new Date();

    await repo.update({
      last_commit: lastCommit,
      last_updated: lastUpdated,
    });

    const dockerBuild = await buildDockerImage({
      dockerfilePath: repositoryPath,
      imageName: repo.image_name,
    });

    console.log("Hey");
    console.log({
      repository: repo.repo_name,
      branch: repo.branch,
      action,
      commit: lastCommit,
    });

    return res.status(200).json({
      success: true,
      message: "Repository synchronized successfully",
      data: {
        id: repo.id,
        name: repo.repo_name,
        branch: repo.branch,
        action,
        lastCommit: repo.last_commit,
        lastUpdated: repo.last_updated,
        imageName: repo.image_name,
        dockerBuild,
      },
    });
  } finally {
    decryptedTocken = null;
    activeRepositoryUpdates.delete(updateKey);
  }
});
