import { type BinOp, type PrefixOp } from "./tokenizer.ts";

export type AstNode =
  | { type: "Literal"; value: string | number }
  | { type: "Id"; value: string }
  | { type: "Dot"; value: [node: AstNode, property: string] }
  | {
      type: "MethodCall";
      value: [object: AstNode, name: string, arguments: AstNode[]];
    }
  | {
      type: "FunCall";
      value: [name: string, ...arguments: AstNode[]];
    }
  | { type: "Bracket"; value: [node: AstNode, property: AstNode] }
  | { type: "BinOp"; operator: BinOp; value: [a: AstNode, b: AstNode] }
  | { type: "Prefix"; operator: PrefixOp; value: AstNode };

export function str(value: string): AstNode {
  return { type: "Literal", value };
}

export function num(value: number): AstNode {
  return { type: "Literal", value };
}

export function id(value: string): AstNode {
  return { type: "Id", value };
}

export function binop(operator: BinOp, a: AstNode, b: AstNode): AstNode {
  return { type: "BinOp", operator, value: [a, b] };
}

export function funcall(name: string, ...args: AstNode[]): AstNode {
  return { type: "FunCall", value: [name, ...args] };
}
