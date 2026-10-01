import type { Connection } from '@salesforce/core';
import { z } from 'zod';
import { ApxError } from './errors.js';

export type ProgressEvent = {
  phase: string;
  done?: number;
  total?: number;
  message?: string;
};

export type UseCaseContext = {
  onProgress?: (event: ProgressEvent) => void;
  signal?: AbortSignal;
};

export type UiHint = {
  kind: 'file' | 'folder' | 'multiString' | 'string' | 'boolean' | 'enum';
  label: string;
  summary?: string;
  placeholder?: string;
  fileFilter?: 'json' | 'csv' | 'json-or-csv';
  /** The caller asks for exactly one option in the group. */
  exclusiveGroup?: string;
  dependsOn?: string;
};

export type OrgRequirement = 'required' | 'optional' | 'none';
export type ApxUseCaseContext = UseCaseContext & { projectRoot?: string };
export type GenerationApplyContext = ApxUseCaseContext & { overwrite?: 'overwrite' | 'skip' };

export type CommandDescriptor<S extends z.ZodType = z.ZodType> = {
  id: string;
  cliId: string;
  title: string;
  group: 'generate' | 'analyze';
  destructive: boolean;
  requiresOrg: OrgRequirement;
  optionsSchema: S;
};
export type ReadUseCase<S extends z.ZodType, R> = {
  kind: 'read';
  descriptor: CommandDescriptor<S>;
  run(conn: Connection | undefined, options: z.output<S>, ctx?: ApxUseCaseContext): Promise<R>;
};
export type WriteUseCase<S extends z.ZodType, P, R> = {
  kind: 'write';
  descriptor: CommandDescriptor<S>;
  plan(conn: Connection | undefined, options: z.output<S>, ctx?: ApxUseCaseContext): Promise<P>;
  apply(conn: Connection | undefined, plan: P, ctx?: GenerationApplyContext): Promise<R>;
};
export type UseCase<S extends z.ZodType, R> = ReadUseCase<S, R> | WriteUseCase<S, unknown, R>;

export const requireConnection = (conn: Connection | undefined, descriptor: CommandDescriptor): Connection => {
  if (!conn)
    throw new ApxError('org-required', `${descriptor.title} requires an org connection.`, { commandId: descriptor.id });
  return conn;
};

export const uiHints = <S extends z.ZodType>(schema: S): Record<string, UiHint> => {
  if (!(schema instanceof z.ZodObject)) return {};
  return Object.fromEntries(
    Object.entries(schema.shape).flatMap(([key, field]) => {
      let current: unknown = field;
      let meta: { ui?: UiHint } | undefined;
      while (current != null) {
        const candidate = current as { meta?: () => { ui?: UiHint }; unwrap?: () => unknown };
        meta = candidate.meta?.();
        if (meta?.ui ?? !candidate.unwrap) break;
        current = candidate.unwrap();
      }
      return meta?.ui ? [[key, meta.ui]] : [];
    })
  );
};

export const checkCancelled = (ctx?: UseCaseContext): void => {
  if (ctx?.signal?.aborted) throw new ApxError('cancelled', 'Operation cancelled.');
};

export const startProgress = (ctx?: UseCaseContext, phase = 'start'): void => {
  checkCancelled(ctx);
  ctx?.onProgress?.({ phase });
  checkCancelled(ctx);
};

export const endProgress = (ctx?: UseCaseContext, phase = 'complete'): void => {
  checkCancelled(ctx);
  ctx?.onProgress?.({ phase });
  checkCancelled(ctx);
};
