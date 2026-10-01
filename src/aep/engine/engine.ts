/* eslint-disable no-await-in-loop -- Writes must finish in order for progress and partial cancellation. */
import { access, mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { ApxError } from '../../errors.js';
import type { EngineOptions, GenerationManifest, GenerationPlan, OverwritePolicy } from '../model/types.js';

export const ensureNoPlanCollisions = (plan: GenerationPlan): void => {
  const seen = new Set<string>();
  for (const artifact of plan.artifacts) {
    if (seen.has(artifact.relativePath)) {
      throw new ApxError(
        'duplicate-path',
        `Generation plan contains duplicate relativePath "${artifact.relativePath}".`,
        { relativePath: artifact.relativePath }
      );
    }
    seen.add(artifact.relativePath);
  }
};

const fileExists = async (absolutePath: string): Promise<boolean> => {
  try {
    await access(absolutePath);
    return true;
  } catch {
    return false;
  }
};

const resolveArtifacts = (
  plan: GenerationPlan,
  baseDir: string
): Array<{ absolutePath: string; relativePath: string; content: string }> =>
  plan.artifacts.map((artifact) => ({
    ...artifact,
    absolutePath: join(baseDir, artifact.relativePath),
  }));

export class GenerationEngine {
  public static async execute(plan: GenerationPlan, options: EngineOptions): Promise<GenerationManifest> {
    ensureNoPlanCollisions(plan);
    const overwritePolicy: OverwritePolicy = options.overwrite ?? 'overwrite';
    const absoluteArtifacts = resolveArtifacts(plan, options.baseDir);

    if (options.dryRun) return { created: [], skipped: [], wouldCreate: absoluteArtifacts.map((a) => a.absolutePath) };

    const existenceResults = await Promise.all(
      absoluteArtifacts.map(async (artifact) => ({
        artifact,
        exists: await fileExists(artifact.absolutePath),
      }))
    );
    if (overwritePolicy === 'error') {
      const existing = existenceResults.find((r) => r.exists);
      if (existing)
        throw new ApxError('file-exists', `Refusing to overwrite existing file: ${existing.artifact.absolutePath}`, {
          absolutePath: existing.artifact.absolutePath,
        });
    }

    const created: string[] = [];
    const skipped: string[] = [];
    const checkCancellation = (): void => {
      if (options.signal?.aborted) throw new ApxError('cancelled', 'Operation cancelled.', { created: [...created] });
    };
    for (const artifact of absoluteArtifacts) {
      checkCancellation();
      let status: 'created' | 'skipped' = 'created';
      try {
        await mkdir(dirname(artifact.absolutePath), { recursive: true });
        // Exclusive creation enforces skip even if a file appears after planning or preflight.
        await writeFile(artifact.absolutePath, artifact.content, {
          encoding: 'utf8',
          flag: overwritePolicy === 'skip' ? 'wx' : 'w',
        });
        created.push(artifact.absolutePath);
      } catch (error) {
        if (overwritePolicy === 'skip' && (error as NodeJS.ErrnoException).code === 'EEXIST') {
          skipped.push(artifact.absolutePath);
          status = 'skipped';
        } else {
          const message = error instanceof Error ? error.message : String(error);
          throw new ApxError('write-failed', `Failed to write artifact "${artifact.absolutePath}": ${message}`, {
            absolutePath: artifact.absolutePath,
            cause: error,
          });
        }
      }
      options.onFile?.({
        absolutePath: artifact.absolutePath,
        status,
        done: created.length + skipped.length,
        total: absoluteArtifacts.length,
      });
    }
    checkCancellation();

    return { created, skipped };
  }
}
