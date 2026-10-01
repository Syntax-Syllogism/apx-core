import {
  generate,
  generateSelector,
  generateDomain,
  generateService,
  generateUnitOfWork,
  generateSelectorMethod,
  generateSelectorFieldInjection,
  generateAction,
  generateCriteria,
} from './generate.js';
import { dead } from './dead.js';

export const useCases = {
  generate,
  'generate-selector': generateSelector,
  'generate-domain': generateDomain,
  'generate-service': generateService,
  'generate-unitofwork': generateUnitOfWork,
  'generate-selector-method': generateSelectorMethod,
  'generate-selector-field-injection': generateSelectorFieldInjection,
  'generate-action': generateAction,
  'generate-criteria': generateCriteria,
  dead,
};
export const commandDescriptors = Object.values(useCases).map((useCase) => useCase.descriptor);
