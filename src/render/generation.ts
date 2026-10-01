import type { GenerationPreview, GenerationOutcome } from '../useCases/generation.js';
import { FIELD_INJECTION_BINDING_REVIEW, PROCESS_BINDING_REVIEW } from './text.js';

const renderManualSteps = (steps?: string[]): string[] =>
  steps?.map((step, index) => (index === 0 ? step : `    ${step}`)) ?? [];
export const renderGenerationPlan = (preview: GenerationPreview): string[] => [
  ...preview.files.map((file) => `${file.status === 'new' ? 'NEW' : 'OVERWRITE'}  ${file.relativePath}`),
  ...renderManualSteps(preview.manualSteps),
];

/** Optional commandId retains command-specific CLI summaries without changing the JSON result shape. */
export const renderGenerationResult = (outcome: GenerationOutcome, options: { commandId?: string } = {}): string[] => {
  const lines = renderManualSteps(outcome.manualSteps);
  if (options.commandId === 'generate-unitofwork' && outcome.manualSteps) return lines;
  lines.push(
    options.commandId === 'generate' && outcome.wouldCreate
      ? `Dry-run planned ${outcome.wouldCreate.length} files.`
      : `Generated ${outcome.created.length} files (${outcome.skipped.length} skipped).`
  );
  if (options.commandId === 'generate-action' || options.commandId === 'generate-criteria')
    lines.push(PROCESS_BINDING_REVIEW);
  if (options.commandId === 'generate-selector-field-injection') lines.push(FIELD_INJECTION_BINDING_REVIEW);
  return lines;
};
