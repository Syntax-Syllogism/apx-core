# Dead-code analysis

The public API separates org reads from pure classification and manifest
rendering. Callers supply a structural `DeadConnection` with
`tooling.autoFetchQuery<T>(soql)` and `query<T>(soql)`, each returning
`{ records: T[] }`. The caller owns authentication and query pagination for
`query`; the library does not resolve an org. Query failures propagate except
for missing binding objects described below.

## Command use case

`dead` has `kind: 'read'` and a required-org descriptor. Its zod schema validates
`classes: true`, manifest dependencies, an optional API-version string and a list
of nonempty ignore patterns. It does not validate API-version format. See
[command use cases](command-use-cases.md) for the shared descriptor and schema
contract. `run(conn,
options, ctx?)` performs no writes. It reports `inventory`, `bindings`,
`dependencies`, `classify`, then `manifest` (when requested), checking cancellation
between phases. In-flight queries finish before cancellation is observed.

With `destructiveManifest: true`, the result adds `manifest: {
destructiveChangesXml, packageXml, members }`. Member selection retains the
existing test-pairing invariant and honors `deadOnly`; without a manifest,
`deadOnly` is accepted and ignored. The XML uses explicit API
version, connection version, then the default. No output path is resolved while
reading, so analysis works without a local Salesforce project.

`writeDeadCodeManifest(result, outputBase, { dryRun? })` writes exactly this
snapshot under `dead-code`, returning the existing `manifestDir`, `manifestFiles`
or `wouldWrite` shape. It returns `{}` for absent or empty manifests. Callers can
merge this into their JSON report. `renderDeadCodeReport(result, {
includeSuppressed, deadOnly, username, manifestDir, dryRun })` returns the pure
human report, including warnings, tables, summary and deployment guidance.
Finding tables reproduce oclif's `ux.table` layout: box-drawn borders, Title
Case headers and a blank line after each table, without ANSI styling.

## Inventory, bindings and graph

`fetchClassInventory(conn)` fetches active Apex classes without a namespace,
then fetches symbol tables in concurrent batches of 200 IDs. Missing symbol
tables become `null`.

`scanBindings(conn)` queries these custom metadata sources concurrently:

| Object | Class-name fields |
| --- | --- |
| `ApplicationFactory_ServiceBinding__mdt` | `To__c`, `BindingInterface__c` |
| `ApplicationFactory_SelectorBinding__mdt` | `To__c` |
| `ApplicationFactory_DomainBinding__mdt` | `To__c` |
| `DomainProcessBinding__mdt` | `ClassToInject__c` |

The returned `boundClasses` map uses trimmed, lowercase class names and binding
labels as values. `reports` records source availability and record counts.
An `INVALID_TYPE` error or an unsupported-sObject message marks a source
unavailable; other errors propagate.

`fetchDependencyGraph(conn, candidateIds)` queries `MetadataComponentDependency`
in concurrent batches of 200 target IDs. `inbound` maps a candidate ID to its
referrers, including non-Apex components. `outbound` maps candidate source IDs
to referenced candidates. Self references are discarded and duplicate references
are collapsed by ID and component type.

## Classification

`classifyClasses({ candidates, inbound, outbound, boundClasses, ignorePatterns })`
does no queries or writes. Ignore patterns match whole class names,
case-insensitively, with `*` as a wildcard; ignored candidates are excluded
from the scan, while their graph references can still retain other classes.

Bindings, recognized entry points and test classes are initially suppressed.
Entry-point detection covers global classes, REST resources, callable method
annotations, webservice methods and supported platform interfaces, including
entry points in inner classes. With a symbol table, `IsTest` identifies a test;
without one, names starting or ending with `Test` are treated as tests.
The detection rules live in `src/dead/entryPoints.ts`.

Classification repeatedly removes unreferenced classes, safely paired classes
referenced only by tests, and orphaned dependency cycles, stopping at a fixed
point or `MAX_ROUNDS` (50). A test is paired for removal only when it does not
also reference surviving non-test candidates. Results are sorted by class name.

| Result array | Meaning |
| --- | --- |
| `dead` | No surviving inbound references, or an orphaned dependency cycle. |
| `testOnly` | Class referenced only by tests eligible for paired removal. |
| `testOfDead` | Tests paired with a removed subject. |
| `retained` | Test-only candidate blocked because a referrer test also covers surviving code. |
| `suppressed` | Remaining bound classes, entry points and tests; `wouldBeDead` indicates no surviving inbound references. |

These arrays do not enumerate every surviving class. `scanned` counts considered
candidates, and `withoutSymbolTable` counts those with null symbol tables.
Dead classes implementing interfaces or extending a parent carry `risk: 'di'`
and a `riskDetail` when no binding was found. `bindingSources` starts empty;
the caller attaches scan reports. Findings depend on the supplied graph, symbol
tables and known binding sources; consumers should present them for review.

```ts
import {
  classifyClasses,
  fetchClassInventory,
  fetchDependencyGraph,
  scanBindings,
} from '@syntax-syllogism/apx-core';

// conn is a caller-supplied DeadConnection.
const candidates = await fetchClassInventory(conn);
const [graph, bindings] = await Promise.all([
  fetchDependencyGraph(conn, candidates.map(({ id }) => id)),
  scanBindings(conn),
]);
const result = classifyClasses({
  candidates,
  ...graph,
  boundClasses: bindings.boundClasses,
  ignorePatterns: [],
});
result.bindingSources = bindings.reports;
```

## Destructive manifests

`renderDestructiveChanges(members, apiVersion)` and
`renderEmptyPackage(apiVersion)` return XML strings with escaped values and no
filesystem access. The former preserves the supplied member order.

`writeDestructiveManifest(result, { outputBase, apiVersion, deadOnly, dryRun })`
selects `dead` findings when `deadOnly` is true; otherwise it also includes
`testOnly` and `testOfDead`. It deduplicates by ID, sorts by name and enforces
that every test referrer of a `testOnly` finding is included, throwing
`test-pairing-invariant` on failure. Empty selections return `{}` without writes.

Output is `dead-code/destructiveChanges.xml` and `dead-code/package.xml` beneath
the caller's `outputBase`. Dry runs return `manifestDir` and `wouldWrite`; real
runs return `manifestDir` and `manifestFiles`. The writer creates directories
and overwrites existing files. Writes are sequential and can leave partial
output on failure. It neither deploys the manifest nor deletes Apex classes.

See the [error contract](../README.md#errors), [boundary decisions](design/0001-apx-core-boundaries.md),
and `test/dead/` for classification and manifest contract tests.
