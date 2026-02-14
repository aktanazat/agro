import { Ajv2020 } from "ajv/dist/2020";
import addFormats from "ajv-formats";
import { createRequire } from "module";
import type { Observation, ValidationResult, FieldError } from "./types";

const require = createRequire(import.meta.url);
const observationSchema = require("../../../contracts/schemas/Observation.json");

const ajv = new Ajv2020({ allErrors: true });
addFormats(ajv);

const validate = ajv.compile<Observation>(observationSchema);

export function validateObservation(candidate: unknown): ValidationResult {
  const valid = validate(candidate);

  if (valid) {
    return { valid: true, errors: [] };
  }

  const errors: FieldError[] = (validate.errors ?? []).map((err) => ({
    field: err.instancePath.replace(/^\//, "").replace(/\//g, ".") || err.params?.missingProperty || "unknown",
    message: err.message ?? "validation failed",
    value: err.params,
  }));

  return { valid: false, errors };
}
