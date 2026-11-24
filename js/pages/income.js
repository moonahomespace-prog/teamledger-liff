// TeamLedger v3.1 — บันทึกรายรับ (ฉบับเร็ว 30 วินาที)
window.TLPages = window.TLPages || {};

window.TLPages.income = function (container) {
  var esc = TLUtils.esc;
  var cats = TLApi.state.categories.filter(function (c) { return c.type === 'รับ'; });
  if (!cats.length) cats = [{ category: 'ยอดขายหน้าร้าน / ออนไลน์' }, { category: 'รายรับอื่นๆ' }];

  var billImages = [];
  var slipImage = '';

  container.innerHTML =
    '<div class="card">' +
      '<h2>💰 บันทึกรายรับ</h2>' +
      '<div class="grid2">' +
        '<div><label class="f">วันที่รับเงิน</label><input type="date" id="inc-date" value="' + TLUtils.todayISO() + '"></div>' +
        '<div><label class="f">หมวดหมู่</label><select id="inc-cat">' +
          cats.map(function (c) { return '<option value="' + esc(c.category) + '">' + esc(c.category) + '</option>'; }).join('') +
        '</select></div>' +
      '</div>' +
      '<label class="f">รายละเอียด</label>' +
      '<input type="text" id="inc-desc" placeholder="เช่น ยอดขายหน้าร้าน / โอนจากลูกค้า">' +
      '<div class="grid2">' +
        '<div><label class="f">จำนวนเงิน (บาท)</label><input type="number" step="0.01" inputmode="decimal" id="inc-amt" placeholder="0.00"></div>' +
        '<div><label class="f">ภาษีมูลค่าเพิ่ม (VAT)</label><select id="inc-vat">' +
          '<option value="INCL">ราคารวม VAT 7% แล้ว</option>' +
          '<option value="NONE">ไม่มี VAT</option>' +
          '<option value="EXCL">ยังไม่รวม VAT (+7%)</option>' +
        '</select></div>' +
      '</div>' +
      '<label class="f">รับจาก (ลูกค้า / ช่องทาง)</label>' +
      '<input type="text" id="inc-payee" placeholder="เช่น ลูกค้าหน้าร้าน / Shopee">' +
      '<label class="f">แนบรูปสลิป / หลักฐาน (ถ้ามี)</label>' +
      '<input type="file" id="inc-slip" accept="image/*">' +
      '<div id="inc-preview" class="thumbs"></div>' +
      '<div class="btns" style="margin-top:16px">' +
        '<button type="button" class="btn pri full" id="btn-save-income">💾 บันทึกรายรับ</button>' +
      '</div>' +
    '</div>';

  document.getElementById('inc-slip').onchange = async function (e) {
    var f = e.target.files && e.target.files[0];
    if (!f) return;
    TLUtils.showToast('กำลังย่อรูป...');
    slipImage = await TLUtils.compressImage(f, 1600, 0.75);
    document.getElementById('inc-preview').innerHTML = '<div class="thumb-item"><img src="' + slipImage + '"></div>';
  };

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
        category: document.getElementById('inc-cat').value,
        description: document.getElementById('inc-desc').value.trim(),
        amount: (finalAmt / 100).toFixed(2),
        vatAmount: (vatSt / 100).toFixed(2),
        payee: document.getElementById('inc-payee').value.trim() || 'ร้าน',
        billImages: billImages,
        slipImage: slipImage
      });
      TLUtils.showToast('บันทึกรายรับสำเร็จ!', 'ok');
      document.getElementById('inc-desc').value = '';
      document.getElementById('inc-amt').value = '';
      slipImage = '';
      document.getElementById('inc-preview').innerHTML = '';
    } catch (e) {
      TLUtils.showToast(e.message, 'err');
    } finally {
      btn.disabled = false;
      btn.textContent = '💾 บันทึกรายรับ';
    }
  };
};
