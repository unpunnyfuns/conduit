/** Joins class names, dropping falsy parts. */
export const cn = (...parts: readonly (string | false | null | undefined)[]): string =>
  parts.filter((part): part is string => typeof part === "string" && part.length > 0).join(" ");
