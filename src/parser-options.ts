export type TOMLVersion = "1.0" | "1.1";
export const LATEST_TOML_VERSION: TOMLVersion = "1.1";
export const SUPPORTED_TOML_VERSIONS: TOMLVersion[] = ["1.0", "1.1"];
export interface ParserOptions {
  filePath?: string;
  tomlVersion?: TOMLVersion;
}

/**
 * Normalize TOML version
 */
export function normalizeTOMLVersion(
  v: TOMLVersion | undefined | null,
): TOMLVersion {
  return (v && SUPPORTED_TOML_VERSIONS.includes(v) && v) || LATEST_TOML_VERSION;
}
