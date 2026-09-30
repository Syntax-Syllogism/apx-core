/** Stable codes thrown by the extracted AEP and dead-code domains. */
export type ApxErrorCode =
  | 'duplicate-path'
  | 'file-exists'
  | 'write-failed'
  | 'template-missing'
  | 'template-empty'
  | 'test-pairing-invariant'
  | 'sobject-not-found'
  | 'describe-failed';

/**
 * Base error for everything apx-core throws on purpose.
 *
 * `code` and the shape of `data` are part of the public API and are
 * semver-covered; `message` is default English text that callers may show
 * as is or replace using `code`. Area-specific subclasses narrow `C` to a
 * string-literal union of their codes.
 */
export class ApxError<C extends string = string, D = unknown> extends Error {
  public constructor(public readonly code: C, message: string, public readonly data?: D) {
    super(message);
    this.name = 'ApxError';
  }
}

/**
 * Structural check for {@link ApxError}. Prefer this over `instanceof`,
 * which fails when a consumer ends up with two copies of this package.
 */
export const isApxError = (error: unknown): error is ApxError =>
  error instanceof ApxError ||
  (typeof error === 'object' &&
    error !== null &&
    (error as { name?: unknown }).name === 'ApxError' &&
    typeof (error as { code?: unknown }).code === 'string' &&
    typeof (error as { message?: unknown }).message === 'string');
