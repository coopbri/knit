import { join } from "path";

import detectIndent from "detect-indent";
import { readFileSync, writeFileSync } from "fs-extra";

import type { PackageName } from "./installations";

export type PackageScripts = Partial<{
  preinstall: string;
  prepack: string;
  postpack: string;
  prepare: string;
  install: string;
  prepublish: string;
  prepublishOnly: string;
  publish: string;
  postpublish: string;
  preknitpublish: string;
  preknit: string;
  postknitpublish: string;
  postknit: string;
}>;

export interface PackageManifest {
  name: string;
  version: string;
  knitSig?: string;
  private?: boolean;
  bin?: string | { [name: string]: string };
  dependencies?: { [name: string]: string };
  devDependencies?: { [name: string]: string };
  peerDependencies?: { [name: string]: string };
  knit: Partial<{
    sig: boolean;
    signature: boolean;
    noSig: boolean;
  }>;
  workspaces?: string[];
  scripts?: PackageScripts;
  __Indent?: string;
}

export const parsePackageName = (packageName: string) => {
  const match = packageName.match(/(^@[^/]+\/)?([^@]+)@?(.*)/) || [];
  if (!match) {
    return { name: "" as PackageName, version: "" };
  }
  return {
    name: ((match[1] || "") + match[2]) as PackageName,
    version: match[3] || "",
  };
};

const getIndent = (jsonStr: string) => {
  return detectIndent(jsonStr).indent;
};

export const readPackageManifest = (workingDir: string) => {
  let pkg: PackageManifest;
  const packagePath = join(workingDir, "package.json");
  try {
    const fileData = readFileSync(packagePath, "utf-8");
    pkg = JSON.parse(fileData) as PackageManifest;
    if (!pkg.name && pkg.version) {
      console.log(
        "Package manifest",
        packagePath,
        "should contain name and version.",
      );
      return null;
    }
    const indent = getIndent(fileData) || "  ";
    pkg.__Indent = indent;
    return pkg;
  } catch (e) {
    console.error("Could not read", packagePath);
    return null;
  }
};

const sortDependencies = (dependencies: { [name: string]: string }) => {
  return Object.keys(dependencies)
    .sort()
    .reduce(
      (deps, key) => Object.assign(deps, { [key]: dependencies[key] }),
      {},
    );
};

export const writePackageManifest = (
  workingDir: string,
  pkg: PackageManifest,
) => {
  pkg = Object.assign({}, pkg);
  if (pkg.dependencies) {
    pkg.dependencies = sortDependencies(pkg.dependencies);
  }
  if (pkg.devDependencies) {
    pkg.devDependencies = sortDependencies(pkg.devDependencies);
  }
  const indent = pkg.__Indent;
  delete pkg.__Indent;
  const packagePath = join(workingDir, "package.json");
  try {
    writeFileSync(packagePath, JSON.stringify(pkg, null, indent) + "\n");
  } catch (e) {
    console.error("Could not write ", packagePath);
  }
};
