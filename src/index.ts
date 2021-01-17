import { parseForESLint } from "./parser"
import type * as AST from "./ast"
import { traverseNodes } from "./traverse"
import { getStaticTOMLValue } from "./utils"
import { KEYS } from "./visitor-keys"
import { ParseError } from "./errors"

export { AST, ParseError }

// parser
export { parseForESLint }
// Keys
// eslint-disable-next-line @typescript-eslint/naming-convention -- ignore
export const VisitorKeys = KEYS

// tools
export { traverseNodes, getStaticTOMLValue }

/**
 * Parse TOML source code
 */
export function parseTOML(code: string, options?: any): AST.TOMLProgram {
    return parseForESLint(code, options).ast
}
