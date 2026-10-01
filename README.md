# apx-core

Shared apx engine: the Apex Enterprise Patterns (AEP) code generators and
dead-code analysis behind the [`apx`](https://github.com/Syntax-Syllogism/apx)
Salesforce CLI plugin and the Apx VS Code extension.

apx-core is a plain Node/TypeScript library with no CLI framework dependency.
Call its functions directly from a script, an editor extension, a CI job, or
any other Node codebase.

The package includes ten command use cases with zod options schemas, UI hints,
plan/apply generation, pure human renderers, progress and cancellation, project helpers,
and dead-code inventory, dependency analysis, classification and manifests.

## Install

```bash
npm install @syntax-syllogism/apx-core
```

Requires Node.js 22 or later.

## API

| Export | Purpose |
| --- | --- |
| `commandDescriptors`, `useCases` | All ten commands, keyed by stable use-case ID, with colon-separated CLI IDs, options schemas, UI hints and org requirements. |
| `generate`, `generateSelector`, `generateDomain`, `generateService`, `generateUnitOfWork`, `generateSelectorMethod`, `generateSelectorFieldInjection`, `generateAction`, `generateCriteria` | Write use cases: `plan(conn, options, ctx?)` previews content and file existence; `apply(conn, preview, ctx?)` writes with `overwrite` or `skip`. |
| `dead`, `writeDeadCodeManifest` | Read analysis with optional pure manifest XML; separately write the returned manifest, with dry-run support. |
| `uiHints`, `file`, `text`, `boolean`, `enumValue` | Read or attach zod UI metadata; folder and multi-string hints support output folders and string lists. |
| `checkCancelled`, `startProgress`, `endProgress`, `requireConnection` | Optional progress/cancellation and required-org enforcement. |
| `planGeneration`, `applyGeneration` | Shared preview and execution helpers for generation plans. |
| `renderGenerationPlan`, `renderGenerationResult`, `renderDeadCodeReport`, `describeError` | Pure preview, summary, report and error text. Pass `commandId` to the result renderer for command-specific CLI messages. |
| `generateOptionsSchema`, `generateSelectorOptionsSchema`, `generateDomainOptionsSchema`, `generateServiceOptionsSchema`, `generateUnitOfWorkOptionsSchema`, `generateSelectorMethodOptionsSchema`, `generateSelectorFieldInjectionOptionsSchema`, `generateActionOptionsSchema`, `generateCriteriaOptionsSchema`, `deadOptionsSchema` | Standalone command option validation, also available on each descriptor. |
| `ApxError` | Base class for every error apx-core throws on purpose. Carries a stable `code`, optional structured `data`, and a default English `message`. |
| `isApxError(error)` | Structural type guard for `ApxError`; safe across duplicate copies of this package. |
| `toDescribeView`, `describeTarget` | Build a filtered describe view from raw metadata or a caller-supplied connection. The caller owns authentication. |
| `buildSObjectNames`, `buildServiceNames`, `buildSelectorMethodNames`, `buildCriteriaNames`, `buildActionNames`, `buildFieldInjectionNames`, `domainProcessBindingDeveloperName` | Build Apex and metadata names. |
| `PathResolver`, `DEFAULT_LAYOUT` | Resolve paths within a configurable AEP layout. |
| `buildSelectorPlan`, `buildDomainPlan`, `buildServicePlan`, `buildUnitOfWorkPlan`, `buildSelectorMethodPlan`, `buildCriteriaPlan`, `buildActionPlan`, `buildFieldInjectionPlan`, `combinePlans` | Pure generation plans containing relative paths and rendered content. Templates remain internal. |
| `GenerationEngine.execute(plan, options)` | Apply a plan under `baseDir`, with dry-run and `overwrite`, `skip` or `error` policies. |
| `resolveOutputBase(outputPath, projectRoot?)`, `resolveProjectApiVersion(projectRoot?)` | Resolve paths and project API version against an explicit root; omitted roots use the current Salesforce project. Absolute output paths take precedence. No project returns an undefined project version. |
| `resolveApiVersion({ conn?, explicit?, projectRoot? })` | Use explicit version, then connection version, then `60.0`. Project version is resolved separately. |
| `DEFAULT_OUTPUT_PATH`, `DEFAULT_API_VERSION`, `ORDER_PATTERN`, `TRIGGER_OPERATION_OPTIONS`, `isValidOrderValue`, `isWithinCustomMetadataNameLimit` | Shared generation defaults and validators. |
| `fetchClassInventory`, `scanBindings`, `fetchDependencyGraph`, `classifyClasses`, `MAX_ROUNDS` | Inventory and classify Apex using a caller-supplied structural `DeadConnection`. |
| `renderDestructiveChanges`, `renderEmptyPackage`, `writeDestructiveManifest` | Pure XML rendering and destructive manifest writing with dry-run support. |

Public types include `CommandDescriptor`, `OrgRequirement`, `ReadUseCase`,
`WriteUseCase`, `UseCase`, `UseCaseContext`, `ApxUseCaseContext`,
`GenerationApplyContext`, `UiHint`, `ProgressEvent`, `PlannedFile`,
`GenerationPreview`, `GenerationOutcome`, `DeadUseCaseResult`, `DeadReportOptions`,
the ten inferred command options types (`GenerateOptions`, `GenerateSelectorOptions`,
`GenerateDomainOptions`, `GenerateServiceOptions`, `GenerateUnitOfWorkOptions`,
`GenerateSelectorMethodOptions`, `GenerateSelectorFieldInjectionOptions`,
`GenerateActionOptions`, `GenerateCriteriaOptions`, `DeadOptions`), `ApxErrorCode`, generation models (`Flavor`, `ArtifactId`,
`PlannedArtifact`, `GenerationPlan`, `EngineOptions`, `OverwritePolicy`,
`GenerationManifest`, `AepCommandResult`), `SObjectDescribeView`, `ApiVersionOptions`,
`AepLayout`, naming inputs and results, and dead-code models (`DeadConnection`,
`CandidateClass`, `SymbolTable`, `ComponentRef`, `DeadClassFinding`, `DeadCodeResult`,
`BindingScan`, `DependencyGraph`, `ManifestOptions`, `ManifestResult`).

```ts
import { isApxError } from '@syntax-syllogism/apx-core';

try {
  // call an apx-core function
} catch (error) {
  if (isApxError(error)) {
    console.error(`${error.code}: ${error.message}`);
  } else {
    throw error;
  }
}
```

For usage and implementation details, see [command use cases](docs/command-use-cases.md),
[AEP generation](docs/aep-generation.md)
and [dead-code analysis](docs/dead-code-analysis.md).

## Errors

Errors are reported as `ApxError` instances (or area-specific subclasses).
The `code` and the shape of `data` are part of the public API; the `message`
text is not and may be reworded in any release.

| Code | Data | Meaning |
| --- | --- | --- |
| `org-required` | `{ commandId }` | A required-org use case received no connection. |
| `nothing-selected` | — | Aggregate generation selected no artifact groups. |
| `cancelled` | `{ created: string[] }` during apply; otherwise none | The caller aborted; completed writes remain on disk. |
| `duplicate-path` | `{ relativePath }` | Two generation artifacts share a path. |
| `file-exists` | `{ absolutePath }` | The error overwrite policy refuses an existing file. |
| `write-failed` | `{ absolutePath, cause }` | An artifact or manifest could not be written. |
| `template-missing` | `{ artifactId, flavor }` | The requested artifact/flavor has no template. |
| `template-empty` | `{ artifactId, flavor }` | The renderer returned no content. |
| `test-pairing-invariant` | `{ name }` | A test-only class is missing its paired test in the manifest. |
| `sobject-not-found` | `{ sobject }` | The describe request returned `NOT_FOUND`. |
| `describe-failed` | `{ sobject, cause }` | Another describe failure occurred. |

Invalid command options throw `ZodError`; `describeError` returns the first issue
as a title and any remaining issues as detail. Aggregate `generate.plan` converts
the empty-selection schema issue to `ApxError` with code `nothing-selected`.

Describe failures retain the original error message. External query and project
configuration errors propagate to the caller.

## Versioning

apx-core follows [Semantic Versioning](https://semver.org/). Removing or
renaming an export, changing a signature or result shape, changing an error
`code`, changing a generated file's content or path, or rejecting input that
was previously valid is a major change. Consumers should pin an exact version
and upgrade deliberately.

## Development

```bash
npm install
npm run build
npm test          # typecheck, lint, prettier, mocha + coverage
npm run pack:check
```

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) and the
[Code of Conduct](CODE_OF_CONDUCT.md).

## Security

See [SECURITY.md](SECURITY.md) for how to report vulnerabilities.

## License

[MIT](LICENSE) © Jake Richter
