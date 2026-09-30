import { expect } from 'chai';
import { ApxError, isApxError } from '../src/errors.js';

describe('ApxError', () => {
  it('carries code, message, and data', () => {
    const error = new ApxError('file-exists', 'File exists', { absolutePath: '/tmp/A.cls' });
    expect(error).to.be.instanceOf(Error);
    expect(error.name).to.equal('ApxError');
    expect(error.code).to.equal('file-exists');
    expect(error.message).to.equal('File exists');
    expect(error.data).to.deep.equal({ absolutePath: '/tmp/A.cls' });
  });

  it('allows data to be omitted', () => {
    expect(new ApxError('cancelled', 'Cancelled').data).to.equal(undefined);
  });
});

describe('isApxError', () => {
  it('recognizes instances', () => {
    expect(isApxError(new ApxError('cancelled', 'Cancelled'))).to.equal(true);
  });

  it('recognizes a structurally cloned ApxError from another package copy', () => {
    const clone: unknown = structuredClone({ name: 'ApxError', code: 'cancelled', message: 'Cancelled' });
    expect(isApxError(clone)).to.equal(true);
  });

  it('rejects other values', () => {
    expect(isApxError(new Error('plain'))).to.equal(false);
    expect(isApxError({ name: 'ApxError', message: 'no code' })).to.equal(false);
    expect(isApxError(null)).to.equal(false);
    expect(isApxError('ApxError')).to.equal(false);
  });
});
