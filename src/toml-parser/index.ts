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
    TOMLBooleanValue,
    TOMLNumberValue,
    TOMLKey,
    TOMLKeyValue,
    TOMLNode,
    TOMLProgram,
    TOMLStringKey,
    TOMLStringValue,
    TOMLTopLevelTable,
    TOMLTable,
    TOMLDateTimeValue,
    TOMLArray,
    TOMLInlineTable,
} from "../ast"
import { iterateDuplicateKeyNodes } from "../checker/dupe-keys"
import type { ErrorCode } from "../errors"
import { last } from "../internal-utils"
import type { ParserOptions } from "../parser-options"
import type { ParserState, ValueContainer } from "./context"
import { Context } from "./context"

const STATE_FOR_ERROR: Record<string, ErrorCode> = {
    VALUE: "missing-value",
}

export class TOMLParser {
    private readonly text: string

    private readonly parserOptions: ParserOptions

    /**
     * Initialize this parser.
     */
    public constructor(text: string, parserOptions?: ParserOptions) {
        this.text = text
        this.parserOptions = parserOptions || {}
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
        }
        const node: TOMLTopLevelTable = {
            type: "TOMLTopLevelTable",
            body: [],
            parent: ast,
            range: clone(ast.range),
            loc: clone(ast.loc),
        }
        ast.body = [node]
        const ctx = new Context({
            text: this.text,
            parserOptions: this.parserOptions,
            topLevelTable: node,
        })
        let token = ctx.nextToken()
        if (token) {
            node.range[0] = token.range[0]
            node.loc.start = clone(token.loc.start)

            while (token) {
                const state = ctx.stateStack.pop() || "TABLE"
                ctx.stateStack.push(...this[state](token, ctx))
                token = ctx.nextToken()
            }
            const state = ctx.stateStack.pop() || "TABLE"
            if (state in STATE_FOR_ERROR) {
                return ctx.reportParseError(STATE_FOR_ERROR[state], null)
            }
            if (ctx.table.type === "TOMLTable") {
                applyEndLoc(ctx.table, ctx.table.body)
            }
            applyEndLoc(node, node.body)
        }

        for (const dupeNode of iterateDuplicateKeyNodes(node)) {
            ctx.reportParseError("dupe-keys", dupeNode.node)
        }

        ast.tokens = ctx.tokens
        ast.comments = ctx.comments
        const endPos = ctx.endPos
        ast.range[1] = endPos.offset
        ast.loc.end = {
            line: endPos.line,
            column: endPos.column,
        }

        return ast
    }

    private TABLE(token: Token, ctx: Context): ParserState[] {
        if (isBare(token) || isString(token)) {
            return this.processKeyValue(token, ctx.table, ctx)
        }
        if (isLeftBracket(token)) {
            return this.processTable(token, ctx.topLevelTable, ctx)
        }
        return ctx.reportParseError("unexpected-token", token)
    }

    private VALUE(token: Token, ctx: Context): ParserState[] {
        if (
            isString(token) ||
            isMultiLineString(token) ||
            isNumber(token) ||
            isBoolean(token) ||
            isDateTime(token)
        ) {
            return this.processSimpleValue(token, ctx)
        }
        if (isLeftBracket(token)) {
            return this.processArray(token, ctx)
        }
        if (isLeftBrace(token)) {
            return this.processInlineTable(token, ctx)
        }

        return ctx.reportParseError("unexpected-token", token)
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
            body: [],
            parent: topLevelTableNode,
            range: clone(token.range),
            loc: clone(token.loc),
        }
        if (ctx.table.type === "TOMLTable") {
            applyEndLoc(ctx.table, ctx.table.body)
        }
        topLevelTableNode.body.push(tableNode)
        ctx.table = tableNode
        let targetToken = ctx.nextToken({
            needSameLine: "invalid-key-value-newline",
        })
        if (isLeftBracket(targetToken)) {
            if (token.range[1] < targetToken.range[0]) {
                return ctx.reportParseError("invalid-space", targetToken)
            }
            tableNode.kind = "array"
            targetToken = ctx.nextToken({
                needSameLine: "invalid-key-value-newline",
            })
        }
        if (isRightBracket(targetToken)) {
            return ctx.reportParseError("missing-key", targetToken)
        }
        if (!targetToken) {
            return ctx.reportParseError("unterminated-table-key", null)
        }
        const keyNodeData = this.processKeyNode(targetToken, tableNode, ctx)
        targetToken = keyNodeData.nextToken
        if (!isRightBracket(targetToken)) {
            return ctx.reportParseError("unterminated-table-key", targetToken)
        }
        if (tableNode.kind === "array") {
            const rightBracket = targetToken
            targetToken = ctx.nextToken({
                needSameLine: "invalid-key-value-newline",
            })
            if (!isRightBracket(targetToken)) {
                return ctx.reportParseError(
                    "unterminated-table-key",
                    targetToken,
                )
            }
            if (rightBracket.range[1] < targetToken.range[0]) {
                return ctx.reportParseError("invalid-space", targetToken)
            }
        }
        applyEndLoc(tableNode, targetToken)
        ctx.needNewLine = true
        return []
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
            range: clone(token.range),
            loc: clone(token.loc),
        }
        tableNode.body.push(keyValueNode)
        const { nextToken: targetToken } = this.processKeyNode(
            token,
            keyValueNode,
            ctx,
        )
        if (!isEq(targetToken)) {
            return ctx.reportParseError("missing-equals-sign", targetToken)
        }
        ctx.addValueContainer({
            parent: keyValueNode,
            set: (valNode): ParserState[] => {
                keyValueNode.value = valNode
                applyEndLoc(keyValueNode, valNode)
                ctx.needNewLine = true
                return []
            },
        })
        ctx.needSameLine = "invalid-key-value-newline"
        return ["VALUE"]
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
            range: clone(token.range),
            loc: clone(token.loc),
        }
        parent.key = keyNode
        let targetToken: Token | null = token
        while (targetToken && (isBare(targetToken) || isString(targetToken))) {
            this.processKey(targetToken, keyNode)
            targetToken = ctx.nextToken({
                needSameLine: "invalid-key-value-newline",
            })
            if (isDot(targetToken)) {
                targetToken = ctx.nextToken({
                    needSameLine: "invalid-key-value-newline",
                })
            } else {
                break
            }
        }
        applyEndLoc(keyNode, keyNode.keys)
        return { keyNode, nextToken: targetToken }
    }

    private processKey(token: BareToken | StringToken, keyNode: TOMLKey): void {
        if (isBare(token)) {
            const node: TOMLBare = {
                type: "TOMLBare",
                name: token.value,
                parent: keyNode,
                range: clone(token.range),
                loc: clone(token.loc),
            }
            keyNode.keys.push(node)
        } else if (isString(token)) {
            const node: TOMLStringKey = {
                type: "TOMLValue",
                kind: "string",
                value: token.string,
                style: token.type === "BasicString" ? "basic" : "literal",
                multiline: false,
                parent: keyNode,
                range: clone(token.range),
                loc: clone(token.loc),
            }
            keyNode.keys.push(node)
        }
    }

    private processSimpleValue(
        token:
            | StringToken
            | MultiLineStringToken
            | NumberToken
            | BooleanToken
            | DateTimeToken,
        ctx: Context,
    ): ParserState[] {
        const valueContainer = ctx.consumeValueContainer()
        if (isString(token) || isMultiLineString(token)) {
            const node: TOMLStringValue = {
                type: "TOMLValue",
                kind: "string",
                value: token.string,
                style:
                    token.type === "BasicString" ||
                    token.type === "MultiLineBasicString"
                        ? "basic"
                        : "literal",
                multiline: isMultiLineString(token),
                parent: valueContainer.parent,
                range: clone(token.range),
                loc: clone(token.loc),
            }
            return valueContainer.set(node)
        }
        if (isNumber(token)) {
            const node: TOMLNumberValue = {
                type: "TOMLValue",
                kind: token.type === "Integer" ? "integer" : "float",
                value: token.number,
                parent: valueContainer.parent,
                range: clone(token.range),
                loc: clone(token.loc),
            }
            return valueContainer.set(node)
        }
        if (isBoolean(token)) {
            const node: TOMLBooleanValue = {
                type: "TOMLValue",
                kind: "boolean",
                value: token.boolean,
                parent: valueContainer.parent,
                range: clone(token.range),
                loc: clone(token.loc),
            }
            return valueContainer.set(node)
        }
        if (isDateTime(token)) {
            let textDate =
                token.type !== "LocalTime"
                    ? token.value
                    : `0000-01-01T${token.value}Z`
            let dateValue = new Date(textDate)
            if (isNaN(dateValue.getTime())) {
                // leap seconds?
                textDate = textDate.replace(/(\d\d:\d\d):60/u, "$1:59")
                dateValue = new Date(textDate)
            }
            const node: TOMLDateTimeValue = {
                type: "TOMLValue",
                kind:
                    token.type === "OffsetDateTime"
                        ? "offset-date-time"
                        : token.type === "LocalDateTime"
                        ? "local-date-time"
                        : token.type === "LocalDate"
                        ? "local-date"
                        : "local-time",
                value: dateValue,
                datetime: token.value,
                parent: valueContainer.parent,
                range: clone(token.range),
                loc: clone(token.loc),
            }
            return valueContainer.set(node)
        }

        throw new Error("Illegal argument token")
    }

    private processArray(token: PunctuatorToken, ctx: Context): ParserState[] {
        const valueContainer = ctx.consumeValueContainer()
        const node: TOMLArray = {
            type: "TOMLArray",
            elements: [],
            parent: valueContainer.parent,
            range: clone(token.range),
            loc: clone(token.loc),
        }
        const nextToken = ctx.nextToken({ valuesEnabled: true })
        if (isRightBracket(nextToken)) {
            applyEndLoc(node, nextToken)
            return valueContainer.set(node)
        }
        // Back token
        ctx.backToken()
        return this.processArrayValue(node, valueContainer, ctx)
    }

    private processArrayValue(
        node: TOMLArray,
        valueContainer: ValueContainer,
        ctx: Context,
    ): ParserState[] {
        ctx.addValueContainer({
            parent: node,
            set: (valNode) => {
                node.elements.push(valNode)

                let nextToken = ctx.nextToken({ valuesEnabled: true })
                const hasComma = isComma(nextToken)
                if (hasComma) {
                    nextToken = ctx.nextToken({ valuesEnabled: true })
                }
                if (isRightBracket(nextToken)) {
                    applyEndLoc(node, nextToken)
                    return valueContainer.set(node)
                }
                if (hasComma) {
                    // Back token
                    ctx.backToken()

                    // setup next value container
                    return this.processArrayValue(node, valueContainer, ctx)
                }
                return ctx.reportParseError(
                    nextToken ? "missing-comma" : "unterminated-array",
                    nextToken,
                )
            },
        })

        return ["VALUE"]
    }

    private processInlineTable(
        token: PunctuatorToken,
        ctx: Context,
    ): ParserState[] {
        const valueContainer = ctx.consumeValueContainer()
        const node: TOMLInlineTable = {
            type: "TOMLInlineTable",
            body: [],
            parent: valueContainer.parent,
            range: clone(token.range),
            loc: clone(token.loc),
        }

        const nextToken = ctx.nextToken({
            needSameLine: "invalid-inline-table-newline",
        })

        if (nextToken) {
            if (isBare(nextToken) || isString(nextToken)) {
                return this.processInlineTableKeyValue(
                    nextToken,
                    node,
                    valueContainer,
                    ctx,
                )
            }
            if (isRightBrace(nextToken)) {
                applyEndLoc(node, nextToken)
                return valueContainer.set(node)
            }
        }
        return ctx.reportParseError("unexpected-token", nextToken)
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
            range: clone(token.range),
            loc: clone(token.loc),
        }
        inlineTableNode.body.push(keyValueNode)
        const { nextToken: targetToken } = this.processKeyNode(
            token,
            keyValueNode,
            ctx,
        )
        if (!isEq(targetToken)) {
            return ctx.reportParseError("missing-equals-sign", targetToken)
        }
        ctx.addValueContainer({
            parent: keyValueNode,
            set: (valNode) => {
                keyValueNode.value = valNode
                applyEndLoc(keyValueNode, valNode)

                let nextToken = ctx.nextToken({
                    needSameLine: "invalid-inline-table-newline",
                })
                if (isComma(nextToken)) {
                    nextToken = ctx.nextToken({
                        needSameLine: "invalid-inline-table-newline",
                    })
                    if (
                        nextToken &&
                        (isBare(nextToken) || isString(nextToken))
                    ) {
                        // setup next value container
                        return this.processInlineTableKeyValue(
                            nextToken,
                            inlineTableNode,
                            valueContainer,
                            ctx,
                        )
                    }
                    return ctx.reportParseError(
                        isRightBrace(nextToken)
                            ? "invalid-trailing-comma-in-inline-table"
                            : nextToken
                            ? "unexpected-token"
                            : "unterminated-inline-table",
                        nextToken,
                    )
                }
                if (isRightBrace(nextToken)) {
                    applyEndLoc(inlineTableNode, nextToken)
                    return valueContainer.set(inlineTableNode)
                }
                return ctx.reportParseError(
                    nextToken ? "missing-comma" : "unterminated-inline-table",
                    nextToken,
                )
            },
        })
        ctx.needSameLine = "invalid-key-value-newline"
        return ["VALUE"]
    }
}

/**
 * Check whether the given token is a dot.
 */
function isDot(token: Token | null): token is PunctuatorToken {
    return isPunctuator(token) && token.value === "."
}

/**
 * Check whether the given token is an equal sign.
 */
function isEq(token: Token | null): token is PunctuatorToken {
    return isPunctuator(token) && token.value === "="
}

/**
 * Check whether the given token is a left bracket.
 */
function isLeftBracket(token: Token | null): token is PunctuatorToken {
    return isPunctuator(token) && token.value === "["
}

/**
 * Check whether the given token is a right bracket.
 */
function isRightBracket(token: Token | null): token is PunctuatorToken {
    return isPunctuator(token) && token.value === "]"
}

/**
 * Check whether the given token is a left brace.
 */
function isLeftBrace(token: Token | null): token is PunctuatorToken {
    return isPunctuator(token) && token.value === "{"
}

/**
 * Check whether the given token is a right brace.
 */
function isRightBrace(token: Token | null): token is PunctuatorToken {
    return isPunctuator(token) && token.value === "}"
}

/**
 * Check whether the given token is a comma.
 */
function isComma(token: Token | null): token is PunctuatorToken {
    return isPunctuator(token) && token.value === ","
}

/**
 * Check whether the given token is a punctuator.
 */
function isPunctuator(token: Token | null): token is PunctuatorToken {
    return Boolean(token && token.type === "Punctuator")
}

/**
 * Check whether the given token is a bare token.
 */
function isBare(token: Token): token is BareToken {
    return token.type === "Bare"
}

/**
 * Check whether the given token is a string.
 */
function isString(token: Token): token is StringToken {
    return token.type === "BasicString" || token.type === "LiteralString"
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
    )
}

/**
 * Check whether the given token is a number.
 */
function isNumber(token: Token): token is NumberToken {
    return token.type === "Integer" || token.type === "Float"
}

/**
 * Check whether the given token is a boolean.
 */
function isBoolean(token: Token): token is BooleanToken {
    return token.type === "Boolean"
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
    )
}

/**
 * Apply end locations
 */
function applyEndLoc(node: TOMLNode, child: TOMLNode | TOMLNode[] | Token) {
    const lastNode = Array.isArray(child) ? last(child) : child
    if (lastNode) {
        node.range[1] = lastNode.range[1]
        node.loc.end = clone(lastNode.loc.end)
    }
}

/**
 * clone the location.
 */
function clone<T>(loc: T): T {
    if (typeof loc !== "object") {
        return loc
    }
    if (Array.isArray(loc)) {
        return (loc as any).map(clone)
    }
    const n: any = {}
    for (const key in loc) {
        n[key] = clone(loc[key])
    }
    return n
}
