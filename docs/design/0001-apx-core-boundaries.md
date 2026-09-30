# 0001 — apx-core boundaries

**Status:** Accepted
**Date:** 2026-09-30

## Context

All apx logic lived inside the `apx` oclif plugin. That covers:

- the Apex Enterprise Patterns (AEP) code generators, for fflib and AT4DX
  selectors, domains, services, units of work, selector methods and field
  injections, trigger actions and criteria;
- dead-code analysis.

The Apx VS Code extension could only reach this code by spawning
`sf apx …`. That was slow, because every command paid for a process start and
a plugin load. Results came back only as text on stdout. The extension was
also tied to the CLI's flag names through a vendored oclif manifest.

apx-core is the shared engine for both front ends:

| Consumer | How it uses apx-core |
| --- | --- |
| `apx` sf plugin | Imports the library. Commands become thin adapters that handle flags, prompts and printing. |
| Apx VS Code extension | Imports the library into the extension host instead of spawning the CLI. |

It follows the common `-core` library pattern for sf plugins, as a single
package rather than a monorepo.

## Decisions

| # | Decision |
| --- | --- |
| D1 | apx-core holds the full domain library. Every command workflow is a callable use case. |
| D2 | One repository and one npm package: `@syntax-syllogism/apx-core`. Split it only when a real consumer needs a subset. |
| D3 | *(Not used.)* There is no SFDX-package consumer. |
| D4 | Semantic versioning; consumers pin exact versions. Changes that count as major: rejecting previously valid input, changing a generated file's content or path, or changing a plan's shape. |
| D5 | Errors are typed. `ApxError` carries a stable `code` and structured `data`. apx-core owns the default English text. |
| D6 | Each use case exports a zod options schema with UI hints, and front ends build their inputs from it. The CLI keeps its own flags and has a test that maps them onto the same options. |
| D7 | The VS Code extension runs in process only. It keeps no fallback that spawns the CLI. |
| D8 | zod is the single source of truth for option shapes. |

## Rules

Every module in apx-core follows these rules. When code is extracted from the
plugin, the parts that comply move and the rest stays behind.

1. **No CLI framework.** No `@oclif/core`, `@salesforce/sf-plugins-core` or
   `@inquirer/*`. No `Flags`, `ux`, spinners, tables or interactive prompts.
   `test/dependencies.test.ts` enforces this, for both `package.json` and
   source imports.
2. **The caller supplies the connection.** Functions take an
   `@salesforce/core` `Connection`, or `undefined` for commands that need no
   org. They never resolve an org from flags or configuration, and never
   refresh auth themselves.
3. **No prompting. Writes are split into plan and apply.** Generation returns
   a plan listing every file and whether it already exists. The caller shows
   the plan, confirms, and calls apply with an overwrite policy (`overwrite`
   or `skip`). apply re-checks the disk, so the existence status in a plan is
   informational only. apx-core never accepts a confirm callback.
4. **Progress and cancellation are injected.** Both are optional: an
   `onProgress(event)` callback and an `AbortSignal`, which is checked between
   steps.
5. **Errors are typed** (D5). `code` and the shape of `data` are covered by
   semver. The wording of messages is not.
6. **Filesystem access is allowed**, because every front end runs on Node.
   Every write also has a pure variant that renders to strings, such as a
   generation plan's file contents or a destructive manifest's XML.
7. **Rendering stays pure.** Human-readable reports and summaries are
   returned as strings; printing them is the caller's job.
8. **The public API is `src/index.ts` only.** Adding an export is a minor
   change. Removing or renaming one, or changing a signature or result shape,
   is major. `test/index.test.ts` pins the exported keys.

## apx-specific rules

- **Some commands need no org.** Each use case declares whether it requires
  an org: `required`, `optional` or `none`. Front ends ask for an org only when
  the use case needs one.
- **Project root is explicit.** Relative output paths and the project's
  `sourceApiVersion` are resolved against a `projectRoot` that the caller
  passes in. apx-core never assumes `process.cwd()`, because an editor's
  extension host is not running in the workspace. When `projectRoot` is
  omitted, the sfdx project that contains the current directory is used,
  which is the CLI's behaviour.
- **Templates are code.** Apex templates are TypeScript string modules
  rendered with eta, not files read at runtime, so the package bundles
  cleanly.

## Resolved questions

- **Is `@salesforce/core` a dependency or a peerDependency?** A direct
  dependency, as in warden-core. That project checked that `@salesforce/core`
  bundles into the VS Code extension host with esbuild. It authenticates from
  the sf CLI's auth store with no build changes; the only requirement is to
  set `SF_DISABLE_LOG_FILE=true` before the first import. The extension bundles
  everything (`vsce package --no-dependencies`), so a peer dependency would
  burden consumers for no benefit.

## Consequences

- The plugin's `messages/*.md` files keep command help text only. Runtime
  error and report text moves into apx-core.
- Front ends own everything interactive: org selection, prompts,
  confirmations, and presentation.
- Adopting a new apx-core release is a deliberate pin bump in each consumer.
