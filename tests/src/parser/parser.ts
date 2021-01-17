import assert from "assert"
import path from "path"
import fs from "fs"

import { KEYS } from "../../../src/visitor-keys"
import { traverseNodes, getKeys } from "../../../src/traverse"
import { getStaticTOMLValue } from "../../../src/utils"
import type { TOMLProgram } from "../../../src/ast"
import { parseTOML } from "../../../src"
import * as IarnaTOML from "@iarna/toml"

const AST_FIXTURE_ROOT = path.resolve(__dirname, "../../fixtures/parser/ast")

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

function parse(code: string, filePath: string) {
    return parseTOML(code, { filePath })
}

describe("Check for AST.", () => {
    for (const filename of fs
        .readdirSync(AST_FIXTURE_ROOT)
        .filter((f) => f.endsWith("input.toml"))) {
        describe(filename, () => {
            const inputFileName = path.join(AST_FIXTURE_ROOT, filename)
            const outputFileName = inputFileName.replace(
                /input\.toml$/u,
                "output.json",
            )
            const valueFileName = inputFileName.replace(
                /input\.toml$/u,
                "value.json",
            )

            const input = fs.readFileSync(inputFileName, "utf8")
            const output = fs.readFileSync(outputFileName, "utf8")

            let ast: any
            it("most to generate the expected AST.", () => {
                try {
                    ast = parse(input, inputFileName)
                } catch (e) {
                    if (
                        typeof e.lineNumber === "number" &&
                        typeof e.column === "number"
                    ) {
                        assert.strictEqual(
                            JSON.stringify(
                                `${e.message}@line:${e.lineNumber},column:${e.column}`,
                            ),
                            output,
                        )
                        return
                    }
                    throw e
                }
                const astJson = JSON.stringify(ast, replacer, 2)
                assert.strictEqual(astJson, output)
            })

            it("location must be correct.", () => {
                if (!ast) return

                // check tokens
                checkTokens(ast, input)

                // check keys
                traverseNodes(ast, {
                    enterNode(node) {
                        const allKeys = KEYS[node.type]
                        for (const key of getKeys(node, {})) {
                            assert.ok(
                                allKeys.includes(key),
                                `missing '${key}' key`,
                            )
                        }
                    },
                    leaveNode() {
                        // noop
                    },
                })

                checkLoc(ast, inputFileName, input)
            })

            it("return value of getStaticTOMLValue must be correct.", () => {
                if (!ast) return
                // check getStaticTOMLValue
                const value = fs.readFileSync(valueFileName, "utf8")
                assert.strictEqual(
                    JSON.stringify(getStaticTOMLValue(ast), valueReplacer, 2),
                    value,
                )
            })

            it("Compare with IarnaTOML results.", () => {
                if (!ast) return

                if (
                    [
                        // There are DateTime-related differences.
                        "local-date-sample01-input.toml",
                        "local-date-time-sample01-input.toml",
                        "table-sample11-top-level-table-input.toml",
                        "date01-leading-zero-input.toml",
                        "leap-year01-input.toml",
                        "leap-year02-input.toml",
                        // cannot parse
                        "local-time-sample01-input.toml",
                        "sample08-dates-and-times-input.toml",
                        "number-exponent01-with-sign-input.toml",
                        "time01-input.toml",
                        "date-time02-fraction-input.toml",
                        "leap-second01-input.toml",
                    ].includes(filename)
                ) {
                    // There are known differences.
                    return
                }
                assert.deepStrictEqual(
                    getStaticTOMLValue(ast),
                    IarnaTOML.parse(input),
                )
            })

            it("even if Win, it must be correct.", () => {
                if (!ast) return
                const inputForWin = input.replace(/\n/g, "\r\n")
                // check
                const astForWin = parse(inputForWin, inputFileName)
                // check tokens
                checkTokens(astForWin, inputForWin)
            })
        })
    }
})

function checkTokens(ast: TOMLProgram, input: string) {
    const allTokens = [...ast.tokens, ...ast.comments].sort(
        (a, b) => a.range[0] - b.range[0],
    )

    assert.strictEqual(
        input.replace(/\s/gu, ""),
        allTokens
            .map((t) => (t.type === "Block" ? `#${t.value}` : t.value))
            .join("")
            .replace(/\s/gu, ""),
    )

    // check loc
    for (const token of allTokens) {
        const value = token.type === "Block" ? `#${token.value}` : token.value

        assert.strictEqual(
            value,
            input.slice(...token.range),
            // .replace(/\r\n/g, "\n"),
        )
    }
}

function checkLoc(ast: TOMLProgram, fileName: string, _code: string) {
    for (const token of ast.tokens) {
        assert.ok(
            token.range[0] < token.range[1],
            `No range on "${token.type} line:${token.loc.start.line} col:${token.loc.start.column}" in ${fileName}`,
        )
    }
    for (const token of ast.comments) {
        assert.ok(
            token.range[0] < token.range[1],
            `No range on "${token.type} line:${token.loc.start.line} col:${token.loc.start.column}" in ${fileName}`,
        )
    }
    traverseNodes(ast, {
        // eslint-disable-next-line complexity, no-shadow -- test
        enterNode(node, parent) {
            if (node.type !== "Program" && node.type !== "TOMLTopLevelTable") {
                assert.ok(
                    node.range[0] < node.range[1],
                    `No range on "${node.type} line:${node.loc.start.line} col:${node.loc.start.column}" in ${fileName}`,
                )
            }
            if (node.type === "TOMLKeyValue") {
                // TODO
            }
            if (parent) {
                assert.ok(
                    parent.range[0] <= node.range[0],
                    `overlap range[0] on "${parent.type} line:${parent.loc.start.line} col:${parent.loc.start.column}" > "${node.type} line:${node.loc.start.line} col:${node.loc.start.column}" in ${fileName}`,
                )
                assert.ok(
                    node.range[1] <= parent.range[1],
                    `overlap range[1] on "${parent.type} line:${parent.loc.end.line} col:${parent.loc.end.column}" > "${node.type} line:${node.loc.end.line} col:${node.loc.end.column}" in ${fileName}`,
                )

                assert.ok(
                    parent.loc.start.line <= node.loc.start.line,
                    `overlap loc.start.line on "${parent.type} line:${parent.loc.start.line} col:${parent.loc.start.column}" > "${node.type} line:${node.loc.start.line} col:${node.loc.start.column}" in ${fileName}`,
                )
                if (parent.loc.start.line === node.loc.start.line) {
                    assert.ok(
                        parent.loc.start.column <= node.loc.start.column,
                        `overlap loc.start.column on "${parent.type} line:${parent.loc.start.line} col:${parent.loc.start.column}" > "${node.type} line:${node.loc.start.line} col:${node.loc.start.column}" in ${fileName}`,
                    )
                }

                assert.ok(
                    node.loc.end.line <= parent.loc.end.line,
                    `overlap loc.end.line on "${parent.type} line:${parent.loc.end.line} col:${parent.loc.end.column}" > "${node.type} line:${node.loc.end.line} col:${node.loc.end.column}" in ${fileName}`,
                )
                if (parent.loc.end.line === node.loc.end.line) {
                    assert.ok(
                        node.loc.end.column <= parent.loc.end.column,
                        `overlap loc.end.column on "${parent.type} line:${parent.loc.end.line} col:${parent.loc.end.column}" > "${node.type} line:${node.loc.end.line} col:${node.loc.end.column}" in ${fileName}`,
                    )
                }
            }
        },
        leaveNode() {
            // noop
        },
    })
}
