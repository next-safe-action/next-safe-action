# Contributing to next-safe-action

Code contributions are very welcome, so if you decide to help improve the library code, thank you! First of all, though, please read the guidelines below.

## Information about the project

This is a monorepo, that uses:

- [pnpm](https://pnpm.io/) as package manager;
- [Turborepo](https://turbo.build/repo) as build system;
- [TypeScript](https://www.typescriptlang.org/) as primary language;
- [Oxlint](https://oxc.rs/docs/guide/usage/linter) as linter (with [oxlint-tsgolint](https://github.com/nicolo-ribaudo/oxlint-tsgolint) for type-aware checking);
- [Oxfmt](https://oxc.rs/docs/guide/usage/formatter) as formatter (with import sorting and Tailwind CSS class sorting);
- [Vitest](https://vitest.dev/) as test framework;
- [tsdown](https://tsdown.dev/) as library bundler;
- [Changesets](https://github.com/changesets/changesets) for versioning and release PR management;
- [Fumadocs](https://fumadocs.vercel.app/) for the documentation website.

Lint and format configuration files are organized as:
- root `.oxlintrc.base.json` as shared Oxlint base config;
- package-level `.oxlintrc.json` files for package-specific Oxlint rules;
- root `.oxfmtrc.json` for shared formatting rules across workspace packages.

### What you need to install

- `git`;
- Node.js LTS version specified in [.nvmrc](./.nvmrc). Highly recommended to use [fnm](https://github.com/Schniz/fnm) or [nvm](https://github.com/nvm-sh/nvm) for easy management of Node.js versions;
- a code editor: [VS Code](https://code.visualstudio.com) is the recommended one, as it enables workspace specific [settings](./.vscode/settings.json) and [extensions](./.vscode/extensions.json) to make the development more user-friendly;
- [`pnpm`](https://pnpm.io/installation) as package manager.

### Repository structure

- [`packages/next-safe-action`](./packages/next-safe-action): contains the source code of the library;
- [`apps/playground`](./apps/playground): contains the source code of the Next.js playground app, which is a basic implementation of the library;
- [`apps/docs`](./apps/docs): contains the source code of the [next-safe-action documentation website](https://next-safe-action.dev), built with Fumadocs (content in `content/docs/`).

## How to contribute

### Getting started

Before opening a pull request, please follow the general rule of **opening an issue or discussion first**, using the [issue templates](https://github.com/next-safe-action/next-safe-action/issues/new/choose), that will guide you through the process. You can avoid opening a new issue or discussion if:

- You're correcting a trivial error, like a typo;
- The issue or discussion for the bug you're fixing/feature you're implementing with the PR is already open.

### Development setup

After forking, cloning the repository and optionally creating a new branch from the base one, you can install the dependencies using `pnpm` in the project root directory:

```sh
pnpm install
```

Then, you can run the `build:lib` command to rebuild the library code, and then test it in the playground app:

```sh
pnpm run build:lib && pnpm run pg
```

> [!TIP]
> If you see many type errors in the playground app after running the `build:lib` command, try to restart the TS Server of VS Code. This should fix the errors.

If you updated user facing APIs of the library, you're **not required**, but **highly encouraged** to:
- update [the documentation](./apps/docs/content/docs) of the library to reflect the changes you've made.
- write tests for the changes you've made. They should be placed in the appropriate file inside [`__tests__`](./packages/next-safe-action/src/__tests__) directory (`next-safe-action` package).
- add a Changeset file using `pnpm run changeset`.

These steps can be done in later stages of the PR too, for instance when a maintainer already approved your code updates.

The documentation site is part of the monorepo, so dependencies are already installed. You can start the Fumadocs development server with:

```sh
pnpm run docs
```

### Committing changes

Once you're done with your code changes, you can finally commit and push them to the remote repository.

There is no enforced commit message format in the repository. Use clear commit messages that describe the change.

For PRs targeting `main` that touch package or release-related files, include a Changeset file in your PR:

```sh
pnpm run changeset
```

If you need to keep the PR in the Changesets flow without producing a version bump, create an empty Changeset:

```sh
pnpm run changeset:empty
```

PR CI runs linting/tests and checks for changesets before merge. The release workflow uses Changesets to create version PRs and publish from `main`.
