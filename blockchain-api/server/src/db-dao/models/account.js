let AccountDTO = function (request) {
  return {
    id: request.user_id ? request.user_id : "",
    username: request.username ? request.username : "",
    address: request.address ? request.address : "0x",
    passwordHash: request.passwordHash ? request.passwordHash : "",
    keystoreJson: request.keystoreJson ? request.keystoreJson : "",
    role: request.role ? request.role : "",
  };
};

module.exports = {
  AccountDTO,
};
