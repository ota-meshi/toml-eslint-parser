export const EOF = -1;
export const NULL = 0x00;
export const BACKSPACE = 0x08;
export const TABULATION = 0x09;
export const LINE_FEED = 0x0a;
export const FORM_FEED = 0x0c;
export const CARRIAGE_RETURN = 0x0d;
export const ESCAPE = 0x1b;
export const US = 0x1f;
export const SPACE = 0x20;
export const QUOTATION_MARK = 0x22;
export const HASH = 0x23;
export const SINGLE_QUOTE = 0x27;
export const PLUS_SIGN = 0x2b;
export const COMMA = 0x2c;
export const DASH = 0x2d;
export const DOT = 0x2e;
export const DIGIT_0 = 0x30;
export const DIGIT_1 = 0x31;
export const DIGIT_2 = 0x32;
export const DIGIT_3 = 0x33;
export const DIGIT_7 = 0x37;
export const DIGIT_9 = 0x39;
export const COLON = 0x3a;
export const EQUALS_SIGN = 0x3d;
export const LATIN_CAPITAL_A = 0x41;
export const LATIN_CAPITAL_E = 0x45;
export const LATIN_CAPITAL_F = 0x46;
export const LATIN_CAPITAL_T = 0x54;
export const LATIN_CAPITAL_U = 0x55;
export const LATIN_CAPITAL_Z = 0x5a;
export const LEFT_BRACKET = 0x5b; // [
export const BACKSLASH = 0x5c;
export const RIGHT_BRACKET = 0x5d; // ]
export const UNDERSCORE = 0x5f;
export const LATIN_SMALL_A = 0x61;
export const LATIN_SMALL_B = 0x62;
export const LATIN_SMALL_E = 0x65;
export const LATIN_SMALL_F = 0x66;
export const LATIN_SMALL_I = 0x69;
export const LATIN_SMALL_L = 0x6c;
export const LATIN_SMALL_N = 0x6e;
export const LATIN_SMALL_O = 0x6f;
export const LATIN_SMALL_R = 0x72;
export const LATIN_SMALL_S = 0x73;
export const LATIN_SMALL_T = 0x74;
export const LATIN_SMALL_U = 0x75;
export const LATIN_SMALL_X = 0x78;
export const LATIN_SMALL_Z = 0x7a;
export const LEFT_BRACE = 0x7b; // {
export const RIGHT_BRACE = 0x7d; // }

export const DELETE = 0x7f;

/**
 * Check whether the code point is a control character.
 */
export function isControl(cp: number): boolean {
  return cp >= NULL && cp <= US;
}

/**
 * Check whether the code point is a whitespace.
 */
export function isWhitespace(cp: number): boolean {
  return cp === TABULATION || cp === SPACE;
}

/**
 * Check whether the code point is a end of line.
 */
export function isEOL(cp: number): boolean {
  return cp === LINE_FEED || cp === CARRIAGE_RETURN;
}

/**
 * Check whether the code point is an uppercase letter character.
 */
function isUpperLetter(cp: number): boolean {
  return cp >= LATIN_CAPITAL_A && cp <= LATIN_CAPITAL_Z;
}

/**
 * Check whether the code point is a lowercase letter character.
 */
function isLowerLetter(cp: number): boolean {
  return cp >= LATIN_SMALL_A && cp <= LATIN_SMALL_Z;
}

/**
 * Check whether the code point is a letter character.
 */
export function isLetter(cp: number): boolean {
  return isLowerLetter(cp) || isUpperLetter(cp);
}

/**
 * Check whether the code point is a digit character.
 */
export function isDigit(cp: number): boolean {
  return cp >= DIGIT_0 && cp <= DIGIT_9;
}

/**
 * Check whether the code point is a hex digit character.
 */
export function isHexDig(cp: number): boolean {
  return (
    isDigit(cp) ||
    (cp >= LATIN_SMALL_A && cp <= LATIN_SMALL_F) ||
    (cp >= LATIN_CAPITAL_A && cp <= LATIN_CAPITAL_F)
  );
}
/**
 * Check whether the code point is a octal digit character.
 */
export function isOctalDig(cp: number): boolean {
  return cp >= DIGIT_0 && cp <= DIGIT_7;
}

/**
 * Check whether the code point is a high-surrogate code point.
 */
export function isHighSurrogate(cp: number): boolean {
  return cp >= 0xd800 && cp <= 0xdfff;
}

/**
 * Check whether the code point is a low-surrogate code point.
 */
export function isLowSurrogate(cp: number): boolean {
  return cp >= 0xdc00 && cp <= 0xdfff;
}

/**
 * Check whether the code point is valid code point.
 *
 * see
 * - https://unicode.org/glossary/#unicode_scalar_value
 * - https://toml.io/en/v1.0.0#string
 */
export function isUnicodeScalarValue(cp: number): boolean {
  return (cp >= 0 && cp <= 0xd7ff) || (cp >= 0xe000 && cp <= 0x10ffff);
}
