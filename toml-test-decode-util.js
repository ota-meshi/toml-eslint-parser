/* eslint-disable no-use-before-define -- Inlined from lib/index.mjs */
// Inlined from lib/index.mjs to avoid exporting generateConvertTOMLValue from main package
/**
 * Get the last element from given array
 */
function last(arr) {
  return arr[arr.length - 1] ?? null;
}

/**
 * Generates a converter to convert from a node.
 */
function generateConvertTOMLValue(convertValue) {
  /**
   * Resolve TOML value
   */
  function resolveValue(node, baseTable) {
    return resolver[node.type](node, baseTable);
  }

  const resolver = {
    Program(node, baseTable = {}) {
      return resolveValue(node.body[0], baseTable);
    },
    TOMLTopLevelTable(node, baseTable = {}) {
      for (const body of node.body) resolveValue(body, baseTable);
      return baseTable;
    },
    TOMLKeyValue(node, baseTable = {}) {
      const value = resolveValue(node.value);
      set(baseTable, resolveValue(node.key), value);
      return baseTable;
    },
    TOMLTable(node, baseTable = {}) {
      const table = getTable(
        baseTable,
        resolveValue(node.key),
        node.kind === "array",
      );
      for (const body of node.body) resolveValue(body, table);
      return baseTable;
    },
    TOMLArray(node) {
      return node.elements.map((e) => resolveValue(e));
    },
    TOMLInlineTable(node) {
      const table = {};
      for (const body of node.body) resolveValue(body, table);
      return table;
    },
    TOMLKey(node) {
      return node.keys.map((key) => resolveValue(key));
    },
    TOMLBare(node) {
      return node.name;
    },
    TOMLQuoted(node) {
      return node.value;
    },
    TOMLValue(node) {
      return convertValue(node);
    },
  };
  return (node) => resolveValue(node);
}

/**
 * Get the table from the table.
 */
function getTable(baseTable, keys, array) {
  let target = baseTable;
  for (let index = 0; index < keys.length - 1; index++) {
    const key = keys[index];
    target = getNextTargetFromKey(target, key);
  }
  const lastKey = last(keys);
  const lastTarget = target[lastKey];
  if (lastTarget == null) {
    const tableValue$1 = {};
    target[lastKey] = array ? [tableValue$1] : tableValue$1;
    return tableValue$1;
  }
  if (isValue(lastTarget)) {
    const tableValue$1 = {};
    target[lastKey] = array ? [tableValue$1] : tableValue$1;
    return tableValue$1;
  }
  if (!array) {
    if (Array.isArray(lastTarget)) {
      const tableValue$1 = {};
      target[lastKey] = tableValue$1;
      return tableValue$1;
    }
    return lastTarget;
  }
  if (Array.isArray(lastTarget)) {
    const tableValue$1 = {};
    lastTarget.push(tableValue$1);
    return tableValue$1;
  }
  const tableValue = {};
  target[lastKey] = [tableValue];
  return tableValue;

  /** Get next target from key */
  function getNextTargetFromKey(currTarget, key) {
    const nextTarget = currTarget[key];
    if (nextTarget == null) {
      const val = {};
      currTarget[key] = val;
      return val;
    }
    if (isValue(nextTarget)) {
      const val = {};
      currTarget[key] = val;
      return val;
    }
    let resultTarget = nextTarget;
    while (Array.isArray(resultTarget)) {
      const lastIndex = resultTarget.length - 1;
      const nextElement = resultTarget[lastIndex];
      if (isValue(nextElement)) {
        const val = {};
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
function set(baseTable, keys, value) {
  let target = baseTable;
  for (let index = 0; index < keys.length - 1; index++) {
    const key = keys[index];
    const nextTarget = target[key];
    if (nextTarget == null) {
      const val = {};
      target[key] = val;
      target = val;
    } else if (isValue(nextTarget) || Array.isArray(nextTarget)) {
      const val = {};
      target[key] = val;
      target = val;
    } else target = nextTarget;
  }
  target[last(keys)] = value;
}

/**
 * Check whether the given value is a value.
 */
function isValue(value) {
  return typeof value !== "object" || value instanceof Date;
}

/** Converter for toml-test (https://github.com/toml-lang/toml-test). */
export const convertTomlTestValue = generateConvertTOMLValue((node) => {
  if (node.kind === "boolean") {
    return { type: "bool", value: String(node.value) };
  }
  if (node.kind === "local-date") {
    return {
      type: "date-local",
      value: node.value.toISOString().slice(0, 10),
    };
  }
  if (node.kind === "local-date-time") {
    return {
      type: "datetime-local",
      value: node.value.toISOString().slice(0, -1),
    };
  }
  if (node.kind === "offset-date-time") {
    return {
      type: "datetime",
      value: node.value.toISOString(),
    };
  }
  if (node.kind === "local-time") {
    return {
      type: "time-local",
      value: node.value.toISOString().slice(11, -1),
    };
  }
  if (node.kind === "float") {
    return {
      type: node.kind,
      value:
        node.value === Infinity
          ? "+inf"
          : node.value === -Infinity
            ? "-inf"
            : Number.isNaN(node.value)
              ? "nan"
              : String(node.value),
    };
  }
  if (node.kind === "integer") {
    return {
      type: node.kind,
      value: String(node.bigint),
    };
  }
  return { type: node.kind, value: node.value };
});
/* eslint-enable no-use-before-define -- End of inlined code */
