import { type BinOp, type PrefixOp } from "./tokenizer.ts";
import PaatakaExpressionError from "./PaatakaExpressionError.ts";

export type ArrowFunctionNode = {
  type: "ArrowFunction";
  value: [parameter: string, body: SqlNode];
};

export function isArrowFunction(ast: JsonNode): ast is ArrowFunctionNode {
  return ast.type === "ArrowFunction";
}

export type JsonNode =
  | { type: "Id"; value: string }
  | { type: "Dot"; value: [node: JsonNode, ...properties: string[]] }
  | { type: "Bracket"; value: [node: JsonNode, property: SqlNode] }
  | { type: "ToJson"; value: SqlNode }
  | { type: "ArrayLiteral"; values: JsonNode[] }
  // This is a `JsonNode` as convenience only, it of course cannot
  // be compiled as a JSON value
  | ArrowFunctionNode;

export type SqlNode =
  | { type: "LiteralString"; value: string }
  | { type: "LiteralNumber"; value: number }
  | {
      type: "Like";
      value: [haystack: SqlNode, pattern: SqlNode];
    }
  | {
      type: "Length";
      value: JsonNode;
    }
  | {
      type: "Includes";
      value: [haystack: JsonNode, needle: SqlNode];
    }
  | {
      type: "Some";
      value: [haystack: JsonNode, fn: ArrowFunctionNode];
    }
  | {
      type: "Every";
      value: [haystack: JsonNode, fn: ArrowFunctionNode];
    }
  | {
      type: "ToLower";
      value: SqlNode;
    }
  | {
      type: "ToUpper";
      value: SqlNode;
    }
  | {
      type: "Glob";
      value: [text: SqlNode, pattern: SqlNode];
    }
  | { type: "Prefix"; operator: PrefixOp; value: SqlNode }
  | { type: "ToSql"; value: JsonNode }
  | { type: "BinOp"; operator: BinOp; value: [a: SqlNode, b: SqlNode] };

export function sqlToJson(value: SqlNode): JsonNode {
  return { type: "ToJson", value };
}

export function jsonToSql(value: JsonNode): SqlNode {
  return { type: "ToSql", value };
}

export function dot(obj: JsonNode, prop: string): JsonNode {
  return { type: "Dot", value: [obj, prop] };
}

export function bracket(obj: JsonNode, value: JsonNode): JsonNode {
  return { type: "Bracket", value: [obj, jsonToSql(value)] };
}

export function str(value: string): JsonNode {
  return sqlToJson({ type: "LiteralString", value });
}

export function num(value: number): JsonNode {
  return sqlToJson({ type: "LiteralNumber", value });
}

export function id(value: string): JsonNode {
  return { type: "Id", value };
}

export function binop(operator: BinOp, a: JsonNode, b: JsonNode): JsonNode {
  return sqlToJson({
    type: "BinOp",
    operator,
    value: [jsonToSql(a), jsonToSql(b)],
  });
}

export function like(a: JsonNode, b: JsonNode): JsonNode {
  return sqlToJson({ type: "Like", value: [jsonToSql(a), jsonToSql(b)] });
}

export function glob(a: JsonNode, b: JsonNode): JsonNode {
  return sqlToJson({ type: "Glob", value: [jsonToSql(a), jsonToSql(b)] });
}

export function includes(a: JsonNode, b: JsonNode): JsonNode {
  return sqlToJson({ type: "Includes", value: [a, jsonToSql(b)] });
}

export function toUpper(value: JsonNode): JsonNode {
  return sqlToJson({ type: "ToUpper", value: jsonToSql(value) });
}

export function toLower(value: JsonNode): JsonNode {
  return sqlToJson({ type: "ToLower", value: jsonToSql(value) });
}

export function length(value: JsonNode): JsonNode {
  return sqlToJson({ type: "Length", value });
}

export function methodCall(
  obj: JsonNode,
  prop: string,
  args: JsonNode[],
): JsonNode {
  switch (prop) {
    case "toLowerCase":
      if (args.length !== 0) {
        throw new PaatakaExpressionError(
          `Wrong number of arguments to toLowerCase`,
        );
      }
      return toLower(obj);

    case "some": {
      const fn = args[0];
      if (fn == undefined || !isArrowFunction(fn)) {
        throw new PaatakaExpressionError(
          `.some() must be passed an arrow function`,
        );
      }

      if (args.length !== 1) {
        throw new PaatakaExpressionError(`.some() takes exactly one argument`);
      }

      return some(obj, fn);
    }

    case "every": {
      const fn = args[0];
      if (fn == undefined || !isArrowFunction(fn)) {
        throw new PaatakaExpressionError(
          `.every() must be passed an arrow function`,
        );
      }

      if (args.length !== 1) {
        throw new PaatakaExpressionError(
          `Wrong number of arguments to .every()`,
        );
      }

      return every(obj, fn);
    }
    case "toUpperCase":
      if (args.length !== 0) {
        throw new PaatakaExpressionError(
          `Wrong number of arguments to toUpperCase`,
        );
      }
      return toUpper(obj);

    case "includes":
      if (args.length !== 1) {
        throw new PaatakaExpressionError(
          `Wrong number of arguments to includes`,
        );
      }

      return includes(obj, args[0]);
    default:
      throw new PaatakaExpressionError(`Unknown method: ${prop}`);
  }
}

export function not(value: JsonNode): JsonNode {
  return sqlToJson({
    type: "Prefix",
    operator: "OP_NEGATE",
    value: jsonToSql(value),
  });
}

export function negative(value: JsonNode): JsonNode {
  return sqlToJson({
    type: "Prefix",
    operator: "OP_MINUS",
    value: jsonToSql(value),
  });
}

export function some(obj: JsonNode, fn: ArrowFunctionNode): JsonNode {
  return sqlToJson({ type: "Some", value: [obj, fn] });
}

export function every(obj: JsonNode, fn: ArrowFunctionNode): JsonNode {
  return sqlToJson({ type: "Every", value: [obj, fn] });
}

export function arrowFn(param: string, body: JsonNode): JsonNode {
  return { type: "ArrowFunction", value: [param, jsonToSql(body)] };
}
