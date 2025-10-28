function simplifyRecord(bundle) {
  const out = {};

  for (const { resource } of bundle.entry) {
    switch (resource.resourceType) {
      case "Patient":
        const patientName = resource.name?.[0] || {};
        out.patient = {
          id: resource.id,
          firstName: patientName.given?.[0] || null,
          lastName: patientName.family || null,
          gender: resource.gender || null,
          birthDate: resource.birthDate || null,
        };
        break;

      case "Practitioner":
        const doctorName = resource.name?.[0] || {};
        out.doctor = {
          id: resource.id,
          firstName: doctorName.given?.[0] || null,
          lastName: doctorName.family || null,
        };
        break;

      case "Encounter": {
        const {
          id,
          period: { start, end },
          class: { code: encClass },
        } = resource;
        out.encounter = { id, start, end, class: encClass };
        break;
      }

      case "Condition": {
        out.condition = {
          id: resource.id,
          display: resource.code?.text || "",
          onsetDateTime: resource.onsetDateTime || "",
        };
        break;
      }

      case "MedicationRequest": {
        out.medicationRequest = {
          id: resource.id,
          display: resource.medicationCodeableConcept?.text || "",
          dosage: resource.dosageInstruction?.[0]?.text || "",
        };
        break;
      }

      case "Observation": {
        out.observations = {
          id: resource.id,
          effectiveDateTime: resource.effectiveDateTime || "",
          components: (resource.component || []).map((c) => ({
            // const cod = c.code?.coding?.[0] || {};
            // const val = c.valueQuantity || {};
            // return {
            //   key: cod.code || cod.display || cod.text,
            //   display: cod.display || cod.text,
            //   value: val.value ?? "",
            //   unit: val.unit || "",
            // };
            display: c.code?.text || "",
            value: c.valueQuantity?.value ?? "",
            unit: c.valueQuantity?.unit ?? "",
          })),
        };
        break;
      }

      case "CarePlan": {
        out.carePlan = {
          id: resource.id,
          display: resource.category?.[0]?.text || "",
          periodStart: resource.period?.start || "",
          periodEnd: resource.period?.end || "",
        };
        break;
      }

      case "Procedure": {
        out.procedure = {
          id: resource.id,
          display: resource.code?.text || "",
          performedDateTime: resource.performedDateTime || "",
        };
        break;
      }

      // case "AllergyIntolerance": {
      //   out.allergy = {
      //     id: resource.id,
      //     display: resource.code?.text || "",
      //     onsetDateTime: resource.onsetDateTime || "",
      //   };
      // }
    }
  }

  return out;
}

module.exports = { simplifyRecord };
