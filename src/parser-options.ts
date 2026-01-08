export type TOMLVersionOption =
  | "1.0"
  | "1.1"
  | "1.0.0"
  | "1.1.0"
  | "latest"
  | "next";
export interface TOMLVer {
  lt(major: number, minor: number): boolean;
  // lte(major:number,minor:number): boolean;
  // gt(major:number,minor:number): boolean;
  gte(major: number, minor: number): boolean;
  // eq(major:number,minor:number): boolean;
}
class TOMLVerImpl implements TOMLVer {
  private readonly major: number;

  private readonly minor: number;

  public constructor(major: number, minor: number) {
    this.major = major;
    this.minor = minor;
  }

  public lt(major: number, minor: number): boolean {
    return this.major < major || (this.major === major && this.minor < minor);
  }

  public gte(major: number, minor: number): boolean {
    return this.major > major || (this.major === major && this.minor >= minor);
  }
}
const TOML_VERSION_1_0 = new TOMLVerImpl(1, 0);
const TOML_VERSION_1_1 = new TOMLVerImpl(1, 1);
const DEFAULT_TOML_VERSION: TOMLVer = TOML_VERSION_1_0;
const SUPPORTED_TOML_VERSIONS: Record<TOMLVersionOption, TOMLVer> = {
  "1.0": TOML_VERSION_1_0,
  "1.0.0": TOML_VERSION_1_0,
  "1.1": TOML_VERSION_1_1,
  "1.1.0": TOML_VERSION_1_1,
  latest: TOML_VERSION_1_1,
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
