// eslint-disable-next-line eslint-comments/disable-enable-pair -- ignore
/* eslint-disable require-jsdoc, no-console -- ignore */
import * as Benchmark from "benchmark";
import fs from "fs";
import { parseForESLint } from "..";
import { parseForESLint as parseOld } from "../node_modules/toml-eslint-parser";
import { version as oldV } from "../node_modules/toml-eslint-parser/package.json";
import { parse as parseByIarna } from "@iarna/toml";
import { listUpFixtures } from "../tests/src/parser/utils";

const files10k = [...listUpFixtures()]
  .filter((fixture) => {
    return fs.statSync(fixture.inputFileName).size > 10000;
  })
  .map((fixture) => {
    return `${fs.readFileSync(fixture.inputFileName, "utf-8")}`;
  });

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

for (const no of [1, 2, 3, 4, 5]) {
  suite.add(`${no} new   toml-eslint-parser`, function () {
    files10k.forEach((content) => {
      parseForESLint(content, {});
    });
  });
  suite.add(`${no} old   toml-eslint-parser`, function () {
    files10k.forEach((content) => {
      parseOld(content, {});
    });
  });
  suite.add(`${no}       @iarna/toml       `, function () {
    files10k.forEach((content) => {
      parseByIarna(content);
    });
  });
}

suite.run();
