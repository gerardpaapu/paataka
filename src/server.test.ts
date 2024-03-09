import { describe, expect, it, beforeEach } from "vitest";
import request from "supertest";
import server from "./server.ts";
import * as db from "./db.ts";

beforeEach(() => {
  db.reset();
});

describe("seeding a collection", () => {
  // setup a new organisation
  it.todo("takes a well formed JSON object and creates the collections");
  it.todo("rejects a malformed JSON payload");
  it.todo("rejects a bad invitation code");
});

describe("API keys", () => {
  beforeEach(() => {
    db.createOrganisation("pandas");
  });

  it("getting an API key from an invite code", async () => {
    const { code, key } = db.getOrganisation(1);
    const res = await request(server)
      .get("/api/keys/pandas")
      .query({ code: code.toString("base64url") });

    expect(res.body.key).toBe(key.toString("base64url"));
  });

  it("resetting an API key", async () => {
    const { code, key } = db.getOrganisation(1);
    const res = await request(server)
      .post("/api/keys/pandas")
      .query({ code: code.toString("base64url") });

    expect(res.status).toBe(200);

    const { key: key2 } = db.getOrganisation(1);
    expect(res.body.key).toBe(key2.toString("base64url"));
    expect(Buffer.compare(key, key2)).not.toBe(0);
  });
});

describe("adding objects to a collection", () => {
  it.todo("adds a new object to a collection");
  it.todo("fails with a 404 for a missing collection");
  it.todo("rejects malformed JSON");
  it.todo("rejects missing API key");
  it.todo("rejects random API key");
  it.todo("rejects expired API key");
});

describe("listing objects in a collection", () => {
  it.todo("lists all the objects");
  it.todo("fails with a 404 for a missing collection");
  it.todo("rejects missing API key");
  it.todo("rejects random API key");
  it.todo("rejects expired API key");
});

describe.todo("replacing objects in a collection");
describe.todo("patching objects in a collection");
describe.todo("deleting objects from a collection");
