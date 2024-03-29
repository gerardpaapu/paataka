import { describe, it, test, expect, beforeEach } from "vitest";
import connection from "../connection.ts";
import * as db from "../db.ts";
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
      bux: [1, 2, 3],
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
        "baz",
        "box",
        "biz",
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
        "sql": "((jsonb(data -> '$.baz.quux')->>'$') >= ?)",
      }
    `);

    const result = connection
      .prepare(`SELECT json(data) FROM records WHERE ${sql}`)
      .pluck()
      .all(...params);

    expect(result).toMatchInlineSnapshot(`
      [
        "{"key":"bar","foo":{"bar":"baz"},"baz":{"quux":7}}",
        "{"key":"bar","foo":{"bar":"box"},"bux":[1,2,3],"baz":{"quux":3}}",
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
    expect(sql).toMatchInlineSnapshot(
      `"((jsonb(data -> '$.author')->>'$') = ?)"`,
    );
  });

  it("can reference the id", () => {
    const { sql } = compileExpr("id >= 23");
    expect(sql).toMatchInlineSnapshot(`"((records.id->>'$') >= ?)"`);
  });

  it("can call the like function", () => {
    const { sql, params } = compileExpr('like("fart", "%art")');
    expect({ sql, params }).toMatchInlineSnapshot(
      `
      {
        "params": [
          "fart",
          "%art",
        ],
        "sql": "like(?, ?)",
      }
    `,
    );
  });

  it("can call the .includes method", () => {
    const { sql, params } = compileExpr("_.foo.includes(2)");
    expect({ sql, params }).toMatchInlineSnapshot(`
      {
        "params": [
          2,
        ],
        "sql": "(EXISTS (SELECT item.value as j
                               FROM json_each(jsonb(data -> '$.foo')) as item
                               WHERE j = ?))",
      }
    `);

    const result = connection
      .prepare(
        `WITH t(data) AS (SELECT jsonb('{ "foo": [1, 2, 3] }'))
         SELECT json(data) FROM t
         WHERE ${sql}`,
      )
      .all(...params);

    expect(result).toMatchInlineSnapshot(`
      [
        {
          "json(data)": "{"foo":[1,2,3]}",
        },
      ]
    `);
  });

  it("gets the length of an array", () => {
    const { sql, params } = compileExpr("_.foo.length >= 2");

    const result = connection
      .prepare(
        `WITH t(data) AS (SELECT jsonb('{ "foo": [1, 2, 3] }'))
       SELECT json(data) FROM t
       WHERE ${sql}`,
      )
      .all(...params);

    expect(result).toMatchInlineSnapshot(`
      [
        {
          "json(data)": "{"foo":[1,2,3]}",
        },
      ]
    `);
  });

  it("uses the result of toUpper to access a property", () => {
    const { sql, params } = compileExpr('_.foo["k".toUpperCase()]');
    expect(sql).toMatchInlineSnapshot(`"((jsonb(data -> '$.foo')->UPPER(?))->>'$')"`);
  });

  it("gets the length of a string", () => {
    const { sql, params } = compileExpr("_.foo.length >= 3");
    expect(sql).toMatchInlineSnapshot(`
      "(CASE json_type(jsonb(data -> '$.foo'))
                  WHEN 'text'  THEN LENGTH(jsonb(data -> '$.foo') ->> '$')
                  WHEN 'array' THEN json_array_length(jsonb(data -> '$.foo'))
                  ELSE (jsonb(data -> '$.foo')->>'$.length')
                END
       >= ?)"
    `);
    const result = connection
      .prepare(
        `WITH t(data) AS (SELECT jsonb('{ "foo": "bar" }'))
       SELECT json(data) FROM t
       WHERE ${sql}`,
      )
      .all(...params);

    expect(result).toMatchInlineSnapshot(`
      [
        {
          "json(data)": "{"foo":"bar"}",
        },
      ]
    `);
  });
});
