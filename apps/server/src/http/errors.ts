import {
  TableOSErrorCodes,
  createTableOSError,
  type TableOSError,
  type TableOSErrorCode,
} from "@tableos/types";
import type { FastifyReply, FastifyRequest } from "fastify";
import { ZodError } from "zod";
import { ForbiddenActionError } from "../modules/access/assert.js";
import { PlanLimitExceededError } from "../modules/billing/limits-service.js";

export const PROBLEM_CONTENT_TYPE = "application/problem+json";

export interface ProblemDocument extends TableOSError {
  type: string;
  requestId: string;
}

/** Error `type` links open the API reference's error list in this TableOS (set from APP_URL at start). */
let errorTypeBase = "/help/api#error";

export function setProblemTypeBase(appUrl: string): void {
  errorTypeBase = `${appUrl.replace(/\/+$/, "")}/help/api#error`;
}

/**
 * Extended problem codes used by the HTTP layer on top of `TableOSErrorCodes`
 * (kept here so `@tableos/types` does not need to change).
 */
export type ApiErrorCode =
  | TableOSErrorCode
  | "CONFLICT"
  | "INTERNAL_ERROR"
  | "BAD_REQUEST"
  | "RATE_LIMITED"
  | "MFA_REQUIRED"
  | "NOTHING_TO_UNDO"
  | (string & {});

const API_ERROR_TITLES: Record<string, string> = {
  CONFLICT: "Conflict",
  INTERNAL_ERROR: "Internal server error",
  BAD_REQUEST: "Bad request",
  RATE_LIMITED: "Too many requests",
  MFA_REQUIRED: "Multi-factor authentication required",
  NOTHING_TO_UNDO: "Nothing to undo",
  METHOD_NOT_ALLOWED: "Method not allowed",
  UNKNOWN_FIELD: "Unknown field",
};

export function problemType(code: string): string {
  return `${errorTypeBase}-${code.toLowerCase().replace(/_/g, "-")}`;
}

export function sendProblem(
  reply: FastifyReply,
  request: FastifyRequest,
  error: TableOSError,
): void {
  const body: ProblemDocument = {
    ...error,
    type: problemType(error.code),
    requestId: request.id,
  };
  void reply
    .code(error.status)
    .header("content-type", PROBLEM_CONTENT_TYPE)
    .send(body);
}

/**
 * Throwable HTTP error. Any route can `throw new ApiError(409, "CONFLICT", "…")`;
 * `handleRouteError` and the global error handler render it as a problem doc.
 */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: ApiErrorCode,
    detail?: string,
    readonly meta?: Record<string, unknown>,
  ) {
    super(detail ?? code);
    this.name = "ApiError";
  }
}

/** Build a problem payload for any code (including the extended ones). */
export function apiProblem(
  status: number,
  code: ApiErrorCode,
  detail?: string,
  meta?: Record<string, unknown>,
): TableOSError {
  const known = (Object.values(TableOSErrorCodes) as string[]).includes(code);
  const problem: TableOSError = known
    ? createTableOSError(code as TableOSErrorCode, { status })
    : { code: code as TableOSErrorCode, title: API_ERROR_TITLES[code] ?? code, status };
  if (detail !== undefined) problem.detail = detail;
  if (meta !== undefined) problem.meta = meta;
  return problem;
}

export function sendApiError(
  request: FastifyRequest,
  reply: FastifyReply,
  status: number,
  code: ApiErrorCode,
  detail?: string,
  meta?: Record<string, unknown>,
): void {
  sendProblem(reply, request, apiProblem(status, code, detail, meta));
}

export function validationProblem(
  request: FastifyRequest,
  reply: FastifyReply,
  detail: string,
  errors?: TableOSError["errors"],
): void {
  sendProblem(
    reply,
    request,
    createTableOSError(TableOSErrorCodes.VALIDATION_FAILED, {
      detail,
      ...(errors !== undefined ? { errors } : {}),
    }),
  );
}

export function notFound(request: FastifyRequest, reply: FastifyReply, detail?: string): void {
  sendProblem(
    reply,
    request,
    createTableOSError(TableOSErrorCodes.NOT_FOUND, {
      ...(detail !== undefined ? { detail } : {}),
    }),
  );
}

export function unauthorized(request: FastifyRequest, reply: FastifyReply, detail?: string): void {
  sendProblem(
    reply,
    request,
    createTableOSError(TableOSErrorCodes.UNAUTHENTICATED, {
      ...(detail !== undefined ? { detail } : {}),
    }),
  );
}

export function forbidden(request: FastifyRequest, reply: FastifyReply, detail?: string): void {
  sendProblem(
    reply,
    request,
    createTableOSError(TableOSErrorCodes.FORBIDDEN, {
      ...(detail !== undefined ? { detail } : {}),
    }),
  );
}

/** 409 VERSION_CONFLICT (record versions). For other conflicts use `conflictProblem`. */
export function conflict(request: FastifyRequest, reply: FastifyReply, detail: string): void {
  sendProblem(
    reply,
    request,
    createTableOSError(TableOSErrorCodes.VERSION_CONFLICT, { detail }),
  );
}

/** 409 with an arbitrary code (default `CONFLICT`). */
export function conflictProblem(
  request: FastifyRequest,
  reply: FastifyReply,
  detail: string,
  code: ApiErrorCode = "CONFLICT",
): void {
  sendApiError(request, reply, 409, code, detail);
}

/** Domain error codes thrown as `new Error("CODE")` (or `.code`) across the server. */
const MESSAGE_CODE_MAP: Record<string, { status: number; code: ApiErrorCode; detail: string }> = {
  INVALID_FILTER_AST: { status: 422, code: "VALIDATION_FAILED", detail: "Invalid filter expression" },
  FILTER_DEPTH_EXCEEDED: { status: 422, code: "VALIDATION_FAILED", detail: "Filter is nested too deeply" },
  FILTER_TOO_LARGE: { status: 422, code: "VALIDATION_FAILED", detail: "Filter has too many conditions (max 200)" },
  INVALID_CURSOR: { status: 422, code: "VALIDATION_FAILED", detail: "Invalid or expired pagination cursor" },
  INVALID_SORT: { status: 422, code: "VALIDATION_FAILED", detail: "Invalid sort specification" },
  LINK_CARDINALITY: { status: 422, code: "VALIDATION_FAILED", detail: "This link field only allows a single linked record" },
  LINK_FIELD_NOT_FOUND: { status: 404, code: "NOT_FOUND", detail: "Link field not found" },
  LINK_TARGET_NOT_FOUND: { status: 422, code: "VALIDATION_FAILED", detail: "Linked record not found" },
  RECORD_NOT_FOUND: { status: 404, code: "NOT_FOUND", detail: "Record not found in this table (it may have been deleted)" },
  FIELD_NOT_FOUND: { status: 404, code: "NOT_FOUND", detail: "Field not found" },
  TABLE_NOT_FOUND: { status: 404, code: "NOT_FOUND", detail: "Table not found" },
  VIEW_NOT_FOUND: { status: 404, code: "NOT_FOUND", detail: "View not found" },
  VERSION_CONFLICT: { status: 409, code: "VERSION_CONFLICT", detail: "The record was changed by someone else" },
  PRIMARY_FIELD_REQUIRED: { status: 409, code: "PRIMARY_FIELD_REQUIRED", detail: "The primary field cannot be deleted" },
  CYCLE_DETECTED: { status: 422, code: "VALIDATION_FAILED", detail: "This change would create a circular reference" },
};

function singularize(table: string): string {
  const t = table.replace(/^.*\./, "").replace(/_/g, " ");
  if (t.endsWith("ies")) return `${t.slice(0, -3)}y`;
  if (t.endsWith("sses")) return t.slice(0, -2);
  if (t.endsWith("s")) return t.slice(0, -1);
  return t;
}

interface PgErrorLike {
  code: string;
  table?: string;
  constraint?: string;
  detail?: string;
  column?: string;
  message: string;
}

function isPgError(err: unknown): err is PgErrorLike {
  if (typeof err !== "object" || err === null) return false;
  const code = (err as { code?: unknown }).code;
  return (
    typeof code === "string" &&
    /^[0-9A-Z]{5}$/.test(code) &&
    ("severity" in err || "routine" in err || "constraint" in err || "table" in err)
  );
}

/** Translate a Postgres error into an ApiError, or null when it is a genuine 500. */
export function mapPgError(err: unknown): ApiError | null {
  if (!isPgError(err)) return null;
  const entity = err.table ? singularize(err.table) : "item";
  switch (err.code) {
    case "23505": {
      const hay = `${err.constraint ?? ""} ${err.detail ?? ""}`.toLowerCase();
      const detail = hay.includes("name")
        ? `A ${entity} with that name already exists`
        : hay.includes("email")
          ? `A ${entity} with that email already exists`
          : `This ${entity} already exists`;
      return new ApiError(409, "CONFLICT", detail, err.constraint ? { constraint: err.constraint } : undefined);
    }
    case "23503": {
      // Deleting something still referenced → 409; referencing something missing → 422.
      if (/still referenced/i.test(err.detail ?? "")) {
        return new ApiError(409, "CONFLICT", `This ${entity} is still in use`);
      }
      return new ApiError(
        422,
        "VALIDATION_FAILED",
        "A referenced item does not exist",
        err.constraint ? { constraint: err.constraint } : undefined,
      );
    }
    case "23502":
      return new ApiError(422, "VALIDATION_FAILED", `Missing required value${err.column ? ` for ${err.column}` : ""}`);
    case "23514":
      return new ApiError(422, "VALIDATION_FAILED", `Invalid value for ${entity}`, err.constraint ? { constraint: err.constraint } : undefined);
    case "22P02":
    case "22007":
    case "22008":
    case "22003":
    case "22023":
    case "2201W":
    case "2201X":
      return new ApiError(422, "VALIDATION_FAILED", "Invalid value in request");
    case "22001":
      return new ApiError(422, "VALIDATION_FAILED", "A value is too long");
    case "40001":
    case "40P01":
      return new ApiError(409, "CONFLICT", "The request conflicted with another change; please retry");
    case "55P03":
      return new ApiError(409, "CONFLICT", "The resource is busy; please retry");
    default:
      return null;
  }
}

/** What a refused permission means, in the words of the roles (Owner, Creator, Editor, Commenter, Viewer). */
const ACTION_REFUSED: Record<string, string> = {
  "base.read": "You don't have access to this base.",
  "base.manage_schema": "Only Creators and Owners of this base can add or change tables and fields. Ask one of them to give you the Creator role.",
  "base.manage_members": "Only Creators and Owners of this base can manage who has access.",
  "record.read": "You don't have access to these records.",
  "record.create": "Your role on this base can't add records (Editors and above can).",
  "record.update": "Your role on this base can't edit records (Editors and above can).",
  "record.delete": "Your role on this base can't delete records (Editors and above can).",
  "record.comment": "Your role on this base can't comment (Commenters and above can).",
  "view.read": "You don't have access to this view.",
  "view.create_collaborative": "Only Editors and above can create collaborative views. You can create a personal view.",
  "view.update": "Your role on this base can't change shared views.",
  "export.data": "Only Owners and Admins can export data.",
  "api.access": "Your account can't use the API.",
};

export function actionRefusedText(action: string): string {
  return ACTION_REFUSED[action] ?? `Your role on this base doesn't allow this (${action}).`;
}

const FIELD_LABELS: Record<string, string> = { name: "Name", body: "Comment", description: "Description", title: "Title" };

/** Readable text for zod's default "String must contain at most N character(s)". */
function zodIssueMessage(e: ZodError["errors"][number]): string {
  if (e.code === "too_big" && e.type === "string") {
    const key = String(e.path[e.path.length - 1] ?? "");
    const label = FIELD_LABELS[key] ?? (key ? key.charAt(0).toUpperCase() + key.slice(1) : "This text");
    return `${label} must be ${Number(e.maximum).toLocaleString("en-US")} characters or fewer.`;
  }
  return e.message;
}

/** Map any thrown value to a problem document; null means "unexpected" (500). */
export function problemFromError(err: unknown): TableOSError | null {
  if (err instanceof ApiError) {
    return apiProblem(err.status, err.code, err.message, err.meta);
  }
  if (err instanceof ZodError) {
    const errors = err.errors.map((e) => ({ field: e.path.join("."), message: zodIssueMessage(e) }));
    const tooLong = err.errors.find((e) => e.code === "too_big" && e.type === "string");
    return createTableOSError(TableOSErrorCodes.VALIDATION_FAILED, {
      detail: tooLong ? zodIssueMessage(tooLong) : "Invalid request body",
      errors,
    });
  }
  if (err instanceof PublicIdError) {
    return createTableOSError(TableOSErrorCodes.VALIDATION_FAILED, { detail: err.message });
  }
  if (err instanceof ForbiddenActionError) {
    return createTableOSError(TableOSErrorCodes.FORBIDDEN, {
      detail: actionRefusedText(err.action),
      meta: { action: err.action },
    });
  }
  if (err instanceof PlanLimitExceededError) {
    return createTableOSError(TableOSErrorCodes.PLAN_LIMIT_EXCEEDED, {
      detail: err.message,
      ...(err.meta !== undefined ? { meta: err.meta } : {}),
    });
  }
  const pg = mapPgError(err);
  if (pg) {
    return apiProblem(pg.status, pg.code, pg.message, pg.meta);
  }
  if (err instanceof Error) {
    if (err.name === "FormulaParseError") {
      return apiProblem(422, "VALIDATION_FAILED", `Formula error: ${err.message}`);
    }
    if (err.name === "HttpEgressBlockedError") {
      return apiProblem(422, "VALIDATION_FAILED", err.message);
    }
    const errCode = (err as { code?: unknown }).code;
    const byMessage = MESSAGE_CODE_MAP[err.message];
    const byCode = typeof errCode === "string" ? MESSAGE_CODE_MAP[errCode] : undefined;
    if (byMessage) {
      return apiProblem(byMessage.status, byMessage.code, byMessage.detail);
    }
    if (byCode) {
      // `new SomeError("CODE", "human message")` keeps its human message.
      const detail = err.message && err.message !== errCode ? err.message : byCode.detail;
      return apiProblem(byCode.status, byCode.code, detail);
    }
    // Fastify/framework errors (malformed JSON body, payload too large, …)
    const statusCode = (err as { statusCode?: unknown }).statusCode;
    if (typeof statusCode === "number" && statusCode >= 400 && statusCode < 500) {
      const code: ApiErrorCode =
        statusCode === 401
          ? "UNAUTHENTICATED"
          : statusCode === 403
            ? "FORBIDDEN"
            : statusCode === 404
              ? "NOT_FOUND"
              : statusCode === 429
                ? "RATE_LIMITED"
                : statusCode === 422
                  ? "VALIDATION_FAILED"
                  : "BAD_REQUEST";
      return apiProblem(statusCode, code, err.message);
    }
  }
  return null;
}

export function internalErrorProblem(): TableOSError {
  return apiProblem(500, "INTERNAL_ERROR", "An unexpected error occurred");
}

export function handleRouteError(
  request: FastifyRequest,
  reply: FastifyReply,
  err: unknown,
): void {
  const problem = problemFromError(err);
  if (problem) {
    sendProblem(reply, request, problem);
    return;
  }
  request.log.error({ err }, "Unhandled route error");
  sendProblem(reply, request, internalErrorProblem());
}

export class PublicIdError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PublicIdError";
  }
}

export function wrapPublicId<T>(fn: () => T): T {
  try {
    return fn();
  } catch (e) {
    if (e instanceof Error && e.message.includes("public id")) {
      throw new PublicIdError(e.message);
    }
    throw e;
  }
}
