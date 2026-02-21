import assert from "node:assert";
import * as parser from "../../../src/index.ts";
import type { RuleDefinition } from "@eslint/core";
import { Linter } from "eslint";

const testRule: RuleDefinition = {
  create(context) {
    return {
      TOMLBare(node: any) {
        context.report({
          node,
          message: "test",
        });
      },
    };
  },
};

//------------------------------------------------------------------------------
// Tests
//------------------------------------------------------------------------------

describe("eslint custom parser", () => {
  it("should work with eslint.", () => {
    if (parseInt(process.version, 10) < 18) return;
    const code = `Hello="TOML"`;

    const linter = new Linter();
    const messages = linter.verify(code, {
      files: ["**/*"],
      languageOptions: {
        parser,
      },
      plugins: {
        test: {
          rules: {
            test: testRule,
          },
        },
      },
      rules: {
        "test/test": "error",
      },
    });

    assert.strictEqual(messages.length, 1);
    assert.strictEqual(messages[0].message, "test");
  });
});
