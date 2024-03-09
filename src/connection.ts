import Database from 'better-sqlite3'
import * as Path from 'node:path/posix'

function init() {
  const options = {}
  const path =
    process.env.NODE_ENV === 'test '
      ? ':memory:'
      : Path.resolve('storage/db.sqlite3')
  const db = new Database(path, options)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')
  db.exec(`
  CREATE TABLE IF NOT EXISTS groups 
    ( id   INTEGER PRIMARY KEY
    , name TEXT
    ) STRICT;

  CREATE TABLE IF NOT EXISTS collections
    ( id       INTEGER PRIMARY KEY
    , group_id INTEGER REFERENCES groups(id) ON DELETE CASCADE
    , name     TEXT
    ) STRICT;

  CREATE UNIQUE INDEX IF NOT EXISTS unique_collection_group on collections(group_id, name);

  CREATE TABLE IF NOT EXISTS records
    ( id      INTEGER
    , group_id      INTEGER REFERENCES groups(id)      ON DELETE CASCADE
    , collection_id INTEGER REFERENCES collections(id) ON DELETE CASCADE
    , data          BLOB CHECK (json_valid(data, 8))
    ) STRICT;
  
  CREATE UNIQUE INDEX IF NOT EXISTS unique_record_group_id ON records(id, group_id, id);
    `)
  return db
}

const db = init()
export default db
