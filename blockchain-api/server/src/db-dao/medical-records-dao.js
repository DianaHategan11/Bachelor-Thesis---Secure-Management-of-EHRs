const { SqlError } = require("../models/db-errors");
const { getUnique } = require("../utils/commons");

const sqlInsertRecord = `
    INSERT INTO records (id, patient_addr, doctor_addr, ipfs_cid, record_hash, modified_at)
    VALUES (?, ?, ?, ?, ?, ?)
`;

const sqlInsertRecordKey = `
    INSERT INTO record_keys (record_id, recipient_address, wrapped_key)
    VALUES (?, ?, ?)
`;

const sqlUpdateRecord = `
  UPDATE records
    SET ipfs_cid = ?,
      record_hash = ?,
      modified_at = ?
    WHERE id = ?
`;

const sqlGetRecordWithKey = `
    SELECT r.ipfs_cid AS ipfsCid, rk.wrapped_key AS wrappedKey FROM records r
    INNER JOIN record_keys rk ON r.id = rk.record_id
    WHERE r.id = ? AND rk.recipient_address = ?
    ORDER BY rk.id DESC
    LIMIT 1
`;

const sqlSelectRecordMeta = `
  SELECT id, patient_addr AS patientAddr, doctor_addr AS doctorAddr
    FROM records
    WHERE id = ?
`;

const sqlSelectAllRecords = `
  SELECT r.id, r.ipfs_cid AS ipfsCid, r.patient_addr AS patientAddr, r.doctor_addr AS doctorAddr, r.modified_at AS modifiedAt
    FROM records r
`;

const sqlDeleteRecordKey = `
    DELETE FROM record_keys
    WHERE record_id = ? AND recipient_address = ?
`;

async function insertRecord(
  id,
  patientAddress,
  doctorAddress,
  cid,
  recordHash,
  createdAt
) {
  return new Promise((resolve, reject) => {
    db.query(
      sqlInsertRecord,
      [id, patientAddress, doctorAddress, cid, recordHash, createdAt],
      (err) => {
        if (err) return reject(new SqlError("insertRecord"));
        resolve();
      }
    );
  });
}

async function insertRecordKey(recordId, recipientAddress, wrappedKey) {
  return new Promise((resolve, reject) => {
    db.query(
      sqlInsertRecordKey,
      [recordId, recipientAddress, wrappedKey],
      (err) => {
        if (err) return reject(new SqlError("insertRecordKey"));
        resolve();
      }
    );
  });
}

function updateRecord(id, cid, hash, date) {
  return new Promise((resolve, reject) => {
    db.query(sqlUpdateRecord, [cid, hash, date, id], (err) => {
      if (err) return reject(new SqlError("updateRecord"));
      resolve();
    });
  });
}

async function getRecordWithKey(recordId, recipientAddress) {
  return new Promise((resolve, reject) => {
    db.query(
      sqlGetRecordWithKey,
      [recordId, recipientAddress],
      (err, results) => {
        if (err) {
          return reject(new SqlError("getRecordWithKey"));
        }
        try {
          const row = getUnique(results, "getRecordWithKey", "record_keys");
          const wrappedKeyStr = row.wrappedKey.toString("utf8");
          resolve({ ipfsCid: row.ipfsCid, wrappedKey: wrappedKeyStr });
        } catch (e) {
          return reject(e);
        }
      }
    );
  });
}

function getRecordMeta(recordId) {
  return new Promise((resolve, reject) => {
    db.query(sqlSelectRecordMeta, [recordId], (err, results) => {
      if (err) {
        return reject(new SqlError("getRecordMeta"));
      }
      try {
        const row = getUnique(results, "getRecordMeta", "records");
        resolve(row);
      } catch (e) {
        return reject(e);
      }
    });
  });
}

function getAllRecords() {
  return new Promise((resolve, reject) => {
    db.query(sqlSelectAllRecords, (err, results) => {
      if (err) {
        return reject(new SqlError("getAllRecords"));
      }
      try {
        resolve(results);
      } catch (e) {
        return reject(e);
      }
    });
  });
}

function deleteRecordKey(id, address) {
  return new Promise((resolve, reject) => {
    db.query(sqlDeleteRecordKey, [id, address], (err) => {
      if (err) return reject(new SqlError("deleteRecordKey"));
      resolve();
    });
  });
}

module.exports = {
  insertRecord,
  insertRecordKey,
  updateRecord,
  getRecordWithKey,
  getRecordMeta,
  getAllRecords,
  deleteRecordKey,
};
