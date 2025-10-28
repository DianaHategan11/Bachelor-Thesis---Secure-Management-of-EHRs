function authorizeDoctor(req, res, next) {
  if (req.user.role !== "DOCTOR") {
    return res.status(403).json({ error: "Doctor role required" });
  }
  next();
}

module.exports = authorizeDoctor;
