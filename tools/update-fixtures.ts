import fs from "fs"

import { parseForESLint } from "../src/parser"
import { getStaticTOMLValue } from "../src/utils"
import type { TOMLProgram } from "../src/ast"
import { listUpFixtures, stringify } from "../tests/src/parser/utils"

/**
 * Parse
 */
function parse(code: string, filePath: string) {
    return parseForESLint(code, { filePath })
}

for (const {
    filename,
    inputFileName,
    outputFileName,
    valueFileName,
} of listUpFixtures()) {
    // eslint-disable-next-line no-console -- tool
    console.error(filename)

    const input = fs.readFileSync(inputFileName, "utf8")
    let ast: TOMLProgram | null = null
    try {
        ast = parse(input, filename).ast
        const astJson = stringify(ast, true)
        fs.writeFileSync(outputFileName, astJson, "utf8")
    } catch (e) {
        fs.writeFileSync(
            outputFileName,
            stringify(`${e.message}@line:${e.lineNumber},column:${e.column}`),
            "utf8",
        )
    }
    if (ast)
        fs.writeFileSync(
            valueFileName,
            stringify(getStaticTOMLValue(ast)),
            "utf8",
        )
}
