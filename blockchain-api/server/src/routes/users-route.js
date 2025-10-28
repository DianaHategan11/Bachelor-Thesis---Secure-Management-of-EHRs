require("dotenv").config();
const express = require("express");
const { ethers } = require("ethers");
const jwt = require("jsonwebtoken");
const userBll = require("../eth-business/users-bll");
const ErrorHandling = require("../models/error-handling");

let router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET;

router.post("/patients", async (req, res) => {
  try {
    const { username, firstName, lastName, addr, birthDate, gender, password } =
      req.body;

    const { address, txHash } = await userBll.registerPatient({
      username,
      syntheaId: null,
      firstName,
      lastName,
      addr,
      birthDate,
      gender,
      password,
    });

    res.status(201).send({ address, txHash });
  } catch (err) {
    console.error(err);
    const payload = ErrorHandling.factoryPartialErrorHandling(err);
    payload.path = req.path;
    payload.timestamp = Date.now();
    res.status(err.statusCode || 500).json(payload);
  }
});

router.post("/doctors", async (req, res) => {
  try {
    const {
      username,
      firstName,
      lastName,
      specialization,
      hospital,
      hospitalAddr,
      password,
    } = req.body;

    const { address, txHash } = await userBll.registerDoctor({
      username,
      syntheaId: null,
      firstName,
      lastName,
      specialization,
      hospital,
      hospitalAddr,
      password,
    });
    res.status(201).send({ address, txHash });
  } catch (err) {
    console.error(err);
    const payload = ErrorHandling.factoryPartialErrorHandling(err);
    payload.path = req.path;
    payload.timestamp = Date.now();
    res.status(err.statusCode || 500).json(payload);
  }
});

router.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;

    const user = await userBll.findByUsername(username);
    if (!user) {
      return res.status(401).send({ error: "Invalid credentials" });
    }

    const match = await require("bcrypt").compare(password, user.passwordHash);
    if (!match) {
      return res.status(401).send({ error: "Invalid credentials" });
    }

    const wallet = await ethers.Wallet.fromEncryptedJson(
      user.keystoreJson,
      password
    );
    req.session.privateKey = wallet.privateKey;

    const token = jwt.sign(
      {
        userId: user.id,
        username: user.username,
        role: user.role,
        address: user.address,
      },
      JWT_SECRET,
      { expiresIn: "24h" }
    );

    res.send({ token, role: user.role });
  } catch (err) {
    if (err.name === "SqlNoResultError") {
      return res.status(401).send({ error: "Invalid credentials" });
    }
    console.error(err);
    const payload = ErrorHandling.factoryPartialErrorHandling(err);
    payload.path = req.path;
    payload.timestamp = Date.now();
    res.status(err.statusCode || 500).json(payload);
  }
});

router.post("/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error("Session destroy error:", err);
      return res.sendStatus(500);
    }
    res.clearCookie("sid", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
    });
    res.sendStatus(204);
  });
});

module.exports = router;
