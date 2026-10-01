import { readFileSync } from 'node:fs';
import type { Connection } from '@salesforce/core';
import sinon from 'sinon';
import type { SymbolTable } from '../../src/index.js';

export const stubConnection = () => {
  const describeSObject = sinon
    .stub()
    .callsFake(
      async (name: string) =>
        JSON.parse(readFileSync(`test/fixtures/aep/describe/${name.toLowerCase()}.json`, 'utf8')) as unknown
    );
  const getApiVersion = sinon.stub().returns('62.0');
  const symbolTable: SymbolTable = {
    tableDeclaration: { annotations: [], modifiers: ['public'] },
    methods: [],
    interfaces: [],
    parentClass: '',
    innerClasses: [],
  };
  const autoFetchQuery = sinon.stub().callsFake(async (soql: string) => {
    if (soql.includes('NamespacePrefix')) return { records: [{ Id: '01p1', Name: 'Unused' }] };
    if (soql.includes('SymbolTable')) return { records: [{ Id: '01p1', SymbolTable: symbolTable }] };
    return { records: [] };
  });
  const query = sinon.stub().resolves({ records: [] });
  const conn = { describeSObject, getApiVersion, tooling: { autoFetchQuery }, query } as unknown as Connection;
  return { conn, describeSObject, getApiVersion, autoFetchQuery, query };
};
