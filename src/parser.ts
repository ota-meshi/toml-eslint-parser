import { TOMLParser } from "./toml-parser/index.ts";
import type { TOMLProgram } from "./ast/index.ts";
import type { ParserOptions } from "./parser-options.ts";

/**
 * Parse TOML source code
 */
export function parseTOML(code: string, options?: ParserOptions): TOMLProgram {
  const parser = new TOMLParser(code, options);
  const ast = parser.parse();
  return ast;
}
