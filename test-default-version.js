const { parseTOML } = require("./lib/index");
const { getTOMLVer } = require("./lib/parser-options");

// Test 1: Parse without tomlVersion option (should use default)
const codeWithNewlineEscape = 'key = "line1\\nline2"';
try {
  const ast1 = parseTOML(codeWithNewlineEscape);
  console.log("Test 1 - Parse without tomlVersion: SUCCESS");
  console.log("AST type:", ast1.type);
} catch (e) {
  console.log("Test 1 - Parse without tomlVersion: FAILED");
  console.log("Error:", e.message);
}

// Test 2: Parse with tomlVersion 1.0
try {
  const ast2 = parseTOML(codeWithNewlineEscape, { tomlVersion: "1.0" });
  console.log("\nTest 2 - Parse with tomlVersion 1.0: SUCCESS");
} catch (e) {
  console.log("\nTest 2 - Parse with tomlVersion 1.0: FAILED");
  console.log("Error:", e.message);
}

// Test 3: Parse with tomlVersion 1.1
try {
  const ast3 = parseTOML(codeWithNewlineEscape, { tomlVersion: "1.1" });
  console.log("\nTest 3 - Parse with tomlVersion 1.1: SUCCESS");
} catch (e) {
  console.log("\nTest 3 - Parse with tomlVersion 1.1: FAILED");
  console.log("Error:", e.message);
}

// Test 4: Check getTOMLVer with undefined
const defaultVer = getTOMLVer(undefined);
console.log("\nTest 4 - Default version check:");
console.log("Is default >= 1.1?", defaultVer.gte(1, 1));
console.log("Is default < 1.1?", defaultVer.lt(1, 1));
