const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function loadParseCsvToRows() {
  const root = path.join(__dirname, '..', '..');
  const papa = fs.readFileSync(path.join(root, 'js/vendor/papaparse.min.js'), 'utf8');
  const csvParse = fs.readFileSync(path.join(root, 'js/csv-parse.js'), 'utf8');
  const ctx = { console, globalThis: {} };
  ctx.globalThis = ctx;
  vm.createContext(ctx);
  vm.runInContext(papa, ctx, { filename: 'papaparse.min.js' });
  vm.runInContext(csvParse, ctx, { filename: 'csv-parse.js' });
  return ctx.parseCsvToRows;
}

describe('parseCsvToRows', () => {
  const parseCsvToRows = loadParseCsvToRows();

  test('parses semicolon and quoted newlines', () => {
    const text = 'a;b\n"line1\nline2";c';
    const { rows, errors } = parseCsvToRows(text);
    expect(errors.length).toBe(0);
    expect(rows.length).toBe(2);
    expect(rows[0]).toEqual(['a', 'b']);
    expect(rows[1][0]).toContain('line1');
    expect(rows[1][1]).toBe('c');
  });

  test('respects explicit delimiter option', () => {
    const { rows } = parseCsvToRows('x|y|z', { delimiter: '|' });
    expect(rows[0]).toEqual(['x', 'y', 'z']);
  });

  test('empty or whitespace-only input yields no rows', () => {
    expect(parseCsvToRows('').rows).toEqual([]);
    expect(parseCsvToRows('   \n  \n').rows).toEqual([]);
  });

  test('coerces null/undefined to empty string', () => {
    expect(parseCsvToRows(null).rows).toEqual([]);
    expect(parseCsvToRows(undefined).rows).toEqual([]);
  });

  test('skips greedy empty lines between records', () => {
    const { rows, errors } = parseCsvToRows('a,b\n\n\nc,d');
    expect(errors.length).toBe(0);
    expect(rows).toEqual([
      ['a', 'b'],
      ['c', 'd'],
    ]);
  });

  test('empty cells preserved as empty strings (greedy skip drops all-empty lines)', () => {
    const { rows } = parseCsvToRows('a,,b\nfoo,,bar');
    expect(rows[0]).toEqual(['a', '', 'b']);
    expect(rows[1]).toEqual(['foo', '', 'bar']);
  });

  test('malformed unclosed quote reports errors', () => {
    const { rows, errors } = parseCsvToRows('"open');
    expect(errors.length).toBeGreaterThan(0);
    expect(Array.isArray(rows)).toBe(true);
  });

  test('wrong explicit delimiter still parses without throwing', () => {
    const { rows } = parseCsvToRows('a;b;c', { delimiter: '|' });
    expect(rows.length).toBeGreaterThanOrEqual(1);
    expect(rows[0].length).toBe(1);
  });
});
