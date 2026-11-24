// TeamLedger v3.1 — API Client (text/plain เลี่ยง CORS preflight บน GAS)
window.TLApi = (function () {
  var state = {
    idToken: '',
    session: null,
    user: null,
    categories: [],
    invoiceSettings: null,
    currentPage: 'expense'
  };

  function getApiUrl() {
    return (window.TL_CONFIG && window.TL_CONFIG.API_URL) || '';
  }

  async function call(action, payload) {
    var apiUrl = getApiUrl();
    if (!apiUrl || apiUrl.indexOf('YOUR_APPS_SCRIPT') !== -1) {
      throw new Error('ยังไม่ได้ตั้งค่า API_URL ในไฟล์ liff/config.js');
    }
    var resp = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({
        action: action,
        idToken: state.idToken,
        payload: payload || {}
      })
    });
    var data = await resp.json();
    if (!data || data.ok === false) {
      throw new Error((data && data.error) || 'เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์');
    }
    return data;
  }

  async function viewPrivateImage(fileId, title) {
    try {
      TLUtils.showToast('กำลังโหลดรูปภาพ...');
      var res = await call('getImage', { fileId: fileId });
      var f = res.file;
      var src = 'data:' + f.mimeType + ';base64,' + f.base64;
      TLUtils.showModal(title || 'รูปหลักฐาน', '<img src="' + src + '" style="width:100%;border-radius:10px">');
    } catch (e) {
      TLUtils.showToast(e.message, 'err');
    }
  }

  return {
    state: state,
    call: call,
    viewPrivateImage: viewPrivateImage
  };
})();
