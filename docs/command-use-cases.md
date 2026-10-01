# Command use cases

Import through `@syntax-syllogism/apx-core`. `useCases` is a registry keyed by
stable use-case ID; `commandDescriptors` is an array of the same descriptors.
Each descriptor provides `id`, `cliId`, `title`, `group`, `destructive`,
`requiresOrg` and a zod `optionsSchema`. All current descriptors have
`destructive: false`: generation writes local files, and dead-code analysis
does not delete or deploy anything.

## Commands and connections

| Registry ID | CLI ID | Org requirement |
| --- | --- | --- |
| `generate` | `apx:generate` | required |
| `generate-selector` | `apx:generate:selector` | required |
| `generate-domain` | `apx:generate:domain` | required |
| `generate-unitofwork` | `apx:generate:unitofwork` | required |
| `generate-service` | `apx:generate:service` | optional |
| `generate-selector-method` | `apx:generate:selector:method` | none |
| `generate-selector-field-injection` | `apx:generate:selector:field-injection` | none |
| `generate-action` | `apx:generate:action` | none |
| `generate-criteria` | `apx:generate:criteria` | none |
| `dead` | `apx:dead` | required |

The nine generation commands have `kind: 'write'` and `group: 'generate'`.
They expose `plan(conn, options, ctx?)` and `apply(conn, preview, ctx?)`; see
[AEP generation](aep-generation.md) for previews, overwrite policies and results.
Only planning needs an org; apply writes the preview without querying the
connection. `dead` has `kind: 'read'`, `group: 'analyze'` and
`run(conn, options, ctx?)`; see [dead-code analysis](dead-code-analysis.md) for
analysis and separate manifest writing.

Callers supply authenticated Salesforce connections. Missing required
connections throw `org-required`. Service can use a connection for API version;
org-free generation commands ignore the connection. Front ends own org
selection, prompts, confirmation and printing.

## Options and UI hints

Standalone `*OptionsSchema` exports are the same schemas held by the descriptors.
Parse raw input before passing it to a use case: the TypeScript options types
describe parsed output, including defaults. Use cases also validate at runtime.

```ts
import { generateSelector, uiHints } from '@syntax-syllogism/apx-core';

const schema = generateSelector.descriptor.optionsSchema;
const hints = uiHints(schema);
// hints.outputPath.kind === 'folder'
const options = schema.parse({ sobject: 'Account', flavor: 'at4dx' });
// options.outputPath === 'generated-files'
```

`uiHints(schema)` returns field metadata keyed by option name, unwrapping
optional/default fields as needed. Non-object schemas return `{}`. Hint kinds
are `file`, `folder`, `multiString`, `string`, `boolean` and `enum`.
Metadata may include `summary`, `placeholder`, `fileFilter`, `exclusiveGroup`
and `dependsOn`; front ends interpret these hints. Schema validation enforces
the actual constraints. `file`, `text`, `boolean` and `enumValue` are exported
helpers for attaching metadata to new schemas.

Flavored commands require an explicit `fflib` or `at4dx` choice. Selector
methods, field injection, actions and criteria use AT4DX. Output folders default
to `generated-files`. Field injection has no API-version option. Aggregate
generation defaults its selection flags to false and requires at least one of
`selector`, `domain` or `unitOfWork`. Dead analysis requires `classes: true`;
`deadOnly` is accepted without `destructiveManifest` but has no effect unless
a manifest is requested. `fields` and `ignore` are lists of trimmed, nonempty
strings. Other string options do not generally validate
Apex identifiers or API-version format.

Invalid input throws `ZodError`. Empty aggregate selection throws `ZodError`
when parsing the schema directly, but `generate.plan` converts that issue to
`nothing-selected` before any describe query. Required-org enforcement precedes
option validation. See the [error contract](../README.md#errors).

## Context and presentation

`ApxUseCaseContext` accepts `projectRoot`, `signal` and `onProgress`.
Editor hosts should pass an explicit project root for relative generation paths.
`GenerationApplyContext` also accepts `overwrite: 'overwrite' | 'skip'`, defaulting
to `overwrite`. Cancellation is cooperative; it does not interrupt in-flight
queries or roll back completed writes. The topic docs describe each workflow's
progress phases and cancellation results.

Renderers return values for callers to present: generation renderers return
`string[]`, `renderDeadCodeReport` returns a string, and `describeError` returns
`{ title, detail? }`. They do not print or add ANSI styling. Pass a stable registry
ID as the generation result renderer's `commandId` for command-specific summaries
and binding reminders.
