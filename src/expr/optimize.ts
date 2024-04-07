import { type SqlNode, type JsonNode } from "./ast.ts";

export function optimizeJsonExpr(node: JsonNode): JsonNode {
  switch (node.type) {
    case "Id":
      return node;
    case "Dot": {
      const [obj, prop2] = node.value;
      if (obj.type === "Dot") {
        const [inner, prop1] = obj.value;
        return { type: "Dot", value: [inner, prop1, prop2] };
      }
      return node;
    }
    case "Bracket": {
      const [a, b] = node.value;
      return {
        type: "Bracket",
        value: [optimizeJsonExpr(a), optimizeSqlExpr(b)],
      };
    }

    case "ArrayLiteral": {
      const values = node.values.map(optimizeJsonExpr);
      return { type: "ArrayLiteral", values };
    }

    case "ToJson": {
      const value = optimizeSqlExpr(node.value);
      if (value.type === "ToSql") {
        return value.value;
      }

      return { type: "ToJson", value };
    }

    case "ArrowFunction":
      throw new Error("poops");
  }
}

export function optimizeSqlExpr(node: SqlNode): SqlNode {
  switch (node.type) {
    case "LiteralString":
      return node;
    case "LiteralNumber":
      return node;
    case "Like":
    case "Glob": {
      const [a, b] = node.value;
      return {
        type: node.type,
        value: [optimizeSqlExpr(a), optimizeSqlExpr(b)],
      };
    }

    case "Length":
      return { type: "Length", value: optimizeJsonExpr(node.value) };

    case "Includes": {
      const [a, b] = node.value;
      return {
        type: "Includes",
        value: [optimizeJsonExpr(a), optimizeSqlExpr(b)],
      };
    }

    case "some": {
      const [a, fn] = node.value;
      const [param, expr] = fn.value;
      return {
        type: "some",
        value: [
          optimizeJsonExpr(a),
          {
            type: "ArrowFunction",
            value: [param, optimizeSqlExpr(expr)],
          },
        ],
      };
    }

    case "ToLower":
      return { type: "ToLower", value: optimizeSqlExpr(node.value) };
    case "ToUpper":
      return { type: "ToUpper", value: optimizeSqlExpr(node.value) };

    case "Prefix":
      return {
        type: "Prefix",
        operator: node.operator,
        value: optimizeSqlExpr(node.value),
      };

    case "ToSql": {
      const value = optimizeJsonExpr(node.value);
      if (value.type === "ToJson") {
        return value.value;
      }

      return { type: "ToSql", value };
    }
    case "BinOp": {
      const [a, b] = node.value;
      return {
        type: "BinOp",
        operator: node.operator,
        value: [optimizeSqlExpr(a), optimizeSqlExpr(b)],
      };
    }
  }
}
