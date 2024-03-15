import { AstNode } from "./ast.ts";

type Sql = (root: string) => {
  sql: string;
  params: unknown[];
};

function sql(sql: string, params: unknown[]): Sql {
  return (_) => ({ sql, params });
}

export function compile(ast: AstNode): Sql {
  switch (ast.type) {
    case "FunCall":
      return ($) => {
        const [name, ..._args] = ast.value;
        if (name !== "like" || _args.length !== 2) {
          throw new Error(`Unknown function ${name} (${_args.length})`);
        }

        const argsSql = [] as string[];
        const argsParams = [] as unknown[];
        for (const ast of _args) {
          const { sql, params } = compile(ast)($);
          argsSql.push(sql);
          argsParams.push(params);
        }

        return {
          sql: `like(${argsSql[1]}, ${argsSql[0]})`,
          params: argsParams,
        };
      };
    case "MethodCall":
      return ($) => {
        const [obj, name] = ast.value;
        const { sql, params } = compile(obj)($);

        if (name === "toLowerCase") {
          return { sql: `LOWER(${sql})`, params: [...params] };
        }
        if (name === "toUpperCase") {
          return { sql: `UPPER(${sql})`, params: [...params] };
        }

        throw new Error(`Unknown method: ${name}`);
      };
    case "Id":
      return ($) => {
        if (ast.value === "id") {
          return { sql: "records.id", params: [] };
        } else {
          return { sql: $, params: [] };
        }
      };

    case "Literal":
      return sql("?", [ast.value]);

    case "Bracket": {
      return ($) => {
        const [a, b] = ast.value;
        const _a = compile(a)($);
        const _b = compile(b)($);
        return {
          sql: `(${_a.sql})->(${_b.sql})`,
          params: [..._a.params, ..._b.params],
        };
      };
    }

    case "Dot":
      return ($) => {
        const [a, b] = ast.value;
        const lhs = compile(a)($);

        return { sql: `(${lhs.sql}) ->> '$.${b}'`, params: [...lhs.params] };
      };

    case "Prefix":
      return ($) => {
        const v = compile(ast.value)($);

        switch (ast.operator) {
          case "OP_MINUS":
            return { sql: `(-${v.sql})`, params: [...v.params] };

          case "OP_NEGATE":
            return { sql: `(NOT ${v.sql})`, params: [...v.params] };
        }
      };

    case "BinOp":
      return ($) => {
        const [a, b] = ast.value;
        const lhs = compile(a)($);
        const rhs = compile(b)($);
        const params = [...lhs.params, ...rhs.params];
        switch (ast.operator) {
          case "OP_AND":
            return {
              sql: `(${lhs.sql} AND ${rhs.sql})`,
              params,
            };

          case "OP_OR":
            return {
              sql: `(${lhs.sql} OR ${rhs.sql})`,
              params,
            };
          case "OP_EQ":
            return {
              sql: `(${lhs.sql} = ${rhs.sql})`,
              params,
            };
          case "OP_LT":
            return {
              sql: `(${lhs.sql} < ${rhs.sql})`,
              params,
            };

          case "OP_LTE":
            return {
              sql: `(${lhs.sql} <= ${rhs.sql})`,
              params,
            };

          case "OP_GT":
            return {
              sql: `(${lhs.sql} > ${rhs.sql})`,
              params,
            };

          case "OP_GTE":
            return {
              sql: `((${lhs.sql}) >= (${rhs.sql}))`,
              params,
            };

          case "OP_NEQ":
            return {
              sql: `(${lhs.sql} <> ${rhs.sql})`,
              params,
            };
        }
      };
  }
}
