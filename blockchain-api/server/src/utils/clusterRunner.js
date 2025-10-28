const path = require("path");
const { spawn } = require("child_process");
const { ethers } = require("ethers");
const contractDao = require("../db-dao/contracts-dao");
const {
  abi: medicalAbi,
} = require("../../artifacts/contracts/MedicalRecord.sol/MedicalRecord.json");

const scriptPath = path.resolve(__dirname, "../../scripts/cluster_patients.py");
const scriptDir = path.dirname(scriptPath);

let isRunning = false;
let rerunScheduled = false;
let debounceTimer = null;

function _shceduleClustering() {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    debounceTimer = null;
    if (isRunning) {
      rerunScheduled = true;
    } else {
      _runClustering();
    }
  }, 10000);
}

function _runClustering() {
  isRunning = true;
  console.log("Running clustering script...");

  const scriptPath = path.resolve(
    __dirname,
    "../../scripts/cluster_patients.py"
  );
  const py = spawn("python3", [scriptPath], {
    env: process.env,
    cwd: scriptDir,
  });

  py.stdout.on("data", (data) => console.log(`[cluster] ${data}`));
  py.stderr.on("data", (data) => console.error(`[cluster error] ${data}`));
  py.on("close", (code) => {
    console.log(`Clustering script exited with code ${code}`);
    isRunning = false;
    if (rerunScheduled) {
      rerunScheduled = false;
      _runClustering();
    }
  });
}

async function initClusterRunner() {
  const wsProvider = new ethers.WebSocketProvider(process.env.WSS_RPC_URL);
  const { address: medicalAddr } = await contractDao.QueryContractByType(
    "MEDICAL_RECORD"
  );
  const contract = new ethers.Contract(medicalAddr, medicalAbi, wsProvider);

  contract.on("RecordCreated", () => {
    console.log(`RecordCreated event detected`);
    _shceduleClustering();
  });

  contract.on("RecordUpdated", () => {
    console.log(`RecordUpdated event detected`);
    _shceduleClustering();
  });

  console.log(
    `Cluster runner initialized and listening for events via WebSocket.`
  );
}

module.exports = { initClusterRunner };
