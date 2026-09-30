import { expect } from 'chai';
import sinon from 'sinon';
import { fetchClassInventory } from '../../src/dead/inventory.js';
import type { DeadConnection, SymbolTable } from '../../src/dead/types.js';

const connection = (query: sinon.SinonStub): DeadConnection => ({
  tooling: { autoFetchQuery: query },
  query: sinon.stub(),
});

describe('fetchClassInventory', () => {
  it('returns no candidates without querying symbol tables for an empty org', async () => {
    const query = sinon.stub().resolves({ records: [] });
    expect(await fetchClassInventory(connection(query))).to.deep.equal([]);
    expect(query.calledOnce).to.equal(true);
    expect(query.firstCall.args[0]).to.include("NamespacePrefix = null AND Status = 'Active'");
  });

  it('batches symbol queries and keeps missing or uncompiled classes', async () => {
    const rows = Array.from({ length: 201 }, (_, index) => ({ Id: `id${index}`, Name: `Class${index}` }));
    rows[0].Id = "id'0";
    const table: SymbolTable = {
      tableDeclaration: { annotations: [], modifiers: [] },
      methods: [],
      interfaces: [],
      parentClass: '',
      innerClasses: [],
    };
    const query = sinon.stub();
    query.onCall(0).resolves({ records: rows });
    query.onCall(1).resolves({
      records: [
        { Id: rows[0].Id, SymbolTable: table },
        { Id: rows[1].Id, SymbolTable: null },
      ],
    });
    query.onCall(2).resolves({ records: [{ Id: rows[200].Id, SymbolTable: table }] });
    const inventory = await fetchClassInventory(connection(query));
    expect(query.callCount).to.equal(3);
    expect(query.secondCall.args[0]).to.include("'id\\'0'");
    expect(query.thirdCall.args[0]).to.include("IN ('id200')");
    expect(inventory).to.have.length(201);
    expect(inventory[0]).to.deep.equal({ id: rows[0].Id, name: 'Class0', symbolTable: table });
    expect(inventory[1].symbolTable).to.equal(null);
    expect(inventory[2].symbolTable).to.equal(null);
    expect(inventory[200].symbolTable).to.equal(table);
  });
});
