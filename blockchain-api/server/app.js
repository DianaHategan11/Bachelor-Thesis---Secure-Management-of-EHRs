require("dotenv").config();
let express = require("express");
const dotenv = require("dotenv");
let path = require("path");
let cookieParser = require("cookie-parser");
let logger = require("morgan");
let mysql = require("mysql");
let cors = require("cors");
let createError = require("http-errors");
const { ethers } = require("ethers");
const medicalRecordsRoute = require("./src/routes/medical-records-route");
const userDetailsRoute = require("./src/routes/user-details-route");
const usersRoute = require("./src/routes/users-route");
const analyticsRoute = require("./src/routes/analytics-route");
const jwtMiddleware = require("./src/middleware/auth-middleware");
const session = require("express-session");
const { initClusterRunner } = require("./src/utils/clusterRunner");

let indexRouter = require("./src/routes/index");

let app = express();
app.use(
  cors({
    origin: "http://localhost:3000",
    credentials: true,
  })
);
app.disable("etag");
app.use(logger("dev"));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(
  session({
    name: "sid",
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: 1000 * 60 * 60,
    },
  })
);

app.use("/plots", express.static(path.join(__dirname, "plots")));

const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
app.set("provider", provider);

let baseURL = "/blockchain-api";

app.use(baseURL + "/", indexRouter);
app.use(baseURL + "/auth/users", usersRoute);

app.use(jwtMiddleware);
app.use(baseURL + "/", medicalRecordsRoute);
app.use(baseURL + "/", userDetailsRoute);
app.use(baseURL, analyticsRoute);

app.use(function (req, res, next) {
  next(createError(404));
});

app.use(function (err, req, res, next) {
  console.error(err);
  err.path = req.path;
  err.timestamp = Date.now();
  const status = err.status || err.statusCode || 500;
  res.status(status).json({
    error: err.message || "Internal Server Error",
    path: err.path,
    time: err.timestamp,
  });
});

let host = process.env.DB_HOST;
let user = process.env.DB_USER;
let password = process.env.DB_PASSWORD;
let database = process.env.DB_NAME;

let db_config = {
  host: host,
  user: user,
  password: password,
  database: database,
};

let db;

function handleDisconnect() {
  db = mysql.createConnection(db_config);

  console.log("Connecting... ");
  db.connect(function (err) {
    if (err) {
      console.log("error when connecting to db:", err);
      setTimeout(handleDisconnect, 2000);
    }
  });

  db.on("error", function (err) {
    console.log("db error", err);
    if (err.code === "PROTOCOL_CONNECTION_LOST") {
      console.log("Connection lost, reconnecting... ");
      handleDisconnect();
      global.db = db;
    } else {
      console.log("Unhandled error... ");
      throw err;
    }
  });
}

handleDisconnect();
global.db = db;

initClusterRunner().catch((err) =>
  console.error(`Cluster runner failed to start: ${err}`)
);

let ip = process.env.RPC_URL;

global.provider = new ethers.JsonRpcProvider(ip);
global.ethers = ethers;
global.createError = createError;

module.exports = app;
