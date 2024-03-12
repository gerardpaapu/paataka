import { test, expect } from "vitest";
import connection from "../connection.ts";
import { compile } from "./compiler.ts";
import { parse } from "./parser.ts";

test("some json operations in sqlite", () => {
  expect(
    connection
      .prepare(`SELECT '{ "foo": { "bar": "baz" }}' ->> '$.foo.bar'`)
      .pluck()
      .get(),
  ).toMatchInlineSnapshot(`"baz"`);
});

test("some compilations", () => {
  expect(compile(parse("_.foo.bar > _.baz"))("butt")).toMatchInlineSnapshot(`
    {
      "params": [],
      "sql": "(((butt) -> '$.foo') -> '$.bar' > (butt) -> '$.baz')",
    }
  `);

  expect(
    compile(parse('_.foo.bar["fart"] > _.baz[8]'))("butt"),
  ).toMatchInlineSnapshot(`
    {
      "params": [
        "fart",
        8,
      ],
      "sql": "((((butt) -> '$.foo') -> '$.bar')->(?) > ((butt) -> '$.baz')->(?))",
    }
  `);
});
