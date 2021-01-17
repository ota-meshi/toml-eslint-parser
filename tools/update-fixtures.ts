import path from "path"
import fs from "fs"

import { parseForESLint } from "../src/parser"
import { getStaticTOMLValue } from "../src/utils"
import type { TOMLProgram } from "../src/ast"

const AST_FIXTURE_ROOT = path.resolve(__dirname, "../tests/fixtures/parser/ast")

/**
 * Remove `parent` properties from the given AST.
 */
function replacer(key: string, value: any) {
    if (key === "parent" || key === "anchors") {
        return undefined
    }
    if (value instanceof RegExp) {
        return String(value)
    }
    if (typeof value === "bigint") {
        return null // Make it null so it can be checked on node8.
        // return `${String(value)}n`
    }
    if (typeof value === "number") {
        if (!isFinite(value)) {
            return `# ${String(value)} #`
        }
    }
    return value
}

/**
 * Replacer for NaN and infinity
 */
function valueReplacer(_key: string, value: any) {
    if (typeof value === "number") {
        if (!isFinite(value)) {
            return `# ${String(value)} #`
        }
    }
    return value
}

/**
 * Parse
 */
function parse(code: string, filePath: string) {
    return parseForESLint(code, { filePath })
}

for (const filename of fs
    .readdirSync(AST_FIXTURE_ROOT)
    .filter((f) => f.endsWith("input.toml"))) {
    console.error(filename)
    const inputFileName = path.join(AST_FIXTURE_ROOT, filename)
    const outputFileName = inputFileName.replace(/input\.toml$/u, "output.json")
    const valueFileName = inputFileName.replace(/input\.toml$/u, "value.json")

    const input = fs.readFileSync(inputFileName, "utf8")
    let ast: TOMLProgram | null = null
    try {
        ast = parse(input, filename).ast
        const astJson = JSON.stringify(ast, replacer, 2)
        fs.writeFileSync(outputFileName, astJson, "utf8")
    } catch (e) {
        fs.writeFileSync(
            outputFileName,
            JSON.stringify(
                `${e.message}@line:${e.lineNumber},column:${e.column}`,
            ),
            "utf8",
        )
    }
    if (ast)
        fs.writeFileSync(
            valueFileName,
            JSON.stringify(getStaticTOMLValue(ast), valueReplacer, 2),
            "utf8",
        )
}
