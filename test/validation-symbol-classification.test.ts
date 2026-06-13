import assert from 'assert';
import { isSymbolObject, INTERNAL_PIPELINE_KEYS } from '../shared/utils/validation.js';

function makeSymbolPayload() {
  return {
    d: 'data',
    h4: null,
    h1: null
  };
}

function makeMalformedSymbol() {
  return {
    x: 123,
    y: true
  };
}

describe('validation: symbol classification', () => {
  it('rejects arrays', () => {
    assert.strictEqual(isSymbolObject([]), false);
  });

  it('rejects newsEvents metadata key', () => {
    const obj = { newsEvents: [] };
    // Should not be considered a symbol
    assert.strictEqual(isSymbolObject(obj), false);
  });

  it('rejects inherited temporal state', () => {
    const obj = { _inheritedTemporalState: { foo: 'bar' } };
    assert.strictEqual(isSymbolObject(obj), false);
  });

  it('accepts a valid symbol payload containing timeframe keys', () => {
    assert.strictEqual(isSymbolObject(makeSymbolPayload()), true);
  });

  it('rejects malformed symbol payloads', () => {
    assert.strictEqual(isSymbolObject(makeMalformedSymbol()), false);
  });
});
