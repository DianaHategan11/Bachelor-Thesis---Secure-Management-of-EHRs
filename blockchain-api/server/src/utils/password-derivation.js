require("dotenv").config();
const crypto = require("crypto");

const SECRET = process.env.IMPORT_PASS_SECRET;
if (!SECRET) {
  throw new Error("Missing IMPORT_PASS_SECRET in env");
}

function derivePassword(userId) {
  return crypto
    .createHmac("sha256", SECRET)
    .update(String(userId))
    .digest("hex")
    .slice(0, 16);
}

module.exports = { derivePassword };
