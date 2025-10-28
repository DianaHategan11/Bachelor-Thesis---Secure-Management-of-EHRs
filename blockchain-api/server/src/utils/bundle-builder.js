const { v4: uuidv4 } = require("uuid");
const ref = (id) => ({ reference: `urn:uuid:${id}` });

function buildPatient(p) {
  return {
    fullUrl: `urn:uuid:${p.id}`,
    resource: {
      resourceType: "Patient",
      id: p.id,
      name: [{ family: p.lastName, given: [p.firstName] }],
      gender: p.gender,
      birthDate: p.birthDate,
    },
  };
}

function buildPractitioner(d) {
  return {
    fullUrl: `urn:uuid:${d.id}`,
    resource: {
      resourceType: "Practitioner",
      id: d.id,
      name: [{ family: d.lastName, given: [d.firstName] }],
    },
  };
}

function buildEncounter(e, patId, docId) {
  return {
    fullUrl: `urn:uuid:${e.id}`,
    resource: {
      resourceType: "Encounter",
      id: e.id,
      status: "finished",
      class: {
        system: "http://terminology.hl7.org/CodeSystem/v3-ActCode",
        code: e.class,
      },
      subject: ref(patId),
      participant: [{ individual: ref(docId) }],
      period: { start: e.start, end: e.end },
    },
  };
}

function buildCondition(c, patId, eId) {
  return {
    fullUrl: `urn:uuid:${c.id}`,
    resource: {
      resourceType: "Condition",
      id: c.id,
      clinicalStatus: {
        coding: [
          {
            system: "http://terminology.hl7.org/CodeSystem/condition-clinical",
            code: "active",
          },
        ],
      },
      verificationStatus: {
        coding: [
          {
            system:
              "http://terminology.hl7.org/CodeSystem/condition-ver-status",
            code: "confirmed",
          },
        ],
      },
      code: {
        text: c.display,
      },
      subject: ref(patId),
      encounter: ref(eId),
      onsetDateTime: c.onsetDateTime,
    },
  };
}

function buildMedicationRequest(m, patId, docId, eId) {
  return {
    fullUrl: `urn:uuid:${m.id}`,
    resource: {
      resourceType: "MedicationRequest",
      id: m.id,
      status: "active",
      intent: "order",
      subject: ref(patId),
      requester: ref(docId),
      encounter: ref(eId),
      medicationCodeableConcept: {
        text: m.display,
      },
      dosageInstruction: [{ text: m.dosage }],
    },
  };
}

function buildObservations(o = {}, patId, eId) {
  const comps = Array.isArray(o.components) ? o.components : [];
  if (comps.length === 0) {
    return null;
  }
  return {
    fullUrl: `urn:uuid:${o.id}`,
    resource: {
      resourceType: "Observation",
      id: o.id,
      status: "final",
      code: { text: o.title || "Observation panel" },
      subject: ref(patId),
      encounter: ref(eId),
      effectiveDateTime: o.effectiveDateTime,
      component: o.components.map((c) => ({
        code: { text: c.display },
        ...(c.unit !== undefined
          ? { valueQuantity: { value: c.value, unit: c.unit } }
          : { valueQuantity: { value: String(c.value) } }),
      })),
    },
  };
}

function buildCarePlan(cp, patId, docId, eId) {
  return {
    fullUrl: `urn:uuid:${cp.id}`,
    resource: {
      resourceType: "CarePlan",
      id: cp.id,
      status: "active",
      intent: "plan",
      category: [
        {
          text: cp.display,
        },
      ],
      subject: ref(patId),
      author: ref(docId),
      encounter: ref(eId),
      period: { start: cp.periodStart, end: cp.periodEnd },
    },
  };
}

function buildProcedure(pr, patId, docId, eId) {
  return {
    fullUrl: `urn:uuid:${pr.id}`,
    resource: {
      resourceType: "Procedure",
      id: pr.id,
      status: "completed",
      code: {
        text: pr.display,
      },
      subject: ref(patId),
      performer: [{ actor: ref(docId) }],
      encounter: ref(eId),
      performedDateTime: pr.performedDateTime,
    },
  };
}

// function buildAllergyIntolerance(a, patId, eId) {
//   return {
//     fullUrl: `urn:uuid:${a.id}`,
//     resource: {
//       resourceType: "AllergyIntolerance",
//       id: a.id,
//       clinicalStatus: {
//         coding: [
//           {
//             system:
//               "http://terminology.hl7.org/CodeSystem/allergyintolerance-clinical",
//             code: "active",
//           },
//         ],
//       },
//       verificationStatus: {
//         coding: [
//           {
//             system:
//               "http://terminology.hl7.org/CodeSystem/allergyintolerance-verification",
//             code: "confirmed",
//           },
//         ],
//       },
//       code: {
//         text: a.display,
//       },
//       subject: ref(patId),
//       encounter: ref(eId),
//       onsetDateTime: a.onsetDateTime,
//     },
//   };
// }

function buildMedicalRecordBundle({
  patient,
  doctor,
  encounter,
  condition,
  medicationRequest,
  observations,
  carePlan,
  procedure,
  //allergy,
}) {
  const entry = [
    buildPatient(patient),
    buildPractitioner(doctor),
    buildEncounter(encounter, patient.id, doctor.id),
  ];

  if (condition)
    entry.push(buildCondition(condition, patient.id, encounter.id));
  if (medicationRequest)
    entry.push(
      buildMedicationRequest(
        medicationRequest,
        patient.id,
        doctor.id,
        encounter.id
      )
    );
  if (carePlan)
    entry.push(buildCarePlan(carePlan, patient.id, doctor.id, encounter.id));
  if (procedure)
    entry.push(buildProcedure(procedure, patient.id, doctor.id, encounter.id));
  // if (observations)
  //   entry.push(buildObservations(observations, patient.id, encounter.id));
  const obsEntry = buildObservations(observations, patient.id, encounter.id);
  if (obsEntry) {
    entry.push(obsEntry);
  }
  // if (allergy)
  //   entry.push(buildAllergyIntolerance(allergy, patient.id, encounter.id));

  return {
    resourceType: "Bundle",
    type: "collection",
    id: `bundle-${uuidv4()}`,
    timestamp: new Date().toISOString(),
    entry,
  };
}

module.exports = { buildMedicalRecordBundle };
