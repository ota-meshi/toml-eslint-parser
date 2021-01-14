import type {
    TOMLArray,
    TOMLBare,
    TOMLContentNode,
    TOMLInlineTable,
    TOMLKeyValue,
    TOMLStringKey,
    TOMLTable,
    TOMLTopLevelTable,
} from "../ast"
import { last, toKeyName } from "../internal-utils"

type DefineKey = {
    keys: DefineKeys
    table?: "standard" | "array"
    frozen?: boolean
    keyVal?: true
    path: (string | number)[]
}

type DefineKeys = Map<string | number, DefineKey>

type DuplicateKey = {
    node: TOMLBare | TOMLStringKey | TOMLContentNode
    path: (string | number)[]
}

/**
 * Iterate duplicate key node
 */
export function* iterateDuplicateKeyNodes(
    node: TOMLTopLevelTable,
): IterableIterator<DuplicateKey> {
    const defineKeys: DefineKeys = new Map()
    for (const body of node.body) {
        if (body.type === "TOMLTable") {
            yield* iterateDuplicateKeyNodesForTable(body, defineKeys, [])
        } else if (body.type === "TOMLKeyValue") {
            yield* iterateDuplicateKeyNodesForKeyValue(body, defineKeys, [])
        }
    }
}

/**
 * Iterate duplicate key node from TOMLTable
 */
function* iterateDuplicateKeyNodesForTable(
    node: TOMLTable,
    defineKeys: DefineKeys,
    basePath: (string | number)[],
): IterableIterator<DuplicateKey> {
    if (node.kind === "standard") {
        yield* iterateDuplicateKeyNodesForStdTable(node, defineKeys, basePath)
    } else {
        yield* iterateDuplicateKeyNodesForArrayTable(node, defineKeys, basePath)
    }
}

/**
 * Iterate duplicate key node from std table
 */
function* iterateDuplicateKeyNodesForStdTable(
    node: TOMLTable,
    defineKeys: DefineKeys,
    basePath: (string | number)[],
): IterableIterator<DuplicateKey> {
    const path = [...basePath]

    const lastKey = last(node.key.keys)

    for (const keyNode of node.key.keys) {
        const key = toKeyName(keyNode)
        path.push(key)
        let defineKey = defineKeys.get(key)
        if (defineKey) {
            if (defineKey.frozen) {
                yield {
                    node: keyNode,
                    path: defineKey.path,
                }
            } else if (keyNode === lastKey) {
                if (defineKey.keyVal) {
                    // [target]
                    // key.foo = ???
                    // [target.key]
                    yield {
                        node: keyNode,
                        path: defineKey.path,
                    }
                } else if (defineKey.table) {
                    // [key]
                    // [key]
                    // or
                    // [[key]]
                    // [key]
                    yield {
                        node: keyNode,
                        path: defineKey.path,
                    }
                }
            }
        } else {
            defineKey = {
                keys: new Map(),
                table: keyNode === lastKey ? "standard" : undefined,
                path: [...path],
            }
            defineKeys.set(key, defineKey)
        }
        defineKeys = defineKey.keys
    }

    for (const body of node.body) {
        yield* iterateDuplicateKeyNodesForKeyValue(body, defineKeys, path)
    }
}

/**
 * Iterate duplicate key node from array table
 */
function* iterateDuplicateKeyNodesForArrayTable(
    node: TOMLTable,
    defineKeys: DefineKeys,
    basePath: (string | number)[],
): IterableIterator<DuplicateKey> {
    const path = [...basePath]

    const lastKey = last(node.key.keys)

    for (const keyNode of node.key.keys) {
        const key = toKeyName(keyNode)
        path.push(key)
        let defineKey = defineKeys.get(key)
        if (defineKey) {
            if (defineKey.frozen || defineKey.keyVal) {
                yield {
                    node: keyNode,
                    path: defineKey.path,
                }
            }

            if (keyNode === lastKey) {
                if (defineKey.keyVal) {
                    // [target]
                    // key.foo = ???
                    // [[target.key]]
                    yield {
                        node: keyNode,
                        path: defineKey.path,
                    }
                } else if (defineKey.table !== "array") {
                    // [key]
                    // [[key]]
                    yield {
                        node: keyNode,
                        path: defineKey.path,
                    }
                }
            }
        } else {
            defineKey = {
                keys: new Map(),
                table: keyNode === lastKey ? "array" : undefined,
                path: [...path],
            }
            defineKeys.set(key, defineKey)
        }

        if (keyNode === lastKey) {
            defineKeys = defineKey.keys
            defineKey = {
                keys: new Map(),
                table: "array",
                path: [...path, 0],
            }
            defineKeys.set(0, defineKey) // override
        }
        defineKeys = defineKey.keys
    }

    for (const body of node.body) {
        yield* iterateDuplicateKeyNodesForKeyValue(body, defineKeys, path)
    }
}

/**
 * Iterate duplicate key node from TOMLKeyValue
 */
function* iterateDuplicateKeyNodesForKeyValue(
    node: TOMLKeyValue,
    defineKeys: DefineKeys,
    basePath: (string | number)[],
): IterableIterator<DuplicateKey> {
    const path = [...basePath]

    const lastKey = last(node.key.keys)

    for (const keyNode of node.key.keys) {
        const key = toKeyName(keyNode)
        path.push(key)
        let defineKey = defineKeys.get(key)
        if (defineKey) {
            if (defineKey.frozen) {
                yield {
                    node: keyNode,
                    path: defineKey.path,
                }
            } else if (lastKey === keyNode) {
                // last key
                yield {
                    node: keyNode,
                    path: defineKey.path,
                }
            }
            defineKey.keyVal = true
        } else {
            defineKey = {
                keys: new Map(),
                frozen: lastKey === keyNode,
                keyVal: true,
                path: [...path],
            }
            defineKeys.set(key, defineKey)
        }
        defineKeys = defineKey.keys
    }

    if (node.value.type === "TOMLInlineTable") {
        yield* iterateDuplicateKeyNodesForInlineTable(
            node.value,
            defineKeys,
            path,
        )
    } else if (node.value.type === "TOMLArray") {
        yield* iterateDuplicateKeyNodesForArray(node.value, defineKeys, path)
    }
}

/**
 * Iterate duplicate key node from TOMLInlineTable
 */
function* iterateDuplicateKeyNodesForInlineTable(
    node: TOMLInlineTable,
    defineKeys: DefineKeys,
    basePath: (string | number)[],
): IterableIterator<DuplicateKey> {
    for (const body of node.body) {
        yield* iterateDuplicateKeyNodesForKeyValue(body, defineKeys, basePath)
    }
}

/**
 * Iterate duplicate key node from TOMLArray
 */
function* iterateDuplicateKeyNodesForArray(
    node: TOMLArray,
    defineKeys: DefineKeys,
    basePath: (string | number)[],
): IterableIterator<DuplicateKey> {
    for (let index = 0; index < node.elements.length; index++) {
        const element = node.elements[index]
        const path = [...basePath, index]
        if (defineKeys.get(index)) {
            yield {
                node: element,
                path,
            }
        } else {
            const defineKey: DefineKey = {
                keys: new Map(),
                frozen: true,
                path,
            }
            defineKeys.set(index, defineKey)

            if (element.type === "TOMLInlineTable") {
                yield* iterateDuplicateKeyNodesForInlineTable(
                    element,
                    defineKey.keys,
                    path,
                )
            } else if (element.type === "TOMLArray") {
                yield* iterateDuplicateKeyNodesForArray(
                    element,
                    defineKey.keys,
                    path,
                )
            }
        }
    }
}
