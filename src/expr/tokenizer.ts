import { type Source, peek, pop, source, skipWhitespace } from "./source.ts";

export type BinOp =
  | "OP_GT"
  | "OP_GTE"
  | "OP_EQ"
  | "OP_LT"
  | "OP_LTE"
  | "OP_NEQ"
  | "OP_AND"
  | "OP_OR";

export type PrefixOp = "OP_NEGATE" | "OP_MINUS";

export type TokenType =
  | BinOp
  | PrefixOp
  | "DOT"
  | "OPEN_BRACKET"
  | "CLOSE_BRACKET"
  | "STRING_LITERAL"
  | "NUMBER_LITERAL"
  | "IDENTIFIER"
  | "OPEN_PAREN"
  | "CLOSE_PAREN"
  | "ROW";

export function tokenIsBinOp(t: Token): t is BinOpToken {
  switch (t.type) {
    case "DOT":
    case "OP_GT":
    case "OP_GTE":
    case "OP_EQ":
    case "OP_LT":
    case "OP_LTE":
    case "OP_NEQ":
    case "OP_NEGATE":
      return true;
    default:
      return false;
  }
}

export interface Token {
  type: TokenType;
  value?: string;
}

export interface BinOpToken {
  type: BinOp;
}

export function tokenize(src: Source): Token[] {
  let tokens = [] as Token[];
  skipWhitespace(src);
  for (;;) {
    switch (peek(src)) {
      case undefined:
        return tokens;

      case "-":
        pop(src);
        tokens.push({ type: "OP_MINUS" });
        break;

      case "0":
      case "1":
      case "2":
      case "3":
      case "4":
      case "5":
      case "6":
      case "7":
      case "8":
      case "9": {
        let value = readNumberLiteral(src);
        if (value == undefined) {
          throw new Error("Invalid number literal");
        }
        tokens.push({ type: "NUMBER_LITERAL", value: value });
        break;
      }

      case '"': {
        let value = readStringLiteral(src);
        if (value == undefined) {
          throw new Error("Invalid string literal");
        }
        tokens.push({ type: "STRING_LITERAL", value });
        break;
      }

      case ">":
        pop(src);
        if (peek(src) === "=") {
          pop(src);
          tokens.push({ type: "OP_GTE" });
        } else {
          tokens.push({ type: "OP_GT" });
        }
        break;

      case "<":
        pop(src);
        if (peek(src) === "=") {
          pop(src);
          tokens.push({ type: "OP_LTE" });
        } else {
          tokens.push({ type: "OP_LT" });
        }
        break;

      case "=":
        pop(src);
        if (pop(src) !== "=") {
          throw new Error();
        }

        tokens.push({ type: "OP_EQ" });
        break;

      case "!":
        pop(src);
        if (peek(src) === "=") {
          pop(src);
          tokens.push({ type: "OP_NEQ" });
        } else {
          tokens.push({ type: "OP_NEGATE" });
        }
        break;

      case "(":
        pop(src);
        tokens.push({ type: "OPEN_PAREN" });
        break;

      case ")":
        pop(src);
        tokens.push({ type: "CLOSE_PAREN" });
        break;

      case "[":
        pop(src);
        tokens.push({ type: "OPEN_BRACKET" });
        break;

      case "]":
        pop(src);
        tokens.push({ type: "CLOSE_BRACKET" });
        break;

      case ".":
        pop(src);
        tokens.push({ type: "DOT" });
        break;

      default: {
        let value = readIdentifier(src);
        tokens.push({ type: "IDENTIFIER", value });
      }
    }

    skipWhitespace(src);
  }
}

function readIdentifier(src: Source): string | undefined {
  const PATTERN = /[$_\p{ID_Start}][$\u200c\u200d\p{ID_Continue}]*/gu;
  PATTERN.lastIndex = src.idx;
  const match = PATTERN.exec(src.str);
  if (match == undefined || match.index > src.idx) {
    return undefined;
  }

  src.idx += match[0].length;
  return match[0];
}

function readNumberLiteral(src: Source): string | undefined {
  const PATTERN = /((0\.)|([123456789]\d*))(\.\d+)?/g;
  PATTERN.lastIndex = src.idx;
  const match = PATTERN.exec(src.str);
  if (match == undefined || match.index > src.idx) {
    return undefined;
  }

  src.idx += match[0].length;
  return match[0];
}

const ESCAPES = {
  '"': '"',
  "'": "'",
  "\\": "\\",
  b: "\b",
  f: "\f",
  n: "\n",
  r: "\r",
  t: "\t",
} as Record<string, string | undefined>;

function readStringLiteral(src: Source) {
  const start = src.idx;
  const delimiter = pop(src);
  if (delimiter !== '"' && delimiter !== "'") {
    return undefined;
  }

  let value = "";
  while (src.idx < src.str.length) {
    switch (peek(src)) {
      case "\\":
        {
          pop(src);
          const code = pop(src);
          if (code === "u") {
            let code_point = parseInt(src.str.slice(src.idx, src.idx + 4), 16);
            value += String.fromCharCode(code_point);
            src.idx += 4;
          } else {
            const escape = ESCAPES[code];
            if (!escape) {
              return undefined;
            }
            value += escape;
          }
        }
        break;

      case delimiter:
        pop(src);
        return value;

      default:
        value += pop(src);
    }
  }

  throw new Error("Unexpected EOF in string starting at " + start);
}
