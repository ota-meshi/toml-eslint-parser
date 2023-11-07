export type TOMLVersion = "1.0" | "1.1";
export interface ParserOptions {
  filePath?: string;
  tomlVersion?: TOMLVersion;
}
