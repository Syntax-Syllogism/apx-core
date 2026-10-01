/* eslint-disable no-await-in-loop -- Observe cancellation between filesystem inspections. */
import { stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import { GenerationEngine, ensureNoPlanCollisions } from '../aep/engine/engine.js';
import type { AepCommandResult, ArtifactId, GenerationPlan } from '../aep/model/types.js';
import { checkCancelled, type GenerationApplyContext, type ApxUseCaseContext } from '../useCase.js';

export type PlannedFile = {
  artifactId: ArtifactId;
  relativePath: string;
  absolutePath: string;
  content: string;
  status: 'new' | 'exists';
};
export type GenerationPreview = {
  commandId: string;
  baseDir: string;
  files: PlannedFile[];
  manualSteps?: string[];
};
export type GenerationOutcome = AepCommandResult;

export const planGeneration = async (
  plan: GenerationPlan,
  baseDir: string,
  commandId: string,
  manualSteps?: string[],
  ctx?: ApxUseCaseContext
): Promise<GenerationPreview> => {
  checkCancelled(ctx);
  ensureNoPlanCollisions(plan);
  const files: PlannedFile[] = [];
  for (const artifact of plan.artifacts) {
    checkCancelled(ctx);
    const absolutePath = resolve(baseDir, artifact.relativePath);
    let status: PlannedFile['status'] = 'new';
    try {
      await stat(absolutePath);
      status = 'exists';
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
    files.push({
      artifactId: artifact.id,
      relativePath: artifact.relativePath,
      absolutePath,
      content: artifact.content,
      status,
    });
  }
  checkCancelled(ctx);
  return { commandId, baseDir: resolve(baseDir), files, ...(manualSteps ? { manualSteps } : {}) };
};

export const applyGeneration = async (
  preview: GenerationPreview,
  ctx?: GenerationApplyContext
): Promise<GenerationOutcome> => {
  const manifest = await GenerationEngine.execute(
    {
      artifacts: preview.files.map((file) => ({
        id: file.artifactId,
        relativePath: file.relativePath,
        content: file.content,
      })),
    },
    {
      baseDir: preview.baseDir,
      overwrite: ctx?.overwrite ?? 'overwrite',
      signal: ctx?.signal,
      onFile: ({ done, total }) => ctx?.onProgress?.({ phase: 'write', done, total }),
    }
  );
  return {
    baseDir: preview.baseDir,
    ...manifest,
    ...(preview.manualSteps ? { manualSteps: preview.manualSteps } : {}),
  };
};
