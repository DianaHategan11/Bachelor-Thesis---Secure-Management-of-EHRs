const { SqlError } = require("../models/db-errors");
const { getUnique } = require("../utils/commons");

const sqlUpsertPatientFeatures = `
    INSERT INTO patient_features (
        patient_addr,
        age, 
        num_encounters, 
        num_amb_encounters, 
        num_emer_encounters, 
        num_inp_encounters, 
        num_procedures, 
        top_conditions
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
     age = VALUES(age),
     num_encounters = VALUES(num_encounters),
     num_amb_encounters = VALUES(num_amb_encounters),
     num_emer_encounters = VALUES(num_emer_encounters),
     num_inp_encounters = VALUES(num_inp_encounters),
     num_procedures = VALUES(num_procedures),
     top_conditions = VALUES(top_conditions) 
`;

const sqlGetFeature = `
    SELECT * FROM patient_features WHERE patient_addr = ?
`;

async function upsertPatientFeatures(
  patient_addr,
  age,
  num_encounters,
  num_amb_encounters,
  num_emer_encounters,
  num_inp_encounters,
  num_procedures,
  top_cond
) {
  const params = [
    patient_addr,
    age,
    num_encounters,
    num_amb_encounters,
    num_emer_encounters,
    num_inp_encounters,
    num_procedures,
    JSON.stringify(top_cond || []),
  ];
  return new Promise((resolve, reject) => {
    db.query(sqlUpsertPatientFeatures, params, (err) => {
      if (err) {
        console.error(
          "upsertPatientFeatures SQL error:",
          err.sqlMessage || err
        );
        return reject(new SqlError("upsertPatientFeatures"));
      }
      resolve();
    });
  });
}

async function getFeature(patient_addr) {
  return new Promise((resolve, reject) => {
    db.query(sqlGetFeature, [patient_addr], (err, rows) => {
      if (err) return reject(new SqlError("getFeature"));
      if (!rows || rows.length === 0) {
        return resolve(null);
      } else if (rows.length > 1) {
        return reject(new SqlError("getFeature: multiple rows found"));
      }
      resolve(rows[0]);
    });
  });
}

module.exports = { upsertPatientFeatures, getFeature };
