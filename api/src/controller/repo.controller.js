const fs = require("fs/promises");
const path = require("path");
const { Buffer } = require("buffer");
const simpleGit = require("simple-git");

const { Repo, Tocken } = require("../models");
const asyncHandler = require("../utils/asyncHandler");
const ApiError = require("../utils/ApiError");
const { decryptToken } = require("../utils/tokenCrypto");

// Repository storage directory:
// API/repos
const REPOS_ROOT = path.resolve(process.cwd(), "repos");

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

  await git.clone(repoUrl, repositoryPath, cloneOptions);

  const clonedGit = simpleGit(repositoryPath);

  if (requestedBranch) {
    return requestedBranch;
  }

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
  const { name, url, tockenID, branch } = req.body;

  if (!name || !url || !tockenID) {
    throw new ApiError(
      400,
      "name, url and tockenID fields are required",
    );
  }

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
      last_commit: lastCommit,
      last_updated: new Date(),
    },
  });

  if (!created) {
    await repoRecord.update({
      repo_name: repoName,
      saved_location: repositoryPath,
      branch: selectedBranch,
      last_commit: lastCommit,
      last_updated: new Date(),
    });
  }

  /*
   * Remove the decrypted token reference as soon as possible.
   * JavaScript strings cannot be securely zeroed, but this reduces its scope.
   */
  decryptedTocken = null;

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
    },
  });
}); 