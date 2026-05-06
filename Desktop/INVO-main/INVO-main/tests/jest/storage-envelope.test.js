/**
 * Même logique que storage.js (_encodeStoredPayload / _decodeStoredPayload) — sans OPFS.
 */
const STORAGE_FORMAT_MARKER = 'invoo_storage_v2';
const STORAGE_FORMAT_VERSION = 2;

function encodePayload(value) {
  return {
    __fmt: STORAGE_FORMAT_MARKER,
    version: STORAGE_FORMAT_VERSION,
    data: value,
  };
}

function _isObject(v) {
  return !!v && typeof v === 'object' && !Array.isArray(v);
}

function _isVersionedStorageEnvelope(v) {
  return (
    _isObject(v) &&
    v.__fmt === STORAGE_FORMAT_MARKER &&
    Number.isInteger(v.version) &&
    Object.prototype.hasOwnProperty.call(v, 'data')
  );
}

function decodePayload(parsed) {
  if (!_isVersionedStorageEnvelope(parsed)) return parsed;
  if (parsed.version > STORAGE_FORMAT_VERSION) return parsed.data;
  return parsed.data;
}

/** Comportement attendu quand le JSON brut est illisible (cf. ls() dans storage.js). */
function parseStoredJsonOrNull(raw) {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

describe('storage envelope', () => {
  test('roundtrip preserves data', () => {
    const v = { settings: { name: 'X' }, clients: [{ id: '1' }] };
    const json = JSON.stringify(encodePayload(v));
    const back = decodePayload(JSON.parse(json));
    expect(back).toEqual(v);
  });

  test('legacy plain JSON still decodes', () => {
    const plain = { foo: 1 };
    expect(decodePayload(plain)).toEqual(plain);
  });

  test('corrupted JSON string yields null on safe parse', () => {
    expect(parseStoredJsonOrNull('{not json')).toBeNull();
    expect(parseStoredJsonOrNull('')).toBeNull();
    expect(parseStoredJsonOrNull('undefined')).toBeNull();
  });

  test('valid JSON string decodes for envelope path', () => {
    const wrapped = encodePayload([]);
    expect(parseStoredJsonOrNull(JSON.stringify(wrapped))).toEqual(wrapped);
  });

  test('envelope missing data key is not unwrapped', () => {
    const almost = { __fmt: STORAGE_FORMAT_MARKER, version: 2 };
    expect(decodePayload(almost)).toEqual(almost);
  });

  test('envelope with non-integer version is not unwrapped', () => {
    const bad = { __fmt: STORAGE_FORMAT_MARKER, version: 2.5, data: [] };
    expect(decodePayload(bad)).toEqual(bad);
  });

  test('array or null root is passed through', () => {
    expect(decodePayload(null)).toBeNull();
    expect(decodePayload([1, 2])).toEqual([1, 2]);
  });

  test('envelope with explicit undefined data unwraps to undefined', () => {
    const env = { __fmt: STORAGE_FORMAT_MARKER, version: 2, data: undefined };
    expect(decodePayload(env)).toBeUndefined();
  });

  test('future storage version still returns data field', () => {
    const future = { __fmt: STORAGE_FORMAT_MARKER, version: 99, data: { ok: true } };
    expect(decodePayload(future)).toEqual({ ok: true });
  });
});
