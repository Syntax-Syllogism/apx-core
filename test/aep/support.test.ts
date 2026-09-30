import { mkdtemp, writeFile, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect } from 'chai';
import sinon from 'sinon';
import { SfProject } from '@salesforce/core';
import { isApxError } from '../../src/errors.js';
import {
  describeTarget,
  resolveApiVersion,
  resolveOutputBase,
  resolveProjectApiVersion,
  isValidOrderValue,
  isWithinCustomMetadataNameLimit,
} from '../../src/aep/support.js';

describe('AEP support', () => {
  let root: string;
  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'apxc-support-'));
  });
  afterEach(async () => {
    sinon.restore();
    await rm(root, { recursive: true, force: true });
  });

  it('resolves relative output against an explicit root', async () => {
    expect(await resolveOutputBase('generated-files', root)).to.equal(join(root, 'generated-files'));
  });
  it('uses the current Salesforce project when root is omitted', async () => {
    const resolve = sinon.stub(SfProject, 'resolveProjectPath').resolves(root);
    expect(await resolveOutputBase('generated-files')).to.equal(join(root, 'generated-files'));
    expect(resolve.calledOnce).to.equal(true);
  });
  it('preserves absolute output paths with or without a project', async () => {
    const resolve = sinon.stub(SfProject, 'resolveProjectPath').rejects(new Error('no project'));
    expect(await resolveOutputBase(root, '/another/root')).to.equal(root);
    expect(await resolveOutputBase(root)).to.equal(root);
    expect(resolve.called).to.equal(false);
  });
  it('reads the API version from an explicit project root', async () => {
    await writeFile(
      join(root, 'sfdx-project.json'),
      JSON.stringify({ packageDirectories: [], namespace: '', sourceApiVersion: '63.0' })
    );
    expect(await resolveProjectApiVersion(root)).to.equal('63.0');
  });
  it('returns undefined outside a project', async () => {
    expect(await resolveProjectApiVersion(root)).to.equal(undefined);
  });
  it('propagates failures other than a missing project', async () => {
    const failure = new Error('invalid project configuration');
    sinon.stub(SfProject, 'resolve').rejects(failure);
    try {
      await resolveProjectApiVersion(root);
      expect.fail('Expected failure');
    } catch (error) {
      expect(error).to.equal(failure);
    }
  });
  it('lets an explicit API version override the connection', async () => {
    const getApiVersion = sinon.stub().returns('62.0');
    expect(await resolveApiVersion({ explicit: '61.0', conn: { getApiVersion } })).to.equal('61.0');
    expect(getApiVersion.called).to.equal(false);
  });
  it('uses the connection version without an explicit flag', async () => {
    expect(await resolveApiVersion({ conn: { getApiVersion: () => '62.0' } })).to.equal('62.0');
  });
  it('uses 60.0 without a connection even if a project is supplied', async () => {
    expect(await resolveApiVersion({ projectRoot: root })).to.equal('60.0');
    expect(await resolveApiVersion({ explicit: '61.0' })).to.equal('61.0');
  });
  it('describes through the supplied connection', async () => {
    const raw: unknown = JSON.parse(await readFile('test/fixtures/aep/describe/account.json', 'utf8'));
    const describeSObject = sinon.stub().resolves(raw);
    const view = await describeTarget({ describeSObject }, 'Account');
    expect(view.apiName).to.equal('Account');
    expect(view.fieldNames).to.include('Name');
    expect(describeSObject.calledOnceWithExactly('Account')).to.equal(true);
  });
  for (const key of ['name', 'code', 'errorCode']) {
    it(`maps NOT_FOUND from ${key} to sobject-not-found`, async () => {
      const cause = Object.assign(new Error('Object does not exist'), { [key]: 'NOT_FOUND' });
      try {
        await describeTarget({ describeSObject: sinon.stub().rejects(cause) }, 'Missing__c');
        expect.fail('Expected failure');
      } catch (error) {
        expect(isApxError(error)).to.equal(true);
        if (!isApxError(error)) throw error;
        expect(error.code).to.equal('sobject-not-found');
        expect(error.message).to.equal('Object does not exist');
        expect(error.data).to.deep.equal({ sobject: 'Missing__c' });
      }
    });
  }
  it('maps other describe failures and retains their cause', async () => {
    const cause = new Error('Network failed');
    try {
      await describeTarget({ describeSObject: sinon.stub().rejects(cause) }, 'Account');
      expect.fail('Expected failure');
    } catch (error) {
      expect(isApxError(error)).to.equal(true);
      if (!isApxError(error)) throw error;
      expect(error.code).to.equal('describe-failed');
      expect(error.message).to.equal('Network failed');
      expect(error.data).to.deep.equal({ sobject: 'Account', cause });
    }
  });
  it('validates order and metadata name limits', () => {
    expect(isValidOrderValue('10.20')).to.equal(true);
    for (const value of ['-1', '1.', 'a', '']) expect(isValidOrderValue(value)).to.equal(false);
    expect(isWithinCustomMetadataNameLimit('a'.repeat(40))).to.equal(true);
    expect(isWithinCustomMetadataNameLimit('a'.repeat(41))).to.equal(false);
  });
});
