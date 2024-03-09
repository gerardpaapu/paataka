import connection from "./connection.ts";

export function getGroups() {
  return connection.prepare("SELECT * FROM groups").all();
}

export function createGroup(name: string) {
  const res = connection
    .prepare("INSERT INTO groups (name) VALUES (?)")
    .run(name);
  return res.lastInsertRowid;
}

export function deleteGroup(name: string) {
  const res = connection.prepare("DELETE FROM groups WHERE name = ?").run(name);
  return res.changes === 1;
}

export function getCollections(group: string) {
  const res = connection
    .prepare("SELECT * FROM collections WHERE group_name = ?")
    .all(group);

  return res;
}

export function createCollection(groupName: string, name: string) {
  const res = connection
    .prepare("INSERT INTO collections (group_name, name) VALUES (?, ?)")
    .run(groupName, name);

  return res.lastInsertRowid;
}

export function addItemToCollection(
  group: string,
  collection: string,
  value: Record<string, any>,
) {
  // TODO: can we do this in one query?
  const collectionId = connection
    .prepare(
      `
      SELECT id
      FROM collections
      WHERE name = ? and group_name = ?
    `,
    )
    .pluck()
    .get(collection, group) as number;

  console.log(
    connection
      .prepare(
        `SELECT MAX(r.id)
  FROM records as r
  WHERE collection_id = ?`,
      )
      .pluck()
      .all(collectionId),
  );

  const res = connection
    .prepare(
      `
      INSERT INTO records (id, collection_id, data) 
      VALUES (1 + IFNULL(
                    (SELECT MAX(r.id)
                     FROM records as r
                     WHERE collection_id = ?) 
                  , 0)
              , ?
              , jsonb(?)
              )
      RETURNING id
      `,
    )
    .get(collectionId, collectionId, JSON.stringify(value));

  return (res as any).id as number;
}

export function getItems(group: string, collection: string) {
  //
  return connection
    .prepare(
      `
    SELECT records.*, json(data) as json 
    FROM records
    JOIN collections ON collection_id = collections.id
    WHERE collections.group_name = ? AND collections.name = ?
  `,
    )
    .all(group, collection)
    .map((row: any) => {
      const { id, json } = row;
      const obj = JSON.parse(json);
      return { id, ...obj };
    });
}

export function getById(group: string, collection: string, id: number) {
  const row = connection
    .prepare(
      `
      SELECT *, json(data) as json 
      FROM records
      JOIN collections ON collection_id = collections.id
      WHERE records.id = ?
      AND collections.group_name = ?
      AND collections.name = ?
`,
    )
    .get(id, group, collection);

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
  group: string,
  collection: string,
  id: number,
  value: object,
) {
  // should this technically be in a transaction?
  const collectionId = connection
    .prepare(
      `
    SELECT id
    FROM collections
    WHERE name = ? and group_name = ?
  `,
    )
    .pluck()
    .get(collection, group) as number;

  console.log(collectionId);
  const result = connection
    .prepare(
      `
    UPDATE records
    SET data = jsonb(?)
    WHERE id = ?
    AND collection_id = ?
    `,
    )
    .run(JSON.stringify(value), id, collectionId);

  return result.changes === 1;
}

export function patchById(
  group: string,
  collection: string,
  id: number,
  value: object,
) {
  const collectionId = connection
    .prepare(
      `
  SELECT id
  FROM collections
  WHERE name = ? and group_name = ?
`,
    )
    .pluck()
    .get(collection, group) as number;
  const result = connection
    .prepare(
      `
  UPDATE records
  SET data = jsonb_patch(data, ?)
  WHERE id = ?
  AND collection_id = ?
  `,
    )
    .run(JSON.stringify(value), id, collectionId);

  return result.changes === 1;
}

export function deleteById(group: string, collection: string, id: number) {
  const collectionId = connection
    .prepare(
      `
  SELECT id
  FROM collections
  WHERE name = ? and group_name = ?
`,
    )
    .pluck()
    .get(collection, group) as number;

  const result = connection
    .prepare(
      `
    DELETE
    FROM records
    WHERE id = ?
    AND collection_id = ?
    `,
    )
    .run(id, collectionId);

  return result.changes;
}
