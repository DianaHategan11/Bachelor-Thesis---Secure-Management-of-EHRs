const { SqlError, SqlNotUniqueError } = require("../models/db-errors");
const { getUnique } = require("../utils/commons");
const user = require("./models/account");

const sqlSelectAccountByUsername = `
  SELECT u.id AS user_id, c.username AS username, c.password_hash AS passwordHash, c.keystore_json AS keystoreJson, u.address AS address, r.role AS role
  FROM credentials c
  INNER JOIN users u ON c.user_id = u.id
  INNER JOIN roles r ON u.role_id = r.id
  WHERE c.username = ?
`;

const sqlSelectAddressByUsername = `SELECT u.address FROM users u INNER JOIN credentials c ON c.user_id = u.id WHERE c.username = ?`;

const sqlSelectPublickKeyByAddress = `SELECT c.public_key AS publicKey FROM credentials c INNER JOIN users u ON u.id = c.user_id WHERE u.address = ?`;
const sqlSelectKeystoreJsonByAddress = `SELECT c.keystore_json AS keystoreJson FROM credentials c INNER JOIN users u ON u.id = c.user_id WHERE u.address = ?`;

const sqlInsertUser = "INSERT INTO users (role_id) VALUES (?)";
const sqlUpdateUserAddress = "UPDATE users u SET u.address = ? WHERE u.id = ?";
const sqlInsertCredentials = `
  INSERT INTO credentials (username, password_hash, public_key, keystore_json, user_id) VALUES (?, ?, ?, ?, ?)`;

const sqlInsertDoctorProfile = `
  INSERT INTO doctor_profiles
    (synthea_id, first_name, last_name, specialization, hospital, hospital_addr, user_id)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`;
const sqlInsertPatientProfile = `
  INSERT INTO patient_profiles
    (synthea_id, first_name, last_name, birth_date, gender, address, user_id)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`;

const sqlSelectPatientName = `
  SELECT
    CONCAT(p.first_name, ' ', p.last_name) AS patientName
  FROM patient_profiles p
  JOIN users u ON p.user_id = u.id
  WHERE u.address = ?
`;
const sqlSelectDoctorName = `
  SELECT
    CONCAT(d.first_name, ' ', d.last_name) AS doctorName
  FROM doctor_profiles d
  JOIN users u ON d.user_id = u.id
  WHERE u.address = ?
`;

const sqlSelectPatientProfileByAddress = `SELECT p.id,
          p.first_name AS firstName,
          p.last_name AS lastName,
          p.birth_date AS birthDate,
          p.gender,
          p.address AS address
     FROM patient_profiles p
     JOIN users u ON p.user_id = u.id
    WHERE u.address = ?`;

const sqlSelectDoctorProfileByAddress = `SELECT d.id,
          d.first_name AS firstName,
          d.last_name AS lastName,
          d.specialization,
          d.hospital,
          d.hospital_addr AS hospitalAddr
     FROM doctor_profiles d
     JOIN users u ON d.user_id = u.id
    WHERE u.address = ?`;

const sqlSelectAllPatientProfiles = `
  SELECT
    u.id AS userId,
    u.address AS address,
    p.birth_date AS birthDate,
    p.synthea_id AS syntheaId,
    c.keystore_json AS keystoreJson,
    c.username AS username
  FROM patient_profiles p
  JOIN users u   ON p.user_id = u.id
  JOIN credentials c ON c.user_id = u.id
`;

const sqlSelectPatients = `
  SELECT u.address AS address, p.first_name AS firstName, p.last_name AS lastName
  FROM patient_profiles p
  INNER JOIN users u ON p.user_id = u.id
`;

const sqlSelectDoctors = `
  SELECT u.address AS address, p.first_name AS firstName, p.last_name AS lastName, p.specialization AS specialization
  FROM doctor_profiles p
  INNER JOIN users u ON p.user_id = u.id
`;

const sqlSelectFamilyDoctorForPatient = `
  SELECT
    u.address AS address,
    d.first_name AS firstName,
    d.last_name AS lastName,
    d.specialization AS specialization
  FROM record_keys rk
  JOIN records r ON rk.record_id = r.id
  JOIN users u ON r.doctor_addr = u.address
  JOIN doctor_profiles d ON d.user_id = u.id
  WHERE rk.recipient_address = ?
    AND d.specialization = 'Family Practice'
`;

async function insertUser(roleId) {
  return new Promise((resolve, reject) => {
    db.query(sqlInsertUser, [roleId], (err, result) => {
      if (err) return reject(new SqlError("insertUser"));
      resolve({ id: result.insertId, role_id: roleId });
    });
  });
}

async function updateUserAddress(userId, address) {
  return new Promise((resolve, reject) => {
    db.query(sqlUpdateUserAddress, [address, userId], (err, result) => {
      if (err) return reject(new SqlError("updateUserAddress"));
      resolve({ id: result.insertId, address });
    });
  });
}

async function insertCredentials(
  userId,
  username,
  passwordHash,
  publicKey,
  keystoreJson
) {
  return new Promise((resolve, reject) => {
    db.query(
      sqlInsertCredentials,
      [username, passwordHash, publicKey, keystoreJson, userId],
      (err) => {
        if (err && err.code === "ER_DUP_ENTRY") {
          return reject(new SqlNotUniqueError("Login ID", "credentials"));
        }
        if (err) {
          return reject(new SqlError("insertCredentials"));
        }
        resolve();
      }
    );
  });
}

async function insertPatientProfile(userId, p) {
  return new Promise((resolve, reject) => {
    const params = [
      p.syntheaId,
      p.firstName,
      p.lastName,
      p.birthDate,
      p.gender,
      p.address,
      userId,
    ];
    db.query(sqlInsertPatientProfile, params, (err) => {
      if (err) {
        return reject(new SqlError("insertPatientProfile"));
      }
      resolve();
    });
  });
}

async function insertDoctorProfile(userId, d) {
  return new Promise((resolve, reject) => {
    const params = [
      d.syntheaId,
      d.firstName,
      d.lastName,
      d.specialization,
      d.hospital,
      d.hospitalAddr,
      userId,
    ];
    db.query(sqlInsertDoctorProfile, params, (err) => {
      if (err) {
        return reject(new SqlError("insertDoctorProfile"));
      }
      resolve();
    });
  });
}

async function findByUsername(username) {
  return new Promise((resolve, reject) => {
    db.query(sqlSelectAccountByUsername, [username], (err, rows) => {
      if (err) {
        console.log(err);
        return reject(new SqlError("findByUsername"));
      }
      try {
        const rec = getUnique(rows, "findByUsername", "Username");
        resolve(user.AccountDTO(rec));
      } catch (e) {
        reject(e);
      }
    });
  });
}

async function getAddressByUsername(username) {
  return new Promise((resolve, reject) => {
    db.query(sqlSelectAddressByUsername, [username], (err, rows) => {
      if (err) {
        console.log(err);
        reject(new SqlError("getAddressByUsername"));
      }
      try {
        const rec = getUnique(rows, "gettAddressByUsername", "Username");
        resolve(rec.address);
      } catch (e) {
        reject(e);
      }
    });
  });
}

async function getPublicKeyByAddress(address) {
  return new Promise((resolve, reject) => {
    db.query(sqlSelectPublickKeyByAddress, [address], (err, rows) => {
      if (err) {
        console.log(err);
        reject(new SqlError("getPublicKeyByAddress"));
      }
      try {
        const rec = getUnique(rows, "getPublicKeyByAddress", "Address");
        resolve(rec.publicKey);
      } catch (e) {
        reject(e);
      }
    });
  });
}

async function getKeystoreJsonByAddress(address) {
  return new Promise((resolve, reject) => {
    db.query(sqlSelectKeystoreJsonByAddress, [address], (err, rows) => {
      if (err) {
        console.log(err);
        reject(new SqlError("getKeystoreJsonByAddress"));
      }
      try {
        const rec = getUnique(rows, "getKeystoreJsonByAddress", "Address");
        resolve(rec.keystoreJson);
      } catch (e) {
        reject(e);
      }
    });
  });
}

async function getPatientName(address) {
  return new Promise((resolve, reject) => {
    db.query(sqlSelectPatientName, [address], (err, rows) => {
      if (err) reject(new SqlError("getPatientName"));
      try {
        const { patientName } = getUnique(
          rows,
          "getPatientName",
          "PatientName"
        );
        resolve(patientName);
      } catch (e) {
        reject(e);
      }
    });
  });
}

async function getDoctorName(address) {
  return new Promise((resolve, reject) => {
    db.query(sqlSelectDoctorName, [address], (err, rows) => {
      if (err) reject(new SqlError("getDoctorName"));
      try {
        const { doctorName } = getUnique(
          rows,
          "getDoctorName",
          "getDoctorName"
        );
        resolve(doctorName);
      } catch (e) {
        reject(e);
      }
    });
  });
}

async function getPatientProfile(address) {
  return new Promise((resolve, reject) => {
    db.query(sqlSelectPatientProfileByAddress, [address], (err, rows) => {
      if (err) reject(new SqlError("getPatientProfile"));
      try {
        const profile = getUnique(rows, "getPatientProfile", "PatientProfile");
        resolve(profile);
      } catch (e) {
        reject(e);
      }
    });
  });
}

async function getDoctorProfile(address) {
  return new Promise((resolve, reject) => {
    db.query(sqlSelectDoctorProfileByAddress, [address], (err, rows) => {
      if (err) reject(new SqlError("getDoctorProfile"));
      try {
        const profile = getUnique(rows, "getDoctorProfile", "DoctorProfile");
        resolve(profile);
      } catch (e) {
        reject(e);
      }
    });
  });
}

async function getAllPatientProfiles() {
  return new Promise((resolve, reject) => {
    db.query(sqlSelectAllPatientProfiles, (err, rows) => {
      if (err) return reject(new SqlError("getAllPatientProfiles"));
      resolve(rows);
    });
  });
}

async function getAllPatients() {
  return new Promise((resolve, reject) => {
    db.query(sqlSelectPatients, (err, rows) => {
      if (err) reject(new SqlError("getAllPatients"));
      try {
        resolve(rows);
      } catch (e) {
        reject(e);
      }
    });
  });
}

async function getAllDoctors() {
  return new Promise((resolve, reject) => {
    db.query(sqlSelectDoctors, (err, rows) => {
      if (err) reject(new SqlError("getAllDoctors"));
      try {
        resolve(rows);
      } catch (e) {
        reject(e);
      }
    });
  });
}

async function getFamilyDoctorForPatient(patientAddress) {
  return new Promise((resolve, reject) => {
    db.query(sqlSelectFamilyDoctorForPatient, [patientAddress], (err, rows) => {
      if (err) return reject(new SqlError("getFamilyDoctorForPatient"));
      try {
        const doctor = getUnique(
          rows,
          "getFamilyDoctorForPatient",
          "FamilyDoctor"
        );
        resolve(doctor);
      } catch (e) {
        reject(e);
      }
    });
  });
}

module.exports = {
  insertUser,
  updateUserAddress,
  insertCredentials,
  insertPatientProfile,
  insertDoctorProfile,
  findByUsername,
  getAddressByUsername,
  getPublicKeyByAddress,
  getKeystoreJsonByAddress,
  getPatientName,
  getDoctorName,
  getPatientProfile,
  getDoctorProfile,
  getAllPatientProfiles,
  getAllPatients,
  getAllDoctors,
  getFamilyDoctorForPatient,
};
