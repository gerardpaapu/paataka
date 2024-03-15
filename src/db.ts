import connection from "./connection.ts";
import { compileExpr } from "./expr/index.ts";
import { Collection, Organisation, OrganisationWithSecrets } from "./models.ts";

export function reset() {
  return connection.exec("DELETE FROM organisations");
}

export function getOrganisation(id: number | bigint) {
  return connection
    .prepare("SELECT * FROM organisations WHERE id = ?")
    .get(id) as OrganisationWithSecrets;
}

export function getOrganisationByName(name: string) {
  return connection
    .prepare("SELECT * FROM organisations WHERE name = ?")
    .get(name) as OrganisationWithSecrets;
}

export function refreshKey(organisation: string, code: Buffer) {
  return connection
    .prepare(
      `
      UPDATE organisations
      SET key = randomblob(8)
      WHERE name = ? AND code = ?
      RETURNING key
    `,
    )
    .pluck()
    .get(organisation, code) as Buffer | undefined;
}

export function validateKey(key: Buffer) {
  return connection
    .prepare(
      `
      SELECT name 
      FROM organisations
      WHERE key = ?
      `,
    )
    .pluck()
    .get(key) as string;
}

export function getOrganisations() {
  return connection
    .prepare("SELECT id, name FROM organisations ORDER BY id")
    .all() as Organisation[];
}

export function createOrganisation(name: string) {
  const res = connection
    .prepare("INSERT INTO organisations (name) VALUES (?)")
    .run(name);
  return res.lastInsertRowid;
}

export function deleteOrganisation(name: string) {
  const res = connection
    .prepare("DELETE FROM organisations WHERE name = ?")
    .run(name);
  return res.changes === 1;
}

export function getCollections(organisation: string) {
  const res = connection
    .prepare("SELECT * FROM collections WHERE organisation_name = ?")
    .all(organisation) as Collection[];

  return res;
}

export function createCollection(organisation: string, name: string) {
  const res = connection
    .prepare("INSERT INTO collections (organisation_name, name) VALUES (?, ?)")
    .run(organisation, name);

  return res.lastInsertRowid;
}

export function addItemToCollection(
  organisation: string,
  collection: string,
  value: Record<string, any>,
) {
  const res = connection
    .prepare(
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
      RETURNING id, collection_id      `,
    )
    .get(
      collection,
      organisation,
      collection,
      organisation,
      JSON.stringify(value),
    );

  if ((res as any).collection_id == null) {
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

export function getItems(org: string, collection: string, features?: Features) {
  let WHERE = { sql: "", params: [] as unknown[] };
  if (features && features.where && typeof features.where === "string") {
    const { sql, params } = compileExpr(features.where);
    WHERE = {
      sql: `AND (${sql})\n`,
      params,
    };
  }

  let ORDER_BY = { sql: "", params: [] as unknown[] };
  if (typeof features?.orderBy === "string") {
    const { sql, params } = compileExpr(features?.orderBy);
    const dir = features?.dir?.toLocaleLowerCase() === "desc" ? "DESC" : "ASC";
    ORDER_BY = {
      sql: `ORDER BY (${sql}) ${dir}\n`,
      params,
    };
  }

  let PAGING = { sql: "", params: [] as unknown[] };
  if (features?.page !== undefined) {
    let page = Math.floor(Math.max(0, features.page));
    let itemsPerPage = Math.floor(Math.max(0, features.itemsPerPage ?? 20));

    PAGING = {
      sql: `LIMIT ? OFFSET ?\n`,
      params: [itemsPerPage, (page - 1) * itemsPerPage],
    };
  }

  const rows = connection
    .prepare(
      `
    WITH results AS (
         SELECT records.id as id
               , json(data) as json
          FROM collections
          LEFT OUTER JOIN records ON records.collection_id = collections.id
          WHERE collections.organisation_name = ?
          AND collections.name = ?
          ${WHERE.sql}
          ${ORDER_BY.sql}
    )
    SELECT *, (SELECT count(*) FROM results) as count FROM results
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

  if (rows.length === 0) {
    return undefined;
  }

  if (rows.length === 1 && rows[0].json == undefined) {
    return [];
  }
  const { count } = rows[0];
  const items = rows.map((row) => {
    const { json, id } = row;
    return { id, ...JSON.parse(json) };
  });

  return { count, items };
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
    SELECT name, COUNT(records.id) as count
    FROM collections
    LEFT OUTER JOIN records ON records.collection_id = collections.id
    WHERE collections.organisation_name = ?
    GROUP BY collections.id
  `,
    )
    .all(organisation);

  return rows;
}
