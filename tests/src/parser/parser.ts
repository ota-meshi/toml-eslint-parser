import assert from "assert";
import fs from "fs";
import semver from "semver";

import { KEYS } from "../../../src/visitor-keys";
import { traverseNodes, getKeys } from "../../../src/traverse";
import { getStaticTOMLValue } from "../../../src/utils";
import type { TOMLProgram } from "../../../src/ast";
import { parseTOML } from "../../../src";
import * as IarnaTOML from "@iarna/toml";
import { listUpFixtures, stringify } from "./utils";

const isNode8 = !semver.gte(process.version, "9.0.0");

function parse(code: string, filePath: string) {
  return parseTOML(code, { filePath });
}

describe("Check for AST.", () => {
  for (const {
    filename,
    inputFileName,
    outputFileName,
    valueFileName,
    specAssertion,
    invalid,
    valid,
  } of listUpFixtures()) {
    describe(filename, () => {
      const input = fs.readFileSync(inputFileName, "utf8");
      const output = fs.readFileSync(outputFileName, "utf8");

      let ast: any;
      it("most to generate the expected AST.", () => {
        try {
          ast = parse(input, inputFileName);

          if (invalid) {
            assert.fail("Expected error");
          }
        } catch (e: any) {
          if (valid) {
            throw e;
          }
          if (
            typeof e.lineNumber === "number" &&
            typeof e.column === "number"
          ) {
            assert.strictEqual(
              stringify(`${e.message}@line:${e.lineNumber},column:${e.column}`),
              output,
            );
            return;
          }
          throw e;
        }
        const astJson = stringify(ast, true);
        assert.strictEqual(astJson, output);
      });

      it("location must be correct.", () => {
        if (!ast) return;

        // check tokens
        checkTokens(ast, input);

        // check keys
        traverseNodes(ast, {
          enterNode(node) {
            const allKeys = KEYS[node.type];
            for (const key of getKeys(node, {})) {
              assert.ok(allKeys.includes(key), `missing '${key}' key`);
            }
          },
          leaveNode() {
            // noop
          },
        });

        checkLoc(ast, inputFileName, input);
      });

      if (isNode8) {
        return;
      }

      it("return value of getStaticTOMLValue must be correct.", () => {
        if (!ast) return;
        // check getStaticTOMLValue
        const value = fs.readFileSync(valueFileName, "utf8");
        assert.strictEqual(stringify(getStaticTOMLValue(ast)), value);
      });

      if (specAssertion) {
        it("return value of getStaticTOMLValue must pass the assertion.", () => {
          specAssertion(getStaticTOMLValue(ast));
        });
      }
      it("Compare with IarnaTOML results.", () => {
        if (!ast) return;

        if (
          [
            // There are DateTime-related differences.
            "local-date-sample01-input.toml",
            "local-date-time-sample01-input.toml",
            "table-sample11-top-level-table-input.toml",
            "date01-leading-zero-input.toml",
            "date-time03-min-input.toml",
            "leap-year01-input.toml",
            "leap-year02-input.toml",
            "spec-time-1.toml",
            "spec-time-2.toml",
            "spec-date-local-1.toml",
            "spec-date-time-local-1.toml",
            "spec-date-time-local-2.toml",
            // -0
            // "spec-float-9.toml",
            // big int
            "long-integer.toml",
            "spec-int-max.toml",
            "spec-int-min.toml",
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
          return;
        }
        assert.deepStrictEqual(getStaticTOMLValue(ast), IarnaTOML.parse(input));
      });

      it("even if Win, it must be correct.", () => {
        if (!ast) return;
        const inputForWin = input.replace(/\n/g, "\r\n");
        // check
        const astForWin = parse(inputForWin, inputFileName);
        // check tokens
        checkTokens(astForWin, inputForWin);
      });
    });
  }
});

function checkTokens(ast: TOMLProgram, input: string) {
  const allTokens = [...ast.tokens, ...ast.comments].sort(
    (a, b) => a.range[0] - b.range[0],
  );

  assert.strictEqual(
    input.replace(/\s/gu, ""),
    allTokens
      .map((t) => (t.type === "Block" ? `#${t.value}` : t.value))
      .join("")
      .replace(/\s/gu, ""),
  );

  // check loc
  for (const token of allTokens) {
    const value = token.type === "Block" ? `#${token.value}` : token.value;

    assert.strictEqual(
      value,
      input.slice(...token.range),
      // .replace(/\r\n/g, "\n"),
    );
  }
}

function checkLoc(ast: TOMLProgram, fileName: string, _code: string) {
  for (const token of ast.tokens) {
    assert.ok(
      token.range[0] < token.range[1],
      `No range on "${token.type} line:${token.loc.start.line} col:${token.loc.start.column}" in ${fileName}`,
    );
  }
  for (const token of ast.comments) {
    assert.ok(
      token.range[0] < token.range[1],
      `No range on "${token.type} line:${token.loc.start.line} col:${token.loc.start.column}" in ${fileName}`,
    );
  }
  traverseNodes(ast, {
    enterNode(node, parent) {
      if (node.type !== "Program" && node.type !== "TOMLTopLevelTable") {
        assert.ok(
          node.range[0] < node.range[1],
          `No range on "${node.type} line:${node.loc.start.line} col:${node.loc.start.column}" in ${fileName}`,
        );
      }
      if (node.type === "TOMLKeyValue") {
        // TODO
      }
      if (parent) {
        assert.ok(
          parent.range[0] <= node.range[0],
          `overlap range[0] on "${parent.type} line:${parent.loc.start.line} col:${parent.loc.start.column}" > "${node.type} line:${node.loc.start.line} col:${node.loc.start.column}" in ${fileName}`,
        );
        assert.ok(
          node.range[1] <= parent.range[1],
          `overlap range[1] on "${parent.type} line:${parent.loc.end.line} col:${parent.loc.end.column}" > "${node.type} line:${node.loc.end.line} col:${node.loc.end.column}" in ${fileName}`,
        );

        assert.ok(
          parent.loc.start.line <= node.loc.start.line,
          `overlap loc.start.line on "${parent.type} line:${parent.loc.start.line} col:${parent.loc.start.column}" > "${node.type} line:${node.loc.start.line} col:${node.loc.start.column}" in ${fileName}`,
        );
        if (parent.loc.start.line === node.loc.start.line) {
          assert.ok(
            parent.loc.start.column <= node.loc.start.column,
            `overlap loc.start.column on "${parent.type} line:${parent.loc.start.line} col:${parent.loc.start.column}" > "${node.type} line:${node.loc.start.line} col:${node.loc.start.column}" in ${fileName}`,
          );
        }

        assert.ok(
          node.loc.end.line <= parent.loc.end.line,
          `overlap loc.end.line on "${parent.type} line:${parent.loc.end.line} col:${parent.loc.end.column}" > "${node.type} line:${node.loc.end.line} col:${node.loc.end.column}" in ${fileName}`,
        );
        if (parent.loc.end.line === node.loc.end.line) {
          assert.ok(
            node.loc.end.column <= parent.loc.end.column,
            `overlap loc.end.column on "${parent.type} line:${parent.loc.end.line} col:${parent.loc.end.column}" > "${node.type} line:${node.loc.end.line} col:${node.loc.end.column}" in ${fileName}`,
          );
        }
      }
    },
    leaveNode() {
      // noop
    },
  });
}
