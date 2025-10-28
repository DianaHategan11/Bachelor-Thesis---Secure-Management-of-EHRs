# blockchain-api

# Launch the blockchain-api

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

7. Install IPFS Kubo in order to run your local IPFS node as a secure, distributed solution to storing the medical records. Install it from: https://dist.ipfs.tech/#go-ipfs

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
