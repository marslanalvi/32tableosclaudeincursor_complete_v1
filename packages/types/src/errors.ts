import type { Result } from "./result.js";
import { err, ok } from "./result.js";

export const TableOSErrorCodes = {
  UNAUTHENTICATED: "UNAUTHENTICATED",
  FORBIDDEN: "FORBIDDEN",
  NOT_FOUND: "NOT_FOUND",
  VALIDATION_FAILED: "VALIDATION_FAILED",
  VERSION_CONFLICT: "VERSION_CONFLICT",
  PLAN_LIMIT_EXCEEDED: "PLAN_LIMIT_EXCEEDED",
  FIELD_VALIDATION_FAILED: "FIELD_VALIDATION_FAILED",
  IDEMPOTENCY_CONFLICT: "IDEMPOTENCY_CONFLICT",
} as const;

export type TableOSErrorCode =
  (typeof TableOSErrorCodes)[keyof typeof TableOSErrorCodes];

export interface TableOSErrorDetail {
  field?: string;
  message: string;
  code?: string;
}

/** RFC 9457–aligned problem payload skeleton for API layers. */
export interface TableOSError {
  code: TableOSErrorCode;
  title: string;
  status: number;
  detail?: string;
  instance?: string;
  errors?: TableOSErrorDetail[];
  meta?: Record<string, unknown>;
}

const DEFAULT_STATUS: Record<TableOSErrorCode, number> = {
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  VALIDATION_FAILED: 422,
  VERSION_CONFLICT: 409,
  PLAN_LIMIT_EXCEEDED: 402,
  FIELD_VALIDATION_FAILED: 422,
  IDEMPOTENCY_CONFLICT: 409,
};

const DEFAULT_TITLES: Record<TableOSErrorCode, string> = {
  UNAUTHENTICATED: "Authentication required",
  FORBIDDEN: "Forbidden",
  NOT_FOUND: "Not found",
  VALIDATION_FAILED: "Validation failed",
  VERSION_CONFLICT: "Version conflict",
  PLAN_LIMIT_EXCEEDED: "Plan limit exceeded",
  FIELD_VALIDATION_FAILED: "Field validation failed",
  IDEMPOTENCY_CONFLICT: "Idempotency conflict",
};

export function createTableOSError(
  code: TableOSErrorCode,
  overrides: Partial<Omit<TableOSError, "code" | "title" | "status">> & {
    title?: string;
    status?: number;
  } = {},
): TableOSError {
  const error: TableOSError = {
    code,
    title: overrides.title ?? DEFAULT_TITLES[code],
    status: overrides.status ?? DEFAULT_STATUS[code],
  };
  if (overrides.detail !== undefined) {
    error.detail = overrides.detail;
  }
  if (overrides.instance !== undefined) {
    error.instance = overrides.instance;
  }
  if (overrides.errors !== undefined) {
    error.errors = overrides.errors;
  }
  if (overrides.meta !== undefined) {
    error.meta = overrides.meta;
  }
  return error;
}

export type TableOSResult<T> = Result<T, TableOSError>;

export function tableosOk<T>(value: T): TableOSResult<T> {
  return ok(value);
}

export function tableosErr(
  code: TableOSErrorCode,
  overrides?: Parameters<typeof createTableOSError>[1],
): TableOSResult<never> {
  return err(createTableOSError(code, overrides));
}
