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
  db.pragma("synchronous = NORMAL");
  db.pragma("foreign_keys = ON");
  db.pragma("busy_timeout = 5000");

  db.exec(`
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
    , last_id           INTEGER DEFAULT 0
    , count             INTEGER DEFAULT 0
    ) STRICT;

  CREATE UNIQUE INDEX IF NOT EXISTS unique_collection_group on collections(organisation_name, name);

  CREATE TABLE IF NOT EXISTS records
    ( id              INTEGER
    , collection_id   INTEGER REFERENCES collections(id) ON DELETE CASCADE
    , data            BLOB CHECK (json_valid(data, 8))
    ) STRICT;
  
  CREATE UNIQUE INDEX IF NOT EXISTS unique_record_group_id ON records(id, collection_id);

  CREATE TRIGGER IF NOT EXISTS record_insert_trigger
  AFTER INSERT ON records
  BEGIN
     UPDATE collections SET count = count + 1
                          , last_id = last_id + 1
     WHERE collections.id = NEW.collection_id;
  END;

  CREATE TRIGGER IF NOT EXISTS record_delete_trigger
  AFTER DELETE ON records
  BEGIN
     UPDATE collections SET count = count - 1
     WHERE collections.id = OLD.collection_id;
  END;
  `);
  return db;
}

const db = init();
export default db;
