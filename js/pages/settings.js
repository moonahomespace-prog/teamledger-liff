// TeamLedger v3.1 — ตั้งค่าระบบ, ข้อมูลกิจการ/ฟอร์มบิล (InvoiceSettings), และคู่มือช่วยเหลือ
window.TLPages = window.TLPages || {};

window.TLPages.settings = async function (container) {
  var esc = TLUtils.esc;
  var user = TLApi.state.user;
  var isOwner = user.role === 'OWNER';

  if (!isOwner) {
    container.innerHTML =
      '<div class="card">' +
        '<h2>ℹ️ ตั้งค่า & ช่วยเหลือ</h2>' +
        '<p><b>ผู้ใช้:</b> ' + esc(user.name) + ' <span class="badge">' + esc(user.role) + '</span></p>' +
        '<p><b>สิทธิ์ออกบิล:</b> ' + (user.canIssueInvoice ? 'เปิดใช้งาน' : 'ยังไม่เปิด') + '</p>' +
        '<div class="btns">' +
          '<button type="button" class="btn outline" id="btn-sync-cache-staff">🔄 อัปเดตแคชสินค้า (' + TLProductsCache.getAll().length + ')</button>' +
        '</div>' +
      '</div>' +
      '<div class="card">' +
        '<h3>📖 วิธีใช้งานด่วน (ลูกทีม)</h3>' +
        '<p class="hint">1) ส่งรูปบิลหรือรูปแคป Shopee เข้าแชต OA แล้วกดปุ่ม "กรอกยอด / แตกยอด"<br>' +
        '2) ถ้าซื้อหลายหมวดใน 1 สลิป กดปุ่ม "+ แตกยอดเพิ่ม (1 สลิปหลายรายการ)"<br>' +
        '3) พิมพ์คำว่า <b>สรุป</b>, <b>ค้างโอน</b>, หรือ <b>หาสินค้า ชื่อสินค้า</b> ในแชต OA ได้ฟรีตลอดเวลา</p>' +
      '</div>';
    document.getElementById('btn-sync-cache-staff').onclick = async function () {
      await TLProductsCache.sync(true);
      TLUtils.showToast('อัปเดตสินค้าแล้ว (' + TLProductsCache.getAll().length + ' รายการ)', 'ok');
    };
    return;
  }

  container.innerHTML = '<div class="card center-box"><div class="spinner"></div><p>กำลังโหลดการตั้งค่า...</p></div>';
  var inv = TLApi.state.invoiceSettings || TLInvoiceCore.defaults();
  var sys = { overdueDays: 3, notifyMode: 'realtime', liffId: '' };
  try {
    var sr = await TLApi.call('getSettingsPublic', {});
    sys = sr.settings || sys;
  } catch (e) {}

  container.innerHTML =
    '<div class="card">' +
      '<h2>⚙️ ตั้งค่าระบบ & ข้อมูลกิจการ (OWNER)</h2>' +
      '<div class="grid2">' +
        '<div><label class="f">ชื่อกิจการ (ไทย)</label><input type="text" id="set-sname" value="' + esc(inv.seller.name) + '"></div>' +
        '<div><label class="f">ชื่อกิจการ (อังกฤษ)</label><input type="text" id="set-sname-en" value="' + esc(inv.seller.nameEn) + '"></div>' +
      '</div>' +
      '<div class="grid2">' +
        '<div><label class="f">เลขประจำตัวผู้เสียภาษี (13 หลัก)</label><input type="text" id="set-taxid" value="' + esc(inv.seller.taxId) + '"></div>' +
        '<div><label class="f">สาขา</label><input type="text" id="set-branch" value="' + esc(inv.seller.branch) + '"></div>' +
      '</div>' +
      '<label class="f">ที่อยู่กิจการ</label><textarea id="set-addr">' + esc(inv.seller.address) + '</textarea>' +
      '<div class="grid2">' +
        '<div><label class="f">โทร</label><input type="text" id="set-phone" value="' + esc(inv.seller.phone) + '"></div>' +
        '<div><label class="f">ข้อความเพิ่มเติม (อีเมล/เว็บ)</label><input type="text" id="set-extra" value="' + esc(inv.seller.extra) + '"></div>' +
      '</div>' +
      '<div class="grid2">' +
        '<div><label class="f">โหมดราคาเริ่มต้น</label><select id="set-pmode">' +
          '<option value="INCL"' + (inv.priceMode === 'INCL' ? ' selected' : '') + '>ราคารวม VAT (INCL)</option>' +
          '<option value="EXCL"' + (inv.priceMode === 'EXCL' ? ' selected' : '') + '>ราคาไม่รวม VAT (EXCL)</option>' +
          '<option value="NONE"' + (inv.priceMode === 'NONE' ? ' selected' : '') + '>ไม่มี VAT (NONE)</option>' +
        '</select></div>' +
        '<div><label class="f">หัวข้อเอกสารเริ่มต้น</label><select id="set-dtype">' +
          Object.keys(TLInvoiceCore.DOC_TYPES).map(function (k) {
            return '<option value="' + k + '"' + (inv.docType === k ? ' selected' : '') + '>' + esc(TLInvoiceCore.DOC_TYPES[k].name) + '</option>';
          }).join('') +
        '</select></div>' +
      '</div>' +
      '<div class="grid2">' +
        '<div><label class="f">อัตรา VAT (%)</label><input type="text" id="set-vatrate" value="' + esc(inv.vatRate) + '"></div>' +
        '<div><label class="f">เตือนบิลค้างเกิน (วัน)</label><input type="number" id="set-overdue" value="' + esc(sys.overdueDays) + '"></div>' +
      '</div>' +
      '<div style="margin:8px 0"><label><input type="checkbox" id="set-linevat"' + (inv.showLineVat ? ' checked' : '') + '> แจกแจงก่อน VAT / VAT รายบรรทัดเป็นค่าเริ่มต้น</label></div>' +
      '<label class="f">เงื่อนไขท้ายบิลเริ่มต้น</label><textarea id="set-terms">' + esc(inv.terms) + '</textarea>' +
      '<label class="f">ช่องลงนามเริ่มต้น (หัวข้อ | คำอธิบาย | ใต้เส้น)</label><textarea id="set-signs">' + esc(inv.signatures) + '</textarea>' +
      '<label class="f">LIFF ID (สำหรับสร้างปุ่มเปิดในแชต LINE)</label><input type="text" id="set-liffid" value="' + esc(sys.liffId || (window.TL_CONFIG && window.TL_CONFIG.LIFF_ID) || '') + '">' +
      '<div class="btns" style="margin-top:12px">' +
        '<button type="button" class="btn pri full" id="btn-save-settings">💾 บันทึกการตั้งค่าทั้งหมด</button>' +
      '</div>' +
    '</div>' +
    '<div class="card">' +
      '<h3>🗂️ จัดการหมวดหมู่รายจ่าย / รายรับ</h3>' +
      '<p class="hint">ปรับชื่อ เพิ่ม หรือลบหมวดหมู่ที่ทีมงานเลือกใช้ (แก้ไขแล้วกดบันทึก)</p>' +
      '<div id="cat-mgr-list"></div>' +
      '<div class="grid2" style="margin-top:8px">' +
        '<div style="display:flex;gap:6px"><input type="text" id="new-cat-exp" placeholder="เพิ่มหมวดรายจ่าย..."><button type="button" class="btn sm outline" id="btn-add-cat-exp">+ จ่าย</button></div>' +
        '<div style="display:flex;gap:6px"><input type="text" id="new-cat-inc" placeholder="เพิ่มหมวดรายรับ..."><button type="button" class="btn sm sky" id="btn-add-cat-inc">+ รับ</button></div>' +
      '</div>' +
      '<div class="btns" style="margin-top:10px">' +
        '<button type="button" class="btn pri full" id="btn-save-cats">💾 บันทึกหมวดหมู่</button>' +
      '</div>' +
    '</div>' +
    '<div class="card">' +
      '<h3>🛡️ ตรวจสอบความปลอดภัย & ชีต</h3>' +
      '<div class="btns">' +
        '<button type="button" class="btn outline" id="btn-healthcheck">🔒 ตรวจการแชร์ Drive (healthCheck)</button>' +
        '<button type="button" class="btn outline" id="btn-refresh-dash">📊 อัปเดต Dashboard ในชีต</button>' +
      '</div>' +
    '</div>';

  var catList = (TLApi.state.categories || []).map(function (c) {
    return { type: c.type === 'รับ' ? 'รับ' : 'จ่าย', category: String(c.category || ''), active: true };
  });

  function renderCats() {
    var box = document.getElementById('cat-mgr-list');
    if (!box) return;
    box.innerHTML = catList.map(function (c, i) {
      return '<div style="display:flex;align-items:center;gap:6px;margin-bottom:6px">' +
        '<span class="badge ' + (c.type === 'รับ' ? 'ok' : '') + '" style="min-width:44px;text-align:center">' + esc(c.type) + '</span>' +
        '<input type="text" data-cat-edit="' + i + '" value="' + esc(c.category) + '" style="flex:1">' +
        '<button type="button" class="btn sm danger" data-cat-del="' + i + '">ลบ</button>' +
      '</div>';
    }).join('') || '<p class="hint">ยังไม่มีหมวดหมู่</p>';

    box.querySelectorAll('[data-cat-edit]').forEach(function (inp) {
      inp.oninput = function () { catList[Number(inp.dataset.catEdit)].category = inp.value; };
    });
    box.querySelectorAll('[data-cat-del]').forEach(function (b) {
      b.onclick = function () { catList.splice(Number(b.dataset.catDel), 1); renderCats(); };
    });
  }
  renderCats();

  function addCat(type, inpId) {
    var el = document.getElementById(inpId);
    var name = el ? el.value.trim() : '';
    if (!name) return TLUtils.showToast('กรุณากรอกชื่อหมวดหมู่', 'err');
    catList.push({ type: type, category: name, active: true });
    el.value = '';
    renderCats();
  }
  document.getElementById('btn-add-cat-exp').onclick = function () { addCat('จ่าย', 'new-cat-exp'); };
  document.getElementById('btn-add-cat-inc').onclick = function () { addCat('รับ', 'new-cat-inc'); };

  document.getElementById('btn-save-cats').onclick = async function () {
    var btn = this;
    var cleaned = catList
      .map(function (c) { return { type: c.type, category: c.category.trim(), active: true }; })
      .filter(function (c) { return !!c.category; });
    if (!cleaned.length) return TLUtils.showToast('ต้องมีหมวดหมู่อย่างน้อย 1 รายการ', 'err');
    btn.disabled = true;
    try {
      await TLApi.call('saveCategories', { categories: cleaned });
      catList = cleaned;
      TLApi.state.categories = cleaned.map(function (c) { return { type: c.type, category: c.category }; });
      if (window.TLRefreshBootCache) window.TLRefreshBootCache();
      renderCats();
      TLUtils.showToast('บันทึกหมวดหมู่เรียบร้อย (' + cleaned.length + ' หมวด)', 'ok');
    } catch (e) { TLUtils.showToast(e.message, 'err'); }
    btn.disabled = false;
  };

  document.getElementById('btn-save-settings').onclick = async function () {
    this.disabled = true;
    try {
      var dt = document.getElementById('set-dtype').value;
      var dtObj = TLInvoiceCore.DOC_TYPES[dt] || TLInvoiceCore.DOC_TYPES.FULL_RC;
      var newInv = Object.assign({}, inv, {
        docType: dt,
        title: dtObj.title || inv.title,
        titleEn: dtObj.en || inv.titleEn,
        priceMode: document.getElementById('set-pmode').value,
        vatRate: document.getElementById('set-vatrate').value.trim() || '7',
        showLineVat: document.getElementById('set-linevat').checked,
        terms: document.getElementById('set-terms').value,
        signatures: document.getElementById('set-signs').value,
        seller: {
          name: document.getElementById('set-sname').value.trim(),
          nameEn: document.getElementById('set-sname-en').value.trim(),
          taxId: document.getElementById('set-taxid').value.trim(),
          branch: document.getElementById('set-branch').value.trim(),
          address: document.getElementById('set-addr').value.trim(),
          phone: document.getElementById('set-phone').value.trim(),
          extra: document.getElementById('set-extra').value.trim()
        }
      });
      await TLApi.call('saveInvoiceSettings', { settings: newInv });
      await TLApi.call('updateSettings', {
        overdueDays: document.getElementById('set-overdue').value,
        liffId: document.getElementById('set-liffid').value.trim()
      });
      TLApi.state.invoiceSettings = newInv;
      TLUtils.showToast('บันทึกการตั้งค่าแล้ว!', 'ok');
    } catch (e) { TLUtils.showToast(e.message, 'err'); }
    this.disabled = false;
  };

  document.getElementById('btn-healthcheck').onclick = async function () {
    try {
      var r = await TLApi.call('runHealthCheck', {});
      if (r.ok) TLUtils.showToast('✅ ไฟล์และโฟลเดอร์ทั้งหมดเป็น Restricted 100%', 'ok');
      else TLUtils.showModal('⚠️ พบการแชร์ไฟล์', '<p>' + esc((r.violations || []).join('<br>')) + '</p>');
    } catch (e) { TLUtils.showToast(e.message, 'err'); }
  };

  document.getElementById('btn-refresh-dash').onclick = async function () {
    try {
      await TLApi.call('runDashboardRefresh', {});
      TLUtils.showToast('อัปเดต Dashboard ใน Google Sheet แล้ว', 'ok');
    } catch (e) { TLUtils.showToast(e.message, 'err'); }
  };
};
