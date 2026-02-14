import { Ajv2020 } from "ajv/dist/2020";
import addFormats from "ajv-formats";
import observationSchema from "../../contracts/schemas/Observation.json";
import type { Observation, ValidationResult, FieldError } from "./types";

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
