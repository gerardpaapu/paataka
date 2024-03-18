import { JsonNode, SqlNode } from "./ast.ts";
import PaatakaExpressionError from "./PaatakaExpressionError.ts";

type Sql = (root: string) => {
  sql: string;
  params: unknown[];
};

function sql(sql: string, params: unknown[]): Sql {
  return (_) => ({ sql, params });
}

function compileJsonValue(ast: JsonNode): Sql {
  switch (ast.type) {
    case "Id":
      return ($) => {
        switch (ast.value) {
          case "_":
            return { sql: $, params: [] };
          case "id":
            return { sql: "records.id", params: [] };
          default:
            throw new PaatakaExpressionError(`Invalid identifier ${ast.value}`);
        }
      };

    case "Dot":
      return ($) => {
        const [a, ...b] = ast.value;
        const _a = compileJsonValue(a)($);
        const _b = b.map((prop) => `.${prop}`).join("");
        return {
          sql: `jsonb(${_a.sql} -> '$${_b}')`,
          params: _a.params,
        };
      };

    case "Bracket":
      return ($) => {
        const [a, b] = ast.value;
        const _a = compileJsonValue(a)($);
        const _b = compile(b)($);
        return {
          sql: `(${_a.sql}->${_b.sql})`,
          params: [..._a.params, ..._b.params],
        };
      };

    case "ToJson":
      return ($) => {
        const val = compile(ast.value)($);
        return {
          sql: `jsonb(json_quote(${val.sql}))`,
          params: val.params,
        };
      };
  }
}

export function compile(ast: SqlNode): Sql {
  switch (ast.type) {
    case "LiteralString":
      return ($) => {
        return {
          sql: "?",
          params: [ast.value],
        };
      };
    case "LiteralNumber":
      return ($) => {
        return {
          sql: "?",
          params: [ast.value],
        };
      };

    case "Like":
      return ($) => {
        const [a, b] = ast.value;
        const _a = compile(a)($);
        const _b = compile(b)($);
        return {
          // don't forget to swap the order of arguments
          sql: `like(${_b.sql}, ${_a.sql})`,
          params: [..._a.params, ..._b.params],
        };
      };

    case "Length":
      return ($) => {
        const value = compileJsonValue(ast.value)($);
        return {
          sql: `CASE json_type(${value.sql})
            WHEN 'text'  THEN LENGTH(${value.sql} ->> '$')
            WHEN 'array' THEN json_array_length(${value.sql})
            ELSE (${value.sql}->>'$.length')
          END\n`,
          params: [...value.params, ...value.params, ...value.params],
        };
      };

    case "Includes":
      return ($) => {
        const [a, b] = ast.value;
        const _a = compileJsonValue(a)($);
        const _b = compile(b)($);

        return {
          sql: `(EXISTS (SELECT item.value as j
                         FROM json_each(${_a.sql}) as item
                         WHERE j = ${_b.sql}))`,
          params: [..._a.params, ..._b.params],
        };
      };

    case "ToLower":
      return ($) => {
        const val = compile(ast.value)($);
        return {
          sql: `LOWER(${val.sql})`,
          params: [...val.params],
        };
      };

    case "ToUpper":
      return ($) => {
        const val = compile(ast.value)($);
        return {
          sql: `UPPER(${val.sql})`,
          params: [...val.params],
        };
      };

    case "Prefix":
      return ($) => {
        const val = compile(ast.value)($);
        let sql =
          ast.operator === "OP_MINUS" ? `(- ${val.sql})` : `(NOT ${val.sql})`;
        return { sql, params: val.params };
      };

    case "ToSql":
      return ($) => {
        const val = compileJsonValue(ast.value)($);
        return {
          sql: `(${val.sql}->>'$')`,
          params: val.params,
        };
      };

    case "BinOp":
      return ($) => {
        const [a, b] = ast.value;
        const _a = compile(a)($);
        const _b = compile(b)($);
        const params = [..._a.params, ..._b.params];

        switch (ast.operator) {
          case "OP_GT":
            return {
              sql: `(${_a.sql} > ${_b.sql})`,
              params,
            };

          case "OP_GTE":
            return {
              sql: `(${_a.sql} >= ${_b.sql})`,
              params,
            };
          case "OP_EQ":
            return {
              sql: `(${_a.sql} = ${_b.sql})`,
              params,
            };
          case "OP_LT":
            return {
              sql: `(${_a.sql} < ${_b.sql})`,
              params,
            };
          case "OP_LTE":
            return {
              sql: `(${_a.sql} <= ${_b.sql})`,
              params,
            };
          case "OP_NEQ":
            return {
              sql: `(${_a.sql} <> ${_b.sql})`,
              params,
            };
          case "OP_AND":
            return {
              sql: `(${_a.sql} AND ${_b.sql})`,
              params,
            };
          case "OP_OR":
            return {
              sql: `(${_a.sql} OR ${_b.sql})`,
              params,
            };
        }
      };
  }
}
