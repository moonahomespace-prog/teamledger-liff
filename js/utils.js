// TeamLedger v3.1 — Client Utilities (Escape XSS, Image Compression <canvas>, Blob PDF, LIFF helpers)
window.TLUtils = (function () {
  function esc(s) {
    return String(s === null || s === undefined ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function nl(s) {
    return esc(s).replace(/\n/g, '<br>');
  }

  function money(st) {
    return (Number(st || 0) / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function moneyBaht(b) {
    return Number(b || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function todayISO() {
    var d = new Date();
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 10);
  }

  function currentMonthKey() {
    return todayISO().slice(0, 7);
  }

  function thaiDate(iso, time) {
    if (!iso) return '';
    var p = String(iso).slice(0, 10).split('-');
    if (p.length !== 3) return iso;
    var y = parseInt(p[0], 10);
    if (y < 2400) y += 543;
    return p[2] + '/' + p[1] + '/' + y + (time ? ' ' + time : '');
  }

  function showToast(msg, type) {
    var el = document.getElementById('toast');
    if (!el) return;
    el.textContent = msg;
    el.className = 'toast ' + (type || '');
    el.hidden = false;
    clearTimeout(el._timer);
    el._timer = setTimeout(function () { el.hidden = true; }, 3200);
  }

  function showModal(title, html) {
    document.getElementById('modal-title').textContent = title;
    document.getElementById('modal-body').innerHTML = html;
    document.getElementById('modal-root').hidden = false;
  }

  function closeModal() {
    document.getElementById('modal-root').hidden = true;
    document.getElementById('modal-body').innerHTML = '';
  }

  // ย่อรูปฝั่ง client ด้วย <canvas> ≤1600px JPEG quality 0.75 (~150-300 KB)
  function compressImage(file, maxDim, quality) {
    maxDim = maxDim || 1600;
    quality = quality || 0.75;
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onerror = function () { reject(new Error('อ่านไฟล์รูปไม่สำเร็จ')); };
      reader.onload = function (ev) {
        var img = new Image();
        img.onerror = function () { reject(new Error('ไฟล์ไม่ใช่รูปภาพที่รองรับ')); };
        img.onload = function () {
          var w = img.width;
          var h = img.height;
          if (w > maxDim || h > maxDim) {
            if (w >= h) {
              h = Math.round(h * maxDim / w);
              w = maxDim;
            } else {
              w = Math.round(w * maxDim / h);
              h = maxDim;
            }
          }
          var canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          var ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, w, h);
          resolve(canvas.toDataURL('image/jpeg', quality));
        };
        img.src = ev.target.result;
      };
      reader.readAsDataURL(file);
    });
  }

  // สร้าง Blob URL สำหรับดาวน์โหลด PDF/ไฟล์ (ป้องกัน WebView บล็อก data:application/pdf)
  function base64ToBlob(base64, mimeType) {
    var clean = String(base64 || '').replace(/^data:[^;]+;base64,/, '');
    var bin = atob(clean);
    var len = bin.length;
    var bytes = new Uint8Array(len);
    for (var i = 0; i < len; i++) bytes[i] = bin.charCodeAt(i);
    return new Blob([bytes], { type: mimeType || 'application/pdf' });
  }

  function downloadBase64File(base64, filename, mimeType) {
    var blob = base64ToBlob(base64, mimeType);
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 60000);
    return url;
  }

  function downloadCsvText(csvText, filename) {
    var blob = new Blob([csvText], { type: 'text/csv;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 60000);
  }

  async function scanBarcode() {
    if (window.liff && liff.isInClient() && liff.isApiAvailable('scanCodeV2')) {
      var res = await liff.scanCodeV2();
      return (res && res.value) ? String(res.value).trim() : '';
    }
    var manual = window.prompt('อุปกรณ์นี้ไม่รองรับสแกนผ่าน LINE — พิมพ์รหัสบาร์โค้ด/SKU:');
    return manual ? manual.trim() : '';
  }

  async function shareTextToLine(text) {
    if (window.liff && liff.isApiAvailable('shareTargetPicker')) {
      try {
        var r = await liff.shareTargetPicker([{ type: 'text', text: text }]);
        if (r) {
          showToast('ส่งสรุปบิลผ่าน LINE แล้ว', 'ok');
          return true;
        }
        return false;
      } catch (e) {
        // ตกลงไปใช้คัดลอกข้อความแทน
      }
    }
    try {
      await navigator.clipboard.writeText(text);
      showToast('คัดลอกข้อความสรุปบิลลงคลิปบอร์ดแล้ว (วางส่งในแชตได้เลย)', 'ok');
      return true;
    } catch (e) {
      showModal('คัดลอกสรุปบิลส่งให้ลูกค้า', '<textarea readonly style="width:100%;min-height:180px">' + esc(text) + '</textarea>');
      return false;
    }
  }

  function promptCancelReason(title) {
    return new Promise(function (resolve) {
      var presets = ['ทดสอบระบบ', 'กรอกยอด/ข้อมูลผิด', 'บันทึกรายการซ้ำ'];
      var html =
        '<p class="hint">เลือกเหตุผลด่วน หรือพิมพ์เหตุผลเอง (ระบบจะเก็บประวัติไว้ใน AuditLog โดยไม่ลบแถว)</p>' +
        '<div class="chip-group">' +
          presets.map(function (p) {
            return '<button type="button" class="chip" data-cpreset="' + esc(p) + '">' + esc(p) + '</button>';
          }).join('') +
        '</div>' +
        '<label class="f">เหตุผลการยกเลิก</label>' +
        '<input type="text" id="cancel-reason-inp" placeholder="ระบุเหตุผล...">' +
        '<div class="btns" style="margin-top:12px">' +
          '<button type="button" class="btn" style="flex:1" id="btn-cancel-dismiss">ปิด</button>' +
          '<button type="button" class="btn danger" style="flex:2" id="btn-cancel-confirm">✕ ยืนยันยกเลิก</button>' +
        '</div>';
      showModal(title || 'ยกเลิกรายการ', html);
      var inp = document.getElementById('cancel-reason-inp');
      var settled = false;
      function done(val) {
        if (settled) return;
        settled = true;
        closeModal();
        resolve(val);
      }
      document.querySelectorAll('[data-cpreset]').forEach(function (b) {
        b.onclick = function () {
          inp.value = b.dataset.cpreset;
          document.querySelectorAll('[data-cpreset]').forEach(function (x) { x.classList.remove('active'); });
          b.classList.add('active');
        };
      });
      document.getElementById('btn-cancel-dismiss').onclick = function () { done(null); };
      document.getElementById('btn-cancel-confirm').onclick = function () {
        var v = inp.value.trim();
        if (!v) return showToast('กรุณาเลือกหรือระบุเหตุผลก่อน', 'err');
        done(v);
      };
    });
  }

  var RECENT_UNITS_KEY = 'tl_recent_units_v1';
  var DEFAULT_UNITS = ['ชิ้น', 'อัน', 'คู่', 'ชุด', 'แพ็ก', 'ห่อ', 'กล่อง', 'ลัง', 'ม้วน', 'ผืน', 'หลา', 'เมตร', 'ขวด', 'แกลลอน', 'กิโลกรัม', 'กรัม', 'ใบ', 'ครั้ง', 'เที่ยว', 'เดือน'];

  function getUnitSuggestions() {
    var recent = [];
    try {
      var parsed = JSON.parse(localStorage.getItem(RECENT_UNITS_KEY) || '[]');
      if (Array.isArray(parsed)) recent = parsed;
    } catch (e) {}
    var seen = {};
    var out = [];
    recent.concat(DEFAULT_UNITS).forEach(function (u) {
      var s = String(u || '').trim();
      if (s && !seen[s]) { seen[s] = true; out.push(s); }
    });
    return out;
  }

  function saveRecentUnit(unitStr) {
    var s = String(unitStr || '').trim();
    if (!s) return;
    try {
      var prev = JSON.parse(localStorage.getItem(RECENT_UNITS_KEY) || '[]');
      if (!Array.isArray(prev)) prev = [];
      var next = [s].concat(prev.filter(function (x) { return String(x).trim() !== s; })).slice(0, 12);
      localStorage.setItem(RECENT_UNITS_KEY, JSON.stringify(next));
    } catch (e) {}
  }

  function buildUnitDatalistHtml(id) {
    return '<datalist id="' + esc(id || 'tl-unit-list') + '">' +
      getUnitSuggestions().map(function (u) { return '<option value="' + esc(u) + '">'; }).join('') +
    '</datalist>';
  }

  function openEditTxnModal(txn, onSaved) {
    if (!txn) return;
    var cats = (window.TLApi && TLApi.state && TLApi.state.categories ? TLApi.state.categories : [])
      .filter(function (c) { return c.type === (txn.type === 'รับ' ? 'รับ' : 'จ่าย'); })
      .map(function (c) { return c.category; });
    if (txn.category && cats.indexOf(txn.category) === -1) cats.unshift(txn.category);
    if (!cats.length) cats = ['อื่นๆ'];

    var isExpense = txn.type !== 'รับ';
    var canChangePayMode = isExpense && txn.status !== 'ร่าง';
    var curPayMode = txn.status === 'จ่ายแล้ว' ? 'OWNER_PAID' : 'SELF';

    var html =
      '<div class="hint" style="margin-bottom:8px">รหัส: <b>' + esc(txn.txnId) + '</b> · ประเภท: ' + esc(txn.type) + '</div>' +
      '<label class="f">วันที่ในบิล</label>' +
      '<input type="date" id="ed-bill-date" value="' + esc(txn.billDate || todayISO()) + '">' +
      '<label class="f">หมวดหมู่</label>' +
      '<select id="ed-cat">' + cats.map(function (c) {
        return '<option value="' + esc(c) + '"' + (c === txn.category ? ' selected' : '') + '>' + esc(c) + '</option>';
      }).join('') + '</select>' +
      '<label class="f">ชื่อสินค้า / รายละเอียด</label>' +
      '<input type="text" id="ed-desc" value="' + esc(txn.description || '') + '">' +
      '<div class="grid2">' +
        '<div><label class="f">จำนวน</label><input type="number" step="any" inputmode="decimal" id="ed-qty" value="' + esc(txn.qty || '') + '"></div>' +
        '<div><label class="f">หน่วย</label><input type="text" list="tl-edit-unit-list" id="ed-unit" value="' + esc(txn.unit || '') + '" placeholder="ชิ้น / แพ็ก">' + buildUnitDatalistHtml('tl-edit-unit-list') + '</div>' +
      '</div>' +
      '<div class="grid2">' +
        '<div><label class="f">ยอดเงินรวม (บาท)</label><input type="number" step="0.01" inputmode="decimal" id="ed-amt" value="' + Number(txn.amount || 0).toFixed(2) + '"></div>' +
        '<div><label class="f">คำนวณ VAT ใหม่</label><select id="ed-vat-mode">' +
          '<option value="KEEP">คงยอด VAT เดิม (' + Number(txn.vatAmount || 0).toFixed(2) + ' บ.)</option>' +
          '<option value="NONE">ไม่มี VAT (0.00 บ.)</option>' +
          '<option value="INCL">รวม VAT 7% แล้ว</option>' +
        '</select></div>' +
      '</div>' +
      '<label class="f">' + (isExpense ? 'ผู้รับเงิน / ร้านค้า' : 'รับจาก') + '</label>' +
      '<input type="text" id="ed-payee" value="' + esc(txn.payee || '') + '">' +
      (canChangePayMode
        ? '<label class="f">สถานะการจ่าย</label><select id="ed-pmode">' +
            '<option value="KEEP">คงสถานะเดิม (' + esc(txn.status) + ')</option>' +
            '<option value="SELF"' + (curPayMode === 'SELF' ? ' selected' : '') + '>รอโอน (ฉันจ่าย / ร้านค้า)</option>' +
            '<option value="OWNER_PAID"' + (curPayMode === 'OWNER_PAID' ? ' selected' : '') + '>จ่ายแล้ว (จบรายการ)</option>' +
          '</select>'
        : '') +
      '<div class="btns" style="margin-top:14px">' +
        '<button type="button" class="btn" style="flex:1" id="ed-cancel">ปิด</button>' +
        '<button type="button" class="btn pri" style="flex:2" id="ed-save">💾 บันทึกการแก้ไข</button>' +
      '</div>';

    showModal('✏️ แก้ไขรายการ', html);
    document.getElementById('ed-cancel').onclick = closeModal;
    document.getElementById('ed-save').onclick = async function () {
      var btn = this;
      var amt = parseFloat(document.getElementById('ed-amt').value || '0');
      if (isNaN(amt) || amt <= 0) return showToast('จำนวนเงินต้องมากกว่า 0', 'err');
      var vatChoice = document.getElementById('ed-vat-mode').value;
      var pmodeEl = document.getElementById('ed-pmode');
      var payload = {
        txnId: txn.txnId,
        billDate: document.getElementById('ed-bill-date').value,
        category: document.getElementById('ed-cat').value,
        description: document.getElementById('ed-desc').value.trim(),
        qty: document.getElementById('ed-qty').value.trim(),
        unit: document.getElementById('ed-unit').value.trim(),
        amount: amt.toFixed(2),
        payee: document.getElementById('ed-payee').value.trim()
      };
      if (vatChoice !== 'KEEP') payload.vatMode = vatChoice;
      if (pmodeEl && pmodeEl.value !== 'KEEP') payload.payeeMode = pmodeEl.value;

      btn.disabled = true;
      btn.textContent = 'กำลังบันทึก...';
      try {
        await window.TLApi.call('updateTransaction', payload);
        if (payload.unit) saveRecentUnit(payload.unit);
        closeModal();
        showToast('บันทึกการแก้ไขแล้ว', 'ok');
        if (typeof onSaved === 'function') onSaved();
      } catch (e) {
        showToast(e.message, 'err');
        btn.disabled = false;
        btn.textContent = '💾 บันทึกการแก้ไข';
      }
    };
  }

  function printPagesHtml(pagesHtml, fontSizePt) {
    var root = document.getElementById('print-root');
    if (!root) {
      root = document.createElement('div');
      root.id = 'print-root';
      document.body.appendChild(root);
    }
    root.style.setProperty('--fs', (parseFloat(fontSizePt) || 10.5) + 'pt');
    root.innerHTML = pagesHtml;
    window.print();
  }

  return {
    esc: esc,
    nl: nl,
    money: money,
    moneyBaht: moneyBaht,
    todayISO: todayISO,
    currentMonthKey: currentMonthKey,
    thaiDate: thaiDate,
    showToast: showToast,
    showModal: showModal,
    closeModal: closeModal,
    promptCancelReason: promptCancelReason,
    getUnitSuggestions: getUnitSuggestions,
    saveRecentUnit: saveRecentUnit,
    buildUnitDatalistHtml: buildUnitDatalistHtml,
    openEditTxnModal: openEditTxnModal,
    compressImage: compressImage,
    base64ToBlob: base64ToBlob,
    downloadBase64File: downloadBase64File,
    downloadCsvText: downloadCsvText,
    scanBarcode: scanBarcode,
    shareTextToLine: shareTextToLine,
    printPagesHtml: printPagesHtml
  };
})();
