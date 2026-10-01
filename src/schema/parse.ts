import type { z } from "zod";
import { ConduitDocument } from "./document.js";
import { formatIssues, ConduitDocumentError, type Parsed, type SchemaIssue } from "./errors.js";
import { integrityIssues } from "./integrity.js";

const formatPath = (path: readonly PropertyKey[]): string =>
  path.reduce<string>((acc, segment) => {
    if (typeof segment === "number") return `${acc}[${segment}]`;
    return acc === "" ? String(segment) : `${acc}.${String(segment)}`;
  }, "");

const toIssues = (error: z.ZodError): SchemaIssue[] =>
  error.issues.map((issue) => ({
    code: "INVALID_DOCUMENT" as const,
    path: formatPath(issue.path),
    message: issue.message,
  }));

const fail = (issues: SchemaIssue[]): ConduitDocumentError => {
  const first = issues[0];
  return new ConduitDocumentError(
    first ? first.code : "INVALID_DOCUMENT",
    `invalid conduit document:\n${formatIssues(issues)}`,
    issues,
  );
};

/** A document nested deeply enough exhausts the stack inside zod; report it as what it is. */
const attemptParse = (
  input: unknown,
): { read: true; value: ConduitDocument } | { read: false; issues: SchemaIssue[] } => {
  try {
    const result = ConduitDocument.safeParse(input);
    return result.success
      ? { read: true, value: result.data }
      : { read: false, issues: toIssues(result.error) };
  } catch (error) {
    if (!(error instanceof RangeError)) throw error;
    return {
      read: false,
      issues: [
        { code: "INVALID_DOCUMENT", path: "", message: "document nests too deeply to read" },
      ],
    };
  }
};

/** Structure and referential integrity in one pass. A document that survives this is safe to lay out. */
export const safeParseDocument = (input: unknown): Parsed<ConduitDocument> => {
  const result = attemptParse(input);
  if (!result.read) return { ok: false, error: fail(result.issues) };
  const issues = integrityIssues(result.value);
  if (issues.length > 0) return { ok: false, error: fail(issues) };
  return { ok: true, value: result.value };
};

export const parseDocument = (input: unknown): ConduitDocument => {
  const parsed = safeParseDocument(input);
  if (parsed.ok) return parsed.value;
  throw parsed.error;
};
