// src/server.ts
import express4 from "express";
import cors from "cors";

// src/routes/keys.ts
import express from "express";
import { StatusCodes } from "http-status-codes";

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
function getOrganisationByName(name) {
  return connection_default.prepare("SELECT * FROM organisations WHERE name = ?").get(name);
}
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
function createCollection(organisation, name) {
  const res = connection_default.prepare("INSERT INTO collections (organisation_name, name) VALUES (?, ?)").run(organisation, name);
  return res.lastInsertRowid;
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
  const items = connection_default.prepare(
    `
    SELECT records.*, json(data) as json
    FROM collections
    LEFT OUTER JOIN records ON records.collection_id = collections.id
    WHERE collections.organisation_name = ? AND collections.name = ?
  `
  ).all(org, collection);
  if (items.length === 0) {
    return void 0;
  }
  if (items.length === 1 && items[0].data == void 0) {
    return [];
  }
  return items.map((row) => {
    const { json, id } = row;
    return { id, ...JSON.parse(json) };
  });
}
function getById(org, collection, id) {
  const row = connection_default.prepare(
    `
      SELECT records.*, json(data) as json 
      FROM records
      JOIN collections ON collection_id = collections.id
      WHERE records.id = ?
      AND collections.organisation_name = ?
      AND collections.name = ?
`
  ).get(id, org, collection);
  if (!row) {
    return void 0;
  }
  const json = row.json;
  const _id = row.id;
  return {
    id: _id,
    ...JSON.parse(json)
  };
}
function replaceById(org, collection, id, value) {
  const result = connection_default.prepare(
    `
    UPDATE records
    SET data = jsonb(?)
    WHERE id = ?
    AND collection_id = (
        SELECT id
        FROM collections
        WHERE name = ? 
        AND organisation_name = ?)
    `
  ).run(JSON.stringify(value), id, collection, org);
  return result.changes === 1;
}
function patchById(org, collection, id, value) {
  const result = connection_default.prepare(
    `
  UPDATE records
  SET data = jsonb_patch(data, ?)
  WHERE id = ?
  AND collection_id = (
    SELECT id
    FROM collections
    WHERE name = ? 
    AND organisation_name = ?)
  `
  ).run(JSON.stringify(value), id, collection, org);
  return result.changes === 1;
}
function deleteById(org, collection, id) {
  const result = connection_default.prepare(
    `
    DELETE
    FROM records
    WHERE id = ?
    AND collection_id = (SELECT id
      FROM collections
      WHERE name = ?
      AND organisation_name = ?)
    `
  ).run(id, collection, org);
  return result.changes === 1;
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
function getCollectionSummary(organisation) {
  const rows = connection_default.prepare(
    `
    SELECT name, COUNT(records.id) as count
    FROM collections
    LEFT OUTER JOIN records ON records.collection_id = collections.id
    WHERE collections.organisation_name = ?
    GROUP BY collections.id
  `
  ).all(organisation);
  return rows;
}

// src/routes/keys.ts
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

// src/routes/org.ts
import express2 from "express";
import { StatusCodes as StatusCodes2 } from "http-status-codes";
var router2 = express2.Router();
var org_default = router2;
router2.get("/:organisation", (req, res, next) => {
  const { organisation } = req.params;
  const { code } = req.query;
  const org = getOrganisationByName(organisation);
  if (!org) {
    res.sendStatus(StatusCodes2.NOT_FOUND);
    return;
  }
  if (code !== org.code.toString("base64url")) {
    res.sendStatus(StatusCodes2.UNAUTHORIZED);
    return;
  }
  const summary = getCollectionSummary(organisation);
  res.json({
    name: org.name,
    key: org.key.toString("base64url"),
    collections: summary
  });
});
router2.post("/:organisation/key", (req, res, next) => {
  const { organisation } = req.params;
  const { code } = req.query;
  const org = getOrganisationByName(organisation);
  if (!org) {
    res.sendStatus(StatusCodes2.NOT_FOUND);
    return;
  }
  if (code !== org.code.toString("base64url")) {
    res.sendStatus(StatusCodes2.UNAUTHORIZED);
    return;
  }
  refreshKey(organisation, org.code);
  res.sendStatus(StatusCodes2.CREATED);
});
router2.post("/:organisation/seed", (req, res, next) => {
  const { organisation } = req.params;
  const { code } = req.query;
  const org = getOrganisationByName(organisation);
  if (!org) {
    res.sendStatus(StatusCodes2.NOT_FOUND);
    return;
  }
  if (code !== org.code.toString("base64url")) {
    res.sendStatus(StatusCodes2.UNAUTHORIZED);
    return;
  }
  for (const [key, value] of Object.entries(req.body)) {
    if (!Array.isArray(value)) {
      continue;
    }
    try {
      createCollection(organisation, key);
    } catch (e) {
    }
    for (const item of value) {
      addItemToCollection(organisation, key, item);
    }
  }
  res.sendStatus(StatusCodes2.CREATED);
});

// src/routes/data.ts
import express3 from "express";
import { StatusCodes as StatusCodes3 } from "http-status-codes";

// src/auth.ts
import passport from "passport";
import { Strategy as BearerStrategy } from "passport-http-bearer";
passport.use(
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
function checkBearer() {
  return passport.authenticate("bearer", { session: false });
}

// src/routes/data.ts
var router3 = express3.Router();
router3.use(checkBearer());
router3.post("/:organisation/:collection", (req, res, next) => {
  const { organisation, collection } = req.params;
  const body = req.body;
  if (!req.user || req.user !== organisation) {
    res.status(StatusCodes3.UNAUTHORIZED).send({ error: "Invalid or missing bearer token" });
    return;
  }
  if (!body || typeof body !== "object") {
    res.status(StatusCodes3.UNPROCESSABLE_ENTITY).json({ error: "Invalid JSON body" });
    return;
  }
  const id = addItemToCollection(organisation, collection, req.body);
  if (!id) {
    res.sendStatus(StatusCodes3.NOT_FOUND);
    return;
  }
  const location = `/api/_/${organisation}/${collection}/${id}`;
  res.setHeader("Location", location);
  res.status(StatusCodes3.CREATED).json({ "@self": location, id });
});
router3.get("/:organisation/:collection", (req, res, next) => {
  const { organisation, collection } = req.params;
  if (!req.user || req.user !== organisation) {
    res.status(StatusCodes3.UNAUTHORIZED).send({ error: "Invalid or missing bearer token" });
    return;
  }
  const data = getItems(organisation, collection);
  if (data == void 0) {
    res.sendStatus(StatusCodes3.NOT_FOUND);
    return;
  }
  res.json(data);
});
router3.get("/:organisation/:collection/:id", (req, res, next) => {
  const { organisation, collection, id } = req.params;
  if (!req.user || req.user !== organisation) {
    res.status(StatusCodes3.UNAUTHORIZED).send({ error: "Invalid or missing bearer token" });
    return;
  }
  const _id = parseInt(id, 10);
  if (isNaN(_id)) {
    res.sendStatus(StatusCodes3.NOT_FOUND);
    return;
  }
  const data = getById(organisation, collection, _id);
  if (!data) {
    res.sendStatus(StatusCodes3.NOT_FOUND);
    return;
  }
  res.json(data);
});
router3.put("/:organisation/:collection/:id", (req, res, next) => {
  const { organisation, collection, id } = req.params;
  if (!req.user || req.user !== organisation) {
    res.status(StatusCodes3.UNAUTHORIZED).send({ error: "Invalid or missing bearer token" });
    return;
  }
  const _id = parseInt(id, 10);
  if (isNaN(_id)) {
    res.sendStatus(StatusCodes3.NOT_FOUND);
    return;
  }
  const success = replaceById(organisation, collection, _id, req.body);
  if (!success) {
    res.sendStatus(StatusCodes3.NOT_FOUND);
    return;
  }
  res.sendStatus(StatusCodes3.NO_CONTENT);
});
router3.patch("/:organisation/:collection/:id", (req, res, next) => {
  const { organisation, collection, id } = req.params;
  if (!req.user || req.user !== organisation) {
    res.status(StatusCodes3.UNAUTHORIZED).send({ error: "Invalid or missing bearer token" });
    return;
  }
  const _id = parseInt(id, 10);
  if (isNaN(_id)) {
    res.sendStatus(StatusCodes3.NOT_FOUND);
    return;
  }
  const success = patchById(organisation, collection, _id, req.body);
  if (!success) {
    res.sendStatus(StatusCodes3.NOT_FOUND);
    return;
  }
  res.sendStatus(StatusCodes3.NO_CONTENT);
});
router3.delete("/:organisation/:collection/:id", (req, res, next) => {
  const { organisation, collection, id } = req.params;
  if (!req.user || req.user !== organisation) {
    res.status(StatusCodes3.UNAUTHORIZED).send({ error: "Invalid or missing bearer token" });
    return;
  }
  const _id = parseInt(id, 10);
  if (isNaN(_id)) {
    res.sendStatus(StatusCodes3.NOT_FOUND);
    return;
  }
  const success = deleteById(organisation, collection, _id);
  if (!success) {
    res.sendStatus(StatusCodes3.NOT_FOUND);
    return;
  }
  res.sendStatus(StatusCodes3.NO_CONTENT);
});
var data_default = router3;

// src/server.ts
var app = express4();
app.use(cors("*"));
app.use(express4.json());
app.use("/api/keys", keys_default);
app.use("/api/org", org_default);
app.use("/api/_", data_default);
var server_default = app;

// src/index.ts
var PORT = process.env.PORT || 3e3;
server_default.listen(PORT, () => {
  console.log(`listening on http://localhost:${PORT}`);
});
