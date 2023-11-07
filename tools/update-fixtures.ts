import fs from "fs";

import { parseForESLint } from "../src/parser";
import { getStaticTOMLValue } from "../src/utils";
import type { TOMLProgram } from "../src/ast";
import { listUpFixtures, stringify } from "../tests/src/parser/utils";
import path from "path";

/**
 * Parse
 */
function parse(code: string, filePath: string) {
  return parseForESLint(code, { filePath });
}

for (const {
  filename,
  inputFileName,
  outputFileName,
  valueFileName,
} of listUpFixtures()) {
  // eslint-disable-next-line no-console -- tool
  console.error(filename);

  const input = fs.readFileSync(inputFileName, "utf8");
  let ast: TOMLProgram | null = null;
  fs.mkdirSync(path.dirname(outputFileName), { recursive: true });
  try {
    ast = parse(input, filename).ast;
    const astJson = stringify(ast, true);
    fs.writeFileSync(outputFileName, astJson, "utf8");
  } catch (e: any) {
    fs.writeFileSync(
      outputFileName,
      stringify(`${e.message}@line:${e.lineNumber},column:${e.column}`),
      "utf8",
    );
  }
  if (ast) {
    fs.mkdirSync(path.dirname(valueFileName), { recursive: true });
    fs.writeFileSync(valueFileName, stringify(getStaticTOMLValue(ast)), "utf8");
  }
}
