type NormalizedTOMLVersion = "1.0" | "1.1";
export type TOMLVersionOption =
  | NormalizedTOMLVersion
  | `${NormalizedTOMLVersion}.0`
  | "latest"
  | "next";
export interface TOMLVer {
  lt(when: NormalizedTOMLVersion): boolean;
  lte(when: NormalizedTOMLVersion): boolean;
  gt(when: NormalizedTOMLVersion): boolean;
  gte(when: NormalizedTOMLVersion): boolean;
  eq(when: NormalizedTOMLVersion): boolean;
}
class TOMLVerImpl implements TOMLVer {
  private readonly version: string;

  public constructor(version: NormalizedTOMLVersion) {
    this.version = version;
  }

  public eq(when: NormalizedTOMLVersion): boolean {
    return this.version === when;
  }

  public lt(when: NormalizedTOMLVersion): boolean {
    return this.version < when;
  }

  public lte(when: NormalizedTOMLVersion): boolean {
    return this.version <= when;
  }

  public gt(when: NormalizedTOMLVersion): boolean {
    return this.version > when;
  }

  public gte(when: NormalizedTOMLVersion): boolean {
    return this.version >= when;
  }
}
const TOML_VERSION_1_0 = new TOMLVerImpl("1.0");
const TOML_VERSION_1_1 = new TOMLVerImpl("1.1");
const DEFAULT_TOML_VERSION: TOMLVer = TOML_VERSION_1_0;
const SUPPORTED_TOML_VERSIONS: Record<TOMLVersionOption, TOMLVer> = {
  "1.0": TOML_VERSION_1_0,
  "1.0.0": TOML_VERSION_1_0,
  "1.1": TOML_VERSION_1_1,
  "1.1.0": TOML_VERSION_1_1,
  latest: TOML_VERSION_1_0,
  next: TOML_VERSION_1_1,
};
export interface ParserOptions {
  filePath?: string;
  tomlVersion?: TOMLVersionOption;
}

/**
 * Get TOML version object from given TOML version string.
 */
export function getTOMLVer(v: TOMLVersionOption | undefined | null): TOMLVer {
  return SUPPORTED_TOML_VERSIONS[v || "latest"] || DEFAULT_TOML_VERSION;
}
