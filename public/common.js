// Small helpers shared by every page.
window.$ = (id) => document.getElementById(id);

window.api = async function (path, opts) {
  const o = opts || {};
  const headers = { 'Content-Type': 'application/json' };
  if (o.token) headers.Authorization = 'Bearer ' + o.token;
  const r = await fetch(path, {
    method: o.method || 'GET',
    headers,
    body: o.body ? JSON.stringify(o.body) : undefined,
  });
  let data = {};
  try { data = await r.json(); } catch (e) { /* ignore */ }
  if (!r.ok) {
    const err = new Error(data.error || 'Something went wrong.');
    err.status = r.status;
    throw err;
  }
  return data;
};

// Instagram, Snapchat, TikTok and similar in-app browsers often block the camera.
window.inAppBrowser = function () {
  return /Instagram|FBAN|FBAV|FB_IAB|Snapchat|TikTok|musical_ly|Line\/|MicroMessenger|Twitter/i.test(navigator.userAgent);
};

window.showInAppBanner = function (el) {
  if (!window.inAppBrowser() || !el) return;
  el.classList.remove('hidden');
  el.innerHTML = 'This looks like an in-app browser, and the camera may be blocked here. Tap the menu (three dots or the share icon) and choose <b>Open in Safari</b> or <b>Open in Chrome</b>.';
};
