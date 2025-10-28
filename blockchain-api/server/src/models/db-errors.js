class SqlError extends Error {
  constructor(queryName) {
    super("SQL Error on " + queryName);
    this.name = "SqlError";
    this.statusCode = 500;
  }
}

class SqlNoResultError extends Error {
  constructor(queryName) {
    super("No SQL results on " + queryName);
    this.name = "SqlNoResultError";
    this.statusCode = 404;
  }
}

class SqlNotUniqueError extends Error {
  constructor(entityName, queryName) {
    super(`${entityName} is not unique on ${queryName}`);
    this.name = "SqlNotUniqueError";
    this.statusCode = 409;
  }
}

module.exports = {
  SqlError,
  SqlNoResultError,
  SqlNotUniqueError,
};
