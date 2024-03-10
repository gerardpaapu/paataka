// src/server.ts
import express3 from "express";
import cors from "cors";
import passport2 from "passport";
import { Strategy as BearerStrategy } from "passport-http-bearer";

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
function refreshKey(organisation, code) {
  return connection_default.prepare(
    `
      UPDATE organisations
      SET key = randomblob(8)
      WHERE name = ? AND code = ?
      RETURNING key
    `
  ).pluck().get(organisation, code);
}
function validateKey(key) {
  return connection_default.prepare(
    `
      SELECT name 
      FROM organisations
      WHERE key = ?
      `
  ).pluck().get(key);
}
function addItemToCollection(organisation, collection, value) {
  const res = connection_default.prepare(
    `
      INSERT INTO records (id, collection_id, data) 
      VALUES (1 + IFNULL(
                    (SELECT MAX(r.id)
                     FROM records AS r
                     JOIN collections ON r.collection_id = collections.id 
                     WHERE collections.name = ?
                     AND   collections.organisation_name = ?) 
                  , 0)
              , (SELECT id
                  FROM collections
                  WHERE name = ? and organisation_name = ?)
              , jsonb(?)
              )
      RETURNING id, collection_id      `
  ).get(
    collection,
    organisation,
    collection,
    organisation,
    JSON.stringify(value)
  );
  if (res.collection_id == null) {
    return void 0;
  }
  return res.id;
}
function getItems(org, collection) {
  return connection_default.prepare(
    `
    SELECT records.*, json(data) as json 
    FROM records
    JOIN collections ON collection_id = collections.id
    WHERE collections.organisation_name = ? AND collections.name = ?
  `
  ).all(org, collection).map((row) => {
    const { id, json } = row;
    const obj = JSON.parse(json);
    return { id, ...obj };
  });
}
function getApiKey(organisation, code) {
  const result = connection_default.prepare(
    `
      SELECT key
      FROM organisations
      WHERE name = ?
      AND   code = ?
      `
  ).pluck().get(organisation, code);
  return result;
}

// src/routes/keys.ts
import express from "express";
import { StatusCodes } from "http-status-codes";
var router = express.Router();
router.get("/:organisation", (req, res, next) => {
  try {
    const codeString = req.query.code;
    if (!codeString || typeof codeString !== "string") {
      res.status(StatusCodes.UNAUTHORIZED).json({ error: "Missing code in query string" });
      return;
    }
    const code = Buffer.from(codeString, "base64url");
    const key = getApiKey(req.params.organisation, code);
    if (key != void 0) {
      res.json({ key: key.toString("base64url") });
    }
    res.sendStatus(StatusCodes.NOT_FOUND);
  } catch (e) {
    next(e);
  }
});
router.post("/:organisation", (req, res, next) => {
  const codeString = req.query.code;
  if (!codeString || typeof codeString !== "string") {
    res.status(StatusCodes.UNAUTHORIZED).json({ error: "Missing code in query string" });
    return;
  }
  const code = Buffer.from(codeString, "base64url");
  const key = refreshKey(req.params.organisation, code);
  if (key == void 0) {
    res.sendStatus(StatusCodes.NOT_FOUND);
    return;
  }
  res.json({ key: key.toString("base64url") });
});
var keys_default = router;

// src/routes/data.ts
import express2 from "express";
import passport from "passport";
import { StatusCodes as StatusCodes2 } from "http-status-codes";
var router2 = express2.Router();
router2.use(passport.authenticate("bearer", { session: false }));
router2.post("/:organisation/:collection", (req, res, next) => {
  const { organisation, collection } = req.params;
  const body = req.body;
  if (!req.user || req.user !== organisation) {
    res.status(StatusCodes2.UNAUTHORIZED).send({ error: "Invalid or missing bearer token" });
    return;
  }
  if (!body || typeof body !== "object") {
    res.status(StatusCodes2.UNPROCESSABLE_ENTITY).json({ error: "Invalid JSON body" });
    return;
  }
  const id = addItemToCollection(organisation, collection, req.body);
  if (!id) {
    res.sendStatus(StatusCodes2.NOT_FOUND);
    return;
  }
  const location = `/api/_/${organisation}/${collection}/${id}`;
  res.setHeader("Location", location);
  res.status(StatusCodes2.CREATED).json({ "@self": location, id });
});
router2.get("/:organisation/:collection", (req, res, next) => {
  const { organisation, collection } = req.params;
  if (!req.user || req.user !== organisation) {
    res.status(StatusCodes2.UNAUTHORIZED).send({ error: "Invalid or missing bearer token" });
    return;
  }
  const data = getItems(organisation, collection);
  res.json(data);
});
var data_default = router2;

// src/server.ts
var app = express3();
app.use(cors("*"));
app.use(express3.json());
passport2.use(
  new BearerStrategy((token, cb) => {
    process.nextTick(() => {
      try {
        const key = Buffer.from(token, "base64url");
        const organisation = validateKey(key);
        if (!organisation) {
          return cb(null, false);
        }
        return cb(null, organisation);
      } catch (err) {
        return cb(err);
      }
    });
  })
);
app.use("/api/keys", keys_default);
app.use("/api/_", data_default);
var server_default = app;

// src/index.ts
var PORT = process.env.PORT || 3e3;
server_default.listen(PORT, () => {
  console.log(`listening on http://localhost:${PORT}`);
});
