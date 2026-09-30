import { access, mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { ApxError } from '../../errors.js';
import type { EngineOptions, GenerationManifest, GenerationPlan, OverwritePolicy } from '../model/types.js';

const ensureNoPlanCollisions = (plan: GenerationPlan): void => {
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

    const skipped =
      overwritePolicy === 'skip' ? existenceResults.filter((r) => r.exists).map((r) => r.artifact.absolutePath) : [];
    const toWrite = overwritePolicy === 'skip' ? existenceResults.filter((r) => !r.exists) : existenceResults;

    const created = await Promise.all(
      toWrite.map(async ({ artifact }) => {
        try {
          await mkdir(dirname(artifact.absolutePath), { recursive: true });
          await writeFile(artifact.absolutePath, artifact.content, 'utf8');
          return artifact.absolutePath;
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          throw new ApxError('write-failed', `Failed to write artifact "${artifact.absolutePath}": ${message}`, {
            absolutePath: artifact.absolutePath,
            cause: error,
          });
        }
      })
    );

    return { created, skipped };
  }
}
