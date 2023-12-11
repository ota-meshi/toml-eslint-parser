"use strict";

/* eslint n/no-missing-require: off -- ignore */
const { generateConvertTOMLValue } = require("./lib/utils.js");

/** Converter for toml-test (https://github.com/toml-lang/toml-test). */
const convertTomlTestValue = generateConvertTOMLValue((node) => {
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

module.exports = { convertTomlTestValue };
