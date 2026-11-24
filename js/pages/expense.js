// TeamLedger v3.1 — บันทึกรายจ่าย + แนบหลายรูป (Shopee/Lazada + สลิป) + แตกยอดหลายรายการใน 1 สลิป (Split Expense)
window.TLPages = window.TLPages || {};

window.TLPages.expense = async function (container, params) {
  var esc = TLUtils.esc;
  var draftId = (params && params.draftId) || '';
  var cats = TLApi.state.categories.filter(function (c) { return c.type === 'จ่าย'; });
  if (!cats.length) cats = [{ category: 'วัตถุดิบ / สินค้าเพื่อขาย' }, { category: 'ค่าขนส่ง / พัสดุ' }, { category: 'ค่าใช้จ่ายเบ็ดเตล็ด' }];

  var state = {
    draftTxnId: draftId,
    existingBillImageId: '',
    billImages: [], // compressed JPEG dataURLs
    slipImage: '',
    billDate: TLUtils.todayISO(),
    payeeMode: 'SELF',
    payeeName: '',
    slipCompareTotal: '',
    splits: [
      { category: cats[0].category, description: '', amount: '', vatMode: 'NONE' }
    ]
  };

  var drafts = [];
  try {
    var dr = await TLApi.call('getDrafts', {});
    drafts = dr.drafts || [];
  } catch (e) {}

  if (draftId) {
    var matched = drafts.find(function (d) { return d.txnId === draftId; });
    if (matched) {
      state.billDate = matched.billDate || state.billDate;
      state.existingBillImageId = (matched.billImageIds || []).join(',');
    }
  }

  function calcSummary() {
    var sumSt = 0, vatSt = 0;
    state.splits.forEach(function (sp) {
      var amt = TLInvoiceCore.parseFixed(sp.amount, 2);
      if (amt > 0) {
        sumSt += amt;
        if (sp.vatMode === 'INCL') vatSt += TLInvoiceCore.roundDiv(amt * 700, 10700);
        else if (sp.vatMode === 'EXCL') {
          var v = TLInvoiceCore.roundDiv(amt * 700, 10000);
          vatSt += v;
          sumSt += v;
        }
      }
    });
    return { sumSt: sumSt, vatSt: vatSt };
  }

  function render() {
    var draftBanner = '';
    if (drafts.length) {
      draftBanner = '<div class="card"><h3>📷 ร่างจากรูปที่ส่งในแชต (' + drafts.length + ' รายการ)</h3>' +
        '<div class="btns">' +
        drafts.map(function (d) {
          var active = state.draftTxnId === d.txnId;
          return '<button type="button" class="btn sm ' + (active ? 'pri' : 'outline') + '" data-pick-draft="' + esc(d.txnId) + '">' +
            esc(d.txnId) + ' (' + TLUtils.thaiDate(d.billDate) + ')</button>';
        }).join('') +
        (state.draftTxnId ? '<button type="button" class="btn sm" id="btn-clear-draft">ยกเลิกร่าง</button>' : '') +
        '</div>' +
        (state.existingBillImageId
          ? '<div class="btns">' + state.existingBillImageId.split(',').filter(Boolean).map(function (fid, idx) {
              return '<button type="button" class="btn sm outline" data-view-img="' + esc(fid) + '">🖼️ ดูรูปร่าง #' + (idx + 1) + '</button>';
            }).join('') + '</div>'
          : '') +
        '</div>';
    }

    var splitHtml = state.splits.map(function (sp, idx) {
      var catOpts = cats.map(function (c) {
        return '<option value="' + esc(c.category) + '"' + (c.category === sp.category ? ' selected' : '') + '>' + esc(c.category) + '</option>';
      }).join('');
      return '<div class="split-card" data-sp="' + idx + '">' +
        '<div class="split-head"><strong>รายการที่ ' + (idx + 1) + '</strong>' +
        (state.splits.length > 1 ? '<button type="button" class="btn sm danger" data-del-sp="' + idx + '">ลบแถว</button>' : '') +
        '</div>' +
        '<div class="grid2">' +
          '<div><label class="f">หมวดหมู่</label><select data-sf="category">' + catOpts + '</select></div>' +
          '<div><label class="f">จำนวนเงิน (บาท)</label><input type="number" step="0.01" inputmode="decimal" data-sf="amount" value="' + esc(sp.amount) + '" placeholder="0.00"></div>' +
        '</div>' +
        '<div class="grid2">' +
          '<div><label class="f">รายละเอียดสินค้า/บิล</label><input type="text" data-sf="description" value="' + esc(sp.description) + '" placeholder="เช่น แพ็กเกจจิ้ง / Shopee"></div>' +
          '<div><label class="f">ภาษีซื้อ (VAT)</label><select data-sf="vatMode">' +
            '<option value="NONE"' + (sp.vatMode === 'NONE' ? ' selected' : '') + '>ไม่มี VAT (บิลเงินสด/Shopee)</option>' +
            '<option value="INCL"' + (sp.vatMode === 'INCL' ? ' selected' : '') + '>รวม VAT 7% แล้ว</option>' +
            '<option value="EXCL"' + (sp.vatMode === 'EXCL' ? ' selected' : '') + '>ยังไม่รวม VAT (+7%)</option>' +
          '</select></div>' +
        '</div>' +
      '</div>';
    }).join('');

    var sum = calcSummary();
    var slipSt = TLInvoiceCore.parseFixed(state.slipCompareTotal, 2);
    var compareMsg = '';
    if (slipSt > 0) {
      var diff = slipSt - sum.sumSt;
      compareMsg = diff === 0
        ? '<div class="ok-box">✓ ยอดรวมทุกรายการตรงกับยอดสลิป (' + TLUtils.money(sum.sumSt) + ' บาท)</div>'
        : '<div class="warn-box">⚠️ ยอดรวม (' + TLUtils.money(sum.sumSt) + ') ต่างจากยอดสลิป (' + TLUtils.money(slipSt) + ') อยู่ ' + TLUtils.money(Math.abs(diff)) + ' บาท</div>';
    }

    container.innerHTML = draftBanner +
      '<div class="card">' +
        '<h2>💸 บันทึกรายจ่าย' + (state.splits.length > 1 ? ' <span class="badge ok">แตกยอด ' + state.splits.length + ' รายการ</span>' : '') + '</h2>' +
        '<div class="grid2">' +
          '<div><label class="f">วันที่ในบิล (ย้อนหลังได้)</label><input type="date" id="exp-date" value="' + esc(state.billDate) + '"></div>' +
          '<div><label class="f">ผู้รับเงิน / การจ่าย</label><select id="exp-payee-mode">' +
            '<option value="SELF"' + (state.payeeMode === 'SELF' ? ' selected' : '') + '>ฉันสำรองจ่าย (รอหัวหน้าโอนคืน)</option>' +
            '<option value="VENDOR"' + (state.payeeMode === 'VENDOR' ? ' selected' : '') + '>โอนให้ร้านค้าโดยตรง (รอโอน)</option>' +
            '<option value="OWNER_PAID"' + (state.payeeMode === 'OWNER_PAID' ? ' selected' : '') + '>หัวหน้าจ่ายแล้ว / เงินสดร้าน</option>' +
          '</select></div>' +
        '</div>' +
        (state.payeeMode !== 'SELF'
          ? '<label class="f">ชื่อร้านค้า / ผู้รับเงิน</label><input type="text" id="exp-payee-name" value="' + esc(state.payeeName) + '" placeholder="เช่น ร้านวัสดุ / Shopee">'
          : '') +

        '<label class="f">📸 รูปบิล / รูปแคปหน้าจอคำสั่งซื้อ (Shopee/Lazada) — แนบได้หลายรูป</label>' +
        '<input type="file" id="exp-bill-files" accept="image/*" multiple>' +
        '<div class="thumbs" id="exp-bill-thumbs">' +
          state.billImages.map(function (src, i) {
            return '<div class="thumb-item"><img src="' + src + '"><button type="button" class="thumb-del" data-del-bill="' + i + '">✕</button></div>';
          }).join('') +
        '</div>' +

        '<label class="f">🧾 รูปสลิปโอนเงิน (ถ้ามี 1 สลิปรวม)</label>' +
        '<input type="file" id="exp-slip-file" accept="image/*">' +
        (state.slipImage
          ? '<div class="thumbs"><div class="thumb-item"><img src="' + state.slipImage + '"><button type="button" class="thumb-del" id="del-slip">✕</button></div></div>'
          : '') +

        '<div style="margin-top:14px">' +
          '<h3>📋 รายการค่าใช้จ่าย</h3>' +
          '<p class="hint">1 บิล/คำสั่งซื้อ สามารถแตกยอดหลายหมวดหมู่โดยใช้รูปหลักฐานและสลิปชุดเดียวกันได้</p>' +
          '<div id="exp-splits">' + splitHtml + '</div>' +
          '<button type="button" class="btn outline full" id="btn-add-split">+ แตกยอดเพิ่ม (1 สลิปหลายรายการ)</button>' +
        '</div>' +

        '<label class="f">ยอดรวมตามสลิป (ไม่บังคับ — ใช้เทียบยอดแตก)</label>' +
        '<input type="number" step="0.01" inputmode="decimal" id="exp-slip-compare" value="' + esc(state.slipCompareTotal) + '" placeholder="ใส่ยอดโอนในสลิปเพื่อเช็กตรง">' +
        '<div id="exp-summary-box" style="margin-top:10px">' +
          '<div class="ok-box">รวมทั้งหมด: <b>' + TLUtils.money(sum.sumSt) + '</b> บาท · VAT ซื้อ: <b>' + TLUtils.money(sum.vatSt) + '</b> บาท</div>' +
          compareMsg +
        '</div>' +

        '<div class="btns" style="margin-top:14px">' +
          '<button type="button" class="btn pri full" id="btn-save-expense">💾 บันทึกรายจ่าย</button>' +
        '</div>' +
      '</div>';

    bindEvents();
  }

  function updateSummaryOnly() {
    var sum = calcSummary();
    var slipSt = TLInvoiceCore.parseFixed(state.slipCompareTotal, 2);
    var compareMsg = '';
    if (slipSt > 0) {
      var diff = slipSt - sum.sumSt;
      compareMsg = diff === 0
        ? '<div class="ok-box">✓ ยอดรวมทุกรายการตรงกับยอดสลิป (' + TLUtils.money(sum.sumSt) + ' บาท)</div>'
        : '<div class="warn-box">⚠️ ยอดรวม (' + TLUtils.money(sum.sumSt) + ') ต่างจากยอดสลิป (' + TLUtils.money(slipSt) + ') อยู่ ' + TLUtils.money(Math.abs(diff)) + ' บาท</div>';
    }
    var box = document.getElementById('exp-summary-box');
    if (box) {
      box.innerHTML = '<div class="ok-box">รวมทั้งหมด: <b>' + TLUtils.money(sum.sumSt) + '</b> บาท · VAT ซื้อ: <b>' + TLUtils.money(sum.vatSt) + '</b> บาท</div>' + compareMsg;
    }
  }

  function bindEvents() {
    container.querySelectorAll('[data-pick-draft]').forEach(function (b) {
      b.onclick = function () {
        var did = b.dataset.pickDraft;
        var m = drafts.find(function (d) { return d.txnId === did; });
        state.draftTxnId = did;
        state.existingBillImageId = m ? (m.billImageIds || []).join(',') : '';
        if (m && m.billDate) state.billDate = m.billDate;
        render();
      };
    });
    var clrDraft = document.getElementById('btn-clear-draft');
    if (clrDraft) clrDraft.onclick = function () { state.draftTxnId = ''; state.existingBillImageId = ''; render(); };
    container.querySelectorAll('[data-view-img]').forEach(function (b) {
      b.onclick = function () { TLApi.viewPrivateImage(b.dataset.viewImg, 'รูปร่างจากแชต'); };
    });

    document.getElementById('exp-date').onchange = function () { state.billDate = this.value; };
    document.getElementById('exp-payee-mode').onchange = function () { state.payeeMode = this.value; render(); };
    var pNameEl = document.getElementById('exp-payee-name');
    if (pNameEl) pNameEl.oninput = function () { state.payeeName = this.value; };

    document.getElementById('exp-bill-files').onchange = async function (e) {
      var files = Array.from(e.target.files || []);
      if (!files.length) return;
      TLUtils.showToast('กำลังย่อรูป...');
      for (var i = 0; i < files.length; i++) {
        try {
          var b64 = await TLUtils.compressImage(files[i], 1600, 0.75);
          state.billImages.push(b64);
        } catch (err) { TLUtils.showToast(err.message, 'err'); }
      }
      render();
    };
    container.querySelectorAll('[data-del-bill]').forEach(function (b) {
      b.onclick = function () { state.billImages.splice(Number(b.dataset.delBill), 1); render(); };
    });

    document.getElementById('exp-slip-file').onchange = async function (e) {
      var f = e.target.files && e.target.files[0];
      if (!f) return;
      TLUtils.showToast('กำลังย่อรูปสลิป...');
      state.slipImage = await TLUtils.compressImage(f, 1600, 0.75);
      render();
    };
    var delSlip = document.getElementById('del-slip');
    if (delSlip) delSlip.onclick = function () { state.slipImage = ''; render(); };

    container.querySelectorAll('.split-card').forEach(function (card) {
      var idx = Number(card.dataset.sp);
      card.querySelectorAll('[data-sf]').forEach(function (inp) {
        var handler = function () {
          state.splits[idx][inp.dataset.sf] = inp.value;
          updateSummaryOnly();
        };
        inp.oninput = handler;
        inp.onchange = handler;
      });
    });
    container.querySelectorAll('[data-del-sp]').forEach(function (b) {
      b.onclick = function () { state.splits.splice(Number(b.dataset.delSp), 1); render(); };
    });

    document.getElementById('btn-add-split').onclick = function () {
      state.splits.push({ category: cats[0].category, description: '', amount: '', vatMode: 'NONE' });
      render();
    };
    document.getElementById('exp-slip-compare').oninput = function () {
      state.slipCompareTotal = this.value;
      updateSummaryOnly();
    };

    document.getElementById('btn-save-expense').onclick = async function () {
      var btn = this;
      var payloadSplits = state.splits.map(function (sp) {
        var amtSt = TLInvoiceCore.parseFixed(sp.amount, 2);
        var finalAmt = amtSt;
        var vatSt = 0;
        if (sp.vatMode === 'INCL') {
          vatSt = TLInvoiceCore.roundDiv(amtSt * 700, 10700);
        } else if (sp.vatMode === 'EXCL') {
          vatSt = TLInvoiceCore.roundDiv(amtSt * 700, 10000);
          finalAmt = amtSt + vatSt;
        }
        return {
          category: sp.category,
          description: sp.description,
          amount: (finalAmt / 100).toFixed(2),
          vatAmount: (vatSt / 100).toFixed(2)
        };
      });

      btn.disabled = true;
      btn.textContent = 'กำลังบันทึก...';
      try {
        var res = await TLApi.call('createTransaction', {
          type: 'จ่าย',
          billDate: state.billDate,
          payeeMode: state.payeeMode,
          payeeName: state.payeeName,
          billImages: state.billImages,
          slipImage: state.slipImage,
          existingBillImageId: state.existingBillImageId,
          draftTxnId: state.draftTxnId,
          splits: payloadSplits
        });
        TLUtils.showToast('บันทึกรายจ่ายสำเร็จ (' + res.txnIds.length + ' รายการ)', 'ok');
        state.draftTxnId = '';
        state.existingBillImageId = '';
        state.billImages = [];
        state.slipImage = '';
        state.slipCompareTotal = '';
        state.splits = [{ category: cats[0].category, description: '', amount: '', vatMode: 'NONE' }];
        var dr2 = await TLApi.call('getDrafts', {});
        drafts = dr2.drafts || [];
        render();
      } catch (e) {
        TLUtils.showToast(e.message, 'err');
        btn.disabled = false;
        btn.textContent = '💾 บันทึกรายจ่าย';
      }
    };
  }

  render();
};
