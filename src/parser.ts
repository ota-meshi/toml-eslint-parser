import { TOMLParser } from "./toml-parser"
import type { SourceCode } from "eslint"
import { KEYS } from "./visitor-keys"
import type { TOMLProgram } from "./ast"
import type { ParserOptions } from "./parser-options"
/**
 * Parse source code
 */
export function parseForESLint(
    code: string,
    options?: ParserOptions,
): {
    ast: TOMLProgram
    visitorKeys: SourceCode.VisitorKeys
    services: { isTOML: boolean }
} {
    const parser = new TOMLParser(code, options)
    const ast = parser.parse()

    return {
        ast,
        visitorKeys: KEYS,
        services: {
            isTOML: true,
        },
    }
}
