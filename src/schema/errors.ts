export type SchemaErrorCode = "INVALID_DOCUMENT" | "BROKEN_REFERENCE" | "DUPLICATE_ID";

export type SchemaIssue = { code: SchemaErrorCode; path: string; message: string };

export class LensDocumentError extends Error {
  readonly code: SchemaErrorCode;
  readonly issues: readonly SchemaIssue[];

  constructor(code: SchemaErrorCode, message: string, issues: readonly SchemaIssue[] = []) {
    super(message);
    this.name = "LensDocumentError";
    this.code = code;
    this.issues = issues;
  }
}

export type Parsed<T> = { ok: true; value: T } | { ok: false; error: LensDocumentError };

export const formatIssues = (issues: readonly SchemaIssue[]): string =>
  issues.map((issue) => `  ${issue.path || "<root>"}: ${issue.message} [${issue.code}]`).join("\n");
