import connection from './connection.ts'

export function getGroups() {
  return connection.prepare('SELECT * FROM groups').all()
}

export function createGroup(name: string) {
  const res = connection
    .prepare('INSERT INTO groups (name) VALUES (?)')
    .run(name)
  return res.lastInsertRowid
}

export function createCollection(groupId: number | bigint, name: string) {
  const res = connection
    .prepare('INSERT INTO collections (group_id, name) VALUES (?, ?)')
    .run(groupId, name)

  return res.lastInsertRowid
}

export function addItemToCollection(
  groupId: number | bigint,
  collectionId: number | bigint,
  value: Record<string, any>
) {
  const res = connection
    .prepare(
      `
      INSERT INTO records (id, group_id, collection_id, data) 
      -- to fake an auto-incrementing ID we 
      -- select the number of records with 
      VALUES (1 + IFNULL((SELECT MAX(records.id)
                          FROM records 
                          WHERE group_id = ?
                          AND collection_id = ?), 0)
              , ?
              , ?
              , jsonb(?)
              )
      RETURNING id
      `
    )
    .get(groupId, collectionId, groupId, collectionId, JSON.stringify(value))

  return (res as any).id as number
}

export function getItems(group: string, collection: string) {
  return connection
    .prepare(
      `
    SELECT records.*, json(data) as json 
    FROM records
    JOIN groups on groups.id = records.group_id
    JOIN collections on collections.id = records.collection_id
    WHERE groups.name = ? AND collections.name = ?
  `
    )
    .all(group, collection)
    .map((row: any) => {
      const { id, json } = row
      const obj = JSON.parse(json)
      return { id, ...obj }
    })
}

export function getById(group: string, collection: string, id: number) {
  const row = connection
    .prepare(
      `
  SELECT records.*, json(data) as json 
  FROM records
  JOIN groups on groups.id = records.group_id
  JOIN collections on collections.id = records.collection_id
  WHERE records.id = ?
  AND groups.name = ?
  AND collections.name = ?
`
    )
    .get(id, group, collection)

  if (!row) {
    return undefined
  }

  const json = (row as any).json as string
  const _id = (row as any).id as number

  return {
    id: _id,
    ...JSON.parse(json),
  }
}

export function replaceById(
  group: string,
  collection: string,
  id: number,
  value: object
) {
  const result = connection
    .prepare(
      `
    UPDATE records
    SET data = jsonb(?)
    WHERE id = ?
    AND group_id = (SELECT id FROM groups WHERE name = ?)
    AND collection_id = (SELECT id FROM collections WHERE name = ?)
    `
    )
    .run(JSON.stringify(value), id, group, collection)
}

export function patchById(
  group: string,
  collection: string,
  id: number,
  value: object
) {
  const result = connection
    .prepare(
      `
    UPDATE records
    SET data = jsonb_patch(data, ?)
    WHERE id = ?
    AND group_id = (SELECT id FROM groups WHERE name = ?)
    AND collection_id = (SELECT id FROM collections WHERE name = ?)
    `
    )
    .run(JSON.stringify(value), id, group, collection)
}

export function deleteById(group: string, collection: string, id: number) {
  const result = connection
    .prepare(
      `
    DELETE
    FROM records
    WHERE id = ?
    AND group_id = (SELECT id FROM groups WHERE name = ?)
    AND collection_id = (SELECT id FROM collections WHERE name = ?)
    `
    )
    .run(id, group, collection)

  return result.changes
}
