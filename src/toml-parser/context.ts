import { ParseError } from "../errors"
import type { ErrorCode } from "../errors"
import { Tokenizer } from "../tokenizer"
import type {
    Comment,
    Token,
    TOMLArray,
    TOMLContentNode,
    TOMLKeyValue,
    TOMLNode,
    TOMLTable,
    TOMLTopLevelTable,
} from "../ast"
import type { ParserOptions } from "../parser-options"
import { KeysResolver } from "./keys-resolver"

export type ValueContainer = {
    parent: TOMLKeyValue | TOMLArray
    set(valueNode: TOMLContentNode): ParserState[]
}

export type ParserState = "TABLE" | "VALUE"
export class Context {
    private readonly tokenizer: Tokenizer

    public readonly tokens: Token[] = []

    public readonly comments: Comment[] = []

    private back: Token | null = null

    public stateStack: ParserState[] = []

    public needNewLine = false

    public needSameLine: false | ErrorCode = false

    private currToken: Token | null = null

    private prevToken: Token | null = null

    public topLevelTable: TOMLTopLevelTable

    public table: TOMLTopLevelTable | TOMLTable

    private readonly keysResolver: KeysResolver

    private readonly valueContainerStack: ValueContainer[] = []

    public constructor(data: {
        text: string
        parserOptions?: ParserOptions
        topLevelTable: TOMLTopLevelTable
    }) {
        this.tokenizer = new Tokenizer(data.text, data.parserOptions)
        this.topLevelTable = data.topLevelTable
        this.table = data.topLevelTable
        this.keysResolver = new KeysResolver(this)
    }

    public get startPos(): {
        offset: number
        line: number
        column: number
    } {
        return this.tokenizer.positions.start
    }

    public get endPos(): {
        offset: number
        line: number
        column: number
    } {
        return this.tokenizer.positions.end
    }

    /**
     * Get the next token.
     */
    public nextToken(option?: {
        needSameLine?: ErrorCode
        valuesEnabled?: boolean
    }): Token | null {
        this.prevToken = this.currToken

        if (this.back) {
            this.currToken = this.back
            this.back = null
        } else {
            this.currToken = this._nextTokenFromTokenizer(option)
        }
        if (
            (this.needNewLine || this.needSameLine || option?.needSameLine) &&
            this.prevToken &&
            this.currToken
        ) {
            if (this.prevToken.loc.end.line === this.currToken.loc.start.line) {
                if (this.needNewLine) {
                    return this.reportParseError(
                        "missing-newline",
                        this.currToken,
                    )
                }
            } else {
                const needSameLine = this.needSameLine || option?.needSameLine
                if (needSameLine) {
                    return this.reportParseError(needSameLine, this.currToken)
                }
            }
        }
        this.needNewLine = false
        this.needSameLine = false
        return this.currToken
    }

    private _nextTokenFromTokenizer(option?: { valuesEnabled?: boolean }) {
        const valuesEnabled = this.tokenizer.valuesEnabled
        if (option?.valuesEnabled) {
            this.tokenizer.valuesEnabled = option.valuesEnabled
        }
        let token = this.tokenizer.nextToken()
        while (token && token.type === "Block") {
            this.comments.push(token)
            token = this.tokenizer.nextToken()
        }
        if (token) {
            this.tokens.push(token)
        }
        this.tokenizer.valuesEnabled = valuesEnabled
        return token
    }

    public backToken(): void {
        if (this.back) {
            throw new Error("Illegal state")
        }
        this.back = this.currToken
        this.currToken = this.prevToken
    }

    public addValueContainer(valueContainer: ValueContainer): void {
        this.valueContainerStack.push(valueContainer)
        this.tokenizer.valuesEnabled = true
    }

    public consumeValueContainer(): ValueContainer {
        const valueContainer = this.valueContainerStack.pop()!
        this.tokenizer.valuesEnabled = this.valueContainerStack.length > 0
        return valueContainer
    }

    public applyResolveKeyForTable(node: TOMLTable): void {
        this.keysResolver.applyResolveKeyForTable(node)
    }

    public verifyDuplicateKeys(): void {
        this.keysResolver.verifyDuplicateKeys(this.topLevelTable)
    }

    /**
     * Report an invalid token error.
     */
    public reportParseError(
        code: ErrorCode,
        token: Token | TOMLNode | null,
    ): any {
        let offset: number, line: number, column: number
        if (token) {
            offset = token.range[0]
            line = token.loc.start.line
            column = token.loc.start.column
        } else {
            const startPos = this.startPos
            offset = startPos.offset
            line = startPos.line
            column = startPos.column
        }
        throw new ParseError(code, offset, line, column)
    }
}
