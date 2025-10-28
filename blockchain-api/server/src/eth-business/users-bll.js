require("dotenv").config();
const accountDao = require("../db-dao/accounts-dao");
const contractDao = require("../db-dao/contracts-dao");
const { UserRole } = require("../models/enums");
const { ethers, Wallet } = require("ethers");
const bcrypt = require("bcrypt");
const { v4: uuidv4, validate: isUuid } = require("uuid");

const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
const adminWallet = new ethers.Wallet(process.env.ADMIN_PRIVATE_KEY, provider);
const {
  abi: medicalAbi,
} = require("../../artifacts/contracts/MedicalRecord.sol/MedicalRecord.json");
const { derivePassword } = require("../utils/password-derivation");

const SALT_ROUNDS = 10;
let medicalAddr = null;

async function _loadContract() {
  if (!medicalAddr) {
    const contract = await contractDao.QueryContractByType("MEDICAL_RECORD");
    medicalAddr = contract.address;
  }
  return new ethers.Contract(medicalAddr, medicalAbi, adminWallet);
}

async function _fundWallet(address, amountOfETH) {
  const amount = ethers.parseEther(amountOfETH);
  try {
    // await provider.send("hardhat_setBalance", [
    //   address,
    //   "0x" + amount.toString(16),
    // ]);
    await provider.send("evm_setAccountBalance", [
      address,
      "0x" + amount.toString(16),
    ]);
  } catch (err) {
    const tx = await adminWallet.sendTransaction({
      to: address,
      value: amount,
    });
    await tx.wait();
  }
}

async function _registerOnBlockchain(password) {
  const wallet = Wallet.createRandom();
  const keystoreJson = await wallet.encrypt(password);
  const address = wallet.address;

  // const amount = ethers.parseEther(process.env.INITIAL_FAUCET_ETH);
  // const hexAmount = amount.toString(16);
  // const paddedAmount = "0x" + hexAmount;
  // await provider.send("hardhat_setBalance", [address, paddedAmount]);
  await _fundWallet(address, process.env.INITIAL_FAUCET_ETH);

  return {
    address,
    publicKey: wallet.publicKey,
    keystoreJson,
  };
}

async function registerPatient(profile) {
  const user = await accountDao.insertUser(UserRole.PATIENT);

  const syntheaId = isUuid(profile.syntheaId) ? profile.syntheaId : null;

  let plainPassword;
  if (profile.password) {
    plainPassword = profile.password;
  } else if (profile.syntheaId) {
    //plainPassword = derivePassword(profile.syntheaId);
    plainPassword = profile.username;
  } else {
    plainPassword = derivePassword(String(user.id));
  }

  const passwordHash = await bcrypt.hash(plainPassword, SALT_ROUNDS);
  const walletDetails = await _registerOnBlockchain(plainPassword);

  await accountDao.updateUserAddress(user.id, walletDetails.address);

  await accountDao.insertCredentials(
    user.id,
    profile.username,
    passwordHash,
    walletDetails.publicKey,
    walletDetails.keystoreJson
  );
  await accountDao.insertPatientProfile(user.id, {
    syntheaId,
    firstName: profile.firstName,
    lastName: profile.lastName,
    birthDate: profile.birthDate,
    gender: profile.gender,
    address: profile.addr,
  });

  const contract = await _loadContract();
  const tx = await contract.registerPatient(walletDetails.address);
  await tx.wait();

  return {
    username: profile.username,
    address: walletDetails.address,
    txHash: tx.hash,
    password: plainPassword,
  };
}

async function registerDoctor(profile) {
  const user = await accountDao.insertUser(UserRole.DOCTOR);

  const syntheaId = isUuid(profile.syntheaId) ? profile.syntheaId : null;

  let plainPassword;
  if (profile.password) {
    plainPassword = profile.password;
  } else if (profile.syntheaId) {
    //plainPassword = derivePassword(profile.syntheaId);
    plainPassword = profile.username;
  } else {
    plainPassword = derivePassword(String(user.id));
  }

  const passwordHash = await bcrypt.hash(plainPassword, SALT_ROUNDS);
  const walletDetails = await _registerOnBlockchain(plainPassword);

  await accountDao.updateUserAddress(user.id, walletDetails.address);

  await accountDao.insertCredentials(
    user.id,
    profile.username,
    passwordHash,
    walletDetails.publicKey,
    walletDetails.keystoreJson
  );
  await accountDao.insertDoctorProfile(user.id, {
    syntheaId,
    firstName: profile.firstName,
    lastName: profile.lastName,
    specialization: profile.specialization,
    hospital: profile.hospital,
    hospitalAddr: profile.hospitalAddr,
  });

  const contract = await _loadContract();
  const tx = await contract.registerDoctor(walletDetails.address);
  await tx.wait();

  return {
    username: profile.username,
    address: walletDetails.address,
    txHash: tx.hash,
    password: plainPassword,
  };
}

async function findByUsername(username) {
  return await accountDao.findByUsername(username);
}

async function getAllPatients() {
  return await accountDao.getAllPatients();
}

async function getAllDoctors() {
  return await accountDao.getAllDoctors();
}

async function getDoctorSpecialization(address) {
  const { specialization } = await accountDao.getDoctorProfile(address);
  return specialization;
}

async function getFamilyDoctor(patientAddress) {
  return await accountDao.getFamilyDoctorForPatient(patientAddress);
}

module.exports = {
  registerPatient,
  registerDoctor,
  findByUsername,
  getAllPatients,
  getAllDoctors,
  getDoctorSpecialization,
  getFamilyDoctor,
};
