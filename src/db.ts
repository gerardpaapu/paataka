import connection from './connection.ts'

export function getGroups() {
  return connection.prepare('SELECT * FROM groups').all()
}

export function createGroup(name: string) {
  const res = connection
    .prepare('INSERT INTO groups (name) VALUES (?)')
    .run(name)
  return Number(res.lastInsertRowid)
}

export function createCollection(groupId: number, name: string) {
  const res = connection
    .prepare('INSERT INTO collections (group_id, name) VALUES (?, ?)')
    .run(groupId, name)
  return Number(res.lastInsertRowid)
}
export function addItemToCollection(
  groupId: number,
  collectionId: number,
  value: Record<string, any>
) {
  const res = connection
    .prepare(
      `
      INSERT INTO records (id, group_id, collection_id, data) 
      -- to fake an auto-incrementing ID we 
      -- select the number of records with 
      VALUES (1 + (SELECT COUNT(*)
                   FROM records 
                   WHERE group_id = ?
                   AND collection_id = ?)
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
