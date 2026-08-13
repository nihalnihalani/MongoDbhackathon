import type { JsonSchema, JsonValue } from "../types.js";

function matchesType(value: JsonValue, type: string): boolean {
  switch (type) {
    case "null":
      return value === null;
    case "object":
      return typeof value === "object" && value !== null && !Array.isArray(value);
    case "array":
      return Array.isArray(value);
    case "string":
      return typeof value === "string";
    case "number":
      return typeof value === "number" && Number.isFinite(value);
    case "integer":
      return typeof value === "number" && Number.isInteger(value);
    case "boolean":
      return typeof value === "boolean";
    default:
      return true;
  }
}

function failure(path: string, message: string): never {
  throw new Error(`${path} ${message}`);
}

/** Validates the JSON Schema subset used by agent tools before invoking external adapters. */
export function validateJsonSchema(value: JsonValue, schema: JsonSchema, path = "arguments"): void {
  if (schema.anyOf) {
    const matched = schema.anyOf.some((candidate) => {
      try {
        validateJsonSchema(value, candidate, path);
        return true;
      } catch {
        return false;
      }
    });
    if (!matched) failure(path, "does not match any allowed schema");
    return;
  }
  if (schema.oneOf) {
    let matches = 0;
    for (const candidate of schema.oneOf) {
      try {
        validateJsonSchema(value, candidate, path);
        matches += 1;
      } catch {
        // A oneOf branch that does not match is expected.
      }
    }
    if (matches !== 1) failure(path, "must match exactly one allowed schema");
    return;
  }

  const types = Array.isArray(schema.type) ? schema.type : schema.type ? [schema.type] : [];
  if (types.length && !types.some((type) => matchesType(value, type))) {
    failure(path, `must be ${types.join(" or ")}`);
  }
  if (schema.enum && !schema.enum.some((candidate) => candidate === value)) {
    failure(path, "contains an unsupported value");
  }

  if (typeof value === "number") {
    if (typeof schema.minimum === "number" && value < schema.minimum) failure(path, `must be at least ${schema.minimum}`);
    if (typeof schema.maximum === "number" && value > schema.maximum) failure(path, `must be at most ${schema.maximum}`);
  }
  if (Array.isArray(value)) {
    if (typeof schema.minItems === "number" && value.length < schema.minItems) failure(path, "has too few items");
    if (typeof schema.maxItems === "number" && value.length > schema.maxItems) failure(path, "has too many items");
    if (schema.items) value.forEach((item, index) => validateJsonSchema(item, schema.items!, `${path}[${index}]`));
  }
  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    for (const required of schema.required ?? []) {
      if (!(required in value)) failure(`${path}.${required}`, "is required");
    }
    for (const [key, item] of Object.entries(value)) {
      const childSchema = schema.properties?.[key];
      if (childSchema) validateJsonSchema(item, childSchema, `${path}.${key}`);
      else if (schema.additionalProperties === false) failure(`${path}.${key}`, "is not allowed");
      else if (typeof schema.additionalProperties === "object") {
        validateJsonSchema(item, schema.additionalProperties, `${path}.${key}`);
      }
    }
  }
}
