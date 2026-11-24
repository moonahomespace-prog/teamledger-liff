// TeamLedger v3.1 — API Client + Smart Tab Cache (text/plain เลี่ยง CORS preflight บน GAS)
window.TLApi = (function () {
  var state = {
    idToken: '',
    session: null,
    user: null,
    categories: [],
    invoiceSettings: null,
    currentPage: 'expense'
  };

  var memCache = {};
  var CACHE_PREFIX = 'tl_tab_v1_';
  var MUTATING_ACTIONS = {
    createTransaction: true,
    updateTransaction: true,
    cancelTransaction: true,
    createPaymentBatch: true,
    cancelPaymentBatch: true,
    issueInvoice: true,
    cancelInvoice: true,
    convertAbbToFull: true,
    saveCustomer: true,
    updateUser: true,
    saveInvoiceSettings: true,
    saveProduct: true,
    importProducts: true,
    updateSettings: true,
    saveCategories: true
  };

  function scopeKey(key) {
    var uid = (state.user && state.user.userId) ? state.user.userId : 'anon';
    return CACHE_PREFIX + uid + '_' + key;
  }

  function getCache(key) {
    var sk = scopeKey(key);
    if (memCache[sk]) return memCache[sk];
    try {
      var raw = sessionStorage.getItem(sk);
      if (raw) {
        memCache[sk] = JSON.parse(raw);
        return memCache[sk];
      }
    } catch (e) {}
    return null;
  }

  function setCache(key, val) {
    var sk = scopeKey(key);
    memCache[sk] = val;
    try { sessionStorage.setItem(sk, JSON.stringify(val)); } catch (e) {}
  }

  function clearCache() {
    memCache = {};
    try {
      var toDel = [];
      for (var i = 0; i < sessionStorage.length; i++) {
        var k = sessionStorage.key(i);
        if (k && k.indexOf(CACHE_PREFIX) === 0) toDel.push(k);
      }
      toDel.forEach(function (k) { sessionStorage.removeItem(k); });
    } catch (e) {}
  }

  function getApiUrl() {
    return (window.TL_CONFIG && window.TL_CONFIG.API_URL) || '';
  }

  async function call(action, payload) {
    var apiUrl = getApiUrl();
    if (!apiUrl || apiUrl.indexOf('YOUR_APPS_SCRIPT') !== -1) {
      throw new Error('ยังไม่ได้ตั้งค่า API_URL ในไฟล์ liff/config.js');
    }
    var resp = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({
        action: action,
        idToken: state.idToken,
        payload: payload || {}
      })
    });
    var data = await resp.json();
    if (!data || data.ok === false) {
      throw new Error((data && data.error) || 'เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์');
    }
    if (MUTATING_ACTIONS[action]) {
      clearCache();
    }
    return data;
  }

  async function viewPrivateImage(fileId, title) {
    try {
      TLUtils.showToast('กำลังโหลดรูปภาพ...');
      var res = await call('getImage', { fileId: fileId });
      var f = res.file;
      var src = 'data:' + f.mimeType + ';base64,' + f.base64;
      TLUtils.showModal(title || 'รูปหลักฐาน', '<img src="' + src + '" style="width:100%;border-radius:10px">');
    } catch (e) {
      TLUtils.showToast(e.message, 'err');
    }
  }

  return {
    state: state,
    call: call,
    getCache: getCache,
    setCache: setCache,
    clearCache: clearCache,
    viewPrivateImage: viewPrivateImage
  };
})();
