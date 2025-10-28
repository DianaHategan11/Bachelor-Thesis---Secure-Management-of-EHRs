const express = require("express");
const authenticate = require("../middleware/auth-middleware");
const authorizeDoctor = require("../middleware/authorize-doctor");
const authorizePatient = require("../middleware/authorize-patient");
const attachWallet = require("../middleware/attach-wallet");
const medicalRecordsBll = require("../eth-business/medical-records-bll");
const medicalRecordDAO = require("../db-dao/medical-records-dao");
const {
  getPatientProfile,
  getDoctorProfile,
} = require("../db-dao/accounts-dao");
const { buildMedicalRecordBundle } = require("../utils/bundle-builder");
const { simplifyRecord } = require("../utils/simplified-record");
const ErrorHandling = require("../models/error-handling");
const { MethodCallError } = require("../models/eth-errors");

const router = express.Router();

router.post(
  "/records",
  authenticate,
  authorizeDoctor,
  attachWallet,
  async (req, res) => {
    try {
      const signer = req.wallet;
      const doctorAddr = await signer.getAddress();
      const {
        patientAddress,
        encounter,
        condition,
        medicationRequest,
        observations,
        carePlan,
        procedure,
      } = req.body;

      const patient = await getPatientProfile(patientAddress);
      if (!patient) {
        return res.status(404).json({ error: "Patient not found" });
      }
      const doctor = await getDoctorProfile(doctorAddr);
      if (!doctor) {
        return res.status(404).json({ error: "Doctor not found" });
      }

      const bundle = buildMedicalRecordBundle({
        patient,
        doctor,
        encounter,
        condition,
        medicationRequest,
        observations,
        carePlan,
        procedure,
      });

      const result = await medicalRecordsBll.insertMedicalRecord(
        bundle,
        patientAddress,
        signer
      );
      res.status(201).json(result);
    } catch (err) {
      console.error(err);
      const payload = ErrorHandling.factoryPartialErrorHandling(err);
      payload.path = req.path;
      payload.timestamp = Date.now();
      res.status(err.statusCode || 500).json(payload);
    }
  }
);

router.put(
  "/records/:recordId",
  authenticate,
  authorizeDoctor,
  attachWallet,
  async (req, res) => {
    try {
      const recordId = Number(req.params.recordId);
      if (Number.isNaN(recordId))
        return res.status(400).json({ error: "Invalid record id" });

      const signer = req.wallet;
      const doctorAddr = await signer.getAddress();
      const {
        patientAddress,
        encounter,
        condition,
        medicationRequest,
        observations,
        carePlan,
        procedure,
      } = req.body;

      const existing = await medicalRecordDAO.getRecordMeta(recordId);
      if (!existing) return res.status(404).json({ error: "Record not found" });
      if (existing.doctorAddr.toLowerCase() !== doctorAddr.toLowerCase())
        return res.status(403).json({
          error:
            "Only the doctor that created the record is allowed to update it",
        });
      if (
        patientAddress &&
        existing.patientAddr.toLowerCase() !== patientAddress.toLowerCase()
      )
        return res.status(400).json({
          error: "Patient address does not match the record's patient",
        });

      const patient = await getPatientProfile(
        patientAddress || existing.patientAddr
      );
      if (!patient) {
        return res.status(404).json({ error: "Patient not found" });
      }
      const doctor = await getDoctorProfile(doctorAddr);
      if (!doctor) {
        return res.status(404).json({ error: "Doctor not found" });
      }

      const bundle = buildMedicalRecordBundle({
        patient,
        doctor,
        encounter,
        condition,
        medicationRequest,
        observations,
        carePlan,
        procedure,
      });

      const result = await medicalRecordsBll.updateMedicalRecord(
        recordId,
        bundle,
        signer
      );
      res.status(200).json(result);
    } catch (err) {
      console.error("updateRecord failed:", err);
      if (err instanceof MethodCallError && err.methodName === "updateRecord") {
        return res.status(403).json({
          error:
            "Only the doctor that created the record is allowed to update it",
        });
      }
      const payload = ErrorHandling.factoryPartialErrorHandling(err);
      payload.path = req.path;
      payload.timestamp = Date.now();
      res.status(err.statusCode || 500).json(payload);
    }
  }
);

router.get("/records", authenticate, authorizeDoctor, async (req, res) => {
  try {
    const records = await medicalRecordsBll.getAllRecords();
    res.json(records);
  } catch (err) {
    console.error(err);
    const payload = ErrorHandling.factoryPartialErrorHandling(err);
    payload.path = req.path;
    payload.timestamp = Date.now();
    res.status(err.statusCode || 500).json(payload);
  }
});

router.get(
  "/records/signer/:id",
  authenticate,
  attachWallet,
  async (req, res) => {
    try {
      const id = Number(req.params.id);
      const signer = req.wallet;
      const content = await medicalRecordsBll.fetchRecordContent(id, signer);
      const record = simplifyRecord(content);

      const { patientAddr, doctorAddr } = await medicalRecordDAO.getRecordMeta(
        id
      );
      record.patient.address = patientAddr;
      record.doctor.address = doctorAddr;
      res.json(record);
    } catch (err) {
      console.error(err);
      const payload = ErrorHandling.factoryPartialErrorHandling(err);
      payload.path = req.path;
      payload.timestamp = Date.now();
      res.status(err.statusCode || 500).json(payload);
    }
  }
);

router.get(
  "/records/patient",
  authenticate,
  authorizePatient,
  attachWallet,
  async (req, res) => {
    try {
      const signer = req.wallet;
      const records = await medicalRecordsBll.getPatientRecords(signer);
      res.json(records);
    } catch (err) {
      console.error(err);
      const payload = ErrorHandling.factoryPartialErrorHandling(err);
      payload.path = req.path;
      payload.timestamp = Date.now();
      res.status(err.statusCode || 500).json(payload);
    }
  }
);

router.get(
  "/records/doctor",
  authenticate,
  authorizeDoctor,
  attachWallet,
  async (req, res) => {
    try {
      const signer = req.wallet;

      const records = await medicalRecordsBll.getDoctorRecords(signer);
      res.json(records);
    } catch (err) {
      console.error(err);
      const payload = ErrorHandling.factoryPartialErrorHandling(err);
      payload.path = req.path;
      payload.timestamp = Date.now();
      res.status(err.statusCode || 500).json(payload);
    }
  }
);

router.post(
  "/records/access/grant",
  authenticate,
  authorizePatient,
  attachWallet,
  async (req, res) => {
    try {
      const doctorAddr = req.body.doctorAddress;
      const signer = req.wallet;
      const tx = await medicalRecordsBll.grantAccess(doctorAddr, signer);
      res.json(tx);
    } catch (err) {
      console.error(err);
      const p = ErrorHandling.factoryPartialErrorHandling(err);
      p.path = req.path;
      p.timestamp = Date.now();
      res.status(err.statusCode || 500).json(p);
    }
  }
);

router.delete(
  "/records/access/revoke",
  authenticate,
  authorizePatient,
  attachWallet,
  async (req, res) => {
    try {
      const doctorAddr = req.query.doctorAddress;
      const signer = req.wallet;
      const tx = await medicalRecordsBll.revokeAccess(doctorAddr, signer);
      res.json(tx);
    } catch (err) {
      console.error(err);
      const p = ErrorHandling.factoryPartialErrorHandling(err);
      p.path = req.path;
      p.timestamp = Date.now();
      res.status(err.statusCode || 500).json(p);
    }
  }
);

module.exports = router;
