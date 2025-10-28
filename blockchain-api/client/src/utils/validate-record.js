import { recordSchema } from "./validators/record-validators.js";

const normalize = (key) =>
  key
    .replace(/\./g, " ")
    .replace(/([A-Z])/g, " $1")
    .toLowerCase()
    .replace(/^./, (c) => c.toUpperCase());

function joiSchemasToFieldErrors(details) {
  const out = {};
  details.forEach((d) => {
    const key = d.path.join(".");
    let msg = d.message.replace(/["]/g, "");
    msg = msg.replace(new RegExp(key, "g"), normalize(key));
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

export { joiSchemasToFieldErrors, validateRecord };
