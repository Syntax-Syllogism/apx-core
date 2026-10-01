// This file is the sole public entry point. Additions are minor releases;
// removals and signature changes are breaking. test/index.test.ts pins keys.
export { ApxError, isApxError, type ApxErrorCode } from './errors.js';

export {
  uiHints,
  checkCancelled,
  startProgress,
  endProgress,
  requireConnection,
  type ProgressEvent,
  type UseCaseContext,
  type ApxUseCaseContext,
  type GenerationApplyContext,
  type UiHint,
  type OrgRequirement,
  type CommandDescriptor,
  type ReadUseCase,
  type WriteUseCase,
  type UseCase,
} from './useCase.js';
export * from './commandOptions.js';
export {
  generate,
  generateSelector,
  generateDomain,
  generateService,
  generateUnitOfWork,
  generateSelectorMethod,
  generateSelectorFieldInjection,
  generateAction,
  generateCriteria,
} from './useCases/generate.js';
export { dead, writeDeadCodeManifest, type DeadUseCaseResult } from './useCases/dead.js';
export { useCases, commandDescriptors } from './useCases/index.js';
export {
  planGeneration,
  applyGeneration,
  type PlannedFile,
  type GenerationPreview,
  type GenerationOutcome,
} from './useCases/generation.js';
export { renderGenerationPlan, renderGenerationResult } from './render/generation.js';
export { renderDeadCodeReport, type DeadReportOptions } from './render/dead.js';
export { describeError } from './render/errors.js';

// AEP: model
export type {
  Flavor,
  ArtifactId,
  PlannedArtifact,
  GenerationPlan,
  OverwritePolicy,
  EngineOptions,
  GenerationManifest,
  AepCommandResult,
} from './aep/model/types.js';
export { TRIGGER_OPERATION_OPTIONS } from './aep/model/constants.js';

// AEP: describe and support
export { toDescribeView, type SObjectDescribeView } from './aep/describe/describe.js';
export {
  DEFAULT_OUTPUT_PATH,
  DEFAULT_API_VERSION,
  ORDER_PATTERN,
  resolveOutputBase,
  resolveProjectApiVersion,
  resolveApiVersion,
  describeTarget,
  isValidOrderValue,
  isWithinCustomMetadataNameLimit,
  type ApiVersionOptions,
} from './aep/support.js';

// AEP: naming and paths
export {
  buildActionNames,
  buildCriteriaNames,
  buildFieldInjectionNames,
  buildSObjectNames,
  buildSelectorMethodNames,
  buildServiceNames,
  domainProcessBindingDeveloperName,
} from './aep/naming/naming.js';
export type {
  SObjectNameInput,
  SObjectNames,
  ServiceNameInput,
  ServiceNames,
  SelectorMethodNameInput,
  SelectorMethodNames,
  DomainProcessNameInput,
  DomainProcessType,
  DomainProcessNames,
  FieldInjectionNameInput,
  FieldInjectionNames,
} from './aep/naming/naming.js';
export { PathResolver, DEFAULT_LAYOUT, type AepLayout } from './aep/paths/paths.js';

// AEP: plans and execution
export {
  buildActionPlan,
  buildCriteriaPlan,
  buildDomainPlan,
  buildFieldInjectionPlan,
  buildSelectorMethodPlan,
  buildSelectorPlan,
  buildServicePlan,
  buildUnitOfWorkPlan,
  combinePlans,
} from './aep/plan/planBuilders.js';
export { GenerationEngine } from './aep/engine/engine.js';

// Dead-code: inventory, bindings, dependencies and classification
export type {
  DeadBucket,
  ComponentRef,
  SymbolAnnotation,
  SymbolMethod,
  SymbolTable,
  CandidateClass,
  DeadClassFinding,
  BindingSourceReport,
  DeadCodeResult,
  QueryResult,
  ToolingConnection,
  DeadConnection,
} from './dead/types.js';
export { fetchClassInventory } from './dead/inventory.js';
export { scanBindings, type BindingScan } from './dead/bindings.js';
export { fetchDependencyGraph, type DependencyGraph } from './dead/dependencies.js';
export { MAX_ROUNDS, classifyClasses } from './dead/classify.js';

// Dead-code: pure manifest rendering and writing
export {
  renderDestructiveChanges,
  renderEmptyPackage,
  writeDestructiveManifest,
  type ManifestOptions,
  type ManifestResult,
} from './dead/destructiveManifest.js';
