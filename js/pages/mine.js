// TeamLedger v3.1 — รายการของฉัน / รายการทั้งหมด (โหลดไวจากแคช + ซ่อนรายการที่ยกเลิก + ปุ่มยกเลิกด่วน)
window.TLPages = window.TLPages || {};

window.TLPages.mine = async function (container) {
  var esc = TLUtils.esc;
  var month = TLUtils.currentMonthKey();
  var typeFilter = '';
  var hideCancelled = true;
  var list = [];

  async function loadData(forceSpinner) {
    var cacheKey = 'mine:' + month + ':' + typeFilter;
    var cached = TLApi.getCache(cacheKey);
    if (cached && !forceSpinner) {
      list = cached;
      render();
    } else {
      container.innerHTML = '<div class="card center-box"><div class="spinner"></div><p>กำลังโหลดรายการ...</p></div>';
    }

    try {
      var res = await TLApi.call('getTransactions', { month: month, type: typeFilter, limit: 150 });
      var fresh = res.transactions || [];
      TLApi.setCache(cacheKey, fresh);
      var changed = !cached || JSON.stringify(fresh) !== JSON.stringify(list);
      list = fresh;
      if (TLApi.state.currentPage === 'mine' && (forceSpinner || !cached || changed)) {
        render();
      }
    } catch (e) {
      if (!cached) {
        container.innerHTML = '<div class="card"><div class="warn-box">' + esc(e.message) + '</div></div>';
      }
    }
  }

  function render() {
    var visibleList = hideCancelled ? list.filter(function (t) { return t.status !== 'ยกเลิก'; }) : list;
    var rowsHtml = visibleList.length
      ? visibleList.map(function (t) {
          var isCancel = t.status === 'ยกเลิก';
          var badgeCls = isCancel ? 'danger' : (t.status === 'รอโอน' ? 'warn' : (t.status === 'ร่าง' ? '' : 'ok'));
          var qtyBadge = (t.qty || t.unit) ? ' <span class="badge">' + esc([t.qty, t.unit].filter(Boolean).join(' ')) + '</span>' : '';
          return '<div class="list-item" style="flex-direction:column">' +
            '<div style="width:100%;display:flex;justify-content:space-between;align-items:flex-start">' +
              '<div>' +
                '<b>' + esc(t.description) + '</b>' + qtyBadge + ' ' +
                '<span class="badge ' + badgeCls + '">' + esc(t.status) + '</span>' +
                (t.splitGroupId ? ' <span class="badge">แตกยอด</span>' : '') +
                '<div class="hint">' + esc(t.type) + ' · ' + esc(t.category) + ' · บิล ' + TLUtils.thaiDate(t.billDate) +
                  (t.paidDate ? ' · โอน ' + TLUtils.thaiDate(t.paidDate) : '') + '</div>' +
                '<div class="hint">ผู้รับเงิน: ' + esc(t.payee) + ' · ผู้บันทึก: ' + esc(t.createdBy) + '</div>' +
                (t.cancelReason ? '<div class="hint" style="color:#b42318">เหตุผลยกเลิก: ' + esc(t.cancelReason) + '</div>' : '') +
              '</div>' +
              '<div style="text-align:right;font-weight:700;color:' + (t.type === 'รับ' ? 'var(--sky-dark)' : 'var(--text)') + '">' +
                (t.type === 'รับ' ? '+' : '-') + TLUtils.moneyBaht(t.amount) + ' บ.' +
                (t.vatAmount > 0 ? '<div class="hint">VAT ' + TLUtils.moneyBaht(t.vatAmount) + '</div>' : '') +
              '</div>' +
            '</div>' +
            '<div class="btns" style="margin:6px 0 0">' +
              (t.billImageIds || []).map(function (fid, idx) {
                return '<button type="button" class="btn sm outline" data-img="' + esc(fid) + '">🖼️ บิล #' + (idx + 1) + '</button>';
              }).join('') +
              (t.slipImageId ? '<button type="button" class="btn sm outline" data-img="' + esc(t.slipImageId) + '">🧾 สลิป</button>' : '') +
              (!isCancel && t.status !== 'โอนแล้ว' ? '<button type="button" class="btn sm outline" data-edit-txn="' + esc(t.txnId) + '">✏️ แก้ไข</button>' : '') +
              (t.type === 'จ่าย' ? '<button type="button" class="btn sm outline" data-dup-txn="' + esc(t.txnId) + '">⧉ ทำซ้ำ</button>' : '') +
              (!isCancel && t.status !== 'โอนแล้ว' ? '<button type="button" class="btn sm danger" data-cancel-txn="' + esc(t.txnId) + '">✕ ยกเลิก</button>' : '') +
            '</div>' +
          '</div>';
        }).join('')
      : '<p class="hint">ไม่มีรายการในเดือนที่เลือก</p>';

    container.innerHTML =
      '<div class="card">' +
        '<h2>📑 ' + (TLApi.state.user.role === 'OWNER' ? 'รายการบัญชีทั้งหมด' : 'รายการของฉัน') + '</h2>' +
        '<div class="grid2">' +
          '<div><label class="f">เดือน</label><input type="month" id="mine-month" value="' + esc(month) + '" style="min-height:44px;width:100%;border:1px solid var(--border);border-radius:12px;padding:8px"></div>' +
          '<div><label class="f">ประเภท</label><select id="mine-type">' +
            '<option value="">ทั้งหมด</option>' +
            '<option value="จ่าย"' + (typeFilter === 'จ่าย' ? ' selected' : '') + '>รายจ่าย</option>' +
            '<option value="รับ"' + (typeFilter === 'รับ' ? ' selected' : '') + '>รายรับ</option>' +
          '</select></div>' +
        '</div>' +
        '<label style="display:flex;align-items:center;gap:8px;margin-top:10px;font-size:14px;cursor:pointer">' +
          '<input type="checkbox" id="mine-hide-cancel"' + (hideCancelled ? ' checked' : '') + ' style="width:18px;height:18px"> ซ่อนรายการที่ยกเลิกแล้ว (' + list.filter(function (t) { return t.status === 'ยกเลิก'; }).length + ')' +
        '</label>' +
      '</div>' +
      '<div class="card">' + rowsHtml + '</div>';

    document.getElementById('mine-month').onchange = function () { month = this.value; loadData(false); };
    document.getElementById('mine-type').onchange = function () { typeFilter = this.value; loadData(false); };
    document.getElementById('mine-hide-cancel').onchange = function () { hideCancelled = this.checked; render(); };
    container.querySelectorAll('[data-img]').forEach(function (b) {
      b.onclick = function () { TLApi.viewPrivateImage(b.dataset.img, 'รูปหลักฐาน'); };
    });
    container.querySelectorAll('[data-edit-txn]').forEach(function (b) {
      b.onclick = function () {
        var tid = b.dataset.editTxn;
        var found = visibleList.find(function (x) { return x.txnId === tid; });
        if (found) TLUtils.openEditTxnModal(found, function () { loadData(true); });
      };
    });
    container.querySelectorAll('[data-dup-txn]').forEach(function (b) {
      b.onclick = function () {
        var tid = b.dataset.dupTxn;
        var found = visibleList.find(function (x) { return x.txnId === tid; });
        if (!found) return;
        var groupItems = found.splitGroupId
          ? visibleList.filter(function (x) { return x.splitGroupId === found.splitGroupId && x.status !== 'ยกเลิก'; })
          : [found];
        if (!groupItems.length) groupItems = [found];
        var payeeMode = found.status === 'จ่ายแล้ว' ? 'OWNER_PAID' : (found.payee && found.payee === String(found.createdBy || '').split(' (')[0] ? 'SELF' : 'VENDOR');
        var prefill = {
          payeeMode: payeeMode,
          payeeName: payeeMode === 'SELF' ? '' : (found.payee || ''),
          splits: groupItems.map(function (it) {
            return {
              category: it.category || '',
              description: it.description || '',
              qty: it.qty || '1',
              unit: it.unit || '',
              amount: Number(it.amount || 0).toFixed(2),
              vatMode: it.vatAmount > 0 ? 'INCL' : 'NONE'
            };
          })
        };
        if (window.TLNavigate) window.TLNavigate('expense', { prefill: prefill });
      };
    });
    container.querySelectorAll('[data-cancel-txn]').forEach(function (b) {
      b.onclick = async function () {
        var tid = b.dataset.cancelTxn;
        var reason = await TLUtils.promptCancelReason('ยกเลิกรายการ ' + tid);
        if (!reason) return;
        try {
          await TLApi.call('cancelTransaction', { txnId: tid, reason: reason });
          TLUtils.showToast('ยกเลิกรายการแล้ว', 'ok');
          loadData(true);
        } catch (e) { TLUtils.showToast(e.message, 'err'); }
      };
    });
  }

  loadData(false);
};
