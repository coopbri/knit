# 🧶 Knit

> Streamline your local Node.js package dependency workflow.

Knit is a fork of [yalc](https://github.com/wclr/yalc), which was created by [@wclr](https://github.com/wclr). The name is inspired by this GitHub [thread](https://github.com/yarnpkg/yarn/issues/1213).

## Overview

`knit` is a CLI with a local repository designed to mirror a remote package repository, such as [npm](https://www.npmjs.com/). It allows you to publish packages from a local project folder to a local store, and install them in other local projects. It also allows you to easily propagate package updates.

`knit` can be used with projects where package managers, such as `npm`, `yarn`, or `pnpm`, are used
for managing `package.json` dependencies. `knit` creates a `knit.lock` file in your project (similar to `yarn.lock` and `package-lock.json`) that is used to ensure consistency while performing `knit` routines.

## Quick Start

Install locally in a project (replace `yarn` with your preferred package manager):

```sh
yarn add -D knit
```

Or execute it directly and ephemerally with `yarn dlx`:

```sh
yarn dlx knit [...]
```

## Key Commands

- `knit publish`: publish a package to a local store (`~/.knit` by default)
  - Only publishes files that would be published to a remote repository
- `knit add $PACKAGE_NAME`: add a package from the store to a project
  - Pulls package content into `$PROJECT_DIR/.knit/` and injects a relative local (`file:`/`link:` depending on usage) dependency into `package.json`
  - Alternatively, use `knit link $PACKAGE_NAME` which creates a symlink in `node_modules` to the package content, and will not modify `package.json` (like `npm/yarn link` does), or you even may use it with `npm`/`yarn`/`pnpm` workspaces
- `knit help` for help

## Usage

### Publish (`knit publish`)

Run in a project to publish it to the store.

- Copies [all the files that should be published to a remote registry](https://docs.npmjs.com/files/package.json#files)
- If your package has any of these lifecycle scripts, then will run before publishing, in the following order:

  - `prepublish`
  - `prepare`
  - `prepublishOnly`
  - `prepack`
  - `preknitpublish`

- If your package has any of these lifecycle scripts, they will run after publishing, in the following order:

  - `postknitpublish`
  - `postpack`
  - `publish`
  - `postpublish`

- Use `--no-scripts` to publish without running scripts

- When publishing, `knit` can optionally calculate a hash signature from the file contents and use the signature in the resulting package `version` (e.g. `"1.2.3+ffffffff"`). To enable this, pass `--sig` to the `knit publish` command
- Use `.knitignore` to exclude files from publishing to knit repo, such as `README.md` -`--content` will show included files in the published package
- Considering publishing, `knit` emulates the behavior of the `npm` client (`npm pack`). If you have a nested `.knit` folder in your package that you are going to publish with `knit` and you use the `package.json` `files` key, it should be included there explicitly. See [wclr/yalc#95](https://github.com/wclr/yalc/issues/95)
- If you want to include the `.knit` folder in published package content, add the `!.knit` pattern to `.npmignore`
- By default, Knit resolves the `workspace:` protocol in dependencies. This can be bypassed with `--no-workspace-resolve`
- For convenience, you can [automatically propagate package updates to dependent projects](#pushing-updates-automatically-to-all-installations)
- **Note for Windows users:** make sure the `LF` (line feed) symbol is used in published sources; it may be needed for some packages to work correctly (for example, `bin` scripts). `knit` won't convert line endings for you (because `npm` and `yarn` won't either)

### Add (`knit add`)

Run in a project to pull a package from the store and install it as a dependency.

- Copies the current version from the store to your project's `.knit` folder and injects a `file:.knit/$PACKAGE_NAME` dependency into `package.json`
- Specify a particular version with `knit add $PACKAGE_NAME@version`. This version will be fixed in `knit.lock` and will not affect newly published versions during updates
- Use `--link` to add a `link:` protocol dependency instead of the `file:` protocol
- Use `--dev` to add the package as a development dependency (`devDependencies`)
- Use `--pure` to avoid modifying `package.json` and `node_modules`
  - This is useful when working with workspaces (see [workspaces](#use-with-npmyarnpnpm-workspaces) section)
- Use `--workspace` (or `-W`) to add a dependency with `workspace:` protocol

### Link (`knit link`)

As an alternative to `add`, you can use the `link` command. This is similar to `npm link`/`yarn link`, except the symlink source will be the local `.knit` folder of your project instead of the global link directory.

After `knit` copies package content to the `.knit` folder, it will create a symlink (and not modify `package.json`): `$PROJECT_DIR/.knit/$PACKAGE_NAME ⟹ $PROJECT_DIR/node_modules/$PACKAGE_NAME`.

### Update (`knit update`)

Run `knit update $PACKAGE_NAME` to update to the latest version of `$PACKAGE_NAME` from the store, or just `knit update` to update all the packages found in `knit.lock`.

- `preknit` and `postknit` scripts will be executed in the target package as part of add and update operations (which are performed during `knit push`, see [push](#pushing-updates-automatically-to-all-installations) section)
- If you need to perform pre- or post- lifecycle scripts upon the update operation of a particular package, use a `(pre|post)knit.package-name` script in your `package.json`
- Use `--update` (or `--upgrade`/`--up`) to run your package managers's update command for packages

### Remove (`knit remove`)

- Run `knit remove $PACKAGE_NAME` to remove the package's dependency information from `package.json` and `knit.lock`
- Run `knit remove --all` to remove all packages from a project

### Installations (`knit installations`)

- Run `knit installations clean $PACKAGE_NAME` to unpublish a package previously published with `knit publish`
- Run `knit installations show $PACKAGE_NAME` to show all packages where `$PACKAGE_NAME` has been installed

## Advanced Usage

### Pushing Updates Automatically to All Installations

`knit publish --push` (or `knit push`) will publish your package to the store and propagate all changes to existing `knit` package installations (this performs the `update` operation on the target location).

When you run `knit add|link|update`, the project's package locations are tracked and saved, so `knit` knows where each package in the store is being used in your local environment.

The `scripts` option is `false` by default, so it won't run `pre/post` scripts (change this behavior by passing `--scripts`).

Flags:

- `--changed`: causes `knit` to first check if the package content has changed before publishing and pushing
  - This is a quick operation, and may be useful for file-watching scenarios when pushing
- `--replace`: causes `knit` to force replacement of the package content
- `preknit` and `postknit` (detailed in [Update](#update-knit-update) section): execute lifecycle script(s) on every push
- `--update`: run the `npm|yarn|pnpm update` command for pushed packages

### Committing `knit` files

It is up to you whether you would like to commit the files generated by `knit` (`.knit/` and `knit.lock`) to your repository.

**Reasons _not_ to commit:**

- You are using `knit` modules temporarily during development
- You strictly use `knit link` (which does not modify `package.json`)
- You are using `knit add` and don't want to worry about changing the `file:`/`link:` dependencies
  - This can be circumvented by using `knit check` in a precommit hook, e.g. with [Husky](https://github.com/typicode/husky), which checks `package.json` for Knit dependencies and exits with an error if it finds any

**Reasons _to_ commit:**

- You want to maintain deterministic builds as they relate to Knit dependencies
- You want to keep shared `knit` files within the projects you are working on and treat it as a part of the project's codebase
  - This may simplify management and usage of shared packages within your projects and maintain consistency

If you decide to commit, consider that standard non-code files like `README.md` and `LICENSE.md` will also be included, so you may want to exclude them in `.gitignore` with a pattern such as `**/.knit/**/*.md`. Alternatively, use `.knitignore` to avoid including those files in package content.

### Publish/Push Subprojects

Useful for [monorepos](https://en.wikipedia.org/wiki/Monorepo), `knit publish $PROJECT_NAME` will perform the publish operation in the `./$PROJECT_NAME` directory relative to `process.cwd()`.

### Retreat and Restore

Instead of completely removing a package, it can be temporary set back with `knit retreat [--all]` (e.g. before package publication to a remote registry).

Later, it can be restored with `knit restore`.

### Use with `npm`/`yarn`/`pnpm` Workspaces

`--pure` will be used by default if you try to `add` a project in a `workspaces`-enabled package, so `package.json` and `node_modules` will not be modified. Then, you can add the Knit-enabled package folder to `workspaces` in `package.json` (e.g. add `.knit/*` and `.knit/@*/*` patterns). During the `update` (or `push`) operation, package content will be updated automatically and your package manager will handle the rest.

If you want to override the default pure behavior, use `--no-pure`.

### Clean up Installations File

While working with `knit`, you might face a situation when you have locations where Knit-enabled projects have been removed from the filesystem, which will cause warnings when `knit` tries to push a package to the missing location. To get rid of these warnings, use `knit installations clean $PACKAGE_NAME`.

### Override Default Package Store Folder

Use `--store-folder` to override the default location for storing published packages.

### Control Output

Use `--quiet` to fully disable output, except for errors. Use `--no-colors` to disable colors.

### Set Default Options via `.knitrc`

A `.knitrc` file can be created to declaratively set default options for Knit.

Valid options:

- `sig`: control hash signatures for package versions
- `workspace-resolve`: control `workspace:` protocol resolution
- `dev-mod`: control removal of `devDependencies` from package content
- `scripts`: control lifecycle scripts
- `quiet`: control console output
- `files`: control display of included files in published packages

Example:

```txt
workspace-resolve=false
sig=false
```

## License

The code in this repository is licensed under MIT, &copy; Brian Cooper. The original [yalc](https://github.com/wclr/yalc) work is licensed under MIT &copy; Alex Osh. See <a href="LICENSE.md">LICENSE.md</a> for more information.
