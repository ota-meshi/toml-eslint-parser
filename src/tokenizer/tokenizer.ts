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
import type { TOMLVer } from "../parser-options";
import { getTOMLVer, type ParserOptions } from "../parser-options";
import { CodePointIterator } from "./code-point-iterator";
import {
  CodePoint,
  isWhitespace,
  isEOL,
  isHexDig,
  isLetter,
  isDigit,
  isControl,
  isOctalDig,
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
  2: "0b",
};

const ESCAPES_1_0: Record<number, number> = {
  // escape-seq-char =  %x22         ; "    quotation mark  U+0022
  [CodePoint.QUOTATION_MARK]: CodePoint.QUOTATION_MARK,
  // escape-seq-char =/ %x5C         ; \    reverse solidus U+005C
  [CodePoint.BACKSLASH]: CodePoint.BACKSLASH,
  // escape-seq-char =/ %x62         ; b    backspace       U+0008
  [CodePoint.LATIN_SMALL_B]: CodePoint.BACKSPACE,
  // escape-seq-char =/ %x66         ; f    form feed       U+000C
  [CodePoint.LATIN_SMALL_F]: CodePoint.FORM_FEED,
  // escape-seq-char =/ %x6E         ; n    line feed       U+000A
  [CodePoint.LATIN_SMALL_N]: CodePoint.LINE_FEED,
  // escape-seq-char =/ %x72         ; r    carriage return U+000D
  [CodePoint.LATIN_SMALL_R]: CodePoint.CARRIAGE_RETURN,
  // escape-seq-char =/ %x74         ; t    tab             U+0009
  [CodePoint.LATIN_SMALL_T]: CodePoint.TABULATION,
};

const ESCAPES_LATEST: Record<number, number> = {
  ...ESCAPES_1_0,
  // escape-seq-char =/ %x65         ; e    escape          U+001B
  // Added in TOML 1.1
  [CodePoint.LATIN_SMALL_E]: CodePoint.ESCAPE,
};

type ExponentData = {
  minus: boolean;
  left: number[];
};
type FractionalData = {
  minus: boolean;
  absInt: number[];
};
type DateTimeData = {
  hasDate: boolean;
  year: number;
  month: number;
  day: number;

  hour: number;
  minute: number;
  second: number;

  frac?: string;
  offsetSign?: number;
};

/**
 * Tokenizer for TOML.
 */
export class Tokenizer {
  public readonly text: string;

  private readonly parserOptions: ParserOptions;

  private readonly tomlVersion: TOMLVer;

  private readonly ESCAPES: Record<number, number>;

  private readonly codePointIterator: CodePointIterator;

  private backCode = false;

  private lastCodePoint: number = CodePoint.NULL;

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
    this.tomlVersion = getTOMLVer(this.parserOptions.tomlVersion);
    this.ESCAPES = this.tomlVersion.gte(1, 1) ? ESCAPES_LATEST : ESCAPES_1_0;
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
    data?: { [key: string]: any },
  ): any {
    throw new ParseError(
      code,
      this.codePointIterator.start.offset,
      this.codePointIterator.start.line,
      this.codePointIterator.start.column,
      data,
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
    while (cp !== CodePoint.EOF && !this.token) {
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
    if (this.lastCodePoint === CodePoint.EOF) {
      return CodePoint.EOF;
    }
    if (this.backCode) {
      this.backCode = false;
      return this.lastCodePoint;
    }
    return (this.lastCodePoint = this.codePointIterator.next());
  }

  /**
   * Eat the next code point.
   */
  private eatCode(cp: number): boolean {
    if (this.lastCodePoint === CodePoint.EOF) {
      return false;
    }
    if (this.backCode) {
      if (this.lastCodePoint === cp) {
        this.backCode = false;
        return true;
      }
      return false;
    }
    return this.codePointIterator.eat(cp);
  }

  /**
   * Moves the character position to the given position.
   */
  private moveAt(loc: Position): void {
    if (this.backCode) {
      this.backCode = false;
    }
    this.lastCodePoint = this.codePointIterator.moveAt(loc);
  }

  /**
   * Back the current code point as the given state.
   */
  private back(state: TokenizerState): TokenizerState {
    this.backCode = true;
    return state;
  }

  private punctuatorToken(): void {
    this.startToken();
    this.endToken("Punctuator", "end");
  }

  private startToken(): void {
    this.tokenStart = {
      ...this.codePointIterator.start,
    };
  }

  private endToken(
    type: BareToken["type"] | Comment["type"],
    pos: "start" | "end",
  ): void;

  private endToken(
    // eslint-disable-next-line @typescript-eslint/unified-signatures -- ignore
    type: PunctuatorToken["type"],
    pos: "start" | "end",
  ): void;

  private endToken(
    type: StringToken["type"] | MultiLineStringToken["type"],
    pos: "start" | "end",
    text: string,
  ): void;

  private endToken(
    type: IntegerToken["type"],
    pos: "start" | "end",
    text: string,
    radix: 16 | 10 | 8 | 2,
  ): void;

  private endToken(
    type: FloatToken["type"],
    pos: "start" | "end",
    value: number,
  ): void;

  private endToken(
    type: DateTimeToken["type"],
    pos: "start" | "end",
    value: Date,
  ): void;

  private endToken(
    type: BooleanToken["type"],
    pos: "start" | "end",
    value: boolean,
  ): void;

  /**
   * Commit the current token.
   */
  private endToken(
    type: TokenType | Comment["type"],
    pos: "start" | "end",
    option1?: number | boolean | Date | string,
    option2?: 16 | 10 | 8 | 2,
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
      const value = this.text.slice(tokenStart.offset, end.offset);
      if (
        type === "BasicString" ||
        type === "LiteralString" ||
        type === "MultiLineBasicString" ||
        type === "MultiLineLiteralString"
      ) {
        token = {
          type,
          value,
          string: option1! as string,
          range,
          loc,
        };
      } else if (type === "Integer") {
        const text = option1! as string;
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
      } else if (
        type === "LocalDate" ||
        type === "LocalTime" ||
        type === "LocalDateTime" ||
        type === "OffsetDateTime"
      ) {
        token = {
          type,
          value,
          date: option1! as Date,
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
    if (cp === CodePoint.HASH) {
      this.startToken();
      return "COMMENT";
    }
    if (cp === CodePoint.QUOTATION_MARK) {
      this.startToken();
      return "BASIC_STRING";
    }
    if (cp === CodePoint.SINGLE_QUOTE) {
      this.startToken();
      return "LITERAL_STRING";
    }
    if (
      cp === CodePoint.DOT || // .
      cp === CodePoint.EQUALS_SIGN || // =
      cp === CodePoint.LEFT_BRACKET || // [
      cp === CodePoint.RIGHT_BRACKET || // ]
      cp === CodePoint.LEFT_BRACE || // {
      cp === CodePoint.RIGHT_BRACE || // }
      cp === CodePoint.COMMA // ,
    ) {
      this.punctuatorToken();
      return "DATA";
    }

    if (this.valuesEnabled) {
      if (cp === CodePoint.DASH || cp === CodePoint.PLUS_SIGN) {
        this.startToken();
        return "SIGN";
      }
      if (cp === CodePoint.LATIN_SMALL_N || cp === CodePoint.LATIN_SMALL_I) {
        this.startToken();
        return this.back("NAN_OR_INF");
      }
      if (isDigit(cp)) {
        this.startToken();
        return this.back("NUMBER");
      }
      if (cp === CodePoint.LATIN_SMALL_T || cp === CodePoint.LATIN_SMALL_F) {
        this.startToken();
        return this.back("BOOLEAN");
      }
    } else {
      if (isUnquotedKeyChar(cp, this.tomlVersion)) {
        this.startToken();
        return "BARE";
      }
    }

    if (cp === CodePoint.EOF) {
      // end
      return "DATA";
    }

    return this.reportParseError("unexpected-char");
  }

  private COMMENT(cp: number): TokenizerState {
    const processCommentChar = this.tomlVersion.gte(1, 1)
      ? (c: number) => {
          if (!isAllowedCommentCharacter(c)) {
            this.reportParseError("invalid-comment-character");
          }
        }
      : (c: number) => {
          if (isControlOtherThanTab(c)) {
            this.reportParseErrorControlChar();
          }
        };
    while (!isEOL(cp) && cp !== CodePoint.EOF) {
      processCommentChar(cp);
      cp = this.nextCode();
    }
    this.endToken("Block", "start");
    return "DATA";
  }

  private BARE(cp: number): TokenizerState {
    while (isUnquotedKeyChar(cp, this.tomlVersion)) {
      cp = this.nextCode();
    }
    this.endToken("Bare", "start");
    return this.back("DATA");
  }

  private BASIC_STRING(cp: number): TokenizerState {
    if (cp === CodePoint.QUOTATION_MARK) {
      cp = this.nextCode();
      if (cp === CodePoint.QUOTATION_MARK) {
        return "MULTI_LINE_BASIC_STRING";
      }
      this.endToken("BasicString", "start", "");
      return this.back("DATA");
    }
    const out: number[] = [];
    while (
      cp !== CodePoint.QUOTATION_MARK &&
      cp !== CodePoint.EOF &&
      cp !== CodePoint.LINE_FEED
    ) {
      if (isControlOtherThanTab(cp)) {
        return this.reportParseErrorControlChar();
      }
      if (cp === CodePoint.BACKSLASH) {
        cp = this.nextCode();
        const ecp = this.ESCAPES[cp];
        if (ecp) {
          out.push(ecp);
          cp = this.nextCode();
          continue;
        } else if (cp === CodePoint.LATIN_SMALL_U) {
          // escape-seq-char =/ %x75 4HEXDIG ; uHHHH                U+HHHH
          const code = this.parseUnicode(4);
          out.push(code);
          cp = this.nextCode();
          continue;
        } else if (cp === CodePoint.LATIN_CAPITAL_U) {
          // escape-seq-char =/ %x55 8HEXDIG ; UHHHHHHHH            U+HHHHHHHH
          const code = this.parseUnicode(8);
          out.push(code);
          cp = this.nextCode();
          continue;
        } else if (
          cp === CodePoint.LATIN_SMALL_X &&
          this.tomlVersion.gte(1, 1)
        ) {
          // escape-seq-char =/ %x78 2HEXDIG ; xHH                  U+00HH
          // Added in TOML 1.1
          const code = this.parseUnicode(2);
          out.push(code);
          cp = this.nextCode();
          continue;
        }
        return this.reportParseError("invalid-char-in-escape-sequence");
      }
      out.push(cp);
      cp = this.nextCode();
    }
    if (cp !== CodePoint.QUOTATION_MARK) {
      return this.reportParseError("unterminated-string");
    }
    this.endToken("BasicString", "end", String.fromCodePoint(...out));
    return "DATA";
  }

  private MULTI_LINE_BASIC_STRING(cp: number): TokenizerState {
    const out: number[] = [];
    if (cp === CodePoint.LINE_FEED) {
      // A newline immediately following the opening delimiter will be trimmed.
      cp = this.nextCode();
    }
    while (cp !== CodePoint.EOF) {
      if (cp !== CodePoint.LINE_FEED && isControlOtherThanTab(cp)) {
        return this.reportParseErrorControlChar();
      }
      if (cp === CodePoint.QUOTATION_MARK) {
        const startPos = { ...this.codePointIterator.start };
        if (
          this.eatCode(CodePoint.QUOTATION_MARK) &&
          this.eatCode(CodePoint.QUOTATION_MARK)
        ) {
          if (this.eatCode(CodePoint.QUOTATION_MARK)) {
            out.push(CodePoint.QUOTATION_MARK);
            if (this.eatCode(CodePoint.QUOTATION_MARK)) {
              out.push(CodePoint.QUOTATION_MARK);
              if (this.eatCode(CodePoint.QUOTATION_MARK)) {
                this.moveAt(startPos);
                return this.reportParseError("invalid-three-quotes");
              }
            }
          }
          // end
          this.endToken(
            "MultiLineBasicString",
            "end",
            String.fromCodePoint(...out),
          );
          return "DATA";
        }
        this.moveAt(startPos);
      }
      if (cp === CodePoint.BACKSLASH) {
        cp = this.nextCode();
        const ecp = this.ESCAPES[cp];
        if (ecp) {
          out.push(ecp);
          cp = this.nextCode();
          continue;
        } else if (cp === CodePoint.LATIN_SMALL_U) {
          // escape-seq-char =/ %x75 4HEXDIG ; uHHHH                U+HHHH
          const code = this.parseUnicode(4);
          out.push(code);
          cp = this.nextCode();
          continue;
        } else if (cp === CodePoint.LATIN_CAPITAL_U) {
          // escape-seq-char =/ %x55 8HEXDIG ; UHHHHHHHH            U+HHHHHHHH
          const code = this.parseUnicode(8);
          out.push(code);
          cp = this.nextCode();
          continue;
        } else if (
          cp === CodePoint.LATIN_SMALL_X &&
          this.tomlVersion.gte(1, 1)
        ) {
          // escape-seq-char =/ %x78 2HEXDIG ; xHH                  U+00HH
          // Added in TOML 1.1
          const code = this.parseUnicode(2);
          out.push(code);
          cp = this.nextCode();
          continue;
        } else if (cp === CodePoint.LINE_FEED) {
          cp = this.nextCode();
          while (isWhitespace(cp) || cp === CodePoint.LINE_FEED) {
            cp = this.nextCode();
          }
          continue;
        } else if (isWhitespace(cp)) {
          let valid = true;
          const startPos = { ...this.codePointIterator.start };
          let nextCp: number;
          while ((nextCp = this.nextCode()) !== CodePoint.EOF) {
            if (nextCp === CodePoint.LINE_FEED) {
              break;
            }
            if (!isWhitespace(nextCp)) {
              this.moveAt(startPos);
              valid = false;
              break;
            }
          }
          if (valid) {
            cp = this.nextCode();
            while (isWhitespace(cp) || cp === CodePoint.LINE_FEED) {
              cp = this.nextCode();
            }
            continue;
          }
        }
        return this.reportParseError("invalid-char-in-escape-sequence");
      }
      out.push(cp);
      cp = this.nextCode();
    }

    return this.reportParseError("unterminated-string");
  }

  private LITERAL_STRING(cp: number): TokenizerState {
    if (cp === CodePoint.SINGLE_QUOTE) {
      cp = this.nextCode();
      if (cp === CodePoint.SINGLE_QUOTE) {
        return "MULTI_LINE_LITERAL_STRING";
      }
      this.endToken("LiteralString", "start", "");
      return this.back("DATA");
    }
    const out: number[] = [];
    while (
      cp !== CodePoint.SINGLE_QUOTE &&
      cp !== CodePoint.EOF &&
      cp !== CodePoint.LINE_FEED
    ) {
      if (isControlOtherThanTab(cp)) {
        return this.reportParseErrorControlChar();
      }
      out.push(cp);
      cp = this.nextCode();
    }
    if (cp !== CodePoint.SINGLE_QUOTE) {
      return this.reportParseError("unterminated-string");
    }
    this.endToken("LiteralString", "end", String.fromCodePoint(...out));
    return "DATA";
  }

  private MULTI_LINE_LITERAL_STRING(cp: number): TokenizerState {
    const out: number[] = [];
    if (cp === CodePoint.LINE_FEED) {
      // A newline immediately following the opening delimiter will be trimmed.
      cp = this.nextCode();
    }
    while (cp !== CodePoint.EOF) {
      if (cp !== CodePoint.LINE_FEED && isControlOtherThanTab(cp)) {
        return this.reportParseErrorControlChar();
      }
      if (cp === CodePoint.SINGLE_QUOTE) {
        const startPos = { ...this.codePointIterator.start };
        if (
          this.eatCode(CodePoint.SINGLE_QUOTE) &&
          this.eatCode(CodePoint.SINGLE_QUOTE)
        ) {
          if (this.eatCode(CodePoint.SINGLE_QUOTE)) {
            out.push(CodePoint.SINGLE_QUOTE);
            if (this.eatCode(CodePoint.SINGLE_QUOTE)) {
              out.push(CodePoint.SINGLE_QUOTE);
              if (this.eatCode(CodePoint.SINGLE_QUOTE)) {
                this.moveAt(startPos);
                return this.reportParseError("invalid-three-quotes");
              }
            }
          }
          // end
          this.endToken(
            "MultiLineLiteralString",
            "end",
            String.fromCodePoint(...out),
          );
          return "DATA";
        }
        this.moveAt(startPos);
      }
      out.push(cp);
      cp = this.nextCode();
    }
    return this.reportParseError("unterminated-string");
  }

  private SIGN(cp: number): TokenizerState {
    if (cp === CodePoint.LATIN_SMALL_N || cp === CodePoint.LATIN_SMALL_I) {
      return this.back("NAN_OR_INF");
    }
    if (isDigit(cp)) {
      return this.back("NUMBER");
    }
    return this.reportParseError("unexpected-char");
  }

  private NAN_OR_INF(cp: number): TokenizerState {
    if (cp === CodePoint.LATIN_SMALL_N) {
      const startPos = { ...this.codePointIterator.start };
      if (
        this.eatCode(CodePoint.LATIN_SMALL_A) &&
        this.eatCode(CodePoint.LATIN_SMALL_N)
      ) {
        this.endToken("Float", "end", NaN);
        return "DATA";
      }
      this.moveAt(startPos);
    } else if (cp === CodePoint.LATIN_SMALL_I) {
      const startPos = { ...this.codePointIterator.start };
      if (
        this.eatCode(CodePoint.LATIN_SMALL_N) &&
        this.eatCode(CodePoint.LATIN_SMALL_F)
      ) {
        this.endToken(
          "Float",
          "end",
          this.text[this.tokenStart.offset] === "-" ? -Infinity : Infinity,
        );
        return "DATA";
      }
      this.moveAt(startPos);
    }
    return this.reportParseError("unexpected-char");
  }

  private NUMBER(cp: number): TokenizerState {
    const start = this.text[this.tokenStart.offset];
    const sign =
      start === "+"
        ? CodePoint.PLUS_SIGN
        : start === "-"
        ? CodePoint.DASH
        : CodePoint.NULL;
    if (cp === CodePoint.DIGIT_0) {
      if (sign === CodePoint.NULL) {
        const startPos = { ...this.codePointIterator.start };
        const nextCp = this.nextCode();
        if (isDigit(nextCp)) {
          const nextNextCp = this.nextCode();
          if (nextNextCp === CodePoint.COLON) {
            const data: DateTimeData = {
              hasDate: false,
              year: 0,
              month: 0,
              day: 0,
              hour: Number(String.fromCodePoint(CodePoint.DIGIT_0, nextCp)),
              minute: 0,
              second: 0,
            };
            this.data = data;
            return "TIME_MINUTE";
          }
          if (isDigit(nextNextCp)) {
            const nextNextNextCp = this.nextCode();
            if (isDigit(nextNextNextCp) && this.eatCode(CodePoint.DASH)) {
              const data: DateTimeData = {
                hasDate: true,
                year: Number(
                  String.fromCodePoint(
                    CodePoint.DIGIT_0,
                    nextCp,
                    nextNextCp,
                    nextNextNextCp,
                  ),
                ),
                month: 0,
                day: 0,
                hour: 0,
                minute: 0,
                second: 0,
              };
              this.data = data;
              return "DATE_MONTH";
            }
          }
          this.moveAt(startPos);
          return this.reportParseError("invalid-leading-zero");
        }
        this.moveAt(startPos);
      }

      cp = this.nextCode();
      if (
        cp === CodePoint.LATIN_SMALL_X ||
        cp === CodePoint.LATIN_SMALL_O ||
        cp === CodePoint.LATIN_SMALL_B
      ) {
        if (sign !== CodePoint.NULL) {
          return this.reportParseError("unexpected-char");
        }
        return cp === CodePoint.LATIN_SMALL_X
          ? "HEX"
          : cp === CodePoint.LATIN_SMALL_O
          ? "OCTAL"
          : "BINARY";
      }
      if (cp === CodePoint.LATIN_SMALL_E || cp === CodePoint.LATIN_CAPITAL_E) {
        const data: ExponentData = {
          // Float values -0.0 and +0.0 are valid and should map according to IEEE 754.
          minus: sign === CodePoint.DASH,
          left: [CodePoint.DIGIT_0],
        };
        this.data = data;
        return "EXPONENT_RIGHT";
      }
      if (cp === CodePoint.DOT) {
        const data: FractionalData = {
          minus: sign === CodePoint.DASH,
          absInt: [CodePoint.DIGIT_0],
        };
        this.data = data;
        return "FRACTIONAL_RIGHT";
      }
      // Integer values -0 and +0 are valid and identical to an unprefixed zero.
      this.endToken("Integer", "start", "0", 10);
      return this.back("DATA");
    }
    const { out, nextCp, hasUnderscore } = this.parseDigits(cp, isDigit);

    if (
      nextCp === CodePoint.DASH &&
      sign === CodePoint.NULL &&
      !hasUnderscore &&
      out.length === 4
    ) {
      const data: DateTimeData = {
        hasDate: true,
        year: Number(String.fromCodePoint(...out)),
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
      nextCp === CodePoint.COLON &&
      sign === CodePoint.NULL &&
      !hasUnderscore &&
      out.length === 2
    ) {
      const data: DateTimeData = {
        hasDate: false,
        year: 0,
        month: 0,
        day: 0,
        hour: Number(String.fromCodePoint(...out)),
        minute: 0,
        second: 0,
      };
      this.data = data;
      return "TIME_MINUTE";
    }

    if (
      nextCp === CodePoint.LATIN_SMALL_E ||
      nextCp === CodePoint.LATIN_CAPITAL_E
    ) {
      const data: ExponentData = {
        minus: sign === CodePoint.DASH,
        left: out,
      };
      this.data = data;
      return "EXPONENT_RIGHT";
    }
    if (nextCp === CodePoint.DOT) {
      const data: FractionalData = {
        minus: sign === CodePoint.DASH,
        absInt: out,
      };
      this.data = data;
      return "FRACTIONAL_RIGHT";
    }
    this.endToken(
      "Integer",
      "start",
      sign === CodePoint.DASH
        ? String.fromCodePoint(CodePoint.DASH, ...out)
        : String.fromCodePoint(...out),
      10,
    );
    return this.back("DATA");
  }

  private HEX(cp: number): TokenizerState {
    const { out } = this.parseDigits(cp, isHexDig);
    this.endToken("Integer", "start", String.fromCodePoint(...out), 16);
    return this.back("DATA");
  }

  private OCTAL(cp: number): TokenizerState {
    const { out } = this.parseDigits(cp, isOctalDig);
    this.endToken("Integer", "start", String.fromCodePoint(...out), 8);
    return this.back("DATA");
  }

  private BINARY(cp: number): TokenizerState {
    const { out } = this.parseDigits(
      cp,
      (c) => c === CodePoint.DIGIT_0 || c === CodePoint.DIGIT_1,
    );
    this.endToken("Integer", "start", String.fromCodePoint(...out), 2);
    return this.back("DATA");
  }

  private FRACTIONAL_RIGHT(cp: number): TokenizerState {
    const { minus, absInt } = this.data! as FractionalData;
    const { out, nextCp } = this.parseDigits(cp, isDigit);
    const absNum = [...absInt, CodePoint.DOT, ...out];
    if (
      nextCp === CodePoint.LATIN_SMALL_E ||
      nextCp === CodePoint.LATIN_CAPITAL_E
    ) {
      const data: ExponentData = {
        minus,
        left: absNum,
      };
      this.data = data;
      return "EXPONENT_RIGHT";
    }
    const value = Number(
      minus
        ? String.fromCodePoint(CodePoint.DASH, ...absNum)
        : String.fromCodePoint(...absNum),
    );
    this.endToken("Float", "start", value);
    return this.back("DATA");
  }

  private EXPONENT_RIGHT(cp: number): TokenizerState {
    const { left, minus: leftMinus } = this.data! as ExponentData;
    let minus = false;
    if (cp === CodePoint.DASH || cp === CodePoint.PLUS_SIGN) {
      minus = cp === CodePoint.DASH;
      cp = this.nextCode();
    }
    const { out } = this.parseDigits(cp, isDigit);
    const right = out;
    if (minus) {
      right.unshift(CodePoint.DASH);
    }
    const value = Number(
      leftMinus
        ? String.fromCodePoint(
            CodePoint.DASH,
            ...left,
            CodePoint.LATIN_SMALL_E,
            ...right,
          )
        : String.fromCodePoint(...left, CodePoint.LATIN_SMALL_E, ...right),
    );
    this.endToken("Float", "start", value);
    return this.back("DATA");
  }

  private BOOLEAN(cp: number): TokenizerState {
    if (cp === CodePoint.LATIN_SMALL_T) {
      const startPos = { ...this.codePointIterator.start };
      if (
        this.eatCode(CodePoint.LATIN_SMALL_R) &&
        this.eatCode(CodePoint.LATIN_SMALL_U) &&
        this.eatCode(CodePoint.LATIN_SMALL_E)
      ) {
        // true
        this.endToken("Boolean", "end", true);
        return "DATA";
      }
      this.moveAt(startPos);
    } else if (cp === CodePoint.LATIN_SMALL_F) {
      const startPos = { ...this.codePointIterator.start };
      if (
        this.eatCode(CodePoint.LATIN_SMALL_A) &&
        this.eatCode(CodePoint.LATIN_SMALL_L) &&
        this.eatCode(CodePoint.LATIN_SMALL_S) &&
        this.eatCode(CodePoint.LATIN_SMALL_E)
      ) {
        // false
        this.endToken("Boolean", "end", false);
        return "DATA";
      }
      this.moveAt(startPos);
    }
    return this.reportParseError("unexpected-char");
  }

  private DATE_MONTH(cp: number): TokenizerState {
    const start = this.codePointIterator.start.offset;
    if (!isDigit(cp)) {
      return this.reportParseError("unexpected-char");
    }
    cp = this.nextCode();
    if (!isDigit(cp)) {
      return this.reportParseError("unexpected-char");
    }
    cp = this.nextCode();
    if (cp !== CodePoint.DASH) {
      return this.reportParseError("unexpected-char");
    }
    const end = this.codePointIterator.start.offset;
    const data: DateTimeData = this.data! as DateTimeData;
    data.month = Number(this.text.slice(start, end));
    return "DATE_DAY";
  }

  private DATE_DAY(cp: number): TokenizerState {
    const start = this.codePointIterator.start.offset;
    if (!isDigit(cp)) {
      return this.reportParseError("unexpected-char");
    }
    cp = this.nextCode();
    if (!isDigit(cp)) {
      return this.reportParseError("unexpected-char");
    }
    const end = this.codePointIterator.end.offset;
    const data: DateTimeData = this.data! as DateTimeData;
    data.day = Number(this.text.slice(start, end));
    if (!isValidDate(data.year, data.month, data.day)) {
      return this.reportParseError("invalid-date");
    }

    cp = this.nextCode();
    if (cp === CodePoint.LATIN_CAPITAL_T || cp === CodePoint.LATIN_SMALL_T) {
      return "TIME_HOUR";
    }
    if (cp === CodePoint.SPACE) {
      const startPos = { ...this.codePointIterator.start };
      if (isDigit(this.nextCode()) && isDigit(this.nextCode())) {
        this.moveAt(startPos);
        return "TIME_HOUR";
      }
      this.moveAt(startPos);
    }
    const dateValue = getDateFromDateTimeData(data, "");
    this.endToken("LocalDate", "start", dateValue);
    return this.back("DATA");
  }

  private TIME_HOUR(cp: number): TokenizerState {
    const start = this.codePointIterator.start.offset;
    if (!isDigit(cp)) {
      return this.reportParseError("unexpected-char");
    }
    cp = this.nextCode();
    if (!isDigit(cp)) {
      return this.reportParseError("unexpected-char");
    }
    cp = this.nextCode();
    if (cp !== CodePoint.COLON) {
      return this.reportParseError("unexpected-char");
    }
    const end = this.codePointIterator.start.offset;
    const data: DateTimeData = this.data! as DateTimeData;
    data.hour = Number(this.text.slice(start, end));
    return "TIME_MINUTE";
  }

  private TIME_MINUTE(cp: number): TokenizerState {
    const start = this.codePointIterator.start.offset;
    if (!isDigit(cp)) {
      return this.reportParseError("unexpected-char");
    }
    cp = this.nextCode();
    if (!isDigit(cp)) {
      return this.reportParseError("unexpected-char");
    }
    const end = this.codePointIterator.end.offset;
    const data: DateTimeData = this.data! as DateTimeData;
    data.minute = Number(this.text.slice(start, end));
    cp = this.nextCode();
    if (cp === CodePoint.COLON) {
      return "TIME_SECOND";
    }
    if (this.tomlVersion.lt(1, 1)) {
      return this.reportParseError("unexpected-char");
    }
    // Omitted seconds
    // Added in TOML 1.1
    if (!isValidTime(data.hour, data.minute, data.second)) {
      return this.reportParseError("invalid-time");
    }
    return this.processTimeEnd(cp, data);
  }

  private TIME_SECOND(cp: number): TokenizerState {
    const start = this.codePointIterator.start.offset;
    if (!isDigit(cp)) {
      return this.reportParseError("unexpected-char");
    }
    cp = this.nextCode();
    if (!isDigit(cp)) {
      return this.reportParseError("unexpected-char");
    }
    const end = this.codePointIterator.end.offset;
    const data: DateTimeData = this.data! as DateTimeData;
    data.second = Number(this.text.slice(start, end));
    if (!isValidTime(data.hour, data.minute, data.second)) {
      return this.reportParseError("invalid-time");
    }

    cp = this.nextCode();
    if (cp === CodePoint.DOT) {
      return "TIME_SEC_FRAC";
    }
    return this.processTimeEnd(cp, data);
  }

  private TIME_SEC_FRAC(cp: number): TokenizerState {
    if (!isDigit(cp)) {
      return this.reportParseError("unexpected-char");
    }
    const start = this.codePointIterator.start.offset;
    while (isDigit(cp)) {
      cp = this.nextCode();
    }
    const end = this.codePointIterator.start.offset;
    const data: DateTimeData = this.data! as DateTimeData;
    data.frac = this.text.slice(start, end);
    return this.processTimeEnd(cp, data);
  }

  private processTimeEnd(cp: number, data: DateTimeData): TokenizerState {
    if (data.hasDate) {
      if (cp === CodePoint.DASH || cp === CodePoint.PLUS_SIGN) {
        data.offsetSign = cp;
        return "TIME_OFFSET";
      }
      if (cp === CodePoint.LATIN_CAPITAL_Z || cp === CodePoint.LATIN_SMALL_Z) {
        const dateValue = getDateFromDateTimeData(data, "Z");
        this.endToken("OffsetDateTime", "end", dateValue);
        return "DATA";
      }
      const dateValue = getDateFromDateTimeData(data, "");
      this.endToken("LocalDateTime", "start", dateValue);
      return this.back("DATA");
    }
    const dateValue = getDateFromDateTimeData(data, "");
    this.endToken("LocalTime", "start", dateValue);
    return this.back("DATA");
  }

  private TIME_OFFSET(cp: number): TokenizerState {
    if (!isDigit(cp)) {
      return this.reportParseError("unexpected-char");
    }
    const hourStart = this.codePointIterator.start.offset;
    cp = this.nextCode();
    if (!isDigit(cp)) {
      return this.reportParseError("unexpected-char");
    }
    cp = this.nextCode();
    if (cp !== CodePoint.COLON) {
      return this.reportParseError("unexpected-char");
    }
    const hourEnd = this.codePointIterator.start.offset;
    cp = this.nextCode();
    const minuteStart = this.codePointIterator.start.offset;
    if (!isDigit(cp)) {
      return this.reportParseError("unexpected-char");
    }
    cp = this.nextCode();
    if (!isDigit(cp)) {
      return this.reportParseError("unexpected-char");
    }
    const minuteEnd = this.codePointIterator.end.offset;
    const hour = Number(this.text.slice(hourStart, hourEnd));
    const minute = Number(this.text.slice(minuteStart, minuteEnd));
    if (!isValidTime(hour, minute, 0)) {
      return this.reportParseError("invalid-time");
    }

    const data: DateTimeData = this.data! as DateTimeData;
    const dateValue = getDateFromDateTimeData(
      data,
      `${String.fromCodePoint(data.offsetSign!)}${padStart(hour, 2)}:${padStart(
        minute,
        2,
      )}`,
    );
    this.endToken("OffsetDateTime", "end", dateValue);
    return "DATA";
  }

  private parseDigits(
    cp: number,
    checkDigit: typeof isDigit,
  ): {
    out: number[];
    nextCp: number;
    hasUnderscore: boolean;
  } {
    if (cp === CodePoint.UNDERSCORE) {
      return this.reportParseError("invalid-underscore");
    }
    if (!checkDigit(cp)) {
      return this.reportParseError("unexpected-char");
    }
    const out: number[] = [];
    let before = CodePoint.NULL;
    let hasUnderscore = false;
    while (checkDigit(cp) || cp === CodePoint.UNDERSCORE) {
      if (cp === CodePoint.UNDERSCORE) {
        hasUnderscore = true;
        if (before === CodePoint.UNDERSCORE) {
          return this.reportParseError("invalid-underscore");
        }
      } else {
        out.push(cp);
      }
      before = cp;
      cp = this.nextCode();
    }
    if (before === CodePoint.UNDERSCORE) {
      return this.reportParseError("invalid-underscore");
    }
    return {
      out,
      nextCp: cp,
      hasUnderscore,
    };
  }

  private parseUnicode(count: number): number {
    const startLoc = { ...this.codePointIterator.start };
    const start = this.codePointIterator.end.offset;
    let charCount = 0;
    let cp: number;
    while ((cp = this.nextCode()) !== CodePoint.EOF) {
      if (!isHexDig(cp)) {
        this.moveAt(startLoc);
        return this.reportParseError("invalid-char-in-escape-sequence");
      }
      charCount++;
      if (charCount >= count) {
        break;
      }
    }
    const end = this.codePointIterator.end.offset;
    const code = this.text.slice(start, end);
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
 * Check whether the code point is unquoted-key-char
 */
function isUnquotedKeyChar(cp: number, tomlVersion: TOMLVer): boolean {
  // unquoted-key-char = ALPHA / DIGIT / %x2D / %x5F         ; a-z A-Z 0-9 - _
  if (
    isLetter(cp) ||
    isDigit(cp) ||
    cp === CodePoint.UNDERSCORE ||
    cp === CodePoint.DASH
  ) {
    return true;
  }
  if (tomlVersion.lt(1, 1)) {
    // TOML 1.0
    // unquoted-key = 1*( ALPHA / DIGIT / %x2D / %x5F ) ; A-Z / a-z / 0-9 / - / _
    return false;
  }

  // Other unquoted-key-char
  // Added in TOML 1.1
  if (
    cp === CodePoint.SUPERSCRIPT_TWO ||
    cp === CodePoint.SUPERSCRIPT_THREE ||
    cp === CodePoint.SUPERSCRIPT_ONE ||
    (CodePoint.VULGAR_FRACTION_ONE_QUARTER <= cp &&
      cp <= CodePoint.VULGAR_FRACTION_THREE_QUARTERS)
  ) {
    // unquoted-key-char =/ %xB2 / %xB3 / %xB9 / %xBC-BE       ; superscript digits, fractions
    return true;
  }
  if (
    (CodePoint.LATIN_CAPITAL_LETTER_A_WITH_GRAVE <= cp &&
      cp <= CodePoint.LATIN_CAPITAL_LETTER_O_WITH_DIAERESIS) ||
    (CodePoint.LATIN_CAPITAL_LETTER_O_WITH_STROKE <= cp &&
      cp <= CodePoint.LATIN_SMALL_LETTER_O_WITH_DIAERESIS) ||
    (CodePoint.LATIN_SMALL_LETTER_O_WITH_STROKE <= cp &&
      cp <= CodePoint.GREEK_SMALL_REVERSED_DOTTED_LUNATE_SIGMA_SYMBOL)
  ) {
    // unquoted-key-char =/ %xC0-D6 / %xD8-F6 / %xF8-37D       ; non-symbol chars in Latin block
    return true;
  }
  if (CodePoint.GREEK_CAPITAL_LETTER_YOT <= cp && cp <= CodePoint.CP_1FFF) {
    // unquoted-key-char =/ %x37F-1FFF                         ; exclude GREEK QUESTION MARK, which is basically a semi-colon
    return true;
  }
  if (
    (CodePoint.ZERO_WIDTH_NON_JOINER <= cp &&
      cp <= CodePoint.ZERO_WIDTH_JOINER) ||
    (CodePoint.UNDERTIE <= cp && cp <= CodePoint.CHARACTER_TIE)
  ) {
    // unquoted-key-char =/ %x200C-200D / %x203F-2040          ; from General Punctuation Block, include the two tie symbols and ZWNJ, ZWJ
    return true;
  }
  if (
    (CodePoint.SUPERSCRIPT_ZERO <= cp && cp <= CodePoint.CP_218F) ||
    (CodePoint.CIRCLED_DIGIT_ONE <= cp &&
      cp <= CodePoint.NEGATIVE_CIRCLED_DIGIT_ZERO)
  ) {
    // unquoted-key-char =/ %x2070-218F / %x2460-24FF          ; include super-/subscripts, letterlike/numberlike forms, enclosed alphanumerics
    return true;
  }
  if (
    (CodePoint.GLAGOLITIC_CAPITAL_LETTER_AZU <= cp &&
      cp <= CodePoint.CP_2FEF) ||
    (CodePoint.IDEOGRAPHIC_COMMA <= cp && cp <= CodePoint.CP_D7FF)
  ) {
    // unquoted-key-char =/ %x2C00-2FEF / %x3001-D7FF          ; skip arrows, math, box drawing etc, skip 2FF0-3000 ideographic up/down markers and spaces
    return true;
  }
  if (
    (CodePoint.CJK_COMPATIBILITY_IDEOGRAPH_F900 <= cp &&
      cp <= CodePoint.ARABIC_LIGATURE_SALAAMUHU_ALAYNAA) ||
    (CodePoint.ARABIC_LIGATURE_SALLA_USED_AS_KORANIC_STOP_SIGN_ISOLATED_FORM <=
      cp &&
      cp <= CodePoint.REPLACEMENT_CHARACTER)
  ) {
    // unquoted-key-char =/ %xF900-FDCF / %xFDF0-FFFD          ; skip D800-DFFF surrogate block, E000-F8FF Private Use area, FDD0-FDEF intended for process-internal use (unicode)
    return true;
  }
  if (CodePoint.LINEAR_B_SYLLABLE_B008_A <= cp && cp <= CodePoint.CP_EFFFF) {
    // unquoted-key-char =/ %x10000-EFFFF                      ; all chars outside BMP range, excluding Private Use planes (F0000-10FFFF)
    return true;
  }

  return false;
}

/**
 * Check whether the code point is control character other than tab
 */
function isControlOtherThanTab(cp: number): boolean {
  return (
    (isControl(cp) && cp !== CodePoint.TABULATION) || cp === CodePoint.DELETE
  );
}

/**
 * Check whether the code point is allowed-comment-char for TOML 1.1
 */
function isAllowedCommentCharacter(cp: number): boolean {
  // allowed-comment-char = %x01-09 / %x0E-7F / non-ascii
  return (
    (CodePoint.SOH <= cp && cp <= CodePoint.TABULATION) ||
    (CodePoint.SO <= cp && cp <= CodePoint.DELETE) ||
    isNonAscii(cp)
  );
}

/**
 * Check whether the code point is a non-ascii character.
 */
function isNonAscii(cp: number): boolean {
  //  %x80-D7FF / %xE000-10FFFF
  return (
    (CodePoint.PAD <= cp && cp <= CodePoint.CP_D7FF) ||
    (CodePoint.CP_E000 <= cp && cp <= CodePoint.CP_10FFFF)
  );
}

/**
 * Check whether the given values is valid date
 */
function isValidDate(y: number, m: number, d: number): boolean {
  if (y >= 0 && m <= 12 && m >= 1 && d >= 1) {
    const maxDayOfMonth =
      m === 2
        ? y & 3 || (!(y % 25) && y & 15)
          ? 28
          : 29
        : 30 + ((m + (m >> 3)) & 1);
    return d <= maxDayOfMonth;
  }
  return false;
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

/**
 * Get date from DateTimeData
 */
function getDateFromDateTimeData(data: DateTimeData, timeZone: string): Date {
  const year = padStart(data.year, 4);
  const month = data.month ? padStart(data.month, 2) : "01";
  const day = data.day ? padStart(data.day, 2) : "01";
  const hour = padStart(data.hour, 2);
  const minute = padStart(data.minute, 2);
  const second = padStart(data.second, 2);
  const textDate = `${year}-${month}-${day}`;
  const frac = data.frac ? `.${data.frac}` : "";
  const dateValue = new Date(
    `${textDate}T${hour}:${minute}:${second}${frac}${timeZone}`,
  );
  if (!isNaN(dateValue.getTime()) || data.second !== 60) {
    return dateValue;
  }
  // leap seconds?
  return new Date(`${textDate}T${hour}:${minute}:59${frac}${timeZone}`);
}

/**
 * Pad with zeros.
 */
function padStart(num: number, maxLength: number): string {
  return String(num).padStart(maxLength, "0");
}
