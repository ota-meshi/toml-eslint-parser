import type { HasLocs } from "./loc"

export interface Comment extends HasLocs {
    type: "Block"
    value: string
}
export type TokenType =
    | "Punctuator"
    | "Bare"
    | "BasicString"
    | "MultiLineBasicString"
    | "LiteralString"
    | "MultiLineLiteralString"
    | "Integer"
    | "Float"
    | "Boolean"
    | "OffsetDateTime"
    | "LocalDateTime"
    | "LocalDate"
    | "LocalTime"

interface BaseTOMLToken extends HasLocs {
    type: TokenType
    value: string
}

export type Token =
    | PunctuatorToken
    | BareToken
    | StringToken
    | MultiLineStringToken
    | NumberToken
    | BooleanToken
    | DateTimeToken

export interface PunctuatorToken extends BaseTOMLToken {
    type: "Punctuator"
    value: string
}
export interface BareToken extends BaseTOMLToken {
    type: "Bare"
    value: string
}
export interface StringToken extends BaseTOMLToken {
    type: "BasicString" | "LiteralString"
    value: string
    string: string
}
export interface MultiLineStringToken extends BaseTOMLToken {
    type: "MultiLineBasicString" | "MultiLineLiteralString"
    value: string
    string: string
}
export interface NumberToken extends BaseTOMLToken {
    type: "Integer" | "Float"
    value: string
    number: number
}
export interface FloatToken extends BaseTOMLToken {
    type: "Float"
    value: string
    number: number
}
export interface BooleanToken extends BaseTOMLToken {
    type: "Boolean"
    value: string
    boolean: boolean
}
export interface DateTimeToken extends BaseTOMLToken {
    type: "OffsetDateTime" | "LocalDateTime" | "LocalDate" | "LocalTime"
    value: string
}
