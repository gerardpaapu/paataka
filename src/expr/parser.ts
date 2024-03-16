import { type Token, TokenType, BinOp } from "./tokenizer.ts";
import { type AstNode } from "./ast.ts";
import * as Ast from "./ast.ts";

//
// atom := literal
//      := symbol
//      := '(' expr  ')'
//
// accessor := accessor '.' symbol
//          := accessor '[' expr ']'
//          := atom
//
// negated  := '!' negated
//          := '-' negated
//          := accessor
//
// comparison := comparison '>' negated
//            := comparison '>=' negated
//            := comparison '==' negated
//            := comparison '<=' negated
//            := comparison '<' negated
//            := comparison '!=' negated
//            := negated
//
// expr = comparison

// atom := literal
//      := symbol
//      := '(' expr  ')'
function parseAtom(tokens: Token[]): AstNode {
  let token = tokens.shift();
  if (!token) {
    throw new Error("Out of tokens");
  }

  switch (token.type) {
    case "OPEN_PAREN": {
      let expr = parseExpr(tokens);
      let close = tokens.shift();
      if (close == undefined || close.type !== "CLOSE_PAREN") {
        throw new Error();
      }
      return expr;
    }

    case "IDENTIFIER":
      if (!token.value) {
        throw new Error();
      }

      if (tokens[0]?.type === "OPEN_PAREN") {
        const args = parseArgs(tokens);
        return Ast.funcall(token.value, ...args);
      }

      return Ast.id(token.value);

    case "STRING_LITERAL":
      return Ast.str(token.value!);

    case "NUMBER_LITERAL":
      return Ast.num(JSON.parse(token.value!) as number);

    default:
      throw new Error(`Unexpected ${token.type}`);
  }
}

function parseArgs(tokens: Token[]): AstNode[] {
  let args = [] as AstNode[];
  if (tokens.shift()?.type !== "OPEN_PAREN") {
    throw new Error("Arguments should start with a Paren");
  }

  if (!tokens.length) {
    throw new Error("Unexpected EOF in argument list");
  }

  let next = tokens[0];
  if (next && next.type === "CLOSE_PAREN") {
    tokens.shift();
  } else {
    args.push(parseExpr(tokens));
    while (tokens[0].type === "COMMA") {
      tokens.shift();
      args.push(parseExpr(tokens));
    }

    let close = tokens.shift();
    if (close?.type !== "CLOSE_PAREN") {
      throw new Error("Expected close paren");
    }
  }

  return args;
}

// accessor := accessor '.' symbol '()'
//          := accessor '.' symbol
//          := accessor '[' expr ']'
//          := atom
function parseAccessor(tokens: Token[]): AstNode {
  let lhs = parseAtom(tokens);
  for (;;) {
    if (tokens.length === 0) {
      return lhs;
    }

    let next = tokens[0];
    if (next.type === "DOT") {
      tokens.shift();
      let prop = tokens.shift();
      if (!prop || prop.type !== "IDENTIFIER" || !prop.value) {
        throw new Error('Missing identifier after "."');
      }

      if (tokens[0]?.type === "OPEN_PAREN") {
        const args = parseArgs(tokens);

        lhs = Ast.methodCall(lhs, prop.value, ...args);
      } else {
        lhs = Ast.dot(lhs, prop.value);
      }
    } else if (next.type === "OPEN_BRACKET") {
      tokens.shift(); // eat the bracket
      let key = parseExpr(tokens);
      let close = tokens.shift(); // eat the closing bracket
      if (!close || close.type !== "CLOSE_BRACKET") {
        throw new Error('Missing "]"');
      }
      lhs = { type: "Bracket", value: [lhs, key] };
    } else {
      return lhs;
    }
  }
}

// negated  := '!' negated
//          := '-' negated
//          := accessor
function parseNegated(tokens: Token[]): AstNode {
  let token = tokens[0];
  let type = token.type;

  if (type === "OP_NEGATE" || type === "OP_MINUS") {
    tokens.shift()!;
    let inner = parseNegated(tokens);
    return { type: "Prefix", operator: type, value: inner };
  }

  return parseAccessor(tokens);
}

function isComparisonType(t: TokenType): t is BinOp {
  switch (t) {
    case "OP_GT":
    case "OP_GTE":
    case "OP_EQ":
    case "OP_LT":
    case "OP_LTE":
    case "OP_NEQ":
      return true;
    default:
      return false;
  }
}

function parseComparison(tokens: Token[]): AstNode {
  let lhs = parseNegated(tokens);
  for (;;) {
    if (tokens.length === 0) {
      return lhs;
    }

    let token = tokens[0];
    if (isComparisonType(token.type)) {
      tokens.shift();
      let rhs = parseNegated(tokens);
      lhs = { type: "BinOp", operator: token.type, value: [lhs, rhs] };
    } else {
      return lhs;
    }
  }
}

function isBooleanType(t: TokenType): t is BinOp {
  switch (t) {
    case "OP_AND":
    case "OP_OR":
      return true;
    default:
      return false;
  }
}

function parseBoolean(tokens: Token[]): AstNode {
  let lhs = parseComparison(tokens);
  for (;;) {
    if (tokens.length === 0) {
      return lhs;
    }

    let token = tokens[0];
    if (isBooleanType(token.type)) {
      tokens.shift();
      let rhs = parseComparison(tokens);
      lhs = { type: "BinOp", operator: token.type, value: [lhs, rhs] };
    } else {
      return lhs;
    }
  }
}

function parseExpr(tokens: Token[]): AstNode {
  return parseBoolean(tokens);
}

export function parse(tokens: Token[]): AstNode {
  const expr = parseExpr(tokens);
  if (tokens.length !== 0) {
    throw new Error("Trailing tokens");
  }

  return expr;
}
/*
console.log(
  JSON.stringify(parse('_.foo.bar["baz"] >= _.fizz.buzz[69] >= 2'), null, 2),
);
*/
