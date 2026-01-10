import { TOMLParser } from "./toml-parser/index.ts";
import type { SourceCode } from "eslint";
import { KEYS } from "./visitor-keys.ts";
import type { TOMLProgram } from "./ast/index.ts";
import type { ParserOptions } from "./parser-options.ts";
/**
 * Parse source code
 */
export function parseForESLint(
  code: string,
  options?: ParserOptions,
): {
  ast: TOMLProgram;
  visitorKeys: SourceCode.VisitorKeys;
  services: { isTOML: boolean };
} {
  const parser = new TOMLParser(code, options);
  const ast = parser.parse();

  return {
    ast,
    visitorKeys: KEYS,
    services: {
      isTOML: true,
    },
  };
}
