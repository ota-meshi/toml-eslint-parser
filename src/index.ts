import type { SourceCode } from "eslint";
import { parseTOML } from "./parser.ts";
import type * as AST from "./ast/index.ts";
import { traverseNodes } from "./traverse.ts";
import { getStaticTOMLValue } from "./utils.ts";
import { KEYS } from "./visitor-keys.ts";
import { ParseError } from "./errors.ts";
import type { ParserOptions, TOMLVersionOption } from "./parser-options.ts";
export * as meta from "./meta.ts";
export { name } from "./meta.ts";

export type { AST, TOMLVersionOption };
export { ParseError };

// parser
export { parseTOML };
// Keys
// eslint-disable-next-line @typescript-eslint/naming-convention -- ignore
export const VisitorKeys = KEYS;

// tools
export { traverseNodes, getStaticTOMLValue };

/**
 * Parse source code
 */
export function parseForESLint(
  code: string,
  options?: ParserOptions,
): {
  ast: AST.TOMLProgram;
  visitorKeys: SourceCode.VisitorKeys;
  services: { isTOML: boolean };
} {
  const ast = parseTOML(code, options);

  return {
    ast,
    visitorKeys: KEYS,
    services: {
      isTOML: true,
    },
  };
}
