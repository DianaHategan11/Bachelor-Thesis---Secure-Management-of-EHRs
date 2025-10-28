const medicalRecordDAO = require("../db-dao/medical-records-dao.js");
const usersDAO = require("../db-dao/accounts-dao.js");
const featuresDAO = require("../db-dao/features-dao.js");
const { ethers, VoidSigner } = require("ethers");
const crypto = require("crypto");
const {
  MethodCallError,
  GetEventsError,
  LogError,
} = require("../models/eth-errors.js");
const {
  loadContract,
  wrapSymmetricKey,
  unwrapSymmetricKey,
} = require("../utils/contract-utils.js");
const {
  encryptFileAndPushToIPFS,
  fetchAndDecrypt,
} = require("../utils/ipfs-utils.js");
const { simplifyRecord } = require("../utils/simplified-record.js");

const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);

async function _initPatientFeatures(patient_addr, birth_date) {
  let row = await featuresDAO.getFeature(patient_addr);
  if (row) {
    return {
      patient_addr: row.patient_addr,
      age: row.age,
      num_encounters: row.num_encounters,
      num_amb_encounters: row.num_amb_encounters,
      num_emer_encounters: row.num_emer_encounters,
      num_inp_encounters: row.num_inp_encounters,
      num_procedures: row.num_procedures,
      top_conditions: JSON.parse(row.top_conditions),
    };
  }
  const bd = new Date(birth_date);
  const age = Math.floor((Date.now() - bd) / (1000 * 60 * 60 * 24 * 365.25));
  return {
    patient_addr,
    age,
    num_encounters: 0,
    num_amb_encounters: 0,
    num_emer_encounters: 0,
    num_inp_encounters: 0,
    num_procedures: 0,
    top_conditions: [],
  };
}

async function _incrementalUpdateFeatures(recordData, patient_addr) {
  const feat = await _initPatientFeatures(
    patient_addr,
    recordData.patient.birthDate
  );
  feat.num_encounters++;
  const cls = recordData.encounter.class;
  if (cls === "AMB" || cls === "amb") feat.num_amb_encounters++;
  else if (cls === "EMER") feat.num_emer_encounters++;
  else if (cls === "IMP") feat.num_inp_encounters++;
  if (recordData.procedure) feat.num_procedures++;
  const freq = {};
  for (const cond of feat.top_conditions) {
    freq[cond] = (freq[cond] || 0) + 1;
  }
  if (recordData.condition?.display) {
    freq[recordData.condition.display] =
      (freq[recordData.condition.display] || 0) + 1;
  }
  feat.top_conditions = Object.entries(freq)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10)
    .map(([cond]) => cond);
  await featuresDAO.upsertPatientFeatures(
    feat.patient_addr,
    feat.age,
    feat.num_encounters,
    feat.num_amb_encounters,
    feat.num_emer_encounters,
    feat.num_inp_encounters,
    feat.num_procedures,
    feat.top_conditions
  );
}

async function fetchRecordContent(id, signer) {
  const userAddress = await signer.getAddress();
  const { ipfsCid, wrappedKey } = await medicalRecordDAO.getRecordWithKey(
    id,
    userAddress
  );
  const symKey = await unwrapSymmetricKey(wrappedKey, signer.privateKey);
  const content = await fetchAndDecrypt(ipfsCid, symKey);
  return content;
}

async function insertMedicalRecord(recordData, patientAddress, signer) {
  const symKey = crypto.randomBytes(32);

  const { ipfsCid, recordHash } = await encryptFileAndPushToIPFS(
    recordData,
    symKey
  );

  let doctorContract, doctorAddress, tx, receipt;
  try {
    const contract = await loadContract();
    doctorContract = contract.connect(signer);
    doctorAddress = await signer.getAddress();
    tx = await doctorContract.addRecord(patientAddress, ipfsCid, recordHash);
    receipt = await tx.wait();
  } catch (err) {
    throw new MethodCallError("MedicalRecord", "addRecord", "send", err);
  }

  let recordId, modifiedAt;
  try {
    // const recordLog = receipt.logs.find(
    //   (log) => ("eventName" in log) & (log.eventName === "RecordCreated")
    // );
    // if (!recordLog) {
    //   throw new LogError("RecordCreated");
    // }

    const filter = doctorContract.filters.RecordCreated(
      null,
      doctorAddress,
      null
    );

    const events = await doctorContract.queryFilter(filter);

    const evt = events.find((e) => e.transactionHash === tx.hash);
    if (!evt) throw new LogError("RecordCreated");

    recordId = Number(evt.args.recordId);
    const ts = Number(evt.args.timestamp);
    modifiedAt = new Date(ts * 1000);
  } catch (err) {
    if (err instanceof LogError) {
      throw err;
    }
    throw new GetEventsError(
      "MedicalRecord",
      "RecordCreated",
      err.reason || err.message,
      err
    );
  }

  await medicalRecordDAO.insertRecord(
    recordId,
    patientAddress,
    doctorAddress,
    ipfsCid,
    recordHash,
    modifiedAt
  );

  const patientPubKeyHex = await usersDAO.getPublicKeyByAddress(patientAddress);
  const doctorPubKeyHex = await usersDAO.getPublicKeyByAddress(doctorAddress);

  const wrappedForPatient = await wrapSymmetricKey(symKey, patientPubKeyHex);
  const wrappedForDoctor = await wrapSymmetricKey(symKey, doctorPubKeyHex);

  await medicalRecordDAO.insertRecordKey(
    recordId,
    patientAddress,
    wrappedForPatient
  );
  await medicalRecordDAO.insertRecordKey(
    recordId,
    doctorAddress,
    wrappedForDoctor
  );

  const simplified = simplifyRecord(recordData);
  await _incrementalUpdateFeatures(simplified, patientAddress);

  return {
    recordId,
    ipfsCid,
    recordHash,
    txHash: tx.hash,
    blockNumber: receipt.blockNumber,
    timestamp: modifiedAt,
  };
}

async function updateMedicalRecord(recordId, recordData, signer) {
  let doctorContract, doctorAddress, tx, receipt, ipfsCid, recordHash;
  try {
    const contract = await loadContract();
    doctorContract = contract.connect(signer);
    doctorAddress = await signer.getAddress();

    const { wrappedKey } = await medicalRecordDAO.getRecordWithKey(
      recordId,
      doctorAddress
    );
    const symKey = await unwrapSymmetricKey(wrappedKey, signer.privateKey);

    ({ ipfsCid, recordHash } = await encryptFileAndPushToIPFS(
      recordData,
      symKey
    ));

    tx = await doctorContract.updateRecord(recordId, ipfsCid, recordHash);
    receipt = await tx.wait();
  } catch (err) {
    throw new MethodCallError(
      "MedicalRecord",
      "updateRecord",
      "send",
      err.reason || err.message,
      err
    );
  }

  let modifiedAt;
  try {
    // const recordLog = receipt.logs.find(
    //   (log) => ("eventName" in log) & (log.eventName === "RecordUpdated")
    // );
    // if (!recordLog) {
    //   throw new LogError("RecordUpdated");
    // }

    const filter = doctorContract.filters.RecordUpdated(recordId, null, null);

    const events = await doctorContract.queryFilter(filter);

    const evt = events.find((e) => e.transactionHash === tx.hash);
    if (!evt) throw new LogError("RecordUpdated");

    const ts = Number(evt.args.timestamp);
    modifiedAt = new Date(ts * 1000);
  } catch (err) {
    if (err instanceof LogError) {
      throw err;
    }
    throw new GetEventsError(
      "MedicalRecord",
      "RecordUpdated",
      err.reason || err.message,
      err
    );
  }

  await medicalRecordDAO.updateRecord(
    recordId,
    ipfsCid,
    recordHash,
    modifiedAt
  );

  const { patientAddr: patientAddress } = await medicalRecordDAO.getRecordMeta(
    recordId
  );

  const simplified = simplifyRecord(recordData);
  await _incrementalUpdateFeatures(simplified, patientAddress);

  return {
    recordId,
    ipfsCid,
    recordHash,
    txHash: tx.hash,
    blockNumber: receipt.blockNumber,
    timestamp: modifiedAt,
  };
}

async function getPatientRecords(signer) {
  let patientContract, ids;
  try {
    const contract = await loadContract();
    patientContract = contract.connect(signer);

    const recordIds = await patientContract.getPersonalRecords();
    ids = recordIds.map((recordId) => Number(recordId));
  } catch (err) {
    throw new MethodCallError(
      "MedicalRecord",
      "getPatientRecords",
      "call",
      err.reason || err.message,
      err
    );
  }

  return Promise.all(
    ids.map(async (id) => {
      try {
        const rec = await patientContract.getRecord(id);
        const patientName = await usersDAO.getPatientName(rec.patient);
        const doctorName = await usersDAO.getDoctorName(rec.doctor);
        return {
          recordId: id,
          patient: rec.patient,
          patientName,
          doctor: rec.doctor,
          doctorName,
          ipfsCid: rec.ipfsCid,
          recordHash: rec.recordHash,
          timestamp: new Date(Number(rec.timestamp) * 1000),
        };
      } catch (err) {
        throw new MethodCallError(
          "MedicalRecord",
          "getRecord",
          "send",
          err.reason || err.message,
          err
        );
      }
    })
  );
}

async function getDoctorRecords(signer) {
  const contract = await loadContract();
  const doctorContract = contract.connect(signer);
  const doctorAddress = await signer.getAddress();
  const { specialization: currentSpec } = await usersDAO.getDoctorProfile(
    doctorAddress
  );

  let createdLogs;
  try {
    const recordCreatedFilter = doctorContract.filters.RecordCreated(
      null,
      doctorAddress,
      null
    );
    createdLogs = await doctorContract.queryFilter(
      recordCreatedFilter,
      0,
      "latest"
    );
  } catch (err) {
    throw new GetEventsError(
      "MedicalRecord",
      "RecordCreated",
      err.reason || err.message,
      err
    );
  }

  let grantedLogs;
  try {
    const accessGrantedFilter = doctorContract.filters.AccessGranted(
      null,
      doctorAddress
    );
    grantedLogs = await doctorContract.queryFilter(
      accessGrantedFilter,
      0,
      "latest"
    );
  } catch (err) {
    throw new GetEventsError(
      "MedicalRecord",
      "AccessGranted",
      err.reason || err.message,
      err
    );
  }

  const createdIds = createdLogs.map((log) => Number(log.args.recordId));
  const patients = Array.from(
    new Set(grantedLogs.map((log) => log.args.patient))
  );

  let uniqueGrantedIds;
  try {
    const grantedIds = (
      await Promise.all(
        patients.map(async (patient) => {
          const pc = contract.connect(new VoidSigner(patient, provider));
          const idsBN = await pc.getPersonalRecords();
          return idsBN.map((bn) => Number(bn));
        })
      )
    ).flat();
    uniqueGrantedIds = Array.from(new Set(grantedIds));
  } catch (err) {
    throw new MethodCallError(
      "MedicalRecord",
      "getPersonalRecords",
      "call",
      err.reason || err.message,
      err
    );
  }

  const allIds = [...createdIds, ...uniqueGrantedIds];
  const uniqueIds = Array.from(new Set(allIds));

  // let createdRecords;
  // try {
  //   createdRecords = await Promise.all(
  //     createdIds.map(async (id) => {
  //       const rec = await doctorContract.getRecord(id);
  //       const patientName = await usersDAO.getPatientName(rec.patient);
  //       const doctorName = await usersDAO.getDoctorName(rec.doctor);
  //       const { specialization: doctorSpec } = await usersDAO.getDoctorProfile(
  //         rec.doctor
  //       );
  //       return {
  //         recordId: id,
  //         patientAddr: rec.patient,
  //         patientName,
  //         doctorAddr: rec.doctor,
  //         doctorName,
  //         specialization: doctorSpec,
  //         ipfsCid: rec.ipfsCid,
  //         recordHash: rec.recordHash,
  //         modifiedAt: new Date(Number(rec.timestamp) * 1000),
  //       };
  //     })
  //   );
  // } catch (err) {
  //   throw new MethodCallError(
  //     "MedicalRecord",
  //     "getRecord",
  //     "call",
  //     err.reason || err.message,
  //     err
  //   );
  // }

  // let grantedRecords = [];
  // try {
  //   for (const id of uniqueGrantedIds) {
  //     let allowed = false;
  //     allowed = await doctorContract.canView(id);
  //     if (!allowed) continue;

  //     const rec = await doctorContract.getRecord(id);
  //     const patientName = await usersDAO.getPatientName(rec.patient);
  //     const doctorName = await usersDAO.getDoctorName(rec.doctor);
  //     const { specialization: doctorSpec } = await usersDAO.getDoctorProfile(
  //       rec.doctor
  //     );
  //     grantedRecords.push({
  //       recordId: id,
  //       patientAddr: rec.patient,
  //       patientName,
  //       doctorAddr: rec.doctor,
  //       doctorName,
  //       specialization: doctorSpec,
  //       ipfsCid: rec.ipfsCid,
  //       recordHash: rec.recordHash,
  //       modifiedAt: new Date(Number(rec.timestamp) * 1000),
  //     });
  //   }
  // } catch (err) {
  //   throw new MethodCallError(
  //     "MedicalRecord",
  //     "getRecord",
  //     "call",
  //     err.reason || err.message,
  //     err
  //   );
  // }
  const visibleIds = [];
  for (const id of uniqueIds) {
    if (await doctorContract.canView(id)) {
      visibleIds.push(id);
    }
  }

  const allRecords = await Promise.all(
    visibleIds.map(async (id) => {
      const rec = await doctorContract.getRecord(id);
      const patientName = await usersDAO.getPatientName(rec.patient);
      const doctorName = await usersDAO.getDoctorName(rec.doctor);
      const { specialization } = await usersDAO.getDoctorProfile(rec.doctor);
      return {
        recordId: id,
        patientAddr: rec.patient,
        patientName,
        doctorAddr: rec.doctor,
        doctorName,
        specialization: specialization,
        ipfsCid: rec.ipfsCid,
        recordHash: rec.recordHash,
        modifiedAt: new Date(Number(rec.timestamp) * 1000),
      };
    })
  );

  let filteredRecords = allRecords;
  if (currentSpec !== "Family Practice") {
    filteredRecords = allRecords.filter(
      (r) => r.specialization === currentSpec
    );
  }
  return filteredRecords;
}

async function grantAccess(doctorAddress, signer) {
  let patientContract, patientAddress, doctorName, tx, receipt;
  try {
    const contract = await loadContract();
    patientContract = contract.connect(signer);
    patientAddress = await signer.getAddress();
    doctorName = await usersDAO.getDoctorName(doctorAddress);

    tx = await patientContract.grantAccess(doctorAddress);
    receipt = await tx.wait();
  } catch (err) {
    throw new MethodCallError(
      "MedicalRecord",
      "grantAccess",
      "send",
      err.reason || err.message,
      err
    );
  }

  let timestamp;
  try {
    // const recordLog = receipt.logs.find(
    //   (log) => ("eventName" in log) & (log.eventName === "AccessGranted")
    // );
    // if (!recordLog) {
    //   throw new LogError("AccessGranted");
    // }

    const filter = patientContract.filters.AccessGranted(
      patientAddress,
      doctorAddress
    );

    const events = await patientContract.queryFilter(filter);

    const evt = events.find((e) => e.transactionHash === tx.hash);
    if (!evt) throw new LogError("AccessGranted");
    // const evt = receipt.events.find((e) => e.event === "AccessGranted");
    // if (!evt) throw new LogError("AccessGranted");

    const ts = Number(evt.args.timestamp);
    timestamp = new Date(ts * 1000);
  } catch (err) {
    if (err instanceof LogError) {
      throw err;
    }
    throw new GetEventsError(
      "MedicalRecord",
      "AccessGranted",
      err.reason || err.message,
      err
    );
  }

  let recordIds;
  try {
    recordIds = (await patientContract.getPersonalRecords()).map((bn) =>
      Number(bn)
    );
  } catch (err) {
    throw new MethodCallError(
      "MedicalRecord",
      "getPersonalRecords",
      "call",
      err.reason || err.message,
      err
    );
  }

  try {
    const doctorPubKey = await usersDAO.getPublicKeyByAddress(doctorAddress);
    for (const id of recordIds) {
      const rec = await patientContract.getRecord(id);
      if (rec.doctor.toLowerCase() === doctorAddress.toLowerCase()) continue;

      const { wrappedKey } = await medicalRecordDAO.getRecordWithKey(
        id,
        patientAddress
      );
      const symKey = await unwrapSymmetricKey(wrappedKey, signer.privateKey);
      const wrappedForDoctor = await wrapSymmetricKey(symKey, doctorPubKey);

      await medicalRecordDAO.insertRecordKey(
        id,
        doctorAddress,
        wrappedForDoctor
      );
    }
  } catch (err) {
    throw new MethodCallError(
      "MedicalRecord",
      "getRecord",
      "call",
      err.reason || err.message,
      err
    );
  }

  return {
    patientAddress,
    doctorAddress,
    doctorName,
    txHash: tx.hash,
    blockNumber: receipt.blockNumber,
    timestamp,
  };
}

async function revokeAccess(doctorAddress, signer) {
  let patientContract, patientAddress, doctorName, tx, receipt;
  try {
    const contract = await loadContract();
    patientContract = contract.connect(signer);
    patientAddress = await signer.getAddress();
    doctorName = await usersDAO.getDoctorName(doctorAddress);

    tx = await patientContract.revokeAccess(doctorAddress);
    receipt = await tx.wait();
  } catch (err) {
    throw new MethodCallError(
      "MedicalRecord",
      "revokeAccess",
      "send",
      err.reason || err.message,
      err
    );
  }

  let timestamp;
  try {
    // const recordLog = receipt.logs.find(
    //   (log) => ("eventName" in log) & (log.eventName === "AccessRevoked")
    // );
    // if (!recordLog) {
    //   throw new LogError("AccessRevoked");
    // }

    const filter = patientContract.filters.AccessRevoked(
      patientAddress,
      doctorAddress
    );

    const events = await patientContract.queryFilter(filter);

    const evt = events.find((e) => e.transactionHash === tx.hash);
    if (!evt) throw new LogError("AccessRevoked");

    const ts = Number(evt.args.timestamp);
    timestamp = new Date(ts * 1000);
  } catch (err) {
    if (err instanceof LogError) {
      throw err;
    }
    throw new GetEventsError(
      "MedicalRecord",
      "AccessRevoked",
      err.reason || err.message,
      err
    );
  }

  let recordIds;
  try {
    recordIds = (await patientContract.getPersonalRecords()).map((bn) =>
      Number(bn)
    );
  } catch (err) {
    throw new MethodCallError(
      "MedicalRecord",
      "getPersonalRecords",
      "call",
      err.reason || err.message,
      err
    );
  }

  for (const id of recordIds) {
    const { doctorAddr } = await medicalRecordDAO.getRecordMeta(id);
    if (doctorAddr !== doctorAddress) {
      await medicalRecordDAO.deleteRecordKey(id, doctorAddress);
    }
  }

  return {
    patientAddress,
    doctorAddress,
    doctorName,
    txHash: tx.hash,
    blockNumber: receipt.blockNumber,
    timestamp,
  };
}

async function getAllRecords() {
  return await medicalRecordDAO.getAllRecords();
}

async function getRecordAddresses() {
  const { patientAddr, doctorAddr } = await medicalRecordDAO.getRecordMeta();
  return { patientAddr, doctorAddr };
}

module.exports = {
  fetchRecordContent,
  insertMedicalRecord,
  updateMedicalRecord,
  getPatientRecords,
  getDoctorRecords,
  grantAccess,
  revokeAccess,
  getAllRecords,
  getRecordAddresses,
};
