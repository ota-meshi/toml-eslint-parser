const MESSAGES = {
    "unterminated-string": "Unterminated string constant",
    "unterminated-table-key": "Unterminated table-key",
    "unterminated-array": "Unterminated array",
    "unterminated-inline-table": "Unterminated inline table",
    "missing-key": "Empty bare keys are not allowed",
    "missing-newline": "Must be a newline",
    "missing-equals-sign": "Expected equal (=) token",
    "missing-value": "Unspecified values are invalid",
    "missing-comma": "Expected comma (,) token",
    "dupe-keys": "Defining a key multiple times is invalid",
    "unexpected-char": "Unexpected character",
    "unexpected-token": "Unexpected token",
    "invalid-control-character":
        "Control characters (codes < 0x1f and 0x7f) are not allowed",
    "invalid-key-value-newline":
        "The key, equals sign, and value must be on the same line",
    "invalid-inline-table-newline":
        "No newlines are allowed between the curly braces unless they are valid within a value.",
    "invalid-underscore": "Underscores are allowed between digits",
    "invalid-space": "Unexpected spaces",
    "invalid-three-quotes": "Three or more quotes are not permitted",
    "invalid-date": "Unexpected invalid date",
    "invalid-time": "Unexpected invalid time",
    "invalid-leading-zero": "Leading zeros are not allowed",
    "invalid-trailing-comma-in-inline-table":
        "Trailing comma is not permitted in an inline table.",
    "invalid-char-in-escape-sequence": "Invalid character in unicode sequence.",
}
/**
 * TOML parse errors.
 */
export class ParseError extends SyntaxError {
    public index: number

    public lineNumber: number

    public column: number

    /**
     * Initialize this ParseError instance.
     * @param code The error message code.
     * @param offset The offset number of this error.
     * @param line The line number of this error.
     * @param column The column number of this error.
     */
    public constructor(
        code: ErrorCode,
        offset: number,
        line: number,
        column: number,
    ) {
        super(MESSAGES[code])
        this.index = offset
        this.lineNumber = line
        this.column = column
    }
}

export type ErrorCode = keyof typeof MESSAGES
