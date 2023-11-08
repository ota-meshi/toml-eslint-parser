export const enum CodePoint {
  EOF = -1,
  NULL = 0x00,
  SOH = 0x01,
  BACKSPACE = 0x08,
  TABULATION = 0x09,
  LINE_FEED = 0x0a,
  FORM_FEED = 0x0c,
  CARRIAGE_RETURN = 0x0d,
  ESCAPE = 0x1b,
  SO = 0x0e,
  US = 0x1f,
  SPACE = 0x20,
  QUOTATION_MARK = 0x22,
  HASH = 0x23,
  SINGLE_QUOTE = 0x27,
  PLUS_SIGN = 0x2b,
  COMMA = 0x2c,
  DASH = 0x2d,
  DOT = 0x2e,
  DIGIT_0 = 0x30,
  DIGIT_1 = 0x31,
  DIGIT_2 = 0x32,
  DIGIT_3 = 0x33,
  DIGIT_7 = 0x37,
  DIGIT_9 = 0x39,
  COLON = 0x3a,
  EQUALS_SIGN = 0x3d,
  LATIN_CAPITAL_A = 0x41,
  LATIN_CAPITAL_E = 0x45,
  LATIN_CAPITAL_F = 0x46,
  LATIN_CAPITAL_T = 0x54,
  LATIN_CAPITAL_U = 0x55,
  LATIN_CAPITAL_Z = 0x5a,
  LEFT_BRACKET = 0x5b, // [
  BACKSLASH = 0x5c,
  RIGHT_BRACKET = 0x5d, // ]
  UNDERSCORE = 0x5f,
  LATIN_SMALL_A = 0x61,
  LATIN_SMALL_B = 0x62,
  LATIN_SMALL_E = 0x65,
  LATIN_SMALL_F = 0x66,
  LATIN_SMALL_I = 0x69,
  LATIN_SMALL_L = 0x6c,
  LATIN_SMALL_N = 0x6e,
  LATIN_SMALL_O = 0x6f,
  LATIN_SMALL_R = 0x72,
  LATIN_SMALL_S = 0x73,
  LATIN_SMALL_T = 0x74,
  LATIN_SMALL_U = 0x75,
  LATIN_SMALL_X = 0x78,
  LATIN_SMALL_Z = 0x7a,
  LEFT_BRACE = 0x7b, // {
  RIGHT_BRACE = 0x7d, // }
  DELETE = 0x7f,
  PAD = 0x80,
  SUPERSCRIPT_TWO = 0xb2,
  SUPERSCRIPT_THREE = 0xb3,
  SUPERSCRIPT_ONE = 0xb9,
  VULGAR_FRACTION_ONE_QUARTER = 0xbc,
  VULGAR_FRACTION_THREE_QUARTERS = 0xbe,
  LATIN_CAPITAL_LETTER_A_WITH_GRAVE = 0xc0,
  LATIN_CAPITAL_LETTER_O_WITH_DIAERESIS = 0xd6,
  LATIN_CAPITAL_LETTER_O_WITH_STROKE = 0xd8,
  LATIN_SMALL_LETTER_O_WITH_DIAERESIS = 0xf6,
  LATIN_SMALL_LETTER_O_WITH_STROKE = 0xf8,
  GREEK_SMALL_REVERSED_DOTTED_LUNATE_SIGMA_SYMBOL = 0x37b,
  GREEK_CAPITAL_LETTER_YOT = 0x37f,
  CP_1FFF = 0x1fff,
  ZERO_WIDTH_NON_JOINER = 0x200c,
  ZERO_WIDTH_JOINER = 0x200d,
  UNDERTIE = 0x203f,
  CHARACTER_TIE = 0x2040,
  SUPERSCRIPT_ZERO = 0x2070,
  CP_218F = 0x218f,
  CIRCLED_DIGIT_ONE = 0x2460,
  NEGATIVE_CIRCLED_DIGIT_ZERO = 0x24ff,
  GLAGOLITIC_CAPITAL_LETTER_AZU = 0x2c00,
  CP_2FEF = 0x2fef,
  IDEOGRAPHIC_COMMA = 0x3001,
  CP_D7FF = 0xd7ff,
  CP_E000 = 0xe000,
  CJK_COMPATIBILITY_IDEOGRAPH_F900 = 0xf900,
  ARABIC_LIGATURE_SALAAMUHU_ALAYNAA = 0xfdcf,
  ARABIC_LIGATURE_SALLA_USED_AS_KORANIC_STOP_SIGN_ISOLATED_FORM = 0xfdf0,
  REPLACEMENT_CHARACTER = 0xfffd,
  LINEAR_B_SYLLABLE_B008_A = 0x10000,
  CP_EFFFF = 0xeffff,
  CP_10FFFF = 0x10ffff,
}

/**
 * Check whether the code point is a control character.
 */
export function isControl(cp: number): boolean {
  return cp >= CodePoint.NULL && cp <= CodePoint.US;
}

/**
 * Check whether the code point is a whitespace.
 */
export function isWhitespace(cp: number): boolean {
  return cp === CodePoint.TABULATION || cp === CodePoint.SPACE;
}

/**
 * Check whether the code point is a end of line.
 */
export function isEOL(cp: number): boolean {
  return cp === CodePoint.LINE_FEED || cp === CodePoint.CARRIAGE_RETURN;
}

/**
 * Check whether the code point is an uppercase letter character.
 */
function isUpperLetter(cp: number): boolean {
  return cp >= CodePoint.LATIN_CAPITAL_A && cp <= CodePoint.LATIN_CAPITAL_Z;
}

/**
 * Check whether the code point is a lowercase letter character.
 */
function isLowerLetter(cp: number): boolean {
  return cp >= CodePoint.LATIN_SMALL_A && cp <= CodePoint.LATIN_SMALL_Z;
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
  return cp >= CodePoint.DIGIT_0 && cp <= CodePoint.DIGIT_9;
}

/**
 * Check whether the code point is a hex digit character.
 */
export function isHexDig(cp: number): boolean {
  return (
    isDigit(cp) ||
    (cp >= CodePoint.LATIN_SMALL_A && cp <= CodePoint.LATIN_SMALL_F) ||
    (cp >= CodePoint.LATIN_CAPITAL_A && cp <= CodePoint.LATIN_CAPITAL_F)
  );
}
/**
 * Check whether the code point is a octal digit character.
 */
export function isOctalDig(cp: number): boolean {
  return cp >= CodePoint.DIGIT_0 && cp <= CodePoint.DIGIT_7;
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
