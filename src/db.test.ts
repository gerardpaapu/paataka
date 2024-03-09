import { describe, expect, it, beforeEach } from "vitest";
import * as db from "./db.ts";

beforeEach(() => {
  db.reset();
});

describe("creating groups", () => {
  it("groups starts empty", () => {
    let groups = db.getGroups();
    expect(groups).toHaveLength(0);
  });

  it("adds a group", () => {
    db.createGroup("pandas");
    db.createGroup("dogs");

    let groups = db.getGroups();
    expect(groups).toMatchInlineSnapshot(`
      [
        {
          "id": 1,
          "name": "pandas",
        },
        {
          "id": 2,
          "name": "dogs",
        },
      ]
    `);
  });

  it("throws if you create duplicates", () => {
    db.createGroup("pandas");
    expect(() => {
      db.createGroup("pandas");
    }).toThrow();
  });
});

describe("creating collections within a group", () => {
  it("creates collections", () => {
    db.createGroup("pandas");
    db.createCollection("pandas", "hats");
    db.createCollection("pandas", "pants");
    expect(db.getCollections("pandas")).toMatchInlineSnapshot(`
      [
        {
          "group_name": "pandas",
          "id": 1,
          "name": "hats",
        },
        {
          "group_name": "pandas",
          "id": 2,
          "name": "pants",
        },
      ]
    `);
  });

  it("fails to create duplicate collections", () => {
    expect(() => {
      db.createGroup("pandas");
      db.createCollection("pandas", "hats");
      db.createCollection("pandas", "hats");
    }).toThrow();
  });

  it("deletes an existing group", () => {
    db.createGroup("pandas");
    db.createCollection("pandas", "hats");
    db.deleteGroup("pandas");
    expect(db.getGroups()).toMatchInlineSnapshot(`[]`);
  });

  it("fails to delete a missing group", () => {
    expect(db.deleteGroup("butts")).toBe(false);
  });
});

describe("getting records", () => {
  beforeEach(() => {
    db.createGroup("pandas");
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
    db.createGroup("pandas");
    db.createCollection("pandas", "hats");
    db.addItemToCollection("pandas", "hats", { type: "panama" });
  });

  it("replaces the record in the store", () => {
    expect(db.getItems("pandas", "hats")).toMatchInlineSnapshot(`
      [
        {
          "id": 1,
          "type": "panama",
        },
      ]
    `);
    db.replaceById("pandas", "hats", 1, { type: "bowler" });
    expect(db.getItems("pandas", "hats")).toMatchInlineSnapshot(`
      [
        {
          "id": 1,
          "type": "bowler",
        },
      ]
    `);
  });

  it("returns false if the record doesn't exist", () => {
    expect(db.replaceById("pandas", "hats", 2, { type: "bowler" })).toBe(false);
    expect(db.getItems("pandas", "hats")).toMatchInlineSnapshot(`
      [
        {
          "id": 1,
          "type": "panama",
        },
      ]
    `);
  });
});

describe("patching records in the store", () => {
  beforeEach(() => {
    db.createGroup("pandas");
    db.createCollection("pandas", "hats");
    db.addItemToCollection("pandas", "hats", { type: "panama" });
  });

  it("patches the record in the store", () => {
    expect(db.getItems("pandas", "hats")).toStrictEqual([
      {
        id: 1,
        type: "panama",
      },
    ]);
    db.patchById("pandas", "hats", 1, { size: "medium" });
    expect(db.getItems("pandas", "hats")).toStrictEqual([
      {
        id: 1,
        size: "medium",
        type: "panama",
      },
    ]);
  });

  it("returns false if the record doesn't exist", () => {
    expect(db.patchById("pandas", "hats", 2, { type: "bowler" })).toBe(false);
    expect(db.getItems("pandas", "hats")).toMatchInlineSnapshot(`
      [
        {
          "id": 1,
          "type": "panama",
        },
      ]
    `);
  });
});

describe("deleting an item from a collection", () => {
  beforeEach(() => {
    db.createGroup("pandas");
    db.createCollection("pandas", "hats");
    db.addItemToCollection("pandas", "hats", { type: "panama" });
  });

  it("removes an existing item", () => {
    expect(db.getItems("pandas", "hats")).toStrictEqual([
      {
        id: 1,
        type: "panama",
      },
    ]);
    db.deleteById("pandas", "hats", 1);
    expect(db.getItems("pandas", "hats")).toStrictEqual([]);
  });

  it("returns false if the item doesn't exist", () => {
    expect(db.deleteById("pandas", "hats", 2)).toBe(false);
  });
});
