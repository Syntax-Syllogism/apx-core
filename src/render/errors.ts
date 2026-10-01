import { ZodError } from 'zod';
import { isApxError } from '../errors.js';

export const describeError = (error: unknown): { title: string; detail?: string } => {
  if (isApxError(error)) return { title: error.message };
  if (error instanceof ZodError)
    return {
      title: error.issues[0]?.message ?? 'Invalid options.',
      ...(error.issues.length > 1
        ? {
            detail: error.issues
              .slice(1)
              .map((issue) => issue.message)
              .join('\n'),
          }
        : {}),
    };
  return { title: error instanceof Error ? error.message : String(error) };
};
