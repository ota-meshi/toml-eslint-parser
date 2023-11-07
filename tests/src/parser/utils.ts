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
    for (const d of recursiveReaddirSync(rootDir.in)) {
      if (!d.name.endsWith(".toml")) {
        continue;
      }
      const inputFileName = path.join(d.path, d.name);
      const filename = inputFileName.slice(rootDir.in.length + 1);
      const outputDir = path.join(
        rootDir.out,
        path.relative(rootDir.in, d.path),
      );
      const outputFileName = path.join(
        outputDir,
        d.name.replace(/\.toml$/u, "-output.json"),
      );
      const valueFileName = path.join(
        outputDir,
        d.name.replace(/\.toml$/u, "-value.json"),
      );

      const isTOML11OnlySpec = [
        // Spec for TOML 1.1
        "string/hex-escape.toml",
        "string/escape-esc.toml",
        "key/unicode.toml",
        "inline-table/newline.toml",
        "datetime/no-seconds.toml",
      ].includes(filename);

      const hasCR = [
        "control/bare-cr.toml",
        "control/multi-cr.toml",
        "control/rawmulti-cd.toml",
      ].includes(filename);

      let specAssertion: SpecAssertion | undefined;

      const schemaFileName = inputFileName.replace(/\.toml$/u, ".json");
      if (
        fs.existsSync(schemaFileName) &&
        // ignores
        !isTOML11OnlySpec &&
        !hasCR
      ) {
        const schema = JSON.parse(fs.readFileSync(schemaFileName, "utf8"));
        const expected = schemaToJson(schema);

        specAssertion = (value) => {
          assert.deepStrictEqual(value, expected);
        };
      }

      const invalid = (rootDir.invalid && !hasCR) || isTOML11OnlySpec;

      yield {
        filename,
        inputFileName,
        outputFileName,
        valueFileName,
        specAssertion,
        valid: !invalid,
        invalid,
      };
    }
  }
}

function* recursiveReaddirSync(root: string): Iterable<{
  path: string;
  name: string;
}> {
  for (const dirent of fs.readdirSync(root, { withFileTypes: true })) {
    if (dirent.isFile()) {
      yield {
        path: root,
        name: dirent.name,
      };
    } else if (dirent.isDirectory()) {
      yield* recursiveReaddirSync(path.join(root, dirent.name));
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
  return replaceJSON(
    schema,
    // eslint-disable-next-line complexity -- ignore
    (_key, value) => {
      if (value && typeof value === "object") {
        const keys = Object.keys(value);
        if (
          keys.length === 2 &&
          keys.includes("type") &&
          keys.includes("value")
        ) {
          if (value.type === "integer") {
            return Number(value.value);
          }
          if (value.type === "float") {
            if (value.value === "+inf" || value.value === "inf") {
              return Infinity;
            }
            if (value.value === "-inf") {
              return -Infinity;
            }
            if (
              value.value === "nan" ||
              value.value === "+nan" ||
              value.value === "-nan"
            ) {
              return NaN;
            }
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
            value.type === "date" ||
            value.type === "date-local"
          ) {
            return new Date(value.value);
          }
          if (value.type === "time" || value.type === "time-local") {
            return new Date(`0000-01-01T${value.value}Z`);
          }

          return value.value;
        }
      }

      return value;
    },
  );
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
