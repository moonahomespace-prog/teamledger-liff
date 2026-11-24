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

  var selectedCat = cats[0].category;
  var slipImage = '';

  function render() {
    var chipsHtml = '<div class="chip-group">' + cats.map(function (c) {
      return '<button type="button" class="chip sky' + (c.category === selectedCat ? ' active' : '') + '" data-icat="' + esc(c.category) + '">' + esc(c.category) + '</button>';
    }).join('') + '</div>';

    container.innerHTML =
      '<div class="card">' +
        '<h2>🩵 บันทึกรายรับ</h2>' +
        '<label class="f">จำนวนเงินที่รับ (บาท)</label>' +
        '<input type="number" step="0.01" inputmode="decimal" id="inc-amt" class="amount-hero sky" placeholder="0.00">' +
        '<label class="f">หมวดหมู่รายรับ</label>' +
        chipsHtml +
        '<div class="grid2">' +
          '<div><label class="f">รายละเอียด</label><input type="text" id="inc-desc" placeholder="เช่น โอนค่าสินค้า / Shopee"></div>' +
          '<div><label class="f">รับจาก (ลูกค้า/ช่องทาง)</label><input type="text" id="inc-payee" placeholder="ลูกค้าหน้าร้าน"></div>' +
        '</div>' +
        '<label class="upload-zone sky" style="margin-top:12px">' +
          '<span class="uz-ico">🧾</span>' +
          '<span class="uz-title">แนบรูปสลิป / หลักฐาน (ถ้ามี)</span>' +
          '<span class="uz-sub">' + (slipImage ? 'แนบสลิปแล้ว ✓ (แตะเพื่อเปลี่ยน)' : 'แตะเพื่อถ่ายรูป หรือเลือกรูป') + '</span>' +
          '<input type="file" id="inc-slip" accept="image/*">' +
        '</label>' +
        (slipImage ? '<div class="thumbs"><div class="thumb-item"><img src="' + slipImage + '"><button type="button" class="thumb-del" id="inc-del-slip">✕</button></div></div>' : '') +

        '<details class="opt-box">' +
          '<summary>⚙️ วันที่รับเงิน & VAT</summary>' +
          '<div class="grid2">' +
            '<div><label class="f">วันที่รับเงิน</label><input type="date" id="inc-date" value="' + TLUtils.todayISO() + '"></div>' +
            '<div><label class="f">ภาษีขาย (VAT)</label><select id="inc-vat">' +
              '<option value="INCL">รวม VAT 7% แล้ว</option>' +
              '<option value="NONE">ไม่มี VAT</option>' +
              '<option value="EXCL">ยังไม่รวม VAT (+7%)</option>' +
            '</select></div>' +
          '</div>' +
        '</details>' +

        '<div class="btns" style="margin-top:14px">' +
          '<button type="button" class="btn pri full" id="btn-save-income">✨ บันทึกรายรับ</button>' +
        '</div>' +
      '</div>';

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
      render();
    };
    var delBtn = document.getElementById('inc-del-slip');
    if (delBtn) delBtn.onclick = function () { slipImage = ''; render(); };

    document.getElementById('btn-save-income').onclick = async function () {
      var btn = this;
      var amtSt = TLInvoiceCore.parseFixed(document.getElementById('inc-amt').value, 2);
      if (amtSt <= 0) return TLUtils.showToast('กรุณาระบุจำนวนเงินมากกว่า 0', 'err');
      var vatMode = document.getElementById('inc-vat').value;
      var finalAmt = amtSt, vatSt = 0;
      if (vatMode === 'INCL') vatSt = TLInvoiceCore.roundDiv(amtSt * 700, 10700);
      else if (vatMode === 'EXCL') { vatSt = TLInvoiceCore.roundDiv(amtSt * 700, 10000); finalAmt += vatSt; }

      btn.disabled = true;
      btn.textContent = 'กำลังบันทึก...';
      try {
        await TLApi.call('createTransaction', {
          type: 'รับ',
          billDate: document.getElementById('inc-date').value,
          category: selectedCat,
          description: document.getElementById('inc-desc').value.trim(),
          amount: (finalAmt / 100).toFixed(2),
          vatAmount: (vatSt / 100).toFixed(2),
          payee: document.getElementById('inc-payee').value.trim() || 'ร้าน',
          billImages: [],
          slipImage: slipImage
        });
        TLUtils.showToast('บันทึกรายรับสำเร็จ!', 'ok');
        slipImage = '';
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
