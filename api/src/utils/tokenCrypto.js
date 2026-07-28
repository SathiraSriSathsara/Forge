const crypto = require("crypto");

const ALGORITHM = "aes-256-gcm";

function getEncryptionKey() {
  const keyString = process.env.TOKEN_ENCRYPTION_KEY;

  if (!keyString) {
    throw new Error("TOKEN_ENCRYPTION_KEY is not configured");
  }

  const key = Buffer.from(keyString, "hex");

  if (key.length !== 32) {
    throw new Error(
      "TOKEN_ENCRYPTION_KEY must be a 64-character hexadecimal string",
    );
  }

  return key;
}

/**
 * Encrypt a Git access token.
 *
 * Output format:
 * iv:authTag:encryptedData
 */
function encryptToken(token) {
  if (!token || typeof token !== "string") {
    throw new Error("A valid token is required");
  }

  const key = getEncryptionKey();
  const iv = crypto.randomBytes(12);

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  const encrypted = Buffer.concat([
    cipher.update(token, "utf8"),
    cipher.final(),
  ]);

  const authTag = cipher.getAuthTag();

  return [
    iv.toString("hex"),
    authTag.toString("hex"),
    encrypted.toString("hex"),
  ].join(":");
}

/**
 * Decrypt a previously encrypted Git access token.
 */
function decryptToken(encryptedValue) {
  if (!encryptedValue || typeof encryptedValue !== "string") {
    throw new Error("Encrypted token is required");
  }

  const parts = encryptedValue.split(":");

  if (parts.length !== 3) {
    throw new Error("Stored token has an invalid format");
  }

  const [ivHex, authTagHex, encryptedHex] = parts;

  const key = getEncryptionKey();
  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");
  const encryptedData = Buffer.from(encryptedHex, "hex");

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([
    decipher.update(encryptedData),
    decipher.final(),
  ]);

  return decrypted.toString("utf8");
}

module.exports = {
  encryptToken,
  decryptToken,
};