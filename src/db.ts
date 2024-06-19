import connection from "./connection.ts";
import { compileExpr } from "./expr/index.ts";
import { Collection, Organisation, OrganisationWithSecrets } from "./models.ts";

export function reset() {
  return connection.exec("DELETE FROM organisations");
}

const GET_ORG_QUERY = connection.prepare(
  "SELECT * FROM organisations WHERE id = ? LIMIT 1",
);
export function getOrganisation(id: number | bigint) {
  return GET_ORG_QUERY.get(id) as OrganisationWithSecrets;
}

const GET_ORG_BY_NAME_QUERY = connection.prepare(
  "SELECT * FROM organisations WHERE name = ? LIMIT 1",
);
export function getOrganisationByName(name: string) {
  return GET_ORG_BY_NAME_QUERY.get(name) as OrganisationWithSecrets;
}
const REFRESH_KEY_QUERY = connection.prepare(
  `
  UPDATE organisations
  SET key = randomblob(8)
  WHERE name = ? AND code = ?
  RETURNING key
`,
);
export function refreshKey(organisation: string, code: Buffer) {
  return REFRESH_KEY_QUERY.pluck().get(organisation, code) as
    | Buffer
    | undefined;
}

const VALIDATE_KEY_QUERY = connection.prepare(
  `SELECT name FROM organisations WHERE key = ?`,
);
export function validateKey(key: Buffer) {
  return VALIDATE_KEY_QUERY.pluck().get(key) as string;
}

const GET_ORGANISATIONS_QUERY = connection.prepare(
  "SELECT id, name FROM organisations ORDER BY id",
);
export function getOrganisations() {
  return GET_ORGANISATIONS_QUERY.all() as Organisation[];
}

const CREATE_ORGANISATION_QUERY = connection.prepare(
  "INSERT INTO organisations (name) VALUES (?)",
);
export function createOrganisation(name: string) {
  const res = CREATE_ORGANISATION_QUERY.run(name);
  return res.lastInsertRowid;
}

const DELETE_ORGANISATION_QUERY = connection.prepare(
  "DELETE FROM organisations WHERE name = ?",
);
export function deleteOrganisation(name: string) {
  const res = DELETE_ORGANISATION_QUERY.run(name);
  return res.changes === 1;
}

const DELETE_COLLECTION_QUERY = connection.prepare(
  `DELETE FROM collections
   WHERE collections.organisation_name = ?
   AND collections.name = ?`,
);

export function deleteCollection(
  organisation_name: string,
  collection: string,
) {
  return (
    DELETE_COLLECTION_QUERY.run(organisation_name, collection).changes == 1
  );
}

const GET_COLLECTIONS_QUERY = connection.prepare(
  "SELECT id, organisation_name, name FROM collections WHERE organisation_name = ?",
);
export function getCollections(organisation: string) {
  return GET_COLLECTIONS_QUERY.all(organisation) as Collection[];
}

const CREATE_COLLECTION_QUERY = connection.prepare(
  "INSERT INTO collections (organisation_name, name) VALUES (?, ?)",
);

export function createCollection(organisation: string, name: string) {
  const res = CREATE_COLLECTION_QUERY.run(organisation, name);
  return res.lastInsertRowid;
}

const ADD_ITEM_QUERY = connection.prepare(
  `INSERT INTO records (id, collection_id, data)
   SELECT (last_id + 1), id, jsonb(?)
   FROM  collections
   WHERE collections.name = ?
   AND   collections.organisation_name = ?
   RETURNING id, collection_id`,
);

export function addItemToCollection(
  organisation: string,
  collection: string,
  value: Record<string, any>,
) {
  const res = ADD_ITEM_QUERY.get(
    JSON.stringify(value),
    collection,
    organisation,
  );

  if (res == undefined || (res as any).collection_id == null) {
    return undefined;
  }
  return (res as any).id as number;
}

export interface Features {
  where?: string;
  orderBy?: string;
  dir?: "asc" | "desc";
  itemsPerPage?: number;
  page?: number;
}

interface PagingInfo {
  page: number;
  pageCount: number;
  itemsPerPage: number;
}

const GET_ITEMS_QUERY_PAGED = connection.prepare(`
SELECT records.id as id,
       records.data,
       json(data) as json,
       collections.count as count
FROM collections
JOIN records
  ON records.collection_id = collections.id
 AND collections.organisation_name = ?
 AND collections.name = ?
 LIMIT ? OFFSET ?
`);

const GET_ITEMS_QUERY = connection.prepare(`
SELECT records.id as id,
       records.data,
       json(data) as json,
       collections.count as count
FROM collections
JOIN records
  ON records.collection_id = collections.id
 AND collections.organisation_name = ?
 AND collections.name = ?
`);

export function getItems(org: string, collection: string, features?: Features) {
  let WHERE = { sql: "", params: [] as unknown[] };
  if (features?.where) {
    const { sql, params } = compileExpr(features.where);
    WHERE = {
      sql: `WHERE (${sql})\n`,
      params,
    };
  }

  let ORDER_BY = { sql: "", params: [] as unknown[] };
  if (features?.orderBy) {
    const { sql, params } = compileExpr(features.orderBy);
    const dir = features?.dir?.toLocaleLowerCase() === "desc" ? "DESC" : "ASC";
    ORDER_BY = {
      sql: `ORDER BY (${sql}) ${dir}\n`,
      params,
    };
  }

  let PAGING = { sql: "", params: [] as unknown[] };
  let paging: PagingInfo | undefined;
  if (features?.page !== undefined) {
    let page = Math.floor(Math.max(0, features.page));
    let itemsPerPage = Math.floor(Math.max(0, features.itemsPerPage ?? 20));

    paging = {
      page,
      itemsPerPage,
      pageCount: -1,
    };

    PAGING = {
      sql: `LIMIT ? OFFSET ?\n`,
      params: [itemsPerPage, (page - 1) * itemsPerPage],
    };
  }

  let rows: any[];
  if (features?.where || features?.orderBy) {
    rows = connection
      .prepare(
        `
    WITH results AS (
         SELECT records.id as id
               , records.data
               , json(data) as json
          FROM collections
          JOIN records
            ON records.collection_id = collections.id
            AND collections.organisation_name = ?
            AND collections.name = ?
          ${WHERE.sql}          
    )
    SELECT *, (SELECT count(*) FROM results) as count FROM results
    ${ORDER_BY.sql}
    ${PAGING.sql}
  `,
      )
      .all(
        org,
        collection,
        ...WHERE.params,
        ...ORDER_BY.params,
        ...PAGING.params,
      ) as any[];
  } else if (features?.page) {
    rows = GET_ITEMS_QUERY_PAGED.all(org, collection, ...PAGING.params);
  } else {
    rows = GET_ITEMS_QUERY.all(org, collection);
  }
  if (rows.length > 0) {
    const { count } = rows[0];
    const items = rows.map((row) => {
      const { json, id } = row;
      return { id, ...JSON.parse(json) };
    });

    if (paging) {
      paging.pageCount = Math.ceil(count / paging.itemsPerPage);
    }
    return { count, items, ...paging };
  }

  const check = connection
    .prepare(
      "SELECT * FROM collections WHERE name = ? and organisation_name = ? LIMIT 1",
    )
    .pluck()
    .get(collection, org);

  if (check == undefined) {
    return undefined;
  }

  return {
    count: 0,
    items: [],
  };
}

export function getById(org: string, collection: string, id: number) {
  const row = connection
    .prepare(
      `
      SELECT records.*, json(data) as json 
      FROM records
      JOIN collections ON collection_id = collections.id
      WHERE records.id = ?
      AND collections.organisation_name = ?
      AND collections.name = ?
      LIMIT 1
`,
    )
    .get(id, org, collection);

  if (!row) {
    return undefined;
  }

  const json = (row as any).json as string;
  const _id = (row as any).id as number;

  return {
    id: _id,
    ...JSON.parse(json),
  };
}

export function replaceById(
  org: string,
  collection: string,
  id: number,
  value: object,
) {
  const result = connection
    .prepare(
      `
    UPDATE records
    SET data = jsonb(?)
    WHERE id = ?
    AND collection_id = (
        SELECT id
        FROM collections
        WHERE name = ? 
        AND organisation_name = ?)
    `,
    )
    .run(JSON.stringify(value), id, collection, org);

  return result.changes === 1;
}

export function patchById(
  org: string,
  collection: string,
  id: number,
  value: object,
) {
  const result = connection
    .prepare(
      `
  UPDATE records
  SET data = jsonb_patch(data, ?)
  WHERE id = ?
  AND collection_id = (
    SELECT id
    FROM collections
    WHERE name = ? 
    AND organisation_name = ?)
  RETURNING id, json(data) as json
  `,
    )
    .get(JSON.stringify(value), id, collection, org);

  if (result != undefined) {
    const { id, json } = result as any;
    return {
      id,
      ...JSON.parse(json),
    };
  }

  return undefined;
}

export function deleteById(org: string, collection: string, id: number) {
  const result = connection
    .prepare(
      `
    DELETE
    FROM records
    WHERE id = ?
    AND collection_id = (SELECT id
      FROM collections
      WHERE name = ?
      AND organisation_name = ?)
    `,
    )
    .run(id, collection, org);

  return result.changes === 1;
}

export function getApiKey(organisation: string, code: Buffer) {
  const result = connection
    .prepare(
      `
      SELECT key
      FROM organisations
      WHERE name = ?
      AND   code = ?
      `,
    )
    .pluck()
    .get(organisation, code);

  return result as Buffer;
}

export function getCollectionSummary(organisation: string) {
  const rows = connection
    .prepare(
      `
    SELECT name, count
    FROM collections
    WHERE collections.organisation_name = ?
    ORDER BY collections.id
  `,
    )
    .all(organisation);

  return rows as Array<{ name: string; count: number }>;
}
