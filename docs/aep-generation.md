# AEP generation

Import from `@syntax-syllogism/apx-core`. The generation pipeline separates
metadata acquisition, naming, pure plan construction and filesystem execution.
Callers own input validation, authentication, confirmations and presentation.
There are no command use cases, options schemas, progress callbacks or
cancellation signals in the current API.

## Describe, names and paths

`describeTarget(conn, sobject)` uses a caller-supplied `describeSObject` connection
and returns an `SObjectDescribeView`. `toDescribeView(rawDescribe)` performs the
same pure conversion: it preserves field order while excluding `IsDeleted`
(case-insensitively), fields of type `textarea`, and fields with
`filterable: false`.

`buildSObjectNames` pluralizes the object base name for selectors and domains,
removes underscores and `__c`, and applies an optional uppercase prefix.
`buildServiceNames` uses the supplied basename without pluralization.
Selector-method, criteria and action names preserve the supplied class name;
their test names truncate the base to 36 characters before appending `Test`.
SObject and service names do not apply that truncation. Field-injection names
default to `SelectorInclusion_<object base>Fields` and are capped at 40 characters.
These helpers construct names; they do not validate all Apex identifier rules.

`PathResolver` defaults to `main/classes`, `main/schema` and `test/classes`,
with subdirectories by artifact area. Pass an `AepLayout` to customize those
three roots. Plans contain relative paths, not an output base directory.

## Pure plans and flavors

Each builder returns `{ artifacts }`; each artifact has `id`, `relativePath`
and rendered `content`. Templates are internal TypeScript strings rendered with
Eta, without runtime template-file reads. Plan construction performs no disk
inspection or writes.

| Builder | Output and flavor support |
| --- | --- |
| `buildSelectorPlan` | Implementation, interface, test and class metadata for both flavors; optional binding for AT4DX only. |
| `buildDomainPlan` | Implementation, interface, test, trigger and metadata for both flavors; optional binding for AT4DX only. |
| `buildServicePlan` | Facade, interface, implementation, exception, test and metadata; optional binding, for both flavors. |
| `buildUnitOfWorkPlan` | AT4DX binding; returns an empty plan for fflib. |
| `buildSelectorMethodPlan` | Class, test and metadata for both flavors. |
| `buildCriteriaPlan`, `buildActionPlan` | Class, test, metadata and domain-process binding for AT4DX only. |
| `buildFieldInjectionPlan` | Field set and selector inclusion binding for AT4DX only. |

Requesting an unsupported template/flavor combination throws `template-missing`.
For fflib selectors and domains, set `includeBinding: false`.
`combinePlans(...plans)` concatenates artifacts; duplicate paths are rejected
later by the engine rather than merged.

## Apply a plan

```ts
import {
  buildServiceNames,
  buildServicePlan,
  GenerationEngine,
  PathResolver,
  resolveOutputBase,
} from '@syntax-syllogism/apx-core';

const plan = buildServicePlan({
  names: buildServiceNames({ basename: 'Billing' }),
  flavor: 'at4dx',
  apiVersion: '60.0',
  paths: new PathResolver(),
  includeBinding: true,
});
const baseDir = await resolveOutputBase('generated-files', '/path/to/project');
const preview = await GenerationEngine.execute(plan, { baseDir, dryRun: true });
// Present plan.artifacts and preview.wouldCreate before applying.
const applied = await GenerationEngine.execute(plan, { baseDir, overwrite: 'skip' });
```

`execute` first rejects duplicate relative paths. A dry run returns empty
`created` and `skipped` arrays and all resolved paths in `wouldCreate`; it does
not inspect existing files or enforce an overwrite policy. A real run checks
existence and applies `overwrite` (the default), `skip`, or `error`. The `error`
policy rejects an existing target before any writes start. Results use resolved
paths, and `created` includes overwritten files. Writes create parent directories
and run concurrently; a write failure can leave some artifacts on disk.

## Project and API-version helpers

`resolveOutputBase(outputPath, projectRoot?)` preserves absolute output paths;
otherwise it resolves against the explicit root, or Salesforce project discovery
when no root is supplied. Discovery failure propagates. `DEFAULT_OUTPUT_PATH` is
`generated-files`; callers choose whether to use it.

`resolveProjectApiVersion(projectRoot?)` reads `sourceApiVersion` and returns
`undefined` outside a Salesforce project. Other configuration errors propagate.
`resolveApiVersion({ explicit, conn, projectRoot })` uses a truthy explicit
version, then `conn.getApiVersion()`, then `DEFAULT_API_VERSION` (`60.0`);
it does not consult `projectRoot` or the project version. Resolve the project
version separately when needed. Editor callers should always pass an explicit
root to the project helpers.

See the [error contract](../README.md#errors), [boundary decisions](design/0001-apx-core-boundaries.md),
and `test/aep/` for fixtures and contract tests.
