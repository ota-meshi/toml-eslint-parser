type ObjectEntry = {
  entries: [string, unknown][];
  owner: object;
  elements: string[];
  pop: (s: string) => void;
};
export function toJSON(
  value: unknown,
  replacer: (key: string, value: any) => unknown,
): string {
  value = replacer("", value);
  if (!isPlainObject(value)) {
    return JSON.stringify(value, replacer);
  }
  let string = "";
  const stack: ObjectEntry[] = [
    {
      entries: Object.entries(value),
      owner: value,
      elements: [],
      pop: (s) => {
        string = s;
      },
    },
  ];
  while (stack.length > 0) {
    const entry = stack[0];
    if (entry.entries.length > 0) {
      const [key, entryValue] = entry.entries.shift()!;
      const newValue = replacer(key, entryValue);
      if (newValue === undefined) continue;
      processEntry(key, newValue, entry);
      continue;
    }
    entry.pop(entryToString(entry));
    stack.shift();
  }

  return string;

  function processEntry(k: string, v: unknown, entry: ObjectEntry) {
    if (!isPlainObject(v)) {
      const valueString = JSON.stringify(v, replacer);
      entry.elements.push(
        Array.isArray(entry.owner) ? valueString : `"${k}":${valueString}`,
      );
    } else {
      stack.unshift({
        entries: Object.entries(v),
        owner: v,
        elements: [],
        pop: (valueString) => {
          entry.elements.push(
            Array.isArray(entry.owner) ? valueString : `"${k}":${valueString}`,
          );
        },
      });
    }
  }
}

function entryToString(entry: ObjectEntry) {
  const content = entry.elements.join(",");
  return Array.isArray(entry.owner) ? `[${content}]` : `{${content}}`;
}

function isPlainObject(value: unknown): value is object {
  return typeof value === "object" && value != null && !(value instanceof Date);
}
