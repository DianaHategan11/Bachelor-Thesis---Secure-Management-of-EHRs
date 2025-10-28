class MethodCallError extends Error {
  constructor(
    contractName,
    functionName,
    methodName,
    reason = null,
    cause = null
  ) {
    let msg = `[${contractName}] EVM revert on ${functionName} - ${methodName}`;
    if (reason) msg += `: ${reason}`;
    super(msg);
    this.name = "MethodCallError";
    if (cause) this.cause = cause;
  }
}

class GetEventsError extends Error {
  constructor(contractName, eventName, reason = null, cause = null) {
    let msg = `[${contractName}] Error on get ${eventName} events`;
    if (reason) msg += `: ${reason}`;
    super(msg);
    this.name = "GetEventsError";
    if (cause) this.cause = cause;
  }
}

class LogError extends Error {
  constructor(eventName, cause = null) {
    const reason = cause && cause.message ? `: ${cause.message}` : "";
    super(`Missing or invalid event log for ${eventName}${reason}`);
    this.name = "ErrorLogError";
    if (cause) this.cause = cause;
  }
}

module.exports = {
  MethodCallError,
  GetEventsError,
  LogError,
};
