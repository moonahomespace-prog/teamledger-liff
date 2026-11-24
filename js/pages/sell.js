// TeamLedger v3.1 — ออกใบกำกับภาษี / ใบกำกับภาษีอย่างย่อ / ใบเสร็จ (อ้างอิง invoice_editor.html 100%)
window.TLPages = window.TLPages || {};

window.TLPages.sell = async function (container) {
  var esc = TLUtils.esc;
  var user = TLApi.state.user;
  if (!user.canIssueInvoice && user.role !== 'OWNER') {
    container.innerHTML = '<div class="card center-box"><h2>🔒 ยังไม่มีสิทธิ์ออกบิล</h2><p class="hint">กรุณาขอให้หัวหน้าเปิดสิทธิ์ออกบิลให้ในเมนูจัดการทีม</p></div>';
    return;
  }

  var activeTab = 'edit'; // edit | preview | history
  var invSettings = TLApi.state.invoiceSettings || TLInvoiceCore.defaults();
  var S = JSON.parse(JSON.stringify(TLInvoiceCore.defaults()));
  Object.assign(S, JSON.parse(JSON.stringify(invSettings)));
  S.labels = Object.assign({}, TLInvoiceCore.DEFAULT_LABELS, invSettings.labels || {});
  S.doc = { no: 'รอออกเลขอัตโนมัติ', date: TLUtils.todayISO(), time: '', ref: '', credit: '', sales: user.name };
  S.customer = { code: '', name: '', taxId: '', branch: '', address: '', phone: '' };
  S.items = [TLInvoiceCore.blankItem()];
  S.billDiscount = '';
  S.charges = [];
  S.remarks = '';
  S.view = Object.assign({}, TLInvoiceCore.defaults().view, invSettings.view || {});
  S.view.cancelled = false;

  var customers = [];
  var invoicesHistory = [];
  var lastIssued = null;

  await TLProductsCache.loadLocal().catch(function () {});
  setTimeout(function () {
    TLProductsCache.sync(false).then(function (r) {
      var el = document.getElementById('sell-prod-count');
      if (el) el.textContent = TLProductsCache.getAll().length.toLocaleString();
    }).catch(function () {});
    TLApi.call('getCustomers', {}).then(function (cr) {
      customers = cr.customers || [];
      var slot = document.getElementById('sell-cust-picker');
      if (slot && customers.length && !document.getElementById('pick-customer')) {
        slot.innerHTML = '<label class="f">เลือกลูกค้าประจำ</label><select id="pick-customer"><option value="">— พิมพ์เอง / ลูกค้าใหม่ —</option>' +
          customers.map(function (cu) { return '<option value="' + esc(cu.code) + '">' + esc(cu.name) + ' (' + esc(cu.code) + ')</option>'; }).join('') +
          '</select>';
        var sel = document.getElementById('pick-customer');
        if (sel) sel.onchange = function () {
          var cu = customers.find(function (x) { return x.code === sel.value; });
          if (cu) {
            S.customer = { code: cu.code, name: cu.name, taxId: cu.taxId, branch: cu.branch, address: cu.address, phone: cu.phone };
            render();
          }
        };
      }
    }).catch(function () {});
  }, 0);

  function addOrIncrementProduct(p) {
    // [sku, barcode, name, unit, price, category, vatType]
    TLProductsCache.recordUse(p[0]);
    var existing = S.items.find(function (it) { return it.code && it.code === p[0]; });
    if (existing) {
      var curQ = Number(existing.qty || '1') || 1;
      existing.qty = String(curQ + 1);
    } else {
      if (S.items.length === 1 && !S.items[0].name && !S.items[0].code && !S.items[0].price) {
        S.items = [];
      }
      S.items.push({ code: p[0], name: p[2], qty: '1', unit: p[3] || 'ชิ้น', price: String(p[4] || '0'), disc: '' });
    }
    TLUtils.showToast('เพิ่ม: ' + p[2], 'ok');
    render();
  }

  function applyDocTypeLocal(dtKey) {
    var t = TLInvoiceCore.DOC_TYPES[dtKey];
    if (!t || dtKey === 'CUSTOM') return;
    S.title = t.title;
    S.titleEn = t.en;
    S.showCustomer = !t.abb;
    if (dtKey === 'RC' && !S.seller.taxId) S.priceMode = 'NONE';
    if (t.abb && S.priceMode === 'EXCL') S.priceMode = 'INCL';
  }

  function buildShareSummaryText(doc, calc) {
    var lines = calc.lines.map(function (l, i) {
      return (i + 1) + '. ' + l.name + ' x' + TLInvoiceCore.qtyFmt(l.q) + ' = ' + TLInvoiceCore.moneyFmt(l.net) + ' บ.';
    }).join('\n');
    return '🧾 ' + doc.title + '\nเลขที่: ' + doc.doc.no + '\nวันที่: ' + TLUtils.thaiDate(doc.doc.date) +
      '\nผู้ขาย: ' + doc.seller.name +
      (doc.customer && doc.customer.name ? '\nลูกค้า: ' + doc.customer.name : '') +
      '\n---\n' + lines +
      '\n---\nรวมทั้งสิ้น: ' + TLInvoiceCore.moneyFmt(calc.grand) + ' บาท' +
      (calc.mode !== 'NONE' ? ' (VAT ' + TLInvoiceCore.moneyFmt(calc.vat) + ' บ.)' : '');
  }

  async function downloadServerPdf(docNo) {
    try {
      TLUtils.showToast('กำลังสร้างลิงก์ดาวน์โหลด PDF...');
      var res = await TLApi.call('getInvoicePdf', { docNo: docNo });
      var url = TLUtils.downloadBase64File(res.file.base64, docNo + '.pdf', 'application/pdf');
      // สำรองสำหรับ WebView บน LINE มือถือ: แสดงลิงก์เปิดหรือพิมพ์
      TLUtils.showModal('PDF เอกสาร ' + docNo,
        '<p class="hint">หากดาวน์โหลดไม่เริ่มอัตโนมัติใน WebView ของ LINE สามารถกดพิมพ์/บันทึกเป็น PDF จากหน้าพรีวิว หรือเปิดผ่านเบราว์เซอร์ได้</p>' +
        '<div class="btns">' +
          '<a class="btn pri full" href="' + url + '" download="' + esc(docNo) + '.pdf" target="_blank">📥 เปิด / บันทึก PDF</a>' +
        '</div>');
    } catch (e) {
      TLUtils.showToast(e.message, 'err');
    }
  }

  async function render() {
    var c = TLInvoiceCore.calcInvoice(S);
    var warns = TLInvoiceCore.getInvoiceWarnings(S, c, TLProductsCache.getAll());

    var tabsHtml =
      '<div class="seg">' +
        '<button type="button" class="' + (activeTab === 'edit' ? 'active' : '') + '" data-tab="edit">✏️ ออกบิลใหม่</button>' +
        '<button type="button" class="' + (activeTab === 'preview' ? 'active' : '') + '" data-tab="preview">👁️ พรีวิว A4</button>' +
        '<button type="button" class="' + (activeTab === 'history' ? 'active' : '') + '" data-tab="history">📂 ประวัติบิล</button>' +
      '</div>';

    if (activeTab === 'preview') {
      var rendered = TLInvoiceCore.renderAllPagesHtml(S);
      container.innerHTML = tabsHtml +
        '<div class="card">' +
          '<div class="btns">' +
            '<button type="button" class="btn pri" id="btn-print-a4">🖨️ พิมพ์ / บันทึก PDF</button>' +
            (lastIssued ? '<button type="button" class="btn outline" id="btn-dl-pdf">📥 โหลด PDF (Blob)</button>' : '') +
            '<button type="button" class="btn outline" id="btn-share-bill">💬 ส่งสรุปให้ลูกค้า (LINE)</button>' +
            (!lastIssued ? '<button type="button" class="btn pri" id="btn-issue-from-prev">✅ ออกบิลจริงเลขถัดไป</button>' : '') +
          '</div>' +
          '<div class="a4-scroll"><div id="a4-preview-box" style="--fs:' + (parseFloat(S.view.fontSize) || 10.5) + 'pt">' + rendered.html + '</div></div>' +
        '</div>';
      container.querySelectorAll('[data-tab]').forEach(function (b) {
        b.onclick = function () { activeTab = b.dataset.tab; render(); };
      });
      document.getElementById('btn-print-a4').onclick = function () { TLUtils.printPagesHtml(rendered.html, S.view.fontSize); };
      if (lastIssued && document.getElementById('btn-dl-pdf')) {
        document.getElementById('btn-dl-pdf').onclick = function () { downloadServerPdf(lastIssued.docNo); };
      }
      document.getElementById('btn-share-bill').onclick = function () {
        TLUtils.shareTextToLine(buildShareSummaryText(S, rendered.calc));
      };
      if (document.getElementById('btn-issue-from-prev')) {
        document.getElementById('btn-issue-from-prev').onclick = handleIssueInvoice;
      }
      return;
    }

    if (activeTab === 'history') {
      container.innerHTML = tabsHtml + '<div class="card center-box"><div class="spinner"></div><p>กำลังโหลดประวัติบิล...</p></div>';
      container.querySelectorAll('[data-tab]').forEach(function (b) {
        b.onclick = function () { activeTab = b.dataset.tab; render(); };
      });
      try {
        var histRes = await TLApi.call('getInvoices', { limit: 60 });
        invoicesHistory = histRes.invoices || [];
      } catch (e) {
        container.innerHTML = tabsHtml + '<div class="card"><div class="warn-box">' + esc(e.message) + '</div></div>';
        return;
      }
      var listHtml = invoicesHistory.length
        ? invoicesHistory.map(function (inv) {
            var isCancelled = inv.status === 'ยกเลิก';
            var isAbb = !isCancelled && (inv.docType === 'ABB' || inv.docType === 'ABB_RC' || inv.docNo.indexOf('ABB') === 0);
            return '<div class="list-item" style="flex-direction:column">' +
              '<div style="width:100%;display:flex;justify-content:space-between;align-items:center">' +
                '<div><b>' + esc(inv.docNo) + '</b> <span class="badge ' + (isCancelled ? 'danger' : 'ok') + '">' + esc(inv.status) + '</span>' +
                  '<div class="hint">' + esc(inv.title) + ' · ' + TLUtils.thaiDate(inv.dateTime.slice(0, 10)) + ' · ' + esc(inv.customerName || 'ลูกค้าทั่วไป') + '</div>' +
                  (inv.refDoc ? '<div class="hint">อ้างอิง: ' + esc(inv.refDoc) + '</div>' : '') +
                  (inv.cancelReason ? '<div class="hint" style="color:#b42318">เหตุผลยกเลิก: ' + esc(inv.cancelReason) + '</div>' : '') +
                '</div>' +
                '<div style="text-align:right;font-weight:700">' + TLUtils.moneyBaht(inv.grandTotal) + ' บ.</div>' +
              '</div>' +
              '<div class="btns" style="margin:6px 0 0">' +
                '<button type="button" class="btn sm outline" data-reprint="' + esc(inv.docNo) + '">🖨️ ดู / พิมพ์ซ้ำ</button>' +
                '<button type="button" class="btn sm outline" data-pdf="' + esc(inv.docNo) + '">📥 PDF</button>' +
                (isAbb ? '<button type="button" class="btn sm pri" data-convert-abb="' + esc(inv.docNo) + '">🔄 ออกใบเต็มรูปแทน</button>' : '') +
                (!isCancelled ? '<button type="button" class="btn sm danger" data-cancel-inv="' + esc(inv.docNo) + '">✕ ยกเลิก</button>' : '') +
              '</div>' +
            '</div>';
          }).join('')
        : '<p class="hint">ยังไม่มีประวัติการออกบิล</p>';

      container.innerHTML = tabsHtml + '<div class="card"><h2>📂 ประวัติบิลที่ออกแล้ว</h2>' + listHtml + '</div>';
      container.querySelectorAll('[data-tab]').forEach(function (b) {
        b.onclick = function () { activeTab = b.dataset.tab; render(); };
      });
      container.querySelectorAll('[data-reprint]').forEach(function (b) {
        b.onclick = async function () {
          try {
            TLUtils.showToast('กำลังโหลดข้อมูลบิล...');
            var det = await TLApi.call('getInvoiceDetail', { docNo: b.dataset.reprint });
            S = det.doc;
            lastIssued = { docNo: det.docNo };
            activeTab = 'preview';
            render();
          } catch (e) { TLUtils.showToast(e.message, 'err'); }
        };
      });
      container.querySelectorAll('[data-pdf]').forEach(function (b) {
        b.onclick = function () { downloadServerPdf(b.dataset.pdf); };
      });
      container.querySelectorAll('[data-cancel-inv]').forEach(function (b) {
        b.onclick = async function () {
          var docNo = b.dataset.cancelInv;
          var reason = window.prompt('ระบุเหตุผลในการยกเลิกบิล ' + docNo + ':');
          if (!reason) return;
          try {
            await TLApi.call('cancelInvoice', { docNo: docNo, reason: reason });
            TLUtils.showToast('ยกเลิกบิล ' + docNo + ' แล้ว', 'ok');
            render();
          } catch (e) { TLUtils.showToast(e.message, 'err'); }
        };
      });
      container.querySelectorAll('[data-convert-abb]').forEach(function (b) {
        b.onclick = function () { openConvertAbbModal(b.dataset.convertAbb); };
      });
      return;
    }

    // ---------- แท็บ ออกบิลใหม่ ----------
    var issuedBanner = '';
    if (lastIssued && S.doc.no === lastIssued.docNo) {
      issuedBanner = '<div class="card"><div class="ok-box">🎉 ออกบิลเลขที่ <b>' + esc(lastIssued.docNo) + '</b> เรียบร้อยแล้ว!</div>' +
        '<div class="btns">' +
          '<button type="button" class="btn pri" id="btn-issued-prev">🖨️ ดูพรีวิว / พิมพ์ A4</button>' +
          '<button type="button" class="btn outline" id="btn-issued-pdf">📥 ดาวน์โหลด PDF</button>' +
          '<button type="button" class="btn outline" id="btn-issued-share">💬 ส่งสรุปทาง LINE</button>' +
          '<button type="button" class="btn" id="btn-new-bill">📄 สร้างบิลใหม่</button>' +
        '</div></div>';
    }

    var freqProds = TLProductsCache.getFrequent().slice(0, 6);
    var recProds = TLProductsCache.getRecent().slice(0, 6);

    var itemsHtml = S.items.map(function (it, idx) {
      return '<div class="split-card" data-it="' + idx + '">' +
        '<div class="split-head"><b>รายการ #' + (idx + 1) + '</b>' +
          '<div class="btns" style="margin:0">' +
            (idx > 0 ? '<button type="button" class="btn sm" data-it-up="' + idx + '">↑</button>' : '') +
            '<button type="button" class="btn sm danger" data-it-del="' + idx + '">✕</button>' +
          '</div>' +
        '</div>' +
        '<div class="grid2">' +
          '<div><label class="f">รหัส/SKU</label><input type="text" data-if="code" value="' + esc(it.code) + '"></div>' +
          '<div><label class="f">หน่วย</label><input type="text" data-if="unit" value="' + esc(it.unit) + '" placeholder="ชิ้น"></div>' +
        '</div>' +
        '<label class="f">ชื่อสินค้า / รายการ</label><input type="text" data-if="name" value="' + esc(it.name) + '">' +
        '<div class="grid3">' +
          '<div><label class="f">จำนวน</label><input type="number" step="0.001" inputmode="decimal" data-if="qty" value="' + esc(it.qty) + '"></div>' +
          '<div><label class="f">ราคา/หน่วย</label><input type="number" step="0.01" inputmode="decimal" data-if="price" value="' + esc(it.price) + '"></div>' +
          '<div><label class="f">ส่วนลด (บาท/%)</label><input type="text" data-if="disc" value="' + esc(it.disc) + '" placeholder="10 หรือ 5%"></div>' +
        '</div>' +
      '</div>';
    }).join('');

    var chargesHtml = S.charges.map(function (ch, j) {
      return '<div class="grid2" style="margin-top:6px" data-ch="' + j + '">' +
        '<input type="text" data-cf="label" value="' + esc(ch.label) + '" placeholder="เช่น ค่าขนส่ง">' +
        '<div style="display:flex;gap:6px"><input type="number" step="0.01" inputmode="decimal" data-cf="amount" value="' + esc(ch.amount) + '" placeholder="จำนวนเงิน">' +
        '<button type="button" class="btn sm danger" data-del-ch="' + j + '">✕</button></div>' +
      '</div>';
    }).join('');

    container.innerHTML = tabsHtml + issuedBanner +
      '<div id="inv-warns">' +
        (warns.length ? warns.map(function (w) { return '<div class="warn-box">⚠️ ' + esc(w) + '</div>'; }).join('') :
          '<div class="ok-box">✓ ข้อมูลครบถ้วน · รวมทั้งสิ้น <b>' + TLInvoiceCore.moneyFmt(c.grand) + '</b> บาท</div>') +
      '</div>' +

      '<div class="card">' +
        '<h3>1. หัวข้อเอกสาร & โหมดภาษี</h3>' +
        '<label class="f">ประเภทเอกสาร</label>' +
        '<select id="inv-doctype">' +
          Object.keys(TLInvoiceCore.DOC_TYPES).map(function (k) {
            return '<option value="' + k + '"' + (S.docType === k ? ' selected' : '') + '>' + esc(TLInvoiceCore.DOC_TYPES[k].name) + '</option>';
          }).join('') +
        '</select>' +
        '<div class="grid2">' +
          '<div><label class="f">หัวข้อเอกสาร (ไทย)</label><input type="text" data-sk="title" value="' + esc(S.title) + '"></div>' +
          '<div><label class="f">หัวข้อเอกสาร (อังกฤษ)</label><input type="text" data-sk="titleEn" value="' + esc(S.titleEn) + '"></div>' +
        '</div>' +
        '<div class="grid2">' +
          '<div><label class="f">โหมดราคา VAT</label><select data-sk="priceMode">' +
            '<option value="INCL"' + (S.priceMode === 'INCL' ? ' selected' : '') + '>ราคารวม VAT แล้ว (INCL)</option>' +
            '<option value="EXCL"' + (S.priceMode === 'EXCL' ? ' selected' : '') + '>ราคาไม่รวม VAT (EXCL)</option>' +
            '<option value="NONE"' + (S.priceMode === 'NONE' ? ' selected' : '') + '>ไม่มี VAT (NONE)</option>' +
          '</select></div>' +
          '<div><label class="f">อัตรา VAT (%)</label><input type="text" data-sk="vatRate" value="' + esc(S.vatRate) + '"></div>' +
        '</div>' +
        '<div class="grid2">' +
          '<div><label class="f">ต้นฉบับ / สำเนา</label><select data-sk="copyMode">' +
            '<option value="ORIGINAL"' + (S.copyMode === 'ORIGINAL' ? ' selected' : '') + '>ต้นฉบับ</option>' +
            '<option value="COPY"' + (S.copyMode === 'COPY' ? ' selected' : '') + '>สำเนา</option>' +
            '<option value="BOTH"' + (S.copyMode === 'BOTH' ? ' selected' : '') + '>ต้นฉบับ + สำเนา (2 ชุด)</option>' +
          '</select></div>' +
          '<div><label class="f">วันที่เอกสาร</label><input type="date" data-sk="doc.date" value="' + esc(S.doc.date) + '"></div>' +
        '</div>' +
        '<div style="margin-top:8px">' +
          '<label><input type="checkbox" data-sk-chk="showLineVat"' + (S.showLineVat ? ' checked' : '') + '> แจกแจง "มูลค่าก่อน VAT" และ "VAT" ทุกบรรทัด</label><br>' +
          '<label><input type="checkbox" data-sk-chk="view.chargesInTable"' + (S.view.chargesInTable ? ' checked' : '') + '> แสดงค่าส่ง/ค่าบริการเป็นบรรทัดในตาราง</label>' +
        '</div>' +
      '</div>' +

      '<div class="card">' +
        '<h3>2. เลือกสินค้า (<span id="sell-prod-count">' + TLProductsCache.getAll().length.toLocaleString() + '</span> รายการในเครื่อง)</h3>' +
        '<div style="display:flex;gap:8px">' +
          '<input type="text" id="prod-search-q" placeholder="พิมพ์ชื่อ, SKU หรือบาร์โค้ด...">' +
          '<button type="button" class="btn pri" id="btn-scan-barcode">📷 สแกน</button>' +
        '</div>' +
        '<div id="prod-search-results" style="margin-top:8px"></div>' +
        (freqProds.length ? '<div class="hint" style="margin-top:8px">ขายบ่อย:</div><div class="btns">' + freqProds.map(function (p) {
          return '<button type="button" class="btn sm outline" data-quick-sku="' + esc(p[0]) + '">' + esc(p[2]) + ' (' + p[4] + ')</button>';
        }).join('') + '</div>' : '') +
        (recProds.length ? '<div class="hint">ใช้ล่าสุด:</div><div class="btns">' + recProds.map(function (p) {
          return '<button type="button" class="btn sm" data-quick-sku="' + esc(p[0]) + '">' + esc(p[2]) + '</button>';
        }).join('') + '</div>' : '') +
      '</div>' +

      '<div class="card">' +
        '<h3>3. รายการในบิล</h3>' +
        '<div id="inv-items">' + itemsHtml + '</div>' +
        '<div class="btns">' +
          '<button type="button" class="btn outline" id="btn-add-item">+ เพิ่มรายการเอง</button>' +
          '<button type="button" class="btn outline" id="btn-add-ship-item">+ ค่าขนส่งในตาราง</button>' +
        '</div>' +
        '<label class="f">ส่วนลดท้ายบิล (บาท หรือ % เช่น 5%)</label>' +
        '<input type="text" data-sk="billDiscount" value="' + esc(S.billDiscount) + '" placeholder="เช่น 50 หรือ 5%">' +
        '<label class="f">ค่าขนส่ง / ค่าบริการ / ค่าใช้จ่ายเพิ่ม</label>' +
        '<div id="inv-charges">' + chargesHtml + '</div>' +
        '<div class="btns"><button type="button" class="btn sm outline" id="btn-add-charge">+ เพิ่มค่าขนส่ง/บริการ</button></div>' +
      '</div>' +

      '<div class="card">' +
        '<h3>4. ลูกค้า & การชำระเงิน</h3>' +
        '<label><input type="checkbox" data-sk-chk="showCustomer"' + (S.showCustomer ? ' checked' : '') + '> แสดงกล่องข้อมูลลูกค้าบนบิล</label>' +
        '<div id="sell-cust-picker">' + (customers.length
          ? '<label class="f">เลือกลูกค้าประจำ</label><select id="pick-customer"><option value="">— พิมพ์เอง / ลูกค้าใหม่ —</option>' +
            customers.map(function (cu) { return '<option value="' + esc(cu.code) + '">' + esc(cu.name) + ' (' + esc(cu.code) + ')</option>'; }).join('') +
            '</select>'
          : '') + '</div>' +
        '<div class="grid2">' +
          '<div><label class="f">ชื่อลูกค้า / บริษัท</label><input type="text" data-sk="customer.name" value="' + esc(S.customer.name) + '"></div>' +
          '<div><label class="f">โทร</label><input type="text" data-sk="customer.phone" value="' + esc(S.customer.phone) + '"></div>' +
        '</div>' +
        '<div class="grid2">' +
          '<div><label class="f">เลขประจำตัวผู้เสียภาษี</label><input type="text" data-sk="customer.taxId" value="' + esc(S.customer.taxId) + '"></div>' +
          '<div><label class="f">สาขา</label><input type="text" data-sk="customer.branch" value="' + esc(S.customer.branch) + '" placeholder="สำนักงานใหญ่ / 00001"></div>' +
        '</div>' +
        '<label class="f">ที่อยู่ลูกค้า</label><textarea data-sk="customer.address">' + esc(S.customer.address) + '</textarea>' +
        '<div class="grid2">' +
          '<div><label class="f">วิธีชำระเงิน (เช่น โอนเงิน)</label><input type="text" data-sk="payment.selected" value="' + esc(S.payment.selected) + '"></div>' +
          '<div><label class="f">รายละเอียดการชำระ</label><input type="text" data-sk="payment.detail" value="' + esc(S.payment.detail) + '"></div>' +
        '</div>' +
        '<div class="grid2">' +
          '<div><label class="f">อ้างอิง / PO</label><input type="text" data-sk="doc.ref" value="' + esc(S.doc.ref) + '"></div>' +
          '<div><label class="f">เครดิต</label><input type="text" data-sk="doc.credit" value="' + esc(S.doc.credit) + '"></div>' +
        '</div>' +
        '<label class="f">หมายเหตุ</label><textarea data-sk="remarks">' + esc(S.remarks) + '</textarea>' +
      '</div>' +

      '<details class="card"><summary style="font-weight:700;cursor:pointer">⚙️ ปรับแต่งข้อความทุกบรรทัด & การแสดงผล</summary>' +
        '<div class="grid2" style="margin-top:8px">' +
          '<div><label class="f">จำนวนบรรทัดต่อหน้า</label><input type="number" data-sk="view.rowsPerPage" value="' + esc(S.view.rowsPerPage) + '"></div>' +
          '<div><label class="f">ขนาดตัวอักษร (pt)</label><input type="number" step="0.5" data-sk="view.fontSize" value="' + esc(S.view.fontSize) + '"></div>' +
        '</div>' +
        '<div style="margin:8px 0">' +
          '<label><input type="checkbox" data-sk-chk="view.showCode"' + (S.view.showCode ? ' checked' : '') + '> คอลัมน์รหัสสินค้า</label> · ' +
          '<label><input type="checkbox" data-sk-chk="view.showDiscCol"' + (S.view.showDiscCol ? ' checked' : '') + '> คอลัมน์ส่วนลด</label> · ' +
          '<label><input type="checkbox" data-sk-chk="view.showEn"' + (S.view.showEn ? ' checked' : '') + '> ภาษาอังกฤษ</label> · ' +
          '<label><input type="checkbox" data-sk-chk="view.showWords"' + (S.view.showWords ? ' checked' : '') + '> บาทตัวอักษร</label> · ' +
          '<label><input type="checkbox" data-sk-chk="view.showSigns"' + (S.view.showSigns ? ' checked' : '') + '> ช่องลงนาม</label>' +
        '</div>' +
        '<label class="f">เงื่อนไขท้ายบิล</label><textarea data-sk="terms">' + esc(S.terms) + '</textarea>' +
        '<label class="f">ช่องลงนาม (หัวข้อ | คำอธิบาย | ใต้เส้น)</label><textarea data-sk="signatures">' + esc(S.signatures) + '</textarea>' +
        Object.keys(TLInvoiceCore.DEFAULT_LABELS).map(function (lk) {
          return '<label class="f">' + esc(TLInvoiceCore.LABEL_NAMES[lk] || lk) + '</label><input type="text" data-sk="labels.' + lk + '" value="' + esc(S.labels[lk]) + '">';
        }).join('') +
      '</details>' +

      '<div class="card" id="inv-totals-card">' +
        '<div class="kpi-grid">' +
          '<div class="kpi"><div class="lbl">มูลค่าก่อน VAT</div><div class="val" id="tot-base">' + TLInvoiceCore.moneyFmt(c.base) + '</div></div>' +
          '<div class="kpi"><div class="lbl">VAT ' + esc(S.vatRate) + '%</div><div class="val" id="tot-vat">' + TLInvoiceCore.moneyFmt(c.vat) + '</div></div>' +
        '</div>' +
        '<div class="ok-box" id="tot-grand">จำนวนเงินรวมทั้งสิ้น: <b>' + TLInvoiceCore.moneyFmt(c.grand) + '</b> บาท (' + esc(TLInvoiceCore.bahtText(c.grand)) + ')</div>' +
        '<div class="btns">' +
          '<button type="button" class="btn outline" style="flex:1" id="btn-go-preview">👁️ พรีวิว A4</button>' +
          '<button type="button" class="btn pri" style="flex:2" id="btn-issue-invoice">✅ ออกบิล & สร้าง PDF</button>' +
        '</div>' +
      '</div>';

    bindEditEvents();
  }

  function updateLiveSummary() {
    var c = TLInvoiceCore.calcInvoice(S);
    var warns = TLInvoiceCore.getInvoiceWarnings(S, c, TLProductsCache.getAll());
    var wb = document.getElementById('inv-warns');
    if (wb) {
      wb.innerHTML = warns.length
        ? warns.map(function (w) { return '<div class="warn-box">⚠️ ' + esc(w) + '</div>'; }).join('')
        : '<div class="ok-box">✓ ข้อมูลครบถ้วน · รวมทั้งสิ้น <b>' + TLInvoiceCore.moneyFmt(c.grand) + '</b> บาท</div>';
    }
    var tb = document.getElementById('tot-base');
    var tv = document.getElementById('tot-vat');
    var tg = document.getElementById('tot-grand');
    if (tb) tb.textContent = TLInvoiceCore.moneyFmt(c.base);
    if (tv) tv.textContent = TLInvoiceCore.moneyFmt(c.vat);
    if (tg) tg.innerHTML = 'จำนวนเงินรวมทั้งสิ้น: <b>' + TLInvoiceCore.moneyFmt(c.grand) + '</b> บาท (' + esc(TLInvoiceCore.bahtText(c.grand)) + ')';
  }

  function setNested(path, val) {
    var ks = path.split('.'), last = ks.pop(), cur = S;
    ks.forEach(function (k) { cur = cur[k] = cur[k] || {}; });
    cur[last] = val;
  }

  async function handleIssueInvoice() {
    var btn = document.getElementById('btn-issue-invoice') || document.getElementById('btn-issue-from-prev');
    if (btn) { btn.disabled = true; btn.textContent = 'กำลังออกบิลและสร้าง PDF...'; }
    try {
      var res = await TLApi.call('issueInvoice', { docData: S });
      lastIssued = res;
      S = res.doc;
      TLUtils.showToast('ออกบิล ' + res.docNo + ' สำเร็จ!', 'ok');
      activeTab = 'edit';
      render();
    } catch (e) {
      TLUtils.showToast(e.message, 'err');
      if (btn) { btn.disabled = false; btn.textContent = '✅ ออกบิล & สร้าง PDF'; }
    }
  }

  function openConvertAbbModal(abbDocNo) {
    TLUtils.showModal('เปลี่ยนใบย่อ ' + abbDocNo + ' เป็นใบกำกับภาษีเต็มรูป',
      '<label class="f">ชื่อลูกค้า / บริษัท *</label><input type="text" id="conv-name">' +
      '<label class="f">เลขประจำตัวผู้เสียภาษี</label><input type="text" id="conv-taxid">' +
      '<label class="f">สาขา</label><input type="text" id="conv-branch" value="สำนักงานใหญ่">' +
      '<label class="f">ที่อยู่ *</label><textarea id="conv-addr"></textarea>' +
      '<label class="f">โทร</label><input type="text" id="conv-phone">' +
      '<div class="btns" style="margin-top:12px"><button type="button" class="btn pri full" id="btn-do-convert">✅ ออกใบกำกับภาษีเต็มรูป</button></div>');
    document.getElementById('btn-do-convert').onclick = async function () {
      var name = document.getElementById('conv-name').value.trim();
      var addr = document.getElementById('conv-addr').value.trim();
      if (!name || !addr) return TLUtils.showToast('ต้องกรอกชื่อและที่อยู่ลูกค้า', 'err');
      this.disabled = true;
      try {
        var r = await TLApi.call('convertAbbToFull', {
          docNo: abbDocNo,
          customer: {
            name: name,
            taxId: document.getElementById('conv-taxid').value.trim(),
            branch: document.getElementById('conv-branch').value.trim(),
            address: addr,
            phone: document.getElementById('conv-phone').value.trim()
          }
        });
        TLUtils.closeModal();
        TLUtils.showToast('ออกใบเต็มรูป ' + r.newInvoice.docNo + ' แทน ' + abbDocNo + ' แล้ว', 'ok');
        render();
      } catch (e) {
        TLUtils.showToast(e.message, 'err');
        this.disabled = false;
      }
    };
  }

  function bindEditEvents() {
    container.querySelectorAll('[data-tab]').forEach(function (b) {
      b.onclick = function () { activeTab = b.dataset.tab; render(); };
    });

    if (document.getElementById('btn-issued-prev')) {
      document.getElementById('btn-issued-prev').onclick = function () { activeTab = 'preview'; render(); };
      document.getElementById('btn-issued-pdf').onclick = function () { downloadServerPdf(lastIssued.docNo); };
      document.getElementById('btn-issued-share').onclick = function () {
        TLUtils.shareTextToLine(buildShareSummaryText(S, TLInvoiceCore.calcInvoice(S)));
      };
      document.getElementById('btn-new-bill').onclick = function () {
        lastIssued = null;
        S.doc.no = 'รอออกเลขอัตโนมัติ';
        S.items = [TLInvoiceCore.blankItem()];
        S.charges = [];
        S.billDiscount = '';
        render();
      };
    }

    document.getElementById('inv-doctype').onchange = function () {
      S.docType = this.value;
      applyDocTypeLocal(this.value);
      render();
    };

    container.querySelectorAll('[data-sk]').forEach(function (el) {
      el.oninput = function () { setNested(el.dataset.sk, el.value); updateLiveSummary(); };
      el.onchange = function () { setNested(el.dataset.sk, el.value); updateLiveSummary(); };
    });
    container.querySelectorAll('[data-sk-chk]').forEach(function (el) {
      el.onchange = function () { setNested(el.dataset.skChk, el.checked); updateLiveSummary(); };
    });

    var qInp = document.getElementById('prod-search-q');
    var qRes = document.getElementById('prod-search-results');
    qInp.oninput = function () {
      var val = this.value.trim();
      if (!val) { qRes.innerHTML = ''; return; }
      var hits = TLProductsCache.search(val, 25);
      qRes.innerHTML = hits.length
        ? hits.map(function (p) {
            return '<div class="list-item" style="cursor:pointer" data-pick-sku="' + esc(p[0]) + '">' +
              '<div><b>' + esc(p[2]) + '</b><div class="hint">' + esc(p[0]) + (p[1] && p[1] !== p[0] ? ' · ' + esc(p[1]) : '') + '</div></div>' +
              '<div><b>' + esc(p[4]) + ' บ.</b>/' + esc(p[3] || 'ชิ้น') + '</div></div>';
          }).join('')
        : '<div class="hint">ไม่พบสินค้า</div>';
      qRes.querySelectorAll('[data-pick-sku]').forEach(function (row) {
        row.onclick = function () {
          var p = TLProductsCache.findExact(row.dataset.pickSku);
          if (p) addOrIncrementProduct(p);
        };
      });
    };

    document.getElementById('btn-scan-barcode').onclick = async function () {
      try {
        var code = await TLUtils.scanBarcode();
        if (!code) return;
        var p = TLProductsCache.findExact(code);
        if (p) addOrIncrementProduct(p);
        else TLUtils.showToast('ไม่พบบาร์โค้ด "' + code + '" ในฐานข้อมูลสินค้า', 'err');
      } catch (e) { TLUtils.showToast(e.message, 'err'); }
    };

    container.querySelectorAll('[data-quick-sku]').forEach(function (b) {
      b.onclick = function () {
        var p = TLProductsCache.findExact(b.dataset.quickSku);
        if (p) addOrIncrementProduct(p);
      };
    });

    container.querySelectorAll('[data-it]').forEach(function (card) {
      var idx = Number(card.dataset.it);
      card.querySelectorAll('[data-if]').forEach(function (inp) {
        inp.oninput = function () { S.items[idx][inp.dataset.if] = inp.value; updateLiveSummary(); };
      });
    });
    container.querySelectorAll('[data-it-up]').forEach(function (b) {
      b.onclick = function () {
        var i = Number(b.dataset.itUp);
        var tmp = S.items[i - 1]; S.items[i - 1] = S.items[i]; S.items[i] = tmp;
        render();
      };
    });
    container.querySelectorAll('[data-it-del]').forEach(function (b) {
      b.onclick = function () {
        S.items.splice(Number(b.dataset.itDel), 1);
        if (!S.items.length) S.items.push(TLInvoiceCore.blankItem());
        render();
      };
    });

    document.getElementById('btn-add-item').onclick = function () { S.items.push(TLInvoiceCore.blankItem()); render(); };
    document.getElementById('btn-add-ship-item').onclick = function () {
      S.items.push({ code: '', name: 'ค่าขนส่ง', qty: '1', unit: 'ครั้ง', price: '', disc: '' });
      render();
    };
    document.getElementById('btn-add-charge').onclick = function () { S.charges.push({ label: 'ค่าขนส่ง', amount: '' }); render(); };
    container.querySelectorAll('[data-ch]').forEach(function (row) {
      var j = Number(row.dataset.ch);
      row.querySelectorAll('[data-cf]').forEach(function (inp) {
        inp.oninput = function () { S.charges[j][inp.dataset.cf] = inp.value; updateLiveSummary(); };
      });
    });
    container.querySelectorAll('[data-del-ch]').forEach(function (b) {
      b.onclick = function () { S.charges.splice(Number(b.dataset.delCh), 1); render(); };
    });

    var custSel = document.getElementById('pick-customer');
    if (custSel) {
      custSel.onchange = function () {
        var cu = customers.find(function (x) { return x.code === custSel.value; });
        if (cu) {
          S.customer = { code: cu.code, name: cu.name, taxId: cu.taxId, branch: cu.branch, address: cu.address, phone: cu.phone };
          render();
        }
      };
    }

    document.getElementById('btn-go-preview').onclick = function () { activeTab = 'preview'; render(); };
    document.getElementById('btn-issue-invoice').onclick = handleIssueInvoice;
  }

  render();
};
