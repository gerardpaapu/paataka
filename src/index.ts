import * as db from "./db.ts";

if (db.getGroups().length === 0) {
  db.createGroup("pandas");
  db.createCollection("pandas", "hats");
}

db.addItemToCollection("pandas", "hats", { poop: "fart", butt: "smell" });
db.deleteById("pandas", "hats", 1);
db.patchById("pandas", "hats", 2, { stink: "butts" });

console.log(db.getItems("pandas", "hats"));
