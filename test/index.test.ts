import { doesNotThrow, throws, deepEqual, ok, strictEqual } from "assert";
import { join } from "path";

import * as fs from "fs-extra";
import { accessSync, readFileSync, statSync } from "fs-extra";

import {
  addPackages,
  updatePackages,
  publishPackage,
  removePackages,
  knitGlobal,
  readPackageManifest,
} from "../src";
import { readInstallationsFile } from "../src/installations";
import { readLockfile } from "../src/lockfile";

import type { LockFileConfigV1 } from "../src/lockfile";

const values = {
  depPackage: "dep-package",
  depPackageVersion: "1.0.0",

  depPackage2: "dep-package2",
  depPackage2Version: "1.0.0",
  storeDir: "knit-store",
  project: "project",

  wksDepPkg: "ws-package",
  wksResolvedVersion: "1.1.1",

  wksDepQualified: "ws-package-qualified",
  wksPkgQualifiedVersion: "^1.0.0",

  wksDepMinorAlias: "ws-package-minor-alias",
  wksMinorAliasVersion: "^1.0.1",

  wksDepPatchAlias: "ws-package-patch-alias",
  wksPatchAliasVersion: "~1.2.3",

  wksUnresolvedPackage: "ws-package-unresolvable",
  wksUnresolvedMinorAlias: "ws-package-unresolvable-minor-alias",
  wksUnresolvedPatchAlias: "ws-package-unresolvable-patch-alias",
};

const fixtureDir = join(__dirname, "fixture");
const tmpDir = join(__dirname, "tmp");

const shortSignatureLength = 8;

const storeMainDr = join(tmpDir, values.storeDir);
knitGlobal.knitStoreMainDir = storeMainDr;

const depPackageDir = join(tmpDir, values.depPackage);
const depPackage2Dir = join(tmpDir, values.depPackage2);
const projectDir = join(tmpDir, values.project);

const publishedPackagePath = join(
  storeMainDr,
  "packages",
  values.depPackage,
  values.depPackageVersion,
);

const publishedPackage2Path = join(
  storeMainDr,
  "packages",
  values.depPackage2,
  values.depPackage2Version,
);

const checkExists = (path: string) =>
  doesNotThrow(() => accessSync(path), path + " does not exist");

const checkNotExists = (path: string) =>
  throws(() => accessSync(path), path + " exists");

const extractSignature = (lockfile: LockFileConfigV1, packageName: string) => {
  const packageEntry = lockfile.packages[packageName];
  if (packageEntry === undefined) {
    throw new Error(
      `expected package ${packageName} in lockfile.packages ${JSON.stringify(
        lockfile,
        undefined,
        2,
      )}`,
    );
  }

  const signature = packageEntry.signature;
  if (signature === undefined) {
    throw new Error(
      `expected signature property in lockfile.packages.${packageName} ${JSON.stringify(
        lockfile,
        undefined,
        2,
      )}`,
    );
  }

  return signature;
};

describe("Knit package manager", () => {
  beforeAll(() => {
    fs.removeSync(tmpDir);
    fs.copySync(fixtureDir, tmpDir);
  });
  describe("Package publish", () => {
    beforeAll(() => {
      console.time("Package publish");
      return publishPackage({
        workingDir: depPackageDir,
        signature: true,
        workspaceResolve: true,
      }).then(() => {
        console.timeEnd("Package publish");
      });
    });

    it("publishes package to store", () => {
      checkExists(publishedPackagePath);
    });

    it("copies package.json npm includes", () => {
      checkExists(join(publishedPackagePath, "package.json"));
    });

    it("ignores standard non-code", () => {
      checkNotExists(join(publishedPackagePath, "extra-file.txt"));
    });

    it("ignores .gitignore", () => {
      checkNotExists(join(publishedPackagePath, ".gitignore"));
    });

    it('handles "files:" manifest entry correctly', () => {
      checkExists(join(publishedPackagePath, ".knit/knit.txt"));
      checkExists(join(publishedPackagePath, ".dot/dot.txt"));
      checkExists(join(publishedPackagePath, "src"));
      checkExists(join(publishedPackagePath, "dist/file.txt"));
      checkExists(join(publishedPackagePath, "root-file.txt"));
      checkExists(join(publishedPackagePath, "folder/file.txt"));
      checkNotExists(join(publishedPackagePath, "folder/file2.txt"));
      checkExists(join(publishedPackagePath, "folder2/nested/file.txt"));
      checkNotExists(join(publishedPackagePath, "folder2/file.txt"));
      checkNotExists(join(publishedPackagePath, "folder2/nested/file2.txt"));
      checkNotExists(join(publishedPackagePath, "test"));
    });

    it('does not respect .npmignore, if package.json "files" present', () => {
      checkExists(join(publishedPackagePath, "src", "file-npm-ignored.txt"));
    });

    it("creates signature file", () => {
      const sigFileName = join(publishedPackagePath, "knit.sig");
      checkExists(sigFileName);
      ok(statSync(sigFileName).size === 32, "signature file size");
    });

    it("Adds signature to package.json version", () => {
      const pkg = readPackageManifest(publishedPackagePath)!;
      const versionLength =
        values.depPackageVersion.length + shortSignatureLength + 1;
      ok(pkg.version.length === versionLength);
    });

    it("does not respect .gitignore, if .npmignore presents", () => {});

    describe("signature consistency", () => {
      let expectedSignature: string;
      beforeAll(() => {
        expectedSignature = readFileSync(
          join(publishedPackagePath, "knit.sig"),
        ).toString();
      });

      beforeEach(() => {
        return publishPackage({
          workingDir: depPackageDir,
          signature: true,
          workspaceResolve: true,
        });
      });

      for (let tries = 1; tries <= 5; tries++) {
        it(`should have a consistent signature after every publish (attempt ${tries})`, () => {
          const sigFileName = join(publishedPackagePath, "knit.sig");
          const signature = readFileSync(sigFileName).toString();

          deepEqual(signature, expectedSignature);
        });
      }
    });

    it('resolves "workspace:*" for dependencies', () => {
      const pkg = readPackageManifest(publishedPackagePath);
      ok(pkg?.dependencies);

      const publishedVersion = pkg?.dependencies?.[values.wksDepPkg];

      strictEqual(publishedVersion, values.wksResolvedVersion);
    });

    it('resolves "workspace:^" for dependencies', () => {
      const pkg = readPackageManifest(publishedPackagePath);
      ok(pkg?.dependencies);

      const publishedVersion = pkg?.dependencies?.[values.wksDepMinorAlias];

      strictEqual(publishedVersion, values.wksMinorAliasVersion);
    });

    it('resolves "workspace:~" for dependencies', () => {
      const pkg = readPackageManifest(publishedPackagePath);
      ok(pkg?.dependencies);

      const publishedVersion = pkg?.dependencies?.[values.wksDepPatchAlias];

      strictEqual(publishedVersion, values.wksPatchAliasVersion);
    });

    it('substitutes workspace version aliases ("*", "^", "~") with "*" if unresolvable', () => {
      const pkg = readPackageManifest(publishedPackagePath);
      ok(pkg);
      ok(pkg?.dependencies);

      const publishedVersion = pkg?.dependencies?.[values.wksUnresolvedPackage];
      strictEqual(publishedVersion, "*");

      const publishedMinorAliasVersion =
        pkg?.dependencies?.[values.wksUnresolvedMinorAlias];
      strictEqual(publishedMinorAliasVersion, "*");

      const publishedPatchAliasVersion =
        pkg?.dependencies?.[values.wksUnresolvedPatchAlias];
      strictEqual(publishedPatchAliasVersion, "*");
    });

    it("extracts version of workspace dependencies if specified", () => {
      const pkg = readPackageManifest(publishedPackagePath);
      ok(pkg);
      ok(pkg?.dependencies);

      const publishedVersion = pkg?.dependencies?.[values.wksDepQualified];
      strictEqual(publishedVersion, values.wksPkgQualifiedVersion);
    });
  });

  describe("Package 2 (without `files` in manifest) publish", () => {
    const publishedFilePath = join(publishedPackage2Path, "file.txt");

    join(depPackage2Dir, "file.txt");
    beforeAll(() => {
      console.time("Package2 publish");
      return publishPackage({
        workingDir: depPackage2Dir,
      }).then(() => {
        console.timeEnd("Package2 publish");
      });
    });

    it("publishes package to store", () => {
      checkExists(publishedFilePath);
      checkExists(join(publishedPackage2Path, "package.json"));
    });
  });

  describe("Add package", () => {
    beforeAll(() => {
      return addPackages([values.depPackage], {
        workingDir: projectDir,
      });
    });
    it("copies package to .knit folder", () => {
      checkExists(join(projectDir, ".knit", values.depPackage));
    });
    it("copies remove package to node_modules", () => {
      checkExists(join(projectDir, "node_modules", values.depPackage));
    });
    it("creates to knit.lock", () => {
      checkExists(join(projectDir, "knit.lock"));
    });
    it("places knit.lock correct info about file", () => {
      const lockFile = readLockfile({ workingDir: projectDir });
      deepEqual(lockFile.packages, {
        [values.depPackage]: {
          file: true,
          replaced: "1.0.0",
          signature: extractSignature(lockFile, values.depPackage),
        },
      });
    });
    it("updates package.json", () => {
      const pkg = readPackageManifest(projectDir)!;
      deepEqual(pkg.dependencies, {
        [values.depPackage]: "file:.knit/" + values.depPackage,
      });
    });
    it("create and updates installations file", () => {
      const installations = readInstallationsFile();
      deepEqual(installations, {
        [values.depPackage]: [projectDir],
      });
    });
    it("preserves indent after installation", () => {
      const pkg = readPackageManifest(projectDir)!;
      strictEqual(pkg.__Indent, "  ");
    });
  });

  describe("Update package", () => {
    const innerNodeModulesFile = join(
      projectDir,
      "node_modules",
      values.depPackage,
      "node_modules/file.txt",
    );
    beforeAll(() => {
      fs.ensureFileSync(innerNodeModulesFile);
      return updatePackages([values.depPackage], {
        workingDir: projectDir,
      });
    });

    it("does not change knit.lock", () => {
      const lockFile = readLockfile({ workingDir: projectDir });
      console.log("lockFile", lockFile);
      deepEqual(lockFile.packages, {
        [values.depPackage]: {
          file: true,
          replaced: "1.0.0",
          signature: extractSignature(lockFile, values.depPackage),
        },
      });
    });
    it("does not remove inner node_modules", () => {
      checkExists(innerNodeModulesFile);
    });
  });

  describe("Remove not existing package", () => {
    beforeAll(() => {
      return removePackages(["xxxx"], {
        workingDir: projectDir,
      });
    });
    it("does not updates knit.lock", () => {
      const lockFile = readLockfile({ workingDir: projectDir });
      deepEqual(lockFile.packages, {
        [values.depPackage]: {
          file: true,
          replaced: "1.0.0",
          signature: extractSignature(lockFile, values.depPackage),
        },
      });
    });
  });

  describe("Retreat package", () => {
    beforeAll(() => {
      return removePackages([values.depPackage], {
        workingDir: projectDir,
        retreat: true,
      });
    });

    it("does not updates knit.lock", () => {
      const lockFile = readLockfile({ workingDir: projectDir });
      deepEqual(lockFile.packages, {
        [values.depPackage]: {
          file: true,
          replaced: "1.0.0",
          signature: extractSignature(lockFile, values.depPackage),
        },
      });
    });

    it("updates package.json", () => {
      const pkg = readPackageManifest(projectDir)!;
      deepEqual(pkg.dependencies, {
        [values.depPackage]: values.depPackageVersion,
      });
    });

    it("does not update installations file", () => {
      const installations = readInstallationsFile();
      deepEqual(installations, {
        [values.depPackage]: [projectDir],
      });
    });

    it("should not remove package from .knit", () => {
      checkExists(join(projectDir, ".knit", values.depPackage));
    });

    it("should remove package from node_modules", () => {
      checkNotExists(join(projectDir, "node_modules", values.depPackage));
    });
  });

  describe("Update (restore after retreat) package", () => {
    beforeAll(() => {
      return updatePackages([values.depPackage], {
        workingDir: projectDir,
      });
    });

    it("updates package.json", () => {
      const pkg = readPackageManifest(projectDir)!;
      deepEqual(pkg.dependencies, {
        [values.depPackage]: "file:.knit/" + values.depPackage,
      });
    });
  });

  describe("Remove package", () => {
    beforeAll(() => {
      return removePackages([values.depPackage], {
        workingDir: projectDir,
      });
    });

    it("updates knit.lock", () => {
      const lockFile = readLockfile({ workingDir: projectDir });
      deepEqual(lockFile.packages, {});
    });

    it("updates package.json", () => {
      const pkg = readPackageManifest(projectDir)!;
      deepEqual(pkg.dependencies, {
        [values.depPackage]: values.depPackageVersion,
      });
    });

    it("updates installations file", () => {
      const installations = readInstallationsFile();
      deepEqual(installations, {});
    });
    it("should remove package from .knit", () => {
      checkNotExists(join(projectDir, ".ylc", values.depPackage));
    });

    it("should remove package from node_modules", () => {
      checkNotExists(join(projectDir, "node_modules", values.depPackage));
    });
  });

  describe("Add package (--link)", () => {
    beforeAll(() => {
      return addPackages([values.depPackage], {
        workingDir: projectDir,
        linkDep: true,
      });
    });
    it("copies package to .knit folder", () => {
      checkExists(join(projectDir, ".knit", values.depPackage));
    });
    it("copies remove package to node_modules", () => {
      checkExists(join(projectDir, "node_modules", values.depPackage));
    });
    it("creates to knit.lock", () => {
      checkExists(join(projectDir, "knit.lock"));
    });
    it("places knit.lock correct info about file", () => {
      const lockFile = readLockfile({ workingDir: projectDir });
      deepEqual(lockFile.packages, {
        [values.depPackage]: {
          link: true,
          replaced: "1.0.0",
          signature: extractSignature(lockFile, values.depPackage),
        },
      });
    });
    it("updates package.json", () => {
      const pkg = readPackageManifest(projectDir)!;
      deepEqual(pkg.dependencies, {
        [values.depPackage]: "link:.knit/" + values.depPackage,
      });
    });
    it("create and updates installations file", () => {
      const installations = readInstallationsFile();
      deepEqual(installations, {
        [values.depPackage]: [projectDir],
      });
    });
  });

  describe("Updated linked (--link) package", () => {
    beforeAll(() => {
      return updatePackages([values.depPackage], {
        workingDir: projectDir,
      });
    });
    it("places knit.lock correct info about file", () => {
      const lockFile = readLockfile({ workingDir: projectDir });
      deepEqual(lockFile.packages, {
        [values.depPackage]: {
          link: true,
          replaced: "1.0.0",
          signature: extractSignature(lockFile, values.depPackage),
        },
      });
    });
    it("updates package.json", () => {
      const pkg = readPackageManifest(projectDir)!;
      deepEqual(pkg.dependencies, {
        [values.depPackage]: "link:.knit/" + values.depPackage,
      });
    });
    it("create and updates installations file", () => {
      const installations = readInstallationsFile();
      deepEqual(installations, {
        [values.depPackage]: [projectDir],
      });
    });
  });
});
