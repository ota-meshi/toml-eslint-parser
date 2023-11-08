# AST for TOML

See details: [../src/ast/ast.ts](../src/ast/ast.ts)

You can see the AST on the [Online DEMO](https://ota-meshi.github.io/toml-eslint-parser/).

## Node

```ts
interface BaseTOMLNode {
    type: string;
    loc: SourceLocation;
    range: [number, number];
}
```

All nodes have `type`, `range`, `loc` and `parent` properties according to [ESLint - The AST specification].

## Content Nodes

### TOMLValue

```ts
type TOMLValue = TOMLStringValue | TOMLNumberValue | TOMLBooleanValue | TOMLDateTimeValue

// When expanded, it has the same definition as the following.
interface TOMLValue extends BaseTOMLNode {
    type: "TOMLValue"
    kind: "string" | "integer" | "float" | "boolean" | "offset-date-time" | "local-date-time" | "local-date" | "local-time"
    value: string | number | boolean | Date
    parent: TOMLKey | TOMLKeyValue | TOMLArray
}
```

This is value.

- `kind` ... The kind of value. Each kind has more detailed properties.
- `value` ... A value.

#### TOMLStringValue

```ts
interface TOMLStringValue extends BaseTOMLNode {
    type: "TOMLValue"
    kind: "string"
    value: string
    style: "basic" | "literal"
    multiline: boolean
    parent: TOMLKeyValue | TOMLArray
}
```

This is [String](https://toml.io/en/v1.0.0#string) value.

e.g.

```toml
str1 = "Basic strings"
str2 = """
Multi-line
Basic strings"""
str3 = 'Literal strings'
str4 = '''
Multi-line
Literal strings'''
```

- `style` ... If `"basic"`, the value was defined as (multi-line) basic string. If `"literal"`, the value was defined as (multi-line) literal string.
- `multiline` ... If `true`, the value was defined as multi-line basic string or multi-line literal string.

#### TOMLIntegerValue

```ts
interface TOMLIntegerValue extends BaseTOMLNode {
    type: "TOMLValue"
    kind: "integer"
    value: number
    bigint: bigint
    number: string
    parent: TOMLKeyValue | TOMLArray
}
```

This is [Integer](https://toml.io/en/v1.0.0#integer) value.

e.g.

```toml
int = 42
```

- `value` ... The integer value defined by TOML. However, it can overflow.
- `bigint` ... The integer value defined by TOML is stored as BigInt.
- `number` ... The integer expressed as a string.

#### TOMLFloatValue

```ts
interface TOMLFloatValue extends BaseTOMLNode {
    type: "TOMLValue"
    kind: "integer" | "float"
    value: number
    number: string
    parent: TOMLKeyValue | TOMLArray
}
```

This is [Float](https://toml.io/en/v1.0.0#float) value.

e.g.

```toml
float = 3.14
nan = nan
infinity = inf
```

- `value` ... The float value defined by TOML. The float contains `NaN` and `Infinity`.
- `number` ... The float expressed as a string.

#### TOMLBooleanValue

```ts
interface TOMLBooleanValue extends BaseTOMLNode {
    type: "TOMLValue"
    kind: "boolean"
    value: boolean
    parent: TOMLKeyValue | TOMLArray
}
```

This is [Boolean](https://toml.io/en/v1.0.0#boolean).

e.g.

```toml
bool1 = true
bool2 = false
```

#### TOMLDateTimeValue

```ts
interface TOMLDateTimeValue extends BaseTOMLNode {
    type: "TOMLValue"
    kind: "offset-date-time" | "local-date-time" | "local-date" | "local-time"
    value: Date
    datetime: string
    parent: TOMLKeyValue | TOMLArray
}
```

This is [Offset Date-Time](https://toml.io/en/v1.0.0#offset-date-time) or [Local Date-Time](https://toml.io/en/v1.0.0#local-date-time) or [Local Date](https://toml.io/en/v1.0.0#local-date) or [Local Time](https://toml.io/en/v1.0.0#local-time) value.

e.g.

```toml
odt = 1979-05-27T07:32:00Z
ldt = 1979-05-27T07:32:00
ld = 1979-05-27
lt = 07:32:00
```

- `kind` ... If `"offset-date-time"`, the value was defined as offset date-time. If `"local-date-time"`, the value was defined as local date-time. If `"local-date"`, the value was defined as local date. If `"local-time"`, the value was defined as local time.
- `value` ... The date is stored, but it may have been truncated to a value that can be represented by JavaScript.
- `datetime` ... The date expressed as a string.

### TOMLArray

```ts
interface TOMLArray extends BaseTOMLNode {
    type: "TOMLArray"
    elements: (TOMLValue | TOMLArray | TOMLInlineTable)[]
    parent: TOMLKeyValue | TOMLArray
}
```

This is [Array](https://toml.io/en/v1.0.0#array).

e.g.

```toml
array = [ 1, 2, 3]
```

### TOMLInlineTable

```ts
interface TOMLInlineTable extends BaseTOMLNode {
    type: "TOMLInlineTable"
    body: TOMLKeyValue[]
    parent: TOMLKeyValue | TOMLArray
}
```

This is [Inline Table](https://toml.io/en/v1.0.0#inline-table).

e.g.

```toml
name = { first = "Tom", last = "Preston-Werner" }
```

## Key/Value Pair

### TOMLKeyValue

```ts
interface TOMLKeyValue extends BaseTOMLNode {
    type: "TOMLKeyValue"
    key: TOMLKey
    value: TOMLValue | TOMLArray | TOMLInlineTable
    parent: TOMLTopLevelTable | TOMLTable | TOMLInlineTable
}
```

This is [Key/Value Pair](https://toml.io/en/v1.0.0#keyvalue-pair).

e.g.

```toml
key = "value"
```

### TOMLKey

```ts
interface TOMLKey extends BaseTOMLNode {
    type: "TOMLKey"
    keys: (TOMLBare | TOMLStringKey)[]
    parent: TOMLKeyValue | TOMLTable
}
```

This is [Key](https://toml.io/en/v1.0.0#keys).

e.g.

```toml
physical.color = "orange"
```

### TOMLBare

```ts
interface TOMLBare extends BaseTOMLNode {
    type: "TOMLBare"
    name: string
    parent: TOMLKey
}
```

This is [Bare key](https://toml.io/en/v1.0.0#keys).

e.g.

```toml
bare-key = 42
```

#### TOMLQuoted

```ts
interface TOMLQuoted extends BaseTOMLNode {
    type: "TOMLQuoted"
    value: string
    style: "basic" | "literal"
    parent: TOMLKey
}
```

This is [Quoted key](https://toml.io/en/v1.0.0#keys).

e.g.

```toml
"Key1" = 42
'Key2' = 42
```

## Table

### TOMLTable

```ts
interface TOMLTable extends BaseTOMLNode {
    type: "TOMLTable"
    kind: "standard" | "array"
    key: TOMLKey
    resolvedKey: (string | number)[]
    body: TOMLKeyValue[]
    parent: TOMLTopLevelTable
}
```

This is [Table](https://toml.io/en/v1.0.0#table) or [Array of Table](https://toml.io/en/v1.0.0#array-of-tables).

e.g.

```toml
[table]
key1 = "some string"

[[array.of.table]]
name = "Hammer"
sku = 738594937

[[array.of.table]]
name = "Nail"
sku = 284758393
```

- `kind` ... If `"standard"`, the table was defined as `[]`. If `"array"`, the table was defined as `[[]]`.
- `resolvedKey` ... An array of keys that are actually applied. In the above example, the first `[[array.of.table]]` is resolved as `["array", "of", "table", 0]`, the second `[[array.of.table]]` is resolved as `["array", "of", "table", 1]`.

## Document

### TOMLTopLevelTable

```ts
interface TOMLTopLevelTable extends BaseTOMLNode {
    type: "TOMLTopLevelTable"
    body: (TOMLKeyValue | TOMLTable)[]
    parent: TOMLProgram
}
```

### Program

```js
interface TOMLProgram extends BaseTOMLNode {
    type: "Program"
    body: [TOMLTopLevelTable]
    sourceType: "module"
    comments: Comment[]
    tokens: Token[]
    parent: null
}
```

The `body` of the `Program` node generated by this parser is an array of `TOMLTopLevelTable`.

[ESLint - The AST specification]: https://eslint.org/docs/developer-guide/working-with-custom-parsers#the-ast-specification
