import { parse } from "./parser.ts";
import { tokenize } from "./tokenizer.ts";
import { compile } from "./compiler.ts";
import { source } from "./source.ts";
import { jsonToSql } from "./ast.ts";
import { optimizeSqlExpr } from "./optimize.ts";
import PaatakaExpressionError from "./PaatakaExpressionError.ts";

export function compileExpr(expr: string) {
  try {
    const src = source(expr);
    const tokens = tokenize(src);
    const ast1 = parse(tokens);
    const ast2 = optimizeSqlExpr(jsonToSql(ast1));
    const env = { vars: Object.create(null), count: 0 };
    const { sql, params } = compile(ast2, env)("data");
    return { sql, params };
  } catch (err: any) {
    if (err?.name !== "PaatakaExpressionError") {
      throw new PaatakaExpressionError(
        "Unexpected error processing expression",
      );
    }
    throw err;
  }
}
