// TeamLedger v3.1 — จัดการฐานข้อมูลสินค้า 2,000+ รายการ (นำเข้า CSV/Excel + ตรวจข้อมูลซ้ำ + ค้นหาในเครื่อง)
window.TLPages = window.TLPages || {};

window.TLPages.products = async function (container) {
  var esc = TLUtils.esc;
  var isOwner = TLApi.state.user.role === 'OWNER';
  var q = '';

  await TLProductsCache.sync(false).catch(function () {});

  function render() {
    var hits = TLProductsCache.search(q, 50);
    var total = TLProductsCache.getAll().length;

    var importHtml = isOwner
      ? '<details class="card"><summary style="font-weight:700;cursor:pointer">📥 นำเข้าสินค้าจำนวนมาก (CSV / วางจาก Excel)</summary>' +
          '<p class="hint" style="margin-top:8px">รองรับทั้ง 7 คอลัมน์ (SKU, Barcode, ชื่อสินค้า, หน่วย, ราคาขาย, หมวด, ประเภทภาษี) และไฟล์ 3 คอลัมน์จากคลัง (Product code, Quantity, Product name)</p>' +
          '<input type="file" id="prod-csv-file" accept=".csv,.tsv,.txt">' +
          '<label class="f">หรือวางจาก Excel (1 บรรทัด = 1 สินค้า)</label>' +
          '<textarea id="prod-paste" placeholder="SKU,Barcode,ชื่อสินค้า,หน่วย,ราคาขาย,หมวด,VAT"></textarea>' +
          '<div class="grid2" style="margin-top:8px">' +
            '<select id="prod-import-mode"><option value="merge">อัปเดต/เพิ่มต่อจากของเดิม</option><option value="replace">แทนที่รายการทั้งหมด</option></select>' +
            '<button type="button" class="btn pri" id="btn-import-prods">🚀 นำเข้าและตรวจซ้ำ</button>' +
          '</div>' +
          '<div id="import-report"></div>' +
        '</details>' +
        '<details class="card"><summary style="font-weight:700;cursor:pointer">➕ เพิ่ม / แก้ไขสินค้าทีละรายการ</summary>' +
          '<div class="grid2" style="margin-top:8px">' +
            '<div><label class="f">รหัส SKU *</label><input type="text" id="p-sku"></div>' +
            '<div><label class="f">บาร์โค้ด</label><input type="text" id="p-bc"></div>' +
          '</div>' +
          '<label class="f">ชื่อสินค้า *</label><input type="text" id="p-name">' +
          '<div class="grid3">' +
            '<div><label class="f">หน่วย</label><input type="text" id="p-unit" value="ชิ้น"></div>' +
            '<div><label class="f">ราคาขาย (บาท)</label><input type="number" step="0.01" id="p-price"></div>' +
            '<div><label class="f">ภาษี</label><select id="p-vat"><option value="VAT">VAT</option><option value="ยกเว้น">ยกเว้น VAT</option></select></div>' +
          '</div>' +
          '<label class="f">หมวดสินค้า</label><input type="text" id="p-cat">' +
          '<div class="btns" style="margin-top:10px"><button type="button" class="btn pri full" id="btn-save-one-prod">💾 บันทึกสินค้า</button></div>' +
        '</details>'
      : '';

    container.innerHTML =
      '<div class="card">' +
        '<h2>📦 ฐานข้อมูลสินค้า (' + total.toLocaleString() + ' รายการ)</h2>' +
        '<div style="display:flex;gap:8px">' +
          '<input type="text" id="prod-q" value="' + esc(q) + '" placeholder="ค้นหา ชื่อ / SKU / บาร์โค้ด...">' +
          '<button type="button" class="btn outline" id="btn-sync-prods">🔄 ซิงค์</button>' +
        '</div>' +
        '<div class="hint">เวอร์ชันแคชในเครื่อง: ' + esc(TLProductsCache.getVersion() || '-') + ' (แสดงสูงสุด 50 รายการ)</div>' +
      '</div>' +
      importHtml +
      '<div class="card"><div class="tbl-wrap"><table class="data"><thead><tr><th>SKU / บาร์โค้ด</th><th>ชื่อสินค้า</th><th class="r">ราคา</th></tr></thead><tbody id="prod-tbody">' +
      (hits.map(function (p) {
        return '<tr data-fill-sku="' + esc(p[0]) + '">' +
          '<td><b>' + esc(p[0]) + '</b><div class="hint">' + esc(p[1]) + '</div></td>' +
          '<td>' + esc(p[2]) + '<div class="hint">' + esc(p[3]) + ' · ' + esc(p[6]) + '</div></td>' +
          '<td class="r"><b>' + TLUtils.moneyBaht(p[4]) + '</b></td>' +
        '</tr>';
      }).join('') || '<tr><td colspan="3" class="hint">ไม่พบสินค้า</td></tr>') +
      '</tbody></table></div></div>';

    document.getElementById('prod-q').oninput = function () {
      q = this.value;
      var filtered = TLProductsCache.search(q, 50);
      document.getElementById('prod-tbody').innerHTML = filtered.map(function (p) {
        return '<tr data-fill-sku="' + esc(p[0]) + '">' +
          '<td><b>' + esc(p[0]) + '</b><div class="hint">' + esc(p[1]) + '</div></td>' +
          '<td>' + esc(p[2]) + '<div class="hint">' + esc(p[3]) + ' · ' + esc(p[6]) + '</div></td>' +
          '<td class="r"><b>' + TLUtils.moneyBaht(p[4]) + '</b></td>' +
        '</tr>';
      }).join('') || '<tr><td colspan="3" class="hint">ไม่พบสินค้า</td></tr>';
    };
    document.getElementById('btn-sync-prods').onclick = async function () {
      TLUtils.showToast('กำลังซิงค์สินค้าล่าสุด...');
      await TLProductsCache.sync(true);
      TLUtils.showToast('ซิงค์สินค้าแล้ว (' + TLProductsCache.getAll().length + ' รายการ)', 'ok');
      render();
    };

    if (isOwner) {
      document.getElementById('prod-csv-file').onchange = async function (e) {
        var f = e.target.files && e.target.files[0];
        if (!f) return;
        document.getElementById('prod-paste').value = await f.text();
      };
      document.getElementById('btn-import-prods').onclick = async function () {
        var txt = document.getElementById('prod-paste').value.trim();
        if (!txt) return TLUtils.showToast('กรุณาเลือกไฟล์ CSV หรือวางข้อมูลก่อน', 'err');
        this.disabled = true;
        this.textContent = 'กำลังนำเข้า...';
        try {
          var res = await TLApi.call('importProducts', {
            csvText: txt,
            mode: document.getElementById('prod-import-mode').value
          });
          await TLProductsCache.sync(true);
          var w = res.warnings || {};
          document.getElementById('import-report').innerHTML =
            '<div class="ok-box" style="margin-top:8px">นำเข้าสำเร็จ ' + res.importedCount + ' รายการ (ทั้งหมด ' + res.totalCount + ' รายการ)<br>' +
            'SKU ซ้ำ: ' + (w.duplicateSku || []).length + ' | บาร์โค้ดซ้ำ: ' + (w.duplicateBarcode || []).length + ' | ยังไม่ระบุราคา (0 บ.): ' + (w.missingPriceCount || 0) + '</div>';
          TLUtils.showToast('นำเข้าสินค้าสำเร็จ!', 'ok');
        } catch (e) { TLUtils.showToast(e.message, 'err'); }
        this.disabled = false;
        this.textContent = '🚀 นำเข้าและตรวจซ้ำ';
      };

      document.getElementById('btn-save-one-prod').onclick = async function () {
        var sku = document.getElementById('p-sku').value.trim();
        var name = document.getElementById('p-name').value.trim();
        if (!sku || !name) return TLUtils.showToast('กรอก SKU และชื่อสินค้า', 'err');
        this.disabled = true;
        try {
          await TLApi.call('saveProduct', {
            product: {
              sku: sku,
              barcode: document.getElementById('p-bc').value.trim() || sku,
              name: name,
              unit: document.getElementById('p-unit').value.trim() || 'ชิ้น',
              price: document.getElementById('p-price').value || '0',
              category: document.getElementById('p-cat').value.trim(),
              vatType: document.getElementById('p-vat').value
            }
          });
          await TLProductsCache.sync(true);
          TLUtils.showToast('บันทึกสินค้าแล้ว', 'ok');
          render();
        } catch (e) { TLUtils.showToast(e.message, 'err'); }
        this.disabled = false;
      };
    }
  }

  render();
};
