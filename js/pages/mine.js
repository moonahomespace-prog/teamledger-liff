// TeamLedger v3.1 — รายการของฉัน (STAFF เห็นเฉพาะของตนเอง / OWNER เห็นทั้งหมด) + ยกเลิกพร้อมเหตุผล
window.TLPages = window.TLPages || {};

window.TLPages.mine = async function (container) {
  var esc = TLUtils.esc;
  var month = TLUtils.currentMonthKey();
  var typeFilter = '';
  var list = [];

  async function loadData() {
    container.innerHTML = '<div class="card center-box"><div class="spinner"></div><p>กำลังโหลดรายการ...</p></div>';
    try {
      var res = await TLApi.call('getTransactions', { month: month, type: typeFilter, limit: 150 });
      list = res.transactions || [];
      render();
    } catch (e) {
      container.innerHTML = '<div class="card"><div class="warn-box">' + esc(e.message) + '</div></div>';
    }
  }

  function render() {
    var rowsHtml = list.length
      ? list.map(function (t) {
          var isCancel = t.status === 'ยกเลิก';
          var badgeCls = isCancel ? 'danger' : (t.status === 'รอโอน' ? 'warn' : (t.status === 'ร่าง' ? '' : 'ok'));
          return '<div class="list-item" style="flex-direction:column">' +
            '<div style="width:100%;display:flex;justify-content:space-between;align-items:flex-start">' +
              '<div>' +
                '<b>' + esc(t.description) + '</b> ' +
                '<span class="badge ' + badgeCls + '">' + esc(t.status) + '</span>' +
                (t.splitGroupId ? ' <span class="badge">แตกยอด</span>' : '') +
                '<div class="hint">' + esc(t.type) + ' · ' + esc(t.category) + ' · บิล ' + TLUtils.thaiDate(t.billDate) +
                  (t.paidDate ? ' · โอน ' + TLUtils.thaiDate(t.paidDate) : '') + '</div>' +
                '<div class="hint">ผู้รับเงิน: ' + esc(t.payee) + ' · ผู้บันทึก: ' + esc(t.createdBy) + '</div>' +
                (t.cancelReason ? '<div class="hint" style="color:#b42318">เหตุผลยกเลิก: ' + esc(t.cancelReason) + '</div>' : '') +
              '</div>' +
              '<div style="text-align:right;font-weight:700;color:' + (t.type === 'รับ' ? '#05a847' : '#1a1f29') + '">' +
                (t.type === 'รับ' ? '+' : '-') + TLUtils.moneyBaht(t.amount) + ' บ.' +
                (t.vatAmount > 0 ? '<div class="hint">VAT ' + TLUtils.moneyBaht(t.vatAmount) + '</div>' : '') +
              '</div>' +
            '</div>' +
            '<div class="btns" style="margin:6px 0 0">' +
              (t.billImageIds || []).map(function (fid, idx) {
                return '<button type="button" class="btn sm outline" data-img="' + esc(fid) + '">🖼️ บิล #' + (idx + 1) + '</button>';
              }).join('') +
              (t.slipImageId ? '<button type="button" class="btn sm outline" data-img="' + esc(t.slipImageId) + '">🧾 สลิป</button>' : '') +
              (!isCancel && t.status !== 'โอนแล้ว' ? '<button type="button" class="btn sm danger" data-cancel-txn="' + esc(t.txnId) + '">✕ ยกเลิก</button>' : '') +
            '</div>' +
          '</div>';
        }).join('')
      : '<p class="hint">ไม่มีรายการในเดือนที่เลือก</p>';

    container.innerHTML =
      '<div class="card">' +
        '<h2>📑 ' + (TLApi.state.user.role === 'OWNER' ? 'รายการบัญชีทั้งหมด' : 'รายการของฉัน') + '</h2>' +
        '<div class="grid2">' +
          '<div><label class="f">เดือน</label><input type="month" id="mine-month" value="' + esc(month) + '" style="min-height:44px;width:100%;border:1px solid #cbd5e1;border-radius:10px;padding:8px"></div>' +
          '<div><label class="f">ประเภท</label><select id="mine-type">' +
            '<option value="">ทั้งหมด</option>' +
            '<option value="จ่าย"' + (typeFilter === 'จ่าย' ? ' selected' : '') + '>รายจ่าย</option>' +
            '<option value="รับ"' + (typeFilter === 'รับ' ? ' selected' : '') + '>รายรับ</option>' +
          '</select></div>' +
        '</div>' +
      '</div>' +
      '<div class="card">' + rowsHtml + '</div>';

    document.getElementById('mine-month').onchange = function () { month = this.value; loadData(); };
    document.getElementById('mine-type').onchange = function () { typeFilter = this.value; loadData(); };
    container.querySelectorAll('[data-img]').forEach(function (b) {
      b.onclick = function () { TLApi.viewPrivateImage(b.dataset.img, 'รูปหลักฐาน'); };
    });
    container.querySelectorAll('[data-cancel-txn]').forEach(function (b) {
      b.onclick = async function () {
        var tid = b.dataset.cancelTxn;
        var reason = window.prompt('ระบุเหตุผลในการยกเลิกรายการ:');
        if (!reason) return;
        try {
          await TLApi.call('cancelTransaction', { txnId: tid, reason: reason });
          TLUtils.showToast('ยกเลิกรายการแล้ว', 'ok');
          loadData();
        } catch (e) { TLUtils.showToast(e.message, 'err'); }
      };
    });
  }

  loadData();
};
