import fs from "fs";
import path from "path";
import assert from "assert";
import { load as loadYaml } from "js-yaml";
import { toJSON } from "./to-json";

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
  try {
    const str = normalizeStr(
      JSON.stringify(val, isAst ? replacer : valueReplacer, 2),
    );
    if (str.length < 100_000_000) return str;
    return normalizeStr(toJSON(val, isAst ? replacer : valueReplacer));
  } catch {
    return normalizeStr(toJSON(val, isAst ? replacer : valueReplacer));
  }
}

function normalizeStr(s: string) {
  return s.replace(
    // eslint-disable-next-line no-control-regex -- ignore
    /[\x00-\x08\v\f\x0e-\x1f\x7f-\xa0\ud7a4-\ud7ff\u{d800}-\u{dfff}\ue000-\uefff\uf000-\uf8f8\uffef-\uffff\u{10fffe}\u{10ffff}]/gu,
    (c) => {
      const cp = c.codePointAt(0)!;
      const codes =
        cp <= 0xffff
          ? [cp]
          : [
              0xd800 | ((cp - 0x10000) >> 10),
              0xdc00 | ((cp - 0x10000) & 0x3ff),
            ];
      return codes
        .map((code) => `\\u${code.toString(16).padStart(4, "0")}`)
        .join("");
    },
  );
}

type SpecAssertion = (value: any) => void;
type Fixture = {
  filename: string;
  inputFileName: string;
  specAssertion?: SpecAssertion;
  v1: {
    outputFileName: string;
    valueFileName: string;
    valid?: boolean;
    invalid?: boolean;
  };
  "v1.1": {
    outputFileName: string;
    valueFileName: string;
    valid?: boolean;
    invalid?: boolean;
  };
};
export function* listUpFixtures(): Generator<Fixture> {
  yield* listUpParserFixtures();
  yield* listUpBurntSushiTestSpecsFixtures();
  yield* listUpIarnaTestSpecsFixtures();
}

function* listUpParserFixtures(): Generator<Fixture> {
  const AST_FIXTURE_ROOT = path.resolve(__dirname, "../../fixtures/parser/ast");
  for (const filename of fs
    .readdirSync(AST_FIXTURE_ROOT)
    .filter((f) => f.endsWith("input.toml"))) {
    const inputFileName = path.join(AST_FIXTURE_ROOT, filename);

    yield {
      filename,
      inputFileName,
      v1: getOutputs(inputFileName, {
        in: AST_FIXTURE_ROOT,
        out: AST_FIXTURE_ROOT,
        suffix: "_for_v1.0",
      }),
      "v1.1": getOutputs(inputFileName, {
        in: AST_FIXTURE_ROOT,
        out: AST_FIXTURE_ROOT,
      }),
    };
  }
}

// eslint-disable-next-line complexity -- OK
function* listUpBurntSushiTestSpecsFixtures(): Generator<Fixture> {
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
      valid: true,
    },
  ];

  const testFilesForV1P0 = fs
    .readFileSync(
      path.resolve(
        __dirname,
        "../../fixtures/test-specs/BurntSushi-toml-test/tests/files-toml-1.0.0",
      ),
      "utf8",
    )
    .split("\n");
  const testFilesForV1P1 = fs
    .readFileSync(
      path.resolve(
        __dirname,
        "../../fixtures/test-specs/BurntSushi-toml-test/tests/files-toml-1.1.0",
      ),
      "utf8",
    )
    .split("\n");

  for (const rootDir of BURNTSUSHI_TESTS_ROOTS) {
    for (const d of recursiveReaddirSync(rootDir.in)) {
      if (!d.name.endsWith(".toml")) {
        continue;
      }
      const inputFileName = path.join(d.path, d.name);
      const filename = inputFileName.slice(rootDir.in.length + 1);
      const testFilename = `${rootDir.valid ? "valid" : "invalid"}/${filename}`;

      const isTOML1P0Spec = testFilesForV1P0.includes(testFilename);
      const isTOML1P1Spec = testFilesForV1P1.includes(testFilename);

      const hasCR = [
        "control/bare-cr.toml",
        "control/multi-cr.toml",
        "control/rawmulti-cr.toml",
      ].includes(filename);

      const validInTOML1P0 =
        // Valid spec for TOML 1.0
        (rootDir.valid && isTOML1P0Spec) ||
        // Invalid spec for TOML 1.0 but has CR (This parser specially allows CR)
        (!rootDir.valid && isTOML1P0Spec && hasCR) ||
        // Spec for TOML 1.1 but valid in TOML 1.0
        (rootDir.valid &&
          !isTOML1P0Spec &&
          [
            "spec-1.1.0/common-0.toml",
            "spec-1.1.0/common-1.toml",
            "spec-1.1.0/common-3.toml",
            "spec-1.1.0/common-4.toml",
            "spec-1.1.0/common-6.toml",
            "spec-1.1.0/common-7.toml",
            "spec-1.1.0/common-8.toml",
            "spec-1.1.0/common-9.toml",
            "spec-1.1.0/common-10.toml",
            "spec-1.1.0/common-11.toml",
            "spec-1.1.0/common-13.toml",
            "spec-1.1.0/common-14.toml",
            "spec-1.1.0/common-15.toml",
            "spec-1.1.0/common-16.toml",
            "spec-1.1.0/common-17.toml",
            "spec-1.1.0/common-18.toml",
            "spec-1.1.0/common-19.toml",
            "spec-1.1.0/common-20.toml",
            "spec-1.1.0/common-21.toml",
            "spec-1.1.0/common-22.toml",
            "spec-1.1.0/common-23.toml",
            "spec-1.1.0/common-24.toml",
            "spec-1.1.0/common-25.toml",
            "spec-1.1.0/common-26.toml",
            "spec-1.1.0/common-27.toml",
            "spec-1.1.0/common-28.toml",
            "spec-1.1.0/common-30.toml",
            "spec-1.1.0/common-32.toml",
            "spec-1.1.0/common-33.toml",
            "spec-1.1.0/common-35.toml",
            "spec-1.1.0/common-36.toml",
            "spec-1.1.0/common-37.toml",
            "spec-1.1.0/common-38.toml",
            "spec-1.1.0/common-39.toml",
            "spec-1.1.0/common-40.toml",
            "spec-1.1.0/common-41.toml",
            "spec-1.1.0/common-42.toml",
            "spec-1.1.0/common-43.toml",
            "spec-1.1.0/common-44.toml",
            "spec-1.1.0/common-45.toml",
            "spec-1.1.0/common-46.toml",
            "spec-1.1.0/common-48.toml",
            "spec-1.1.0/common-49.toml",
            "spec-1.1.0/common-50.toml",
            "spec-1.1.0/common-51.toml",
            "spec-1.1.0/common-52.toml",
            "spec-1.1.0/common-53.toml",
          ].includes(filename)) ||
        // Invalid spec for TOML 1.1 but has CR (This parser specially allows CR)
        (!rootDir.valid &&
          !isTOML1P0Spec &&
          ["control/multi-cr.toml", "control/rawmulti-cr.toml"].includes(
            filename,
          ));

      const validInTOML1P1 =
        // Valid spec for TOML 1.1
        (rootDir.valid && isTOML1P1Spec) ||
        // Invalid spec for TOML 1.1 but has CR
        (!rootDir.valid && isTOML1P1Spec && hasCR) ||
        // Valid spec for TOML 1.0 but also valid in TOML 1.1
        validInTOML1P0 ||
        // Invalid spec for TOML 1.0 but valid in TOML 1.1
        (!rootDir.valid &&
          !isTOML1P1Spec &&
          [
            "datetime/no-secs.toml",
            "local-datetime/no-secs.toml",
            "local-time/no-secs.toml",
            "string/basic-byte-escapes.toml",
            "inline-table/linebreak-01.toml",
            "inline-table/linebreak-02.toml",
            "inline-table/linebreak-03.toml",
            "inline-table/linebreak-04.toml",
            "inline-table/trailing-comma.toml",
          ].includes(filename));

      let specAssertion: SpecAssertion | undefined;

      const schemaFileName = inputFileName.replace(/\.toml$/u, ".json");
      if (
        fs.existsSync(schemaFileName) &&
        // ignores
        !hasCR
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
        specAssertion,
        v1: {
          ...getOutputs(inputFileName, { ...rootDir, suffix: "_for_v1.0" }),
          valid: validInTOML1P0,
          invalid: !validInTOML1P0,
        },
        "v1.1": {
          ...getOutputs(inputFileName, { ...rootDir, suffix: "" }),
          valid: validInTOML1P1,
          invalid: !validInTOML1P1,
        },
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

function* listUpIarnaTestSpecsFixtures(): Generator<Fixture> {
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

      const validInTOML1P1 =
        rootDir.invalid &&
        ["inline-table-trailing-comma.toml"].includes(filename);
      const invalidForV1P1 = rootDir.invalid && !validInTOML1P1;

      yield {
        filename,
        inputFileName,
        specAssertion,
        v1: {
          ...getOutputs(inputFileName, { ...rootDir, suffix: "_for_v1.0" }),
          valid: !rootDir.invalid,
          invalid: rootDir.invalid,
        },
        "v1.1": {
          ...getOutputs(inputFileName, { ...rootDir, suffix: "" }),
          valid: !invalidForV1P1,
          invalid: invalidForV1P1,
        },
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
          if (value.type === "datetime" || value.type === "datetime-local") {
            return new Date(value.value);
          }
          if (value.type === "date-local" || value.type === "date") {
            return new Date(`${value.value}T00:00:00`);
          }
          if (value.type === "time-local" || value.type === "time") {
            return new Date(`0000-01-01T${value.value}`);
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

function getOutputs(
  inputFileName: string,
  options: { suffix?: "" | "_for_v1.0"; in: string; out: string },
) {
  const base = inputFileName.replace(options.in, options.out);
  const suffix = options.suffix || "";
  if (base.endsWith("input.toml")) {
    const outputFileName = base.replace(
      /input\.toml$/u,
      `output${suffix}.json`,
    );
    const valueFileName = base.replace(/input\.toml$/u, `value${suffix}.json`);
    return { outputFileName, valueFileName };
  }
  const outputFileName = base.replace(/\.toml$/u, `-output${suffix}.json`);
  const valueFileName = base.replace(/\.toml$/u, `-value${suffix}.json`);
  return { outputFileName, valueFileName };
}
