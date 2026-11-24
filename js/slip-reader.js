// TeamLedger v3.1 — Client-Side Slip & MiniQR Reader (ฟรี 0 บาท, ประมวลผลในเครื่อง 100%)
window.TLSlipReader = (function () {
  var THAI_BANKS = {
    '002': 'ธ.กรุงเทพ (BBL)',
    '004': 'ธ.กสิกรไทย (KBank)',
    '006': 'ธ.กรุงไทย (KTB)',
    '011': 'ธ.ทหารไทยธนชาต (ttb)',
    '014': 'ธ.ไทยพาณิชย์ (SCB)',
    '022': 'ธ.ซีไอเอ็มบี (CIMB)',
    '024': 'ธ.ยูโอบี (UOB)',
    '025': 'ธ.กรุงศรีอยุธยา (BAY)',
    '030': 'ธ.ออมสิน (GSB)',
    '033': 'ธ.อาคารสงเคราะห์ (GHB)',
    '034': 'ธ.ก.ส. (BAAC)',
    '067': 'ธ.ทิสโก้ (TISCO)',
    '069': 'ธ.เกียรตินาคินภัทร (KKP)',
    '070': 'ธ.ไอซีบีซี (ICBC)',
    '071': 'ธ.ไทยเครดิต'
  };

  var THAI_MONTHS = {
    'ม.ค.': '01', 'มกราคม': '01',
    'ก.พ.': '02', 'กุมภาพันธ์': '02',
    'มี.ค.': '03', 'มีนาคม': '03',
    'เม.ย.': '04', 'เมษายน': '04',
    'พ.ค.': '05', 'พฤษภาคม': '05',
    'มิ.ย.': '06', 'มิถุนายน': '06',
    'ก.ค.': '07', 'กรกฎาคม': '07',
    'ส.ค.': '08', 'สิงหาคม': '08',
    'ก.ย.': '09', 'กันยายน': '09',
    'ต.ค.': '10', 'ตุลาคม': '10',
    'พ.ย.': '11', 'พฤศจิกายน': '11',
    'ธ.ค.': '12', 'ธันวาคม': '12'
  };

  var jsQrPromise = null;
  var tesseractPromise = null;

  function loadScriptOnce(url, globalCheck) {
    if (globalCheck()) return Promise.resolve();
    return new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = url;
      s.async = true;
      s.onload = function () { resolve(); };
      s.onerror = function () { reject(new Error('โหลดตัวช่วยอ่านสลิปไม่สำเร็จ (โปรดตรวจอินเทอร์เน็ต)')); };
      document.head.appendChild(s);
    });
  }

  function ensureJsQR() {
    if (window.jsQR) return Promise.resolve(window.jsQR);
    if (!jsQrPromise) {
      jsQrPromise = loadScriptOnce(
        'https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.min.js',
        function () { return !!window.jsQR; }
      ).then(function () { return window.jsQR; }).catch(function (e) { jsQrPromise = null; throw e; });
    }
    return jsQrPromise;
  }

  function ensureTesseract() {
    if (window.Tesseract) return Promise.resolve(window.Tesseract);
    if (!tesseractPromise) {
      tesseractPromise = loadScriptOnce(
        'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js',
        function () { return !!window.Tesseract; }
      ).then(function () { return window.Tesseract; }).catch(function (e) { tesseractPromise = null; throw e; });
    }
    return tesseractPromise;
  }

  function loadImageElement(src) {
    return new Promise(function (resolve, reject) {
      var img = new Image();
      img.onload = function () { resolve(img); };
      img.onerror = function () { reject(new Error('ไม่สามารถอ่านไฟล์รูปภาพได้')); };
      img.src = src;
    });
  }

  function parseTlv(str) {
    var out = {};
    var i = 0;
    while (i + 4 <= str.length) {
      var tag = str.slice(i, i + 2);
      var lenStr = str.slice(i + 2, i + 4);
      if (!/^\d{2}$/.test(lenStr)) break;
      var len = parseInt(lenStr, 10);
      var val = str.slice(i + 4, i + 4 + len);
      if (val.length < len) break;
      out[tag] = val;
      i += 4 + len;
    }
    return out;
  }

  function parseEmvSlipQr(raw) {
    var s = String(raw || '').trim();
    if (!s || s.length < 16) return null;
    var root = parseTlv(s);
    var res = { raw: s, amount: '', bankCode: '', bankName: '', ref: '', kind: '' };

    // Bank MiniQR (e-Slip): มักขึ้นต้นด้วย 004100060000010103... (Tag 00 มี Tag ย่อย 00=API, 01=BankCode, 02=TxnRef)
    if (root['00'] && root['00'].indexOf('000001') !== -1 && root['00'].length > 10) {
      res.kind = 'BANK_MINIQR';
      var sub = parseTlv(root['00']);
      if (sub['01']) {
        res.bankCode = sub['01'];
        res.bankName = THAI_BANKS[sub['01']] || ('ธนาคารรหัส ' + sub['01']);
      }
      if (sub['02']) res.ref = sub['02'];
    } else if (root['00'] === '01' || root['54'] || root['29'] || root['30']) {
      res.kind = 'PROMPTPAY_QR';
      if (root['54'] && /^\d+(\.\d{1,2})?$/.test(root['54'])) {
        var n = parseFloat(root['54']);
        if (n > 0) res.amount = n.toFixed(2);
      }
    } else {
      return null;
    }
    return res;
  }

  async function detectQrOnCanvas(canvas) {
    if (typeof window.BarcodeDetector === 'function') {
      try {
        var det = new window.BarcodeDetector({ formats: ['qr_code'] });
        var codes = await det.detect(canvas);
        if (codes && codes.length && codes[0].rawValue) return codes[0].rawValue;
      } catch (e) {}
    }
    try {
      var jsQR = await ensureJsQR();
      if (jsQR) {
        var ctx = canvas.getContext('2d');
        var imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        var hit = jsQR(imgData.data, imgData.width, imgData.height, { inversionAttempts: 'attemptBoth' });
        if (hit && hit.data) return hit.data;
      }
    } catch (e) {}
    return '';
  }

  async function scanQrFromDataUrl(dataUrl) {
    var img = await loadImageElement(dataUrl);
    var c = document.createElement('canvas');
    var maxSide = 1400;
    var scale = Math.min(1, maxSide / Math.max(img.width, img.height));
    c.width = Math.max(1, Math.round(img.width * scale));
    c.height = Math.max(1, Math.round(img.height * scale));
    var ctx = c.getContext('2d');
    ctx.drawImage(img, 0, 0, c.width, c.height);

    // 1) สแกนทั้งภาพ
    var qrRaw = await detectQrOnCanvas(c);
    if (qrRaw) return parseEmvSlipQr(qrRaw);

    // 2) สแกนครึ่งล่าง (QR บนสลิปไทยมักอยู่มุมล่างขวา/ล่างกลางและมีขนาดเล็ก)
    var crops = [
      { x: Math.floor(c.width * 0.4), y: Math.floor(c.height * 0.45), w: Math.ceil(c.width * 0.6), h: Math.ceil(c.height * 0.55) },
      { x: 0, y: Math.floor(c.height * 0.5), w: c.width, h: Math.ceil(c.height * 0.5) }
    ];
    for (var i = 0; i < crops.length; i++) {
      var cr = crops[i];
      if (cr.w < 40 || cr.h < 40) continue;
      var subCanvas = document.createElement('canvas');
      subCanvas.width = cr.w;
      subCanvas.height = cr.h;
      subCanvas.getContext('2d').drawImage(c, cr.x, cr.y, cr.w, cr.h, 0, 0, cr.w, cr.h);
      qrRaw = await detectQrOnCanvas(subCanvas);
      if (qrRaw) return parseEmvSlipQr(qrRaw);
    }
    return null;
  }

  function toCeIsoDate(day, monthNum, yearNum) {
    var y = parseInt(yearNum, 10);
    if (isNaN(y)) return '';
    if (y < 100) y += 2500; // เช่น 69 -> 2569
    if (y >= 2400) y -= 543;
    if (y < 2000 || y > 2100) return '';
    var d = ('0' + parseInt(day, 10)).slice(-2);
    var m = ('0' + parseInt(monthNum, 10)).slice(-2);
    return y + '-' + m + '-' + d;
  }

  function extractFieldsFromOcrText(text) {
    var raw = String(text || '');
    var cleaned = raw.replace(/[฿]/g, ' THB ').replace(/[|]/g, ' ');
    var amount = '';

    // 1) จับจากคำสำคัญบนสลิปไทยและใบเสร็จ (จำนวนเงิน / ยอดโอน / Total / บาท / THB)
    var lines = cleaned.split(/\r?\n/);
    for (var i = 0; i < lines.length; i++) {
      var ln = lines[i];
      if (/ยอดคงเหลือ|balance/i.test(ln)) continue;
      var m1 = ln.match(/(?:จำนวน(?:เงิน)?|ยอด(?:เงิน|โอน|ชำระ|สุทธิ|รวม)|total|amount)\D{0,24}([\d,]{1,12}\.\d{2})/i);
      if (m1) {
        var n1 = parseFloat(m1[1].replace(/,/g, ''));
        if (n1 > 0 && n1 < 50000000) { amount = n1.toFixed(2); break; }
      }
      var m2 = ln.match(/([\d,]{1,12}\.\d{2})\s*(?:บาท|thb|bht)/i);
      if (m2) {
        var n2 = parseFloat(m2[1].replace(/,/g, ''));
        if (n2 > 0 && n2 < 50000000) { amount = n2.toFixed(2); break; }
      }
    }

    // 2) Fallback: หาเลขทศนิยม 2 ตำแหน่งที่เป็นไปได้มากสุด (ข้ามค่าธรรมเนียม 0.00)
    if (!amount) {
      var matches = cleaned.match(/\b\d{1,3}(?:,\d{3})*\.\d{2}\b|\b\d{1,7}\.\d{2}\b/g) || [];
      var best = 0;
      for (var k = 0; k < matches.length; k++) {
        var val = parseFloat(matches[k].replace(/,/g, ''));
        if (!isNaN(val) && val > 0 && val < 10000000 && val > best) {
          best = val;
        }
      }
      if (best > 0) amount = best.toFixed(2);
    }

    // 3) หาวันที่ (ทั้งแบบ 24/11/2569 และ 24 พ.ย. 69)
    var billDate = '';
    var dNumeric = cleaned.match(/\b([0-3]?\d)[\/\-]([01]?\d)[\/\-](25\d{2}|20\d{2}|\d{2})\b/);
    if (dNumeric) {
      billDate = toCeIsoDate(dNumeric[1], dNumeric[2], dNumeric[3]);
    } else {
      var monthKeys = Object.keys(THAI_MONTHS).sort(function (a, b) { return b.length - a.length; });
      var rx = new RegExp('\\b([0-3]?\\d)\\s*(' + monthKeys.map(function (m) { return m.replace(/\./g, '\\.'); }).join('|') + ')\\s*(25\\d{2}|\\d{2})\\b');
      var dThai = cleaned.match(rx);
      if (dThai && THAI_MONTHS[dThai[2]]) {
        billDate = toCeIsoDate(dThai[1], THAI_MONTHS[dThai[2]], dThai[3]);
      }
    }

    return { amount: amount, billDate: billDate, rawText: raw };
  }

  async function runOcr(dataUrl, onProgress) {
    var Tesseract = await ensureTesseract();
    if (onProgress) onProgress('กำลังเตรียมตัวอ่านตัวเลข (ครั้งแรกอาจรอสักครู่)...');
    var result = await Tesseract.recognize(dataUrl, 'tha+eng', {
      logger: function (m) {
        if (onProgress && m && m.status === 'recognizing text') {
          onProgress('กำลังอ่านสลิป ' + Math.round((m.progress || 0) * 100) + '%...');
        }
      }
    });
    var parsed = extractFieldsFromOcrText((result && result.data && result.data.text) || '');
    return parsed;
  }

  async function readSlip(dataUrl, opts) {
    opts = opts || {};
    var qrInfo = null;
    try {
      qrInfo = await scanQrFromDataUrl(dataUrl);
    } catch (e) {}

    var amount = qrInfo && qrInfo.amount ? qrInfo.amount : '';
    var billDate = '';
    var ocrText = '';
    var source = qrInfo ? qrInfo.kind : 'NONE';

    if (opts.runOcr) {
      var ocr = await runOcr(dataUrl, opts.onProgress);
      ocrText = ocr.rawText || '';
      if (!amount && ocr.amount) amount = ocr.amount;
      if (ocr.billDate) billDate = ocr.billDate;
      source = qrInfo ? (qrInfo.kind + '+OCR') : 'OCR';
    }

    return {
      amount: amount,
      billDate: billDate,
      bankName: (qrInfo && qrInfo.bankName) || '',
      ref: (qrInfo && qrInfo.ref) || '',
      source: source,
      hasMiniQr: !!(qrInfo && qrInfo.kind === 'BANK_MINIQR'),
      ocrText: ocrText
    };
  }

  return {
    readSlip: readSlip,
    parseEmvSlipQr: parseEmvSlipQr,
    extractFieldsFromOcrText: extractFieldsFromOcrText
  };
})();
