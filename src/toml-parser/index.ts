import type {
  BareToken,
  BooleanToken,
  PunctuatorToken,
  StringToken,
  MultiLineStringToken,
  NumberToken,
  DateTimeToken,
  Token,
  TOMLBare,
  TOMLQuoted,
  TOMLBooleanValue,
  TOMLNumberValue,
  TOMLKey,
  TOMLKeyValue,
  TOMLNode,
  TOMLProgram,
  TOMLStringValue,
  TOMLTopLevelTable,
  TOMLTable,
  TOMLDateTimeValue,
  TOMLArray,
  TOMLInlineTable,
  Range,
  SourceLocation,
  Position,
} from "../ast";
import type { ErrorCode } from "../errors";
import { last } from "../internal-utils";
import type { TOMLVer } from "../parser-options";
import { type ParserOptions, getTOMLVer } from "../parser-options";
import type { ParserState, ValueContainer } from "./context";
import { Context } from "./context";

const STATE_FOR_ERROR: Record<string, ErrorCode> = {
  VALUE: "missing-value",
};
const STRING_VALUE_STYLE_MAP = {
  BasicString: "basic",
  MultiLineBasicString: "basic",
  LiteralString: "literal",
  MultiLineLiteralString: "literal",
} as const;
const STRING_KEY_STYLE_MAP = {
  BasicString: "basic",
  LiteralString: "literal",
} as const;
const DATETIME_VALUE_KIND_MAP = {
  OffsetDateTime: "offset-date-time",
  LocalDateTime: "local-date-time",
  LocalDate: "local-date",
  LocalTime: "local-time",
} as const;

export class TOMLParser {
  private readonly text: string;

  private readonly parserOptions: ParserOptions;

  private readonly tomlVersion: TOMLVer;

  /**
   * Initialize this parser.
   */
  public constructor(text: string, parserOptions?: ParserOptions) {
    this.text = text;
    this.parserOptions = parserOptions || {};
    this.tomlVersion = getTOMLVer(this.parserOptions.tomlVersion);
  }

  /**
   * Parse TOML
   */
  public parse(): TOMLProgram {
    const ast: TOMLProgram = {
      type: "Program",
      body: [] as never,
      sourceType: "module",
      tokens: [],
      comments: [],
      parent: null,
      range: [0, 0],
      loc: {
        start: {
          line: 1,
          column: 0,
        },
        end: {
          line: 1,
          column: 0,
        },
      },
    };
    const node: TOMLTopLevelTable = {
      type: "TOMLTopLevelTable",
      body: [],
      parent: ast,
      range: cloneRange(ast.range),
      loc: cloneLoc(ast.loc),
    };
    ast.body = [node];
    const ctx = new Context({
      text: this.text,
      parserOptions: this.parserOptions,
      topLevelTable: node,
    });
    let token = ctx.nextToken();
    if (token) {
      node.range[0] = token.range[0];
      node.loc.start = clonePos(token.loc.start);

      while (token) {
        const state = ctx.stateStack.pop() || "TABLE";
        ctx.stateStack.push(...this[state](token, ctx));
        token = ctx.nextToken();
      }
      const state = ctx.stateStack.pop() || "TABLE";
      if (state in STATE_FOR_ERROR) {
        return ctx.reportParseError(STATE_FOR_ERROR[state], null);
      }
      if (ctx.table.type === "TOMLTable") {
        applyEndLoc(ctx.table, last(ctx.table.body));
      }
      applyEndLoc(node, last(node.body));
    }

    ctx.verifyDuplicateKeys();

    ast.tokens = ctx.tokens;
    ast.comments = ctx.comments;
    const endOffset = ctx.tokenizer.end;
    const endPos = ctx.tokenizer.getLocFromIndex(endOffset);
    ast.range[1] = endOffset;
    ast.loc.end = {
      line: endPos.line,
      column: endPos.column,
    };

    return ast;
  }

  private TABLE(token: Token, ctx: Context): ParserState[] {
    if (isBare(token) || isString(token)) {
      return this.processKeyValue(token, ctx.table, ctx);
    }
    if (isLeftBracket(token)) {
      return this.processTable(token, ctx.topLevelTable, ctx);
    }
    return ctx.reportParseError("unexpected-token", token);
  }

  private VALUE(token: Token, ctx: Context): ParserState[] {
    if (isString(token) || isMultiLineString(token)) {
      return this.processStringValue(token, ctx);
    }
    if (isNumber(token)) {
      return this.processNumberValue(token, ctx);
    }
    if (isBoolean(token)) {
      return this.processBooleanValue(token, ctx);
    }
    if (isDateTime(token)) {
      return this.processDateTimeValue(token, ctx);
    }
    if (isLeftBracket(token)) {
      return this.processArray(token, ctx);
    }
    if (isLeftBrace(token)) {
      return this.processInlineTable(token, ctx);
    }

    return ctx.reportParseError("unexpected-token", token);
  }

  private processTable(
    token: PunctuatorToken,
    topLevelTableNode: TOMLTopLevelTable,
    ctx: Context,
  ): ParserState[] {
    const tableNode: TOMLTable = {
      type: "TOMLTable",
      kind: "standard",
      key: null as never,
      resolvedKey: [],
      body: [],
      parent: topLevelTableNode,
      range: cloneRange(token.range),
      loc: cloneLoc(token.loc),
    };
    if (ctx.table.type === "TOMLTable") {
      applyEndLoc(ctx.table, last(ctx.table.body));
    }
    topLevelTableNode.body.push(tableNode);
    ctx.table = tableNode;
    let targetToken = ctx.nextToken({
      needSameLine: "invalid-key-value-newline",
    });
    if (isLeftBracket(targetToken)) {
      if (token.range[1] < targetToken.range[0]) {
        return ctx.reportParseError("invalid-space", targetToken);
      }
      tableNode.kind = "array";
      targetToken = ctx.nextToken({
        needSameLine: "invalid-key-value-newline",
      });
    }
    if (isRightBracket(targetToken)) {
      return ctx.reportParseError("missing-key", targetToken);
    }
    if (!targetToken) {
      return ctx.reportParseError("unterminated-table-key", null);
    }
    const keyNodeData = this.processKeyNode(targetToken, tableNode, ctx);
    targetToken = keyNodeData.nextToken;
    if (!isRightBracket(targetToken)) {
      return ctx.reportParseError("unterminated-table-key", targetToken);
    }
    if (tableNode.kind === "array") {
      const rightBracket = targetToken;
      targetToken = ctx.nextToken({
        needSameLine: "invalid-key-value-newline",
      });
      if (!isRightBracket(targetToken)) {
        return ctx.reportParseError("unterminated-table-key", targetToken);
      }
      if (rightBracket.range[1] < targetToken.range[0]) {
        return ctx.reportParseError("invalid-space", targetToken);
      }
    }
    applyEndLoc(tableNode, targetToken);
    ctx.applyResolveKeyForTable(tableNode);
    ctx.needNewLine = true;
    return [];
  }

  private processKeyValue(
    token: BareToken | StringToken,
    tableNode: TOMLTopLevelTable | TOMLTable,
    ctx: Context,
  ): ParserState[] {
    const keyValueNode: TOMLKeyValue = {
      type: "TOMLKeyValue",
      key: null as never,
      value: null as never,
      parent: tableNode,
      range: cloneRange(token.range),
      loc: cloneLoc(token.loc),
    };
    tableNode.body.push(keyValueNode);
    const { nextToken: targetToken } = this.processKeyNode(
      token,
      keyValueNode,
      ctx,
    );
    if (!isEq(targetToken)) {
      return ctx.reportParseError("missing-equals-sign", targetToken);
    }
    ctx.addValueContainer({
      parent: keyValueNode,
      set: (valNode): ParserState[] => {
        keyValueNode.value = valNode;
        applyEndLoc(keyValueNode, valNode);
        ctx.needNewLine = true;
        return [];
      },
    });
    ctx.needSameLine = "invalid-key-value-newline";
    return ["VALUE"];
  }

  private processKeyNode(
    token: Token,
    parent: TOMLKey["parent"],
    ctx: Context,
  ): { keyNode: TOMLKey; nextToken: Token | null } {
    const keyNode: TOMLKey = {
      type: "TOMLKey",
      keys: [],
      parent,
      range: cloneRange(token.range),
      loc: cloneLoc(token.loc),
    };
    parent.key = keyNode;
    let targetToken: Token | null = token;
    let dotToken: Token | null = null;
    while (targetToken) {
      if (isBare(targetToken)) {
        this.processBareKey(targetToken, keyNode);
        dotToken = null;
      } else if (isString(targetToken)) {
        this.processStringKey(targetToken, keyNode);
        dotToken = null;
      } else {
        break;
      }
      targetToken = ctx.nextToken({
        needSameLine: "invalid-key-value-newline",
      });
      if (isDot(targetToken)) {
        dotToken = targetToken;
        targetToken = ctx.nextToken({
          needSameLine: "invalid-key-value-newline",
        });
      } else {
        dotToken = null;
        break;
      }
    }
    if (dotToken) {
      ctx.reportParseError(
        isDot(targetToken)
          ? "invalid-consecutive-dots-in-key"
          : "invalid-trailing-dot-in-key",
        dotToken,
      );
    }
    applyEndLoc(keyNode, last(keyNode.keys));
    return { keyNode, nextToken: targetToken };
  }

  private processBareKey(token: BareToken, keyNode: TOMLKey): void {
    const node: TOMLBare = {
      type: "TOMLBare",
      name: token.value,
      parent: keyNode,
      range: cloneRange(token.range),
      loc: cloneLoc(token.loc),
    };
    keyNode.keys.push(node);
  }

  private processStringKey(token: StringToken, keyNode: TOMLKey): void {
    const node: TOMLQuoted = {
      type: "TOMLQuoted",
      kind: "string",
      value: token.string,
      style: STRING_KEY_STYLE_MAP[token.type],
      multiline: false,
      parent: keyNode,
      range: cloneRange(token.range),
      loc: cloneLoc(token.loc),
    };
    keyNode.keys.push(node);
  }

  private processStringValue(
    token: StringToken | MultiLineStringToken,
    ctx: Context,
  ): ParserState[] {
    const valueContainer = ctx.consumeValueContainer();
    const node: TOMLStringValue = {
      type: "TOMLValue",
      kind: "string",
      value: token.string,
      style: STRING_VALUE_STYLE_MAP[token.type],
      multiline: isMultiLineString(token),
      parent: valueContainer.parent,
      range: cloneRange(token.range),
      loc: cloneLoc(token.loc),
    };
    return valueContainer.set(node);
  }

  private processNumberValue(token: NumberToken, ctx: Context): ParserState[] {
    const valueContainer = ctx.consumeValueContainer();
    const text = this.text;
    const [startRange, endRange] = token.range;
    let numberString: string | null = null;

    /**
     * Get the text of number
     */
    // eslint-disable-next-line func-style -- ignore
    const getNumberText = (): string => {
      return (
        numberString ??
        (numberString = text.slice(startRange, endRange).replace(/_/g, ""))
      );
    };

    let node: TOMLNumberValue;
    if (token.type === "Integer") {
      node = {
        type: "TOMLValue",
        kind: "integer",
        value: token.number,
        bigint: token.bigint,
        get number() {
          return getNumberText();
        },
        parent: valueContainer.parent,
        range: cloneRange(token.range),
        loc: cloneLoc(token.loc),
      };
    } else {
      node = {
        type: "TOMLValue",
        kind: "float",
        value: token.number,
        get number() {
          return getNumberText();
        },
        parent: valueContainer.parent,
        range: cloneRange(token.range),
        loc: cloneLoc(token.loc),
      };
    }
    return valueContainer.set(node);
  }

  private processBooleanValue(
    token: BooleanToken,
    ctx: Context,
  ): ParserState[] {
    const valueContainer = ctx.consumeValueContainer();
    const node: TOMLBooleanValue = {
      type: "TOMLValue",
      kind: "boolean",
      value: token.boolean,
      parent: valueContainer.parent,
      range: cloneRange(token.range),
      loc: cloneLoc(token.loc),
    };
    return valueContainer.set(node);
  }

  private processDateTimeValue(
    token: DateTimeToken,
    ctx: Context,
  ): ParserState[] {
    const valueContainer = ctx.consumeValueContainer();
    const node: TOMLDateTimeValue = {
      type: "TOMLValue",
      kind: DATETIME_VALUE_KIND_MAP[token.type],
      value: token.date,
      datetime: token.value,
      parent: valueContainer.parent,
      range: cloneRange(token.range),
      loc: cloneLoc(token.loc),
    };
    return valueContainer.set(node);
  }

  private processArray(token: PunctuatorToken, ctx: Context): ParserState[] {
    const valueContainer = ctx.consumeValueContainer();
    const node: TOMLArray = {
      type: "TOMLArray",
      elements: [],
      parent: valueContainer.parent,
      range: cloneRange(token.range),
      loc: cloneLoc(token.loc),
    };
    const nextToken = ctx.nextToken({ valuesEnabled: true });
    if (isRightBracket(nextToken)) {
      applyEndLoc(node, nextToken);
      return valueContainer.set(node);
    }
    // Back token
    ctx.backToken();
    return this.processArrayValue(node, valueContainer, ctx);
  }

  private processArrayValue(
    node: TOMLArray,
    valueContainer: ValueContainer,
    ctx: Context,
  ): ParserState[] {
    ctx.addValueContainer({
      parent: node,
      set: (valNode) => {
        node.elements.push(valNode);

        let nextToken = ctx.nextToken({ valuesEnabled: true });
        const hasComma = isComma(nextToken);
        if (hasComma) {
          nextToken = ctx.nextToken({ valuesEnabled: true });
        }
        if (isRightBracket(nextToken)) {
          applyEndLoc(node, nextToken);
          return valueContainer.set(node);
        }
        if (hasComma) {
          // Back token
          ctx.backToken();

          // setup next value container
          return this.processArrayValue(node, valueContainer, ctx);
        }
        return ctx.reportParseError(
          nextToken ? "missing-comma" : "unterminated-array",
          nextToken,
        );
      },
    });

    return ["VALUE"];
  }

  private processInlineTable(
    token: PunctuatorToken,
    ctx: Context,
  ): ParserState[] {
    const valueContainer = ctx.consumeValueContainer();
    const node: TOMLInlineTable = {
      type: "TOMLInlineTable",
      body: [],
      parent: valueContainer.parent,
      range: cloneRange(token.range),
      loc: cloneLoc(token.loc),
    };

    const needSameLine = this.tomlVersion.gte(1, 1)
      ? // Line breaks in inline tables are allowed.
        // Added in TOML 1.1
        undefined
      : ("invalid-inline-table-newline" as const);

    const nextToken = ctx.nextToken({
      needSameLine,
    });

    if (nextToken) {
      if (isBare(nextToken) || isString(nextToken)) {
        return this.processInlineTableKeyValue(
          nextToken,
          node,
          valueContainer,
          ctx,
        );
      }
      if (isRightBrace(nextToken)) {
        applyEndLoc(node, nextToken);
        return valueContainer.set(node);
      }
    }
    return ctx.reportParseError("unexpected-token", nextToken);
  }

  private processInlineTableKeyValue(
    token: BareToken | StringToken,
    inlineTableNode: TOMLInlineTable,
    valueContainer: ValueContainer,
    ctx: Context,
  ): ParserState[] {
    const keyValueNode: TOMLKeyValue = {
      type: "TOMLKeyValue",
      key: null as never,
      value: null as never,
      parent: inlineTableNode,
      range: cloneRange(token.range),
      loc: cloneLoc(token.loc),
    };
    inlineTableNode.body.push(keyValueNode);
    const { nextToken: targetToken } = this.processKeyNode(
      token,
      keyValueNode,
      ctx,
    );
    if (!isEq(targetToken)) {
      return ctx.reportParseError("missing-equals-sign", targetToken);
    }
    const needSameLine = this.tomlVersion.gte(1, 1)
      ? // Line breaks in inline tables are allowed.
        // Added in TOML 1.1
        undefined
      : ("invalid-inline-table-newline" as const);
    ctx.addValueContainer({
      parent: keyValueNode,
      set: (valNode) => {
        keyValueNode.value = valNode;
        applyEndLoc(keyValueNode, valNode);

        let nextToken = ctx.nextToken({ needSameLine });
        if (isComma(nextToken)) {
          nextToken = ctx.nextToken({ needSameLine });
          if (nextToken && (isBare(nextToken) || isString(nextToken))) {
            // setup next value container
            return this.processInlineTableKeyValue(
              nextToken,
              inlineTableNode,
              valueContainer,
              ctx,
            );
          }
          if (isRightBrace(nextToken)) {
            if (this.tomlVersion.lt(1, 1)) {
              return ctx.reportParseError(
                "invalid-trailing-comma-in-inline-table",
                nextToken,
              );
            }
            // Trailing commas in inline tables are allowed.
            // Added in TOML 1.1
          } else {
            return ctx.reportParseError(
              nextToken ? "unexpected-token" : "unterminated-inline-table",
              nextToken,
            );
          }
        }
        if (isRightBrace(nextToken)) {
          applyEndLoc(inlineTableNode, nextToken);
          return valueContainer.set(inlineTableNode);
        }
        return ctx.reportParseError(
          nextToken ? "missing-comma" : "unterminated-inline-table",
          nextToken,
        );
      },
    });
    ctx.needSameLine = "invalid-key-value-newline";
    return ["VALUE"];
  }
}

/**
 * Check whether the given token is a dot.
 */
function isDot(token: Token | null): token is PunctuatorToken {
  return isPunctuator(token) && token.value === ".";
}

/**
 * Check whether the given token is an equal sign.
 */
function isEq(token: Token | null): token is PunctuatorToken {
  return isPunctuator(token) && token.value === "=";
}

/**
 * Check whether the given token is a left bracket.
 */
function isLeftBracket(token: Token | null): token is PunctuatorToken {
  return isPunctuator(token) && token.value === "[";
}

/**
 * Check whether the given token is a right bracket.
 */
function isRightBracket(token: Token | null): token is PunctuatorToken {
  return isPunctuator(token) && token.value === "]";
}

/**
 * Check whether the given token is a left brace.
 */
function isLeftBrace(token: Token | null): token is PunctuatorToken {
  return isPunctuator(token) && token.value === "{";
}

/**
 * Check whether the given token is a right brace.
 */
function isRightBrace(token: Token | null): token is PunctuatorToken {
  return isPunctuator(token) && token.value === "}";
}

/**
 * Check whether the given token is a comma.
 */
function isComma(token: Token | null): token is PunctuatorToken {
  return isPunctuator(token) && token.value === ",";
}

/**
 * Check whether the given token is a punctuator.
 */
function isPunctuator(token: Token | null): token is PunctuatorToken {
  return Boolean(token && token.type === "Punctuator");
}

/**
 * Check whether the given token is a bare token.
 */
function isBare(token: Token): token is BareToken {
  return token.type === "Bare";
}

/**
 * Check whether the given token is a string.
 */
function isString(token: Token): token is StringToken {
  return token.type === "BasicString" || token.type === "LiteralString";
}

/**
 * Check whether the given token is a multi-line string.
 */
function isMultiLineString(
  token: Token,
): token is StringToken | MultiLineStringToken {
  return (
    token.type === "MultiLineBasicString" ||
    token.type === "MultiLineLiteralString"
  );
}

/**
 * Check whether the given token is a number.
 */
function isNumber(token: Token): token is NumberToken {
  return token.type === "Integer" || token.type === "Float";
}

/**
 * Check whether the given token is a boolean.
 */
function isBoolean(token: Token): token is BooleanToken {
  return token.type === "Boolean";
}

/**
 * Check whether the given token is a date time.
 */
function isDateTime(token: Token): token is DateTimeToken {
  return (
    token.type === "OffsetDateTime" ||
    token.type === "LocalDateTime" ||
    token.type === "LocalDate" ||
    token.type === "LocalTime"
  );
}

/**
 * Apply end locations
 */
function applyEndLoc(node: TOMLNode, child: TOMLNode | Token | null) {
  if (child) {
    node.range[1] = child.range[1];
    node.loc.end = clonePos(child.loc.end);
  }
}

/**
 * clone the location.
 */
function cloneRange(range: Range): Range {
  return [range[0], range[1]];
}

/**
 * clone the location.
 */
function cloneLoc(loc: SourceLocation): SourceLocation {
  return {
    start: clonePos(loc.start),
    end: clonePos(loc.end),
  };
}

/**
 * clone the location.
 */
function clonePos(pos: Position): Position {
  return {
    line: pos.line,
    column: pos.column,
  };
}
