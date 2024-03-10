import * as db from "../db.ts";

const [_0, _1, groupName] = process.argv;
if (!groupName) {
  throw new Error();
}

const id = db.createOrganisation(groupName);
const { code } = db.getOrganisation(id);
const codeString = code.toString("base64url");

process.stdout.write(`${groupName}\t${codeString}\n`);
