import { existsSync, readFileSync } from "fs";

import { parse } from "ini";

const validFlags = [
  "sig",
  "workspace-resolve",
  "dev-mod",
  "scripts",
  "quiet",
  "files",
];

const fileName = ".knitrc";

const readFile = (): Record<string, string | boolean> | null => {
  if (existsSync(fileName)) {
    return parse(readFileSync(fileName, "utf-8"));
  }
  return null;
};

export const readRcConfig = (): Record<string, string | boolean> => {
  const rcOptions = readFile();
  if (!rcOptions) return {};

  const unknown = Object.keys(rcOptions).filter(
    (key) => !validFlags.includes(key),
  );

  if (unknown.length) {
    console.warn(`Unknown option in ${fileName}: ${unknown[0]}`);
    process.exit();
  }
  return Object.keys(rcOptions).reduce((prev, flag) => {
    return validFlags.includes(flag)
      ? { ...prev, [flag]: rcOptions[flag] }
      : prev;
  }, {});
};
