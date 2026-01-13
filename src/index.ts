import { parseForESLint } from "./parser.ts";
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
export { parseForESLint };
// Keys
// eslint-disable-next-line @typescript-eslint/naming-convention -- ignore
export const VisitorKeys = KEYS;

// tools
export { traverseNodes, getStaticTOMLValue };

/**
 * Parse TOML source code
 */
export function parseTOML(
  code: string,
  options?: ParserOptions,
): AST.TOMLProgram {
  return parseForESLint(code, options).ast;
}
