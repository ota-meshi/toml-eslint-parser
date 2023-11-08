export type TOMLVersion = "1.0" | "1.1";
export type TOMLVersionNumber = 1.0 | 1.1;
const DEFAULT_TOML_VERSION: TOMLVersionNumber = 1.0;
const SUPPORTED_TOML_VERSIONS: TOMLVersion[] = ["1.0", "1.1"];
export interface ParserOptions {
  filePath?: string;
  tomlVersion?: TOMLVersion;
}

/**
 * Normalize TOML version
 */
export function normalizeTOMLVersion(
  v: TOMLVersion | undefined | null,
): TOMLVersionNumber {
  if (v && SUPPORTED_TOML_VERSIONS.includes(v)) {
    return Number(v) as TOMLVersionNumber;
  }
  return DEFAULT_TOML_VERSION;
}
