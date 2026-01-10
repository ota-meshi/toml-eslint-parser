import type {
  TOMLArray,
  TOMLBare,
  TOMLContentNode,
  TOMLInlineTable,
  TOMLKeyValue,
  TOMLQuoted,
  TOMLTable,
  TOMLTopLevelTable,
} from "../ast/index.ts";
import { last, toKeyName } from "../internal-utils/index.ts";
import type { Context } from "./context.ts";

const VALUE_KIND_VALUE = Symbol("VALUE_KIND_VALUE");
const VALUE_KIND_INTERMEDIATE = Symbol("VALUE_KIND_INTERMEDIATE");
type ValueKindValue = typeof VALUE_KIND_VALUE;
type ValueKindIntermediate = typeof VALUE_KIND_INTERMEDIATE;

type StandardTableKeyStore = {
  table: "standard";
  value?: undefined | ValueKindIntermediate;
  node: TOMLBare | TOMLQuoted;
  keys: KeyStores;
};
type ArrayTableKeyStore = {
  table: "array";
  value?: undefined | ValueKindIntermediate;
  node: TOMLBare | TOMLQuoted;
  keys: KeyStores;
  peekIndex: number;
};
type IntermediateTableKeyStore = {
  table?: undefined;
  value?: undefined | ValueKindIntermediate;
  node: TOMLBare | TOMLQuoted;
  keys: KeyStores;
};
type ValueKeyStore = {
  table?: undefined;
  value: ValueKindValue;
  node: TOMLBare | TOMLQuoted | TOMLContentNode;
  keys: KeyStores;
};
type IntermediateValueKeyStore = {
  table?: undefined;
  value: ValueKindIntermediate;
  node: TOMLBare | TOMLQuoted;
  keys: KeyStores;
};
type KeyStore =
  | StandardTableKeyStore
  | ArrayTableKeyStore
  | IntermediateTableKeyStore
  | ValueKeyStore
  | IntermediateValueKeyStore;
type KeyStores = Map<string | number, KeyStore>;
export class KeysResolver {
  private readonly rootKeys: KeyStores = new Map();

  private readonly tables: { node: TOMLTable; keys: KeyStores }[] = [];

  private readonly ctx: Context;

  public constructor(ctx: Context) {
    this.ctx = ctx;
  }

  public applyResolveKeyForTable(node: TOMLTable): void {
    let keys = this.rootKeys;
    const peekKeyIndex = node.key.keys.length - 1;
    for (let index = 0; index < peekKeyIndex; index++) {
      const keyNode = node.key.keys[index];
      const keyName = toKeyName(keyNode);
      node.resolvedKey.push(keyName);
      let keyStore = keys.get(keyName);
      if (!keyStore) {
        keyStore = { node: keyNode, keys: new Map() };
        keys.set(keyName, keyStore);
      } else if (keyStore.table === "array") {
        const peekIndex = keyStore.peekIndex;
        node.resolvedKey.push(peekIndex);
        keyStore = keyStore.keys.get(peekIndex)!;
      }
      keys = keyStore.keys as never;
    }
    const lastKeyNode = node.key.keys[peekKeyIndex];
    const lastKeyName = toKeyName(lastKeyNode);
    node.resolvedKey.push(lastKeyName);
    const lastKeyStore = keys.get(lastKeyName);
    if (!lastKeyStore) {
      if (node.kind === "array") {
        node.resolvedKey.push(0);
        const newKeyStore: IntermediateTableKeyStore = {
          node: lastKeyNode,
          keys: new Map(),
        };
        keys.set(lastKeyName, {
          table: node.kind,
          node: lastKeyNode,
          keys: new Map([[0, newKeyStore]]),
          peekIndex: 0,
        });
        this.tables.push({ node, keys: newKeyStore.keys });
      } else {
        const newKeyStore: StandardTableKeyStore = {
          table: node.kind,
          node: lastKeyNode,
          keys: new Map(),
        };
        keys.set(lastKeyName, newKeyStore);
        this.tables.push({ node, keys: newKeyStore.keys });
      }
    } else if (!lastKeyStore.table) {
      if (node.kind === "array") {
        // e.g.
        // [key.foo]
        // [[key]]
        this.ctx.reportParseError("dupe-keys", lastKeyNode);
      } else {
        const transformKey: StandardTableKeyStore = {
          table: node.kind,
          node: lastKeyNode,
          keys: lastKeyStore.keys,
        };
        keys.set(lastKeyName, transformKey);
        this.tables.push({ node, keys: transformKey.keys });
      }
    } else if (lastKeyStore.table === "array") {
      if (node.kind === "array") {
        const newKeyStore: IntermediateTableKeyStore = {
          node: lastKeyNode,
          keys: new Map(),
        };
        const newIndex = lastKeyStore.peekIndex + 1;
        node.resolvedKey.push(newIndex);
        lastKeyStore.keys.set(newIndex, newKeyStore);
        lastKeyStore.peekIndex = newIndex;
        this.tables.push({ node, keys: newKeyStore.keys });
      } else {
        // e.g.
        // [[key]]
        // [key]
        this.ctx.reportParseError("dupe-keys", lastKeyNode);
      }
    } else {
      // e.g.
      // [key]
      // [key]
      this.ctx.reportParseError("dupe-keys", lastKeyNode);
    }
  }

  public verifyDuplicateKeys(node: TOMLTopLevelTable): void {
    for (const body of node.body) {
      if (body.type === "TOMLKeyValue") {
        verifyDuplicateKeysForKeyValue(this.ctx, this.rootKeys, body);
      }
    }

    for (const { node: tableNode, keys } of this.tables) {
      for (const body of tableNode.body) {
        verifyDuplicateKeysForKeyValue(this.ctx, keys, body);
      }
    }
  }
}

/**
 * Verify duplicate keys from TOMLKeyValue
 */
function verifyDuplicateKeysForKeyValue(
  ctx: Context,
  defineKeys: KeyStores,
  node: TOMLKeyValue,
): void {
  let keys = defineKeys;
  const lastKey = last(node.key.keys);

  for (const keyNode of node.key.keys) {
    const key = toKeyName(keyNode);
    let defineKey = keys.get(key);
    if (defineKey) {
      if (defineKey.value === VALUE_KIND_VALUE) {
        // e.g.
        // key = 42
        // key.foo = 42
        ctx.reportParseError(
          "dupe-keys",
          getAfterNode(keyNode, defineKey.node),
        );
      } else if (lastKey === keyNode) {
        ctx.reportParseError(
          "dupe-keys",
          getAfterNode(keyNode, defineKey.node),
        );
      } else if (defineKey.table) {
        // e.g.
        // key = 42
        // [key]
        // ---
        // [key.foo]
        // [key]
        // foo.bar = 42
        ctx.reportParseError(
          "dupe-keys",
          getAfterNode(keyNode, defineKey.node),
        );
      }
      defineKey.value = VALUE_KIND_INTERMEDIATE;
    } else {
      if (lastKey === keyNode) {
        const keyStore: ValueKeyStore = {
          value: VALUE_KIND_VALUE,
          node: keyNode,
          keys: new Map(),
        };
        defineKey = keyStore;
      } else {
        const keyStore: IntermediateValueKeyStore = {
          value: VALUE_KIND_INTERMEDIATE,
          node: keyNode,
          keys: new Map(),
        };
        defineKey = keyStore;
      }
      keys.set(key, defineKey);
    }
    keys = defineKey.keys;
  }

  if (node.value.type === "TOMLInlineTable") {
    verifyDuplicateKeysForInlineTable(ctx, keys, node.value);
  } else if (node.value.type === "TOMLArray") {
    verifyDuplicateKeysForArray(ctx, keys, node.value);
  }
}

/**
 * Verify duplicate keys from TOMLInlineTable
 */
function verifyDuplicateKeysForInlineTable(
  ctx: Context,
  defineKeys: KeyStores,
  node: TOMLInlineTable,
): void {
  for (const body of node.body) {
    verifyDuplicateKeysForKeyValue(ctx, defineKeys, body);
  }
}

/**
 * Verify duplicate keys from TOMLArray
 */
function verifyDuplicateKeysForArray(
  ctx: Context,
  defineKeys: KeyStores,
  node: TOMLArray,
): void {
  const keys = defineKeys;
  for (let index = 0; index < node.elements.length; index++) {
    const element = node.elements[index];
    let defineKey = keys.get(index);
    if (defineKey) {
      // Probably not possible.
      ctx.reportParseError("dupe-keys", getAfterNode(element, defineKey.node));
    } else {
      defineKey = {
        value: VALUE_KIND_VALUE,
        node: element,
        keys: new Map(),
      };
      defineKeys.set(index, defineKey);

      if (element.type === "TOMLInlineTable") {
        verifyDuplicateKeysForInlineTable(ctx, defineKey.keys, element);
      } else if (element.type === "TOMLArray") {
        verifyDuplicateKeysForArray(ctx, defineKey.keys, element);
      }
    }
  }
}

/**
 * Get the after node
 */
function getAfterNode(
  a: TOMLBare | TOMLQuoted | TOMLContentNode,
  b: TOMLBare | TOMLQuoted | TOMLContentNode,
): TOMLBare | TOMLQuoted | TOMLContentNode {
  return a.range[0] <= b.range[0] ? b : a;
}
