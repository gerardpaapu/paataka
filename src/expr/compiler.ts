import { JsonNode, SqlNode } from "./ast.ts";
import PaatakaExpressionError from "./PaatakaExpressionError.ts";

type Sql = (root: string) => {
  sql: string;
  params: unknown[];
};

interface Env {
  vars: Record<string, Sql>;
  count: number;
}

function compileJsonValue(ast: JsonNode, env: Env): Sql {
  switch (ast.type) {
    case "Id":
      return ($) => {
        if (ast.value in env.vars) {
          return env.vars[ast.value]($);
        }

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
        const _a = compileJsonValue(a, env)($);
        const _b = b.map((prop) => `.${prop}`).join("");
        return {
          sql: `jsonb(${_a.sql} -> '$${_b}')`,
          params: _a.params,
        };
      };

    case "Bracket":
      return ($) => {
        const [a, b] = ast.value;
        const _a = compileJsonValue(a, env)($);
        const _b = compileSqlNode(b, env)($);
        return {
          sql: `(${_a.sql}->${_b.sql})`,
          params: [..._a.params, ..._b.params],
        };
      };

    case "ToJson":
      return ($) => {
        const val = compileSqlNode(ast.value, env)($);
        return {
          sql: `jsonb(json_quote(${val.sql}))`,
          params: val.params,
        };
      };

    case "ArrayLiteral":
      return ($) => {
        const values = ast.values.map((v) => compileJsonValue(v, env)($));
        return {
          sql: `jsonb_array(${values.map((_) => _.sql).join(", ")})`,
          params: values.flatMap((_) => _.params),
        };
      };

    case "ArrowFunction":
      throw new Error(`Can't compile naked arrow function`);
  }
}

export function compileSqlNode(ast: SqlNode, env: Env): Sql {
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
        const _a = compileSqlNode(a, env)($);
        const _b = compileSqlNode(b, env)($);
        return {
          // don't forget to swap the order of arguments
          sql: `like(${_b.sql}, ${_a.sql})`,
          params: [..._a.params, ..._b.params],
        };
      };
    case "Glob":
      return ($) => {
        const [a, b] = ast.value;
        const _a = compileSqlNode(a, env)($);
        const _b = compileSqlNode(b, env)($);

        return {
          // don't forget to swap the order of arguments
          sql: `glob(${_b.sql}, ${_a.sql})`,
          params: [..._a.params, ..._b.params],
        };
      };
    case "Length":
      return ($) => {
        const value = compileJsonValue(ast.value, env)($);
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
        const _a = compileJsonValue(a, env)($);
        const _b = compileSqlNode(b, env)($);

        return {
          sql: `(EXISTS (SELECT item.value as j
                         FROM json_each(${_a.sql}) as item
                         WHERE j = ${_b.sql}))`,
          params: [..._a.params, ..._b.params],
        };
      };

    case "Every":
      return ($) => {
        const [needle, fn] = ast.value;
        if (fn.type !== "ArrowFunction") {
          throw new Error("some takes a function literal");
        }

        const [parameter, expr] = fn.value;
        const name = `json_${env.count + 1}`;
        const env_ = {
          count: env.count + 1,
          vars: {
            ...env.vars,
            [parameter]: () => ({ sql: name, params: [] }),
          },
        };
        const _a = compileJsonValue(needle, env)($);
        const _b = compileSqlNode(expr, env_)($);

        return {
          sql: `(NOT EXISTS (SELECT jsonb(json_quote(item.value)) as ${name}
                           FROM json_each(${_a.sql}) as item
                           WHERE NOT (${_b.sql})))`,
          params: [..._a.params, ..._b.params],
        };
      };

    case "Some":
      return ($) => {
        const [needle, fn] = ast.value;
        if (fn.type !== "ArrowFunction") {
          throw new Error("some takes a function literal");
        }

        const [parameter, expr] = fn.value;
        const name = `json_${env.count + 1}`;
        const env_ = {
          count: env.count + 1,
          vars: {
            ...env.vars,
            [parameter]: () => ({ sql: name, params: [] }),
          },
        };
        const _a = compileJsonValue(needle, env)($);
        const _b = compileSqlNode(expr, env_)($);

        return {
          sql: `(EXISTS (SELECT jsonb(json_quote(item.value)) as ${name}
                         FROM json_each(${_a.sql}) as item
                         WHERE ${_b.sql}))`,
          params: [..._a.params, ..._b.params],
        };
      };

    case "ToLower":
      return ($) => {
        const val = compileSqlNode(ast.value, env)($);
        return {
          sql: `LOWER(${val.sql})`,
          params: [...val.params],
        };
      };

    case "ToUpper":
      return ($) => {
        const val = compileSqlNode(ast.value, env)($);
        return {
          sql: `UPPER(${val.sql})`,
          params: [...val.params],
        };
      };

    case "Prefix":
      return ($) => {
        const val = compileSqlNode(ast.value, env)($);
        let sql =
          ast.operator === "OP_MINUS" ? `(- ${val.sql})` : `(NOT ${val.sql})`;
        return { sql, params: val.params };
      };

    case "ToSql":
      return ($) => {
        const val = compileJsonValue(ast.value, env)($);
        return {
          sql: `(${val.sql}->>'$')`,
          params: val.params,
        };
      };

    case "BinOp":
      return ($) => {
        const [a, b] = ast.value;
        const _a = compileSqlNode(a, env)($);
        const _b = compileSqlNode(b, env)($);
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
