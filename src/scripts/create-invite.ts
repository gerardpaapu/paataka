import * as db from "../db.ts";

const [_0, _1, groupName] = process.argv;
if (!groupName) {
  console.error(`usage: invite group-name`);
  throw new Error(`Missing argument: group-name`);
}

const id = db.createOrganisation(groupName);
const { code } = db.getOrganisation(id);
const codeString = code.toString("base64url");

process.stdout.write(`https://paataka.cloud/${groupName}?code=${codeString}\n`);
