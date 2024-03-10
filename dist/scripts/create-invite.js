// src/connection.ts
import Database from "better-sqlite3";
import * as Path from "node:path/posix";
function init() {
  const options = {};
  const path = process.env.NODE_ENV === "test" ? ":memory:" : Path.resolve("storage/db.sqlite3");
  const db2 = new Database(path, options);
  db2.pragma("journal_mode = WAL");
  db2.pragma("foreign_keys = ON");
  db2.exec(`
  CREATE TABLE IF NOT EXISTS organisations 
    ( id   INTEGER PRIMARY KEY
    , code  BLOB DEFAULT (randomblob(16))
    , key   BLOB DEFAULT (randomblob(8)) UNIQUE
    , name TEXT UNIQUE
    ) STRICT;

  CREATE TABLE IF NOT EXISTS collections
    ( id                INTEGER PRIMARY KEY
    , organisation_name TEXT REFERENCES organisations(name) ON DELETE CASCADE
    , name              TEXT
    ) STRICT;

  CREATE UNIQUE INDEX IF NOT EXISTS unique_collection_group on collections(organisation_name, name);

  CREATE TABLE IF NOT EXISTS records
    ( id              INTEGER
    , collection_id   INTEGER REFERENCES collections(id) ON DELETE CASCADE
    , data            BLOB CHECK (json_valid(data, 8))
    ) STRICT;
  
  CREATE UNIQUE INDEX IF NOT EXISTS unique_record_group_id ON records(id, collection_id);
  `);
  return db2;
}
var db = init();
var connection_default = db;

// src/db.ts
function getOrganisation(id2) {
  return connection_default.prepare("SELECT * FROM organisations WHERE id = ?").get(id2);
}
function createOrganisation(name) {
  const res = connection_default.prepare("INSERT INTO organisations (name) VALUES (?)").run(name);
  return res.lastInsertRowid;
}

// src/scripts/create-invite.ts
var [_0, _1, groupName] = process.argv;
if (!groupName) {
  throw new Error();
}
var id = createOrganisation(groupName);
var { code } = getOrganisation(id);
var codeString = code.toString("base64url");
process.stdout.write(`${groupName}	${codeString}
`);
