// TeamLedger v3.1 — IndexedDB/localStorage Cache & Fast Local Search for 2,000+ Products
window.TLProductsCache = (function () {
  var DB_NAME = 'teamledger_cache';
  var STORE = 'kv';
  var LS_ITEMS = 'tl_prod_items_v1';
  var LS_VER = 'tl_prod_ver_v1';
  var LS_RECENT = 'tl_prod_recent_v1';
  var LS_FREQ = 'tl_prod_freq_v1';
  var items = [];
  var version = '';

  function openDb() {
    return new Promise(function (resolve, reject) {
      if (!window.indexedDB) return reject(new Error('no idb'));
      var req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = function () { req.result.createObjectStore(STORE); };
      req.onsuccess = function () { resolve(req.result); };
      req.onerror = function () { reject(req.error); };
    });
  }

  async function idbGet(key) {
    try {
      var db = await openDb();
      return await new Promise(function (resolve, reject) {
        var tx = db.transaction(STORE, 'readonly');
        var req = tx.objectStore(STORE).get(key);
        req.onsuccess = function () { resolve(req.result); };
        req.onerror = function () { reject(req.error); };
      });
    } catch (e) {
      try { return JSON.parse(localStorage.getItem(key) || 'null'); } catch (err) { return null; }
    }
  }

  async function idbSet(key, val) {
    try {
      var db = await openDb();
      await new Promise(function (resolve, reject) {
        var tx = db.transaction(STORE, 'readwrite');
        var req = tx.objectStore(STORE).put(val, key);
        req.onsuccess = function () { resolve(); };
        req.onerror = function () { reject(req.error); };
      });
    } catch (e) {
      try { localStorage.setItem(key, JSON.stringify(val)); } catch (err) {}
    }
  }

  async function loadLocal() {
    var cachedVer = await idbGet(LS_VER);
    var cachedItems = await idbGet(LS_ITEMS);
    if (Array.isArray(cachedItems)) {
      items = cachedItems;
      version = cachedVer ? String(cachedVer) : '';
    }
    return { items: items, version: version };
  }

  async function sync(force) {
    await loadLocal();
    var res = await TLApi.call('getProducts', { version: force ? '' : version, force: !!force });
    if (!res.unchanged && Array.isArray(res.items)) {
      items = res.items;
      version = String(res.version || '');
      await idbSet(LS_ITEMS, items);
      await idbSet(LS_VER, version);
    }
    return { items: items, version: version, updated: !res.unchanged };
  }

  function getAll() { return items; }
  function getVersion() { return version; }

  function search(query, limit) {
    limit = limit || 30;
    var q = String(query || '').trim().toLowerCase();
    if (!q) return items.slice(0, limit);
    var out = [];
    for (var i = 0; i < items.length; i++) {
      var p = items[i];
      // [sku, barcode, name, unit, price, category, vatType]
      if (
        String(p[2] || '').toLowerCase().indexOf(q) !== -1 ||
        String(p[0] || '').toLowerCase().indexOf(q) !== -1 ||
        String(p[1] || '').toLowerCase().indexOf(q) !== -1
      ) {
        out.push(p);
        if (out.length >= limit) break;
      }
    }
    return out;
  }

  function findExact(code) {
    var c = String(code || '').trim().toLowerCase();
    if (!c) return null;
    for (var i = 0; i < items.length; i++) {
      if (String(items[i][1] || '').toLowerCase() === c || String(items[i][0] || '').toLowerCase() === c) {
        return items[i];
      }
    }
    return null;
  }

  function recordUse(sku) {
    if (!sku) return;
    try {
      var rec = JSON.parse(localStorage.getItem(LS_RECENT) || '[]').filter(function (x) { return x !== sku; });
      rec.unshift(sku);
      localStorage.setItem(LS_RECENT, JSON.stringify(rec.slice(0, 20)));
      var freq = JSON.parse(localStorage.getItem(LS_FREQ) || '{}');
      freq[sku] = (freq[sku] || 0) + 1;
      localStorage.setItem(LS_FREQ, JSON.stringify(freq));
    } catch (e) {}
  }

  function getRecent() {
    try {
      var rec = JSON.parse(localStorage.getItem(LS_RECENT) || '[]');
      var map = {};
      for (var i = 0; i < items.length; i++) map[items[i][0]] = items[i];
      return rec.map(function (s) { return map[s]; }).filter(Boolean);
    } catch (e) { return []; }
  }

  function getFrequent() {
    try {
      var freq = JSON.parse(localStorage.getItem(LS_FREQ) || '{}');
      var map = {};
      for (var i = 0; i < items.length; i++) map[items[i][0]] = items[i];
      return Object.keys(freq)
        .sort(function (a, b) { return freq[b] - freq[a]; })
        .slice(0, 20)
        .map(function (s) { return map[s]; })
        .filter(Boolean);
    } catch (e) { return []; }
  }

  return {
    loadLocal: loadLocal,
    sync: sync,
    getAll: getAll,
    getVersion: getVersion,
    search: search,
    findExact: findExact,
    recordUse: recordUse,
    getRecent: getRecent,
    getFrequent: getFrequent
  };
})();
