import { describe, it, test, expect, beforeEach } from "vitest";
import connection from "../connection.ts";
import * as db from "../db.ts";
import { compile } from "./compiler.ts";
import { parse } from "./parser.ts";
import { compileExpr } from "./index.ts";
import { tokenize } from "./tokenizer.ts";
import { source } from "./source.ts";

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
    const { sql, params } = compileExpr("_.foo[_.key]");
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
    const { sql, params } = compileExpr("_.baz.quux >= 3");
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

  it("can use string literals", () => {
    const src = source("_.author == 7");
    const tokens = tokenize(src);
    expect(tokens).toMatchInlineSnapshot(`
      [
        {
          "type": "IDENTIFIER",
          "value": "_",
        },
        {
          "type": "DOT",
        },
        {
          "type": "IDENTIFIER",
          "value": "author",
        },
        {
          "type": "OP_EQ",
        },
        {
          "type": "NUMBER_LITERAL",
          "value": "7",
        },
      ]
    `);

    const { sql, params } = compileExpr('_.author == "moon denier"');
    expect(sql).toMatchInlineSnapshot(`"((data) ->> '$.author' = ?)"`);
  });

  it("can reference the id", () => {
    const { sql } = compileExpr("id >= 23");
    expect(sql).toMatchInlineSnapshot(`"((records.id) >= (?))"`);
  });
});
