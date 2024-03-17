import { parse } from "./parser.ts";
import { tokenize } from "./tokenizer.ts";
import { compile } from "./compiler.ts";
import { source } from "./source.ts";
import { jsonToSql } from "./ast.ts";
import { optimizeSqlExpr } from "./optimize.ts";

export function compileExpr(expr: string) {
  try {
    const src = source(expr);
    11;
    const tokens = tokenize(src);
    const ast1 = parse(tokens);
    const ast2 = optimizeSqlExpr(jsonToSql(ast1));
    const { sql, params } = compile(ast2)("data");
    return { sql, params };
  } catch (err) {
    console.error(err);
    throw err;
  }
}
