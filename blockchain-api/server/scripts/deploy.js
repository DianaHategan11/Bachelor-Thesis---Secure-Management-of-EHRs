const { ethers } = require("hardhat");
const dotenv = require("dotenv");
const provider = ethers.provider;

let mysql = require("mysql");
const SqlErrors = require("../src/models/db-errors");
//const { v4: uuidv4 } = require("uuid");

dotenv.config();

const adminWallet = new ethers.Wallet(process.env.ADMIN_PRIVATE_KEY, provider);

let dbIp = process.env.DB_HOST;
let dbUser = process.env.DB_USER;
let dbPass = process.env.DB_PASSWORD;
let dbname = process.env.DB_NAME;

let db_config = {
  host: dbIp,
  user: dbUser,
  password: dbPass,
  database: dbname,
};

let db;

const sqlDeleteAllContracts = "DELETE FROM contracts WHERE true";
const sqlAddContractWithOwner =
  "INSERT INTO contracts (id, name, type, address, owner) VALUES (?, ?, ?, ?, ?)";

// function uuidToBinary(uuid) {
//   return Buffer.from(uuid.replace(/-/g, ""), "hex");
// }

const { QueryContractByType } = require("../src/db-dao/contracts-dao");

InsertContractWithID = (contract_id, name, type, address, owner) => {
  return new Promise((resolve, reject) => {
    //const binaryUUID = uuidToBinary(contract_uuid);

    db.query(
      sqlAddContractWithOwner,
      [contract_id, name, type, address, owner],
      (err, contract) => {
        if (err) {
          console.log(new SqlErrors.SqlError("QueryInsertContract"));
          reject(err);
        }
        try {
          console.log(
            `Contract with name ${name} inserted at address ${address}`
          );
          console.log(contract);
          resolve(contract);
        } catch (e) {
          console.log(e);
          reject(e);
        }
      }
    );
  });
};

DeleteAll = () => {
  db.query(sqlDeleteAllContracts, (err, result) => {
    if (err) {
      console.log(new SqlErrors.SqlError("DeleteAllContracts"));
    }
    console.log("Deleted all contracts");
    console.log(result);
  });
};

db = mysql.createConnection(db_config);

console.log("Connecting... ");
db.connect(function (err) {
  if (err) {
    console.log("Error when connecting to db:", err);
  }
});

global.db = db;

async function main() {
  let contract;
  try {
    contract = await QueryContractByType("MEDICAL_RECORD");
  } catch (err) {
    if (err instanceof SqlErrors.SqlNoResultError) {
      contract = null;
    } else {
      throw err;
    }
  }

  if (contract) {
    console.log(
      `MedicalRecord contract already deployed at ${medicalRecord.target}`
    );
    return;
  }
  //DeleteAll();

  const MedicalRecord = await ethers.getContractFactory("MedicalRecord");
  const medicalRecord = await MedicalRecord.connect(adminWallet).deploy();
  await medicalRecord.waitForDeployment();
  console.log(
    `Medical Record contract deployed by ${adminWallet.address} at ${medicalRecord.target}`
  );

  await InsertContractWithID(
    1,
    "MedicalRecord",
    "MEDICAL_RECORD",
    medicalRecord.target,
    adminWallet.address
  );
  console.log(`Inserted contract ${medicalRecord.target} in the database`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
