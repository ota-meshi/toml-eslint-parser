import fs from "fs";

import { parseForESLint } from "../src/parser";
import { getStaticTOMLValue } from "../src/utils";
import type { TOMLProgram } from "../src/ast";
import { listUpFixtures, stringify } from "../tests/src/parser/utils";
import path from "path";
import type { TOMLVersionString } from "../src/parser-options";

/**
 * Parse
 */
function parse(code: string, filePath: string, v: TOMLVersionString) {
  return parseForESLint(code, { filePath, tomlVersion: v });
}

for (const { filename, inputFileName, v1, "v1.1": v1P1 } of listUpFixtures()) {
  // eslint-disable-next-line no-console -- tool
  console.error(filename);

  const input = fs.readFileSync(inputFileName, "utf8");
  for (const v of [
    { ...v1, v: "1.0" as const },
    { ...v1P1, v: "1.1" as const },
  ]) {
    let ast: TOMLProgram | null = null;

    fs.mkdirSync(path.dirname(v.outputFileName), { recursive: true });
    try {
      ast = parse(input, filename, v.v).ast;
      const astJson = stringify(ast, true);
      fs.writeFileSync(v.outputFileName, astJson, "utf8");
    } catch (e: any) {
      fs.writeFileSync(
        v.outputFileName,
        stringify(`${e.message}@line:${e.lineNumber},column:${e.column}`),
        "utf8",
      );
    }
    if (ast) {
      fs.mkdirSync(path.dirname(v.valueFileName), { recursive: true });
      fs.writeFileSync(
        v.valueFileName,
        stringify(getStaticTOMLValue(ast)),
        "utf8",
      );
    }
  }
}
