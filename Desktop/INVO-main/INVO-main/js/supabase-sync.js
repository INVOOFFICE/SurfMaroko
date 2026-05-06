/**
 * Sync optionnelle Supabase (REST + Realtime) — INVOO OFFICE
 * Voir SUPABASE-REALTIME-GUIDE.txt
 */
(function () {
  /**
   * Tout `DB.settings` est synchronisé sauf ces clés (connexion Supabase + marqueur de fusion local).
   * Valeurs : string, number, boolean ou null uniquement (pas d’objets imbriqués).
   */
  const SETTINGS_LOCAL_ONLY_KEYS = new Set([
    'supabaseSyncEnabled',
    'supabaseUrl',
    'supabaseAnonKey',
    'supabaseSettingsRowUpdatedAt',
  ]);
  const SETTINGS_ROW_ID = 'invoo_app_settings';
  const TABLE_MAP = {
    settings: 'invoo_rt_settings',
    clients: 'invoo_rt_clients',
    docs: 'invoo_rt_docs',
    stock: 'invoo_rt_stock',
    fournisseurs: 'invoo_rt_fournisseurs',
    bonsCommande: 'invoo_rt_bons_commande',
    stockMoves: 'invoo_rt_stock_moves',
  };
  const KEY_BY_TABLE = Object.fromEntries(
    Object.entries(TABLE_MAP).map(([k, v]) => [v, k]),
  );

  let _client = null;
  let _channel = null;
  let _pulling = false;
  let _skipPush = false;
  let _sessionActive = false;
  const _pendingRt = new Set();
  const _debouncePull = {};
  const _debouncePush = {};

  function tsIso(v) {
    if (!v) return 0;
    const t = new Date(v).getTime();
    return Number.isFinite(t) ? t : 0;
  }

  function localItemTs(item) {
    return Math.max(tsIso(item.updatedAt), tsIso(item.createdAt));
  }

  function isJsonPrimitiveSyncable(v) {
    if (v === null) return true;
    const t = typeof v;
    return t === 'string' || t === 'number' || t === 'boolean';
  }

  function extractSyncableSettings() {
    const s = DB.settings || {};
    const out = {};
    for (const key of Object.keys(s)) {
      if (SETTINGS_LOCAL_ONLY_KEYS.has(key)) continue;
      const v = s[key];
      if (v === undefined) continue;
      if (!isJsonPrimitiveSyncable(v)) continue;
      out[key] = v;
    }
    return out;
  }

  function mergeSettingsFromRemoteData(remoteData) {
    if (!remoteData || typeof remoteData !== 'object') return;
    const s = DB.settings;
    for (const key of Object.keys(remoteData)) {
      if (SETTINGS_LOCAL_ONLY_KEYS.has(key)) continue;
      const v = remoteData[key];
      if (!isJsonPrimitiveSyncable(v)) continue;
      s[key] = v;
    }
  }

  async function pullSettingsRow() {
    if (!_client) return;
    const table = TABLE_MAP.settings;
    const { data: rows, error } = await _client
      .from(table)
      .select('id,data,deleted_at,updated_at')
      .eq('id', SETTINGS_ROW_ID)
      .maybeSingle();
    if (error) throw error;
    if (!rows || (rows.deleted_at != null && rows.deleted_at !== '')) return;
    const rts = tsIso(rows.updated_at);
    const lts = tsIso(DB.settings?.supabaseSettingsRowUpdatedAt);
    if (rts <= lts) return;
    let remoteData = rows.data;
    if (typeof remoteData === 'string') {
      try {
        remoteData = JSON.parse(remoteData);
      } catch {
        return;
      }
    }
    const touchPriceMode = Object.prototype.hasOwnProperty.call(remoteData, 'globalPriceMode');
    _skipPush = true;
    try {
      mergeSettingsFromRemoteData(remoteData);
      DB.settings.supabaseSettingsRowUpdatedAt = rows.updated_at;
      if (typeof save === 'function') save('settings');
      if (touchPriceMode) {
        const m = DB.settings.globalPriceMode === 'HT' ? 'HT' : 'TTC';
        try {
          localStorage.setItem('priceMode', m);
        } catch (_) {}
        try {
          window.dispatchEvent(new CustomEvent('invo-price-mode-change', { detail: { mode: m } }));
        } catch (_) {}
      }
    } finally {
      _skipPush = false;
    }
  }

  async function pushSettingsRow() {
    if (!_client || _skipPush || !DB.settings?.supabaseSyncEnabled) return;
    const table = TABLE_MAP.settings;
    const data = extractSyncableSettings();
    const now = new Date().toISOString();
    const { error } = await _client.from(table).upsert(
      {
        id: SETTINGS_ROW_ID,
        data,
        deleted_at: null,
        updated_at: now,
      },
      { onConflict: 'id' },
    );
    if (error) throw error;
    _skipPush = true;
    try {
      DB.settings.supabaseSettingsRowUpdatedAt = now;
      if (typeof save === 'function') save('settings');
    } finally {
      _skipPush = false;
    }
  }

  function mergeCollection(localArr, remoteRows) {
    const byId = new Map();
    for (const item of localArr || []) {
      byId.set(String(item.id), { ...item });
    }
    for (const row of remoteRows || []) {
      const rid = String(row.id);
      const rts = tsIso(row.updated_at);
      const del = row.deleted_at != null && row.deleted_at !== '';
      const local = byId.get(rid);
      const lts = local ? localItemTs(local) : 0;
      if (del) {
        if (!local || rts >= lts) byId.delete(rid);
        continue;
      }
      let remoteData = row.data;
      if (typeof remoteData === 'string') {
        try {
          remoteData = JSON.parse(remoteData);
        } catch {
          continue;
        }
      }
      if (!remoteData || typeof remoteData !== 'object') continue;
      const remoteTs = row.updated_at || remoteData.updatedAt;
      if (!local) {
        byId.set(rid, { ...remoteData, updatedAt: remoteTs || remoteData.updatedAt });
        continue;
      }
      if (rts > lts) {
        byId.set(rid, { ...remoteData, updatedAt: remoteTs || remoteData.updatedAt });
      }
    }
    return [...byId.values()];
  }

  function updateSupabaseStatus(text) {
    const el = document.getElementById('supabase-sync-status');
    if (el) el.textContent = text || '—';
  }

  async function pullTable(dbKey) {
    if (!_client) return;
    if (dbKey === 'settings') {
      await pullSettingsRow();
      return;
    }
    const table = TABLE_MAP[dbKey];
    if (!table) return;
    const { data: rows, error } = await _client
      .from(table)
      .select('id,data,deleted_at,updated_at');
    if (error) throw error;
    _skipPush = true;
    try {
      DB[dbKey] = mergeCollection(DB[dbKey] || [], rows);
      if (typeof save === 'function') save(dbKey);
    } finally {
      _skipPush = false;
    }
  }

  async function pushTable(dbKey) {
    if (!_client || _skipPush || !DB.settings?.supabaseSyncEnabled) return;
    if (dbKey === 'settings') {
      await pushSettingsRow();
      return;
    }
    const table = TABLE_MAP[dbKey];
    if (!table) return;
    const arr = DB[dbKey] || [];
    if (!arr.length) return;
    const payload = arr.map(item => {
      const u = item.updatedAt || item.createdAt || new Date().toISOString();
      return {
        id: String(item.id),
        data: item,
        deleted_at: null,
        updated_at: u,
      };
    });
    const { error } = await _client.from(table).upsert(payload, { onConflict: 'id' });
    if (error) throw error;
  }

  async function pushAllTables() {
    if (!_client) return;
    for (const k of Object.keys(TABLE_MAP)) {
      try {
        await pushTable(k);
      } catch (e) {
        console.warn('[Supabase] pushAll', k, e);
      }
    }
  }

  async function softDeleteRemote(dbKey, id) {
    if (!_client || !DB.settings?.supabaseSyncEnabled) return;
    const table = TABLE_MAP[dbKey];
    if (!table) return;
    const now = new Date().toISOString();
    const { error } = await _client
      .from(table)
      .update({ deleted_at: now, updated_at: now })
      .eq('id', String(id));
    if (error) console.warn('[Supabase] soft-delete', dbKey, error);
  }

  function refreshUI(keys) {
    const page = document.querySelector('.page.active')?.id;
    const set = new Set(keys);
    if (set.has('docs')) {
      if (typeof renderHistory === 'function') renderHistory();
      if (typeof buildNotifications === 'function') buildNotifications();
    }
    if (set.has('clients') && page === 'page-clients' && typeof renderClients === 'function') {
      renderClients();
    }
    if (set.has('stock') && page === 'page-stock' && typeof renderStock === 'function') {
      renderStock();
    }
    if (
      set.has('fournisseurs') &&
      page === 'page-fournisseurs' &&
      typeof renderFournisseurs === 'function'
    ) {
      renderFournisseurs();
    }
    if (
      set.has('bonsCommande') &&
      page === 'page-bons-commande' &&
      typeof renderBonsCommande === 'function'
    ) {
      renderBonsCommande();
    }
    if (set.has('settings')) {
      if (typeof loadSettings === 'function') loadSettings();
      if (typeof syncLogoSettingsUI === 'function') syncLogoSettingsUI();
      if (typeof updateSettingsScore === 'function') updateSettingsScore();
      if (typeof renderSettingsActivationStatus === 'function') void renderSettingsActivationStatus();
    }
    setTimeout(() => {
      if (typeof renderOverview === 'function') renderOverview(true);
    }, 0);
  }

  function schedulePullForTable(pgTable) {
    const dbKey = KEY_BY_TABLE[pgTable];
    if (!dbKey) return;
    clearTimeout(_debouncePull[dbKey]);
    _debouncePull[dbKey] = setTimeout(async () => {
      if (_pulling) {
        _pendingRt.add(pgTable);
        return;
      }
      try {
        await pullTable(dbKey);
        document.dispatchEvent(
          new CustomEvent('invoo-supabase-merged', { detail: { keys: [dbKey] } }),
        );
        refreshUI([dbKey]);
      } catch (e) {
        console.warn('[Supabase] realtime pull', dbKey, e);
      }
    }, 450);
  }

  async function pullAll() {
    if (!_client) return;
    _pulling = true;
    const keys = Object.keys(TABLE_MAP);
    try {
      for (const k of keys) {
        try {
          await pullTable(k);
        } catch (e) {
          console.warn('[Supabase] pull', k, e);
        }
      }
      document.dispatchEvent(new CustomEvent('invoo-supabase-merged', { detail: { keys } }));
      refreshUI(keys);
    } finally {
      _pulling = false;
      if (_pendingRt.size) {
        const pending = [..._pendingRt];
        _pendingRt.clear();
        for (const t of pending) schedulePullForTable(t);
      }
    }
  }

  function schedulePush(dbKey) {
    if (!_client || _skipPush || !DB.settings?.supabaseSyncEnabled) return;
    clearTimeout(_debouncePush[dbKey]);
    _debouncePush[dbKey] = setTimeout(() => {
      pushTable(dbKey).catch(e => console.warn('[Supabase] push', dbKey, e));
    }, 2500);
  }

  function stopRealtime(updateLabel) {
    _sessionActive = false;
    if (_channel && _client) {
      try {
        _client.removeChannel(_channel);
      } catch (_) {}
    }
    _channel = null;
    _client = null;
    if (updateLabel !== false) updateSupabaseStatus('Déconnecté');
  }

  function createChannel() {
    const ch = _client.channel('invoo-office-realtime', {
      config: { broadcast: { self: false }, presence: { enabled: false } },
    });
    for (const table of Object.values(TABLE_MAP)) {
      ch.on(
        'postgres_changes',
        { event: '*', schema: 'public', table },
        () => schedulePullForTable(table),
      );
    }
    return ch;
  }

  async function startRealtime() {
    const url = (DB.settings?.supabaseUrl || '').trim();
    const key = (DB.settings?.supabaseAnonKey || '').trim();
    if (!url || !key) {
      throw new Error('URL ou clé API manquante');
    }
    if (typeof supabase === 'undefined' || !supabase.createClient) {
      throw new Error('Bibliothèque Supabase non chargée');
    }
    const u = url.replace(/\/+$/, '');
    if (!u.startsWith('https://') || !u.includes('.supabase.co')) {
      throw new Error('URL projet invalide (ex. https://xxxx.supabase.co)');
    }
    stopRealtime(false);
    _client = supabase.createClient(url, key, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
      realtime: { params: { eventsPerSecond: 8 } },
    });
    const ch = createChannel();
    let subscribed = false;
    await new Promise(resolve => {
      ch.subscribe((status, err) => {
        if (status === 'SUBSCRIBED') {
          subscribed = true;
          resolve();
        }
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.warn('[Supabase] channel', status, err);
          resolve();
        }
      });
      setTimeout(resolve, 12000);
    });
    if (!subscribed) {
      try {
        _client.removeChannel(ch);
      } catch (_) {}
      _channel = null;
      /* REST pull/push fonctionne sans Realtime ; les changements distants arrivent au prochain « Synchroniser ». */
    } else {
      _channel = ch;
    }
    _sessionActive = true;
    return true;
  }

  window.invooSupabaseSoftDelete = function (dbKey, id) {
    void softDeleteRemote(dbKey, id);
  };

  window.invooSupabaseOnLocalChange = function (dbKey) {
    if (!TABLE_MAP[dbKey]) return;
    schedulePush(dbKey);
  };

  window.invooSupabaseDisconnect = function (silent) {
    stopRealtime(true);
    if (!silent && typeof toast === 'function') toast('Supabase déconnecté', '');
  };

  window.invooSupabaseConnect = async function () {
    const enEl = document.getElementById('s-supabase-sync-enabled');
    if (!enEl?.checked) {
      if (typeof toast === 'function') {
        toast('Activez d’abord la synchronisation Supabase (case en haut de cette section).', 'err');
      }
      return;
    }
    DB.settings.supabaseSyncEnabled = true;
    const urlEl = document.getElementById('s-supabase-url');
    const keyEl = document.getElementById('s-supabase-anon-key');
    if (urlEl) DB.settings.supabaseUrl = urlEl.value.trim();
    if (keyEl && keyEl.value.trim()) DB.settings.supabaseAnonKey = keyEl.value.trim();
    if (typeof save === 'function') save('settings');
    updateSupabaseStatus('Connexion…');
    try {
      await startRealtime();
      await pullAll();
      await pushAllTables();
      updateSupabaseStatus('Connecté · synchronisé');
      if (typeof toast === 'function') toast('Supabase : connecté et synchronisé ✓', 'suc');
    } catch (e) {
      console.error(e);
      stopRealtime(true);
      updateSupabaseStatus('Erreur : ' + (e.message || String(e)));
      if (typeof toast === 'function') toast('Supabase : ' + (e.message || 'échec'), 'err');
    }
  };

  window.invooSupabaseSyncNow = async function () {
    if (!_client) {
      if (typeof toast === 'function') toast("Connectez-vous d'abord à Supabase", 'err');
      return;
    }
    updateSupabaseStatus('Synchronisation…');
    try {
      await pullAll();
      await pushAllTables();
      updateSupabaseStatus('Connecté · à jour');
      if (typeof toast === 'function') toast('Synchronisation terminée ✓', 'suc');
    } catch (e) {
      console.error(e);
      updateSupabaseStatus('Erreur sync');
      if (typeof toast === 'function') toast('Sync : ' + (e.message || 'erreur'), 'err');
    }
  };

  window.invooSupabaseTryAutoStart = async function () {
    if (_sessionActive) return;
    if (!DB.settings?.supabaseSyncEnabled) return;
    const url = (DB.settings.supabaseUrl || '').trim();
    const key = (DB.settings.supabaseAnonKey || '').trim();
    if (!url || !key) return;
    if (typeof supabase === 'undefined') return;
    try {
      await startRealtime();
      await pullAll();
      updateSupabaseStatus('Connecté (auto)');
    } catch (e) {
      console.warn('[Supabase] auto-start', e);
      stopRealtime();
      updateSupabaseStatus('Non connecté (vérifiez URL / clé)');
    }
  };

  window.syncSupabaseSettingsUI = function () {
    const s = DB.settings || {};
    const en = document.getElementById('s-supabase-sync-enabled');
    if (en) en.checked = !!s.supabaseSyncEnabled;
    const url = document.getElementById('s-supabase-url');
    if (url) url.value = s.supabaseUrl || '';
    const key = document.getElementById('s-supabase-anon-key');
    if (key) {
      key.value = '';
      key.placeholder = s.supabaseAnonKey ? '•••• laisser vide pour conserver la clé' : 'eyJhbGciOiJIUzI1NiIs…';
    }
    if (_sessionActive) {
      updateSupabaseStatus('Connecté');
    } else if (s.supabaseSyncEnabled && s.supabaseUrl && s.supabaseAnonKey) {
      updateSupabaseStatus('Prêt — cliquez sur Connecter');
    } else {
      updateSupabaseStatus('Non configuré');
    }
  };
})();
