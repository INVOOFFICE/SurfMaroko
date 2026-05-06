// js/csv-parse.js — Papa Parse (js/vendor/papaparse.min.js) — imports CSV uniquement
/**
 * Parse un CSV en lignes de cellules (chaînes). Délimiteur auto (`,` `;` `|` …) comme Excel.
 * @param {string} text
 * @param {{ delimiter?: string }} [opts] — si vide, détection auto
 * @returns {{ rows: string[][], delimiter: string, errors: Array<{ message?: string, row?: number }> }}
 */
function parseCsvToRows(text, opts) {
  if (typeof Papa === 'undefined' || typeof Papa.parse !== 'function') {
    console.warn('[csv-parse] Papa Parse indisponible');
    return { rows: [], delimiter: ',', errors: [{ message: 'Papa Parse indisponible' }] };
  }
  const res = Papa.parse(String(text ?? ''), {
    header: false,
    skipEmptyLines: 'greedy',
    dynamicTyping: false,
    delimiter: (opts && opts.delimiter) || '',
  });
  const rows = (res.data || []).map(row =>
    (row || []).map(cell => (cell == null ? '' : String(cell))),
  );
  return {
    rows,
    delimiter: (res.meta && res.meta.delimiter) || ',',
    errors: res.errors || [],
  };
}

globalThis.parseCsvToRows = parseCsvToRows;
