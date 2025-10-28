const { create } = require("ipfs-http-client");
const crypto = require("crypto");
const { keccak256 } = require("ethers");

function createIpfsClient() {
  return create({
    host: "127.0.0.1",
    port: 5001,
    protocol: "http",
  });
}

async function encryptFileAndPushToIPFS(recordData, symKey) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", symKey, iv);
  const plaintext = Buffer.from(JSON.stringify(recordData));
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const authTag = cipher.getAuthTag();
  const ciphertext = Buffer.concat([iv, authTag, encrypted]);

  const client = createIpfsClient();
  const { cid } = await client.add(ciphertext);
  await client.pin.add(cid);
  const ipfsCid = cid.toString();
  const recordHash = keccak256(ciphertext);

  return { ipfsCid, ciphertext, recordHash };
}

async function fetchAndDecrypt(ipfsCid, symKey) {
  const client = createIpfsClient();
  const chunks = [];
  for await (const chunk of client.cat(ipfsCid)) {
    chunks.push(chunk);
  }
  const ciphertext = Buffer.concat(chunks);

  const iv = ciphertext.slice(0, 12);
  const authTag = ciphertext.slice(12, 28);
  const data = ciphertext.slice(28);

  const decipher = crypto.createDecipheriv("aes-256-gcm", symKey, iv);
  decipher.setAuthTag(authTag);
  const plaintext = Buffer.concat([decipher.update(data), decipher.final()]);

  return JSON.parse(plaintext.toString());
}

module.exports = {
  createIpfsClient,
  encryptFileAndPushToIPFS,
  fetchAndDecrypt,
};
