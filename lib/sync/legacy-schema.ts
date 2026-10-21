/**
 * Mirror schema for the legacy GRAMS GYM desktop database (`gymgdata`, MySQL/MariaDB
 * on the gym PC). The sync agent (sync/agent) reads these tables over a read-only
 * MySQL login and posts batches to /api/sync/legacy, which stores them verbatim in
 * Postgres tables named `legacy_<table>`.
 *
 * Design notes
 * ─────────────
 * • Faithful copy: column names/types mirror the source as closely as Postgres allows.
 *   Money is numeric(14,5) (source is decimal(10,5)); dates/datetimes keep their local
 *   wall-clock value (no timezone shifting — the source stores Asia/Amman local time).
 * • `src_id` is the source row's integer primary key; upserts are ON CONFLICT (src_id).
 * • BLOB columns (member/staff Photo, fingerprint templates, free-text Notes/Address)
 *   are intentionally NOT mirrored — they are large and/or sensitive. The `users`
 *   (app-login password hashes) and biometric `prints`/`sprints` tables are skipped
 *   entirely for the same reason.
 * • Adding a table later = add an entry here and list it in sync/agent/config.json.
 */

export type PgType = "id" | "int" | "small" | "num" | "text" | "date" | "ts" | "time";

export const PG_TYPE_SQL: Record<PgType, string> = {
  id: "bigint",
  int: "bigint",
  small: "integer",
  num: "numeric(14,5)",
  text: "text",
  date: "date",
  ts: "timestamp",
  time: "time",
};

export interface MirrorTable {
  /** Source primary-key column (always "ID" in this database). */
  pk: string;
  /** [sourceColumnName, pgType] — blob columns are omitted on purpose. */
  columns: [string, PgType][];
}

/** Postgres-friendly column name for a source column (also handles reserved words). */
export function normalizeCol(src: string): string {
  const overrides: Record<string, string> = {
    From: "from_date",
    To: "to_date",
    Desc: "descr",
    "E-mail": "email",
    "Job Title": "job_title",
  };
  if (overrides[src]) return overrides[src];
  return src
    .replace(/[^0-9a-zA-Z]+/g, "_")
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "")
    .toLowerCase();
}

const SUBSCRIPTION_COLUMNS: [string, PgType][] = [
  ["MemberID", "int"],
  ["ProgramID", "int"],
  ["Status", "small"],
  ["WhichTime", "ts"],
  ["From", "date"],
  ["To", "date"],
  ["VisitsCount", "small"],
  ["IsFree", "small"],
  ["Payment", "small"],
  ["Amount", "num"],
  ["Discount", "num"],
  ["Tax", "num"],
  ["Price", "num"],
  ["Paid", "num"],
  ["OfferID", "int"],
  ["Freezed", "small"],
  ["FreezeTo", "date"],
];

export const MIRROR: Record<string, MirrorTable> = {
  members: {
    pk: "ID",
    columns: [
      ["OldID", "text"],
      ["Number", "text"],
      ["Name", "text"],
      ["NameX", "text"],
      ["PersonalID", "text"],
      ["NationalityID", "int"],
      ["Job Title", "text"],
      ["FirstDate", "date"],
      ["TrainerID", "int"],
      ["Gender", "small"],
      ["Birthdate", "date"],
      ["Phone", "text"],
      ["Mobile", "text"],
      ["E-mail", "text"],
      ["Emergency1", "text"],
      ["Emergency2", "text"],
      ["Status", "small"],
    ],
  },
  programs: {
    pk: "ID",
    columns: [
      ["Name", "text"],
      ["NumDays", "small"],
      ["NumVisits", "small"],
      ["Price", "num"],
      ["MaxDiscount", "num"],
      ["FreezeDays", "small"],
      ["Active", "small"],
    ],
  },
  offers: {
    pk: "ID",
    columns: [
      ["Name", "text"],
      ["ProgramID", "int"],
      ["NumDays", "small"],
      ["NumVisits", "small"],
      ["PlusMinus", "small"],
      ["Discount", "small"],
      ["Expiry", "ts"],
    ],
  },
  subscriptions: { pk: "ID", columns: SUBSCRIPTION_COLUMNS },
  subscriptionsx: { pk: "ID", columns: SUBSCRIPTION_COLUMNS },
  clocks: {
    pk: "ID",
    columns: [
      ["Type", "small"],
      ["Who", "int"],
      ["WhichTime", "ts"],
      ["GuestID", "int"],
      ["DayUse", "small"],
      ["Flags", "text"],
    ],
  },
  attendance: {
    pk: "ID",
    columns: [
      ["Type", "small"],
      ["Who", "int"],
      ["WhichTime", "ts"],
      ["Flags", "text"],
    ],
  },
  payments: {
    pk: "ID",
    columns: [
      ["UserID", "int"],
      ["Type", "small"],
      ["Method", "small"],
      ["WhichTime", "ts"],
      ["MemberID", "int"],
      ["SubscriptionID", "int"],
      ["Program", "text"],
      ["Offer", "text"],
      ["ClocksID", "int"],
      ["Amount", "num"],
      ["Payment", "num"],
      ["Paid", "small"],
      ["PaidTo", "int"],
      ["TimePaid", "ts"],
      ["Confirmed", "small"],
      ["ConfirmedBy", "int"],
      ["TimeConfirmed", "ts"],
      ["Flags", "text"],
    ],
  },
  freezes: {
    pk: "ID",
    columns: [
      ["SubscriptionID", "int"],
      ["FreezeFrom", "date"],
      ["FreezeTo", "date"],
      ["FreezeDays", "small"],
      ["FreezeFees", "num"],
      ["Payment", "small"],
      ["Active", "small"],
    ],
  },
  staff: {
    pk: "ID",
    columns: [
      ["Number", "text"],
      ["Name", "text"],
      ["PersonalID", "text"],
      ["NationalityID", "int"],
      ["JobTitleID", "int"],
      ["ContractID", "int"],
      ["ShiftID", "int"],
      ["Gender", "small"],
      ["Birthdate", "date"],
      ["Phone", "text"],
      ["Mobile", "text"],
      ["E-mail", "text"],
      ["Salary", "num"],
      ["WorkHours", "small"],
      ["Status", "small"],
    ],
  },
  guests: {
    pk: "ID",
    columns: [
      ["Name", "text"],
      ["NameX", "text"],
      ["WhichTime", "ts"],
      ["Reference", "text"],
      ["Gender", "small"],
      ["Phone", "text"],
      ["Mobile", "text"],
      ["E-mail", "text"],
    ],
  },
  dayuse: {
    pk: "ID",
    columns: [
      ["Name", "text"],
      ["NameX", "text"],
      ["WhichTime", "ts"],
      ["MemberID", "int"],
      ["Payment", "num"],
      ["Gender", "small"],
      ["Phone", "text"],
      ["Mobile", "text"],
      ["E-mail", "text"],
    ],
  },
  nationalities: { pk: "ID", columns: [["Name", "text"]] },
  jobtitles: { pk: "ID", columns: [["Name", "text"]] },
  contracts: { pk: "ID", columns: [["Name", "text"]] },
  shifts: {
    pk: "ID",
    columns: [
      ["Name", "text"],
      ["FromTime", "time"],
      ["ToTime", "time"],
      ["BreakFrom", "time"],
      ["BreakTo", "time"],
    ],
  },
  messages_log: {
    pk: "ID",
    columns: [
      ["Type", "small"],
      ["Lang", "small"],
      ["Mobile", "text"],
      ["MsgText", "text"],
      ["Result", "text"],
      ["CreatedOn", "ts"],
    ],
  },
  campaigns: {
    pk: "ID",
    columns: [
      ["Name", "text"],
      ["WhenDate", "ts"],
      ["ArText", "text"],
      ["EnText", "text"],
      ["CountAll", "small"],
      ["CountFailed", "small"],
      ["CountDND", "small"],
      ["CreatedOn", "ts"],
    ],
  },
  lists: {
    pk: "ID",
    columns: [
      ["CampaignID", "int"],
      ["MemberID", "int"],
      ["MemberNumber", "text"],
      ["MemberName", "text"],
      ["MemberMobile", "text"],
    ],
  },
  events: {
    pk: "ID",
    columns: [
      ["Name", "text"],
      ["Active", "small"],
      ["ArText", "text"],
      ["EnText", "text"],
    ],
  },
  expenses: {
    pk: "ID",
    columns: [
      ["EntryDate", "date"],
      ["CategoryID", "int"],
      ["ItemID", "int"],
      ["ItemName", "text"],
      ["Amount", "num"],
      ["Payment", "small"],
      ["Who", "int"],
      ["WhichTime", "ts"],
    ],
  },
  expenses_categories: { pk: "ID", columns: [["Name", "text"]] },
  expenses_items: {
    pk: "ID",
    columns: [
      ["CategoryID", "int"],
      ["Name", "text"],
      ["Recurring", "small"],
    ],
  },
  transactions: {
    pk: "ID",
    columns: [
      ["WhichTime", "ts"],
      ["AccountID", "int"],
      ["Amount", "num"],
    ],
  },
  accounts: {
    pk: "ID",
    columns: [
      ["Parent", "int"],
      ["Number", "text"],
      ["Name", "text"],
      ["Level", "small"],
      ["Type", "small"],
    ],
  },
  variables: {
    pk: "ID",
    columns: [
      ["Desc", "text"],
      ["Var", "text"],
    ],
  },
};

export const MIRROR_TABLES = Object.keys(MIRROR);

/** Guard: a Postgres identifier we build ourselves is only ever [a-z0-9_]. */
export function assertIdent(name: string): string {
  if (!/^[a-z_][a-z0-9_]*$/.test(name)) throw new Error(`unsafe identifier: ${name}`);
  return name;
}
