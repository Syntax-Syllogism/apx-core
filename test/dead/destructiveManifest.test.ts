import { mkdtempSync, readFileSync } from 'node:fs';
import { rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { expect } from 'chai';
import { isApxError } from '../../src/errors.js';
import {
  writeDestructiveManifest,
  renderDestructiveChanges,
  renderEmptyPackage,
} from '../../src/dead/destructiveManifest.js';
import type { DeadCodeResult } from '../../src/dead/types.js';

const result = (): DeadCodeResult => ({
  scanned: 5,
  rounds: 1,
  dead: [{ id: '1', name: 'OldHelper', bucket: 'dead', round: 1, reason: 'no inbound references', referrers: [] }],
  testOnly: [
    {
      id: '2',
      name: 'WeatherService',
      bucket: 'test-only',
      round: 1,
      reason: 'only referenced by tests',
      referrers: [{ id: '3', name: 'WeatherServiceTest', type: 'ApexClass' }],
    },
  ],
  testOfDead: [
    {
      id: '3',
      name: 'WeatherServiceTest',
      bucket: 'test-of-dead',
      round: 1,
      reason: 'test for WeatherService',
      referrers: [],
      subject: { id: '2', name: 'WeatherService', type: 'ApexClass' },
    },
  ],
  retained: [{ id: '4', name: 'Retained', bucket: 'retained', round: 0, reason: 'retained', referrers: [] }],
  suppressed: [{ id: '5', name: 'LiveEntry', bucket: 'suppressed', round: 0, reason: '@AuraEnabled', referrers: [] }],
  bindingSources: [],
  withoutSymbolTable: 0,
});

describe('writeDestructiveManifest', () => {
  it('renders XML as pure strings and escapes member names and versions', () => {
    expect(renderDestructiveChanges(['A&B<"\'>'], '60&0')).to.include('<members>A&amp;B&lt;&quot;&apos;&gt;</members>');
    expect(renderEmptyPackage('60&0')).to.include('<version>60&amp;0</version>');
  });
  it('wraps filesystem failures with the manifest path and cause', async () => {
    const root = mkdtempSync(join(tmpdir(), 'apxc-dead-write-'));
    const outputBase = join(root, 'blocker');
    await writeFile(outputBase, 'file');
    try {
      await writeDestructiveManifest(result(), { outputBase, apiVersion: '60.0', deadOnly: false, dryRun: false });
      expect.fail('Expected write failure');
    } catch (error) {
      if (!isApxError(error)) throw error;
      expect(error.code).to.equal('write-failed');
      const data = error.data as { absolutePath: string; cause: Error };
      expect(data.absolutePath).to.equal(join(outputBase, 'dead-code', 'destructiveChanges.xml'));
      expect(data.cause).to.be.instanceOf(Error);
      expect(error.message).to.equal(`Failed to write artifact "${data.absolutePath}": ${data.cause.message}`);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('reports missing paired tests before any writes', async () => {
    const findings = result();
    findings.testOfDead = [];
    try {
      await writeDestructiveManifest(findings, {
        outputBase: '/unused',
        apiVersion: '60.0',
        deadOnly: false,
        dryRun: true,
      });
      expect.fail('Expected test pairing failure');
    } catch (error) {
      expect(isApxError(error)).to.equal(true);
      if (!isApxError(error)) throw error;
      expect(error.code).to.equal('test-pairing-invariant');
      expect(error.message).to.equal('Test pairing invariant failed for WeatherService.');
      expect(error.data).to.deep.equal({ name: 'WeatherService' });
    }
  });
  it('returns an empty result when there are no dead findings', async () => {
    const findings = result();
    findings.dead = [];
    expect(
      await writeDestructiveManifest(findings, {
        outputBase: '/unused',
        apiVersion: '60.0',
        deadOnly: true,
        dryRun: false,
      })
    ).to.deep.equal({});
  });

  it('writes sorted destructive and empty package manifests', async () => {
    const outputBase = mkdtempSync(join(tmpdir(), 'apx-dead-manifest-'));
    const written = await writeDestructiveManifest(result(), {
      outputBase,
      apiVersion: '60.0',
      deadOnly: false,
      dryRun: false,
    });

    expect(written.manifestFiles).to.have.length(2);
    expect(readFileSync(written.manifestFiles![0], 'utf8')).to.include(
      '<members>OldHelper</members>\n        <members>WeatherService</members>'
    );
    expect(readFileSync(written.manifestFiles![1], 'utf8')).to.not.include('<types>');
    await rm(outputBase, { recursive: true, force: true });
  });

  it('honors dead-only and dry-run without writing files', async () => {
    const outputBase = mkdtempSync(join(tmpdir(), 'apx-dead-dry-'));
    const manifest = await writeDestructiveManifest(result(), {
      outputBase,
      apiVersion: '60.0',
      deadOnly: true,
      dryRun: true,
    });

    expect(manifest.wouldWrite).to.have.length(2);
    expect(manifest.manifestFiles).to.equal(undefined);
    await rm(outputBase, { recursive: true, force: true });
  });
});
