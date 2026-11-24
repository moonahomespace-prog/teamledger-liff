// TeamLedger v3.1 — แกนกลางฟอร์มใบกำกับภาษีและคณิตศาสตร์ VAT ระดับสตางค์
// คงสูตรเดียวกับ templates/invoice_editor.html และ build_invoice_sample.py 100%
(function (root) {
  var DOC_TYPES = {
    FULL_RC: { name: 'ใบกำกับภาษี / ใบเสร็จรับเงิน', title: 'ใบกำกับภาษี / ใบเสร็จรับเงิน', en: 'TAX INVOICE / RECEIPT', prefix: 'IV', abb: false },
    FULL:    { name: 'ใบกำกับภาษี (เต็มรูป)', title: 'ใบกำกับภาษี', en: 'TAX INVOICE', prefix: 'IV', abb: false },
    DO_FULL: { name: 'ใบส่งของ / ใบกำกับภาษี', title: 'ใบส่งของ / ใบกำกับภาษี', en: 'DELIVERY ORDER / TAX INVOICE', prefix: 'IV', abb: false },
    ABB_RC:  { name: 'ใบกำกับภาษีอย่างย่อ / ใบเสร็จรับเงิน', title: 'ใบกำกับภาษีอย่างย่อ / ใบเสร็จรับเงิน', en: 'ABBREVIATED TAX INVOICE / RECEIPT', prefix: 'ABB', abb: true },
    ABB:     { name: 'ใบกำกับภาษีอย่างย่อ', title: 'ใบกำกับภาษีอย่างย่อ', en: 'ABBREVIATED TAX INVOICE', prefix: 'ABB', abb: true },
    RC:      { name: 'ใบเสร็จรับเงิน', title: 'ใบเสร็จรับเงิน', en: 'RECEIPT', prefix: 'RC', abb: false },
    CUSTOM:  { name: 'กำหนดเอง (พิมพ์ชื่อเอกสารเอง)', title: '', en: '', prefix: '', abb: false }
  };

  var DEFAULT_LABELS = {
    colNo: 'ลำดับ|No.', colCode: 'รหัสสินค้า|Code', colName: 'รายการ|Description', colQty: 'จำนวน|Qty', colUnit: 'หน่วย|Unit',
    colPrice: 'ราคาต่อหน่วย|Unit Price', colDisc: 'ส่วนลด|Discount', colAmount: 'จำนวนเงิน|Amount', colBase: 'มูลค่าก่อน VAT|Pre-VAT', colVat: 'VAT {rate}%|VAT',
    sellerTax: 'เลขประจำตัวผู้เสียภาษี', sellerTel: 'โทร',
    custCode: 'รหัสลูกค้า|Code', custName: 'ชื่อลูกค้า|Customer', custTax: 'เลขประจำตัวผู้เสียภาษี|Tax ID', custAddr: 'ที่อยู่|Address', custTel: 'โทร|Tel.',
    docNo: 'เลขที่|No.', docDate: 'วันที่|Date', docRef: 'อ้างอิง|Ref.', docCredit: 'เครดิต|Terms', docSales: 'พนักงานขาย|Sales',
    sumSubtotal: 'รวมเป็นเงิน|Sub Total', sumDiscount: 'ส่วนลด|Discount', sumBase: 'มูลค่าก่อนภาษีมูลค่าเพิ่ม|Pre-VAT Amount',
    sumVat: 'ภาษีมูลค่าเพิ่ม {rate}%|VAT {rate}%', sumGrand: 'จำนวนเงินรวมทั้งสิ้น|Grand Total', sumLineTotal: 'รวม|Total',
    carry: 'ยอดยกไป|Carried Forward', continued: '— มีต่อหน้าถัดไป —', remarks: 'หมายเหตุ|Remarks', payment: 'การชำระเงิน|Payment',
    paymentDetail: 'รายละเอียด', noteIncl: 'ราคาสินค้ารวมภาษีมูลค่าเพิ่มแล้ว (VAT Included)', noteExcl: 'ราคาสินค้ายังไม่รวมภาษีมูลค่าเพิ่ม (VAT Excluded)',
    noteNone: '', noteAlloc: '* มูลค่าก่อน VAT / VAT รายบรรทัด แจกแจงหลังหักส่วนลดท้ายบิลแล้ว', eoe: 'ผิด ตก ยกเว้น E.&O.E.', page: 'หน้า|Page', cancelled: 'ยกเลิก'
  };

  var LABEL_NAMES = {
    colNo: 'คอลัมน์ ลำดับ', colCode: 'คอลัมน์ รหัส', colName: 'คอลัมน์ รายการ', colQty: 'คอลัมน์ จำนวน', colUnit: 'คอลัมน์ หน่วย', colPrice: 'คอลัมน์ ราคา/หน่วย',
    colDisc: 'คอลัมน์ ส่วนลด', colAmount: 'คอลัมน์ จำนวนเงิน', colBase: 'คอลัมน์ ก่อน VAT', colVat: 'คอลัมน์ VAT', sellerTax: 'ผู้ขาย: เลขภาษี', sellerTel: 'ผู้ขาย: โทร',
    custCode: 'ลูกค้า: รหัส', custName: 'ลูกค้า: ชื่อ', custTax: 'ลูกค้า: เลขภาษี', custAddr: 'ลูกค้า: ที่อยู่', custTel: 'ลูกค้า: โทร',
    docNo: 'เอกสาร: เลขที่', docDate: 'เอกสาร: วันที่', docRef: 'เอกสาร: อ้างอิง', docCredit: 'เอกสาร: เครดิต', docSales: 'เอกสาร: พนักงานขาย',
    sumSubtotal: 'สรุป: รวมเป็นเงิน', sumDiscount: 'สรุป: ส่วนลด', sumBase: 'สรุป: ก่อน VAT', sumVat: 'สรุป: VAT', sumGrand: 'สรุป: รวมทั้งสิ้น', sumLineTotal: 'แถวรวมในตาราง',
    carry: 'ยอดยกไป', continued: 'มีต่อหน้าถัดไป', remarks: 'หมายเหตุ', payment: 'การชำระเงิน', paymentDetail: 'รายละเอียดชำระ',
    noteIncl: 'หมายเหตุ โหมดรวม VAT', noteExcl: 'หมายเหตุ โหมดไม่รวม VAT', noteNone: 'หมายเหตุ โหมดไม่มี VAT', noteAlloc: 'หมายเหตุ แจกแจงหลังส่วนลด',
    eoe: 'ผิด ตก ยกเว้น', page: 'หน้า', cancelled: 'ลายน้ำยกเลิก'
  };

  function blankItem() {
    return { code: '', name: '', qty: '1', unit: '', price: '', disc: '' };
  }

  function todayIsoLocal() {
    var d = new Date();
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 10);
  }

  function defaults() {
    return {
      version: 2,
      docType: 'FULL_RC',
      title: DOC_TYPES.FULL_RC.title,
      titleEn: DOC_TYPES.FULL_RC.en,
      copyMode: 'ORIGINAL',
      copyLabels: { original: 'ต้นฉบับ / Original', copy: 'สำเนา / Copy' },
      doc: { no: 'รอออกเลขอัตโนมัติ', date: todayIsoLocal(), time: '', ref: '', credit: '', sales: '' },
      priceMode: 'INCL',
      vatRate: '7',
      showLineVat: false,
      seller: {
        name: 'บริษัท เมซง มูนี่ส์ จำกัด',
        nameEn: 'MAISON MOONIES CO., LTD.',
        branch: 'สำนักงานใหญ่',
        address: '',
        phone: '',
        taxId: '',
        extra: ''
      },
      showCustomer: true,
      customer: { code: '', name: '', taxId: '', branch: '', address: '', phone: '' },
      items: [blankItem()],
      billDiscount: '',
      charges: [],
      remarks: '',
      terms: 'ใบกำกับภาษีนี้จะสมบูรณ์เมื่อบริษัทได้รับชำระเงินครบถ้วนแล้ว\nสินค้ายังคงเป็นกรรมสิทธิ์ของบริษัทจนกว่าจะได้รับชำระเงินครบถ้วน',
      payment: { methods: 'เงินสด, โอนเงิน, เช็ค', selected: '', detail: '' },
      signatures: 'ผู้รับสินค้า | ได้รับสินค้าครบถ้วนถูกต้องแล้ว | ลงนามผู้รับสินค้า\nผู้ส่งสินค้า | ส่งสินค้าถึงมือลูกค้าเรียบร้อย | ลงนามผู้ส่งสินค้า\nในนาม {seller} | ได้รับเงินครบถ้วนแล้ว | ผู้มีอำนาจลงนาม / ผู้รับเงิน',
      labels: Object.assign({}, DEFAULT_LABELS),
      view: {
        rowsPerPage: 18, fontSize: 10.5, showCode: true, showDiscCol: true,
        showEn: true, showSigns: true, showPayment: true, showWords: true,
        showEoe: true, chargesInTable: false, cancelled: false
      }
    };
  }

  function parseFixed(v, dp) {
    var s = String(v !== undefined && v !== null ? v : '').replace(/[,\s฿]/g, '');
    if (!s || isNaN(Number(s))) return 0;
    var neg = s[0] === '-';
    if (neg || s[0] === '+') s = s.slice(1);
    var parts = s.split('.');
    var i = parts[0] || '0';
    var f = ((parts[1] || '') + '0'.repeat(dp + 1)).slice(0, dp + 1);
    var n = parseInt(i || '0', 10) * Math.pow(10, dp) + (dp ? parseInt(f.slice(0, dp), 10) : 0);
    if (+f[dp] >= 5) n += 1;
    return neg ? -n : n;
  }

  function roundDiv(n, d) {
    var s = n < 0 ? -1 : 1;
    n = Math.abs(n);
    return s * Math.floor((2 * n + d) / (2 * d));
  }

  function discAmount(v, gross) {
    var s = String(v !== undefined && v !== null ? v : '').trim();
    if (!s) return 0;
    if (s.endsWith('%')) return roundDiv(gross * parseFixed(s.slice(0, -1), 3), 100000);
    return parseFixed(s, 2);
  }

  function largestIndex(arr) {
    var k = 0;
    for (var i = 0; i < arr.length; i++) {
      if (arr[i] > arr[k]) k = i;
    }
    return k;
  }

  function calcInvoice(S) {
    var mode = S.priceMode || 'INCL';
    var rate = parseFixed(S.vatRate !== undefined && S.vatRate !== '' ? S.vatRate : '7', 2);
    var lines = (S.items || []).filter(function (it) {
      return String(it.name || '').trim() || String(it.code || '').trim() || String(it.price || '').trim();
    }).map(function (it) {
      var q = parseFixed(it.qty === '' || it.qty === undefined || it.qty === null ? '1' : it.qty, 3);
      var p = parseFixed(it.price, 2);
      var gross = roundDiv(q * p, 1000);
      var disc = discAmount(it.disc, gross);
      return { code: it.code || '', name: it.name || '', unit: it.unit || '', discRaw: it.disc || '', q: q, p: p, gross: gross, disc: disc, net: gross - disc };
    });
    var charges = (S.charges || []).filter(function (c) {
      return String(c.label || '').trim() || String(c.amount || '').trim();
    }).map(function (c) {
      return { label: c.label || '', amt: parseFixed(c.amount, 2) };
    });
    var subtotal = lines.reduce(function (a, l) { return a + l.net; }, 0);
    var billDisc = discAmount(S.billDiscount, subtotal);
    var chargeTotal = charges.reduce(function (a, c) { return a + c.amt; }, 0);
    var taxable = subtotal - billDisc + chargeTotal;
    var base, vat, grand;
    if (mode === 'EXCL') { base = taxable; vat = roundDiv(base * rate, 10000); grand = base + vat; }
    else if (mode === 'INCL') { grand = taxable; vat = roundDiv(grand * rate, 10000 + rate); base = grand - vat; }
    else { base = taxable; vat = 0; grand = taxable; }

    var d = lines.map(function (l) { return subtotal ? Math.floor(billDisc * l.net / subtotal) : 0; });
    if (lines.length) d[largestIndex(lines.map(function (l) { return l.net; }))] += billDisc - d.reduce(function (a, x) { return a + x; }, 0);
    var eff = lines.map(function (l, i) { return l.net - d[i]; }).concat(charges.map(function (c) { return c.amt; }));
    var lb, lv;
    if (mode === 'INCL') { lb = eff.map(function (e) { return roundDiv(e * 10000, 10000 + rate); }); lv = eff.map(function (e, i) { return e - lb[i]; }); }
    else if (mode === 'EXCL') { lv = eff.map(function (e) { return roundDiv(e * rate, 10000); }); lb = eff.slice(); }
    else { lv = eff.map(function () { return 0; }); lb = eff.slice(); }

    if (eff.length && mode !== 'NONE') {
      var k = largestIndex(eff);
      var diff = vat - lv.reduce(function (a, x) { return a + x; }, 0);
      lv[k] += diff;
      if (mode === 'INCL') lb[k] -= diff;
    }
    lines.forEach(function (l, i) { l.allocDisc = d[i]; l.lb = lb[i]; l.lv = lv[i]; });
    charges.forEach(function (c, j) { c.lb = lb[lines.length + j]; c.lv = lv[lines.length + j]; });
    return { mode: mode, rate: rate, lines: lines, charges: charges, subtotal: subtotal, billDisc: billDisc, chargeTotal: chargeTotal, taxable: taxable, base: base, vat: vat, grand: grand };
  }

  function bahtText(st) {
    if (st < 0) return 'ลบ' + bahtText(-st);
    var N = ['ศูนย์', 'หนึ่ง', 'สอง', 'สาม', 'สี่', 'ห้า', 'หก', 'เจ็ด', 'แปด', 'เก้า'];
    var P = ['', 'สิบ', 'ร้อย', 'พัน', 'หมื่น', 'แสน'];
    function read(n, tail) {
      if (n === 0) return '';
      if (n >= 1e6) return read(Math.floor(n / 1e6), false) + 'ล้าน' + read(n % 1e6, true);
      var s = String(n), o = '';
      for (var i = 0; i < s.length; i++) {
        var x = +s[i], p = s.length - i - 1;
        if (!x) continue;
        if (p === 1 && x === 1) o += 'สิบ';
        else if (p === 1 && x === 2) o += 'ยี่สิบ';
        else if (p === 0 && x === 1 && (s.length > 1 || tail)) o += 'เอ็ด';
        else o += N[x] + P[p];
      }
      return o;
    }
    var b = Math.floor(st / 100), s = st % 100;
    return (read(b, false) || 'ศูนย์') + 'บาท' + (s ? read(s, false) + 'สตางค์' : 'ถ้วน');
  }

  function escHtml(s) {
    return String(s === null || s === undefined ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function nlHtml(s) {
    return escHtml(s).replace(/\n/g, '<br>');
  }

  function moneyFmt(st) {
    return (st / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function qtyFmt(q) {
    return (q / 1000).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 3 });
  }

  function thaiDateFmt(iso, time) {
    if (!iso) return '';
    var p = String(iso).slice(0, 10).split('-');
    if (p.length !== 3) return iso;
    var y = parseInt(p[0], 10);
    if (y < 2400) y += 543;
    return p[2] + '/' + p[1] + '/' + y + (time ? ' ' + time : '');
  }

  function fmtTax(id, br) {
    return escHtml(id) + (br ? ' (' + escHtml(/^\d+$/.test(br) ? 'สาขาที่ ' + br : br) + ')' : '');
  }

  function pageHTML(S, o) {
    var c = o.c, rows = o.rows, pageNo = o.pageNo, pageCount = o.pageCount, copyLabel = o.copyLabel, isLast = o.isLast, carry = o.carry, cols = o.cols, showVatCols = o.showVatCols;
    var sel = S.seller, cu = S.customer;
    var rateTxt = String(S.vatRate || '7').replace(/\.0+$/, '');
    function L(key) {
      var parts = String(S.labels[key] !== undefined ? S.labels[key] : '').replace(/\{rate\}/g, rateTxt).split('|');
      return escHtml(parts[0]) + (S.view.showEn && parts[1] ? '<small class="en">' + escHtml(parts[1]) + '</small>' : '');
    }
    function labTh(key) {
      return escHtml(String(S.labels[key] !== undefined ? S.labels[key] : '').replace(/\{rate\}/g, rateTxt).split('|')[0]);
    }
    var head = '<div class="top"><div>' +
      '<div class="sname">' + escHtml(sel.name) + '</div>' +
      (sel.nameEn ? '<div class="sname-en">' + escHtml(sel.nameEn) + '</div>' : '') +
      '<div>' + nlHtml(sel.address) + '</div>' +
      '<div>' + (sel.phone ? labTh('sellerTel') + ' ' + escHtml(sel.phone) : '') + '</div>' +
      (sel.taxId ? '<div><b>' + labTh('sellerTax') + '</b> ' + fmtTax(sel.taxId, sel.branch) + '</div>' : (sel.branch ? '<div>' + escHtml(sel.branch) + '</div>' : '')) +
      (sel.extra ? '<div>' + escHtml(sel.extra) + '</div>' : '') +
      '</div><div class="titlebox"><div class="copy">' + escHtml(copyLabel) + '</div><div class="title">' + nlHtml(S.title) + '</div>' +
      (S.view.showEn && S.titleEn ? '<div class="title-en">' + escHtml(S.titleEn) + '</div>' : '') +
      '<div class="pageno">' + labTh('page') + ' ' + pageNo + '/' + pageCount + '</div></div></div>' +
      '<div class="boxes">' +
      (S.showCustomer ? '<div class="box cust"><div class="kv">' +
        (cu.code ? '<div class="k">' + L('custCode') + '</div><div>' + escHtml(cu.code) + '</div>' : '') +
        '<div class="k">' + L('custName') + '</div><div>' + escHtml(cu.name) + '</div>' +
        '<div class="k">' + L('custTax') + '</div><div>' + fmtTax(cu.taxId, cu.branch) + '</div>' +
        '<div class="k">' + L('custAddr') + '</div><div>' + nlHtml(cu.address) + '</div>' +
        (cu.phone ? '<div class="k">' + L('custTel') + '</div><div>' + escHtml(cu.phone) + '</div>' : '') +
        '</div></div>' : '<div style="flex:1.75"></div>') +
      '<div class="box doc"><div class="kv">' +
        '<div class="k">' + L('docNo') + '</div><div class="b">' + escHtml(S.doc.no) + '</div>' +
        '<div class="k">' + L('docDate') + '</div><div>' + thaiDateFmt(S.doc.date, S.doc.time) + '</div>' +
        (S.doc.ref ? '<div class="k">' + L('docRef') + '</div><div>' + escHtml(S.doc.ref) + '</div>' : '') +
        (S.doc.credit ? '<div class="k">' + L('docCredit') + '</div><div>' + escHtml(S.doc.credit) + '</div>' : '') +
        (S.doc.sales ? '<div class="k">' + L('docSales') + '</div><div>' + escHtml(S.doc.sales) + '</div>' : '') +
      '</div></div></div>';

    var colgroup = cols.map(function (col) { return '<col style="width:' + (col.w || 'auto') + '">'; }).join('');
    var th = cols.map(function (col) { return '<th>' + L(col.key) + '</th>'; }).join('');
    var body = rows.map(function (r) {
      return '<tr class="row' + (r.kind === 'charge' ? ' charge' : '') + '">' + cols.map(function (col) { return '<td class="' + (col.cls || '') + '">' + col.v(r) + '</td>'; }).join('') + '</tr>';
    }).join('');
    var totRow = '';
    if (isLast && showVatCols) {
      var items = c.lines.concat(S.view.chargesInTable ? c.charges : []);
      var sumNet = items.reduce(function (a, r) { return a + (r.net !== undefined ? r.net : r.amt); }, 0);
      totRow = '<tr class="tot">' + cols.map(function (col) {
        if (col.key === 'colAmount') return '<td class="r">' + moneyFmt(sumNet) + '</td>';
        if (col.key === 'colBase') return '<td class="r">' + moneyFmt(c.base) + '</td>';
        if (col.key === 'colVat') return '<td class="r">' + moneyFmt(c.vat) + '</td>';
        if (col.key === 'colName') return '<td class="r">' + labTh('sumLineTotal') + '</td>';
        return '<td></td>';
      }).join('') + '</tr>';
    }
    var table = '<div class="tablewrap"><table class="items"><colgroup>' + colgroup + '</colgroup><thead><tr>' + th + '</tr></thead>' +
      '<tbody>' + body + '<tr class="fill">' + cols.map(function () { return '<td></td>'; }).join('') + '</tr>' + totRow + '</tbody></table></div>';
    if (!isLast) {
      return '<div class="page">' + head + table + '<div class="carry"><span>' + labTh('continued') + '</span><span>' + L('carry') + ' &nbsp; ' + moneyFmt(carry) + '</span></div>' +
        '<div class="foot"><span></span><span>' + labTh('page') + ' ' + pageNo + '/' + pageCount + '</span></div>' +
        (S.view.cancelled ? '<div class="wm">' + labTh('cancelled') + '</div>' : '') + '</div>';
    }
    var inTable = S.view.chargesInTable;
    var subShown = c.subtotal + (inTable ? c.chargeTotal : 0);
    var sr = '<tr><td>' + L('sumSubtotal') + '</td><td>' + moneyFmt(subShown) + '</td></tr>' +
      '<tr><td>' + L('sumDiscount') + (String(S.billDiscount).trim().endsWith('%') ? ' (' + escHtml(String(S.billDiscount).trim()) + ')' : '') + '</td><td>' + moneyFmt(c.billDisc) + '</td></tr>';
    if (!inTable) c.charges.forEach(function (ch) { sr += '<tr><td>' + escHtml(ch.label) + '</td><td>' + moneyFmt(ch.amt) + '</td></tr>'; });
    if (c.mode !== 'NONE') sr += '<tr><td>' + L('sumBase') + '</td><td>' + moneyFmt(c.base) + '</td></tr><tr><td>' + L('sumVat') + '</td><td>' + moneyFmt(c.vat) + '</td></tr>';
    sr += '<tr class="grand"><td>' + L('sumGrand') + '</td><td>' + moneyFmt(c.grand) + '</td></tr>';
    var note = { INCL: 'noteIncl', EXCL: 'noteExcl', NONE: 'noteNone' }[c.mode];
    var terms = String(S.terms || '').split('\n').filter(function (x) { return x.trim(); });
    var left = (S.view.showWords ? '<div class="words">(' + bahtText(c.grand) + ')</div>' : '') +
      (labTh(note) ? '<div class="note">' + labTh(note) + '</div>' : '') +
      (showVatCols && c.billDisc ? '<div class="muted">' + labTh('noteAlloc') + '</div>' : '') +
      (S.remarks ? '<div><b>' + labTh('remarks') + ':</b> ' + nlHtml(S.remarks) + '</div>' : '') +
      (terms.length ? '<ol class="terms">' + terms.map(function (t) { return '<li>' + escHtml(t) + '</li>'; }).join('') + '</ol>' : '') +
      (S.view.showEoe ? '<div class="eoe" style="margin-top:auto">' + labTh('eoe') + '</div>' : '');
    var methods = String(S.payment.methods || '').split(',').map(function (x) { return x.trim(); }).filter(Boolean);
    var pay = S.view.showPayment ? '<div class="payment"><b>' + labTh('payment') + (S.view.showEn && S.labels.payment.includes('|') ? ' / ' + escHtml(S.labels.payment.split('|')[1]) : '') + ':</b>' +
      methods.map(function (m) { return '<span>' + (m === String(S.payment.selected).trim() ? '☑' : '☐') + ' ' + escHtml(m) + '</span>'; }).join('') +
      '<span>' + labTh('paymentDetail') + '</span><span class="dots">' + escHtml(S.payment.detail) + '</span></div>' : '';
    var signs = S.view.showSigns ? '<div class="signs">' + String(S.signatures || '').split('\n').filter(function (x) { return x.trim(); }).map(function (line) {
      var p = line.split('|').map(function (x) { return x.trim().replace(/\{seller\}/g, S.seller.name); });
      return '<div class="sign"><div class="t">' + escHtml(p[0] || '') + '</div><div class="d">' + escHtml(p[1] || '') + '</div>' +
        '<div class="ln">..................................................<br>' + escHtml(p[2] || '') + '<br>วันที่ ......../......../........</div></div>';
    }).join('') + '</div>' : '';
    return '<div class="page">' + head + table +
      '<div class="summary"><div class="sumleft">' + left + '</div><div class="sumright"><table>' + sr + '</table></div></div>' +
      pay + signs +
      '<div class="foot"><span>' + escHtml(S.doc.no) + '</span><span>' + labTh('page') + ' ' + pageNo + '/' + pageCount + '</span></div>' +
      (S.view.cancelled ? '<div class="wm">' + labTh('cancelled') + '</div>' : '') + '</div>';
  }

  function renderAllPagesHtml(S) {
    var c = calcInvoice(S);
    var showVatCols = S.showLineVat && c.mode !== 'NONE';
    var cols = [
      { key: 'colNo', w: '10mm', cls: 'c', v: function (r) { return r.no !== undefined ? r.no : ''; } },
      S.view.showCode && { key: 'colCode', w: '24mm', v: function (r) { return escHtml(r.code || ''); } },
      { key: 'colName', v: function (r) { return nlHtml(r.name); } },
      { key: 'colQty', w: '15mm', cls: 'r', v: function (r) { return r.kind === 'charge' ? '' : qtyFmt(r.q); } },
      { key: 'colUnit', w: '14mm', cls: 'c', v: function (r) { return escHtml(r.unit || ''); } },
      { key: 'colPrice', w: '21mm', cls: 'r', v: function (r) { return r.kind === 'charge' ? '' : moneyFmt(r.p); } },
      S.view.showDiscCol && {
        key: 'colDisc', w: '17mm', cls: 'r', v: function (r) {
          if (r.kind === 'charge' || !r.disc) return '';
          return moneyFmt(r.disc) + (String(r.discRaw).trim().endsWith('%') ? '<div class="muted">(' + escHtml(String(r.discRaw).trim()) + ')</div>' : '');
        }
      },
      { key: 'colAmount', w: '23mm', cls: 'r b', v: function (r) { return moneyFmt(r.kind === 'charge' ? r.amt : r.net); } },
      showVatCols && { key: 'colBase', w: '22mm', cls: 'r', v: function (r) { return moneyFmt(r.lb); } },
      showVatCols && { key: 'colVat', w: '17mm', cls: 'r', v: function (r) { return moneyFmt(r.lv); } }
    ].filter(Boolean);
    var rows = c.lines.map(function (l, i) { return Object.assign({}, l, { no: i + 1, kind: 'item' }); });
    if (S.view.chargesInTable) c.charges.forEach(function (ch) { rows.push(Object.assign({}, ch, { name: ch.label, kind: 'charge' })); });
    var per = Math.max(3, Math.min(60, parseInt(S.view.rowsPerPage, 10) || 18));
    var chunks = [];
    for (var i = 0; i < rows.length; i += per) chunks.push(rows.slice(i, i + per));
    if (!chunks.length) chunks.push([]);
    var copies = S.copyMode === 'BOTH' ? [S.copyLabels.original, S.copyLabels.copy] : [S.copyMode === 'COPY' ? S.copyLabels.copy : S.copyLabels.original];
    var html = '';
    copies.forEach(function (cp) {
      var run = 0;
      chunks.forEach(function (ch, idx) {
        run += ch.reduce(function (a, r) { return a + (r.kind === 'charge' ? r.amt : r.net); }, 0);
        html += pageHTML(S, { c: c, rows: ch, pageNo: idx + 1, pageCount: chunks.length, copyLabel: cp, isLast: idx === chunks.length - 1, carry: run, cols: cols, showVatCols: showVatCols });
      });
    });
    return { html: html, calc: c, pagesCount: chunks.length };
  }

  function getInvoiceWarnings(S, c, cachedProducts) {
    var w = [], t = S.title || '';
    var isTax = /ใบกำกับภาษี/.test(t), abb = /อย่างย่อ/.test(t);
    if (isTax && !S.seller.taxId) w.push('ใบกำกับภาษีต้องมีเลขประจำตัวผู้เสียภาษีของผู้ขาย (ตั้งค่าในเมนู ตั้งค่า/ฟอร์มบิล)');
    if (isTax && c.mode === 'NONE') w.push('ใบกำกับภาษีต้องมี VAT — เลือกโหมด "ราคารวม VAT" หรือ "ราคาไม่รวม VAT"');
    if (isTax && !abb && (!S.showCustomer || !S.customer.name || !S.customer.address)) {
      w.push('ใบกำกับภาษีเต็มรูปต้องมีชื่อและที่อยู่ผู้ซื้อ (และเลขผู้เสียภาษี+สาขา ถ้าผู้ซื้อจด VAT)');
    }
    if (abb && c.mode === 'EXCL') w.push('ใบกำกับภาษีอย่างย่อ ต้องระบุราคาที่รวม VAT แล้ว (ม.86/6) — แนะนำโหมด "ราคารวม VAT"');
    if (!isTax && c.mode !== 'NONE' && S.docType === 'RC') w.push('เอกสารนี้ไม่ใช่ใบกำกับภาษี — ถ้าจด VAT แล้วควรเลือกหัวข้อที่มีคำว่าใบกำกับภาษี');
    if (!c.lines.length) w.push('ยังไม่มีรายการสินค้า');

    // แจ้งเตือนหากเลือกสินค้าที่ประเภทภาษีไม่ตรงกับโหมดบิล (จุดบกพร่องข้อ 7)
    if (cachedProducts && cachedProducts.length) {
      var prodMap = {};
      for (var i = 0; i < cachedProducts.length; i++) prodMap[cachedProducts[i][0]] = cachedProducts[i];
      (S.items || []).forEach(function (it) {
        var p = prodMap[it.code];
        if (!p) return;
        var vt = String(p[6] || 'VAT').toUpperCase();
        if (c.mode === 'NONE' && vt === 'VAT') w.push('สินค้า "' + it.name + '" มีประเภทภาษี VAT แต่บิลนี้ตั้งเป็น "ไม่มี VAT"');
        if (c.mode !== 'NONE' && /ยกเว้น|EXEMPT|NONE/.test(vt)) w.push('สินค้า "' + it.name + '" เป็นสินค้ายกเว้น VAT แต่บิลนี้คิด VAT');
      });
    }
    return w;
  }

  var api = {
    DOC_TYPES: DOC_TYPES,
    DEFAULT_LABELS: DEFAULT_LABELS,
    LABEL_NAMES: LABEL_NAMES,
    blankItem: blankItem,
    defaults: defaults,
    parseFixed: parseFixed,
    roundDiv: roundDiv,
    discAmount: discAmount,
    largestIndex: largestIndex,
    calcInvoice: calcInvoice,
    bahtText: bahtText,
    moneyFmt: moneyFmt,
    qtyFmt: qtyFmt,
    pageHTML: pageHTML,
    renderAllPagesHtml: renderAllPagesHtml,
    getInvoiceWarnings: getInvoiceWarnings
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    root.TLInvoiceCore = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
