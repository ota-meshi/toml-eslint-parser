import assert from "assert";
import * as parser from "../../../src/index.ts";

async function createLinter() {
  // eslint-disable-next-line @typescript-eslint/naming-convention -- OK
  const { Linter } = await import("eslint");
  const linter = new Linter({ configType: "eslintrc" });

  linter.defineParser("toml-eslint-parser", parser as any);
  linter.defineRule("test", {
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
  });

  return linter;
}

//------------------------------------------------------------------------------
// Tests
//------------------------------------------------------------------------------

describe("eslint custom parser", () => {
  it("should work with eslint.", async () => {
    if (parseInt(process.version, 10) < 18) return;
    const code = `Hello="TOML"`;

    const linter = await createLinter();
    const messages = linter.verify(code, {
      parser: "toml-eslint-parser",
      rules: {
        test: "error",
      },
    });

    assert.strictEqual(messages.length, 1);
    assert.strictEqual(messages[0].message, "test");
  });
});
