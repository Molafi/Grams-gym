// A small copy of the old gym program's database for the sync end-to-end test
// (.github/workflows/sync-e2e.yml). Column names follow lib/sync/legacy-schema.ts.
//   node fixture.mjs          → schema, read-only login and data (SQL on stdout)
//   node fixture.mjs changes  → what staff do next in the program: unfreeze, renew, add a member
const mode = process.argv[2] ?? "initial";
const out = [];
const sql = (s) => out.push(s);
const str = (v) => (v === null || v === undefined ? "NULL" : `'${String(v).replace(/\\/g, "\\\\").replace(/'/g, "''")}'`);
const day = (n) => `DATE_ADD(CURDATE(), INTERVAL ${n} DAY)`;

const SUB_COLS = "(ID, MemberID, ProgramID, Status, `From`, `To`, IsFree, Amount, OfferID, Freezed, FreezeTo)";
const sub = (id, member, program, from, to, { offer = null, frozen = 0 } = {}) =>
  `(${id}, ${member}, ${program}, 1, ${day(from)}, ${day(to)}, 0, '40.00000', ${offer ?? "NULL"}, ${frozen}, ${frozen ? day(5) : "NULL"})`;

function insert(table, cols, rows) {
  for (let i = 0; i < rows.length; i += 400) sql(`INSERT INTO ${table} ${cols} VALUES\n${rows.slice(i, i + 400).join(",\n")};`);
}

if (mode === "changes") {
  sql("UPDATE subscriptions SET Freezed = 0, FreezeTo = NULL WHERE MemberID = 3;");
  insert("subscriptions", SUB_COLS, [sub(90001, 2, 3, 246, 611)]);
  insert("members", "(ID, Number, Name, Gender, Mobile, Status)", [`(9000, '04867', 'New At Desk', 1, '0791000099', 1)`]);
  insert("subscriptions", SUB_COLS, [sub(90002, 9000, 1, 0, 30)]);
  console.log(out.join("\n"));
  process.exit(0);
}

sql("SET NAMES utf8mb4;");
sql(`CREATE TABLE members (ID INT PRIMARY KEY, OldID VARCHAR(20), Number VARCHAR(20), Name VARCHAR(120), NameX VARCHAR(120),
  PersonalID VARCHAR(30), Gender TINYINT, Birthdate DATE, Phone VARCHAR(30), Mobile VARCHAR(30), Status TINYINT, Photo LONGBLOB) DEFAULT CHARSET=utf8mb4;`);
sql(`CREATE TABLE programs (ID INT PRIMARY KEY, Name VARCHAR(120), NumDays SMALLINT, NumVisits SMALLINT, Price DECIMAL(10,5),
  MaxDiscount DECIMAL(10,5), FreezeDays SMALLINT, Active TINYINT) DEFAULT CHARSET=utf8mb4;`);
sql(`CREATE TABLE offers (ID INT PRIMARY KEY, Name VARCHAR(120), ProgramID INT, NumDays SMALLINT, NumVisits SMALLINT, PlusMinus TINYINT,
  Discount SMALLINT, Expiry DATETIME) DEFAULT CHARSET=utf8mb4;`);
sql(`CREATE TABLE subscriptions (ID INT PRIMARY KEY, MemberID INT, ProgramID INT, Status TINYINT, WhichTime DATETIME, \`From\` DATE, \`To\` DATE,
  VisitsCount SMALLINT, IsFree TINYINT, Payment TINYINT, Amount DECIMAL(10,5), Discount DECIMAL(10,5), Tax DECIMAL(10,5), Price DECIMAL(10,5),
  Paid DECIMAL(10,5), OfferID INT, Freezed TINYINT, FreezeTo DATE) DEFAULT CHARSET=utf8mb4;`);
sql("CREATE TABLE subscriptionsx LIKE subscriptions;");
sql(`CREATE TABLE freezes (ID INT PRIMARY KEY, SubscriptionID INT, FreezeFrom DATE, FreezeTo DATE, FreezeDays SMALLINT, FreezeFees DECIMAL(10,5),
  Payment TINYINT, Active TINYINT) DEFAULT CHARSET=utf8mb4;`);
// Read-only login, like the one on the gym PC.
sql("CREATE USER 'ggsync'@'%' IDENTIFIED BY 'ggsync-ci';");
sql("GRANT SELECT ON gymgdata.* TO 'ggsync'@'%';");

insert("programs", "(ID, Name, NumDays, Price, Active)", [`(1, '1 Month 40', 30, '40.00000', 1)`, `(2, '3 Month 100', 90, '100.00000', 1)`, `(3, '1 Year 320', 365, '320.00000', 1)`]);
insert("offers", "(ID, Name, ProgramID, Discount)", [`(1, '20%', 3, 20)`]);

const members = [
  [1, "03664", "عمرو بسام راشد", "0795757237"],
  [2, "04529", "احمد الراشد", "0797079236"],
  [3, "02119", "Frozen Member", "0791000001"],
  [4, "04866", "No Membership", "0791000002"],
  [5, "", "No Number", "0791000005"],
  [6, "00003", "Clashes With Demo", "0791000003"],
  [7, "00777", "Long History", "0791000007"],
  [8, "00042", "Shared Phone", "0797079236"],
].map(([id, number, name, mobile]) => `(${id}, ${str(number)}, ${str(name)}, 1, ${str(mobile)}, 1, '12345678')`);
const bulk = [];
for (let i = 0; i < 1200; i++) bulk.push(`(${100 + i}, '${10000 + i}', 'Member ${10000 + i}', 1, '078${String(1000000 + i).padStart(7, "0")}', 1, '12345678')`);
insert("members", "(ID, Number, Name, Gender, Mobile, Status, Photo)", [...members, ...bulk]);

const live = [
  sub(1, 1, 1, -5, 25), // 03664 active
  sub(2, 2, 3, -120, 245, { offer: 1 }), // 04529 active, yearly with an offer
  sub(3, 3, 1, -10, 20, { frozen: 1 }), // 02119 frozen
  sub(4, 6, 1, -3, 27), // 00003 active (a demo account has this number on the website)
  sub(5, 7, 1, -3, 27), // 00777 current period
  sub(6, 8, 1, -90, -60), // 00042 expired
];
const archive = [];
// 00777: 30 earlier months; only those that ended within the last year are copied.
for (let k = 0; k < 30; k++) (k < 6 ? live : archive).push(sub((k < 6 ? 10 : 20) + k, 7, 1, -(30 * (k + 1) + 3), -(30 * k + 4)));
archive.push(sub(99, 7, 1, -33, -4)); // the same period as live ID 10, in both tables
for (let i = 0; i < 1200; i++) {
  const member = 100 + i;
  if (i % 4 === 0) live.push(sub(1000 + i, member, 1, -10, 20));
  if (i % 4 === 1) live.push(sub(1000 + i, member, 1, -90, -60));
  if (i % 4 === 2) {
    live.push(sub(1000 + i, member, 3, -100, 265));
    archive.push(sub(5000 + i, member, 3, -465, -101));
  }
  if (i % 4 === 3) live.push(sub(1000 + i, member, 1, -10, 20, { frozen: 1 }));
}
insert("subscriptions", SUB_COLS, live);
insert("subscriptionsx", SUB_COLS, archive);
insert("freezes", "(ID, SubscriptionID, FreezeFrom, FreezeTo, FreezeDays, Active)", [`(1, 3, ${day(-2)}, ${day(5)}, 7, 1)`]);

console.log(out.join("\n"));
