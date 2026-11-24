// TeamLedger v3.1 — บันทึกรายรับมินิมอล (กดง่ายภายใน 15 วินาที)
window.TLPages = window.TLPages || {};

window.TLPages.income = function (container) {
  var esc = TLUtils.esc;
  var cats = TLApi.state.categories.filter(function (c) { return c.type === 'รับ'; });
  if (!cats.length) cats = [
    { category: 'ยอดขายหน้าร้าน / ออนไลน์' },
    { category: 'ยอดขายตามใบกำกับภาษี' },
    { category: 'รายรับอื่นๆ' }
  ];

  var state = {
    amt: '',
    desc: '',
    payee: '',
    billDate: TLUtils.todayISO(),
    vatMode: 'INCL'
  };
  var selectedCat = cats[0].category;
  var slipImage = '';
  var slipScanInfo = null;

  function render() {
    var chipsHtml = '<div class="chip-group">' + cats.map(function (c) {
      return '<button type="button" class="chip sky' + (c.category === selectedCat ? ' active' : '') + '" data-icat="' + esc(c.category) + '">' + esc(c.category) + '</button>';
    }).join('') + '</div>';

    var scanBanner = '';
    if (slipScanInfo) {
      if (slipScanInfo.statusText) {
        scanBanner = '<div class="hint" id="inc-scan-progress" style="margin:6px 0">' + esc(slipScanInfo.statusText) + '</div>';
      } else if (slipScanInfo.amount || slipScanInfo.bankName || slipScanInfo.billDate) {
        scanBanner = '<div class="ok-box" style="margin:8px 0">' +
          (slipScanInfo.amount ? '✨ อ่านยอดเงินได้ประมาณ <b>' + esc(slipScanInfo.amount) + '</b> บ. ' : '') +
          (slipScanInfo.bankName ? '· ' + esc(slipScanInfo.bankName) + ' ' : '') +
          (slipScanInfo.billDate ? '· วันที่ ' + TLUtils.thaiDate(slipScanInfo.billDate) + ' ' : '') +
          '<div class="btns" style="margin:6px 0 0">' +
            (slipScanInfo.amount ? '<button type="button" class="btn sm sky" id="btn-inc-use-amt">ใช้ยอด ' + esc(slipScanInfo.amount) + '</button>' : '') +
            (slipScanInfo.billDate ? '<button type="button" class="btn sm outline" id="btn-inc-use-date">ใช้วันที่นี้</button>' : '') +
          '</div>' +
          '<div class="hint">(ระบบฟรี 0 บ. — โปรดตรวจความถูกต้องก่อนบันทึก)</div>' +
        '</div>';
      } else if (slipScanInfo.checked) {
        scanBanner = '<div class="warn-box" style="margin:8px 0">ไม่พบตัวเลขชัดเจนจากภาพ กรุณากรอกยอดเงินด้วยตัวเอง</div>';
      }
    }

    container.innerHTML =
      '<div class="card">' +
        '<h2>🩵 บันทึกรายรับ</h2>' +
        '<label class="f">จำนวนเงินที่รับ (บาท)</label>' +
        '<input type="number" step="0.01" inputmode="decimal" id="inc-amt" class="amount-hero sky" value="' + esc(state.amt) + '" placeholder="0.00">' +
        '<label class="f">หมวดหมู่รายรับ</label>' +
        chipsHtml +
        '<div class="grid2">' +
          '<div><label class="f">รายละเอียด</label><input type="text" id="inc-desc" value="' + esc(state.desc) + '" placeholder="เช่น โอนค่าสินค้า / Shopee"></div>' +
          '<div><label class="f">รับจาก (ลูกค้า/ช่องทาง)</label><input type="text" id="inc-payee" value="' + esc(state.payee) + '" placeholder="ลูกค้าหน้าร้าน"></div>' +
        '</div>' +
        '<label class="upload-zone sky" style="margin-top:12px">' +
          '<span class="uz-ico">🧾</span>' +
          '<span class="uz-title">แนบรูปสลิป / หลักฐาน (ถ้ามี)</span>' +
          '<span class="uz-sub">' + (slipImage ? 'แนบสลิปแล้ว ✓ (แตะเพื่อเปลี่ยน)' : 'แตะเพื่อถ่ายรูป หรือเลือกรูป') + '</span>' +
          '<input type="file" id="inc-slip" accept="image/*">' +
        '</label>' +
        (slipImage ? '<div class="thumbs"><div class="thumb-item"><img src="' + slipImage + '"><button type="button" class="thumb-del" id="inc-del-slip">✕</button></div></div>' : '') +
        (slipImage ? '<div class="btns" style="margin-top:6px"><button type="button" class="btn sm sky full" id="btn-inc-scan-slip">🔍 อ่านยอดเงินจากสลิป (ฟรี)</button></div>' : '') +
        scanBanner +

        '<details class="opt-box">' +
          '<summary>⚙️ วันที่รับเงิน & VAT</summary>' +
          '<div class="grid2">' +
            '<div><label class="f">วันที่รับเงิน</label><input type="date" id="inc-date" value="' + esc(state.billDate) + '"></div>' +
            '<div><label class="f">ภาษีขาย (VAT)</label><select id="inc-vat">' +
              '<option value="INCL"' + (state.vatMode === 'INCL' ? ' selected' : '') + '>รวม VAT 7% แล้ว</option>' +
              '<option value="NONE"' + (state.vatMode === 'NONE' ? ' selected' : '') + '>ไม่มี VAT</option>' +
              '<option value="EXCL"' + (state.vatMode === 'EXCL' ? ' selected' : '') + '>ยังไม่รวม VAT (+7%)</option>' +
            '</select></div>' +
          '</div>' +
        '</details>' +

        '<div class="btns" style="margin-top:14px">' +
          '<button type="button" class="btn pri full" id="btn-save-income">✨ บันทึกรายรับ</button>' +
        '</div>' +
      '</div>';

    document.getElementById('inc-amt').oninput = function () { state.amt = this.value; };
    document.getElementById('inc-desc').oninput = function () { state.desc = this.value; };
    document.getElementById('inc-payee').oninput = function () { state.payee = this.value; };
    document.getElementById('inc-date').onchange = function () { state.billDate = this.value; };
    document.getElementById('inc-vat').onchange = function () { state.vatMode = this.value; };

    container.querySelectorAll('[data-icat]').forEach(function (b) {
      b.onclick = function () {
        selectedCat = b.dataset.icat;
        container.querySelectorAll('[data-icat]').forEach(function (x) { x.classList.remove('active'); });
        b.classList.add('active');
      };
    });

    document.getElementById('inc-slip').onchange = async function (e) {
      var f = e.target.files && e.target.files[0];
      if (!f) return;
      TLUtils.showToast('กำลังย่อรูป...');
      slipImage = await TLUtils.compressImage(f, 1600, 0.75);
      slipScanInfo = null;
      if (window.TLSlipReader) {
        try {
          var qr = await TLSlipReader.readSlip(slipImage, { runOcr: false });
          if (qr.amount || qr.bankName) {
            slipScanInfo = qr;
            if (qr.amount && !state.amt) state.amt = qr.amount;
          }
        } catch (err) {}
      }
      render();
    };
    var delBtn = document.getElementById('inc-del-slip');
    if (delBtn) delBtn.onclick = function () { slipImage = ''; slipScanInfo = null; render(); };

    var scanBtn = document.getElementById('btn-inc-scan-slip');
    if (scanBtn) {
      scanBtn.onclick = async function () {
        if (!window.TLSlipReader || !slipImage) return;
        slipScanInfo = { statusText: 'กำลังโหลดตัวอ่านสลิป...' };
        render();
        try {
          var res = await TLSlipReader.readSlip(slipImage, {
            runOcr: true,
            onProgress: function (msg) {
              var hintEl = container.querySelector('.hint');
              if (hintEl && msg) hintEl.textContent = msg;
            }
          });
          slipScanInfo = Object.assign({ checked: true }, res);
          if (res.amount && !state.amt) state.amt = res.amount;
        } catch (e) {
          slipScanInfo = { checked: true };
          TLUtils.showToast(e.message, 'err');
        }
        render();
      };
    }
    var useAmtBtn = document.getElementById('btn-inc-use-amt');
    if (useAmtBtn) useAmtBtn.onclick = function () { state.amt = slipScanInfo.amount; render(); };
    var useDateBtn = document.getElementById('btn-inc-use-date');
    if (useDateBtn) useDateBtn.onclick = function () { state.billDate = slipScanInfo.billDate; render(); };

    document.getElementById('btn-save-income').onclick = async function () {
      var btn = this;
      var amtSt = TLInvoiceCore.parseFixed(state.amt, 2);
      if (amtSt <= 0) return TLUtils.showToast('กรุณาระบุจำนวนเงินมากกว่า 0', 'err');
      var vatMode = state.vatMode;
      var finalAmt = amtSt, vatSt = 0;
      if (vatMode === 'INCL') vatSt = TLInvoiceCore.roundDiv(amtSt * 700, 10700);
      else if (vatMode === 'EXCL') { vatSt = TLInvoiceCore.roundDiv(amtSt * 700, 10000); finalAmt += vatSt; }

      btn.disabled = true;
      btn.textContent = 'กำลังบันทึก...';
      try {
        await TLApi.call('createTransaction', {
          type: 'รับ',
          billDate: state.billDate,
          category: selectedCat,
          description: state.desc.trim(),
          amount: (finalAmt / 100).toFixed(2),
          vatAmount: (vatSt / 100).toFixed(2),
          payee: state.payee.trim() || 'ร้าน',
          billImages: [],
          slipImage: slipImage
        });
        TLUtils.showToast('บันทึกรายรับสำเร็จ!', 'ok');
        state.amt = ''; state.desc = ''; state.payee = ''; slipImage = ''; slipScanInfo = null;
        render();
      } catch (e) {
        TLUtils.showToast(e.message, 'err');
        btn.disabled = false;
        btn.textContent = '✨ บันทึกรายรับ';
      }
    };
  }

  render();
};
