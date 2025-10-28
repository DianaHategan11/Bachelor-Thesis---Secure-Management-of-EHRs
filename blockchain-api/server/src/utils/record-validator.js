const Joi = require("joi");
const { v4: uuidv4 } = require("uuid");

const uuid = Joi.string().default(() => uuidv4());
const isoDate = Joi.string().isoDate().required();
const isoDateOptional = Joi.string().isoDate().empty("").optional();

const encounterSchema = Joi.object({
  id: uuid,
  start: isoDate.label("Start date").custom((value, helpers) => {
    const { end } = helpers.state.ancestors[0];
    if (new Date(value) > new Date(end)) {
      return helpers.message("Start date must be before end date");
    }
    return value;
  }),
  end: isoDate.label("End date"),
  class: Joi.string()
    .valid(
      "AMB",
      "EMER",
      "IMP",
      "ambulatory",
      "outpatient",
      "wellness",
      "emergency",
      "urgentcare",
      "inpatient"
    )
    .default("AMB")
    .uppercase()
    .label("Encounter type"),
});

const conditionSchema = Joi.object({
  id: uuid,
  display: Joi.string().empty("").optional(),
  onsetDateTime: isoDateOptional,
}).and("display", "onsetDateTime");

const medicationRequestSchema = Joi.object({
  id: uuid,
  display: Joi.string().empty("").optional(),
  dosage: Joi.string().empty("").optional(),
}).and("display", "dosage");

const componentSchema = Joi.object({
  display: Joi.string().required(),
  value: Joi.alternatives().try(Joi.number(), Joi.string()).required(),
  unit: Joi.when("value", {
    is: Joi.number(),
    then: Joi.string().required(),
    otherwise: Joi.forbidden(),
  }),
});

const observationSchema = Joi.object({
  id: uuid,
  effectiveDateTime: isoDateOptional,
  components: Joi.array().items(componentSchema).min(1).optional(),
}).and("effectiveDateTime", "components");

const carePlanSchema = Joi.object({
  id: uuid,
  display: Joi.string().empty("").optional(),
  periodStart: isoDateOptional.label("Start date").custom((value, helpers) => {
    const { end } = helpers.state.ancestors[0];
    if (new Date(value) > new Date(end)) {
      return helpers.message("Start date must be before end date");
    }
    return value;
  }),
  periodEnd: isoDateOptional.label("End date"),
}).and("display", "periodStart", "periodEnd");

const procedureSchema = Joi.object({
  id: uuid,
  display: Joi.string().empty("").optional(),
  performedDateTime: isoDateOptional,
}).and("display", "performedDateTime");

const recordSchema = Joi.object({
  patientAddress: Joi.string().required(),
  encounter: encounterSchema.required(),
  condition: conditionSchema.optional(),
  medicationRequest: medicationRequestSchema.optional(),
  observations: observationSchema.optional(),
  carePlan: carePlanSchema.optional(),
  procedure: procedureSchema.optional(),
})
  .or("condition", "medicationRequest", "observations", "carePlan", "procedure")
  .messages({
    "object.missing":
      "At least one condition, medication request, observation, care plan, or procedure must be provided",
  })
  .unknown(false);

function joiSchemasToFieldErrors(details) {
  const out = {};
  details.forEach((d) => {
    const key = d.path.join(".");
    let msg = d.message.replace(/["]/g, "");
    msg = msg.replace(new RegExp(key, "g"), key.replace(/\./g, " "));
    out[key] = msg;
  });
  return out;
}

function validateRecord(draft) {
  const pruned = JSON.parse(
    JSON.stringify(draft, (_k, v) => {
      if (v === "") return undefined;
      if (Array.isArray(v) && v.length === 0) return undefined;
      if (v && typeof v === "object" && Object.keys(v).length === 0)
        return undefined;
      return v;
    })
  );

  const { error, value } = recordSchema.validate(pruned, {
    abortEarly: false,
    stripUnknown: true,
    convert: true,
  });

  if (error) {
    return {
      ok: false,
      message: error.details.map((d) => d.message).join("\n"),
      details: error.details,
    };
  }

  return { ok: true, value };
}

module.exports = { validateRecord };
