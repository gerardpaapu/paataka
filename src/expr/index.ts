import { parse } from "./parser.ts";
import { tokenize } from "./tokenizer.ts";
import { compile } from "./compiler.ts";
import { source } from "./source.ts";

export function compileExpr(expr: string) {
  try {
    const src = source(expr);
    const tokens = tokenize(src);
    const ast = parse(tokens);
    const { sql, params } = compile(ast)("data");
    return { sql, params };
  } catch (err) {
    console.error(err);
    throw err;
  }
}
