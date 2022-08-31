/* eslint complexity: 0 -- ignore */
import type {
  BareToken,
  BooleanToken,
  Comment,
  DateTimeToken,
  FloatToken,
  IntegerToken,
  MultiLineStringToken,
  PunctuatorToken,
  Range,
  StringToken,
  Token,
  TokenType,
} from "../ast";
import type { ErrorCode } from "../errors";
import { ParseError } from "../errors";
import type { ParserOptions } from "../parser-options";
import { CodePointIterator } from "./code-point-iterator";
import {
  EOF,
  LINE_FEED,
  NULL,
  isWhitespace,
  isEOL,
  EQUALS_SIGN,
  QUOTATION_MARK,
  LATIN_SMALL_B,
  BACKSLASH,
  LATIN_SMALL_T,
  LATIN_SMALL_N,
  LATIN_SMALL_F,
  LATIN_SMALL_R,
  BACKSPACE,
  TABULATION,
  FORM_FEED,
  CARRIAGE_RETURN,
  LATIN_SMALL_U,
  LATIN_CAPITAL_U,
  isHexDig,
  isLetter,
  isDigit,
  UNDERSCORE,
  DASH,
  isControl,
  DELETE,
  HASH,
  DOT,
  SINGLE_QUOTE,
  LATIN_SMALL_A,
  LATIN_SMALL_I,
  PLUS_SIGN,
  DIGIT_0,
  LATIN_SMALL_O,
  LATIN_SMALL_X,
  LATIN_SMALL_E,
  LATIN_CAPITAL_E,
  LATIN_SMALL_S,
  LATIN_SMALL_L,
  LEFT_BRACKET,
  RIGHT_BRACKET,
  LEFT_BRACE,
  RIGHT_BRACE,
  COMMA,
  isOctalDig,
  DIGIT_1,
  LATIN_CAPITAL_T,
  SPACE,
  COLON,
  LATIN_CAPITAL_Z,
  LATIN_SMALL_Z,
  isUnicodeScalarValue,
} from "./code-point";

type Position = {
  offset: number;
  line: number;
  column: number;
};
type TokenizerState =
  | "DATA"
  | "COMMENT"
  | "BARE"
  | "BASIC_STRING"
  | "MULTI_LINE_BASIC_STRING"
  | "LITERAL_STRING"
  | "MULTI_LINE_LITERAL_STRING"
  | "SIGN"
  | "NUMBER"
  | "HEX"
  | "OCTAL"
  | "BINARY"
  | "EXPONENT_RIGHT"
  | "FRACTIONAL_RIGHT"
  | "NAN_OR_INF"
  | "BOOLEAN"
  | "DATE_YEAR"
  | "DATE_MONTH"
  | "DATE_DAY"
  | "TIME_HOUR"
  | "TIME_MINUTE"
  | "TIME_SECOND"
  | "TIME_SEC_FRAC"
  | "TIME_OFFSET";

const HAS_BIGINT = typeof BigInt !== "undefined";
const RADIX_PREFIXES = {
  16: "0x",
  10: "",
  8: "0o",
  2: "02",
};

const ESCAPES: Record<number, number> = {
  [LATIN_SMALL_B]: BACKSPACE,
  [LATIN_SMALL_T]: TABULATION,
  [LATIN_SMALL_N]: LINE_FEED,
  [LATIN_SMALL_F]: FORM_FEED,
  [LATIN_SMALL_R]: CARRIAGE_RETURN,
  [QUOTATION_MARK]: QUOTATION_MARK,
  [BACKSLASH]: BACKSLASH,
};

type ExponentData = {
  left: number;
};
type FractionalData = {
  minus: boolean;
  absInt: number;
};
type DateTimeData = {
  hasDate: boolean;
  year: number;
  month: number;
  day: number;

  hour: number;
  minute: number;
  second: number;
};

/**
 * Tokenizer for TOML.
 */
export class Tokenizer {
  public readonly text: string;

  // @ts-expect-error -- unused
  private readonly parserOptions: ParserOptions;

  private readonly codePointIterator: CodePointIterator;

  private backCode = false;

  private lastCodePoint: number = NULL;

  private state: TokenizerState = "DATA";

  private token: Token | Comment | null = null;

  private tokenStart: {
    offset: number;
    line: number;
    column: number;
  } = {
    offset: -1,
    line: 1,
    column: -1,
  };

  private data?: ExponentData | FractionalData | DateTimeData;

  /**
   * The flag which enables values tokens.
   * If this is true, this tokenizer will generate Integer, Float, Boolean, Offset Date-Time, Local Date-Time ,Local Date, Local Time, Array and Inline Table tokens.
   */
  public valuesEnabled = false;

  /**
   * Initialize this tokenizer.
   */
  public constructor(text: string, parserOptions?: ParserOptions) {
    this.text = text;
    this.parserOptions = parserOptions || {};
    this.codePointIterator = new CodePointIterator(text);
  }

  public get positions(): { start: Position; end: Position } {
    return {
      start: this.codePointIterator.start,
      end: this.codePointIterator.end,
    };
  }

  /**
   * Report an invalid character error.
   */
  private reportParseError(
    code: ErrorCode,
    data?: { [key: string]: any }
  ): any {
    throw new ParseError(
      code,
      this.codePointIterator.start.offset,
      this.codePointIterator.start.line,
      this.codePointIterator.start.column,
      data
    );
  }

  /**
   * Get the next token.
   */
  public nextToken(): Token | Comment | null {
    let token = this.token;
    if (token != null) {
      this.token = null;
      return token;
    }
    let cp = this.lastCodePoint;
    while (cp !== EOF && !this.token) {
      cp = this.nextCode();
      const nextState = this[this.state](cp);
      if (!nextState) {
        throw new Error(`Unknown error: pre state=${this.state}`);
      }
      this.state = nextState;
    }
    token = this.token;
    this.token = null;
    return token;
  }

  /**
   * Get the next code point.
   */
  private nextCode(): number {
    if (this.lastCodePoint === EOF) {
      return EOF;
    }
    if (this.backCode) {
      this.backCode = false;
      return this.lastCodePoint;
    }
    return (this.lastCodePoint = this.codePointIterator.next());
  }

  /**
   * Skip code point iterator.
   */
  private skip(count: number): void {
    if (this.backCode) {
      this.backCode = false;
      count--;
    }
    if (!count) {
      return;
    }
    count--;
    for (let index = 0; index < count; index++) {
      this.codePointIterator.next();
    }
    this.lastCodePoint = this.codePointIterator.next();
  }

  /**
   * Back the current code point as the given state.
   */
  private back(state: TokenizerState): TokenizerState {
    this.backCode = true;
    return state;
  }

  private punctuatorToken(cp: number): void {
    this.startToken();
    this.endToken("Punctuator", "end", cp);
  }

  private startToken(): void {
    this.tokenStart = {
      ...this.codePointIterator.start,
    };
  }

  private endToken(
    type: BareToken["type"] | Comment["type"] | DateTimeToken["type"],
    pos: "start" | "end"
  ): void;

  private endToken(
    type: PunctuatorToken["type"],
    pos: "start" | "end",
    cp: number
  ): void;

  private endToken(
    type: StringToken["type"] | MultiLineStringToken["type"],
    pos: "start" | "end",
    codePoints: number[]
  ): void;

  private endToken(
    type: IntegerToken["type"],
    pos: "start" | "end",
    codePoints: number[],
    radix: 16 | 10 | 8 | 2
  ): void;

  private endToken(
    // eslint-disable-next-line @typescript-eslint/unified-signatures -- ignore
    type: FloatToken["type"],
    pos: "start" | "end",
    value: number
  ): void;

  private endToken(
    type: BooleanToken["type"],
    pos: "start" | "end",
    value: boolean
  ): void;

  /**
   * Commit the current token.
   */
  private endToken(
    type: TokenType | Comment["type"],
    pos: "start" | "end",
    option1?: number[] | number | boolean,
    option2?: 16 | 10 | 8 | 2
  ): void {
    const { tokenStart } = this;
    const end = this.codePointIterator[pos];

    const range: Range = [tokenStart.offset, end.offset];
    const loc = {
      start: {
        line: tokenStart.line,
        column: tokenStart.column,
      },
      end: {
        line: end.line,
        column: end.column,
      },
    };
    if (type === "Block") {
      this.token = {
        type,
        value: this.text.slice(tokenStart.offset + 1, end.offset),
        range,
        loc,
      };
    } else {
      let token: Token;
      const value =
        type === "Punctuator"
          ? String.fromCodePoint(option1! as number)
          : this.text.slice(tokenStart.offset, end.offset);
      if (
        type === "BasicString" ||
        type === "LiteralString" ||
        type === "MultiLineBasicString" ||
        type === "MultiLineLiteralString"
      ) {
        token = {
          type,
          value,
          string: String.fromCodePoint(...(option1! as number[])),
          range,
          loc,
        };
      } else if (type === "Integer") {
        const text = String.fromCodePoint(...(option1! as number[]));
        token = {
          type,
          value,
          number: parseInt(text, option2),
          bigint: HAS_BIGINT
            ? BigInt(RADIX_PREFIXES[option2!] + text)
            : (null as any),
          range,
          loc,
        };
      } else if (type === "Float") {
        token = {
          type,
          value,
          number: option1! as number,
          range,
          loc,
        };
      } else if (type === "Boolean") {
        token = {
          type,
          value,
          boolean: option1! as boolean,
          range,
          loc,
        };
      } else {
        token = {
          type,
          value,
          range,
          loc,
        };
      }
      this.token = token;
    }
  }

  private DATA(cp: number): TokenizerState {
    while (isWhitespace(cp) || isEOL(cp)) {
      cp = this.nextCode();
    }
    if (cp === HASH) {
      this.startToken();
      return "COMMENT";
    }
    if (cp === QUOTATION_MARK) {
      this.startToken();
      return "BASIC_STRING";
    }
    if (cp === SINGLE_QUOTE) {
      this.startToken();
      return "LITERAL_STRING";
    }
    if (
      cp === DOT || // .
      cp === EQUALS_SIGN || // =
      cp === LEFT_BRACKET || // [
      cp === RIGHT_BRACKET || // ]
      cp === LEFT_BRACE || // {
      cp === RIGHT_BRACE || // }
      cp === COMMA // ,
    ) {
      this.punctuatorToken(cp);
      return "DATA";
    }

    if (this.valuesEnabled) {
      if (cp === DASH || cp === PLUS_SIGN) {
        this.startToken();
        return "SIGN";
      }
      if (cp === LATIN_SMALL_N || cp === LATIN_SMALL_I) {
        this.startToken();
        return this.back("NAN_OR_INF");
      }
      if (isDigit(cp)) {
        this.startToken();
        return this.back("NUMBER");
      }
      if (cp === LATIN_SMALL_T || cp === LATIN_SMALL_F) {
        this.startToken();
        return this.back("BOOLEAN");
      }
    } else {
      if (isBare(cp)) {
        this.startToken();
        return "BARE";
      }
    }

    if (cp === EOF) {
      // end
      return "DATA";
    }

    return this.reportParseError("unexpected-char");
  }

  private COMMENT(cp: number): TokenizerState {
    while (!isEOL(cp) && cp !== EOF) {
      if (isControlOtherThanTab(cp)) {
        return this.reportParseErrorControlChar();
      }
      cp = this.nextCode();
    }
    this.endToken("Block", "start");
    return "DATA";
  }

  private BARE(cp: number): TokenizerState {
    while (isBare(cp)) {
      cp = this.nextCode();
    }
    this.endToken("Bare", "start");
    return this.back("DATA");
  }

  private BASIC_STRING(cp: number): TokenizerState {
    if (cp === QUOTATION_MARK) {
      cp = this.nextCode();
      if (cp === QUOTATION_MARK) {
        return "MULTI_LINE_BASIC_STRING";
      }
      this.endToken("BasicString", "start", []);
      return this.back("DATA");
    }
    const codePoints: number[] = [];
    while (cp !== QUOTATION_MARK && cp !== EOF && cp !== LINE_FEED) {
      if (isControlOtherThanTab(cp)) {
        return this.reportParseErrorControlChar();
      }
      if (cp === BACKSLASH) {
        cp = this.nextCode();
        const ecp = ESCAPES[cp];
        if (ecp) {
          codePoints.push(ecp);
          cp = this.nextCode();
          continue;
        } else if (cp === LATIN_SMALL_U) {
          const code = this.parseUnicode(4);
          codePoints.push(code);
          cp = this.nextCode();
          continue;
        } else if (cp === LATIN_CAPITAL_U) {
          const code = this.parseUnicode(8);
          codePoints.push(code);
          cp = this.nextCode();
          continue;
        }
        return this.reportParseError("invalid-char-in-escape-sequence");
      }
      codePoints.push(cp);
      cp = this.nextCode();
    }
    if (cp !== QUOTATION_MARK) {
      return this.reportParseError("unterminated-string");
    }
    this.endToken("BasicString", "end", codePoints);
    return "DATA";
  }

  private MULTI_LINE_BASIC_STRING(cp: number): TokenizerState {
    const codePoints: number[] = [];
    if (cp === LINE_FEED) {
      // A newline immediately following the opening delimiter will be trimmed.
      cp = this.nextCode();
    }
    while (cp !== EOF) {
      if (cp !== LINE_FEED && isControlOtherThanTab(cp)) {
        return this.reportParseErrorControlChar();
      }
      if (cp === QUOTATION_MARK) {
        const nextPoints = this.codePointIterator.subCodePoints();
        if (
          nextPoints.next() === QUOTATION_MARK &&
          nextPoints.next() === QUOTATION_MARK
        ) {
          if (nextPoints.next() === QUOTATION_MARK) {
            codePoints.push(QUOTATION_MARK);
            if (nextPoints.next() === QUOTATION_MARK) {
              codePoints.push(QUOTATION_MARK);
              if (nextPoints.next() === QUOTATION_MARK) {
                return this.reportParseError("invalid-three-quotes");
              }
            }
          }
          this.skip(nextPoints.count - 1);
          // end
          this.endToken("MultiLineBasicString", "end", codePoints);
          return "DATA";
        }
      }
      if (cp === BACKSLASH) {
        cp = this.nextCode();
        const ecp = ESCAPES[cp];
        if (ecp) {
          codePoints.push(ecp);
          cp = this.nextCode();
          continue;
        } else if (cp === LATIN_SMALL_U) {
          const code = this.parseUnicode(4);
          codePoints.push(code);
          cp = this.nextCode();
          continue;
        } else if (cp === LATIN_CAPITAL_U) {
          const code = this.parseUnicode(8);
          codePoints.push(code);
          cp = this.nextCode();
          continue;
        } else if (cp === LINE_FEED) {
          cp = this.nextCode();
          while (isWhitespace(cp) || cp === LINE_FEED) {
            cp = this.nextCode();
          }
          continue;
        } else if (isWhitespace(cp)) {
          let valid = true;
          for (const nextCp of this.codePointIterator.iterateSubCodePoints()) {
            if (nextCp === LINE_FEED) {
              break;
            }
            if (!isWhitespace(nextCp)) {
              valid = false;
              break;
            }
          }
          if (valid) {
            cp = this.nextCode();
            while (isWhitespace(cp) || cp === LINE_FEED) {
              cp = this.nextCode();
            }
            continue;
          }
        }
        return this.reportParseError("invalid-char-in-escape-sequence");
      }
      codePoints.push(cp);
      cp = this.nextCode();
    }

    return this.reportParseError("unterminated-string");
  }

  private LITERAL_STRING(cp: number): TokenizerState {
    if (cp === SINGLE_QUOTE) {
      cp = this.nextCode();
      if (cp === SINGLE_QUOTE) {
        return "MULTI_LINE_LITERAL_STRING";
      }
      this.endToken("LiteralString", "start", []);
      return this.back("DATA");
    }
    const codePoints: number[] = [];
    while (cp !== SINGLE_QUOTE && cp !== EOF && cp !== LINE_FEED) {
      if (isControlOtherThanTab(cp)) {
        return this.reportParseErrorControlChar();
      }
      codePoints.push(cp);
      cp = this.nextCode();
    }
    if (cp !== SINGLE_QUOTE) {
      return this.reportParseError("unterminated-string");
    }
    this.endToken("LiteralString", "end", codePoints);
    return "DATA";
  }

  private MULTI_LINE_LITERAL_STRING(cp: number): TokenizerState {
    const codePoints: number[] = [];
    if (cp === LINE_FEED) {
      // A newline immediately following the opening delimiter will be trimmed.
      cp = this.nextCode();
    }
    while (cp !== EOF) {
      if (cp !== LINE_FEED && isControlOtherThanTab(cp)) {
        return this.reportParseErrorControlChar();
      }
      if (cp === SINGLE_QUOTE) {
        const nextPoints = this.codePointIterator.subCodePoints();
        if (
          nextPoints.next() === SINGLE_QUOTE &&
          nextPoints.next() === SINGLE_QUOTE
        ) {
          if (nextPoints.next() === SINGLE_QUOTE) {
            codePoints.push(SINGLE_QUOTE);
            if (nextPoints.next() === SINGLE_QUOTE) {
              codePoints.push(SINGLE_QUOTE);
              if (nextPoints.next() === SINGLE_QUOTE) {
                return this.reportParseError("invalid-three-quotes");
              }
            }
          }
          this.skip(nextPoints.count - 1);
          // end
          this.endToken("MultiLineLiteralString", "end", codePoints);
          return "DATA";
        }
      }
      codePoints.push(cp);
      cp = this.nextCode();
    }
    return this.reportParseError("unterminated-string");
  }

  private SIGN(cp: number): TokenizerState {
    if (cp === LATIN_SMALL_N || cp === LATIN_SMALL_I) {
      return this.back("NAN_OR_INF");
    }
    if (isDigit(cp)) {
      return this.back("NUMBER");
    }
    return this.reportParseError("unexpected-char");
  }

  private NAN_OR_INF(cp: number): TokenizerState {
    if (cp === LATIN_SMALL_N) {
      const codePoints = this.codePointIterator.subCodePoints();
      if (
        codePoints.next() === LATIN_SMALL_A &&
        codePoints.next() === LATIN_SMALL_N
      ) {
        this.skip(2);
        this.endToken("Float", "end", NaN);
        return "DATA";
      }
    } else if (cp === LATIN_SMALL_I) {
      const codePoints = this.codePointIterator.subCodePoints();
      if (
        codePoints.next() === LATIN_SMALL_N &&
        codePoints.next() === LATIN_SMALL_F
      ) {
        this.skip(2);
        this.endToken(
          "Float",
          "end",
          this.text[this.tokenStart.offset] === "-" ? -Infinity : Infinity
        );
        return "DATA";
      }
    }
    return this.reportParseError("unexpected-char");
  }

  private NUMBER(cp: number): TokenizerState {
    const start = this.text[this.tokenStart.offset];
    const sign = start === "+" ? PLUS_SIGN : start === "-" ? DASH : NULL;
    if (cp === DIGIT_0) {
      if (sign === NULL) {
        const subCodePoints = this.codePointIterator.subCodePoints();
        const nextCp = subCodePoints.next();
        if (isDigit(nextCp)) {
          const nextNextCp = subCodePoints.next();
          if (
            (isDigit(nextNextCp) &&
              isDigit(subCodePoints.next()) &&
              subCodePoints.next() === DASH) ||
            nextNextCp === COLON
          ) {
            const isDate = nextNextCp !== COLON;
            const data: DateTimeData = {
              hasDate: isDate,
              year: 0,
              month: 0,
              day: 0,
              hour: 0,
              minute: 0,
              second: 0,
            };
            this.data = data;
            return this.back(isDate ? "DATE_YEAR" : "TIME_HOUR");
          }
          return this.reportParseError("invalid-leading-zero");
        }
      }

      cp = this.nextCode();
      if (
        cp === LATIN_SMALL_X ||
        cp === LATIN_SMALL_O ||
        cp === LATIN_SMALL_B
      ) {
        if (sign !== NULL) {
          return this.reportParseError("unexpected-char");
        }
        return cp === LATIN_SMALL_X
          ? "HEX"
          : cp === LATIN_SMALL_O
          ? "OCTAL"
          : "BINARY";
      }
      if (cp === LATIN_SMALL_E || cp === LATIN_CAPITAL_E) {
        const data: ExponentData = {
          // Float values -0.0 and +0.0 are valid and should map according to IEEE 754.
          left: sign === DASH ? -0 : 0,
        };
        this.data = data;
        return "EXPONENT_RIGHT";
      }
      if (cp === DOT) {
        const data: FractionalData = {
          minus: sign === DASH,
          absInt: 0,
        };
        this.data = data;
        return "FRACTIONAL_RIGHT";
      }
      // Integer values -0 and +0 are valid and identical to an unprefixed zero.
      this.endToken("Integer", "start", [DIGIT_0], 10);
      return this.back("DATA");
    }
    const { codePoints, nextCp, hasUnderscore } = this.parseDigits(cp, isDigit);

    if (
      nextCp === DASH &&
      sign === NULL &&
      !hasUnderscore &&
      codePoints.length === 4
    ) {
      const data: DateTimeData = {
        hasDate: true,
        year: Number(String.fromCodePoint(...codePoints)),
        month: 0,
        day: 0,
        hour: 0,
        minute: 0,
        second: 0,
      };
      this.data = data;
      return "DATE_MONTH";
    }
    if (
      nextCp === COLON &&
      sign === NULL &&
      !hasUnderscore &&
      codePoints.length === 2
    ) {
      const data: DateTimeData = {
        hasDate: false,
        year: 0,
        month: 0,
        day: 0,
        hour: Number(String.fromCodePoint(...codePoints)),
        minute: 0,
        second: 0,
      };
      this.data = data;
      return "TIME_MINUTE";
    }

    if (nextCp === LATIN_SMALL_E || nextCp === LATIN_CAPITAL_E) {
      const absNum = Number(String.fromCodePoint(...codePoints));
      const data: ExponentData = {
        left: sign === DASH ? -absNum : absNum,
      };
      this.data = data;
      return "EXPONENT_RIGHT";
    }
    if (nextCp === DOT) {
      const data: FractionalData = {
        minus: sign === DASH,
        absInt: Number(String.fromCodePoint(...codePoints)),
      };
      this.data = data;
      return "FRACTIONAL_RIGHT";
    }
    this.endToken(
      "Integer",
      "start",
      sign === DASH ? [DASH, ...codePoints] : codePoints,
      10
    );
    return this.back("DATA");
  }

  private HEX(cp: number): TokenizerState {
    const { codePoints } = this.parseDigits(cp, isHexDig);
    this.endToken("Integer", "start", codePoints, 16);
    return this.back("DATA");
  }

  private OCTAL(cp: number): TokenizerState {
    const { codePoints } = this.parseDigits(cp, isOctalDig);
    this.endToken("Integer", "start", codePoints, 8);
    return this.back("DATA");
  }

  private BINARY(cp: number): TokenizerState {
    const { codePoints } = this.parseDigits(
      cp,
      (c) => c === DIGIT_0 || c === DIGIT_1
    );
    this.endToken("Integer", "start", codePoints, 2);
    return this.back("DATA");
  }

  private FRACTIONAL_RIGHT(cp: number): TokenizerState {
    const { minus, absInt } = this.data! as FractionalData;
    const { codePoints, nextCp } = this.parseDigits(cp, isDigit);
    const absNum =
      absInt +
      Number(String.fromCodePoint(...codePoints)) *
        Math.pow(10, -codePoints.length);
    if (nextCp === LATIN_SMALL_E || nextCp === LATIN_CAPITAL_E) {
      const data: ExponentData = {
        left: minus ? -absNum : absNum,
      };
      this.data = data;
      return "EXPONENT_RIGHT";
    }
    this.endToken("Float", "start", minus ? -absNum : absNum);
    return this.back("DATA");
  }

  private EXPONENT_RIGHT(cp: number): TokenizerState {
    const { left } = this.data! as ExponentData;
    let minus = false;
    if (cp === DASH || cp === PLUS_SIGN) {
      minus = cp === DASH;
      cp = this.nextCode();
    }
    const { codePoints } = this.parseDigits(cp, isDigit);
    let right = Number(String.fromCodePoint(...codePoints));
    if (minus) {
      right = 0 - right;
    }
    this.endToken("Float", "start", left * Math.pow(10, right));
    return this.back("DATA");
  }

  private BOOLEAN(cp: number): TokenizerState {
    if (cp === LATIN_SMALL_T) {
      const codePoints = this.codePointIterator.subCodePoints();
      if (
        codePoints.next() === LATIN_SMALL_R &&
        codePoints.next() === LATIN_SMALL_U &&
        codePoints.next() === LATIN_SMALL_E
      ) {
        // true
        this.skip(codePoints.count);
        this.endToken("Boolean", "end", true);
        return "DATA";
      }
    } else if (cp === LATIN_SMALL_F) {
      const codePoints = this.codePointIterator.subCodePoints();
      if (
        codePoints.next() === LATIN_SMALL_A &&
        codePoints.next() === LATIN_SMALL_L &&
        codePoints.next() === LATIN_SMALL_S &&
        codePoints.next() === LATIN_SMALL_E
      ) {
        // false
        this.skip(codePoints.count);
        this.endToken("Boolean", "end", false);
        return "DATA";
      }
    }
    return this.reportParseError("unexpected-char");
  }

  private DATE_YEAR(cp: number): TokenizerState {
    // already checked
    const codePoints = [cp, this.nextCode(), this.nextCode(), this.nextCode()];
    this.nextCode(); // hyphen
    const data: DateTimeData = this.data! as DateTimeData;
    data.year = Number(String.fromCodePoint(...codePoints));
    return "DATE_MONTH";
  }

  private DATE_MONTH(cp: number): TokenizerState {
    const codePoints = [];
    if (isDigit(cp)) {
      codePoints.push(cp);
    } else {
      return this.reportParseError("unexpected-char");
    }
    cp = this.nextCode();
    if (isDigit(cp)) {
      codePoints.push(cp);
    } else {
      return this.reportParseError("unexpected-char");
    }
    cp = this.nextCode();
    if (cp !== DASH) {
      return this.reportParseError("unexpected-char");
    }
    const data: DateTimeData = this.data! as DateTimeData;
    data.month = Number(String.fromCodePoint(...codePoints));
    return "DATE_DAY";
  }

  private DATE_DAY(cp: number): TokenizerState {
    const codePoints = [];
    if (isDigit(cp)) {
      codePoints.push(cp);
    } else {
      return this.reportParseError("unexpected-char");
    }
    cp = this.nextCode();
    if (isDigit(cp)) {
      codePoints.push(cp);
    } else {
      return this.reportParseError("unexpected-char");
    }
    const data: DateTimeData = this.data! as DateTimeData;
    data.day = Number(String.fromCodePoint(...codePoints));
    if (!isValidDate(data.year, data.month, data.day)) {
      return this.reportParseError("invalid-date");
    }

    cp = this.nextCode();
    if (cp === LATIN_CAPITAL_T || cp === LATIN_SMALL_T) {
      return "TIME_HOUR";
    }
    if (cp === SPACE) {
      const subCodePoints = this.codePointIterator.subCodePoints();
      if (isDigit(subCodePoints.next()) && isDigit(subCodePoints.next())) {
        return "TIME_HOUR";
      }
    }
    this.endToken("LocalDate", "start");
    return this.back("DATA");
  }

  private TIME_HOUR(cp: number): TokenizerState {
    const codePoints = [];
    if (isDigit(cp)) {
      codePoints.push(cp);
    } else {
      return this.reportParseError("unexpected-char");
    }
    cp = this.nextCode();
    if (isDigit(cp)) {
      codePoints.push(cp);
    } else {
      return this.reportParseError("unexpected-char");
    }
    cp = this.nextCode();
    if (cp !== COLON) {
      return this.reportParseError("unexpected-char");
    }
    const data: DateTimeData = this.data! as DateTimeData;
    data.hour = Number(String.fromCodePoint(...codePoints));
    return "TIME_MINUTE";
  }

  private TIME_MINUTE(cp: number): TokenizerState {
    const codePoints = [];
    if (isDigit(cp)) {
      codePoints.push(cp);
    } else {
      return this.reportParseError("unexpected-char");
    }
    cp = this.nextCode();
    if (isDigit(cp)) {
      codePoints.push(cp);
    } else {
      return this.reportParseError("unexpected-char");
    }
    cp = this.nextCode();
    if (cp !== COLON) {
      return this.reportParseError("unexpected-char");
    }
    const data: DateTimeData = this.data! as DateTimeData;
    data.minute = Number(String.fromCodePoint(...codePoints));
    return "TIME_SECOND";
  }

  private TIME_SECOND(cp: number): TokenizerState {
    const codePoints = [];
    if (isDigit(cp)) {
      codePoints.push(cp);
    } else {
      return this.reportParseError("unexpected-char");
    }
    cp = this.nextCode();
    if (isDigit(cp)) {
      codePoints.push(cp);
    } else {
      return this.reportParseError("unexpected-char");
    }
    const data: DateTimeData = this.data! as DateTimeData;
    data.second = Number(String.fromCodePoint(...codePoints));
    if (!isValidTime(data.hour, data.minute, data.second)) {
      return this.reportParseError("invalid-time");
    }

    cp = this.nextCode();
    if (cp === DOT) {
      return "TIME_SEC_FRAC";
    }
    if (data.hasDate) {
      if (cp === DASH || cp === PLUS_SIGN) {
        return "TIME_OFFSET";
      }
      if (cp === LATIN_CAPITAL_Z || cp === LATIN_SMALL_Z) {
        this.endToken("OffsetDateTime", "end");
        return "DATA";
      }
      this.endToken("LocalDateTime", "start");
      return this.back("DATA");
    }
    this.endToken("LocalTime", "start");
    return this.back("DATA");
  }

  private TIME_SEC_FRAC(cp: number): TokenizerState {
    if (!isDigit(cp)) {
      return this.reportParseError("unexpected-char");
    }
    while (isDigit(cp)) {
      cp = this.nextCode();
    }
    const data: DateTimeData = this.data! as DateTimeData;
    if (data.hasDate) {
      if (cp === DASH || cp === PLUS_SIGN) {
        return "TIME_OFFSET";
      }
      if (cp === LATIN_CAPITAL_Z || cp === LATIN_SMALL_Z) {
        this.endToken("OffsetDateTime", "end");
        return "DATA";
      }
      this.endToken("LocalDateTime", "start");
      return this.back("DATA");
    }
    this.endToken("LocalTime", "start");
    return this.back("DATA");
  }

  private TIME_OFFSET(cp: number): TokenizerState {
    if (!isDigit(cp)) {
      return this.reportParseError("unexpected-char");
    }
    const hourCodePoints = [cp];
    cp = this.nextCode();
    if (isDigit(cp)) {
      hourCodePoints.push(cp);
    } else {
      return this.reportParseError("unexpected-char");
    }
    cp = this.nextCode();
    if (cp !== COLON) {
      return this.reportParseError("unexpected-char");
    }
    const minuteCodePoints: number[] = [];
    cp = this.nextCode();
    if (isDigit(cp)) {
      minuteCodePoints.push(cp);
    } else {
      return this.reportParseError("unexpected-char");
    }
    cp = this.nextCode();
    if (isDigit(cp)) {
      minuteCodePoints.push(cp);
    } else {
      return this.reportParseError("unexpected-char");
    }
    const hour = Number(String.fromCodePoint(...hourCodePoints));
    const minute = Number(String.fromCodePoint(...minuteCodePoints));
    if (!isValidTime(hour, minute, 0)) {
      return this.reportParseError("invalid-time");
    }

    this.endToken("OffsetDateTime", "end");
    return "DATA";
  }

  private parseDigits(cp: number, checkDigit: typeof isDigit) {
    if (cp === UNDERSCORE) {
      return this.reportParseError("invalid-underscore");
    }
    if (!checkDigit(cp)) {
      return this.reportParseError("unexpected-char");
    }
    const codePoints: number[] = [];
    let before = NULL;
    let hasUnderscore = false;
    while (checkDigit(cp) || cp === UNDERSCORE) {
      if (cp === UNDERSCORE) {
        hasUnderscore = true;
        if (before === UNDERSCORE) {
          return this.reportParseError("invalid-underscore");
        }
      } else {
        codePoints.push(cp);
      }
      before = cp;
      cp = this.nextCode();
    }
    if (before === UNDERSCORE) {
      return this.reportParseError("invalid-underscore");
    }
    return {
      codePoints,
      nextCp: cp,
      hasUnderscore,
    };
  }

  private parseUnicode(count: number): number {
    const codePoints = [];
    for (const cp of this.codePointIterator.iterateSubCodePoints()) {
      if (!isHexDig(cp)) {
        return this.reportParseError("invalid-char-in-escape-sequence");
      }
      codePoints.push(cp);
      if (codePoints.length >= count) {
        break;
      }
    }
    this.skip(codePoints.length);
    const code = String.fromCodePoint(...codePoints);
    const codePoint = parseInt(code, 16);
    if (!isUnicodeScalarValue(codePoint)) {
      return this.reportParseError("invalid-code-point", { cp: code });
    }
    return codePoint;
  }

  private reportParseErrorControlChar() {
    return this.reportParseError("invalid-control-character");
  }
}

/**
 * Check whether the code point is [A-Za-z0-9_-]
 */
function isBare(cp: number): boolean {
  return isLetter(cp) || isDigit(cp) || cp === UNDERSCORE || cp === DASH;
}

/**
 * Check whether the code point is [A-Za-z0-9_-]
 */
function isControlOtherThanTab(cp: number): boolean {
  return (isControl(cp) && cp !== TABULATION) || cp === DELETE;
}

/**
 * Check whether the given values is valid date
 */
function isValidDate(y: number, m: number, d: number): boolean {
  if (y <= 0 || m > 12 || m <= 0 || d <= 0) {
    return false;
  }
  const maxDayOfMonth =
    m === 2
      ? y & 3 || (!(y % 25) && y & 15)
        ? 28
        : 29
      : 30 + ((m + (m >> 3)) & 1);
  return d <= maxDayOfMonth;
}

/**
 * Check whether the given values is valid time
 */
function isValidTime(h: number, m: number, s: number): boolean {
  if (h >= 24 || h < 0 || m > 59 || m < 0 || s > 60 || s < 0) {
    return false;
  }
  return true;
}
