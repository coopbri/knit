import { execSync } from "child_process";
import { join } from "path";

import { existsSync } from "fs-extra";

import { execLoudOptions } from ".";
import app from "lib/config/app";

type PackageManager = "yarn" | "npm" | "pnpm";

export const pmMarkFiles: { [P in PackageManager]: string[] } = {
  pnpm: ["pnpm-lock.yaml"],
  yarn: ["yarn.lock"],
  npm: ["package-lock.json"],
};

export const pmInstallCmd: { [P in PackageManager]: string } = {
  pnpm: "pnpm install",
  yarn: "yarn",
  npm: "npm install",
};

export const pmUpdateCmd: { [P in PackageManager]: string } = {
  pnpm: "pnpm update",
  yarn: "yarn upgrade",
  npm: "npm update",
};

export const pmRunScriptCmd: { [P in PackageManager]: string } = {
  pnpm: "pnpm",
  yarn: "yarn",
  npm: "npm run",
};

const defaultPm = "npm";

export const getPackageManager = (cwd: string): PackageManager => {
  const pms = Object.keys(pmMarkFiles) as PackageManager[];
  return (
    pms.reduce<PackageManager | false>((found, pm) => {
      return (
        found ||
        (pmMarkFiles[pm].reduce<PackageManager | false>(
          (found, file) => found || (existsSync(join(cwd, file)) && pm),
          false,
        ) &&
          pm)
      );
    }, false) || defaultPm
  );
};

export const getRunScriptCmd = (cwd: string) =>
  pmInstallCmd[getPackageManager(cwd)];

export const getPackageManagerInstallCmd = (cwd: string) =>
  pmInstallCmd[getPackageManager(cwd)];

export const getPackageManagerUpdateCmd = (cwd: string) =>
  pmUpdateCmd[getPackageManager(cwd)];

export const isYarn = (cwd: string) => getPackageManager(cwd) === "yarn";

export const runPmUpdate = (workingDir: string, packages: string[]) => {
  const pkgMgrCmd = [getPackageManagerUpdateCmd(workingDir), ...packages].join(
    " ",
  );

  console.log(`${app.commandPrefix} Running ${pkgMgrCmd} in ${workingDir}...`);
  execSync(pkgMgrCmd, { cwd: workingDir, ...execLoudOptions });
};
