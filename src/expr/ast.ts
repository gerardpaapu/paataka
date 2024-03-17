import { type BinOp, type PrefixOp } from "./tokenizer.ts";

export type JsonNode =
  | { type: "Id"; value: string }
  | { type: "Dot"; value: [node: JsonNode, ...properties: string[]] }
  | { type: "Bracket"; value: [node: JsonNode, property: SqlNode] }
  | { type: "ToJson"; value: SqlNode };

export type SqlNode =
  | { type: "LiteralString"; value: string }
  | { type: "LiteralNumber"; value: number }
  | {
      type: "Like";
      value: [haystack: SqlNode, pattern: SqlNode];
    }
  | {
      type: "Includes";
      value: [haystack: JsonNode, needle: SqlNode];
    }
  | {
      type: "ToLower";
      value: SqlNode;
    }
  | {
      type: "ToUpper";
      value: SqlNode;
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

export function includes(a: JsonNode, b: JsonNode): JsonNode {
  return sqlToJson({ type: "Includes", value: [a, jsonToSql(b)] });
}

export function toUpper(value: JsonNode): JsonNode {
  return sqlToJson({ type: "ToUpper", value: jsonToSql(value) });
}

export function toLower(value: JsonNode): JsonNode {
  return sqlToJson({ type: "ToLower", value: jsonToSql(value) });
}

export function methodCall(
  obj: JsonNode,
  prop: string,
  args: JsonNode[],
): JsonNode {
  switch (prop) {
    case "toLowerCase":
      if (args.length !== 0) {
        throw new Error(`Wrong number of arguments to toLowerCase`);
      }
      return toLower(obj);
    case "toUpper":
      if (args.length !== 0) {
        throw new Error(`Wrong number of arguments to toUpperCase`);
      }
      return toUpper(obj);

    case "includes":
      if (args.length !== 1) {
        throw new Error(`Wrong number of arguments to includes`);
      }

      return includes(obj, args[0]);
    default:
      throw new Error(`Unknown method: ${prop}`);
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
