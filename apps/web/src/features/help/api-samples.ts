/**
 * Sample request and response bodies for Help → API reference, captured from a real TableOS
 * server (a "Customers" table with Name, Orders and Status fields). Keep them in step with the API.
 */
export interface ApiSample {
  id: string;
  title: string;
  method: "GET" | "POST" | "PATCH" | "DELETE";
  path: string;
  tokenType: "none" | "read" | "write" | "delete";
  note?: string;
  request?: unknown;
  status: number;
  response?: unknown;
}

const BAS = "bas_034kETaeEKWvBxqheODxZi";
const WSP = "wsp_034kETaailG83jXk6sz2h6";
const TBL = "tbl_034kETaeWVcUfFuuDkZCYK";
const VIW = "viw_034kETaeWRT7qAAQ16H0Bb";
const F_ID = "fld_034kETaeWdgOhZjaCiY1a4";
const F_NAME = "fld_034kETajOfr9VYBkZvnW4J";
const F_ORDERS = "fld_034kETaklG1OiLB3B21iSB";
const F_STATUS = "fld_034kETam85li8YNGMsu59T";
const R1 = "rec_034kETb989J2WLtMyh052P";
const R2 = "rec_034kETbAn4XAIGq0DkOVDH";
const R3 = "rec_034kETbAn4filAcUkYhV4O";
const CURSOR = "eyJ2IjoyLCJzIjoiMjQyNzAyYWMiLCJrIjpbImEyIl0sImlkIjoiMDFhMTYyYWYtNmNjNy03YjUwLTkxZmMtYzRiMTk1YjMwMzMzIn0";

const record = (id: string, version: number, row: number, order: string, fields: Record<string, unknown>, updatedAt = "2026-10-22T08:17:06.229Z") => ({
  id,
  version,
  createdAt: "2026-10-22T08:17:06.229Z",
  updatedAt,
  rowNumber: row,
  manualOrder: order,
  fields,
});

const fieldDtos = [
  { id: F_ID, name: "Record ID", type: "record_id", slot: 1, config: {}, description: null, isPrimary: true, isComputed: true, isReadOnly: true, tableId: TBL },
  { id: F_NAME, name: "Name", type: "text", slot: 2, config: {}, description: null, isPrimary: false, isComputed: false, isReadOnly: false, tableId: TBL },
  { id: F_ORDERS, name: "Orders", type: "number", slot: 3, config: { precision: 0 }, description: null, isPrimary: false, isComputed: false, isReadOnly: false, tableId: TBL },
  {
    id: F_STATUS,
    name: "Status",
    type: "single_select",
    slot: 4,
    config: {
      options: [
        { id: "opt_active", color: "green", label: "Active" },
        { id: "opt_lead", color: "blue", label: "Lead" },
      ],
    },
    description: null,
    isPrimary: false,
    isComputed: false,
    isReadOnly: false,
    tableId: TBL,
  },
];

const tableDto = {
  id: TBL,
  name: "Customers",
  primaryFieldId: F_ID,
  fields: fieldDtos,
  sync: null,
  views: [
    {
      id: VIW,
      tableId: TBL,
      name: "Grid view",
      type: "grid",
      isDefault: true,
      visibility: "collaborative",
      ownerUserId: null,
      createdBy: "usr_034kETaZkEOBXK8BOkzBNH",
      isFavorite: false,
      isMine: true,
      canEdit: true,
      config: { filter: null, sorts: [], groups: [], hiddenFieldIds: [], fieldOrder: [], fieldWidths: {}, frozenFieldCount: 1, rowHeight: "short", color: { mode: "none" }, summary: {} },
    },
  ],
};

export const API_SAMPLES: ApiSample[] = [
  {
    id: "list-bases",
    title: "List the bases a token can reach",
    method: "GET",
    path: "/v1/api/bases",
    tokenType: "read",
    status: 200,
    response: {
      bases: [{ id: BAS, name: "Sales CRM", workspace: { id: WSP, name: "Home" }, tables: [{ id: TBL, name: "Customers" }] }],
    },
  },
  {
    id: "base-schema",
    title: "Base schema",
    method: "GET",
    path: `/v1/bases/${BAS}`,
    tokenType: "read",
    status: 200,
    response: { id: BAS, name: "Sales CRM", workspaceId: WSP, tables: [tableDto], hiddenTableIds: [], canManageOrg: true, canShare: true },
  },
  {
    id: "table-schema",
    title: "One table and its fields",
    method: "GET",
    path: `/v1/tables/${TBL}`,
    tokenType: "read",
    status: 200,
    response: { ...tableDto, baseId: BAS },
  },
  {
    id: "query",
    title: "Query records",
    method: "POST",
    path: `/v1/tables/${TBL}/records/query`,
    tokenType: "read",
    note: "Pass nextCursor back as cursor for the next page; it is null on the last page. Add \"viewId\" to apply a view, \"search\" for text search.",
    request: {
      pageSize: 2,
      sort: [{ fieldId: F_ORDERS, direction: "desc" }],
      filter: { kind: "condition", fieldId: F_ORDERS, op: "gte", value: 5 },
      fields: [F_NAME, F_ORDERS],
    },
    status: 200,
    response: {
      records: [
        record(R1, 2, 4, "a1", { Name: "Ada Lovelace", Orders: 13 }, "2026-10-22T08:17:06.294Z"),
        record(R2, 1, 5, "a2", { Name: "Grace Hopper", Orders: 7 }),
      ],
      nextCursor: null,
      totalCount: 2,
    },
  },
  {
    id: "list",
    title: "List records (query string)",
    method: "GET",
    path: `/v1/tables/${TBL}/records?pageSize=2&fields=${F_NAME}`,
    tokenType: "read",
    note: "Also accepts cursor, viewId and search.",
    status: 200,
    response: {
      records: [
        record(R1, 2, 4, "a1", { Name: "Ada Lovelace" }, "2026-10-22T08:17:06.294Z"),
        record(R2, 1, 5, "a2", { Name: "Grace Hopper" }),
      ],
      nextCursor: CURSOR,
      totalCount: 3,
    },
  },
  {
    id: "read-one",
    title: "Read one record",
    method: "GET",
    path: `/v1/tables/${TBL}/records/${R1}?fields=${F_NAME},${F_ORDERS}`,
    tokenType: "read",
    status: 200,
    response: { record: record(R1, 2, 4, "a1", { Name: "Ada Lovelace", Orders: 13 }, "2026-10-22T08:17:06.294Z") },
  },
  {
    id: "read-one-ids",
    title: "Read one record with field IDs",
    method: "GET",
    path: `/v1/tables/${TBL}/records/${R1}?returnFieldsByFieldId=true`,
    tokenType: "read",
    note: "Field IDs and option IDs instead of names; they don't change when a field or option is renamed. Works on every record endpoint (query string, or \"returnFieldsByFieldId\": true in a JSON body).",
    status: 200,
    response: { record: record(R1, 2, 4, "a1", { [F_ID]: R1, [F_NAME]: "Ada Lovelace", [F_ORDERS]: 13, [F_STATUS]: "opt_active" }, "2026-10-22T08:17:06.294Z") },
  },
  {
    id: "group",
    title: "Group with counts and aggregates",
    method: "POST",
    path: `/v1/tables/${TBL}/records/group`,
    tokenType: "read",
    note: "Aggregate ops: count, sum, avg, min, max, filled, empty, unique. Up to 3 groupBy fields.",
    request: { groupBy: [{ fieldId: F_STATUS }], aggregates: [{ op: "sum", fieldId: F_ORDERS }] },
    status: 200,
    response: {
      groups: [
        { key: '["opt_active"]', value: "Active", values: ["Active"], count: 1, aggregates: { "sum:Orders": 13 } },
        { key: '["opt_lead"]', value: "Lead", values: ["Lead"], count: 1, aggregates: { "sum:Orders": 7 } },
        { key: "[null]", value: null, values: [null], count: 1, aggregates: { "sum:Orders": 3 } },
      ],
    },
  },
  {
    id: "create",
    title: "Create one record",
    method: "POST",
    path: `/v1/tables/${TBL}/records`,
    tokenType: "write",
    note: "Send field names or IDs. typecast also creates a select option that doesn't exist yet.",
    request: { fields: { Name: "Ada Lovelace", Orders: 12, Status: "Active" }, typecast: true },
    status: 201,
    response: { record: record(R1, 1, 4, "a1", { "Record ID": R1, Name: "Ada Lovelace", Orders: 12, Status: "Active" }) },
  },
  {
    id: "batch-create",
    title: "Create up to 500 records",
    method: "POST",
    path: `/v1/tables/${TBL}/records/batch`,
    tokenType: "write",
    request: {
      records: [{ fields: { Name: "Grace Hopper", Orders: 7, Status: "Lead" } }, { fields: { Name: "Alan Turing", Orders: 3 } }],
      typecast: true,
    },
    status: 201,
    response: {
      records: [
        record(R2, 1, 5, "a2", { "Record ID": R2, Name: "Grace Hopper", Orders: 7, Status: "Lead" }),
        record(R3, 1, 6, "a3", { "Record ID": R3, Name: "Alan Turing", Orders: 3 }),
      ],
    },
  },
  {
    id: "update",
    title: "Update one record",
    method: "PATCH",
    path: `/v1/tables/${TBL}/records/${R1}`,
    tokenType: "write",
    note: "Only the fields you send change. version is optional: when sent and the record has changed since, you get 409.",
    request: { fields: { Orders: 13 }, version: 1 },
    status: 200,
    response: { record: record(R1, 2, 4, "a1", { "Record ID": R1, Name: "Ada Lovelace", Orders: 13, Status: "Active" }, "2026-10-22T08:17:06.294Z") },
  },
  {
    id: "batch-update",
    title: "Update up to 500 records",
    method: "PATCH",
    path: `/v1/tables/${TBL}/records/batch`,
    tokenType: "write",
    request: { records: [{ id: R2, fields: { Orders: 8 } }, { id: R3, fields: { Status: "Lead" } }], typecast: true },
    status: 200,
    response: {
      records: [
        record(R2, 2, 5, "a2", { "Record ID": R2, Name: "Grace Hopper", Orders: 8, Status: "Lead" }, "2026-10-22T08:17:06.386Z"),
        record(R3, 2, 6, "a3", { "Record ID": R3, Name: "Alan Turing", Orders: 3, Status: "Lead" }, "2026-10-22T08:17:06.386Z"),
      ],
    },
  },
  {
    id: "delete",
    title: "Delete one record",
    method: "DELETE",
    path: `/v1/tables/${TBL}/records/${R1}`,
    tokenType: "delete",
    note: "No body in the request or the response.",
    status: 204,
  },
  {
    id: "batch-delete",
    title: "Delete up to 500 records",
    method: "POST",
    path: `/v1/tables/${TBL}/records/batch-delete`,
    tokenType: "delete",
    request: { ids: [R2, R3] },
    status: 204,
  },
  {
    id: "version",
    title: "Running version",
    method: "GET",
    path: "/v1/version",
    tokenType: "none",
    status: 200,
    response: { name: "TableOS", version: "0.16.6", commit: "7f47bce", startedAt: "2026-10-22T08:16:19.474Z" },
  },
];

/** Error bodies (application/problem+json); every one carries a requestId to quote in support requests. */
export const API_ERROR_SAMPLES: ApiSample[] = [
  {
    id: "err-validation",
    title: "422: invalid body",
    method: "POST",
    path: `/v1/tables/${TBL}/records/batch`,
    tokenType: "write",
    note: "Sent 501 records.",
    status: 422,
    response: {
      code: "VALIDATION_FAILED",
      title: "Validation failed",
      status: 422,
      detail: "Invalid request body",
      errors: [{ field: "records", message: "At most 500 records per request" }],
      type: "https://tabula.dev/errors/validation-failed",
      requestId: "0f6c0b4e-6a2f-4d2e-9a51-2b1c9d6f4e10",
    },
  },
  {
    id: "err-unknown-field",
    title: "422: unknown field",
    method: "POST",
    path: `/v1/tables/${TBL}/records`,
    tokenType: "write",
    request: { fields: { Nope: 1 } },
    status: 422,
    response: {
      code: "UNKNOWN_FIELD",
      title: "Unknown field",
      status: 422,
      detail: 'Unknown field "Nope"',
      meta: { field: "Nope" },
      type: "https://tabula.dev/errors/unknown-field",
      requestId: "ac725f4f-f5e6-4109-a60e-dcfbd7248a9b",
    },
  },
  {
    id: "err-conflict",
    title: "409: the record changed since you read it",
    method: "PATCH",
    path: `/v1/tables/${TBL}/records/${R1}`,
    tokenType: "write",
    request: { fields: { Orders: 5 }, version: 1 },
    status: 409,
    response: {
      code: "VERSION_CONFLICT",
      title: "Version conflict",
      status: 409,
      detail: "The record was changed by someone else",
      meta: { recordId: R1, currentVersion: 2 },
      type: "https://tabula.dev/errors/version-conflict",
      requestId: "5b1f3c2e-0d4a-4c5e-8f1a-7e2d9b6c3a01",
    },
  },
  {
    id: "err-scope",
    title: "403: the token lacks a type",
    method: "POST",
    path: `/v1/tables/${TBL}/records`,
    tokenType: "read",
    note: "A read-only token tried to create a record.",
    request: { fields: {} },
    status: 403,
    response: {
      code: "FORBIDDEN",
      title: "Forbidden",
      status: 403,
      detail: 'This token doesn\'t have the "write" permission',
      type: "https://tabula.dev/errors/forbidden",
      requestId: "06d3c750-8d65-4ef4-a265-64b6513622b0",
    },
  },
  {
    id: "err-rate",
    title: "429: too many requests",
    method: "GET",
    path: `/v1/tables/${TBL}/records`,
    tokenType: "read",
    note: "More than the plan's requests per second for one token (Free 5, Team 20). The response has a retry-after header in seconds.",
    status: 429,
    response: {
      code: "RATE_LIMITED",
      title: "Too many requests",
      status: 429,
      detail: "This token can make 5 requests per second on your plan. Wait a moment and retry.",
      meta: { limitPerSecond: 5, retryAfterSec: 1 },
      type: "https://tabula.dev/errors/rate-limited",
      requestId: "3c1d8e72-9b40-4f6a-8d25-61e0a7c4b913",
    },
  },
  {
    id: "err-token",
    title: "401: invalid, revoked or expired token",
    method: "POST",
    path: `/v1/tables/${TBL}/records/query`,
    tokenType: "read",
    status: 401,
    response: {
      code: "UNAUTHENTICATED",
      title: "Authentication required",
      status: 401,
      detail: "This API token is invalid, revoked or expired, or the person who made it is no longer an Owner or Admin",
      type: "https://tabula.dev/errors/unauthenticated",
      requestId: "9f79fce1-ba45-42a2-a282-30d7ce322a28",
    },
  },
];
