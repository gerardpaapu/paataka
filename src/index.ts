import * as db from './db.ts'
import connection from './connection.ts'

console.log(connection.pragma('index_list'))
if (db.getGroups().length === 0) {
  const group = db.createGroup('pandas')
  const collection = db.createCollection(1, 'hats')
}

const id = db.addItemToCollection(1, 1, { poop: 'fart', butt: 'smell' })
console.log({ id })
console.log(db.getItems('pandas', 'hats'))

const item = db.getById('pandas', 'hats', 1)
console.log(item)
