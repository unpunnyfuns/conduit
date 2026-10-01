export type LayoutErrorCode = "NOTHING_TO_RENDER" | "UNKNOWN_VIEW" | "ROW_OVERFULL";

export class ConduitLayoutError extends Error {
  readonly code: LayoutErrorCode;

  constructor(code: LayoutErrorCode, message: string) {
    super(message);
    this.name = "ConduitLayoutError";
    this.code = code;
  }
}
