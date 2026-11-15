/**
 * M07 catalog — pure cores: attribute-schema validation + GTIN normalization.
 * No DB. Spec: PART II M07.
 */

export interface AttributeSpec {
  key: string;
  type: "enum" | "string" | "number" | "boolean";
  values?: string[]; // for enum
  required?: boolean;
}

export type AttrValidation =
  | { ok: true }
  | { ok: false; errors: Array<{ key: string; message: string }> };

/** Validate product/variant attributes against a category's attribute schema. */
export function validateAttributes(
  schema: AttributeSpec[] | null | undefined,
  attributes: Record<string, unknown>,
): AttrValidation {
  const errors: Array<{ key: string; message: string }> = [];
  for (const spec of schema ?? []) {
    const val = attributes[spec.key];
    const present = val !== undefined && val !== null && val !== "";
    if (spec.required && !present) {
      errors.push({ key: spec.key, message: "required" });
      continue;
    }
    if (!present) continue;
    switch (spec.type) {
      case "enum":
        if (!spec.values?.includes(String(val))) {
          errors.push({ key: spec.key, message: `must be one of: ${spec.values?.join(", ")}` });
        }
        break;
      case "number":
        if (typeof val !== "number" && Number.isNaN(Number(val))) {
          errors.push({ key: spec.key, message: "must be a number" });
        }
        break;
      case "boolean":
        if (typeof val !== "boolean" && val !== "true" && val !== "false") {
          errors.push({ key: spec.key, message: "must be a boolean" });
        }
        break;
      case "string":
        if (typeof val !== "string") errors.push({ key: spec.key, message: "must be a string" });
        break;
    }
  }
  return errors.length ? { ok: false, errors } : { ok: true };
}

/** Normalise a GTIN (strip spaces/hyphens); null when empty. Validate length. */
export function normalizeGtin(gtin: string | null | undefined): string | null {
  if (!gtin) return null;
  const clean = gtin.replace(/[\s-]/g, "");
  return /^\d{8}$|^\d{12,14}$/.test(clean) ? clean : null;
}

/** Simple name normalisation for fuzzy-match pre-filtering (lowercase, collapse). */
export function normalizeName(name: string): string {
  return name.toLowerCase().replace(/\s+/g, " ").trim();
}
