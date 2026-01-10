import assert from "assert";
import * as parser from "../../src/index.ts";
import pkg from "../../package.json" with { type: "json" };
const expectedMeta = {
  name: "toml-eslint-parser",
  version: pkg.version,
};

describe("Test for meta object", () => {
  it("A parser should have a meta object.", () => {
    assert.deepStrictEqual({ ...parser.meta }, expectedMeta);
  });
});
