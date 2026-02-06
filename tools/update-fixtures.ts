import fs from "node:fs";

import { parseForESLint } from "../src/index.ts";
import { getStaticTOMLValue } from "../src/utils.ts";
import type { TOMLProgram } from "../src/ast/index.ts";
import { listUpFixtures, stringify } from "../tests/src/parser/utils.ts";
import path from "node:path";
import type { TOMLVersionOption } from "../src/parser-options.ts";

/**
 * Parse
 */
function parse(code: string, filePath: string, v: TOMLVersionOption) {
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
