// TeamLedger v3.1 — LIFF Boot & ?page= Router
(function () {
  var qs = new URLSearchParams(location.search);
  var requestedPage = qs.get('page') || 'expense';
  var draftId = qs.get('id') || '';

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

    // อัปเดตสถานะแถบล่าง
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

      var sessRes = await TLApi.call('getSession', {});
      var sess = sessRes.session;
      TLApi.state.session = sess;

      if (sess.status !== 'ACTIVE') {
        document.getElementById('user-badge').textContent = 'ยังไม่ได้เข้าสู่ระบบทีม';
        window.TLPages.register(appView, sess);
        return;
      }

      TLApi.state.user = sess.user;
      document.getElementById('user-badge').textContent = sess.user.name + ' (' + sess.user.role + ')';

      // โหลดหมวดหมู่และค่าตั้งต้นฟอร์มบิลแบบขนาน
      var initData = await Promise.all([
        TLApi.call('getCategories', {}).catch(function () { return { categories: [] }; }),
        TLApi.call('getInvoiceSettings', {}).catch(function () { return { settings: TLInvoiceCore.defaults() }; })
      ]);
      TLApi.state.categories = initData[0].categories || [];
      TLApi.state.invoiceSettings = initData[1].settings || TLInvoiceCore.defaults();

      renderNav(sess.user);
      navigate(requestedPage, requestedPage === 'draft' ? { draftId: draftId } : {});
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
