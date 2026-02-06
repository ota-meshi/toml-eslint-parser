import type { TOMLBare, TOMLQuoted } from "../ast/index.ts";

/**
 * Get the last element from given array
 */
export function last<T>(arr: T[]): T | null {
  return arr[arr.length - 1] ?? null;
}

/**
 * Node to key name
 */
export function toKeyName(node: TOMLBare | TOMLQuoted): string {
  return node.type === "TOMLBare" ? node.name : node.value;
}
