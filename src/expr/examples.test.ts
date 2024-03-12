import { describe, it, test, expect, beforeEach } from "vitest";
import connection from "../connection.ts";
import * as db from "../db.ts";
import { compile } from "./compiler.ts";
import { parse } from "./parser.ts";

// TODO: symbols should only be _ or id and they should compile appropriately
// TODO: implement '&&' and '||'

describe("filtering data", () => {
  beforeEach(() => {
    db.reset();
    db.createOrganisation("pandas");
    db.createCollection("pandas", "hats");
    db.addItemToCollection("pandas", "hats", {
      key: "bar",
      foo: { bar: "baz" },
      baz: { quux: 7 },
    });

    db.addItemToCollection("pandas", "hats", {
      key: "bar",
      foo: { bar: "box" },
      baz: { quux: 3 },
    });

    db.addItemToCollection("pandas", "hats", {
      key: "bar",
      foo: { bar: "biz" },
      baz: { quux: 1 },
    });
  });

  it("can look up properties in other properties", () => {
    const ast = parse("_.foo[_.key]");
    const { sql, params } = compile(ast)("data");
    const result = connection
      .prepare(`SELECT ${sql} FROM records`)
      .pluck()
      .all(...params);

    expect(result).toMatchInlineSnapshot(`
      [
        ""baz"",
        ""box"",
        ""biz"",
      ]
    `);
  });

  it("can filter by nested properties", () => {
    const ast = parse("_.baz.quux >= 3");
    const { sql, params } = compile(ast)("data");
    expect({ sql, params }).toMatchInlineSnapshot(`
      {
        "params": [
          3,
        ],
        "sql": "((((data) ->> '$.baz') ->> '$.quux') >= (?))",
      }
    `);

    const result = connection
      .prepare(`SELECT json(data) FROM records WHERE ${sql}`)
      .pluck()
      .all(...params);

    expect(result).toMatchInlineSnapshot(`
      [
        "{"key":"bar","foo":{"bar":"baz"},"baz":{"quux":7}}",
        "{"key":"bar","foo":{"bar":"box"},"baz":{"quux":3}}",
      ]
    `);
  });
});
