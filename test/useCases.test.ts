/* eslint-disable no-await-in-loop -- These cases exercise sequential writes and cancellation against a shared temp directory. */
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { expect } from 'chai';
import { z } from 'zod';
import {
  ApxError,
  commandDescriptors,
  useCases,
  uiHints,
  file,
  text,
  boolean,
  enumValue,
  checkCancelled,
  startProgress,
  endProgress,
  generate,
  generateSelector,
  generateDomain,
  generateService,
  generateUnitOfWork,
  generateSelectorMethod,
  generateSelectorFieldInjection,
  generateAction,
  generateCriteria,
  dead,
  planGeneration,
  applyGeneration,
  writeDeadCodeManifest,
  renderGenerationPlan,
  renderGenerationResult,
  renderDeadCodeReport,
  describeError,
  type GenerationPreview,
  type ProgressEvent,
  type DeadCodeResult,
} from '../src/index.js';
import { renderTable } from '../src/render/table.js';
import { stubConnection } from './helpers/stubConnection.js';

const failure = async (operation: Promise<unknown>, code: string): Promise<ApxError> => {
  try {
    await operation;
  } catch (error) {
    expect(error).to.be.instanceOf(ApxError);
    expect((error as ApxError).code).to.equal(code);
    return error as ApxError;
  }
  throw new Error(`Expected ${code}`);
};
const objectOptions = { sobject: 'Account', flavor: 'at4dx' };
const processOptions = { sobject: 'Account', className: 'Example', order: '10.1' };

describe('command use cases', () => {
  let root: string;
  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'apx-use-case-'));
  });
  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it('registers all ten commands, with UI hints on every option and verified org requirements', () => {
    expect(Object.keys(useCases)).to.have.length(10);
    expect(commandDescriptors.map(({ cliId }) => cliId)).to.deep.equal([
      'apx:generate',
      'apx:generate:selector',
      'apx:generate:domain',
      'apx:generate:service',
      'apx:generate:unitofwork',
      'apx:generate:selector:method',
      'apx:generate:selector:field-injection',
      'apx:generate:action',
      'apx:generate:criteria',
      'apx:dead',
    ]);
    expect(commandDescriptors.map(({ requiresOrg }) => requiresOrg)).to.deep.equal([
      'required',
      'required',
      'required',
      'optional',
      'required',
      'none',
      'none',
      'none',
      'none',
      'required',
    ]);
    for (const descriptor of commandDescriptors) {
      expect(descriptor.destructive).to.equal(false);
      expect(Object.keys(uiHints(descriptor.optionsSchema)).sort()).to.deep.equal(
        Object.keys(descriptor.optionsSchema.shape).sort()
      );
      expect(uiHints(descriptor.optionsSchema).outputPath.kind).to.equal('folder');
      expect(descriptor.optionsSchema.shape).not.to.have.keys('interactive', 'dryRun');
    }
    expect(uiHints(dead.descriptor.optionsSchema).deadOnly.dependsOn).to.equal('destructiveManifest');
    expect(uiHints(generateSelectorFieldInjection.descriptor.optionsSchema).fields.kind).to.equal('multiString');
    expect(uiHints(z.string())).to.deep.equal({});
    expect(
      uiHints(
        z.object({
          noHint: z.string(),
          nested: text('Nested').optional().default('ok'),
          f: file('Data'),
          b: boolean('Yes'),
          e: enumValue(['a', 'b'], 'Choice'),
        })
      )
    ).to.deep.equal({
      nested: { kind: 'string', label: 'Nested' },
      f: { kind: 'file', label: 'Data', fileFilter: 'json' },
      b: { kind: 'boolean', label: 'Yes' },
      e: { kind: 'enum', label: 'Choice' },
    });
  });

  it('preserves validation text, defaults and the absence of a default flavor', () => {
    for (const command of [generateAction, generateCriteria]) {
      const schema = command.descriptor.optionsSchema;
      const invalid = schema.safeParse({ ...processOptions, order: '-1' });
      expect(invalid.success).to.equal(false);
      if (!invalid.success)
        expect(describeError(invalid.error).title).to.equal(
          '`--order` must be a decimal-like value such as `10.1` or `10.2`.'
        );
      const longName = schema.safeParse({ ...processOptions, className: 'X'.repeat(41) });
      if (longName.success) throw new Error('Expected name validation');
      expect(describeError(longName.error).title).to.equal(
        `The generated binding developer name \`${'X'.repeat(41)}\` is longer than the 40-character Salesforce limit.`
      );
      expect(schema.safeParse({ ...processOptions, processName: 'X'.repeat(40) }).success).to.equal(false);
      expect(schema.parse({ sobject: 'Account', className: 'Example' })).to.include({
        order: '10.1',
        triggerOperation: 'Before_Insert',
        outputPath: 'generated-files',
      });
    }
    const injection = generateSelectorFieldInjection.descriptor.optionsSchema;
    const empty = injection.safeParse({ sobject: 'Account', fields: [] });
    if (empty.success) throw new Error('Expected fields validation');
    expect(describeError(empty.error).title).to.equal('At least one field must be provided in --fields.');
    const longFieldset = injection.safeParse({
      sobject: 'Account',
      fields: ['Name'],
      fieldsetName: ` ${'X'.repeat(41)} `,
    });
    if (longFieldset.success) throw new Error('Expected fieldset validation');
    expect(describeError(longFieldset.error).title).to.equal(
      `The generated field set name \`${'X'.repeat(41)}\` is longer than the 40-character Salesforce limit.`
    );
    expect(injection.parse({ sobject: 'Account', fields: [' Name '], fieldsetName: '  ' }).fields).to.deep.equal([
      'Name',
    ]);
    expect(injection.safeParse({ sobject: 'Account', fields: [' '] }).success).to.equal(false);
    expect(generateSelector.descriptor.optionsSchema.safeParse({ sobject: 'Account' }).success).to.equal(false);
    expect(
      generateSelector.descriptor.optionsSchema.safeParse({ ...objectOptions, flavor: 'unknown' }).success
    ).to.equal(false);
    expect(generateUnitOfWork.descriptor.optionsSchema.parse(objectOptions).bindingSequence).to.equal('1000.0');
    for (const [options, message] of [
      [{}, 'Specify --classes.'],
      [{ destructiveManifest: true }, '--destructive-manifest requires --classes.'],
      [{ classes: true, deadOnly: true }, '--dead-only requires --destructive-manifest.'],
    ] as const) {
      const invalid = dead.descriptor.optionsSchema.safeParse(options);
      if (invalid.success) throw new Error('Expected dead validation');
      expect(describeError(invalid.error).title).to.equal(message);
    }
  });

  it('requires connections before org queries and rejects an empty aggregate', async () => {
    const commands = [generate, generateSelector, generateDomain, generateUnitOfWork];
    for (const command of commands) {
      // All schemas accept this aggregate superset and remove unused keys.
      const options = command.descriptor.optionsSchema.parse({ ...objectOptions, selector: true });
      await failure(command.plan(undefined, options as never, { projectRoot: root }), 'org-required');
    }
    await failure(dead.run(undefined, dead.descriptor.optionsSchema.parse({ classes: true })), 'org-required');
    const stub = stubConnection();
    const error = await failure(
      generate.plan(stub.conn, {
        ...generate.descriptor.optionsSchema.parse({ ...objectOptions, selector: true }),
        selector: false,
      }),
      'nothing-selected'
    );
    expect(error.message).to.equal('Select at least one artifact group: --selector, --domain, or --unit-of-work.');
    expect(stub.describeSObject.called).to.equal(false);
  });

  it('plans and applies all nine generators against an explicit project root', async () => {
    const stub = stubConnection();
    const plans = [
      generate.plan(
        stub.conn,
        generate.descriptor.optionsSchema.parse({ ...objectOptions, selector: true, domain: true, unitOfWork: true }),
        { projectRoot: root }
      ),
      generateSelector.plan(stub.conn, generateSelector.descriptor.optionsSchema.parse(objectOptions), {
        projectRoot: root,
      }),
      generateDomain.plan(stub.conn, generateDomain.descriptor.optionsSchema.parse(objectOptions), {
        projectRoot: root,
      }),
      generateUnitOfWork.plan(stub.conn, generateUnitOfWork.descriptor.optionsSchema.parse(objectOptions), {
        projectRoot: root,
      }),
      generateService.plan(
        undefined,
        generateService.descriptor.optionsSchema.parse({ serviceBasename: 'Billing', flavor: 'fflib' }),
        { projectRoot: root }
      ),
      generateSelectorMethod.plan(
        undefined,
        generateSelectorMethod.descriptor.optionsSchema.parse({
          ...processOptions,
          sobjectSelectorClassName: 'AccountsSelector',
        }),
        { projectRoot: root }
      ),
      generateSelectorFieldInjection.plan(
        undefined,
        generateSelectorFieldInjection.descriptor.optionsSchema.parse({ sobject: 'Account', fields: ['Name'] }),
        { projectRoot: root }
      ),
      generateAction.plan(undefined, generateAction.descriptor.optionsSchema.parse(processOptions), {
        projectRoot: root,
      }),
      generateCriteria.plan(undefined, generateCriteria.descriptor.optionsSchema.parse(processOptions), {
        projectRoot: root,
      }),
    ];
    const previews = await Promise.all(plans);
    expect(previews.map(({ files }) => files.length)).to.deep.equal([17, 7, 9, 1, 10, 4, 2, 5, 5]);
    for (const preview of previews) {
      expect(preview.baseDir).to.equal(join(root, 'generated-files'));
      expect(preview.files.every((f) => f.status === 'new')).to.equal(true);
      const outcome = await useCases[preview.commandId as Exclude<keyof typeof useCases, 'dead'>].apply(
        undefined,
        preview
      );
      expect(outcome.created).to.deep.equal(preview.files.map((f) => f.absolutePath));
      expect(await readFile(preview.files[0].absolutePath, 'utf8')).to.equal(preview.files[0].content);
    }
  });

  it('reports mixed status and honors skip/overwrite, including files appearing or disappearing after plan', async () => {
    const command = generateService;
    const options = command.descriptor.optionsSchema.parse({ serviceBasename: 'Billing', flavor: 'at4dx' });
    const preview = await command.plan(undefined, options, { projectRoot: root });
    await mkdir(dirname(preview.files[0].absolutePath), { recursive: true });
    await writeFile(preview.files[0].absolutePath, 'keep');
    const mixed = await command.plan(undefined, options, { projectRoot: root });
    expect(mixed.files.map((f) => f.status)).to.deep.equal(['exists', ...preview.files.slice(1).map(() => 'new')]);
    await writeFile(mixed.files[1].absolutePath, 'appeared');
    const events: ProgressEvent[] = [];
    const skipped = await command.apply(undefined, mixed, {
      overwrite: 'skip',
      onProgress: (event) => events.push(event),
    });
    expect(skipped.skipped).to.deep.equal(mixed.files.slice(0, 2).map((f) => f.absolutePath));
    expect(await readFile(mixed.files[0].absolutePath, 'utf8')).to.equal('keep');
    expect(await readFile(mixed.files[1].absolutePath, 'utf8')).to.equal('appeared');
    expect(events).to.deep.equal(
      mixed.files.map((_f, index) => ({ phase: 'write', done: index + 1, total: mixed.files.length }))
    );
    await rm(mixed.files[0].absolutePath);
    const overwritten = await command.apply(undefined, mixed, { overwrite: 'overwrite' });
    expect(overwritten.created).to.have.length(mixed.files.length);
    expect(await readFile(mixed.files[0].absolutePath, 'utf8')).to.equal(mixed.files[0].content);
  });

  it('rejects duplicate paths at preview time, before any filesystem writes', async () => {
    const artifact = { id: 'selectorClass' as const, relativePath: 'same.cls', content: 'x' };
    await failure(planGeneration({ artifacts: [artifact, artifact] }, root, 'duplicate'), 'duplicate-path');
  });

  it('throws cancelled with the completed file list and checks after the last callback', async () => {
    const preview = await generateService.plan(
      undefined,
      generateService.descriptor.optionsSchema.parse({ serviceBasename: 'Billing', flavor: 'at4dx' }),
      { projectRoot: root }
    );
    const controller = new AbortController();
    const error = await failure(
      applyGeneration(preview, { signal: controller.signal, onProgress: () => controller.abort() }),
      'cancelled'
    );
    expect(error.data).to.deep.equal({ created: [preview.files[0].absolutePath] });
    expect(await readFile(preview.files[0].absolutePath, 'utf8')).to.equal(preview.files[0].content);
    try {
      await readFile(preview.files[1].absolutePath);
      throw new Error('Unexpected write');
    } catch (cause) {
      expect((cause as NodeJS.ErrnoException).code).to.equal('ENOENT');
    }
    await failure(applyGeneration({ ...preview, files: [] }, { signal: controller.signal }), 'cancelled');
    const last = new AbortController();
    await failure(
      applyGeneration(
        { ...preview, files: preview.files.slice(0, 1) },
        { signal: last.signal, onProgress: () => last.abort() }
      ),
      'cancelled'
    );
    await failure(
      generateService.plan(
        undefined,
        generateService.descriptor.optionsSchema.parse({ serviceBasename: 'Billing', flavor: 'at4dx' }),
        { signal: controller.signal, projectRoot: root }
      ),
      'cancelled'
    );
    expect(() => checkCancelled({ signal: controller.signal })).to.throw('Operation cancelled.');
    startProgress();
    endProgress();
  });

  it('returns fflib manual steps without creating files, including aggregate generation', async () => {
    const stub = stubConnection();
    for (const command of [generateUnitOfWork, generate]) {
      const parsed = command.descriptor.optionsSchema.parse({ sobject: 'Account', flavor: 'fflib', unitOfWork: true });
      const preview = await command.plan(stub.conn, parsed as never, { projectRoot: root });
      expect(preview.files).to.deep.equal([]);
      expect(preview.manualSteps).to.deep.equal([
        'Please add the following binding to Application.cls (fflib_Application.UnitOfWorkFactory entry):',
        'Account.SObjectType',
      ]);
      // eslint-disable-next-line prefer-spread -- apply is a use-case method, not Function.apply.
      expect(await command.apply(undefined, preview)).to.deep.equal({
        baseDir: preview.baseDir,
        created: [],
        skipped: [],
        manualSteps: preview.manualSteps,
      });
    }
  });

  it('uses optional service connections only for API version, and ignores connections for org-free commands', async () => {
    const stub = stubConnection();
    const options = generateService.descriptor.optionsSchema.parse({
      serviceBasename: 'Billing',
      flavor: 'at4dx',
      outputPath: root,
    });
    const preview = await generateService.plan(stub.conn, options);
    expect(preview.files.find((f) => f.artifactId === 'apexClassMeta')?.content).to.contain(
      '<apiVersion>62.0</apiVersion>'
    );
    const explicit = await generateService.plan(stub.conn, { ...options, apiVersion: '61.0' });
    expect(explicit.files.find((f) => f.artifactId === 'apexClassMeta')?.content).to.contain(
      '<apiVersion>61.0</apiVersion>'
    );
    const noOrg = await generateAction.plan(
      stub.conn,
      generateAction.descriptor.optionsSchema.parse({ ...processOptions, outputPath: root })
    );
    expect(noOrg.files.find((f) => f.artifactId === 'apexClassMeta')?.content).to.contain(
      '<apiVersion>60.0</apiVersion>'
    );
    expect(stub.describeSObject.called).to.equal(false);
  });

  it('runs dead analysis without writing and writes the returned manifest separately', async () => {
    const stub = stubConnection();
    const events: ProgressEvent[] = [];
    const options = dead.descriptor.optionsSchema.parse({ classes: true, destructiveManifest: true });
    const result = await dead.run(stub.conn, options, { onProgress: (event) => events.push(event), projectRoot: root });
    expect(events.map((e) => e.phase)).to.deep.equal(['inventory', 'bindings', 'dependencies', 'classify', 'manifest']);
    expect(result.dead.map((f) => f.name)).to.deep.equal(['Unused']);
    expect(result).not.to.have.property('manifestDir');
    expect(result.manifest?.members).to.deep.equal(['Unused']);
    expect(result.manifest?.destructiveChangesXml).to.contain('<version>62.0</version>');
    const dry = await writeDeadCodeManifest(result, root, { dryRun: true });
    expect(dry.wouldWrite).to.deep.equal([
      join(root, 'dead-code', 'destructiveChanges.xml'),
      join(root, 'dead-code', 'package.xml'),
    ]);
    const written = await writeDeadCodeManifest(result, root);
    expect(written.manifestFiles).to.deep.equal(dry.wouldWrite);
    expect(await readFile(written.manifestFiles?.[0] ?? '', 'utf8')).to.equal(result.manifest?.destructiveChangesXml);
    expect(await readFile(written.manifestFiles?.[1] ?? '', 'utf8')).to.equal(result.manifest?.packageXml);
    const ignored = await dead.run(stub.conn, { ...options, ignore: ['Unused'] });
    expect(ignored.manifest?.members).to.deep.equal([]);
    expect(await writeDeadCodeManifest(ignored, root)).to.deep.equal({});
    const withoutManifest = await dead.run(stub.conn, { ...options, destructiveManifest: false });
    expect(withoutManifest).not.to.have.property('manifest');
    expect(await writeDeadCodeManifest(withoutManifest, root)).to.deep.equal({});
    const deadOnly = await dead.run(stub.conn, { ...options, deadOnly: true, apiVersion: '61.0' });
    expect(deadOnly.manifest?.destructiveChangesXml).to.contain('<version>61.0</version>');
  });

  it('checks cancellation between every dead phase, preventing subsequent queries', async () => {
    for (const phase of ['inventory', 'bindings', 'dependencies', 'classify', 'manifest']) {
      const controller = new AbortController();
      const stub = stubConnection();
      const seen: string[] = [];
      await failure(
        dead.run(stub.conn, dead.descriptor.optionsSchema.parse({ classes: true, destructiveManifest: true }), {
          signal: controller.signal,
          onProgress: (event) => {
            seen.push(event.phase);
            if (event.phase === phase) controller.abort();
          },
        }),
        'cancelled'
      );
      expect(seen[seen.length - 1]).to.equal(phase);
      if (phase === 'inventory') expect(stub.autoFetchQuery.called).to.equal(false);
      if (phase === 'bindings') expect(stub.query.called).to.equal(false);
    }
  });

  it('keeps the existing golden fixtures unchanged through use cases', async () => {
    const stub = stubConnection();
    const ctx = { projectRoot: root };
    const previews: Array<[GenerationPreview, string]> = [
      [
        await generateSelector.plan(
          stub.conn,
          generateSelector.descriptor.optionsSchema.parse({ sobject: 'Account', flavor: 'fflib' }),
          ctx
        ),
        'fflib/account/selector',
      ],
      [
        await generateDomain.plan(
          stub.conn,
          generateDomain.descriptor.optionsSchema.parse({ sobject: 'Property__c', flavor: 'at4dx' }),
          ctx
        ),
        'at4dx/property__c/domain',
      ],
      [
        await generateService.plan(
          undefined,
          generateService.descriptor.optionsSchema.parse({ serviceBasename: 'LimitMonitors', flavor: 'at4dx' }),
          ctx
        ),
        'at4dx/service/limitMonitors',
      ],
      [
        await generateSelectorMethod.plan(
          undefined,
          generateSelectorMethod.descriptor.optionsSchema.parse({
            sobject: 'Account',
            className: 'SelectBySloganMethod',
            sobjectSelectorClassName: 'AccountsSelector',
          }),
          ctx
        ),
        'at4dx/selectorMethod',
      ],
      [
        await generateSelectorFieldInjection.plan(
          undefined,
          generateSelectorFieldInjection.descriptor.optionsSchema.parse({
            sobject: 'Account',
            fields: ['Name', 'Industry'],
          }),
          ctx
        ),
        'at4dx/injection/fieldInjection',
      ],
      [
        await generateAction.plan(
          undefined,
          generateAction.descriptor.optionsSchema.parse({
            sobject: 'Account',
            className: 'DefaultAccountSloganBasedOnNameAction',
            processName: 'FishCompanySlogans',
            order: '10.20',
          }),
          ctx
        ),
        'at4dx/injection/action',
      ],
      [
        await generateCriteria.plan(
          undefined,
          generateCriteria.descriptor.optionsSchema.parse({
            sobject: 'Account',
            className: 'AccountNameContainsFishCriteria',
            processName: 'FishCompanySlogans',
            order: '10.10',
          }),
          ctx
        ),
        'at4dx/injection/criteria',
      ],
    ];
    const files: Record<string, string[]> = {
      'fflib/account/selector': ['AccountsSelector.cls'],
      'at4dx/property__c/domain': ['Properties.trigger'],
      'at4dx/service/limitMonitors': ['ILimitMonitorsService.cls'],
      'at4dx/selectorMethod': ['SelectBySloganMethod.cls'],
      'at4dx/injection/fieldInjection': [
        'SelectorInclusion_AccountFields.fieldSet-meta.xml',
        'SelectorConfig_FieldSetInclusion.SelectorInclusion_AccountFields.md-meta.xml',
      ],
      'at4dx/injection/action': [
        'DefaultAccountSloganBasedOnNameAction.cls',
        'DefaultAccountSloganBasedOnNameActioTest.cls',
        'DomainProcessBinding.FishCompanySlogans10_20Action.md-meta.xml',
      ],
      'at4dx/injection/criteria': [
        'AccountNameContainsFishCriteria.cls',
        'AccountNameContainsFishCriteriaTest.cls',
        'DomainProcessBinding.FishCompanySlogans10_10Criteria.md-meta.xml',
      ],
    };
    for (const [preview, folder] of previews)
      for (const filename of files[folder]) {
        const content = preview.files.find((f) => f.relativePath.endsWith(`/${filename}`))?.content;
        const golden = await readFile(join('test/fixtures/aep/golden', folder, filename), 'utf8');
        // Builder goldens used different order strings for naming and content.
        // Commands pass the same flag to both; preserve that CLI behavior here.
        const expected = filename.startsWith('DomainProcessBinding.')
          ? golden.replace('>10.2</value>', '>10.20</value>').replace('>10.1</value>', '>10.10</value>')
          : golden;
        expect(content?.trimEnd(), filename).to.equal(expected.trimEnd());
      }
  });

  it('renders generation previews, existing CLI summaries and errors as pure strings', async () => {
    const preview = await generateService.plan(
      undefined,
      generateService.descriptor.optionsSchema.parse({ serviceBasename: 'Billing', flavor: 'fflib' }),
      { projectRoot: root }
    );
    expect(
      renderGenerationPlan({
        ...preview,
        files: preview.files.slice(0, 2).map((f, index) => ({ ...f, status: index === 0 ? 'new' : 'exists' })),
        manualSteps: ['Add binding', 'Account.SObjectType'],
      })
    ).to.deep.equal([
      'NEW  main/classes/services/BillingService.cls',
      'OVERWRITE  main/classes/services/BillingService.cls-meta.xml',
      'Add binding',
      '    Account.SObjectType',
    ]);
    const outcome = { baseDir: root, created: ['a'], skipped: ['b'] };
    expect(renderGenerationResult(outcome)).to.deep.equal(['Generated 1 files (1 skipped).']);
    expect(renderGenerationResult({ ...outcome, wouldCreate: ['a', 'b'] }, { commandId: 'generate' })).to.deep.equal([
      'Dry-run planned 2 files.',
    ]);
    expect(
      renderGenerationResult(
        { ...outcome, manualSteps: ['Add binding', 'Account.SObjectType'] },
        { commandId: 'generate-unitofwork' }
      )
    ).to.deep.equal(['Add binding', '    Account.SObjectType']);
    expect(renderGenerationResult(outcome, { commandId: 'generate-action' })[1]).to.contain(
      'ExecuteAsynchronous__c=false'
    );
    expect(renderGenerationResult(outcome, { commandId: 'generate-criteria' })[1]).to.contain(
      'ProcessContext__c=TriggerExecution'
    );
    expect(renderGenerationResult(outcome, { commandId: 'generate-selector-field-injection' })[1]).to.contain(
      'IsActive__c=true'
    );
    expect(describeError(new ApxError('cancelled', 'Operation cancelled.'))).to.deep.equal({
      title: 'Operation cancelled.',
    });
    expect(describeError(new Error('Other'))).to.deep.equal({ title: 'Other' });
    expect(describeError('Other')).to.deep.equal({ title: 'Other' });
    const invalid = z.object({ a: z.string(), b: z.string() }).safeParse({ a: 1, b: 2 });
    if (invalid.success) throw new Error('Expected invalid options');
    expect(describeError(invalid.error).detail).to.equal(invalid.error.issues[1].message);
    expect(renderTable(['A', 'B'], [{ A: 'x' }])).to.equal('A  B\n-  -\nx');
  });

  it('renders a dead report and manifest preview without modifying the result', async () => {
    const result = await dead.run(
      stubConnection().conn,
      dead.descriptor.optionsSchema.parse({ classes: true, destructiveManifest: true })
    );
    const before = JSON.stringify(result);
    const report = renderDeadCodeReport(result);
    expect(report).to.contain('DEAD\nROUND  CLASS');
    expect(report).to.contain('Scanned 1 classes over 1 round(s): 1 dead, 0 test-only, 0 retained, 0 suppressed.');
    const preview = renderDeadCodeReport(result, { manifestDir: '/project/dead-code', dryRun: true, deadOnly: true });
    expect(preview).to.contain('Would write a destructive manifest for 1 classes to /project/dead-code');
    const written = renderDeadCodeReport(
      { ...result, manifestDir: '/project/dead-code', manifestFiles: ['a', 'b'] },
      { username: 'test@example.com' }
    );
    expect(written).to.contain('sf project deploy start --target-org test@example.com');
    expect(JSON.stringify(result)).to.equal(before);
  });

  it('matches full dead-report snapshots for suppressed, manifest, dead-only and empty reports', async () => {
    const result = JSON.parse(await readFile('test/fixtures/render/dead-input.json', 'utf8')) as DeadCodeResult;
    const expected = JSON.parse(await readFile('test/fixtures/render/dead-snapshots.json', 'utf8')) as Record<
      string,
      string
    >;
    const before = JSON.stringify(result);
    const empty = {
      ...result,
      dead: [],
      testOnly: [],
      testOfDead: [],
      retained: [],
      suppressed: [],
      bindingSources: [],
      scanned: 0,
      rounds: 0,
      withoutSymbolTable: 0,
    };
    expect({
      standard: renderDeadCodeReport(result),
      suppressed: renderDeadCodeReport(result, { includeSuppressed: true }),
      manifest: renderDeadCodeReport(result, { manifestDir: '/project/dead-code' }),
      dryRun: renderDeadCodeReport(result, { manifestDir: '/project/dead-code', dryRun: true }),
      deadOnly: renderDeadCodeReport(result, { manifestDir: '/project/dead-code', deadOnly: true, dryRun: true }),
      empty: renderDeadCodeReport(empty),
    }).to.deep.equal(expected);
    expect(JSON.stringify(result)).to.equal(before);
  });
});
