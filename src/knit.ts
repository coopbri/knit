#!/usr/bin/env node
import { join, resolve } from "path";

import yargs from "yargs";

import {
  values,
  publishPackage,
  addPackages,
  updatePackages,
  removePackages,
  getStoreMainDir,
  knitGlobal,
} from ".";
import { checkManifest } from "./check";
import { makeConsoleColored, disabledConsoleOutput } from "./console";
import { showInstallations, cleanInstallations } from "./installations";
import { readRcConfig } from "./rc";
import pkg from "../package.json";
import app from "lib/config/app";

import type { PublishPackageOptions } from "./publish";

const updateFlags = ["update", "upgrade", "up"];

const publishFlags = [
  "scripts",
  "sig",
  "dev-mod",
  "changed",
  "files",
  ...updateFlags,
];

const cliCommand = values.myNameIs;

makeConsoleColored();

const rcArgs = readRcConfig();

if (process.argv.includes("--quiet") || rcArgs.quiet) {
  disabledConsoleOutput();
}

const getPublishOptions = (
  argv: any,
  override: Partial<PublishPackageOptions> = {},
): PublishPackageOptions => {
  const folder = argv._[1];
  return {
    workingDir: join(process.cwd(), folder || ""),
    push: argv.push,
    replace: argv.replace,
    signature: argv.sig,
    changed: argv.changed,
    content: argv.content,
    private: argv.private,
    scripts: argv.scripts,
    update: argv.update || argv.upgrade,
    workspaceResolve: argv.workspaceResolve,
    devMod: argv.devMod,
    ...override,
  };
};

void yargs
  .scriptName(cliCommand)
  .usage(
    `${app.commandPrefix} ${cliCommand}` +
      " [command] [options] [package1 [package2...]]",
  )
  .coerce("store-folder", (folder: string) => {
    if (!knitGlobal.knitStoreMainDir) {
      knitGlobal.knitStoreMainDir = resolve(folder);
      console.log("Package store folder used:", knitGlobal.knitStoreMainDir);
    }
  })
  .command({
    command: "*",
    builder: () => {
      return yargs.boolean(["version"]);
    },
    handler: (argv) => {
      let msg = `Use '${pkg.name} help' to see available commands.`;
      if (argv._[0]) {
        msg = "Unknown command `" + argv._[0] + "`. " + msg;
      } else {
        if (argv.version) {
          msg = pkg.version;
        }
      }
      console.log(msg);
    },
  })
  .command({
    command: "publish",
    describe: `Publish package in ${pkg.name} local repo`,
    builder: () => {
      return yargs
        .default("sig", false)
        .default("scripts", true)
        .default("dev-mod", true)
        .default("workspace-resolve", true)
        .default(rcArgs)
        .alias("script", "scripts")
        .boolean(["push"].concat(publishFlags));
    },
    handler: (argv) => {
      return publishPackage(getPublishOptions(argv));
    },
  })
  .command({
    command: "push",
    describe: `Publish package in ${pkg.name} local repo and push to all installations`,
    builder: () => {
      return yargs
        .default("sig", false)
        .default("scripts", false)
        .default("dev-mod", true)
        .default("workspace-resolve", true)
        .default(rcArgs)
        .alias("script", "scripts")
        .boolean(["safe"].concat(publishFlags))
        .option("replace", { describe: "Force package content replacement" });
    },
    handler: (argv) => {
      return publishPackage(getPublishOptions(argv, { push: true }));
    },
  })
  .command({
    command: "installations",
    describe: "Work with installations file: show/clean",
    builder: () => {
      return yargs.boolean(["dry"]);
    },
    handler: async (argv) => {
      const action = argv._[1];
      const packages = argv._.slice(2) as string[];
      switch (action) {
        case "show":
          showInstallations({ packages });
          break;
        case "clean":
          await cleanInstallations({ packages, dry: argv.dry });
          break;
        default:
          console.info("Need installation action: show | clean");
      }
    },
  })
  .command({
    command: "add",
    describe: `Add package from ${pkg.name} repo to the project`,
    builder: () => {
      return yargs
        .boolean(["file", "dev", "link", ...updateFlags])
        .alias("D", "dev")
        .boolean("workspace")
        .alias("save-dev", "dev")
        .alias("workspace", "W")
        .default(rcArgs)
        .help(true);
    },
    handler: (argv) => {
      return addPackages(argv._.slice(1) as string[], {
        dev: argv.dev,
        linkDep: argv.link,
        restore: argv.restore,
        pure: argv.pure,
        workspace: argv.workspace,
        update: argv.update || argv.upgrade,
        workingDir: process.cwd(),
      });
    },
  })
  .command({
    command: "link",
    describe: `Link package from ${pkg.name} repo to the project`,
    builder: () => {
      return yargs.default(rcArgs).help(true);
    },
    handler: (argv) => {
      return addPackages(argv._.slice(1) as string[], {
        link: true,
        pure: argv.pure,
        workingDir: process.cwd(),
      });
    },
  })
  .command({
    command: "update",
    describe: `Update packages from ${pkg.name} repo`,
    builder: () => {
      return yargs
        .boolean([...updateFlags])
        .default(rcArgs)
        .help(true);
    },
    handler: async (argv) => {
      await updatePackages(argv._.slice(1) as string[], {
        update: argv.update || argv.upgrade,
        restore: argv.restore,
        workingDir: process.cwd(),
      });
    },
  })
  .command({
    command: "restore",
    describe: "Restore retreated packages",
    builder: () => {
      return yargs
        .boolean([...updateFlags])
        .default(rcArgs)
        .help(true);
    },
    handler: async (argv) => {
      await updatePackages(argv._.slice(1) as string[], {
        update: argv.update || argv.upgrade,
        restore: true,
        workingDir: process.cwd(),
      });
    },
  })
  .command({
    command: "remove",
    describe: "Remove packages from the project",
    builder: () => {
      return yargs.boolean(["retreat", "all"]).default(rcArgs).help(true);
    },
    handler: (argv) => {
      return removePackages(argv._.slice(1) as string[], {
        retreat: argv.retreat,
        workingDir: process.cwd(),
        all: argv.all,
      });
    },
  })
  .command({
    command: "retreat",
    describe:
      "Remove packages from project, but leave in lock file (to be restored later)",
    builder: () => {
      return yargs.boolean(["all"]).help(true);
    },
    handler: (argv) => {
      return removePackages(argv._.slice(1) as string[], {
        all: argv.all,
        retreat: true,
        workingDir: process.cwd(),
      });
    },
  })
  .command({
    command: "check",
    describe: `Check package.json for ${pkg.name} packages`,
    builder: () => {
      return yargs.boolean(["commit"]).usage("check usage here").help(true);
    },
    handler: (argv) => {
      const gitParams = process.env.GIT_PARAMS;
      if (argv.commit) {
        console.log("gitParams", gitParams);
      }
      checkManifest({
        commit: argv.commit,
        all: argv.all,
        workingDir: process.cwd(),
      });
    },
  })
  .command({
    command: "dir",
    describe: `Show ${pkg.name} system directory`,
    handler: () => {
      console.log(getStoreMainDir());
    },
  })
  .help("help").argv;
