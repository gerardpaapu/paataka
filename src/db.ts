import { connect } from 'http2'
import connection from './connection.ts'

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
  value: Record<string, any>,
) {
  const count = connection
    .prepare(
      'SELECT COUNT(*) as last_id FROM records WHERE group_id = ? AND collection_id = ?',
    )
    .get(groupId, collectionId)
  const id = 1 + ((count as any).last_id as number)
  const res = connection
    .prepare(
      'INSERT INTO records (id, group_id, collection_id, data) VALUES (?, ?, ?, jsonb(?))',
    )
    .run(id, groupId, collectionId, JSON.stringify(value))

  return id
}

export function getItems(group: string, collection: string) {
  return connection
    .prepare(
      `
    SELECT *, json(data) as json 
    FROM records
    JOIN groups on groups.id = records.group_id
    JOIN collections on collections.id = records.collection_id
    WHERE groups.name = ? AND collections.name = ?
  `,
    )
    .all(group, collection)
    .map((_: any) => {
      const obj = JSON.parse(_.json)
      return _
    })
}
