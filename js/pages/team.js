// TeamLedger v3.1 — จัดการทีมงาน (อนุมัติ/ปิดสิทธิ์/สิทธิ์ออกบิล) & ติดตั้ง Rich Menu (OWNER)
window.TLPages = window.TLPages || {};

window.TLPages.team = async function (container) {
  var esc = TLUtils.esc;
  if (TLApi.state.user.role !== 'OWNER') {
    container.innerHTML = '<div class="card center-box"><h2>🔒 เฉพาะหัวหน้า (OWNER)</h2></div>';
    return;
  }

  var users = [];
  async function loadData(forceSpinner) {
    var cached = TLApi.getCache('team');
    if (cached && !forceSpinner) {
      users = cached;
      render();
    } else {
      container.innerHTML = '<div class="card center-box"><div class="spinner"></div><p>กำลังโหลดรายชื่อทีม...</p></div>';
    }
    try {
      var res = await TLApi.call('listUsers', {});
      var fresh = res.users || [];
      TLApi.setCache('team', fresh);
      var changed = !cached || JSON.stringify(fresh) !== JSON.stringify(users);
      users = fresh;
      if (TLApi.state.currentPage === 'team' && (forceSpinner || !cached || changed)) {
        render();
      }
    } catch (e) {
      if (!cached) container.innerHTML = '<div class="card"><div class="warn-box">' + esc(e.message) + '</div></div>';
    }
  }

  function render() {
    var listHtml = users.map(function (u) {
      var isPending = u.role === 'PENDING' || u.activeRaw === 'PENDING';
      var isSelf = u.userId === TLApi.state.user.userId;
      return '<div class="list-item" style="flex-direction:column">' +
        '<div style="width:100%;display:flex;justify-content:space-between;align-items:center">' +
          '<div><b>' + esc(u.name) + '</b> <span class="badge">' + esc(u.userId) + '</span> ' +
            '<span class="badge ' + (isPending ? 'warn' : (u.active ? 'ok' : 'danger')) + '">' +
              (isPending ? 'รออนุมัติ' : (u.active ? u.role : 'ปิดใช้งาน')) +
            '</span>' +
            '<div class="hint">สิทธิ์ออกบิล: ' + (u.canIssueInvoice ? '✅ เปิด' : '❌ ปิด') + '</div>' +
          '</div>' +
        '</div>' +
        (!isSelf
          ? '<div class="btns" style="margin:6px 0 0">' +
              (isPending
                ? '<button type="button" class="btn sm pri" data-act="approve" data-uid="' + esc(u.userId) + '">✅ อนุมัติเป็น STAFF</button>'
                : '<button type="button" class="btn sm outline" data-act="toggleActive" data-uid="' + esc(u.userId) + '">' + (u.active ? '🚫 ปิดใช้งาน' : '✅ เปิดใช้งาน') + '</button>' +
                  '<button type="button" class="btn sm outline" data-act="toggleInv" data-uid="' + esc(u.userId) + '">' + (u.canIssueInvoice ? 'ปิดสิทธิ์ออกบิล' : 'เปิดสิทธิ์ออกบิล') + '</button>' +
                  '<button type="button" class="btn sm outline" data-act="toggleRole" data-uid="' + esc(u.userId) + '">' + (u.role === 'OWNER' ? 'ปรับเป็น STAFF' : 'ปรับเป็น OWNER') + '</button>') +
            '</div>'
          : '<div class="hint">(บัญชีของคุณเอง)</div>') +
      '</div>';
    }).join('');

    container.innerHTML =
      '<div class="card">' +
        '<h2>👨‍👩‍👧‍👦 จัดการทีมงาน (' + users.length + ' คน)</h2>' +
        listHtml +
      '</div>' +
      '<div class="card">' +
        '<h3>🎨 ติดตั้ง Rich Menu 2 ชุด (STAFF Default + OWNER Per-user)</h3>' +
        '<p class="hint">อัปโหลดไฟล์ <code>richmenu_staff.png</code> และ <code>richmenu_owner.png</code> ขนาด 2500×1686 เพื่อผูกเมนู LINE OA อัตโนมัติ</p>' +
        '<label class="f">รูป Rich Menu ชุดลูกทีม (STAFF)</label><input type="file" id="rm-staff-file" accept="image/png">' +
        '<label class="f">รูป Rich Menu ชุดหัวหน้า (OWNER)</label><input type="file" id="rm-owner-file" accept="image/png">' +
        '<div class="btns" style="margin-top:10px"><button type="button" class="btn pri full" id="btn-setup-richmenu">🚀 อัปโหลดและเปิดใช้ Rich Menu</button></div>' +
      '</div>';

    container.querySelectorAll('[data-act]').forEach(function (b) {
      b.onclick = async function () {
        var uid = b.dataset.uid;
        var act = b.dataset.act;
        var u = users.find(function (x) { return x.userId === uid; });
        if (!u) return;
        var payload = { userId: uid };
        if (act === 'approve') { payload.role = 'STAFF'; payload.active = true; payload.canIssueInvoice = false; }
        else if (act === 'toggleActive') { payload.active = !u.active; }
        else if (act === 'toggleInv') { payload.canIssueInvoice = !u.canIssueInvoice; }
        else if (act === 'toggleRole') { payload.role = u.role === 'OWNER' ? 'STAFF' : 'OWNER'; payload.active = true; }
        try {
          await TLApi.call('updateUser', payload);
          TLUtils.showToast('อัปเดตสิทธิ์แล้ว', 'ok');
          loadData();
        } catch (e) { TLUtils.showToast(e.message, 'err'); }
      };
    });

    document.getElementById('btn-setup-richmenu').onclick = async function () {
      var sf = document.getElementById('rm-staff-file').files[0];
      var of = document.getElementById('rm-owner-file').files[0];
      var toB64 = function (file) {
        return new Promise(function (resolve, reject) {
          var rd = new FileReader();
          rd.onload = function () { resolve(rd.result); };
          rd.onerror = reject;
          rd.readAsDataURL(file);
        });
      };
      this.disabled = true;
      this.textContent = 'กำลังอัปโหลดและผูก Rich Menu...';
      try {
        var pl = { liffId: (window.TL_CONFIG && window.TL_CONFIG.LIFF_ID) || '' };
        if (sf) pl.staffImageBase64 = await toB64(sf);
        if (of) pl.ownerImageBase64 = await toB64(of);
        await TLApi.call('setupRichMenusApi', pl);
        TLUtils.showToast('ติดตั้ง Rich Menu ทั้ง 2 ชุดเรียบร้อยแล้ว!', 'ok');
      } catch (e) { TLUtils.showToast(e.message, 'err'); }
      this.disabled = false;
      this.textContent = '🚀 อัปโหลดและเปิดใช้ Rich Menu';
    };
  }

  loadData();
};
