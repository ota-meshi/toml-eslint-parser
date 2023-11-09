#!/usr/bin/env node

"use strict"; // eslint-disable-line n/shebang -- test

const fs = require("fs");
/* eslint n/no-missing-require: off -- ignore */
const toml = require("./lib/index.js");
const { generateConvertTOMLValue } = require("./lib/utils.js");

/** Converter for toml-test (https://github.com/toml-lang/toml-test). */
const convertTomlTestValue = generateConvertTOMLValue((node) => {
  if (node.kind === "boolean") {
    return { type: "bool", value: String(node.value) };
  }
  if (node.kind === "local-date") {
    return {
      type: "date-local",
      value: node.value.toISOString().slice(0, 10),
    };
  }
  if (node.kind === "local-date-time") {
    return {
      type: "datetime-local",
      value: node.value.toISOString().slice(0, -1),
    };
  }
  if (node.kind === "offset-date-time") {
    return {
      type: "datetime",
      value: node.value.toISOString(),
    };
  }
  if (node.kind === "local-time") {
    return {
      type: "time-local",
      value: node.value.toISOString().slice(11, -1),
    };
  }
  if (node.kind === "float" || node.kind === "integer") {
    return {
      type: node.kind,
      value: node.number,
    };
  }
  return { type: node.kind, value: node.value };
});

const ast = toml.parseTOML(fs.readFileSync(0, "utf-8"));
process.stdout.write(`${JSON.stringify(convertTomlTestValue(ast), null, 4)}\n`);
