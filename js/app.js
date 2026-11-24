// TeamLedger v3.1 — LIFF Boot & Instant Stale-While-Revalidate Cache + ?page= Router
(function () {
  var qs = new URLSearchParams(location.search);
  var requestedPage = qs.get('page') || 'expense';
  var draftId = qs.get('id') || '';
  var BOOT_CACHE_KEY = 'tl_boot_cache_v1';

  var PAGE_META = {
    expense:   { title: 'จ่าย', ico: '💸', ownerOnly: false },
    income:    { title: 'รับ', ico: '💰', ownerOnly: false },
    sell:      { title: 'ออกบิล', ico: '🧾', ownerOnly: false },
    pending:   { title: 'รอโอน', ico: '⏳', ownerOnly: true },
    mine:      { title: 'รายการ', ico: '📑', ownerOnly: false },
    summary:   { title: 'สรุป', ico: '📊', ownerOnly: false },
    products:  { title: 'สินค้า', ico: '📦', ownerOnly: false },
    customers: { title: 'ลูกค้า', ico: '👥', ownerOnly: false },
    settings:  { title: 'ตั้งค่า', ico: '⚙️', ownerOnly: false },
    team:      { title: 'ทีมงาน', ico: '👨‍👩‍👧‍👦', ownerOnly: true }
  };

  function getSubFromToken(idToken) {
    try {
      var decoded = window.liff && liff.getDecodedIDToken ? liff.getDecodedIDToken() : null;
      if (decoded && decoded.sub) return String(decoded.sub);
      var part = String(idToken || '').split('.')[1];
      if (!part) return '';
      var json = JSON.parse(atob(part.replace(/-/g, '+').replace(/_/g, '/')));
      return String(json.sub || '');
    } catch (e) {
      return '';
    }
  }

  function loadBootCache(sub) {
    try {
      var raw = JSON.parse(localStorage.getItem(BOOT_CACHE_KEY) || 'null');
      if (!raw || !raw.user || raw.sub !== sub) return null;
      // อายุแคชสูงสุด 24 ชม. สำหรับ UI แสดงผลด่วน (ยังไงเบื้องหลังตรวจสิทธิ์จริงทุกครั้ง)
      if (Date.now() - (raw.ts || 0) > 86400000) return null;
      return raw;
    } catch (e) {
      return null;
    }
  }

  function saveBootCache(sub, user, categories, invoiceSettings) {
    try {
      localStorage.setItem(BOOT_CACHE_KEY, JSON.stringify({
        sub: sub,
        ts: Date.now(),
        user: user,
        categories: categories,
        invoiceSettings: invoiceSettings
      }));
    } catch (e) {}
  }

  function clearBootCache() {
    try { localStorage.removeItem(BOOT_CACHE_KEY); } catch (e) {}
  }

  function navigate(page, extraParams) {
    if (page === 'draft') {
      page = 'expense';
      extraParams = extraParams || { draftId: draftId };
    }
    var meta = PAGE_META[page] || PAGE_META.expense;
    if (meta.ownerOnly && TLApi.state.user && TLApi.state.user.role !== 'OWNER') {
      page = 'mine';
    }
    TLApi.state.currentPage = page;

    document.querySelectorAll('.nav-btn').forEach(function (b) {
      b.classList.toggle('active', b.dataset.nav === page);
    });

    var container = document.getElementById('app-view');
    var handler = window.TLPages[page] || window.TLPages.expense;
    handler(container, extraParams || {});
  }

  function renderNav(user) {
    var isOwner = user.role === 'OWNER';
    var navKeys = isOwner
      ? ['expense', 'income', 'sell', 'pending', 'summary']
      : ['expense', 'income', 'sell', 'mine', 'summary'];

    var nav = document.getElementById('bottom-nav');
    nav.innerHTML = navKeys.map(function (k) {
      var m = PAGE_META[k];
      return '<button type="button" class="nav-btn" data-nav="' + k + '"><span class="ico">' + m.ico + '</span><span>' + m.title + '</span></button>';
    }).join('');
    nav.hidden = false;

    nav.querySelectorAll('.nav-btn').forEach(function (b) {
      b.onclick = function () { navigate(b.dataset.nav); };
    });

    document.getElementById('btn-menu-more').onclick = function () {
      var allKeys = Object.keys(PAGE_META).filter(function (k) { return !PAGE_META[k].ownerOnly || isOwner; });
      var html = '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">' +
        allKeys.map(function (k) {
          var m = PAGE_META[k];
          return '<button type="button" class="btn outline" data-drawer="' + k + '">' + m.ico + ' ' + m.title + '</button>';
        }).join('') +
      '</div>';
      TLUtils.showModal('เมนูทั้งหมด', html);
      document.querySelectorAll('[data-drawer]').forEach(function (b) {
        b.onclick = function () {
          TLUtils.closeModal();
          navigate(b.dataset.drawer);
        };
      });
    };
  }

  async function boot() {
    document.getElementById('modal-close').onclick = TLUtils.closeModal;
    document.getElementById('modal-root').onclick = function (e) {
      if (e.target.id === 'modal-root') TLUtils.closeModal();
    };

    var appView = document.getElementById('app-view');
    if (!window.TL_CONFIG || !TL_CONFIG.LIFF_ID || TL_CONFIG.LIFF_ID.indexOf('YOUR_LIFF_ID') !== -1) {
      appView.innerHTML =
        '<div class="card"><h2>⚙️ ยังไม่ได้ตั้งค่า LIFF_ID</h2>' +
        '<p class="hint">กรุณานำ <b>LIFF_ID</b> และ <b>API_URL</b> (/exec) มาใส่ในไฟล์ <code>liff/config.js</code> ก่อนใช้งานจริง</p></div>';
      document.getElementById('user-badge').textContent = 'รอตั้งค่า config.js';
      return;
    }

    try {
      await liff.init({ liffId: TL_CONFIG.LIFF_ID });
      if (!liff.isLoggedIn()) {
        liff.login();
        return;
      }
      TLApi.state.idToken = liff.getIDToken() || '';
      if (!TLApi.state.idToken) {
        throw new Error('ไม่พบ ID Token จาก LINE (ตรวจสอบว่าเปิด Scopes: profile และ openid ในการตั้งค่า LIFF แล้ว)');
      }

      var sub = getSubFromToken(TLApi.state.idToken);
      var cached = sub ? loadBootCache(sub) : null;

      // เปิดหน้าจอทันทีจากแคช (ลดเวลารอเปิดเมนูจาก Rich Menu เหลือ < 0.3 วินาที)
      if (cached) {
        TLApi.state.user = cached.user;
        TLApi.state.categories = cached.categories || [];
        TLApi.state.invoiceSettings = cached.invoiceSettings || TLInvoiceCore.defaults();
        document.getElementById('user-badge').textContent = cached.user.name + ' · ' + cached.user.role;
        renderNav(cached.user);
        navigate(requestedPage, requestedPage === 'draft' ? { draftId: draftId } : {});
      }

      // ยืนยันสิทธิ์ + อัปเดตข้อมูลล่าสุดพร้อมกันเบื้องหลัง (1 รอบ Parallel)
      var results = await Promise.all([
        TLApi.call('getSession', {}),
        TLApi.call('getCategories', {}).catch(function () { return null; }),
        TLApi.call('getInvoiceSettings', {}).catch(function () { return null; })
      ]);

      var sess = results[0].session;
      TLApi.state.session = sess;

      if (sess.status !== 'ACTIVE') {
        clearBootCache();
        document.getElementById('bottom-nav').hidden = true;
        document.getElementById('user-badge').textContent = 'ยังไม่ได้เข้าสู่ระบบทีม';
        window.TLPages.register(appView, sess);
        return;
      }

      var newCats = (results[1] && results[1].categories) || TLApi.state.categories || [];
      var newInv = (results[2] && results[2].settings) || TLApi.state.invoiceSettings || TLInvoiceCore.defaults();
      var roleChanged = !cached || cached.user.role !== sess.user.role || cached.user.canIssueInvoice !== sess.user.canIssueInvoice;

      TLApi.state.user = sess.user;
      TLApi.state.categories = newCats;
      TLApi.state.invoiceSettings = newInv;
      if (sub) saveBootCache(sub, sess.user, newCats, newInv);

      document.getElementById('user-badge').textContent = sess.user.name + ' · ' + sess.user.role;

      if (!cached || roleChanged) {
        renderNav(sess.user);
        navigate(requestedPage, requestedPage === 'draft' ? { draftId: draftId } : {});
      }

      // โหลดข้อมูลแท็บหลักล่วงหน้าเบื้องหลัง เพื่อให้กดเปลี่ยนแท็บแล้วขึ้นทันที 0 ms
      setTimeout(function () {
        var m = TLUtils.currentMonthKey();
        if (!TLApi.getCache('mine:' + m + ':')) {
          TLApi.call('getTransactions', { month: m, type: '', limit: 150 }).then(function (r) {
            TLApi.setCache('mine:' + m + ':', r.transactions || []);
          }).catch(function () {});
        }
        if (!TLApi.getCache('summary:' + m + ':bill')) {
          TLApi.call('getSummaryReport', { month: m, dateMode: 'bill' }).then(function (r) {
            TLApi.setCache('summary:' + m + ':bill', r);
          }).catch(function () {});
        }
        if (sess.user.role === 'OWNER') {
          if (!TLApi.getCache('pending')) {
            TLApi.call('getPendingPayments', {}).then(function (r) {
              TLApi.setCache('pending', r);
            }).catch(function () {});
          }
          if (!TLApi.getCache('vat:' + m)) {
            TLApi.call('getVatReport', { month: m }).then(function (r) {
              TLApi.setCache('vat:' + m, r);
            }).catch(function () {});
          }
        }
      }, 150);
    } catch (err) {
      document.getElementById('user-badge').textContent = 'เกิดข้อผิดพลาด';
      appView.innerHTML =
        '<div class="card"><h2>⚠️ ไม่สามารถเชื่อมต่อระบบ</h2>' +
        '<div class="warn-box">' + TLUtils.esc(err.message) + '</div>' +
        '<button type="button" class="btn pri full" onclick="location.reload()">ลองใหม่</button></div>';
    }
  }

  boot();
})();
