import { deadOptionsSchema } from '../commandOptions.js';
import { fetchClassInventory } from '../dead/inventory.js';
import { scanBindings } from '../dead/bindings.js';
import { fetchDependencyGraph } from '../dead/dependencies.js';
import { classifyClasses } from '../dead/classify.js';
import {
  renderManifest,
  writeRenderedManifest,
  type RenderedDeadManifest,
  type ManifestResult,
} from '../dead/destructiveManifest.js';
import type { DeadCodeResult, DeadConnection } from '../dead/types.js';
import { resolveApiVersion } from '../aep/support.js';
import { checkCancelled, startProgress, requireConnection, type ReadUseCase } from '../useCase.js';

export type DeadUseCaseResult = DeadCodeResult & { manifest?: RenderedDeadManifest };
export const dead: ReadUseCase<typeof deadOptionsSchema, DeadUseCaseResult> = {
  kind: 'read',
  descriptor: {
    id: 'dead',
    cliId: 'apx:dead',
    title: 'Find Dead Code',
    group: 'analyze',
    destructive: false,
    requiresOrg: 'required',
    optionsSchema: deadOptionsSchema,
  },
  async run(conn, options, ctx) {
    checkCancelled(ctx);
    const connection = requireConnection(conn, dead.descriptor);
    const parsed = deadOptionsSchema.parse(options);
    const queries = connection as unknown as DeadConnection;
    startProgress(ctx, 'inventory');
    const candidates = await fetchClassInventory(queries);
    startProgress(ctx, 'bindings');
    const bindings = await scanBindings(queries);
    startProgress(ctx, 'dependencies');
    const graph = await fetchDependencyGraph(
      queries,
      candidates.map(({ id }) => id)
    );
    startProgress(ctx, 'classify');
    const result: DeadUseCaseResult = {
      ...classifyClasses({ candidates, ...graph, boundClasses: bindings.boundClasses, ignorePatterns: parsed.ignore }),
      bindingSources: bindings.reports,
    };
    if (parsed.destructiveManifest) {
      startProgress(ctx, 'manifest');
      const apiVersion = await resolveApiVersion({ conn: connection, explicit: parsed.apiVersion });
      checkCancelled(ctx);
      result.manifest = renderManifest(result, apiVersion, parsed.deadOnly);
    }
    checkCancelled(ctx);
    return result;
  },
};

/** Write exactly the pure manifest returned by dead.run; no org calls or reclassification. */
export const writeDeadCodeManifest = (
  result: DeadUseCaseResult,
  outputBase: string,
  options: { dryRun?: boolean } = {}
): Promise<ManifestResult> => writeRenderedManifest(result.manifest, outputBase, options.dryRun ?? false);
