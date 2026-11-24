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
    compressImage: compressImage,
    base64ToBlob: base64ToBlob,
    downloadBase64File: downloadBase64File,
    downloadCsvText: downloadCsvText,
    scanBarcode: scanBarcode,
    shareTextToLine: shareTextToLine,
    printPagesHtml: printPagesHtml
  };
})();
