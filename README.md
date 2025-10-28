# Secure Management of Electronic Patient Health Records Using Blockchain

This project implements a secure backend system for managing electronic patient health records (EHRs) through blockchain technology. It enables healthcare practitioners and patients to store, access, and share medical data in a decentralized and verifiable way.

The application is built on a local Ethereum blockchain network and integrates IPFS (InterPlanetary File System) for distributed, tamper-resistant file storage. Smart contracts handle data access control, identity management, and record verification, ensuring that only authorized entities can view or modify medical information.

# To run and test the API locally, several development tools and a particular dataset are required:

1. **Hardhat** — to deploy and interact with smart contracts on a local Ethereum node.

2. **IPFS Kubo** — to run a local IPFS daemon for secure and distributed file storage.

3. **Synthea Dataset** — to provide synthetic patient and practitioner data for populating and testing the system.

This project demonstrates how blockchain and distributed storage can be used to enhance the confidentiality, integrity, and interoperability of healthcare records.

# Running the Application Locally

Perform the following steps to build, configure, and run the application in your local environment:

1. Install all the required dependencies.

```bash
npm install
```

2. Install hardhat development environment in your project.

```bash
npm install --save-dev hardhat
```

3. Compile Medical Record Smart Contract to be able to upload, modify and view medical records.

```bash
npx hardhat compile
```

4. Launch your own hardhat node to connect to an Ethereum chain and interact with the Medical Record Smart Contract.

```bash
npx hardhat node
```

5. Deploy the compiled smart contract into the local chain.

```bash
npx hardhat run scripts/deploy.js --network localhost
```

6. Run a script to automatically load the database with patients and doctors, following the Synthea Data Set.

Make sure to include the Synthea Data Set into the project.

```bash
mkdir synthea_output
```

Install the csv version from https://synthetichealth.github.io/synthea/ and include it in the folder you've just created.

```bash
npx hardhat run scripts/populate-users.js
```

7. Install IPFS Kubo in order to run your local IPFS node. Install it from: https://dist.ipfs.tech/#go-ipfs

Initialize the daemon:

```bash
ipfs init
```

Finally, start the daemon in order to be able to upload files to the ipfs network.

```bash
ipfs daemon
```

8. Now you are ready to launch the application.

```bash
npm start
```
