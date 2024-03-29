import { type Token, TokenType, BinOp } from "./tokenizer.ts";
import PaatakaExpressionError from "./PaatakaExpressionError.ts";

import { type JsonNode } from "./ast.ts";
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
function parseAtom(tokens: Token[]): JsonNode {
  let token = tokens.shift();
  /* v8 ignore next 3 */
  if (!token) {
    throw new PaatakaExpressionError("Out of tokens");
  }

  switch (token.type) {
    case "OPEN_PAREN": {
      let expr = parseExpr(tokens);
      let close = tokens.shift();
      if (close == undefined || close.type !== "CLOSE_PAREN") {
        throw new PaatakaExpressionError("Unclosed parenthetical");
      }
      return expr;
    }

    case "OPEN_BRACKET": {
      const values = parseArray(tokens);
      return { type: "ArrayLiteral", values };
    }

    case "IDENTIFIER": {
      const args = parseArgs(tokens);
      if (args != undefined) {
        switch (token.value) {
          case "like":
            return Ast.like(args[0], args[1]);
          case "glob":
            return Ast.glob(args[0], args[1]);
          default:
            throw new PaatakaExpressionError(
              `Invalid function name: ${token.value}:${args.length}`,
            );
        }
      }
      return Ast.id(token.value!);
    }
    case "STRING_LITERAL":
      return Ast.str(token.value!);

    case "NUMBER_LITERAL":
      return Ast.num(JSON.parse(token.value!) as number);

    default:
      throw new PaatakaExpressionError(`Unexpected ${token.type}`);
    /* v8 ignore next 2 */
  }
}

function parseArray(tokens: Token[]): JsonNode[] {
  let items = [] as JsonNode[];
  if (!tokens.length) {
    throw new PaatakaExpressionError("Unexpected EOF in array literal");
  }

  let next = tokens[0];
  if (next && next.type === "CLOSE_BRACKET") {
    tokens.shift();
  } else {
    items.push(parseExpr(tokens));

    while (tokens.length && tokens[0].type === "COMMA") {
      tokens.shift();
      items.push(parseExpr(tokens));
    }

    let close = tokens.shift();
    if (close?.type !== "CLOSE_BRACKET") {
      throw new PaatakaExpressionError(
        "Expected closing bracket for array literal",
      );
    }
  }
  return items;
}

function parseArgs(tokens: Token[]): JsonNode[] | undefined {
  let args = [] as JsonNode[];
  if (tokens.length === 0 || tokens[0].type !== "OPEN_PAREN") {
    return undefined;
  }
  tokens.shift();

  if (!tokens.length) {
    throw new PaatakaExpressionError("Unexpected EOF in argument list");
  }

  let next = tokens[0];
  if (next && next.type === "CLOSE_PAREN") {
    tokens.shift();
  } else {
    args.push(parseExpr(tokens));
    /* @ts-expect-error I think this is a bug in tsc */
    while (tokens.length && tokens[0].type === "COMMA") {
      tokens.shift();
      args.push(parseExpr(tokens));
    }

    let close = tokens.shift();
    if (close?.type !== "CLOSE_PAREN") {
      throw new PaatakaExpressionError("Expected close paren");
    }
  }

  return args;
}

// accessor := accessor '.' symbol '()'
//          := accessor '.' symbol
//          := accessor '[' expr ']'
//          := atom
function parseAccessor(tokens: Token[]): JsonNode {
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
        throw new PaatakaExpressionError('Missing identifier after "."');
      }
      const args = parseArgs(tokens);
      if (args !== undefined) {
        lhs = Ast.methodCall(lhs, prop.value, args);
      } else if (prop.value === "length") {
        lhs = Ast.length(lhs);
      } else {
        lhs = Ast.dot(lhs, prop.value);
      }
    } else if (next.type === "OPEN_BRACKET") {
      tokens.shift(); // eat the bracket
      let key = parseExpr(tokens);
      let close = tokens.shift(); // eat the closing bracket
      if (!close || close.type !== "CLOSE_BRACKET") {
        throw new PaatakaExpressionError('Missing "]"');
      }
      lhs = Ast.bracket(lhs, key);
    } else {
      return lhs;
    }
  }
}

// negated  := '!' negated
//          := '-' negated
//          := accessor
function parseNegated(tokens: Token[]): JsonNode {
  if (!tokens.length) {
    throw new PaatakaExpressionError(`Unexpected EOF reading expression`);
  }

  let token = tokens[0];
  let type = token.type;

  if (type === "OP_NEGATE" || type === "OP_MINUS") {
    tokens.shift()!;
    let inner = parseNegated(tokens);
    if (type === "OP_NEGATE") {
      return Ast.not(inner);
    }

    return Ast.negative(inner);
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

function parseComparison(tokens: Token[]): JsonNode {
  let lhs = parseNegated(tokens);
  for (;;) {
    if (tokens.length === 0) {
      return lhs;
    }

    let token = tokens[0];
    if (isComparisonType(token.type)) {
      tokens.shift();
      let rhs = parseNegated(tokens);
      lhs = Ast.binop(token.type, lhs, rhs);
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

function parseBoolean(tokens: Token[]): JsonNode {
  let lhs = parseComparison(tokens);
  for (;;) {
    if (tokens.length === 0) {
      return lhs;
    }

    let token = tokens[0];
    if (isBooleanType(token.type)) {
      tokens.shift();
      let rhs = parseComparison(tokens);
      lhs = Ast.binop(token.type, lhs, rhs);
    } else {
      return lhs;
    }
  }
}

function parseExpr(tokens: Token[]): JsonNode {
  return parseBoolean(tokens);
}

export function parse(tokens: Token[]): JsonNode {
  const expr = parseExpr(tokens);
  if (tokens.length !== 0) {
    throw new PaatakaExpressionError("Trailing tokens");
  }

  return expr;
}
