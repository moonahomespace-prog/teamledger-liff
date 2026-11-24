// TeamLedger v3.1 — จัดการฐานข้อมูลลูกค้าประจำ
window.TLPages = window.TLPages || {};

window.TLPages.customers = async function (container) {
  var esc = TLUtils.esc;
  var customers = [];

  async function loadData() {
    container.innerHTML = '<div class="card center-box"><div class="spinner"></div><p>กำลังโหลดรายชื่อลูกค้า...</p></div>';
    try {
      var res = await TLApi.call('getCustomers', {});
      customers = res.customers || [];
      render();
    } catch (e) {
      container.innerHTML = '<div class="card"><div class="warn-box">' + esc(e.message) + '</div></div>';
    }
  }

  function render() {
    var listHtml = customers.length
      ? customers.map(function (c) {
          return '<div class="list-item">' +
            '<div><b>' + esc(c.name) + '</b> <span class="badge">' + esc(c.code) + '</span>' +
              '<div class="hint">' + (c.taxId ? 'เลขภาษี: ' + esc(c.taxId) + ' (' + esc(c.branch || '-') + ') · ' : '') + esc(c.phone) + '</div>' +
              '<div class="hint">' + esc(c.address) + '</div>' +
            '</div>' +
            '<button type="button" class="btn sm outline" data-edit-c="' + esc(c.code) + '">แก้ไข</button>' +
          '</div>';
        }).join('')
      : '<p class="hint">ยังไม่มีข้อมูลลูกค้าประจำ</p>';

    container.innerHTML =
      '<div class="card">' +
        '<h2>👥 ลูกค้าประจำ (' + customers.length + ' ราย)</h2>' +
        '<div class="grid2">' +
          '<div><label class="f">รหัสลูกค้า (เว้นว่าง=สร้างอัตโนมัติ)</label><input type="text" id="c-code"></div>' +
          '<div><label class="f">เบอร์โทร</label><input type="text" id="c-phone"></div>' +
        '</div>' +
        '<label class="f">ชื่อลูกค้า / บริษัท *</label><input type="text" id="c-name">' +
        '<div class="grid2">' +
          '<div><label class="f">เลขประจำตัวผู้เสียภาษี</label><input type="text" id="c-taxid"></div>' +
          '<div><label class="f">สาขา</label><input type="text" id="c-branch" value="สำนักงานใหญ่"></div>' +
        '</div>' +
        '<label class="f">ที่อยู่</label><textarea id="c-addr"></textarea>' +
        '<div class="btns" style="margin-top:10px"><button type="button" class="btn pri full" id="btn-save-cust">💾 บันทึกลูกค้า</button></div>' +
      '</div>' +
      '<div class="card">' + listHtml + '</div>';

    container.querySelectorAll('[data-edit-c]').forEach(function (b) {
      b.onclick = function () {
        var c = customers.find(function (x) { return x.code === b.dataset.editC; });
        if (!c) return;
        document.getElementById('c-code').value = c.code;
        document.getElementById('c-name').value = c.name;
        document.getElementById('c-taxid').value = c.taxId;
        document.getElementById('c-branch').value = c.branch;
        document.getElementById('c-addr').value = c.address;
        document.getElementById('c-phone').value = c.phone;
        window.scrollTo({ top: 0, behavior: 'smooth' });
      };
    });

    document.getElementById('btn-save-cust').onclick = async function () {
      var name = document.getElementById('c-name').value.trim();
      if (!name) return TLUtils.showToast('กรุณากรอกชื่อลูกค้า', 'err');
      this.disabled = true;
      try {
        await TLApi.call('saveCustomer', {
          customer: {
            code: document.getElementById('c-code').value.trim(),
            name: name,
            taxId: document.getElementById('c-taxid').value.trim(),
            branch: document.getElementById('c-branch').value.trim(),
            address: document.getElementById('c-addr').value.trim(),
            phone: document.getElementById('c-phone').value.trim()
          }
        });
        TLUtils.showToast('บันทึกข้อมูลลูกค้าแล้ว', 'ok');
        loadData();
      } catch (e) {
        TLUtils.showToast(e.message, 'err');
        this.disabled = false;
      }
    };
  }

  loadData();
};
