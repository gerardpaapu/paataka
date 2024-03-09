import Database from "better-sqlite3";
import * as Path from "node:path/posix";

function init() {
  const options = {};
  const path =
    process.env.NODE_ENV === "test"
      ? ":memory:"
      : Path.resolve("storage/db.sqlite3");
  const db = new Database(path, options);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.exec(`
  CREATE TABLE IF NOT EXISTS organisations 
    ( id   INTEGER PRIMARY KEY
    , code  BLOB DEFAULT (randomblob(16))
    , key   BLOB DEFAULT (randomblob(8))
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
  return db;
}

const db = init();
export default db;
