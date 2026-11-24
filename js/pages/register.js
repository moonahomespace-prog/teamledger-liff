// TeamLedger v3.1 — หน้าลงทะเบียน (OWNER คนแรกด้วย SETUP_CODE / STAFF ขออนุมัติ)
window.TLPages = window.TLPages || {};

window.TLPages.register = function (container, session) {
  var esc = TLUtils.esc;

  if (session.status === 'PENDING_APPROVAL') {
    container.innerHTML =
      '<div class="card center-box">' +
        '<h2>⏳ อยู่ระหว่างรอหัวหน้าอนุมัติ</h2>' +
        '<p class="hint">ส่งคำขอใช้งานในชื่อ <b>' + esc((session.user && session.user.name) || '') + '</b> แล้ว<br>เมื่อหัวหน้ากด "อนุมัติ" ใน LINE จะใช้งานได้ทันที</p>' +
        '<div class="btns" style="justify-content:center;margin-top:16px">' +
          '<button class="btn pri" id="btn-refresh-reg">🔄 ตรวจสอบสถานะอีกครั้ง</button>' +
        '</div>' +
      '</div>';
    document.getElementById('btn-refresh-reg').onclick = function () { location.reload(); };
    return;
  }

  if (session.status === 'INACTIVE') {
    container.innerHTML =
      '<div class="card center-box">' +
        '<h2>🚫 บัญชีถูกปิดการใช้งาน</h2>' +
        '<p class="hint">กรุณาติดต่อหัวหน้าทีม (OWNER) เพื่อเปิดใช้งานอีกครั้ง</p>' +
      '</div>';
    return;
  }

  var isFirstOwner = !session.hasOwner;
  var defName = (session.profile && session.profile.name) || '';

  container.innerHTML =
    '<div class="card">' +
      '<h2>' + (isFirstOwner ? '👑 ตั้งค่าหัวหน้าคนแรก (OWNER)' : '👋 ลงทะเบียนเข้าใช้งานทีม') + '</h2>' +
      '<p class="hint">' +
        (isFirstOwner
          ? 'ยังไม่มีหัวหน้าในระบบ กรุณากรอกรหัสตั้งค่า (SETUP_CODE) เพื่อเปิดใช้งานสิทธิ์หัวหน้าและผูกเมนูทันที'
          : 'บัญชีนี้ใช้ภายในทีมเท่านั้น กรุณายืนยันชื่อของคุณเพื่อส่งคำขอให้หัวหน้าอนุมัติใน LINE') +
      '</p>' +
      '<label class="f">ชื่อที่แสดงในระบบ (ชื่อเล่น/ชื่อจริง)</label>' +
      '<input type="text" id="reg-name" value="' + esc(defName) + '" placeholder="เช่น นุ่น, เอก">' +
      (isFirstOwner
        ? '<label class="f">รหัสตั้งค่าหัวหน้า (SETUP_CODE)</label>' +
          '<input type="text" id="reg-setup-code" placeholder="รหัสที่ตั้งไว้ใน Script Properties">'
        : '') +
      '<div class="btns" style="margin-top:16px">' +
        '<button class="btn pri full" id="btn-submit-reg">' +
          (isFirstOwner ? '✅ ยืนยันเป็นหัวหน้า (OWNER)' : '📨 ส่งคำขออนุมัติเข้าใช้งาน') +
        '</button>' +
      '</div>' +
    '</div>';

  document.getElementById('btn-submit-reg').onclick = async function () {
    var btn = this;
    var name = document.getElementById('reg-name').value.trim();
    if (!name) return TLUtils.showToast('กรุณากรอกชื่อ', 'err');
    var payload = { name: name };
    if (isFirstOwner) {
      payload.setupCode = document.getElementById('reg-setup-code').value.trim();
      if (!payload.setupCode) return TLUtils.showToast('กรุณากรอก SETUP_CODE', 'err');
    }
    btn.disabled = true;
    try {
      var res = await TLApi.call('registerUser', payload);
      TLUtils.showToast(res.status === 'ACTIVE' ? 'ตั้งค่าสำเร็จ!' : 'ส่งคำขอถึงหัวหน้าแล้ว', 'ok');
      setTimeout(function () { location.reload(); }, 800);
    } catch (e) {
      TLUtils.showToast(e.message, 'err');
      btn.disabled = false;
    }
  };
};
