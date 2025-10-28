function authorizePatient(req, res, next) {
  if (req.user.role !== "PATIENT") {
    return res.status(403).json({ error: "Patient role required" });
  }
  next();
}

module.exports = authorizePatient;
