import fs from "fs";
import path from "path";
import assert from "assert";
import { load as loadYaml } from "js-yaml";

/**
 * Remove `parent` properties from the given AST.
 */
function replacer(key: string, value: any) {
  if (key === "parent" || key === "bigint") {
    return undefined;
  }
  if (value instanceof RegExp) {
    return String(value);
  }
  if (typeof value === "bigint") {
    return null; // Make it null so it can be checked on node8.
    // return `${String(value)}n`
  }
  if (typeof value === "number") {
    if (!isFinite(value)) {
      return `# ${String(value)} #`;
    }
  }
  if (key === "date" && /^\d{4}-\d{2}-\d{2}T/u.test(value)) {
    // Backward compatibility
    return undefined;
  }
  return value;
}

/**
 * Replacer for NaN and infinity
 */
function valueReplacer(_key: string, value: any) {
  if (typeof value === "number") {
    if (!isFinite(value)) {
      return `# ${String(value)} #`;
    }
  }
  return value;
}

export function stringify(val: any, isAst?: boolean): string {
  let str = JSON.stringify(val, isAst ? replacer : valueReplacer, 2);
  if (str.length >= 100_000_000) {
    str = JSON.stringify(val, isAst ? replacer : valueReplacer);
  }
  return str;
}

type SpecAssertion = (value: any) => void;
export function* listUpFixtures(): Generator<{
  filename: string;
  inputFileName: string;
  outputFileName: string;
  valueFileName: string;
  specAssertion?: SpecAssertion;
  valid?: boolean;
  invalid?: boolean;
}> {
  yield* listUpParserFixtures();
  yield* listUpBurntSushiTestSpecsFixtures();
  yield* listUpIarnaTestSpecsFixtures();
}

function* listUpParserFixtures(): Generator<{
  filename: string;
  inputFileName: string;
  outputFileName: string;
  valueFileName: string;
}> {
  const AST_FIXTURE_ROOT = path.resolve(__dirname, "../../fixtures/parser/ast");
  for (const filename of fs
    .readdirSync(AST_FIXTURE_ROOT)
    .filter((f) => f.endsWith("input.toml"))) {
    const inputFileName = path.join(AST_FIXTURE_ROOT, filename);
    const outputFileName = inputFileName.replace(
      /input\.toml$/u,
      "output.json",
    );
    const valueFileName = inputFileName.replace(/input\.toml$/u, "value.json");

    yield {
      filename,
      inputFileName,
      outputFileName,
      valueFileName,
    };
  }
}

function* listUpBurntSushiTestSpecsFixtures(): Generator<{
  filename: string;
  inputFileName: string;
  outputFileName: string;
  valueFileName: string;
  specAssertion?: SpecAssertion;
  invalid?: boolean;
  valid?: boolean;
}> {
  const BURNTSUSHI_TESTS_ROOTS = [
    {
      in: path.resolve(
        __dirname,
        "../../fixtures/test-specs/BurntSushi-toml-test/tests/invalid",
      ),
      out: path.resolve(
        __dirname,
        "../../fixtures/test-specs/out/BurntSushi-toml-test/tests/invalid",
      ),
      invalid: true,
    },
    {
      in: path.resolve(
        __dirname,
        "../../fixtures/test-specs/BurntSushi-toml-test/tests/valid",
      ),
      out: path.resolve(
        __dirname,
        "../../fixtures/test-specs/out/BurntSushi-toml-test/tests/valid",
      ),
    },
  ];
  for (const rootDir of BURNTSUSHI_TESTS_ROOTS) {
    for (const filename of fs
      .readdirSync(rootDir.in)
      .filter((f) => f.endsWith(".toml"))) {
      const inputFileName = path.join(rootDir.in, filename);
      const outputFileName = path.join(
        rootDir.out,
        filename.replace(/\.toml$/u, "-output.json"),
      );
      const valueFileName = path.join(
        rootDir.out,
        filename.replace(/\.toml$/u, "-value.json"),
      );

      let specAssertion: SpecAssertion | undefined;

      const schemaFileName = inputFileName.replace(/\.toml$/u, ".json");
      if (
        fs.existsSync(schemaFileName) &&
        // ignores
        ![
          // A value that cannot be expressed in JS.
          "long-integer.toml",
          "string-bad-codepoint.toml",
        ].includes(filename)
      ) {
        const schema = JSON.parse(fs.readFileSync(schemaFileName, "utf8"));
        const expected = schemaToJson(schema);

        specAssertion = (value) => {
          assert.deepStrictEqual(value, expected);
        };
      }

      yield {
        filename,
        inputFileName,
        outputFileName,
        valueFileName,
        specAssertion,
        valid: !rootDir.invalid,
        invalid:
          rootDir.invalid &&
          ![
            // It is valid in TOML v1.0
            "array-mixed-types-arrays-and-ints.toml",
            "array-mixed-types-ints-and-floats.toml",
            "array-mixed-types-strings-and-ints.toml",
          ].includes(filename),
      };
    }
  }
}

function* listUpIarnaTestSpecsFixtures(): Generator<{
  filename: string;
  inputFileName: string;
  outputFileName: string;
  valueFileName: string;
  specAssertion?: SpecAssertion;
  invalid?: boolean;
  valid?: boolean;
}> {
  const IARNA_TESTS_ROOTS = [
    {
      in: path.resolve(
        __dirname,
        "../../fixtures/test-specs/iarna-toml-spec-tests/errors",
      ),
      out: path.resolve(
        __dirname,
        "../../fixtures/test-specs/out/iarna-toml-spec-tests/errors",
      ),
      invalid: true,
    },
    {
      in: path.resolve(
        __dirname,
        "../../fixtures/test-specs/iarna-toml-spec-tests/values",
      ),
      out: path.resolve(
        __dirname,
        "../../fixtures/test-specs/out/iarna-toml-spec-tests/values",
      ),
    },
  ];
  for (const rootDir of IARNA_TESTS_ROOTS) {
    for (const filename of fs
      .readdirSync(rootDir.in)
      .filter((f) => f.endsWith(".toml"))) {
      const inputFileName = path.join(rootDir.in, filename);
      const outputFileName = path.join(
        rootDir.out,
        filename.replace(/\.toml$/u, "-output.json"),
      );
      const valueFileName = path.join(
        rootDir.out,
        filename.replace(/\.toml$/u, "-value.json"),
      );

      let specAssertion: SpecAssertion | undefined;

      const schemaFileName = inputFileName.replace(/\.toml$/u, ".json");
      if (fs.existsSync(schemaFileName)) {
        const schema = JSON.parse(fs.readFileSync(schemaFileName, "utf8"));
        const expected = schemaToJson(schema);

        specAssertion = (value) => {
          assert.deepStrictEqual(value, expected);
        };
      } else {
        const expectedFileName = inputFileName.replace(/\.toml$/u, ".yaml");
        if (fs.existsSync(expectedFileName)) {
          const expected = loadYaml(fs.readFileSync(expectedFileName, "utf8"));
          specAssertion = (value) => {
            assert.deepStrictEqual(value, expected);
          };
        }
      }

      yield {
        filename,
        inputFileName,
        outputFileName,
        valueFileName,
        specAssertion,
        valid: !rootDir.invalid,
        invalid: rootDir.invalid,
      };
    }
  }
}

function schemaToJson(schema: any): any {
  return replaceJSON(schema, (_key, value) => {
    if (value && typeof value === "object") {
      const keys = Object.keys(value);
      if (
        keys.length === 2 &&
        keys.includes("type") &&
        keys.includes("value")
      ) {
        if (value.type === "integer" || value.type === "float") {
          return Number(value.value);
        }
        if (value.type === "bool") {
          return value.value === "true"
            ? true
            : value.value === "false"
            ? false
            : value.value;
        }
        if (
          value.type === "datetime" ||
          value.type === "datetime-local" ||
          value.type === "date"
        ) {
          return new Date(value.value);
        }
        if (value.type === "time") {
          return new Date(`0000-01-01T${value.value}Z`);
        }

        return value.value;
      }
    }

    return value;
  });
}

/** Replace values */
function replaceJSON(
  val: any,
  valReplacer: (keu: string, value: any) => any,
): any {
  if (typeof val !== "object") {
    return val;
  }
  if (val instanceof Date) {
    return val;
  }
  const result: any = Array.isArray(val) ? [] : {};

  for (const key in val) {
    const newValue = valReplacer(key, val[key]);
    result[key] = replaceJSON(newValue, valReplacer);
  }

  return result;
}
