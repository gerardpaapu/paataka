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
    case "Id":
      return ($) => ({ sql: $, params: [] });

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
