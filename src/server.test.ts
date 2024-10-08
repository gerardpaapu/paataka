import { describe, expect, it, beforeEach } from "vitest";
import { StatusCodes } from "http-status-codes";
import request from "supertest";
import server from "./server.ts";
import * as db from "./db.ts";

beforeEach(() => {
  db.reset();
});

describe("seeding a collection", () => {
  const exampleJSON = {
    posts: [
      { text: "Hello", author: "me" },
      { text: "Whatever", author: "someone else" },
    ],
    comments: [{ text: "Poop", author: "poopy" }],
  };
  let code: string;
  beforeEach(() => {
    db.createOrganisation("porkos");
    let data = db.getOrganisation(1);
    code = data.code.toString("base64url");
  });
  // setup a new organisation
  it("takes a well formed JSON object and creates the collections", async () => {
    const res = await request(server)
      .post("/api/org/porkos/seed")
      .query({ code })
      .send(exampleJSON);

    expect(res.statusCode).toBe(StatusCodes.CREATED);
    expect(db.getCollectionSummary("porkos")).toStrictEqual([
      {
        count: 2,
        name: "posts",
      },
      {
        count: 1,
        name: "comments",
      },
    ]);
  });

  it("rejects a malformed JSON payload", async () => {
    const res = await request(server)
      .post("/api/org/porkos/seed")
      .query({ code })
      .set("Content-Type", "application/json")
      .send("{ pooop:");
    expect(res.statusCode).toBe(StatusCodes.BAD_REQUEST);
  });

  it("rejects a bad invitation code", async () => {
    const res = await request(server)
      .post("/api/org/porkos/seed")
      .query({ code: "bumfarts" })
      .send(exampleJSON);

    expect(res.statusCode).toBe(StatusCodes.UNAUTHORIZED);
  });
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

    expect(res.status).toBe(StatusCodes.OK);

    const { key: newKey } = db.getOrganisation(1);
    expect(res.body.key).toBe(newKey.toString("base64url"));
    expect(Buffer.compare(key, newKey)).not.toBe(0);
  });
});

describe("adding objects to a collection", () => {
  beforeEach(() => {
    db.createOrganisation("pandas");
    db.createCollection("pandas", "hats");
  });

  it("adds a new object to a collection", async () => {
    const { key } = db.getOrganisation(1);
    const token = key.toString("base64url");
    const res = await request(server)
      .post("/api/_/pandas/hats")
      .send({ type: "bowler", size: "XS" })
      .auth(token, { type: "bearer" });

    expect(res.statusCode).toBe(StatusCodes.CREATED);
    expect(res.headers["location"]).toBe(`/api/_/pandas/hats/1`);
  });

  it("fails with a 404 for a missing collection", async () => {
    const { key } = db.getOrganisation(1);
    const token = key.toString("base64url");
    const res = await request(server)
      .post("/api/_/pandas/pants")
      .send({ type: "stovepipe" })
      .auth(token, { type: "bearer" });

    expect(res.statusCode).toBe(StatusCodes.NOT_FOUND);
  });

  it("rejects malformed JSON", async () => {
    const { key } = db.getOrganisation(1);
    const token = key.toString("base64url");
    const res = await request(server)
      .post("/api/_/pandas/hats")
      .set("Content-Type", "application/json")
      .send(`{ type: "cap"`)
      .auth(token, { type: "bearer" });

    expect(res.statusCode).toBe(StatusCodes.BAD_REQUEST);
  });

  it("rejects missing API key", async () => {
    const res = await request(server)
      .post("/api/_/pandas/hats")
      .send({ type: "bowler", size: "XS" });

    expect(res.statusCode).toBe(StatusCodes.UNAUTHORIZED);
    expect(db.getItems("pandas", "hats")).toStrictEqual({
      count: 0,
      items: [],
    });
  });

  it("rejects random API key", async () => {
    const res = await request(server)
      .post("/api/_/pandas/hats")
      .send({ type: "bowler", size: "XS" })
      .auth("INVALID_TOKEN", { type: "bearer" });

    expect(res.statusCode).toBe(StatusCodes.UNAUTHORIZED);
    expect(db.getItems("pandas", "hats")).toStrictEqual({
      count: 0,
      items: [],
    });
  });

  it("rejects expired API key", async () => {
    const { key, code } = db.getOrganisation(1);
    const token = key.toString("base64url");
    // now the old one is invalid
    db.refreshKey("pandas", code);
    const res = await request(server)
      .post("/api/_/pandas/pants")
      .send({ type: "stovepipe" })
      .auth(token, { type: "bearer" });

    expect(res.statusCode).toBe(StatusCodes.UNAUTHORIZED);
  });
});

describe("listing objects in a collection", () => {
  let token: string;
  beforeEach(() => {
    db.createOrganisation("pandas");
    const { key } = db.getOrganisation(1);
    token = key.toString("base64url");

    db.createCollection("pandas", "hats");
    db.addItemToCollection("pandas", "hats", { type: "bowler" });
    db.addItemToCollection("pandas", "hats", { type: "sombrero" });
  });

  it("lists all the objects", async () => {
    const res = await request(server)
      .get("/api/_/pandas/hats")
      .auth(token, { type: "bearer" });

    expect(res.statusCode).toBe(200);
    expect(res.body).toStrictEqual({
      count: 2,
      items: [
        {
          id: 1,
          type: "bowler",
        },
        {
          id: 2,
          type: "sombrero",
        },
      ],
    });
  });

  it("fails with a 404 for a missing collection", async () => {
    const res = await request(server)
      .get("/api/_/pandas/pants")
      .auth(token, { type: "bearer" });

    expect(res.statusCode).toBe(StatusCodes.NOT_FOUND);
  });

  it("rejects bad/missing API key", async () => {
    const res = await request(server)
      .get("/api/_/pandas/pants")
      .auth("butts", { type: "bearer" });

    expect(res.statusCode).toBe(StatusCodes.UNAUTHORIZED);
  });
});

describe("deleting a collection", () => {
  let token: string;
  beforeEach(() => {
    db.createOrganisation("pandas");
    const { key } = db.getOrganisation(1);
    token = key.toString("base64url");

    db.createCollection("pandas", "hats");
    db.addItemToCollection("pandas", "hats", { type: "bowler" });
    db.addItemToCollection("pandas", "hats", { type: "sombrero" });
  });

  it("deletes the collection", async () => {
    const res = await request(server)
      .delete("/api/_/pandas/hats")
      .auth(token, { type: "bearer" });

    expect(res.status).toBe(204);

    const res2 = await request(server)
      .get("/api/_/pandas/hats")
      .auth(token, { type: "bearer" });

    expect(res2.status).toBe(404);
  });

  it("fails for a missing collection", async () => {
    const res = await request(server)
      .delete("/api/_/pandas/pants")
      .auth(token, { type: "bearer" });

    expect(res.status).toBe(404);
  });
});

describe("filtering objects in a collection with expressions", () => {
  let token: string;
  beforeEach(() => {
    db.reset();
    db.createOrganisation("pandas");
    const { key } = db.getOrganisation(1);
    token = key.toString("base64url");

    db.createCollection("pandas", "hats");
    db.addItemToCollection("pandas", "hats", { type: "bowler", size: 2 });
    db.addItemToCollection("pandas", "hats", { type: "top hat", size: 1 });
    db.addItemToCollection("pandas", "hats", { type: "cowboy", size: 3 });

    db.addItemToCollection("pandas", "hats", { type: "sombrero", size: 7 });
  });

  it("filters by id", async () => {
    const res = await request(server)
      .get("/api/_/pandas/hats")
      .query({ where: "id == 3" })
      .auth(token, { type: "bearer" });

    expect(res.statusCode).toBe(StatusCodes.OK);
    expect(res.body).toStrictEqual({
      count: 1,
      items: [
        {
          id: 3,
          size: 3,
          type: "cowboy",
        },
      ],
    });
  });

  it("filters to hats except size 3", async () => {
    const res = await request(server)
      .get("/api/_/pandas/hats")
      .query({ where: "_.size != 3" })
      .auth(token, { type: "bearer" });

    expect(res.statusCode).toBe(StatusCodes.OK);
    expect(res.body).toStrictEqual({
      count: 3,
      items: [
        {
          id: 1,
          size: 2,
          type: "bowler",
        },
        {
          id: 2,
          size: 1,
          type: "top hat",
        },
        {
          id: 4,
          size: 7,
          type: "sombrero",
        },
      ],
    });
  });

  it("filters to hats size exactly 3", async () => {
    const res = await request(server)
      .get("/api/_/pandas/hats")
      .query({ where: "_.size == 3" })
      .auth(token, { type: "bearer" });

    expect(res.statusCode).toBe(StatusCodes.OK);
    expect(res.body).toStrictEqual({
      count: 1,
      items: [
        {
          id: 3,
          size: 3,
          type: "cowboy",
        },
      ],
    });
  });
  it("filters to hats size less than 3", async () => {
    const res = await request(server)
      .get("/api/_/pandas/hats")
      .query({ where: "_.size < 3" })
      .auth(token, { type: "bearer" });

    expect(res.statusCode).toBe(StatusCodes.OK);
    expect(res.body).toStrictEqual({
      count: 2,
      items: [
        {
          id: 1,
          size: 2,
          type: "bowler",
        },
        {
          id: 2,
          size: 1,
          type: "top hat",
        },
      ],
    });
  });

  it("filters to hats size 3 and down", async () => {
    const res = await request(server)
      .get("/api/_/pandas/hats")
      .query({ where: "_.size <= 3" })
      .auth(token, { type: "bearer" });

    expect(res.statusCode).toBe(StatusCodes.OK);
    expect(res.body).toStrictEqual({
      count: 3,
      items: [
        {
          id: 1,
          size: 2,
          type: "bowler",
        },
        {
          id: 2,
          size: 1,
          type: "top hat",
        },
        {
          id: 3,
          size: 3,
          type: "cowboy",
        },
      ],
    });
  });

  it("filters to hats size 3 and up", async () => {
    const res = await request(server)
      .get("/api/_/pandas/hats")
      .query({ where: "_.size >= 3" })
      .auth(token, { type: "bearer" });

    expect(res.statusCode).toBe(200);
    expect(res.body).toStrictEqual({
      count: 2,
      items: [
        {
          id: 3,
          size: 3,
          type: "cowboy",
        },
        {
          id: 4,
          size: 7,
          type: "sombrero",
        },
      ],
    });
  });

  it("filters to hats with a negative number", async () => {
    const res = await request(server)
      .get("/api/_/pandas/hats")
      .query({ where: "_.size > -3" })
      .auth(token, { type: "bearer" });

    expect(res.statusCode).toBe(StatusCodes.OK);
    // this is just all the hats
    expect(res.body).toHaveProperty("count", 4);
  });

  it("filters to hats size 3 or bowlers", async () => {
    const res = await request(server)
      .get("/api/_/pandas/hats")
      .query({ where: '_.size == 3 || _.type == "bowler"' })
      .auth(token, { type: "bearer" });

    expect(res.statusCode).toBe(200);
    expect(res.body).toStrictEqual({
      count: 2,
      items: [
        {
          id: 1,
          size: 2,
          type: "bowler",
        },
        {
          id: 3,
          size: 3,
          type: "cowboy",
        },
      ],
    });
  });

  it("filters to hats size 3 or bowlers", async () => {
    const res = await request(server)
      .get("/api/_/pandas/hats")
      .query({
        where: '(_.size >= 3 && _.type == "cowboy") || _.type == "bowler"',
      })
      .auth(token, { type: "bearer" });

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchInlineSnapshot(`
      {
        "count": 2,
        "items": [
          {
            "id": 1,
            "size": 2,
            "type": "bowler",
          },
          {
            "id": 3,
            "size": 3,
            "type": "cowboy",
          },
        ],
      }
    `);
  });

  it("inverting conditions", async () => {
    const res = await request(server)
      .get("/api/_/pandas/hats")
      .query({
        where: '!(_.size >= 3 && _.type == "cowboy")',
      })
      .auth(token, { type: "bearer" });

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchInlineSnapshot(`
      {
        "count": 3,
        "items": [
          {
            "id": 1,
            "size": 2,
            "type": "bowler",
          },
          {
            "id": 2,
            "size": 1,
            "type": "top hat",
          },
          {
            "id": 4,
            "size": 7,
            "type": "sombrero",
          },
        ],
      }
    `);
  });
});

describe("sorting objects in a collection with expressions", () => {
  let token: string;
  beforeEach(() => {
    db.createOrganisation("pandas");
    const { key } = db.getOrganisation(1);
    token = key.toString("base64url");

    db.createCollection("pandas", "hats");
    db.addItemToCollection("pandas", "hats", { type: "bowler", size: 2 });
    db.addItemToCollection("pandas", "hats", { type: "top hat", size: 1 });
    db.addItemToCollection("pandas", "hats", { type: "cowboy", size: 3 });

    db.addItemToCollection("pandas", "hats", { type: "sombrero", size: 7 });
  });

  it("orders hats by size (ascending)", async () => {
    const res = await request(server)
      .get("/api/_/pandas/hats")
      .query({ orderBy: "_.size", dir: "asc" })
      .auth(token, { type: "bearer" });

    expect(res.statusCode).toBe(200);
    expect(res.body).toStrictEqual({
      count: 4,
      items: [
        {
          id: 2,
          size: 1,
          type: "top hat",
        },
        {
          id: 1,
          size: 2,
          type: "bowler",
        },
        {
          id: 3,
          size: 3,
          type: "cowboy",
        },
        {
          id: 4,
          size: 7,
          type: "sombrero",
        },
      ],
    });
  });

  it("orders hats by size (descending)", async () => {
    const res = await request(server)
      .get("/api/_/pandas/hats")
      .query({ orderBy: "_.size", dir: "desc" })
      .auth(token, { type: "bearer" });

    expect(res.statusCode).toBe(200);
    expect(res.body).toStrictEqual({
      count: 4,
      items: [
        {
          id: 4,
          size: 7,
          type: "sombrero",
        },
        {
          id: 3,
          size: 3,
          type: "cowboy",
        },
        {
          id: 1,
          size: 2,
          type: "bowler",
        },
        {
          id: 2,
          size: 1,
          type: "top hat",
        },
      ],
    });
  });
});

describe('getting a specific "page" of results', () => {
  let token: string;
  beforeEach(() => {
    db.createOrganisation("pandas");
    const { key } = db.getOrganisation(1);
    token = key.toString("base64url");

    db.createCollection("pandas", "hats");
    for (let i = 0; i < 100; i++) {
      db.addItemToCollection("pandas", "hats", {
        type: `hat-type-${i}`,
        size: 2,
      });
    }
  });

  it("default page size is 20", async () => {
    const res = await request(server)
      .get("/api/_/pandas/hats")
      .query({ page: 1 })
      .auth(token, { type: "bearer" });

    expect(res.statusCode).toBe(200);
    const result = res.body;
    expect(result.count).toBe(100);
    expect(result.pageCount).toBe(5);
    expect(result.itemsPerPage).toBe(20);
    expect(result.items).toHaveLength(20);
    expect(result.items[19]).toStrictEqual({
      id: 20,
      size: 2,
      type: "hat-type-19",
    });
  });

  it("uses non-default page size", async () => {
    const res = await request(server)
      .get("/api/_/pandas/hats")
      .query({ page: 1, itemsPerPage: 5 })
      .auth(token, { type: "bearer" });

    expect(res.statusCode).toBe(200);
    const result = res.body;
    expect(result.count).toBe(100);
    expect(result.pageCount).toBe(20);
    expect(result.itemsPerPage).toBe(5);

    expect(result.items).toHaveLength(5);
    expect(result.items[4]).toStrictEqual({
      id: 5,
      size: 2,
      type: "hat-type-4",
    });
  });

  it("gets later pages", async () => {
    const res = await request(server)
      .get("/api/_/pandas/hats")
      .query({ page: 3, itemsPerPage: 5 })
      .auth(token, { type: "bearer" });

    expect(res.statusCode).toBe(200);
    const result = res.body;
    expect(result.count).toBe(100);
    expect(result.items).toHaveLength(5);
    expect(result.items[4]).toMatchInlineSnapshot(`
      {
        "id": 15,
        "size": 2,
        "type": "hat-type-14",
      }
    `);
  });
});

describe("replacing objects in a collection", () => {
  let token: string;
  beforeEach(() => {
    db.createOrganisation("pandas");
    const { key } = db.getOrganisation(1);
    token = key.toString("base64url");

    db.createCollection("pandas", "hats");
    db.addItemToCollection("pandas", "hats", { type: "bowler" });
    db.addItemToCollection("pandas", "hats", { type: "sombrero" });
  });

  it("replaces the object", async () => {
    const res = await request(server)
      .put("/api/_/pandas/hats/2")
      .send({ type: "candelabra" })
      .auth(token, { type: "bearer" });

    expect(res.statusCode).toBe(StatusCodes.NO_CONTENT);
    expect(db.getItems("pandas", "hats")).toStrictEqual({
      count: 2,
      items: [
        {
          id: 1,
          type: "bowler",
        },
        {
          id: 2,
          type: "candelabra",
        },
      ],
    });
  });

  it("fails with a bad token", async () => {
    const res = await request(server)
      .put("/api/_/pandas/hats/2")
      .send({ type: "candelabra" })
      .auth("BUTTS", { type: "bearer" });
    expect(res.statusCode).toBe(StatusCodes.UNAUTHORIZED);
  });

  it("fails for a missing id", async () => {
    const res = await request(server)
      .put("/api/_/pandas/hats/7")
      .send({ type: "candelabra" })
      .auth(token, { type: "bearer" });

    expect(res.statusCode).toBe(StatusCodes.NOT_FOUND);
  });
});

describe("patching objects in a collection", () => {
  let token: string;
  beforeEach(() => {
    db.createOrganisation("pandas");
    const { key } = db.getOrganisation(1);
    token = key.toString("base64url");

    db.createCollection("pandas", "hats");
    db.addItemToCollection("pandas", "hats", { type: "bowler" });
    db.addItemToCollection("pandas", "hats", { type: "sombrero" });
  });

  it("patches the object", async () => {
    const res = await request(server)
      .patch("/api/_/pandas/hats/2")
      .send({ type: "candelabra" })
      .auth(token, { type: "bearer" });

    expect(res.statusCode).toBe(StatusCodes.OK);
    expect(res.body).toStrictEqual({
      id: 2,
      type: "candelabra",
    });
    expect(db.getItems("pandas", "hats")).toStrictEqual({
      count: 2,
      items: [
        {
          id: 1,
          type: "bowler",
        },
        {
          id: 2,
          type: "candelabra",
        },
      ],
    });
  });
  it("fails with a bad token", async () => {
    const res = await request(server)
      .patch("/api/_/pandas/hats/2")
      .send({ type: "candelabra" })
      .auth("BUTTS", { type: "bearer" });
    expect(res.statusCode).toBe(StatusCodes.UNAUTHORIZED);
  });

  it("fails for a missing id", async () => {
    const res = await request(server)
      .patch("/api/_/pandas/hats/7")
      .send({ type: "candelabra" })
      .auth(token, { type: "bearer" });

    expect(res.statusCode).toBe(StatusCodes.NOT_FOUND);
  });
});

describe("deleting objects from a collection", () => {
  let token: string;
  beforeEach(() => {
    db.createOrganisation("pandas");
    const { key } = db.getOrganisation(1);
    token = key.toString("base64url");

    db.createCollection("pandas", "hats");
    db.addItemToCollection("pandas", "hats", { type: "bowler" });
    db.addItemToCollection("pandas", "hats", { type: "sombrero" });
  });

  it("deletes the object", async () => {
    const res = await request(server)
      .delete("/api/_/pandas/hats/2")
      .auth(token, { type: "bearer" });

    expect(res.statusCode).toBe(StatusCodes.NO_CONTENT);
  });

  it("fails with a bad token", async () => {
    const res = await request(server)
      .delete("/api/_/pandas/hats/2")
      .auth("BUTTS", { type: "bearer" });

    expect(res.statusCode).toBe(StatusCodes.UNAUTHORIZED);
  });

  it("fails for a missing id", async () => {
    const res = await request(server)
      .delete("/api/_/pandas/hats/12")
      .auth(token, { type: "bearer" });

    expect(res.statusCode).toBe(StatusCodes.NOT_FOUND);
  });
});

describe("bracket access with string keys", () => {
  let token: string;
  beforeEach(() => {
    db.createOrganisation("pandas");
    const { key } = db.getOrganisation(1);
    token = key.toString("base64url");

    db.createCollection("pandas", "hats");
    db.addItemToCollection("pandas", "hats", { "official color": "green" });
    db.addItemToCollection("pandas", "hats", {
      "official color": "yellow",
    });
    db.addItemToCollection("pandas", "hats", { "official color": "red" });
  });

  it("keeps matches", async () => {
    const res = await request(server)
      .get("/api/_/pandas/hats/")
      .query({
        where: '_["official color"] == "yellow"',
      })
      .auth(token, { type: "bearer" });

    expect(res.statusCode).toBe(StatusCodes.OK);
    expect(res.body).toMatchInlineSnapshot(`
      {
        "count": 1,
        "items": [
          {
            "id": 2,
            "official color": "yellow",
          },
        ],
      }
    `);
  });
});

describe("filtering with case conversions", () => {
  let token: string;
  beforeEach(() => {
    db.createOrganisation("pandas");
    const { key } = db.getOrganisation(1);
    token = key.toString("base64url");

    db.createCollection("pandas", "hats");
    db.addItemToCollection("pandas", "hats", { type: "BoWlEr" });
    db.addItemToCollection("pandas", "hats", { type: "sombrero" });
  });

  it("converts a string to lowercase", async () => {
    const res = await request(server)
      .get("/api/_/pandas/hats/")
      .query({
        where: '_.type.toLowerCase() == "bowler"',
      })
      .auth(token, { type: "bearer" });

    expect(res.statusCode).toBe(200);
    expect(res.body).toStrictEqual({
      count: 1,
      items: [
        {
          id: 1,
          type: "BoWlEr",
        },
      ],
    });
  });

  it("converts a string to lowercase", async () => {
    const res = await request(server)
      .get("/api/_/pandas/hats/")
      .query({
        where: '_.type.toUpperCase() == "BOWLER"',
      })
      .auth(token, { type: "bearer" });

    expect(res.statusCode).toBe(200);
    expect(res.body).toStrictEqual({
      count: 1,
      items: [
        {
          id: 1,
          type: "BoWlEr",
        },
      ],
    });
  });
});

describe("filtering with like(...) and glob(...)", () => {
  let token: string;
  beforeEach(() => {
    db.createOrganisation("pandas");
    const { key } = db.getOrganisation(1);
    token = key.toString("base64url");

    db.createCollection("pandas", "hats");
    db.addItemToCollection("pandas", "hats", { type: "bowler" });
    db.addItemToCollection("pandas", "hats", { type: "sombrero" });
    db.addItemToCollection("pandas", "hats", { type: "BOWLER" });
  });

  it("keeps matches", async () => {
    const res = await request(server)
      .get("/api/_/pandas/hats/")
      .query({
        where: 'like(_.type, "%brero")',
      })
      .auth(token, { type: "bearer" });

    expect(res.statusCode).toBe(200);
    expect(res.body).toStrictEqual({
      count: 1,
      items: [
        {
          id: 2,
          type: "sombrero",
        },
      ],
    });
  });

  it("glob is case-sensitive", async () => {
    const res = await request(server)
      .get("/api/_/pandas/hats/")
      .query({
        where: 'glob(_.type, "b*r")',
      })
      .auth(token, { type: "bearer" });

    expect(res.statusCode).toBe(200);
    expect(res.body).toStrictEqual({
      count: 1,
      items: [
        {
          id: 1,
          type: "bowler",
        },
      ],
    });
  });
});

describe("filtering by length", () => {
  let token: string;
  beforeEach(() => {
    db.createOrganisation("pandas");
    const { key } = db.getOrganisation(1);
    token = key.toString("base64url");

    db.createCollection("pandas", "hats");
    db.addItemToCollection("pandas", "hats", { type: "bowler" });
    db.addItemToCollection("pandas", "hats", { type: "sombrero" });
  });

  it("keeps matches", async () => {
    const res = await request(server)
      .get("/api/_/pandas/hats/")
      .query({
        where: "_.type.length > 6",
      })
      .auth(token, { type: "bearer" });

    expect(res.statusCode).toBe(200);
    expect(res.body).toStrictEqual({
      count: 1,
      items: [
        {
          id: 2,
          type: "sombrero",
        },
      ],
    });
  });
});

describe("filtering with array methods", () => {
  let token: string;
  beforeEach(() => {
    db.createOrganisation("pandas");
    const { key } = db.getOrganisation(1);
    token = key.toString("base64url");

    db.createCollection("pandas", "hats");
    db.addItemToCollection("pandas", "hats", {
      type: "bowler",
      tags: ["old-school", "stylish", "little"],
      sizes: [1, 2, 3],
    });
    db.addItemToCollection("pandas", "hats", {
      type: "sombrero",
      tags: ["huge", "mexican", "fiesta"],
      sizes: [4, 5, 6],
    });
  });

  // TODO: write "every"
  it("matches tags with .some()", async () => {
    const res = await request(server)
      .get("/api/_/pandas/hats/")
      .query({
        where: '_.tags.some(tag => tag.toUpperCase() == "OLD-SCHOOL")',
      })
      .auth(token, { type: "bearer" });

    expect(res.statusCode).toBe(200);
    expect(res.body).toStrictEqual({
      count: 1,
      items: [
        {
          id: 1,
          type: "bowler",
          tags: ["old-school", "stylish", "little"],
          sizes: [1, 2, 3],
        },
      ],
    });
  });

  it("matches tags with .every()", async () => {
    const res = await request(server)
      .get("/api/_/pandas/hats/")
      .query({
        where: "_.tags.every(tag => tag.length >= 6)",
      })
      .auth(token, { type: "bearer" });

    expect(res.statusCode).toBe(200);
    expect(res.body).toStrictEqual({
      count: 1,
      items: [
        {
          id: 1,
          type: "bowler",
          tags: ["old-school", "stylish", "little"],
          sizes: [1, 2, 3],
        },
      ],
    });
  });
});

describe("filtering with includes", () => {
  let token: string;
  beforeEach(() => {
    db.createOrganisation("pandas");
    const { key } = db.getOrganisation(1);
    token = key.toString("base64url");

    db.createCollection("pandas", "hats");
    db.addItemToCollection("pandas", "hats", {
      type: "bowler",
      tags: ["old-school", "stylish", "little"],
      sizes: [1, 2, 3],
    });
    db.addItemToCollection("pandas", "hats", {
      type: "sombrero",
      tags: ["huge", "mexican", "fiesta"],
      sizes: [4, 5, 6],
    });
  });

  it("matches tags", async () => {
    const res = await request(server)
      .get("/api/_/pandas/hats/")
      .query({
        where: '_.tags.includes("old-school")',
      })
      .auth(token, { type: "bearer" });

    expect(res.statusCode).toBe(200);
    expect(res.body).toStrictEqual({
      count: 1,
      items: [
        {
          id: 1,
          type: "bowler",
          tags: ["old-school", "stylish", "little"],
          sizes: [1, 2, 3],
        },
      ],
    });
  });

  it("matches size", async () => {
    const res = await request(server)
      .get("/api/_/pandas/hats/")
      .query({
        where: "_.sizes.includes(5)",
      })
      .auth(token, { type: "bearer" });

    expect(res.statusCode).toBe(200);
    expect(res.body).toStrictEqual({
      count: 1,
      items: [
        {
          id: 2,
          sizes: [4, 5, 6],
          tags: ["huge", "mexican", "fiesta"],
          type: "sombrero",
        },
      ],
    });
  });
});

describe("array literals", () => {
  let token: string;
  beforeEach(() => {
    db.createOrganisation("pandas");
    const { key } = db.getOrganisation(1);
    token = key.toString("base64url");

    db.createCollection("pandas", "hats");
    db.addItemToCollection("pandas", "hats", {
      type: "bowler",
      tags: ["old-school", "stylish", "little"],
      sizes: [1, 2, 3],
    });
    db.addItemToCollection("pandas", "hats", {
      type: "sombrero",
      tags: ["huge", "mexican", "fiesta"],
      sizes: [4, 5, 6],
    });
  });

  it("can use includes on array literals", async () => {
    const res = await request(server)
      .get("/api/_/pandas/hats/")
      .query({
        where: '["sombrero", "topaz"].includes(_.type)',
      })
      .auth(token, { type: "bearer" });

    expect(res.statusCode).toBe(200);
    expect(res.body).toStrictEqual({
      count: 1,
      items: [
        {
          id: 2,
          sizes: [4, 5, 6],
          tags: ["huge", "mexican", "fiesta"],
          type: "sombrero",
        },
      ],
    });
  });
});

describe("An empty result set", () => {
  let token: string;
  beforeEach(() => {
    db.createOrganisation("pandas");
    const { key } = db.getOrganisation(1);
    token = key.toString("base64url");

    db.createCollection("pandas", "hats");
    db.addItemToCollection("pandas", "hats", { type: "bowler", size: 2 });
    db.addItemToCollection("pandas", "hats", { type: "top hat", size: 1 });
    db.addItemToCollection("pandas", "hats", { type: "cowboy", size: 3 });

    db.addItemToCollection("pandas", "hats", { type: "sombrero", size: 7 });
  });

  it("is still a success", async () => {
    const res = await request(server)
      .get("/api/_/pandas/hats")
      .query({ where: '_.type == "derby"' })
      .auth(token, { type: "bearer" });

    expect(res.statusCode).toBe(200);
    expect(res.body).toStrictEqual({
      count: 0,
      items: [],
    });
  });
});

describe("Invalid expressions", () => {
  let token: string;
  beforeEach(() => {
    db.createOrganisation("pandas");
    const { key } = db.getOrganisation(1);
    token = key.toString("base64url");

    db.createCollection("pandas", "hats");
    db.addItemToCollection("pandas", "hats", { type: "bowler" });
    db.addItemToCollection("pandas", "hats", { type: "sombrero" });
  });

  it("empty expressions are ignored", async () => {
    const res = await request(server)
      .get("/api/_/pandas/hats")
      .query({ where: "", orderBy: "" })
      .auth(token, { type: "bearer" });

    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(2);
  });

  it("invalid expressions are unprocessable", async () => {
    const res = await request(server)
      .get("/api/_/pandas/hats")
      .query({ where: "like(a," })
      .auth(token, { type: "bearer" });

    expect(res.status).toBe(StatusCodes.UNPROCESSABLE_ENTITY);
    expect(res.body).toHaveProperty("error");
  });

  it("unknown identifiers are illegal", async () => {
    const res = await request(server)
      .get("/api/_/pandas/hats")
      .query({ where: "foo > 2" })
      .auth(token, { type: "bearer" });

    expect(res.status).toBe(StatusCodes.UNPROCESSABLE_ENTITY);
    expect(res.body).toStrictEqual({
      error: "Invalid identifier foo",
    });
  });
});
