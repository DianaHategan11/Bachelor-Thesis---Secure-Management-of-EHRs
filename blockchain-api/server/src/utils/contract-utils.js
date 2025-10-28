const { ethers } = require("ethers");
const EthCrypto = require("eth-crypto");
const contractDao = require("../db-dao/contracts-dao");
const {
  abi: medicalAbi,
} = require("../../artifacts/contracts/MedicalRecord.sol/MedicalRecord.json");

const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);

let medicalAddr = null;

async function loadContract() {
  if (!medicalAddr) {
    const record = await contractDao.QueryContractByType("MEDICAL_RECORD");
    medicalAddr = record.address;
  }
  return new ethers.Contract(medicalAddr, medicalAbi, provider);
}

async function wrapSymmetricKey(symKey, recipientPubKeyHex) {
  const pubKeyHex = recipientPubKeyHex.startsWith("0x")
    ? recipientPubKeyHex.slice(2)
    : recipientPubKeyHex;
  const rawHex = symKey.toString("hex");
  const encryptedObj = await EthCrypto.encryptWithPublicKey(pubKeyHex, rawHex);
  return EthCrypto.cipher.stringify(encryptedObj);
}

async function unwrapSymmetricKey(wrappedStr, recipientPrivKeyHex) {
  const privKeyHex = recipientPrivKeyHex.startsWith("0x")
    ? recipientPrivKeyHex.slice(2)
    : recipientPrivKeyHex;
  const encryptedObj = EthCrypto.cipher.parse(wrappedStr);
  const rawHex = await EthCrypto.decryptWithPrivateKey(
    privKeyHex,
    encryptedObj
  );
  return Buffer.from(rawHex, "hex");
}

module.exports = {
  loadContract,
  wrapSymmetricKey,
  unwrapSymmetricKey,
};
