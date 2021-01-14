# toml-eslint-parser

A TOML parser that produces output [compatible with ESLint](https://eslint.org/docs/developer-guide/working-with-custom-parsers#all-nodes).

[![NPM license](https://img.shields.io/npm/l/toml-eslint-parser.svg)](https://www.npmjs.com/package/toml-eslint-parser)
[![NPM version](https://img.shields.io/npm/v/toml-eslint-parser.svg)](https://www.npmjs.com/package/toml-eslint-parser)
[![NPM downloads](https://img.shields.io/badge/dynamic/json.svg?label=downloads&colorB=green&suffix=/day&query=$.downloads&uri=https://api.npmjs.org//downloads/point/last-day/toml-eslint-parser&maxAge=3600)](http://www.npmtrends.com/toml-eslint-parser)
[![NPM downloads](https://img.shields.io/npm/dw/toml-eslint-parser.svg)](http://www.npmtrends.com/toml-eslint-parser)
[![NPM downloads](https://img.shields.io/npm/dm/toml-eslint-parser.svg)](http://www.npmtrends.com/toml-eslint-parser)
[![NPM downloads](https://img.shields.io/npm/dy/toml-eslint-parser.svg)](http://www.npmtrends.com/toml-eslint-parser)
[![NPM downloads](https://img.shields.io/npm/dt/toml-eslint-parser.svg)](http://www.npmtrends.com/toml-eslint-parser)
[![Build Status](https://github.com/ota-meshi/toml-eslint-parser/workflows/CI/badge.svg?branch=master)](https://github.com/ota-meshi/toml-eslint-parser/actions?query=workflow%3ACI)

## Features

- Converts TOML text to AST.
- Support for [TOML 1.0.0](https://toml.io/en/v1.0.0)

## Installation

```bash
npm install --save-dev toml-eslint-parser
```

## Usage

### Configuration

Use `.eslintrc.*` file to configure parser. See also: [https://eslint.org/docs/user-guide/configuring](https://eslint.org/docs/user-guide/configuring).

Example **.eslintrc.js**:

```js
module.exports = {
    "overrides": [
        {
            "files": ["*.toml"],
            "parser": "toml-eslint-parser"
        }
    ]
}
```

## Usage for Custom Rules / Plugins

- [AST.md](./docs/AST.md) is AST specification.
<!-- - [block-mapping.ts](https://github.com/ota-meshi/eslint-plugin-yml/blob/master/src/rules/block-mapping.ts) is an example. -->
- You can see the AST on the [Online DEMO](https://ota-meshi.github.io/toml-eslint-parser/).
