import { Linter } from "eslint"
import assert from "assert"
import * as parser from "../../../src/index"

function createLinter() {
    const linter = new Linter()

    linter.defineParser("toml-eslint-parser", parser as any)
    linter.defineRule("test", {
        create(context) {
            return {
                TOMLBare(node: any) {
                    context.report({
                        node,
                        message: "test",
                    })
                },
            }
        },
    })

    return linter
}

//------------------------------------------------------------------------------
// Tests
//------------------------------------------------------------------------------

describe("eslint custom parser", () => {
    it("should work with eslint.", () => {
        const code = `Hello="TOML"`

        const linter = createLinter()
        const messages = linter.verify(code, {
            parser: "toml-eslint-parser",
            rules: {
                test: "error",
            },
        })

        assert.strictEqual(messages.length, 1)
        assert.strictEqual(messages[0].message, "test")
    })
})
