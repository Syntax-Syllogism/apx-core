import { z } from 'zod';
import type { UiHint } from './useCase.js';
import { DEFAULT_OUTPUT_PATH, isValidOrderValue, isWithinCustomMetadataNameLimit } from './aep/support.js';
import { domainProcessBindingDeveloperName } from './aep/naming/naming.js';
import { TRIGGER_OPERATION_OPTIONS } from './aep/model/constants.js';

const field = <T extends z.ZodType>(schema: T, ui: UiHint): T => schema.meta({ ui });
export const file = (
  label: string,
  fileFilter: UiHint['fileFilter'] = 'json',
  extra: Partial<UiHint> = {}
): z.ZodString => field(z.string(), { kind: 'file', label, fileFilter, ...extra });
export const text = (label: string, extra: Partial<UiHint> = {}): z.ZodString =>
  field(z.string(), { kind: 'string', label, ...extra });
export const boolean = (label: string): z.ZodBoolean => field(z.boolean(), { kind: 'boolean', label });
export const enumValue = <T extends string>(values: readonly [T, ...T[]], label: string): z.ZodEnum<{ [K in T]: K }> =>
  field(z.enum(values), { kind: 'enum', label });
const strings = (label: string): z.ZodArray<z.ZodString> =>
  field(z.array(z.string().trim().min(1)), { kind: 'multiString', label });
const requiredText = (label: string): z.ZodString => field(z.string().min(1), { kind: 'string', label });
const output = { outputPath: text('Output folder', { kind: 'folder' }).default(DEFAULT_OUTPUT_PATH) };
const common = { ...output, apiVersion: text('API version').optional() };
const object = { sobject: requiredText('SObject API name') };
const flavored = {
  ...common,
  ...object,
  flavor: enumValue(['fflib', 'at4dx'], 'Framework'),
  prefix: text('Prefix').optional(),
};
const bindingSequence = text('Binding sequence').default('1000.0');

export const generateOptionsSchema = z
  .object({
    ...flavored,
    bindingSequence,
    selector: boolean('Selector').default(false),
    domain: boolean('Domain').default(false),
    unitOfWork: boolean('Unit of work').default(false),
  })
  .superRefine((options, ctx) => {
    if (!options.selector && !options.domain && !options.unitOfWork)
      ctx.addIssue({
        code: 'custom',
        path: ['selector'],
        params: { apxCode: 'nothing-selected' },
        message: 'Select at least one artifact group: --selector, --domain, or --unit-of-work.',
      });
  });
export const generateSelectorOptionsSchema = z.object(flavored);
export const generateDomainOptionsSchema = z.object(flavored);
export const generateUnitOfWorkOptionsSchema = z.object({ ...flavored, bindingSequence });
export const generateServiceOptionsSchema = z.object({
  ...common,
  serviceBasename: requiredText('Service basename'),
  flavor: enumValue(['fflib', 'at4dx'], 'Framework'),
  prefix: text('Prefix').optional(),
});
export const generateSelectorMethodOptionsSchema = z.object({
  ...common,
  ...object,
  className: requiredText('Class name'),
  sobjectSelectorClassName: requiredText('SObject selector class name'),
});
export const generateSelectorFieldInjectionOptionsSchema = z.object({
  ...output,
  ...object,
  fields: field(strings('Fields').min(1, 'At least one field must be provided in --fields.'), {
    kind: 'multiString',
    label: 'Fields',
  }),
  fieldsetName: field(
    z.string().superRefine((value, ctx) => {
      if (!isWithinCustomMetadataNameLimit(value.trim()))
        ctx.addIssue({
          code: 'custom',
          message: `The generated field set name \`${value.trim()}\` is longer than the 40-character Salesforce limit.`,
        });
    }),
    { kind: 'string', label: 'Fieldset name' }
  ).optional(),
  label: text('Label').optional(),
  description: text('Description').optional(),
});
const processFields = {
  ...common,
  ...object,
  className: requiredText('Class name'),
  triggerOperation: enumValue(TRIGGER_OPERATION_OPTIONS, 'Trigger operation').default('Before_Insert'),
  order: field(
    z.string().refine(isValidOrderValue, '`--order` must be a decimal-like value such as `10.1` or `10.2`.'),
    { kind: 'string', label: 'Order' }
  ).default('10.1'),
  processName: text('Process name').optional(),
  description: text('Description').optional(),
};
const processSchema = (type: 'Action' | 'Criteria'): z.ZodObject<typeof processFields> =>
  z.object(processFields).superRefine((options, ctx) => {
    const name = domainProcessBindingDeveloperName({ ...options, type });
    if (!isWithinCustomMetadataNameLimit(name))
      ctx.addIssue({
        code: 'custom',
        path: ['processName'],
        message: `The generated binding developer name \`${name}\` is longer than the 40-character Salesforce limit.`,
      });
  });
export const generateActionOptionsSchema = processSchema('Action');
export const generateCriteriaOptionsSchema = processSchema('Criteria');
export const deadOptionsSchema = z
  .object({
    ...common,
    classes: boolean('Classes').default(false),
    destructiveManifest: boolean('Destructive manifest').default(false),
    deadOnly: field(z.boolean(), { kind: 'boolean', label: 'Dead only', dependsOn: 'destructiveManifest' }).default(
      false
    ),
    includeSuppressed: boolean('Include suppressed').default(false),
    ignore: strings('Ignore patterns').default([]),
  })
  .superRefine((options, ctx) => {
    if (!options.classes)
      ctx.addIssue({
        code: 'custom',
        path: ['classes'],
        message: options.destructiveManifest ? '--destructive-manifest requires --classes.' : 'Specify --classes.',
      });
  });

export type GenerateOptions = z.output<typeof generateOptionsSchema>;
export type GenerateSelectorOptions = z.output<typeof generateSelectorOptionsSchema>;
export type GenerateDomainOptions = z.output<typeof generateDomainOptionsSchema>;
export type GenerateUnitOfWorkOptions = z.output<typeof generateUnitOfWorkOptionsSchema>;
export type GenerateServiceOptions = z.output<typeof generateServiceOptionsSchema>;
export type GenerateSelectorMethodOptions = z.output<typeof generateSelectorMethodOptionsSchema>;
export type GenerateSelectorFieldInjectionOptions = z.output<typeof generateSelectorFieldInjectionOptionsSchema>;
export type GenerateActionOptions = z.output<typeof generateActionOptionsSchema>;
export type GenerateCriteriaOptions = z.output<typeof generateCriteriaOptionsSchema>;
export type DeadOptions = z.output<typeof deadOptionsSchema>;
