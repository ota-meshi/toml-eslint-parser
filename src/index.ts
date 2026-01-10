import { parseForESLint } from "./parser";
import type * as AST from "./ast";
import { traverseNodes } from "./traverse";
import { getStaticTOMLValue, generateConvertTOMLValue } from "./utils";
import { KEYS } from "./visitor-keys";
import { ParseError } from "./errors";
import type { ParserOptions } from "./parser-options";
export * as meta from "./meta";
export { name } from "./meta";

export { AST, ParseError };

// parser
export { parseForESLint };
// Keys
// eslint-disable-next-line @typescript-eslint/naming-convention -- ignore
export const VisitorKeys = KEYS;

// tools
export { traverseNodes, getStaticTOMLValue, generateConvertTOMLValue };

/**
 * Parse TOML source code
 */
export function parseTOML(
  code: string,
  options?: ParserOptions,
): AST.TOMLProgram {
  return parseForESLint(code, options).ast;
}
