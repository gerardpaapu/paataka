import { describe, it, expect } from "vitest";
import { parse } from "./parser.ts";
import { tokenize } from "./tokenizer.ts";
import { source } from "./source.ts";

function read(str: string) {
  const src = source(str);
  const tokens = tokenize(src);
  return parse(tokens);
}
// These tests are mostly for coverage to make sure
// that the parser throws _meaningful_ errors for any failure
// because these are surfaced to the user
describe("parser errors", () => {
  it("catches incomplete funcalls", () => {
    expect(() => {
      read("LENGTH(");
    }).toThrowErrorMatchingInlineSnapshot(
      `[PaatakaExpressionError: Unexpected EOF in argument list]`,
    );
  });
  it("catches incomplete funcalls", () => {
    expect(() => {
      read("LENGTH(_");
    }).toThrowErrorMatchingInlineSnapshot(
      `[PaatakaExpressionError: Expected close paren]`,
    );
  });
  it("catches incomplete funcalls", () => {
    expect(() => {
      read("LENGTH(_,");
    }).toThrowErrorMatchingInlineSnapshot(
      `[PaatakaExpressionError: Unexpected EOF reading expression]`,
    );
  });
  it("catches incomplete array literals", () => {
    expect(() => {
      read("[");
    }).toThrowErrorMatchingInlineSnapshot(
      `[PaatakaExpressionError: Unexpected EOF in array literal]`,
    );

    expect(() => {
      read("[1");
    }).toThrowErrorMatchingInlineSnapshot(
      `[PaatakaExpressionError: Expected closing bracket for array literal]`,
    );
  });
  it("only reads identifiers after a dot", () => {
    expect(() => {
      read("_.1");
    }).toThrowErrorMatchingInlineSnapshot(
      `[PaatakaExpressionError: Missing identifier after "."]`,
    );
  });
  it("complains about incomplete bracket accessors", () => {
    expect(() => {
      read("_[");
    }).toThrowErrorMatchingInlineSnapshot(
      `[PaatakaExpressionError: Unexpected EOF reading expression]`,
    );

    expect(() => {
      read('_["foo"');
    }).toThrowErrorMatchingInlineSnapshot(
      `[PaatakaExpressionError: Missing "]"]`,
    );
  });
  it("complains about trailing tokens", () => {
    expect(() => {
      read("_.foo bar");
    }).toThrowErrorMatchingInlineSnapshot(
      `[PaatakaExpressionError: Trailing tokens]`,
    );
  });

  it("complains about no-tokens", () => {
    expect(() => {
      read("");
    }).toThrowErrorMatchingInlineSnapshot(
      `[PaatakaExpressionError: Unexpected EOF reading expression]`,
    );
  });

  it("complains about unclosed parentheticals", () => {
    expect(() => {
      read("(1");
    }).toThrowErrorMatchingInlineSnapshot(
      `[PaatakaExpressionError: Unclosed parenthetical]`,
    );
  });

  it("complains about unknown function names", () => {
    expect(() => {
      read("butt(1)");
    }).toThrowErrorMatchingInlineSnapshot(
      `[PaatakaExpressionError: Invalid function name: butt:1]`,
    );
  });
  it("complains about weird tokens", () => {
    expect(() => {
      read(",");
    }).toThrowErrorMatchingInlineSnapshot(
      `[PaatakaExpressionError: Unexpected COMMA]`,
    );
  });

  it("complains about the wrong number of arguments to methods", () => {
    expect(() => {
      read("_.toLowerCase(1)");
    }).toThrowErrorMatchingInlineSnapshot(
      `[PaatakaExpressionError: Wrong number of arguments to toLowerCase]`,
    );

    expect(() => {
      read("_.toUpperCase(1)");
    }).toThrowErrorMatchingInlineSnapshot(
      `[PaatakaExpressionError: Wrong number of arguments to toUpperCase]`,
    );

    expect(() => {
      read("_.some(x => x.length > 2, 2)");
    }).toThrowErrorMatchingInlineSnapshot(
      `[PaatakaExpressionError: .some() takes exactly one argument]`,
    );

    expect(() => {
      read("_.some(1)");
    }).toThrowErrorMatchingInlineSnapshot(
      `[PaatakaExpressionError: .some() must be passed an arrow function]`,
    );

    expect(() => {
      read("_.every(x => x.length > 2, 2)");
    }).toThrowErrorMatchingInlineSnapshot(
      `[PaatakaExpressionError: Wrong number of arguments to .every()]`,
    );

    expect(() => {
      read("_.every(1)");
    }).toThrowErrorMatchingInlineSnapshot(
      `[PaatakaExpressionError: .every() must be passed an arrow function]`,
    );

    expect(() => {
      read("_.badMethodName()");
    }).toThrowErrorMatchingInlineSnapshot(`[PaatakaExpressionError: Unknown method: badMethodName]`);

    expect(() => {
      read("_.includes(1, 2, 2)");
    }).toThrowErrorMatchingInlineSnapshot(
      `[PaatakaExpressionError: Wrong number of arguments to includes]`,
    );
  });

  it("reads an empty array", () => {
    expect(read("[]")).toStrictEqual({
      type: "ArrayLiteral",
      values: [],
    });
  });
});
