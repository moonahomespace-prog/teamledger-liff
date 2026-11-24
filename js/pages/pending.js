// TeamLedger v3.1 — รอโอน / รอบโอน (OWNER เท่านั้น)
window.TLPages = window.TLPages || {};

window.TLPages.pending = async function (container) {
  var esc = TLUtils.esc;
  if (TLApi.state.user.role !== 'OWNER') {
    container.innerHTML = '<div class="card center-box"><h2>🔒 เฉพาะหัวหน้า (OWNER)</h2></div>';
    return;
  }

  var data = { groups: [], batches: [] };
  var selectedIds = {};
  var payDate = TLUtils.todayISO();
  var slipImage = '';

  async function loadData() {
    container.innerHTML = '<div class="card center-box"><div class="spinner"></div><p>กำลังโหลดรายการรอโอน...</p></div>';
    try {
      data = await TLApi.call('getPendingPayments', {});
      render();
    } catch (e) {
      container.innerHTML = '<div class="card"><div class="warn-box">' + esc(e.message) + '</div></div>';
    }
  }

  function calcSelectedTotal() {
    var total = 0, count = 0;
    data.groups.forEach(function (g) {
      g.items.forEach(function (it) {
        if (selectedIds[it.txnId]) {
          total += Number(it.amount || 0);
          count++;
        }
      });
    });
    return { total: total, count: count };
  }

  function render() {
    var sel = calcSelectedTotal();
    var groupsHtml = data.groups.length
      ? data.groups.map(function (g, gIdx) {
          var rowsHtml = g.items.map(function (it) {
            var checked = !!selectedIds[it.txnId];
            return '<div class="list-item">' +
              '<label style="display:flex;gap:10px;align-items:flex-start;flex:1;cursor:pointer">' +
                '<input type="checkbox" data-chk-txn="' + esc(it.txnId) + '"' + (checked ? ' checked' : '') + ' style="width:22px;height:22px;margin-top:2px">' +
                '<div>' +
                  '<b>' + esc(it.description) + '</b>' +
                  '<div class="hint">' + esc(it.category) + ' · บิล ' + TLUtils.thaiDate(it.billDate) + ' <span class="badge ' + (it.ageDays >= 3 ? 'warn' : '') + '">ค้าง ' + it.ageDays + ' วัน</span></div>' +
                  '<div class="btns" style="margin:4px 0 0">' +
                    (it.billImageIds || []).map(function (fid, idx) {
                      return '<button type="button" class="btn sm outline" data-img="' + esc(fid) + '">🖼️ บิล #' + (idx + 1) + '</button>';
                    }).join('') +
                    (it.slipImageId ? '<button type="button" class="btn sm outline" data-img="' + esc(it.slipImageId) + '">🧾 สลิป</button>' : '') +
                  '</div>' +
                '</div>' +
              '</label>' +
              '<div style="text-align:right;font-weight:700">' + TLUtils.moneyBaht(it.amount) + ' บ.</div>' +
            '</div>';
          }).join('');

          return '<div class="card">' +
            '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">' +
              '<div><h3 style="margin:0">👤 ' + esc(g.payee) + '</h3><div class="hint">' + g.count + ' บิล · ค้างนานสุด ' + g.maxAgeDays + ' วัน</div></div>' +
              '<div style="text-align:right">' +
                '<div style="font-weight:700;color:#b54708">' + TLUtils.moneyBaht(g.total) + ' บ.</div>' +
                '<button type="button" class="btn sm outline" data-sel-group="' + gIdx + '">เลือกทั้งกลุ่ม</button>' +
              '</div>' +
            '</div>' +
            rowsHtml +
          '</div>';
        }).join('')
      : '<div class="card center-box"><h3>✅ ไม่มีบิลค้างโอน</h3></div>';

    var payoutCard = sel.count
      ? '<div class="card" style="border:2px solid var(--pri)">' +
          '<h3>💸 ยืนยันรอบโอน (' + sel.count + ' บิล)</h3>' +
          '<div class="ok-box">ยอดโอนรวม: <b>' + TLUtils.moneyBaht(sel.total) + ' บาท</b></div>' +
          '<label class="f">วันที่โอนจริง</label>' +
          '<input type="date" id="pay-date" value="' + esc(payDate) + '">' +
          '<label class="upload-zone sky" style="margin-top:10px">' +
            '<span class="uz-ico">🧾</span>' +
            '<span class="uz-title">แนบสลิปโอนเงิน (1 สลิปรอบนี้)</span>' +
            '<span class="uz-sub">' + (slipImage ? 'แนบสลิปแล้ว ✓ (แตะเพื่อเปลี่ยน)' : 'แตะเพื่ออัปโหลดสลิปธนาคาร') + '</span>' +
            '<input type="file" id="pay-slip" accept="image/*">' +
          '</label>' +
          (slipImage ? '<div class="thumbs"><div class="thumb-item"><img src="' + slipImage + '"></div></div>' : '') +
          '<div class="btns" style="margin-top:12px">' +
            '<button type="button" class="btn pri full" id="btn-confirm-batch">✅ ยืนยันโอนแล้ว & แจ้งลูกทีม</button>' +
          '</div>' +
        '</div>'
      : '';

    var batchesHtml = (data.batches || []).length
      ? '<div class="card"><h3>📜 ประวัติรอบโอนล่าสุด</h3>' +
          data.batches.map(function (b) {
            var isCancel = b.status === 'ยกเลิก';
            return '<div class="list-item">' +
              '<div><b>' + esc(b.batchId) + '</b> <span class="badge ' + (isCancel ? 'danger' : 'ok') + '">' + esc(b.status) + '</span>' +
                '<div class="hint">' + esc(b.payee) + ' · โอน ' + TLUtils.thaiDate(b.payDate) + ' · ' + b.txnIds.length + ' บิล</div>' +
                (b.cancelReason ? '<div class="hint" style="color:#b42318">เหตุผลยกเลิก: ' + esc(b.cancelReason) + '</div>' : '') +
              '</div>' +
              '<div style="text-align:right">' +
                '<div><b>' + TLUtils.moneyBaht(b.total) + ' บ.</b></div>' +
                '<div class="btns" style="justify-content:flex-end;margin:4px 0 0">' +
                  (b.slipImageId ? '<button type="button" class="btn sm outline" data-img="' + esc(b.slipImageId) + '">🧾 สลิป</button>' : '') +
                  (!isCancel ? '<button type="button" class="btn sm danger" data-cancel-batch="' + esc(b.batchId) + '">ยกเลิกรอบ</button>' : '') +
                '</div>' +
              '</div>' +
            '</div>';
          }).join('') +
        '</div>'
      : '';

    container.innerHTML = payoutCard + groupsHtml + batchesHtml;
    bindEvents();
  }

  function bindEvents() {
    container.querySelectorAll('[data-chk-txn]').forEach(function (chk) {
      chk.onchange = function () {
        if (this.checked) selectedIds[this.dataset.chkTxn] = true;
        else delete selectedIds[this.dataset.chkTxn];
        render();
      };
    });
    container.querySelectorAll('[data-sel-group]').forEach(function (b) {
      b.onclick = function () {
        var g = data.groups[Number(b.dataset.selGroup)];
        if (!g) return;
        g.items.forEach(function (it) { selectedIds[it.txnId] = true; });
        render();
      };
    });
    container.querySelectorAll('[data-img]').forEach(function (b) {
      b.onclick = function () { TLApi.viewPrivateImage(b.dataset.img, 'หลักฐาน / สลิป'); };
    });
    container.querySelectorAll('[data-cancel-batch]').forEach(function (b) {
      b.onclick = async function () {
        var bid = b.dataset.cancelBatch;
        var reason = window.prompt('ระบุเหตุผลในการยกเลิกรอบโอน ' + bid + ':');
        if (!reason) return;
        try {
          await TLApi.call('cancelPaymentBatch', { batchId: bid, reason: reason });
          TLUtils.showToast('ยกเลิกรอบโอน ' + bid + ' แล้ว (บิลกลับเป็นรอโอน)', 'ok');
          loadData();
        } catch (e) { TLUtils.showToast(e.message, 'err'); }
      };
    });

    var pd = document.getElementById('pay-date');
    if (pd) pd.onchange = function () { payDate = this.value; };
    var ps = document.getElementById('pay-slip');
    if (ps) ps.onchange = async function (e) {
      var f = e.target.files && e.target.files[0];
      if (!f) return;
      TLUtils.showToast('กำลังย่อรูปสลิป...');
      slipImage = await TLUtils.compressImage(f, 1600, 0.75);
      render();
    };
    var btnConfirm = document.getElementById('btn-confirm-batch');
    if (btnConfirm) {
      btnConfirm.onclick = async function () {
        var ids = Object.keys(selectedIds);
        if (!ids.length) return;
        this.disabled = true;
        this.textContent = 'กำลังอัปเดต...';
        try {
          var res = await TLApi.call('createPaymentBatch', {
            txnIds: ids,
            payDate: payDate,
            slipImage: slipImage
          });
          TLUtils.showToast('บันทึกรอบโอน ' + res.batchId + ' สำเร็จ!', 'ok');
          selectedIds = {};
          slipImage = '';
          loadData();
        } catch (e) {
          TLUtils.showToast(e.message, 'err');
          this.disabled = false;
          this.textContent = '✅ ยืนยันโอนแล้ว & แจ้งลูกทีม';
        }
      };
    }
  }

  loadData();
};
