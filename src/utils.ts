import type {
  TOMLArray,
  TOMLBare,
  TOMLContentNode,
  TOMLInlineTable,
  TOMLKey,
  TOMLKeyValue,
  TOMLNode,
  TOMLProgram,
  TOMLQuoted,
  TOMLStringValue,
  TOMLTable,
  TOMLTopLevelTable,
  TOMLValue,
} from "./ast";
import { last } from "./internal-utils";

type TOMLContentValue<V> = V | TOMLContentValue<V>[] | TOMLTableValue<V>;

type TOMLTableValue<V> = {
  [key: string]: TOMLContentValue<V>;
};

export type ConvertTOMLValue<V> = {
  (node: TOMLValue): V;
  (node: TOMLArray): TOMLContentValue<V>[];
  (node: TOMLContentNode): TOMLContentValue<V>;
  (
    node:
      | TOMLProgram
      | TOMLTopLevelTable
      | TOMLTable
      | TOMLKeyValue
      | TOMLInlineTable,
  ): TOMLTableValue<V>;
  (node: TOMLStringValue | TOMLBare | TOMLQuoted): string;
  (node: TOMLKey): string[];
  (node: TOMLNode): TOMLContentValue<V> | string | string[];
};
export type GetStaticTOMLValue = ConvertTOMLValue<TOMLValue["value"]>;

/**
 * Gets the static value for the given node.
 */
export const getStaticTOMLValue: GetStaticTOMLValue = generateConvertTOMLValue<
  TOMLValue["value"]
>((node) => node.value);

/** Generates a converter to convert from a node. */
export function generateConvertTOMLValue<V>(
  convertValue: (node: TOMLValue) => V,
): ConvertTOMLValue<V> {
  function resolveValue(node: TOMLValue, baseTable?: TOMLTableValue<V>): V;
  function resolveValue(
    node: TOMLArray,
    baseTable?: TOMLTableValue<V>,
  ): TOMLContentValue<V>[];
  function resolveValue(
    node: TOMLContentNode,
    baseTable?: TOMLTableValue<V>,
  ): TOMLContentValue<V>;
  function resolveValue(
    node:
      | TOMLProgram
      | TOMLTopLevelTable
      | TOMLTable
      | TOMLKeyValue
      | TOMLInlineTable,
    baseTable?: TOMLTableValue<V>,
  ): TOMLTableValue<V>;
  function resolveValue(
    node: TOMLStringValue | TOMLBare | TOMLQuoted,
    baseTable?: TOMLTableValue<V>,
  ): string;
  function resolveValue(node: TOMLKey, baseTable?: TOMLTableValue<V>): string[];
  function resolveValue(
    node: TOMLNode,
    baseTable?: TOMLTableValue<V>,
  ): TOMLContentValue<V> | string | string[];

  /**
   * Resolve TOML value
   */
  function resolveValue(
    node: TOMLNode,
    baseTable?: TOMLTableValue<V>,
  ): TOMLContentValue<V> | string | string[] {
    return resolver[node.type](node as never, baseTable);
  }

  const resolver = {
    Program(node: TOMLProgram, baseTable: TOMLTableValue<V> = {}) {
      return resolveValue(node.body[0], baseTable);
    },
    TOMLTopLevelTable(
      node: TOMLTopLevelTable,
      baseTable: TOMLTableValue<V> = {},
    ) {
      for (const body of node.body) {
        resolveValue(body, baseTable);
      }
      return baseTable;
    },
    TOMLKeyValue(node: TOMLKeyValue, baseTable: TOMLTableValue<V> = {}) {
      const value = resolveValue(node.value);
      set(baseTable, resolveValue(node.key), value);
      return baseTable;
    },
    TOMLTable(node: TOMLTable, baseTable: TOMLTableValue<V> = {}) {
      const table = getTable(
        baseTable,
        resolveValue(node.key),
        node.kind === "array",
      );
      for (const body of node.body) {
        resolveValue(body, table);
      }
      return baseTable;
    },
    TOMLArray(node: TOMLArray) {
      return node.elements.map((e) => resolveValue(e));
    },
    TOMLInlineTable(node: TOMLInlineTable) {
      const table: TOMLTableValue<V> = {};
      for (const body of node.body) {
        resolveValue(body, table);
      }
      return table;
    },
    TOMLKey(node: TOMLKey) {
      return node.keys.map((key) => resolveValue(key));
    },
    TOMLBare(node: TOMLBare) {
      return node.name;
    },
    TOMLQuoted(node: TOMLQuoted) {
      return node.value;
    },
    TOMLValue(node: TOMLValue) {
      return convertValue(node);
    },
  };

  return (node: TOMLNode) => resolveValue(node) as never;
}

/**
 * Get the table from the table.
 */
function getTable<V>(
  baseTable: TOMLTableValue<V>,
  keys: string[],
  array: boolean,
) {
  let target: TOMLTableValue<V> = baseTable;
  for (let index = 0; index < keys.length - 1; index++) {
    const key = keys[index];
    target = getNextTargetFromKey(target, key);
  }
  const lastKey = last(keys)!;
  const lastTarget = target[lastKey];
  if (lastTarget == null) {
    const tableValue: TOMLTableValue<V> = {};
    target[lastKey] = array ? [tableValue] : tableValue;
    return tableValue;
  }
  if (isValue(lastTarget)) {
    // Update because it is an invalid value.
    const tableValue: TOMLTableValue<V> = {};
    target[lastKey] = array ? [tableValue] : tableValue;
    return tableValue;
  }
  if (!array) {
    if (Array.isArray(lastTarget)) {
      // Update because it is an invalid value.
      const tableValue: TOMLTableValue<V> = {};
      target[lastKey] = tableValue;
      return tableValue;
    }
    return lastTarget;
  }

  if (Array.isArray(lastTarget)) {
    // New record
    const tableValue: TOMLTableValue<V> = {};
    lastTarget.push(tableValue);
    return tableValue;
  }
  // Update because it is an invalid value.
  const tableValue: TOMLTableValue<V> = {};
  target[lastKey] = [tableValue];
  return tableValue;

  /** Get next target from key */
  function getNextTargetFromKey(
    currTarget: TOMLTableValue<V>,
    key: string,
  ): TOMLTableValue<V> {
    const nextTarget = currTarget[key];
    if (nextTarget == null) {
      const val: TOMLTableValue<V> = {};
      currTarget[key] = val;
      return val;
    }
    if (isValue(nextTarget)) {
      // Update because it is an invalid value.
      const val: TOMLTableValue<V> = {};
      currTarget[key] = val;
      return val;
    }

    let resultTarget = nextTarget;
    while (Array.isArray(resultTarget)) {
      const lastIndex = resultTarget.length - 1;
      const nextElement = resultTarget[lastIndex];
      if (isValue(nextElement)) {
        // Update because it is an invalid value.
        const val: TOMLTableValue<V> = {};
        resultTarget[lastIndex] = val;
        return val;
      }
      resultTarget = nextElement;
    }
    return resultTarget;
  }
}

/**
 * Set the value to the table.
 */
function set<V>(baseTable: TOMLTableValue<V>, keys: string[], value: any) {
  let target: TOMLTableValue<V> = baseTable;
  for (let index = 0; index < keys.length - 1; index++) {
    const key = keys[index];
    const nextTarget = target[key];
    if (nextTarget == null) {
      const val: TOMLTableValue<V> = {};
      target[key] = val;
      target = val;
    } else {
      if (isValue(nextTarget) || Array.isArray(nextTarget)) {
        // Update because it is an invalid value.
        const val: TOMLTableValue<V> = {};
        target[key] = val;
        target = val;
      } else {
        target = nextTarget;
      }
    }
  }
  target[last(keys)!] = value;
}

/**
 * Check whether the given value is a value.
 */
function isValue<V>(value: TOMLContentValue<V>): value is V {
  return typeof value !== "object" || value instanceof Date;
}
