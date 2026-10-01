import type { DeadCodeResult } from '../dead/types.js';
import { MAX_ROUNDS } from '../dead/classify.js';
import { renderTable } from './table.js';
import { deadText, formatText } from './text.js';

export type DeadReportOptions = {
  includeSuppressed?: boolean;
  deadOnly?: boolean;
  username?: string;
  manifestDir?: string;
  dryRun?: boolean;
};
export const renderDeadCodeReport = (result: DeadCodeResult, options: DeadReportOptions = {}): string => {
  const lines = [deadText['info.bindingSources']];
  const info = (key: keyof typeof deadText, ...values: Array<string | number>): void => {
    lines.push(formatText(deadText[key], ...values));
  };
  const warn = (key: keyof typeof deadText, ...values: Array<string | number>): void => {
    lines.push(`Warning: ${formatText(deadText[key], ...values)}`);
  };
  const table = (title: string, columns: string[], rows: Array<Record<string, string | number>>): void => {
    if (rows.length) lines.push(title, renderTable(columns, rows), '');
  };
  for (const source of result.bindingSources) {
    if (source.available) info('info.bindingSourceRow', source.object, source.recordCount);
    else info('info.bindingSourceMissing', source.object);
  }
  if (result.bindingSources.every((source) => !source.available)) warn('warn.noBindingSources');
  warn('warn.stringReferences');
  const cascaded = [...result.dead, ...result.testOnly, ...result.testOfDead, ...result.retained].filter(
    (finding) => finding.round > 1
  ).length;
  if (cascaded) warn('warn.cascade', cascaded);
  if (result.withoutSymbolTable) warn('warn.missingSymbolTable', result.withoutSymbolTable);
  if (result.rounds >= MAX_ROUNDS) warn('warn.maxRounds', MAX_ROUNDS);
  table(
    'DEAD',
    ['ROUND', 'CLASS', 'RISK', 'REASON'],
    result.dead.map((finding) => ({
      ROUND: finding.round,
      CLASS: finding.name,
      RISK: finding.risk ? 'DI?' : '',
      REASON: finding.riskDetail ?? finding.reason,
    }))
  );
  table(
    'TEST-ONLY',
    ['ROUND', 'CLASS', 'TESTS'],
    result.testOnly.map((finding) => ({
      ROUND: finding.round,
      CLASS: finding.name,
      TESTS: finding.referrers.map((ref) => ref.name).join(', '),
    }))
  );
  table(
    'TEST-OF-DEAD',
    ['ROUND', 'CLASS', 'TEST OF'],
    result.testOfDead.map((finding) => ({
      ROUND: finding.round,
      CLASS: finding.name,
      'TEST OF': finding.subject?.name ?? '',
    }))
  );
  table(
    'RETAINED',
    ['CLASS', 'TEST', 'ALSO COVERS'],
    result.retained.flatMap((finding) =>
      finding.referrers.map((test) => ({
        CLASS: finding.name,
        TEST: test.name,
        'ALSO COVERS': finding.blockedBy?.map((ref) => ref.name).join(', ') ?? '',
      }))
    )
  );
  if (options.includeSuppressed) {
    const suppressed = [...result.suppressed].sort(
      (left, right) =>
        Number(right.wouldBeDead ?? false) - Number(left.wouldBeDead ?? false) || left.name.localeCompare(right.name)
    );
    table(
      'SUPPRESSED',
      ['CLASS', 'REASON', 'WOULD BE DEAD'],
      suppressed.map((finding) => ({
        CLASS: finding.name,
        REASON: finding.reason,
        'WOULD BE DEAD': finding.wouldBeDead ? 'yes' : 'no',
      }))
    );
  }
  info(
    'info.summary',
    result.scanned,
    result.rounds,
    result.dead.length,
    result.testOnly.length,
    result.retained.length,
    result.suppressed.length
  );
  const findings = options.deadOnly ? result.dead : [...result.dead, ...result.testOnly, ...result.testOfDead];
  const count = new Set(findings.map(({ id }) => id)).size;
  const manifestDir = options.manifestDir ?? result.manifestDir;
  if (manifestDir && (Boolean(options.dryRun) || Boolean(result.wouldWrite)))
    info('info.dryRunManifest', count, manifestDir);
  else if (manifestDir && (Boolean(options.manifestDir) || Boolean(result.manifestFiles))) {
    info('info.manifestWritten', count, manifestDir);
    info('info.nextStep');
    lines.push(
      `sf project deploy start --target-org ${
        options.username ?? '<org>'
      } --manifest ${manifestDir}/package.xml --post-destructive-changes ${manifestDir}/destructiveChanges.xml`
    );
  } else if (!result.dead.length && !result.testOnly.length) info('info.noResults');
  return lines.join('\n');
};
