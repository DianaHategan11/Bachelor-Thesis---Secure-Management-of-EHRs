require("@nomicfoundation/hardhat-ignition-ethers");
require("dotenv").config();

module.exports = {
  solidity: {
    version: "0.8.23",
    evmVersion: "paris",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
      viaIR: true,
    },
  },
  networks: {
    hardhat: {
      chainId: 1337,
      allowUnlimitedContractSize: true,
      allowUnlimitedTransactionSize: true,
      accounts: {
        mnemonic: "test test test test test test test test test test test junk",
        count: 40,
      },
      mining: { auto: false, interval: [2000, 5000] },
    },
    localhost: {
      url: "http://127.0.0.1:8545",
      chainId: 1337,
    },
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts",
  },
  mocha: {
    timeout: 40000,
  },
};
