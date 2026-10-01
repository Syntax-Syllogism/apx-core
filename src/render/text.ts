// Runtime English text shared by callers; help and flag descriptions stay in the CLI.
export const FFLIB_UNIT_OF_WORK_SNIPPET =
  'Please add the following binding to Application.cls (fflib_Application.UnitOfWorkFactory entry):';
export const PROCESS_BINDING_REVIEW =
  'Review the generated binding defaults: RelatedDomainBindingSObjectAlternate__c (nil), ExecuteAsynchronous__c=false, LogicalInverse__c=false, PreventRecursive__c=false, ProcessContext__c=TriggerExecution, DomainMethodToken__c (nil), and Description__c.';
export const FIELD_INJECTION_BINDING_REVIEW =
  'Review the generated binding defaults: BindingSObjectAlternate__c (nil), IsActive__c=true, and metadata label/description values.';
export const deadText = {
  'info.summary': 'Scanned %s classes over %s round(s): %s dead, %s test-only, %s retained, %s suppressed.',
  'info.bindingSources': 'Binding sources consulted:',
  'info.bindingSourceRow': '  %s  %s',
  'info.bindingSourceMissing': '  %s  not present in org',
  'info.manifestWritten': 'Wrote a destructive manifest for %s classes to %s',
  'info.nextStep': 'Review the manifest, then deploy it with:',
  'info.dryRunManifest': 'Would write a destructive manifest for %s classes to %s',
  'info.noResults': 'No dead classes found.',
  'warn.stringReferences':
    'Class names held as strings outside the known AT4DX binding objects are invisible to\ndependency data. Classes reached only via Type.forName, System.schedule from anonymous\nApex, or a bespoke config table are reported as dead even when they are live. Review\nbefore deleting.',
  'warn.noBindingSources':
    'No AT4DX binding objects were found in this org, so no dependency-injection bindings could\nbe resolved. If this is an AT4DX project, injected implementations will be reported as\ndead.',
  'warn.cascade':
    '%s classes were found in round 2 or later. These are only dead once the earlier rounds are\ndeployed. Deploy and re-run to confirm.',
  'warn.missingSymbolTable':
    '%s classes have no symbol table (never compiled); entry-point detection was skipped for\nthem and they were classified on naming convention alone.',
  'warn.maxRounds': 'Cascade stopped at the %s-round safety limit. Results may be incomplete; please report\nthis.',
};

export const formatText = (template: string, ...values: Array<string | number>): string => {
  let index = 0;
  return template.replace(/%s/g, () => String(values[index++]));
};
