#!/usr/bin/env node

"use strict";

const fs = require("fs");
/* eslint n/no-missing-require: off -- ignore */
const toml = require("./lib/index.js");
const { convertTomlTestValue } = require("./toml-test-decode-util.js");

const ast = toml.parseTOML(fs.readFileSync(0, "utf-8"), { tomlVersion: "1.0" });
const result = `${JSON.stringify(convertTomlTestValue(ast), null, 2)}\n`;
process.stdout.write(result);
// fs.writeFileSync("toml-test-decode-last-result.json", result);
