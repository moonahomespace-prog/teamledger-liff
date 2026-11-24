// TeamLedger v3.1 — สรุปยอดรายเดือน + วันที่บิล/วันที่โอน + รายงานภาษี VAT + ส่งออก PDF/CSV
window.TLPages = window.TLPages || {};

window.TLPages.summary = async function (container) {
  var esc = TLUtils.esc;
  var isOwner = TLApi.state.user.role === 'OWNER';
  var month = TLUtils.currentMonthKey();
  var dateMode = 'bill'; // bill | paid
  var sumData = null;
  var vatData = null;

  async function loadData() {
    container.innerHTML = '<div class="card center-box"><div class="spinner"></div><p>กำลังคำนวณสรุปรายงาน...</p></div>';
    try {
      sumData = await TLApi.call('getSummaryReport', { month: month, dateMode: dateMode });
      if (isOwner) {
        vatData = await TLApi.call('getVatReport', { month: month });
      }
      render();
    } catch (e) {
      container.innerHTML = '<div class="card"><div class="warn-box">' + esc(e.message) + '</div></div>';
    }
  }

  function render() {
    var s = sumData;
    var catExpHtml = (s.byCategoryExpense || []).map(function (c) {
      return '<tr><td>' + esc(c.category) + '</td><td class="r">' + c.count + '</td><td class="r">' + TLUtils.moneyBaht(c.amount) + '</td></tr>';
    }).join('') || '<tr><td colspan="3" class="hint">ไม่มีรายจ่าย</td></tr>';

    var catIncHtml = (s.byCategoryIncome || []).map(function (c) {
      return '<tr><td>' + esc(c.category) + '</td><td class="r">' + c.count + '</td><td class="r">' + TLUtils.moneyBaht(c.amount) + '</td></tr>';
    }).join('') || '<tr><td colspan="3" class="hint">ไม่มีรายรับ</td></tr>';

    var ownerSection = '';
    if (isOwner && vatData) {
      var ag = s.pendingAging || {};
      var reimHtml = (s.reimbursementByPerson || []).map(function (r) {
        return '<div class="list-item"><div><b>' + esc(r.payee) + '</b> (' + r.count + ' บิล)</div><div><b>' + TLUtils.moneyBaht(r.amount) + ' บ.</b></div></div>';
      }).join('') || '<p class="hint">ไม่มียอดค้างโอน</p>';

      ownerSection =
        '<div class="card">' +
          '<h3>⏳ ค้างโอนตามอายุบิล & ยอดสำรองจ่ายรายคน</h3>' +
          '<div class="kpi-grid">' +
            '<div class="kpi"><div class="lbl">0–3 วัน</div><div class="val">' + TLUtils.moneyBaht(ag.d0_3) + '</div></div>' +
            '<div class="kpi"><div class="lbl">4–7 วัน</div><div class="val">' + TLUtils.moneyBaht(ag.d4_7) + '</div></div>' +
            '<div class="kpi"><div class="lbl">8–14 วัน</div><div class="val">' + TLUtils.moneyBaht(ag.d8_14) + '</div></div>' +
            '<div class="kpi"><div class="lbl">15+ วัน</div><div class="val" style="color:#b42318">' + TLUtils.moneyBaht(ag.d15plus) + '</div></div>' +
          '</div>' +
          reimHtml +
        '</div>' +
        '<div class="card">' +
          '<h3>🧾 รายงานภาษีมูลค่าเพิ่ม (VAT) เดือน ' + esc(month) + '</h3>' +
          '<div class="kpi-grid">' +
            '<div class="kpi"><div class="lbl">ภาษีขาย (' + vatData.outputVat.items.length + ' ใบ)</div><div class="val">' + TLUtils.moneyBaht(vatData.outputVat.totalVat) + '</div></div>' +
            '<div class="kpi"><div class="lbl">ภาษีซื้อ (' + vatData.inputVat.items.length + ' บิล)</div><div class="val">' + TLUtils.moneyBaht(vatData.inputVat.totalVat) + '</div></div>' +
          '</div>' +
          '<div class="ok-box">VAT สุทธิ (ภาษีขาย - ภาษีซื้อ): <b>' + TLUtils.moneyBaht(vatData.netVatPayable) + ' บาท</b></div>' +
          '<div class="btns">' +
            '<button type="button" class="btn pri" id="btn-dl-monthly-pdf">📄 PDF สรุปเดือน</button>' +
            '<button type="button" class="btn outline" id="btn-dl-vat-csv">📥 ส่งออก CSV ภาษี</button>' +
            '<button type="button" class="btn outline" id="btn-dl-txn-csv">📥 ส่งออก CSV รายการ</button>' +
          '</div>' +
        '</div>' +
        (s.pushStats
          ? '<div class="card"><h3>📡 โควตา LINE Push เดือน ' + esc(s.pushStats.month) + '</h3>' +
              '<p class="hint">ใช้ไปแล้ว <b>' + s.pushStats.count + ' / ' + s.pushStats.limit + '</b> ข้อความ · โหมดแจ้งเตือน: <b>' + esc(s.pushStats.notifyMode) + '</b></p>' +
            '</div>'
          : '');
    }

    container.innerHTML =
      '<div class="card">' +
        '<h2>📊 สรุปยอดบัญชี' + (isOwner ? ' (ทั้งร้าน)' : ' (เฉพาะของฉัน)') + '</h2>' +
        '<label class="f">เลือกเดือน</label>' +
        '<input type="month" id="sum-month" value="' + esc(month) + '" style="min-height:44px;width:100%;border:1px solid #cbd5e1;border-radius:10px;padding:8px;margin-bottom:10px">' +
        '<div class="seg">' +
          '<button type="button" class="' + (dateMode === 'bill' ? 'active' : '') + '" data-dmode="bill">ตามวันที่บิล (กำไรขาดทุน)</button>' +
          '<button type="button" class="' + (dateMode === 'paid' ? 'active' : '') + '" data-dmode="paid">ตามวันที่โอนจริง (เงินเข้า/ออก)</button>' +
        '</div>' +
        '<div class="kpi-grid">' +
          '<div class="kpi"><div class="lbl">รายรับรวม</div><div class="val" style="color:#05a847">' + TLUtils.moneyBaht(s.totalIncome) + '</div></div>' +
          '<div class="kpi"><div class="lbl">รายจ่ายรวม</div><div class="val" style="color:#d92d20">' + TLUtils.moneyBaht(s.totalExpense) + '</div></div>' +
        '</div>' +
        '<div class="ok-box">คงเหลือสุทธิ: <b>' + TLUtils.moneyBaht(s.netProfit) + ' บาท</b></div>' +
      '</div>' +
      '<div class="card"><h3>รายจ่ายแยกตามหมวด</h3><div class="tbl-wrap"><table class="data"><thead><tr><th>หมวด</th><th class="r">บิล</th><th class="r">รวม (บ.)</th></tr></thead><tbody>' + catExpHtml + '</tbody></table></div></div>' +
      '<div class="card"><h3>รายรับแยกตามหมวด</h3><div class="tbl-wrap"><table class="data"><thead><tr><th>หมวด</th><th class="r">บิล</th><th class="r">รวม (บ.)</th></tr></thead><tbody>' + catIncHtml + '</tbody></table></div></div>' +
      ownerSection;

    document.getElementById('sum-month').onchange = function () { month = this.value; loadData(); };
    container.querySelectorAll('[data-dmode]').forEach(function (b) {
      b.onclick = function () { dateMode = b.dataset.dmode; loadData(); };
    });

    if (isOwner) {
      var btnPdf = document.getElementById('btn-dl-monthly-pdf');
      if (btnPdf) btnPdf.onclick = async function () {
        this.disabled = true;
        TLUtils.showToast('กำลังสร้าง PDF สรุปเดือน...');
        try {
          var r = await TLApi.call('generateMonthlyReportPdf', { month: month });
          TLUtils.downloadBase64File(r.base64, r.name, 'application/pdf');
          TLUtils.showToast('สร้าง PDF สำเร็จ (เก็บใน Drive Reports/ แล้ว)', 'ok');
        } catch (e) { TLUtils.showToast(e.message, 'err'); }
        this.disabled = false;
      };
      var btnVatCsv = document.getElementById('btn-dl-vat-csv');
      if (btnVatCsv) btnVatCsv.onclick = function () {
        TLUtils.downloadCsvText(vatData.csv, 'vat_report_' + month + '.csv');
      };
      var btnTxnCsv = document.getElementById('btn-dl-txn-csv');
      if (btnTxnCsv) btnTxnCsv.onclick = async function () {
        try {
          var res = await TLApi.call('exportTransactionsCsv', { month: month });
          TLUtils.downloadCsvText(res.csv, 'transactions_' + month + '.csv');
        } catch (e) { TLUtils.showToast(e.message, 'err'); }
      };
    }
  }

  loadData();
};
