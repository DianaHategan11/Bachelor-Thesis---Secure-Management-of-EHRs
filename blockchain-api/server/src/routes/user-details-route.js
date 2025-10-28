require("dotenv").config();
const express = require("express");
const authenticate = require("../middleware/auth-middleware");
const authorizeDoctor = require("../middleware/authorize-doctor");
const authorizePatient = require("../middleware/authorize-patient");
const userBll = require("../eth-business/users-bll");
const ErrorHandling = require("../models/error-handling");

let router = express.Router();

router.get("/patients", authenticate, authorizeDoctor, async (req, res) => {
  try {
    const patients = await userBll.getAllPatients();
    res.json(patients);
  } catch (err) {
    console.error(err);
    const payload = ErrorHandling.factoryPartialErrorHandling(err);
    payload.path = req.path;
    payload.timestamp = Date.now();
    res.status(err.statusCode || 500).json(payload);
  }
});

router.get("/doctors", authenticate, authorizePatient, async (req, res) => {
  try {
    const doctors = await userBll.getAllDoctors();
    res.json(doctors);
  } catch (err) {
    console.error(err);
    const payload = ErrorHandling.factoryPartialErrorHandling(err);
    payload.path = req.path;
    payload.timestamp = Date.now();
    res.status(err.statusCode || 500).json(payload);
  }
});

router.get(
  "/doctor/specialization",
  authenticate,
  authorizeDoctor,
  async (req, res) => {
    try {
      const doctorAddr = req.query.doctorAddress;
      const specialization = await userBll.getDoctorSpecialization(doctorAddr);
      res.json({ specialization });
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
  "/doctor/family",
  authenticate,
  authorizePatient,
  async (req, res) => {
    try {
      const patientAddr = req.user.address;
      const doctor = await userBll.getFamilyDoctor(patientAddr);
      res.json(doctor);
    } catch (err) {
      console.error(err);
      const payload = ErrorHandling.factoryPartialErrorHandling(err);
      payload.path = req.path;
      payload.timestamp = Date.now();
      res.status(err.statusCode || 500).json(payload);
    }
  }
);

module.exports = router;
