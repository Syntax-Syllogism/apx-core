import { expect } from 'chai';
import * as api from '../src/index.js';

describe('public API', () => {
  it('exports exactly the pinned keys', () => {
    // Update this list deliberately when the public API changes; see the
    // versioning rules in docs/design/0001-apx-core-boundaries.md.
    expect(Object.keys(api).sort()).to.deep.equal([
      'ApxError',
      'DEFAULT_API_VERSION',
      'DEFAULT_LAYOUT',
      'DEFAULT_OUTPUT_PATH',
      'GenerationEngine',
      'MAX_ROUNDS',
      'ORDER_PATTERN',
      'PathResolver',
      'TRIGGER_OPERATION_OPTIONS',
      'buildActionNames',
      'buildActionPlan',
      'buildCriteriaNames',
      'buildCriteriaPlan',
      'buildDomainPlan',
      'buildFieldInjectionNames',
      'buildFieldInjectionPlan',
      'buildSObjectNames',
      'buildSelectorMethodNames',
      'buildSelectorMethodPlan',
      'buildSelectorPlan',
      'buildServiceNames',
      'buildServicePlan',
      'buildUnitOfWorkPlan',
      'classifyClasses',
      'combinePlans',
      'describeTarget',
      'domainProcessBindingDeveloperName',
      'fetchClassInventory',
      'fetchDependencyGraph',
      'isApxError',
      'isValidOrderValue',
      'isWithinCustomMetadataNameLimit',
      'renderDestructiveChanges',
      'renderEmptyPackage',
      'resolveApiVersion',
      'resolveOutputBase',
      'resolveProjectApiVersion',
      'scanBindings',
      'toDescribeView',
      'writeDestructiveManifest',
    ]);
  });
});
