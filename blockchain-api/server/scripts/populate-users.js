require("dotenv").config();
require("../app");
const { validateRecord } = require("../src/utils/record-validator");

const fs = require("fs");
const path = require("path");
const csvParser = require("csv-parser");
const { v4: uuidv4 } = require("uuid");
const { ethers } = require("ethers");
const userBll = require("../src/eth-business/users-bll");
const medicalRecordsBll = require("../src/eth-business/medical-records-bll");
const { buildMedicalRecordBundle } = require("../src/utils/bundle-builder");

const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);

const DATA_DIR = path.join(__dirname, "..", "synthea_output");

const PATIENTS_CSV = path.join(DATA_DIR, "patients.csv");
const PROVIDERS_CSV = path.join(DATA_DIR, "providers.csv");
const ORGS_CSV = path.join(DATA_DIR, "organizations.csv");
const ENCOUNTERS_CSV = path.join(DATA_DIR, "encounters.csv");
const CONDITIONS_CSV = path.join(DATA_DIR, "conditions.csv");
const MEDS_CSV = path.join(DATA_DIR, "medications.csv");
const OBS_CSV = path.join(DATA_DIR, "observations.csv");
const CAREPLANS_CSV = path.join(DATA_DIR, "careplans.csv");
const PROCEDURES_CSV = path.join(DATA_DIR, "procedures.csv");

const ENCOUNTER_CLASS_MAP = {
  ambulatory: "AMB",
  wellness: "AMB",
  outpatient: "AMB",
  emergency: "EMER",
  urgentcare: "EMER",
  inpatient: "IMP",
};

const GENDER_MAP = {
  F: "Female",
  M: "Male",
};

async function dbHasPatients() {
  return new Promise((resolve, reject) => {
    global.db.query(
      "SELECT COUNT(*) AS nb FROM patient_profiles",
      (err, rows) => {
        if (err) return reject(err);
        resolve(rows[0].nb > 0);
      }
    );
  });
}

async function clearUserData() {
  const tables = [
    "record_keys",
    "records",
    "patient_profiles",
    "doctor_profiles",
    "credentials",
    "users",
    "patient_features",
  ];
  for (let t of tables) {
    await global.db.query("SET FOREIGN_KEY_CHECKS = 0");
    await new Promise((res, rej) =>
      global.db.query(`TRUNCATE TABLE \`${t}\``, (err) =>
        err ? rej(err) : res()
      )
    );
    console.log(`Truncated ${t}`);
    await global.db.query("SET FOREIGN_KEY_CHECKS = 1");
  }
}

function readCsv(file) {
  return new Promise((resolve, reject) => {
    const rows = [];
    fs.createReadStream(file)
      .pipe(csvParser())
      .on("data", (row) => rows.push(row))
      .on("end", () => resolve(rows))
      .on("error", reject);
  });
}

function groupBy(arr, field) {
  return arr.reduce((acc, row) => {
    const key = row[field];
    acc[key] = acc[key] || [];
    acc[key].push(row);
    return acc;
  }, {});
}

function makeUsername(row) {
  const cleanFirst = (row.FIRST || "").replace(/\d+/g, "").trim();
  const cleanLast = (row.LAST || "").replace(/\d+/g, "").trim();
  const base = `${cleanFirst}.${cleanLast}`.toLowerCase();
  const short = row.Id.split("-")[0];
  return `${base}.${short}`;
}

function parseMedication(description) {
  const m = description.match(/^(.+?)\s*(\d[\w\s\/\.\-%]*)$/);
  if (m) {
    return {
      display: m[1].trim(),
      dosage: m[2].trim(),
    };
  }
  return {
    display: description.trim(),
    dosage: "",
  };
}

async function insertFamilyPractitioners(orgMap) {
  const allProviders = await readCsv(PROVIDERS_CSV);
  const fpCandidates = allProviders.filter(
    (prov) =>
      prov.SPECIALITY &&
      prov.SPECIALITY.trim().toLowerCase() === "family practice"
  );

  if (fpCandidates.length === 0) {
    console.warn("No Family Practice providers found.");
    return { providerNameMap: {}, doctorSignerMap: {}, newDoctorIds: [] };
  }

  const chosenFPRows = fpCandidates.slice(0, 5);

  const providerNameMap = {};
  const doctorSignerMap = {};
  const newDoctorIds = [];

  for (const provRow of chosenFPRows) {
    const newDoctorId = uuidv4();
    newDoctorIds.push(newDoctorId);

    const rawName = (provRow.NAME || "").replace(/\d+/g, "").trim();
    const [firstPart, ...restParts] = rawName.split(/\s+/);
    const firstName = firstPart || "Family";
    const lastName = restParts.join(" ") || "Practice";

    const username = makeUsername({
      FIRST: firstName,
      LAST: lastName,
      Id: provRow.Id,
    });

    const org = orgMap.get(provRow.ORGANIZATION) || {
      name: "",
      street: "",
      city: "",
      state: "",
    };
    const clinicName = org.name || "Family Practice Clinic";
    const clinicAddr = [org.street, org.city, org.state]
      .filter((x) => x && x.trim())
      .join(",");

    providerNameMap[newDoctorId] = { firstName, lastName };

    try {
      const docUser = await userBll.registerDoctor({
        username,
        syntheaId: newDoctorId,
        firstName,
        lastName,
        specialization: "Family Practice",
        hospital: clinicName,
        hospitalAddr: clinicAddr,
      });

      const byUsername = await userBll.findByUsername(docUser.username);
      const keystoreJson = byUsername.keystoreJson;
      const wallet = await ethers.Wallet.fromEncryptedJson(
        keystoreJson,
        docUser.password
      );
      const doctorSigner = wallet.connect(provider);
      doctorSignerMap[newDoctorId] = doctorSigner;

      console.log(`Registered FP doctor ${username}`);
    } catch (err) {
      console.error(`Error registering FP doctor ${username}:`, err.message);
    }
  }

  return { providerNameMap, doctorSignerMap, newDoctorIds };
}

async function main() {
  // const hasPatients = await dbHasPatients();
  // if (hasPatients) {
  //   console.log("DB already contains patients");
  //   return;
  // }

  // await clearUserData();

  console.log("Loading all CSV data up front...");

  const [
    allPatients,
    allOrgs,
    encRows,
    condRows,
    medRows,
    obsRows,
    cpRows,
    prRows,
  ] = await Promise.all([
    readCsv(PATIENTS_CSV),
    readCsv(ORGS_CSV),
    readCsv(ENCOUNTERS_CSV),
    readCsv(CONDITIONS_CSV),
    readCsv(MEDS_CSV),
    readCsv(OBS_CSV),
    readCsv(CAREPLANS_CSV),
    readCsv(PROCEDURES_CSV),
  ]);

  const alivePatients = allPatients.filter(
    (p) => !p.DEATHDATE || !p.DEATHDATE.trim()
  );
  const patientInfo = Object.fromEntries(alivePatients.map((p) => [p.Id, p]));

  const orgMap = new Map(
    allOrgs.map((o) => [
      o.Id,
      {
        name: o.NAME,
        street: o.ADDRESS,
        city: o.CITY,
        state: o.STATE,
      },
    ])
  );

  const condByEnc = groupBy(condRows, "ENCOUNTER");
  const medByEnc = groupBy(medRows, "ENCOUNTER");
  const obsByEnc = groupBy(obsRows, "ENCOUNTER");
  const cpByEnc = groupBy(cpRows, "ENCOUNTER");
  const prByEnc = groupBy(prRows, "ENCOUNTER");

  const patientEncounterRows = encRows.filter((e) =>
    alivePatients.some((p) => p.Id === e.PATIENT)
  );

  const nonEmptyEncounters = patientEncounterRows.filter((e) => {
    const id = e.Id;
    return (
      (condByEnc[id] && condByEnc[id].length > 0) ||
      (medByEnc[id] && medByEnc[id].length > 0) ||
      (obsByEnc[id] && obsByEnc[id].length > 0) ||
      (cpByEnc[id] && cpByEnc[id].length > 0) ||
      (prByEnc[id] && prByEnc[id].length > 0)
    );
  });
  console.log(
    `Found ${nonEmptyEncounters.length} non-empty encounters in CSV.`
  );

  const validEncounters = [];
  for (const e of nonEmptyEncounters) {
    const dummyAddress = "0x0000000000000000000000000000000000000000";

    const conds = (condByEnc[e.Id] || [])
      .filter((c) => c.START)
      .sort((a, b) => new Date(a.START) - new Date(b.START));
    let condition = null;
    if (conds[0]) {
      const raw = conds[0].DESCRIPTION || "";
      const display = raw.replace(/\s*\(.*?\)$/, "").trim();
      condition = {
        id: conds[0].Id,
        display,
        onsetDateTime: conds[0].START,
      };
    }

    const meds = (medByEnc[e.Id] || [])
      .filter((m) => m.START && m.DESCRIPTION && m.DESCRIPTION.trim() !== "")
      .sort((a, b) => new Date(a.START) - new Date(b.START));
    let medicationRequest = null;
    if (meds[0]) {
      const { display, dosage } = parseMedication(meds[0].DESCRIPTION);
      medicationRequest = {
        id: meds[0].Id,
        display,
        dosage,
      };
    }

    const obss = (obsByEnc[e.Id] || [])
      .filter((o) => o.START && o.VALUE != null)
      .sort((a, b) => new Date(a.START) - new Date(b.START));
    const observations = obss[0]
      ? {
          id: obss[0].Id,
          effectiveDateTime: obss[0].DATE,
          components: obss.map((o) => ({
            display: o.DESCRIPTION,
            value: Number(o.VALUE),
            unit: o.UNITS,
          })),
        }
      : null;

    const cps = (cpByEnc[e.Id] || [])
      .filter(
        (cp) =>
          cp.START && cp.STOP && cp.DESCRIPTION && cp.DESCRIPTION.trim() !== ""
      )
      .sort((a, b) => new Date(a.START) - new Date(b.START));
    const carePlan = cps[0]
      ? {
          id: cps[0].Id,
          display: cps[0].DESCRIPTION,
          periodStart: cps[0].START,
          periodEnd: cps[0].STOP,
        }
      : null;

    const procs = (prByEnc[e.Id] || [])
      .filter(
        (pr) => pr.START && pr.DESCRIPTION && pr.DESCRIPTION.trim() !== ""
      )
      .sort((a, b) => new Date(a.START) - new Date(b.START));
    const procedure = procs[0]
      ? {
          id: procs[0].Id,
          display: procs[0].DESCRIPTION,
          performedDateTime: procs[0].DATE,
        }
      : null;

    const encounterClass =
      ENCOUNTER_CLASS_MAP[e.ENCOUNTERCLASS.toLowerCase()] || "AMB";
    const recordPayload = {
      patientAddress: dummyAddress,
      encounter: {
        id: e.Id,
        start: e.START,
        end: e.STOP,
        class: encounterClass,
      },
    };
    if (condition) recordPayload.condition = condition;
    if (medicationRequest) recordPayload.medicationRequest = medicationRequest;
    if (observations) recordPayload.observations = observations;
    if (carePlan) recordPayload.carePlan = carePlan;
    if (procedure) recordPayload.procedure = procedure;

    const { ok, value: validated } = validateRecord(recordPayload);
    if (!ok) continue;
    validEncounters.push({ encounterRow: e, validated });
  }
  console.log(
    `After validation, ${validEncounters.length} valid encounters remain.`
  );

  const MAX_PATIENTS = 500;
  const distinctPatients = Array.from(
    new Set(validEncounters.map((e) => e.encounterRow.PATIENT))
  );
  const patientWhitelist = new Set(distinctPatients.slice(0, MAX_PATIENTS));
  let patientFilteredEncounters = validEncounters.filter((e) =>
    patientWhitelist.has(e.encounterRow.PATIENT)
  );
  console.log(
    `After limiting to ${MAX_PATIENTS} patients, ${patientFilteredEncounters.length} encounters remain.`
  );

  const byProvider = {};
  for (const { encounterRow: e } of patientFilteredEncounters) {
    byProvider[e.PROVIDER] = byProvider[e.PROVIDER] || new Set();
    byProvider[e.PROVIDER].add(e.PATIENT);
  }
  const providersSorted = Object.keys(byProvider).sort(
    (a, b) => byProvider[b].size - byProvider[a].size
  );
  const selectedProviders = [];
  const covered = new Set();
  for (const prov of providersSorted) {
    const addsNew = [...byProvider[prov]].some((p) => !covered.has(p));
    if (!addsNew) continue;
    selectedProviders.push(prov);
    byProvider[prov].forEach((p) => covered.add(p));
    if (covered.size >= MAX_PATIENTS) break;
  }

  const providerWhitelist = new Set(selectedProviders);
  console.log(
    `Will register only ${providerWhitelist.size} out of ${providersSorted.length} doctors.`
  );

  let filteredEncounters = patientFilteredEncounters.filter((e) =>
    providerWhitelist.has(e.encounterRow.PROVIDER)
  );
  console.log(
    `After limiting to ${providerWhitelist.size} doctors, will ${filteredEncounters.length} encounters.`
  );

  const patientsWithFilteredEncounters = new Set(
    filteredEncounters.map((e) => e.encounterRow.PATIENT)
  );
  const eligiblePatientRows = alivePatients.filter((p) =>
    patientsWithFilteredEncounters.has(p.Id)
  );
  console.log(`Will register ${eligiblePatientRows.length} patients.`);

  const patientAddressMap = {};
  const patientSignerMap = {};

  for (const p of eligiblePatientRows) {
    const firstClean = (p.FIRST || "").replace(/\d+/g, "").trim();
    const lastClean = (p.LAST || "").replace(/\d+/g, "").trim();
    const username = makeUsername(p);
    const patientAddr = [p.ADDRESS, p.CITY, p.STATE, p.COUNTY]
      .filter((x) => x && x.trim())
      .join(",");

    try {
      const user = await userBll.registerPatient({
        username,
        syntheaId: p.Id,
        firstName: firstClean,
        lastName: lastClean,
        addr: patientAddr,
        birthDate: p.BIRTHDATE,
        gender: p.GENDER,
      });
      patientAddressMap[p.Id] = user.address;
      console.log(`Registered patient ${username} – ${user.address}`);

      const byUsername = await userBll.findByUsername(user.username);
      const keystoreJson = byUsername.keystoreJson;
      const wallet = await ethers.Wallet.fromEncryptedJson(
        keystoreJson,
        user.password
      );
      patientSignerMap[p.Id] = wallet.connect(provider);
    } catch (err) {
      console.error("Error registering patient", p.Id, err.message);
    }
  }

  console.log("Registering Family Practitioners...");
  const {
    providerNameMap: fpNameMap,
    doctorSignerMap: fpSignerMap,
    newDoctorIds: fpIds,
  } = await insertFamilyPractitioners(orgMap);

  console.log("Registering doctors...");
  const allProviders = await readCsv(PROVIDERS_CSV);
  const providersToRegister = allProviders.filter((p) =>
    providerWhitelist.has(p.Id)
  );

  const providerNameMap2 = {};
  const doctorSignerMap2 = {};

  for (const p of providersToRegister) {
    const rawName = (p.NAME || "").replace(/\d+/g, "").trim();
    const [first, ...rest] = rawName.split(/\s+/);
    const last = rest.join(" ");
    const firstName = first;
    const lastName = last;

    const username = makeUsername({
      FIRST: firstName,
      LAST: lastName,
      Id: p.Id,
    });

    providerNameMap2[p.Id] = { firstName, lastName };
    const org = orgMap.get(p.ORGANIZATION) || {
      name: "",
      street: "",
      city: "",
      state: "",
    };
    const hospitalAddr = [org.street, org.city, org.state]
      .filter((x) => x && x.trim())
      .join(",");

    try {
      const user = await userBll.registerDoctor({
        username,
        syntheaId: p.Id,
        firstName,
        lastName,
        specialization: "General Practice",
        hospital: org.name,
        hospitalAddr,
      });

      const userByUsername = await userBll.findByUsername(user.username);
      const keystoreJson = userByUsername.keystoreJson;
      const wallet = await ethers.Wallet.fromEncryptedJson(
        keystoreJson,
        user.password
      );
      const signer = wallet.connect(provider);

      const doctorAddr = await signer.getAddress();
      console.log(`Registered doctor ${username} – ${doctorAddr}`);

      doctorSignerMap2[p.Id] = signer;
    } catch (err) {
      console.error("Error registering doctor", p.Id, err.message);
    }
  }

  for (const { encounterRow: e, validated } of filteredEncounters) {
    if (!patientAddressMap[e.PATIENT]) {
      continue;
    }
    const patientAddress = patientAddressMap[e.PATIENT];
    const doctorSigner = doctorSignerMap2[e.PROVIDER];

    const { BIRTHDATE, GENDER, FIRST, LAST } = patientInfo[e.PATIENT];
    const firstName = (FIRST || "").replace(/\d+/g, "").trim();
    const lastName = (LAST || "").replace(/\d+/g, "").trim();
    const { firstName: docFirst, lastName: docLast } =
      providerNameMap2[e.PROVIDER] || {};

    const bundle = buildMedicalRecordBundle({
      patient: {
        id: e.PATIENT,
        birthDate: BIRTHDATE,
        gender: GENDER_MAP[GENDER] || "Other",
        firstName,
        lastName,
      },
      doctor: {
        id: e.PROVIDER,
        firstName: docFirst,
        lastName: docLast,
      },
      encounter: validated.encounter,
      condition: validated.condition,
      medicationRequest: validated.medicationRequest,
      observations: validated.observations,
      carePlan: validated.carePlan,
      procedure: validated.procedure,
    });

    try {
      await medicalRecordsBll.insertMedicalRecord(
        bundle,
        patientAddress,
        doctorSigner
      );
      console.log(`Inserted record for encounter ${e.Id}`);
    } catch (err) {
      console.error(
        `Error inserting record for encounter ${e.Id}: ${err.message || err}`
      );
      continue;
    }
  }

  console.log("All records inserted on-chain.");

  console.log("Granting each patient access to a random FP doctor...");
  for (const p of eligiblePatientRows) {
    const patientCsvId = p.Id;
    const patientSigner = patientSignerMap[patientCsvId];
    const randomIndex = Math.floor(Math.random() * fpIds.length);
    const chosenDoctorId = fpIds[randomIndex];
    const doctorSigner = fpSignerMap[chosenDoctorId];

    if (!doctorSigner) {
      console.error(
        `No signer found for FP doctor ${chosenDoctorId}; skipping grantAccess.`
      );
      continue;
    }

    try {
      const doctorAddr = await doctorSigner.getAddress();
      await medicalRecordsBll.grantAccess(doctorAddr, patientSigner);
      console.log(
        `Patient ${patientCsvId} granted access to FP doctor ${chosenDoctorId}`
      );
    } catch (err) {
      console.error(
        `Error granting access for patient ${patientCsvId} to doctor ${chosenDoctorId}:`,
        err.message
      );
      continue;
    }
  }

  console.log("Finished inserting patients, doctors, and records.");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
