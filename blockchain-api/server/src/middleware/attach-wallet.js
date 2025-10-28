const { Wallet } = require("ethers");

function attachWallet(req, res, next) {
  const pk = req.session.privateKey;
  if (!pk) {
    return res.status(401).json({
      error:
        "Session expired or wallet not unlocked. Please log in again to unlock your wallet.",
    });
  }
  req.wallet = new Wallet(pk, req.app.get("provider"));
  next();
}

module.exports = attachWallet;
