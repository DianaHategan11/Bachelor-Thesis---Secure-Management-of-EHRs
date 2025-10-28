const jwt = require("jsonwebtoken");

function verifyToken(req, res, next) {
  const auth = req.headers.authorization?.split(" ");
  if (!auth || auth[0] !== "Bearer") return res.status(401).end();
  try {
    const payload = jwt.verify(auth[1], process.env.JWT_SECRET);
    req.user = payload;
    next();
  } catch (e) {
    res.status(401).send({ error: "Invalid token" });
  }
}

module.exports = verifyToken;
