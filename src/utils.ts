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

type TOMLContentValue =
  | TOMLValue["value"]
  | TOMLContentValue[]
  | TOMLTableValue;

type TOMLTableValue = {
  [key: string]: TOMLContentValue;
};

export function getStaticTOMLValue(node: TOMLValue): TOMLValue["value"];
export function getStaticTOMLValue(node: TOMLArray): TOMLContentValue[];
export function getStaticTOMLValue(node: TOMLContentNode): TOMLContentValue;
export function getStaticTOMLValue(
  node:
    | TOMLProgram
    | TOMLTopLevelTable
    | TOMLTable
    | TOMLKeyValue
    | TOMLInlineTable
): TOMLTableValue;
export function getStaticTOMLValue(
  node: TOMLStringValue | TOMLBare | TOMLQuoted
): string;
export function getStaticTOMLValue(node: TOMLKey): string[];

/**
 * Gets the static value for the given node.
 */
export function getStaticTOMLValue(node: TOMLNode): TOMLContentValue {
  return resolveValue(node);
}

/**
 * Resolve TOML value
 */
function resolveValue(
  node: TOMLNode,
  baseTable?: TOMLTableValue
): TOMLContentValue {
  return resolver[node.type](node as never, baseTable);
}

const resolver = {
  Program(node: TOMLProgram, baseTable: TOMLTableValue = {}) {
    return resolveValue(node.body[0], baseTable);
  },
  TOMLTopLevelTable(node: TOMLTopLevelTable, baseTable: TOMLTableValue = {}) {
    for (const body of node.body) {
      resolveValue(body, baseTable);
    }
    return baseTable;
  },
  TOMLKeyValue(node: TOMLKeyValue, baseTable: TOMLTableValue = {}) {
    const value = resolveValue(node.value);
    set(baseTable, getStaticTOMLValue(node.key), value);
    return baseTable;
  },
  TOMLTable(node: TOMLTable, baseTable: TOMLTableValue = {}) {
    const table = getTable(
      baseTable,
      getStaticTOMLValue(node.key),
      node.kind === "array"
    );
    for (const body of node.body) {
      resolveValue(body, table);
    }
    return baseTable;
  },
  TOMLArray(node: TOMLArray) {
    return node.elements.map((e) => getStaticTOMLValue(e));
  },
  TOMLInlineTable(node: TOMLInlineTable) {
    const table: TOMLTableValue = {};
    for (const body of node.body) {
      resolveValue(body, table);
    }
    return table;
  },
  TOMLKey(node: TOMLKey) {
    return node.keys.map((key) => getStaticTOMLValue(key));
  },
  TOMLBare(node: TOMLBare) {
    return node.name;
  },
  TOMLQuoted(node: TOMLQuoted) {
    return node.value;
  },
  TOMLValue(node: TOMLValue) {
    return node.value;
  },
};

/**
 * Get the table from the table.
 */
function getTable(baseTable: TOMLTableValue, keys: string[], array: boolean) {
  let target: TOMLTableValue = baseTable;
  for (let index = 0; index < keys.length - 1; index++) {
    const key = keys[index];
    target = getNextTargetFromKey(target, key);
  }
  const lastKey = last(keys)!;
  const lastTarget = target[lastKey];
  if (lastTarget == null) {
    const tableValue: TOMLTableValue = {};
    target[lastKey] = array ? [tableValue] : tableValue;
    return tableValue;
  }
  if (isValue(lastTarget)) {
    // Update because it is an invalid value.
    const tableValue: TOMLTableValue = {};
    target[lastKey] = array ? [tableValue] : tableValue;
    return tableValue;
  }
  if (!array) {
    if (Array.isArray(lastTarget)) {
      // Update because it is an invalid value.
      const tableValue: TOMLTableValue = {};
      target[lastKey] = tableValue;
      return tableValue;
    }
    return lastTarget;
  }

  if (Array.isArray(lastTarget)) {
    // New record
    const tableValue: TOMLTableValue = {};
    lastTarget.push(tableValue);
    return tableValue;
  }
  // Update because it is an invalid value.
  const tableValue: TOMLTableValue = {};
  target[lastKey] = [tableValue];
  return tableValue;

  /** Get next target from key */
  function getNextTargetFromKey(
    currTarget: TOMLTableValue,
    key: string
  ): TOMLTableValue {
    const nextTarget = currTarget[key];
    if (nextTarget == null) {
      const val: TOMLTableValue = {};
      currTarget[key] = val;
      return val;
    }
    if (isValue(nextTarget)) {
      // Update because it is an invalid value.
      const val: TOMLTableValue = {};
      currTarget[key] = val;
      return val;
    }

    let resultTarget = nextTarget;
    while (Array.isArray(resultTarget)) {
      const lastIndex = resultTarget.length - 1;
      const nextElement = resultTarget[lastIndex];
      if (isValue(nextElement)) {
        // Update because it is an invalid value.
        const val: TOMLTableValue = {};
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
function set(baseTable: TOMLTableValue, keys: string[], value: any) {
  let target: TOMLTableValue = baseTable;
  for (let index = 0; index < keys.length - 1; index++) {
    const key = keys[index];
    const nextTarget = target[key];
    if (nextTarget == null) {
      const val: TOMLTableValue = {};
      target[key] = val;
      target = val;
    } else {
      if (isValue(nextTarget) || Array.isArray(nextTarget)) {
        // Update because it is an invalid value.
        const val: TOMLTableValue = {};
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
function isValue(value: any): value is TOMLValue["value"] {
  return typeof value !== "object" || value instanceof Date;
}
