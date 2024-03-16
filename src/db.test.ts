import { describe, expect, it, beforeEach } from "vitest";
import * as db from "./db.ts";

beforeEach(() => {
  db.reset();
});

describe("creating orgs", () => {
  it("orgs starts empty", () => {
    let orgs = db.getOrganisations();
    expect(orgs).toHaveLength(0);
  });

  it("adds a org", () => {
    db.createOrganisation("pandas");
    db.createOrganisation("dogs");

    let orgs = db.getOrganisations();
    expect(orgs).toStrictEqual([
      {
        id: 1,
        name: "pandas",
      },
      {
        id: 2,
        name: "dogs",
      },
    ]);
  });

  it("throws if you create duplicates", () => {
    db.createOrganisation("pandas");
    expect(() => {
      db.createOrganisation("pandas");
    }).toThrow();
  });
});

describe("creating collections within a org", () => {
  it("creates collections", () => {
    db.createOrganisation("pandas");
    db.createCollection("pandas", "hats");
    db.createCollection("pandas", "pants");
    expect(db.getCollections("pandas")).toStrictEqual([
      {
        organisation_name: "pandas",
        id: 1,
        name: "hats",
      },
      {
        organisation_name: "pandas",
        id: 2,
        name: "pants",
      },
    ]);
  });

  it("fails to create duplicate collections", () => {
    expect(() => {
      db.createOrganisation("pandas");
      db.createCollection("pandas", "hats");
      db.createCollection("pandas", "hats");
    }).toThrow();
  });

  it("deletes an existing org", () => {
    db.createOrganisation("pandas");
    db.createCollection("pandas", "hats");
    db.deleteOrganisation("pandas");
    expect(db.getOrganisations()).toMatchInlineSnapshot(`[]`);
  });

  it("fails to delete a missing org", () => {
    expect(db.deleteOrganisation("butts")).toBe(false);
  });
});

describe("getting records", () => {
  beforeEach(() => {
    db.createOrganisation("pandas");
    db.createCollection("pandas", "hats");
    db.addItemToCollection("pandas", "hats", { type: "panama" });
  });

  it("gets the one you wanted", () => {
    expect(db.getById("pandas", "hats", 1)).toMatchInlineSnapshot(`
      {
        "id": 1,
        "type": "panama",
      }
    `);
  });

  it("returns undefined for missing hats", () => {
    expect(db.getById("pandas", "hats", 3)).toBeUndefined();
  });
});

describe("replacing records in the store", () => {
  beforeEach(() => {
    db.createOrganisation("pandas");
    db.createCollection("pandas", "hats");
    db.addItemToCollection("pandas", "hats", { type: "panama" });
  });

  it("replaces the record in the store", () => {
    expect(db.getItems("pandas", "hats")).toMatchInlineSnapshot(`
      {
        "count": 1,
        "items": [
          {
            "id": 1,
            "type": "panama",
          },
        ],
      }
    `);
    db.replaceById("pandas", "hats", 1, { type: "bowler" });
    expect(db.getItems("pandas", "hats")).toMatchInlineSnapshot(`
      {
        "count": 1,
        "items": [
          {
            "id": 1,
            "type": "bowler",
          },
        ],
      }
    `);
  });

  it("returns false if the record doesn't exist", () => {
    expect(db.replaceById("pandas", "hats", 2, { type: "bowler" })).toBe(false);
    expect(db.getItems("pandas", "hats")).toMatchInlineSnapshot(`
      {
        "count": 1,
        "items": [
          {
            "id": 1,
            "type": "panama",
          },
        ],
      }
    `);
  });
});

describe("patching records in the store", () => {
  beforeEach(() => {
    db.createOrganisation("pandas");
    db.createCollection("pandas", "hats");
    db.addItemToCollection("pandas", "hats", { type: "panama" });
  });

  it("patches the record in the store", () => {
    expect(db.getItems("pandas", "hats")).toStrictEqual({
      count: 1,
      items: [
        {
          id: 1,
          type: "panama",
        },
      ],
    });
    db.patchById("pandas", "hats", 1, { size: "medium" });
    expect(db.getItems("pandas", "hats")).toStrictEqual({
      count: 1,
      items: [
        {
          id: 1,
          size: "medium",
          type: "panama",
        },
      ],
    });
  });

  it("returns false if the record doesn't exist", () => {
    expect(db.patchById("pandas", "hats", 2, { type: "bowler" })).toBe(
      undefined,
    );
    expect(db.getItems("pandas", "hats")).toMatchInlineSnapshot(`
      {
        "count": 1,
        "items": [
          {
            "id": 1,
            "type": "panama",
          },
        ],
      }
    `);
  });
});

describe("deleting an item from a collection", () => {
  beforeEach(() => {
    db.createOrganisation("pandas");
    db.createCollection("pandas", "hats");
    db.addItemToCollection("pandas", "hats", { type: "panama" });
  });

  it("removes an existing item", () => {
    expect(db.getItems("pandas", "hats")).toStrictEqual({
      count: 1,
      items: [
        {
          id: 1,
          type: "panama",
        },
      ],
    });
    db.deleteById("pandas", "hats", 1);
    expect(db.getItems("pandas", "hats")).toStrictEqual({
      count: 0,
      items: [],
    });
  });

  it("returns false if the item doesn't exist", () => {
    expect(db.deleteById("pandas", "hats", 2)).toBe(false);
  });
});

describe("filtering records  in the store with expressions", () => {
  beforeEach(() => {
    db.createOrganisation("pandas");
    db.createCollection("pandas", "hats");
    db.addItemToCollection("pandas", "hats", { type: "panama", size: 3 });
    db.addItemToCollection("pandas", "hats", { type: "bowler", size: 1 });
    db.addItemToCollection("pandas", "hats", { type: "trucker", size: 4 });
  });

  it("selects for size >= 3", () => {
    const hats = db.getItems("pandas", "hats", { where: "_.size >= 3" });
    expect(hats).toMatchInlineSnapshot(`
      {
        "count": 2,
        "items": [
          {
            "id": 1,
            "size": 3,
            "type": "panama",
          },
          {
            "id": 3,
            "size": 4,
            "type": "trucker",
          },
        ],
      }
    `);
  });
});
