import type { TOMLBare, TOMLStringKey } from "../ast"

/**
 * Get the last element from given array
 */
export function last<T>(arr: T[]): T | null {
    return arr[arr.length - 1] ?? null
}

/**
 * Node to key name
 */
export function toKeyName(node: TOMLBare | TOMLStringKey): string {
    return node.type === "TOMLBare" ? node.name : node.value
}
