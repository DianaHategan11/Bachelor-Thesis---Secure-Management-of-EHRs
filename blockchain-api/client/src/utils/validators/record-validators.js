import Joi from "joi";
import { v4 as uuidv4 } from "uuid";

const uuid = Joi.string().default(() => uuidv4());
const isoDate = Joi.string().isoDate().required();
const isoDateOptional = Joi.string().isoDate().empty("").optional();

// const ENC_CLASS = {
//   ambulatory: "AMB",
//   outpatient: "AMB",
//   amb: "AMB",
//   wellness: "AMB",

//   emergency: "EMER",
//   er: "EMER",
//   urgentcare: "EMER",

//   inpatient: "IMP",
//   hospital: "IMP",
//   imp: "IMP",
// };
// const ACTCODES = new Set(["AMB", "EMER", "IMP"]);

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
  // status: Joi.string()
  //   .valid("active", "completed", "cancelled")
  //   .default("active"),
  // intent: Joi.string().default("plan"),
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
  // status: Joi.string()
  //   .valid(
  //     "preparation",
  //     "in-progress",
  //     "not-done",
  //     "on-hold",
  //     "stopped",
  //     "completed"
  //   )
  //   .default("completed"),
  performedDateTime: isoDateOptional,
}).and("display", "performedDateTime");

// const allergySchema = Joi.object({
//   id: uuid,
//   display: Joi.string().empty("").optional(),
//   onsetDateTime: isoDateOptional,
// }).and("display", "onsetDateTime");

export const recordSchema = Joi.object({
  patientAddress: Joi.string().required(),
  encounter: encounterSchema.required(),
  condition: conditionSchema.optional(),
  medicationRequest: medicationRequestSchema.optional(),
  observations: observationSchema.optional(),
  carePlan: carePlanSchema.optional(),
  procedure: procedureSchema.optional(),
  //allergy: allergySchema.optional(),
})
  .or("condition", "medicationRequest", "observations", "carePlan", "procedure")
  .messages({
    "object.missing":
      "At least one condition, medication request, observation, care plan, or procedure must be provided",
  })
  .unknown(false);
