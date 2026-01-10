#!/usr/bin/env node

import fs from "fs";
import * as toml from "./lib/index.mjs";
import { convertTomlTestValue } from "./toml-test-decode-util.js";

const ast = toml.parseTOML(fs.readFileSync(0, "utf-8"), { tomlVersion: "1.0" });
const result = `${JSON.stringify(convertTomlTestValue(ast), null, 2)}\n`;
process.stdout.write(result);
// fs.writeFileSync("toml-test-decode-last-result.json", result);
