// TeamLedger v3.1 — บันทึกรายจ่ายมินิมอล (ฉันจ่าย / รอจ่าย / จ่ายแล้ว, Filter หมวดหมู่, สินค้า/จำนวน/หน่วย, แตกยอด 1 สลิป)
window.TLPages = window.TLPages || {};

window.TLPages.expense = async function (container, params) {
  var esc = TLUtils.esc;
  var draftId = (params && params.draftId) || '';
  var cats = TLApi.state.categories.filter(function (c) { return c.type === 'จ่าย'; });
  if (!cats.length) cats = [
    { category: 'วัตถุดิบ / สินค้าเพื่อขาย' },
    { category: 'ค่าขนส่ง / พัสดุ' },
    { category: 'วัสดุอุปกรณ์ / แพ็กเกจจิ้ง' },
    { category: 'ค่าใช้จ่ายเบ็ดเตล็ด' }
  ];

  var PAYEE_MODES = {
    SELF: {
      label: 'ฉันจ่าย',
      desc: 'ฉันสำรองจ่ายไปก่อน เจ้านายต้องจ่ายคืน (เข้าหน้ารอโอน)',
      cls: ''
    },
    VENDOR: {
      label: 'รอจ่าย',
      desc: 'รอเจ้านายโอนให้ร้านค้าและอัปสลิป (เข้าหน้ารอโอน)',
      cls: ''
    },
    OWNER_PAID: {
      label: 'จ่ายแล้ว',
      desc: 'เบิกเงินจ่ายแล้ว รายการนี้สำเร็จเลยไม่ต้องรอเจ้านายโอน',
      cls: 'sky'
    }
  };

  var prefill = (params && params.prefill) || null;
  var state = {
    draftTxnId: draftId,
    existingBillImageId: '',
    billImages: [],
    slipImage: '',
    slipScanInfo: null,
    billDate: (prefill && prefill.billDate) || TLUtils.todayISO(),
    payeeMode: (prefill && prefill.payeeMode) || 'SELF',
    payeeName: (prefill && prefill.payeeName) || '',
    slipCompareTotal: (prefill && prefill.slipCompareTotal) || '',
    splits: (prefill && Array.isArray(prefill.splits) && prefill.splits.length)
      ? prefill.splits.map(function (sp) {
          return {
            category: sp.category || cats[0].category,
            description: sp.description || '',
            qty: sp.qty || '1',
            unit: sp.unit || '',
            amount: sp.amount || '',
            vatMode: sp.vatMode || 'NONE'
          };
        })
      : [{ category: cats[0].category, description: '', qty: '1', unit: '', amount: '', vatMode: 'NONE' }]
  };
  if (prefill) {
    setTimeout(function () { TLUtils.showToast('คัดลอกข้อมูลเดิมมาแล้ว — ตรวจยอดและแนบรูปใหม่ได้เลย', 'ok'); }, 60);
  }

  var drafts = [];

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

  function buildDraftBannerHtml() {
    if (!drafts.length) return '';
    return '<div class="card">' +
      '<h3>📷 ร่างจากรูปที่ส่งในแชต (' + drafts.length + ')</h3>' +
      '<div class="btns">' +
        drafts.map(function (d) {
          var active = state.draftTxnId === d.txnId;
          return '<button type="button" class="btn sm ' + (active ? 'pri' : 'outline') + '" data-pick-draft="' + esc(d.txnId) + '">' +
            esc(d.txnId) + ' · ' + TLUtils.thaiDate(d.billDate) + '</button>';
        }).join('') +
        (state.draftTxnId ? '<button type="button" class="btn sm" id="btn-clear-draft">ไม่ใช้ร่าง</button>' : '') +
      '</div>' +
      (state.existingBillImageId
        ? '<div class="btns">' + state.existingBillImageId.split(',').filter(Boolean).map(function (fid, idx) {
            return '<button type="button" class="btn sm outline" data-view-img="' + esc(fid) + '">🖼️ ดูรูปร่าง #' + (idx + 1) + '</button>';
          }).join('') + '</div>'
        : '') +
    '</div>';
  }

  function render() {
    var isSplit = state.splits.length > 1;
    var pmInfo = PAYEE_MODES[state.payeeMode] || PAYEE_MODES.SELF;

    var splitHtml = state.splits.map(function (sp, idx) {
      var catChoices = cats.map(function (c) { return c.category; });
      if (sp.category && catChoices.indexOf(sp.category) === -1) catChoices.unshift(sp.category);
      var catOpts = catChoices.map(function (cname) {
        return '<option value="' + esc(cname) + '"' + (cname === sp.category ? ' selected' : '') + '>' + esc(cname) + '</option>';
      }).join('');
      return '<div class="split-card" data-sp="' + idx + '">' +
        (isSplit
          ? '<div class="split-head"><strong>รายการที่ ' + (idx + 1) + '</strong>' +
              '<button type="button" class="btn sm danger" data-del-sp="' + idx + '">ลบ</button></div>'
          : '') +
        '<label class="f">ชื่อสินค้า / รายการ</label>' +
        '<input type="text" data-sf="description" value="' + esc(sp.description) + '" placeholder="เช่น กล่องพัสดุ / ผ้าคอตตอน / ค่าส่ง">' +
        '<div class="grid2">' +
          '<div><label class="f">จำนวน</label><input type="number" step="any" inputmode="decimal" data-sf="qty" value="' + esc(sp.qty) + '" placeholder="1"></div>' +
          '<div><label class="f">หน่วย (เลือกหรือพิมพ์)</label><input type="text" list="tl-unit-list" data-sf="unit" value="' + esc(sp.unit) + '" placeholder="ชิ้น / แพ็ก / กล่อง"></div>' +
        '</div>' +
        '<label class="f">หมวดหมู่</label>' +
        '<select data-sf="category">' + catOpts + '</select>' +
        '<label class="f">' + (isSplit ? 'ยอดเงินรวมรายการนี้ (บาท)' : 'ยอดเงินรวมทั้งหมด (บาท)') + '</label>' +
        '<input type="number" step="0.01" inputmode="decimal" class="' + (isSplit ? '' : 'amount-hero') + '" data-sf="amount" value="' + esc(sp.amount) + '" placeholder="0.00">' +
        '<details class="opt-box" style="margin:8px 0 0">' +
          '<summary>ภาษีซื้อ (VAT): ' + (sp.vatMode === 'INCL' ? 'รวม VAT 7%' : (sp.vatMode === 'EXCL' ? 'ยังไม่รวม VAT (+7%)' : 'ไม่มี VAT')) + '</summary>' +
          '<select data-sf="vatMode" style="margin-top:6px">' +
            '<option value="NONE"' + (sp.vatMode === 'NONE' ? ' selected' : '') + '>ไม่มี VAT</option>' +
            '<option value="INCL"' + (sp.vatMode === 'INCL' ? ' selected' : '') + '>รวม VAT 7%</option>' +
            '<option value="EXCL"' + (sp.vatMode === 'EXCL' ? ' selected' : '') + '>ยังไม่รวม VAT</option>' +
          '</select>' +
        '</details>' +
      '</div>';
    }).join('');

    var scanBanner = '';
    if (state.slipScanInfo) {
      var sc = state.slipScanInfo;
      if (sc.statusText) {
        scanBanner = '<div class="hint" id="exp-scan-progress" style="margin:6px 0">' + esc(sc.statusText) + '</div>';
      } else if (sc.amount || sc.bankName || sc.billDate) {
        scanBanner = '<div class="ok-box" style="margin:8px 0">' +
          (sc.amount ? '✨ อ่านยอดเงินได้ประมาณ <b>' + esc(sc.amount) + '</b> บ. ' : '') +
          (sc.bankName ? '· ' + esc(sc.bankName) + ' ' : '') +
          (sc.billDate ? '· วันที่ ' + TLUtils.thaiDate(sc.billDate) + ' ' : '') +
          '<div class="btns" style="margin:6px 0 0">' +
            (sc.amount ? '<button type="button" class="btn sm sky" id="btn-exp-use-amt">ใช้ยอด ' + esc(sc.amount) + '</button>' : '') +
            (sc.billDate ? '<button type="button" class="btn sm outline" id="btn-exp-use-date">ใช้วันที่นี้</button>' : '') +
          '</div>' +
          '<div class="hint">(ระบบฟรี 0 บ. — โปรดตรวจความถูกต้องก่อนบันทึก)</div>' +
        '</div>';
      } else if (sc.checked) {
        scanBanner = '<div class="warn-box" style="margin:8px 0">ไม่พบตัวเลขชัดเจนจากภาพ กรุณากรอกยอดเงินด้วยตัวเอง</div>';
      }
    }

    var sum = calcSummary();
    var slipSt = TLInvoiceCore.parseFixed(state.slipCompareTotal, 2);
    var compareMsg = '';
    if (slipSt > 0) {
      var diff = slipSt - sum.sumSt;
      compareMsg = diff === 0
        ? '<div class="ok-box">✓ ยอดรวมตรงกับสลิป (' + TLUtils.money(sum.sumSt) + ' บ.)</div>'
        : '<div class="warn-box">⚠️ ยอดรวม (' + TLUtils.money(sum.sumSt) + ') ต่างจากสลิป (' + TLUtils.money(slipSt) + ') อยู่ ' + TLUtils.money(Math.abs(diff)) + ' บ.</div>';
    }

    container.innerHTML =
      '<div id="exp-drafts-slot">' + buildDraftBannerHtml() + '</div>' +
      '<div class="card">' +
        '<h2>🌸 บันทึกรายจ่าย' + (isSplit ? ' <span class="badge ok">แตกยอด ' + state.splits.length + ' รายการ</span>' : '') + '</h2>' +

        '<label class="f">สถานะการจ่าย</label>' +
        '<div class="seg" id="exp-payee-seg">' +
          Object.keys(PAYEE_MODES).map(function (k) {
            return '<button type="button" class="' + (state.payeeMode === k ? 'active' : '') + '" data-pmode="' + k + '">' + esc(PAYEE_MODES[k].label) + '</button>';
          }).join('') +
        '</div>' +
        '<div class="payee-hint ' + pmInfo.cls + '">' + esc(pmInfo.desc) + '</div>' +
        (state.payeeMode !== 'SELF'
          ? '<input type="text" id="exp-payee-name" value="' + esc(state.payeeName) + '" placeholder="ชื่อร้านค้า / ผู้รับเงิน (เช่น Shopee / ร้านวัสดุ)" style="margin-bottom:8px">'
          : '') +

        '<div id="exp-splits">' + splitHtml + '</div>' +
        TLUtils.buildUnitDatalistHtml('tl-unit-list') +
        '<button type="button" class="btn outline full" id="btn-add-split" style="margin-bottom:10px">+ แตกยอดเพิ่ม (1 สลิปหลายรายการ)</button>' +

        '<div class="grid2">' +
          '<div>' +
            '<label class="upload-zone">' +
              '<span class="uz-ico">🧾</span>' +
              '<span class="uz-title">แนบรูปบิล / แคปจอ</span>' +
              '<span class="uz-sub">' + (state.billImages.length ? 'เลือกแล้ว ' + state.billImages.length + ' รูป (แตะเพิ่มได้)' : 'ถ่ายรูป หรือเลือกรูปหลายใบ') + '</span>' +
              '<input type="file" id="exp-bill-files" accept="image/*" multiple>' +
            '</label>' +
          '</div>' +
          '<div>' +
            '<label class="upload-zone sky">' +
              '<span class="uz-ico">💸</span>' +
              '<span class="uz-title">แนบสลิปโอนเงิน</span>' +
              '<span class="uz-sub">' + (state.slipImage ? 'แนบสลิปแล้ว ✓ (แตะเปลี่ยน)' : 'อัปโหลด 1 สลิป (ถ้ามี)') + '</span>' +
              '<input type="file" id="exp-slip-file" accept="image/*">' +
            '</label>' +
          '</div>' +
        '</div>' +

        (state.billImages.length || state.slipImage
          ? '<div class="thumbs">' +
              state.billImages.map(function (src, i) {
                return '<div class="thumb-item"><img src="' + src + '"><button type="button" class="thumb-del" data-del-bill="' + i + '">✕</button></div>';
              }).join('') +
              (state.slipImage ? '<div class="thumb-item" style="border-color:var(--sky)"><img src="' + state.slipImage + '"><button type="button" class="thumb-del" id="del-slip">✕</button></div>' : '') +
            '</div>' +
            '<div class="btns" style="margin-top:6px"><button type="button" class="btn sm sky full" id="btn-exp-scan-slip">🔍 อ่านยอดเงินจากสลิป / บิล (ฟรี)</button></div>'
          : '') +
        scanBanner +

        '<details class="opt-box"' + (isSplit || state.slipCompareTotal ? ' open' : '') + '>' +
          '<summary>⚙️ วันที่บิลย้อนหลัง & เทียบยอดสลิป (' + TLUtils.thaiDate(state.billDate) + ')</summary>' +
          '<label class="f">วันที่ในบิล</label>' +
          '<input type="date" id="exp-date" value="' + esc(state.billDate) + '">' +
          '<label class="f">ยอดรวมตามสลิป (ใช้เช็กตรงตอนแตกยอด)</label>' +
          '<input type="number" step="0.01" inputmode="decimal" id="exp-slip-compare" value="' + esc(state.slipCompareTotal) + '" placeholder="เช่น 1000.00">' +
        '</details>' +

        '<div id="exp-summary-box">' +
          (sum.sumSt > 0 ? '<div class="ok-box">รวมทั้งหมด <b>' + TLUtils.money(sum.sumSt) + '</b> บาท' + (sum.vatSt > 0 ? ' · VAT ซื้อ ' + TLUtils.money(sum.vatSt) + ' บ.' : '') + '</div>' : '') +
          compareMsg +
        '</div>' +

        '<div class="btns" style="margin-top:12px">' +
          '<button type="button" class="btn pri full" id="btn-save-expense">✨ บันทึกรายจ่าย</button>' +
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
        ? '<div class="ok-box">✓ ยอดรวมตรงกับสลิป (' + TLUtils.money(sum.sumSt) + ' บ.)</div>'
        : '<div class="warn-box">⚠️ ยอดรวม (' + TLUtils.money(sum.sumSt) + ') ต่างจากสลิป (' + TLUtils.money(slipSt) + ') อยู่ ' + TLUtils.money(Math.abs(diff)) + ' บ.</div>';
    }
    var box = document.getElementById('exp-summary-box');
    if (box) {
      box.innerHTML = (sum.sumSt > 0 ? '<div class="ok-box">รวมทั้งหมด <b>' + TLUtils.money(sum.sumSt) + '</b> บาท' + (sum.vatSt > 0 ? ' · VAT ซื้อ ' + TLUtils.money(sum.vatSt) + ' บ.' : '') + '</div>' : '') + compareMsg;
    }
  }

  function bindDraftEvents() {
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
  }

  function bindEvents() {
    bindDraftEvents();

    document.getElementById('exp-date').onchange = function () { state.billDate = this.value; };
    container.querySelectorAll('[data-pmode]').forEach(function (b) {
      b.onclick = function () { state.payeeMode = b.dataset.pmode; render(); };
    });
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
      state.slipScanInfo = null;
      if (window.TLSlipReader) {
        try {
          var qr = await TLSlipReader.readSlip(state.slipImage, { runOcr: false });
          if (qr.amount || qr.bankName) {
            state.slipScanInfo = qr;
            if (qr.amount) {
              if (state.splits.length === 1 && !state.splits[0].amount) state.splits[0].amount = qr.amount;
              if (!state.slipCompareTotal) state.slipCompareTotal = qr.amount;
            }
          }
        } catch (err) {}
      }
      render();
    };
    var delSlip = document.getElementById('del-slip');
    if (delSlip) delSlip.onclick = function () { state.slipImage = ''; state.slipScanInfo = null; render(); };

    var scanBtn = document.getElementById('btn-exp-scan-slip');
    if (scanBtn) {
      scanBtn.onclick = async function () {
        var targetImg = state.slipImage || state.billImages[0];
        if (!window.TLSlipReader || !targetImg) return;
        state.slipScanInfo = { statusText: 'กำลังโหลดตัวอ่านสลิป...' };
        render();
        try {
          var res = await TLSlipReader.readSlip(targetImg, {
            runOcr: true,
            onProgress: function (msg) {
              var pr = document.getElementById('exp-scan-progress');
              if (pr && msg) pr.textContent = msg;
            }
          });
          state.slipScanInfo = Object.assign({ checked: true }, res);
          if (res.amount) {
            if (state.splits.length === 1 && !state.splits[0].amount) state.splits[0].amount = res.amount;
            if (!state.slipCompareTotal) state.slipCompareTotal = res.amount;
          }
        } catch (e) {
          state.slipScanInfo = { checked: true };
          TLUtils.showToast(e.message, 'err');
        }
        render();
      };
    }
    var useAmtBtn = document.getElementById('btn-exp-use-amt');
    if (useAmtBtn) {
      useAmtBtn.onclick = function () {
        var amt = state.slipScanInfo && state.slipScanInfo.amount;
        if (!amt) return;
        if (state.splits.length === 1) state.splits[0].amount = amt;
        state.slipCompareTotal = amt;
        render();
      };
    }
    var useDateBtn = document.getElementById('btn-exp-use-date');
    if (useDateBtn) {
      useDateBtn.onclick = function () {
        if (state.slipScanInfo && state.slipScanInfo.billDate) {
          state.billDate = state.slipScanInfo.billDate;
          render();
        }
      };
    }

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
      state.splits.push({ category: cats[0].category, description: '', qty: '1', unit: '', amount: '', vatMode: 'NONE' });
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
          qty: sp.qty,
          unit: sp.unit,
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
        payloadSplits.forEach(function (sp) { if (sp.unit) TLUtils.saveRecentUnit(sp.unit); });
        state.draftTxnId = '';
        state.existingBillImageId = '';
        state.billImages = [];
        state.slipImage = '';
        state.slipScanInfo = null;
        state.slipCompareTotal = '';
        state.splits = [{ category: cats[0].category, description: '', qty: '1', unit: '', amount: '', vatMode: 'NONE' }];
        render();
        TLApi.call('getDrafts', {}).then(function (dr2) {
          drafts = dr2.drafts || [];
          var slot = document.getElementById('exp-drafts-slot');
          if (slot) { slot.innerHTML = buildDraftBannerHtml(); bindDraftEvents(); }
        }).catch(function () {});
      } catch (e) {
        TLUtils.showToast(e.message, 'err');
        btn.disabled = false;
        btn.textContent = '✨ บันทึกรายจ่าย';
      }
    };
  }

  if (draftId) {
    try {
      var dr = await TLApi.call('getDrafts', {});
      drafts = dr.drafts || [];
      var matched = drafts.find(function (d) { return d.txnId === draftId; });
      if (matched) {
        state.billDate = matched.billDate || state.billDate;
        state.existingBillImageId = (matched.billImageIds || []).join(',');
      }
    } catch (e) {}
    render();
  } else {
    render();
    TLApi.call('getDrafts', {}).then(function (dr) {
      drafts = dr.drafts || [];
      if (!drafts.length) return;
      var slot = document.getElementById('exp-drafts-slot');
      if (slot) {
        slot.innerHTML = buildDraftBannerHtml();
        bindDraftEvents();
      }
    }).catch(function () {});
  }
};
