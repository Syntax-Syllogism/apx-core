import { readFile } from 'node:fs/promises';
import { expect } from 'chai';
import { renderDeadCodeReport } from '../../src/render/dead.js';
import { renderTable } from '../../src/render/table.js';
import type { ComponentRef, DeadClassFinding, DeadCodeResult } from '../../src/dead/types.js';

const ref = (name: string): ComponentRef => ({ id: name, name, type: 'ApexClass' });
const finding = (name: string, bucket: DeadClassFinding['bucket'], extra: Partial<DeadClassFinding> = {}) => ({
  id: name,
  name,
  bucket,
  round: 1,
  reason: 'no inbound references',
  referrers: [],
  ...extra,
});
const alsoCovers = [
  'wdn_AppFactory',
  'wdn_IDmlGateway',
  'wdn_IGroupMemberSelector',
  'wdn_IGroupSelector',
  'wdn_IPermissionSetAssignmentSelector',
  'wdn_IPermissionSetGroupSelector',
  'wdn_IPermissionSetSelector',
  'wdn_IPersonaAssignmentSelector',
  'wdn_IPersonaComponentSelector',
  'wdn_IProvisionedGrantSelector',
  'wdn_ReconcilerService',
  'wdn_ReconciliationException',
  'wdn_ReconciliationScope',
].map(ref);

/** Equivalent to the real-org result captured from the pre-extraction apx plugin. */
const result: DeadCodeResult = {
  scanned: 70,
  rounds: 1,
  withoutSymbolTable: 0,
  bindingSources: [
    'ApplicationFactory_ServiceBinding__mdt',
    'ApplicationFactory_SelectorBinding__mdt',
    'ApplicationFactory_DomainBinding__mdt',
    'DomainProcessBinding__mdt',
  ].map((object) => ({ object, available: false, recordCount: 0 })),
  dead: ['PluginSmokeReference', 'PluginSmokeUserSeed', 'PSM_Apx_DeadLeaf'].map((name) => finding(name, 'dead')),
  testOnly: [finding('PSM_Apx_TestOnlySubject', 'test-only', { referrers: [ref('PSM_Apx_TestOnlySubjectTest')] })],
  testOfDead: [finding('PSM_Apx_TestOnlySubjectTest', 'test-of-dead', { subject: ref('PSM_Apx_TestOnlySubject') })],
  retained: [
    finding('wdn_ConformanceFixtures', 'retained', {
      referrers: [ref('wdn_ConformanceFixturesTest'), ref('wdn_ReconcilerServiceTest')],
      blockedBy: alsoCovers,
    }),
  ],
  suppressed: Array.from({ length: 21 }, (_, index) => finding(`Suppressed${index}`, 'suppressed')),
};

describe('dead report rendering', () => {
  it('reproduces the pre-extraction apx plugin output byte for byte', async () => {
    const golden = await readFile('test/fixtures/render/dead-golden.txt', 'utf8');
    expect(`${renderDeadCodeReport(result)}\n`).to.equal(golden);
  });

  it('renders the suppressed table in the oclif ux.table layout', () => {
    const report = renderDeadCodeReport(
      {
        ...result,
        dead: [],
        testOnly: [],
        testOfDead: [],
        retained: [],
        suppressed: [
          finding('Zeta', 'suppressed', { reason: '@IsTest', wouldBeDead: false }),
          finding('Beta', 'suppressed', { reason: 'ignored by pattern', wouldBeDead: false }),
          finding('Alpha', 'suppressed', { reason: '@InvocableMethod', wouldBeDead: true }),
        ],
      },
      { includeSuppressed: true }
    );
    expect(report).to.contain(
      [
        'before deleting.',
        'SUPPRESSED',
        '┌───────┬────────────────────┬───────────────┐',
        '│ Class │ Reason             │ Would Be Dead │',
        '├───────┼────────────────────┼───────────────┤',
        '│ Alpha │ @InvocableMethod   │ yes           │',
        '│ Beta  │ ignored by pattern │ no            │',
        '│ Zeta  │ @IsTest            │ no            │',
        '└───────┴────────────────────┴───────────────┘',
        '',
        'Scanned 70 classes over 1 round(s): 0 dead, 0 test-only, 0 retained, 3 suppressed.',
      ].join('\n')
    );
  });

  it('renders ANSI-free box tables with Title Case headers and empty cells', () => {
    const table = renderTable(['ROUND', 'TEST OF', 'WOULD_BE-DEAD'], [{ ROUND: 1 }]);
    expect(table).to.equal(
      [
        '┌───────┬─────────┬───────────────┐',
        '│ Round │ Test Of │ Would Be Dead │',
        '├───────┼─────────┼───────────────┤',
        '│ 1     │         │               │',
        '└───────┴─────────┴───────────────┘',
      ].join('\n')
    );
    expect(table).not.to.contain('\u001b');
  });
});
