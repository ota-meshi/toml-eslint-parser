import Benchmark from "benchmark";
import fs from "fs";
import { parseForESLint } from "../lib/index.mjs";
import {
  parseForESLint as parseOld,
  meta as oldMeta,
} from "../node_modules/toml-eslint-parser/lib/index.mjs";
import { parse as parseByIarna } from "@iarna/toml";
import { listUpFixtures } from "../tests/src/parser/utils";
const { version: oldV } = oldMeta;

const files: string[] = [];
let targetLength = 100;
let content = "";
for (const fixture of listUpFixtures()) {
  const k = fixture.filename.replace(/\//gu, "_");
  const appended = `${content}[${k}]
foo-bar = "baz"
${fs
  .readFileSync(fixture.inputFileName, "utf-8")
  .replace(/^(\s*\[\[?)/gmu, `$1${k}.`)
  .replace(/\r/gu, "\n")}
`;
  try {
    parseByIarna(appended);
    parseForESLint(appended);
    parseOld(appended);
  } catch {
    continue;
  }
  content = appended;
  if (content.length >= targetLength) {
    files.push(content);
    console.log(`Generated File Length: ${content.length}`);
    content = "";
    targetLength = Math.max(targetLength * 10, 50000);
  }
}
files.push(content);
console.log(`Generated File Length: ${content.length}`);
console.log(`Generated ${files.length} files`);

type Result = { name: string; hz: number };
const results: Result[] = [];

function format(hz: number): string {
  return (~~(hz * 100) / 100).toString().padEnd(4, " ").padStart(6, " ");
}

function onCycle(event: { target: Result }): void {
  const { name, hz } = event.target;
  results.push({ name, hz });

  console.log(event.target.toString());
}

function onComplete(): void {
  console.log("-".repeat(72));
  const map: Record<string, number[]> = {};
  for (const result of results) {
    const r = (map[result.name.slice(2)] ??= []);
    r.push(result.hz);
  }
  for (const name of Object.keys(map)) {
    console.log(
      `${name.padEnd(15)} ${format(
        map[name].reduce((p, a) => p + a, 0) / map[name].length,
      )} ops/sec`,
    );
  }
  for (let i = 0; i < results.length; ++i) {
    const result = results[i];

    console.log(`${result.name.padEnd(15)} ${format(result.hz)} ops/sec`);
  }
}

console.log("Benchmarking...");
console.log("Old toml-eslint-parser version:", oldV);

const suite = new Benchmark.Suite("benchmark", { onCycle, onComplete });

for (const no of [1, 2, 3]) {
  suite.add(`${no} new   toml-eslint-parser`, function () {
    files.forEach((c) => {
      parseForESLint(c, {});
    });
  });
  suite.add(`${no} old   toml-eslint-parser`, function () {
    files.forEach((c) => {
      parseOld(c, {});
    });
  });
  suite.add(`${no}       @iarna/toml       `, function () {
    files.forEach((c) => {
      parseByIarna(c);
    });
  });
}

suite.run();
