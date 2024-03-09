import * as db from './db.ts'
import connection from './connection.ts'

console.log(connection.pragma('index_list'))
// const group = db.createGroup('pandas')
// const collection = db.createCollection(group, 'hats')

const id = db.addItemToCollection(1, 1, { poop: 'fart', butt: 'smell'})
console.log(db.getItems('pandas', 'hats'))