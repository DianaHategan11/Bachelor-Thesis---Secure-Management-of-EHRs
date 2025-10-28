export const usernameRegex = /^[a-z][a-z0-9._-]{2,29}$/;
export const ssnRegex = /^\d{3}-?\d{2}-?\d{4}$/;
export const passwordRegex =
  /^(?=.{12,}$)(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^\w\s]).*$/;

export function isUsername(username) {
  return usernameRegex.test(username);
}

export function isSSN(ssn) {
  return ssnRegex.test(ssn);
}

export function isPassword(password) {
  return passwordRegex.test(password);
}
