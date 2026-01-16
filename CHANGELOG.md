# toml-eslint-parser

## 1.0.3

### Patch Changes

- [#269](https://github.com/ota-meshi/toml-eslint-parser/pull/269) [`4fd86e5`](https://github.com/ota-meshi/toml-eslint-parser/commit/4fd86e549782f3e34876e41d164a43a0d856bc80) Thanks [@ota-meshi](https://github.com/ota-meshi)! - fix: readme

## 1.0.2

### Patch Changes

- [#267](https://github.com/ota-meshi/toml-eslint-parser/pull/267) [`44e71b9`](https://github.com/ota-meshi/toml-eslint-parser/commit/44e71b95323699fe2760aabf3eb7d1ca3c451332) Thanks [@ota-meshi](https://github.com/ota-meshi)! - docs: update usage and configuration examples in README.md

## 1.0.1

### Patch Changes

- [#263](https://github.com/ota-meshi/toml-eslint-parser/pull/263) [`3d8a87b`](https://github.com/ota-meshi/toml-eslint-parser/commit/3d8a87b8f0a12496014b37706afac0ef5da56fd9) Thanks [@ota-meshi](https://github.com/ota-meshi)! - fix: add TOMLVersionOption type export

## 1.0.0

### Major Changes

- [#261](https://github.com/ota-meshi/toml-eslint-parser/pull/261) [`03ba361`](https://github.com/ota-meshi/toml-eslint-parser/commit/03ba36148e3c2086f108cbe4a8c36b872b6e1c76) Thanks [@copilot-swe-agent](https://github.com/apps/copilot-swe-agent)! - Change to ESM-only package. This is a breaking change that requires Node.js environments that support ESM.

- [#255](https://github.com/ota-meshi/toml-eslint-parser/pull/255) [`9dfd045`](https://github.com/ota-meshi/toml-eslint-parser/commit/9dfd0450ce9dbd3361a7db3e54cb5b0b8d6841fc) Thanks [@copilot-swe-agent](https://github.com/apps/copilot-swe-agent)! - Drop support for Node.js <20

- [#257](https://github.com/ota-meshi/toml-eslint-parser/pull/257) [`863f87a`](https://github.com/ota-meshi/toml-eslint-parser/commit/863f87ada48ef8838fb70e4fdcf6b82f7d48b33e) Thanks [@copilot-swe-agent](https://github.com/apps/copilot-swe-agent)! - Change default tomlVersion to 1.1

## 0.12.0

### Minor Changes

- [#252](https://github.com/ota-meshi/toml-eslint-parser/pull/252) [`af74a2c`](https://github.com/ota-meshi/toml-eslint-parser/commit/af74a2c36098849d1694efdd5704d029ce675654) Thanks [@ota-meshi](https://github.com/ota-meshi)! - feat: add error handling for keys starting with a dot

## 0.11.0

### Minor Changes

- [#248](https://github.com/ota-meshi/toml-eslint-parser/pull/248) [`08b356b`](https://github.com/ota-meshi/toml-eslint-parser/commit/08b356b2db32ba65111e00f4673b8ed9068ec6ca) Thanks [@ota-meshi](https://github.com/ota-meshi)! - changed `tomlVersion=latest` to an alias for `1.1.0`.

- [#248](https://github.com/ota-meshi/toml-eslint-parser/pull/248) [`08b356b`](https://github.com/ota-meshi/toml-eslint-parser/commit/08b356b2db32ba65111e00f4673b8ed9068ec6ca) Thanks [@ota-meshi](https://github.com/ota-meshi)! - feat: support for TOML v1.1

### Patch Changes

- [#248](https://github.com/ota-meshi/toml-eslint-parser/pull/248) [`08b356b`](https://github.com/ota-meshi/toml-eslint-parser/commit/08b356b2db32ba65111e00f4673b8ed9068ec6ca) Thanks [@ota-meshi](https://github.com/ota-meshi)! - fix: issue where a trailing dot in a table key would not cause a parsing error.

## 0.10.1

### Patch Changes

- [#240](https://github.com/ota-meshi/toml-eslint-parser/pull/240) [`ba5e00d`](https://github.com/ota-meshi/toml-eslint-parser/commit/ba5e00d2ae6bbe32852d5ce9da92b7d12fc60243) Thanks [@ota-meshi](https://github.com/ota-meshi)! - use npm trusted publishing

## 0.10.0

### Minor Changes

- [#207](https://github.com/ota-meshi/toml-eslint-parser/pull/207) [`7104688`](https://github.com/ota-meshi/toml-eslint-parser/commit/71046888069507d66a9337f2b31cd9a149edc17a) Thanks [@ota-meshi](https://github.com/ota-meshi)! - improve performance

## 0.9.3

### Patch Changes

- [#182](https://github.com/ota-meshi/toml-eslint-parser/pull/182) [`4cab5da`](https://github.com/ota-meshi/toml-eslint-parser/commit/4cab5da39eb94c7d0a13c1a9b18e81c6d1d15d83) Thanks [@ota-meshi](https://github.com/ota-meshi)! - fix: parsing error in EOF after 4 quotes

## 0.9.2

### Patch Changes

- [#178](https://github.com/ota-meshi/toml-eslint-parser/pull/178) [`397c6c6`](https://github.com/ota-meshi/toml-eslint-parser/commit/397c6c6e0eada05376d4f16d23c46e1d798e7460) Thanks [@ota-meshi](https://github.com/ota-meshi)! - fix: to allow year 0000

## 0.9.1

### Patch Changes

- [#175](https://github.com/ota-meshi/toml-eslint-parser/pull/175) [`5dae3ea`](https://github.com/ota-meshi/toml-eslint-parser/commit/5dae3eaac55fbb5b1598fd3234913d6534cf69eb) Thanks [@ota-meshi](https://github.com/ota-meshi)! - improve performance

## 0.9.0

### Minor Changes

- [#169](https://github.com/ota-meshi/toml-eslint-parser/pull/169) [`89c7596`](https://github.com/ota-meshi/toml-eslint-parser/commit/89c7596e918b421c3ed55147d523d5308e81024d) Thanks [@ota-meshi](https://github.com/ota-meshi)! - refactor for getStaticTOMLValue

### Patch Changes

- [#169](https://github.com/ota-meshi/toml-eslint-parser/pull/169) [`89c7596`](https://github.com/ota-meshi/toml-eslint-parser/commit/89c7596e918b421c3ed55147d523d5308e81024d) Thanks [@ota-meshi](https://github.com/ota-meshi)! - fix: wrong value of `bigint` in binary `TOMLIntegerValue`

## 0.8.1

### Patch Changes

- [#166](https://github.com/ota-meshi/toml-eslint-parser/pull/166) [`45d909e`](https://github.com/ota-meshi/toml-eslint-parser/commit/45d909e92f1111d7f6ce78803edf00a20b0670a6) Thanks [@ota-meshi](https://github.com/ota-meshi)! - improve performance

## 0.8.0

### Minor Changes

- [#165](https://github.com/ota-meshi/toml-eslint-parser/pull/165) [`475b9c5`](https://github.com/ota-meshi/toml-eslint-parser/commit/475b9c55bf6883183fe828e3e705476d90780735) Thanks [@ota-meshi](https://github.com/ota-meshi)! - improve performance

- [#163](https://github.com/ota-meshi/toml-eslint-parser/pull/163) [`e0f8378`](https://github.com/ota-meshi/toml-eslint-parser/commit/e0f83783d946d19d5ac39e49ab1b47e738412f27) Thanks [@ota-meshi](https://github.com/ota-meshi)! - feat: experimental support for TOML v1.1

## 0.7.0

### Minor Changes

- [#160](https://github.com/ota-meshi/toml-eslint-parser/pull/160) [`4dcf97e`](https://github.com/ota-meshi/toml-eslint-parser/commit/4dcf97e8e0917cb9383253a37532f2aee51c3386) Thanks [@ota-meshi](https://github.com/ota-meshi)! - BREAKING! fix: values of local-datetime, local-date, and local-time to be local datetime

## 0.6.1

### Patch Changes

- [#158](https://github.com/ota-meshi/toml-eslint-parser/pull/158) [`9ab2791`](https://github.com/ota-meshi/toml-eslint-parser/commit/9ab27919806d7c044b637d84acaa8d99c64cbb28) Thanks [@ota-meshi](https://github.com/ota-meshi)! - fix: wrong values for floats and datetimes.

## 0.6.0

### Minor Changes

- [#137](https://github.com/ota-meshi/toml-eslint-parser/pull/137) [`55b0be8`](https://github.com/ota-meshi/toml-eslint-parser/commit/55b0be8d4b0ff38b8e5d74f14d527ed4acd2801b) Thanks [@ota-meshi](https://github.com/ota-meshi)! - feat: export meta object
