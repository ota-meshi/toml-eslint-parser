import type { SourceCode } from "eslint";
import { unionWith } from "eslint-visitor-keys";
import type {
  TOMLArray,
  TOMLBare,
  TOMLInlineTable,
  TOMLKey,
  TOMLKeyValue,
  TOMLNode,
  TOMLProgram,
  TOMLQuoted,
  TOMLTable,
  TOMLTopLevelTable,
  TOMLValue,
} from "./ast";

type TomlKeys = {
  [key in TOMLNode["type"]]: string[];
} & {
  Program: (keyof TOMLProgram)[];
  TOMLTopLevelTable: (keyof TOMLTopLevelTable)[];
  TOMLTable: (keyof TOMLTable)[];
  TOMLKeyValue: (keyof TOMLKeyValue)[];
  TOMLKey: (keyof TOMLKey)[];
  TOMLArray: (keyof TOMLArray)[];
  TOMLInlineTable: (keyof TOMLInlineTable)[];
  TOMLBare: (keyof TOMLBare)[];
  TOMLQuoted: (keyof TOMLQuoted)[];
  TOMLValue: (keyof TOMLValue)[];
};

const tomlKeys: TomlKeys = {
  Program: ["body"],
  TOMLTopLevelTable: ["body"],
  TOMLTable: ["key", "body"],
  TOMLKeyValue: ["key", "value"],
  TOMLKey: ["keys"],
  TOMLArray: ["elements"],
  TOMLInlineTable: ["body"],
  TOMLBare: [],
  TOMLQuoted: [],
  TOMLValue: [],
};

export const KEYS: SourceCode.VisitorKeys = unionWith(
  tomlKeys,
) as SourceCode.VisitorKeys;
