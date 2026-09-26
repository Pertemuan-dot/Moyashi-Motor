window.MMApi = (() => {
  let requestSeq = 0;
  const pending = new Map();

  function call(action, payload = {}) {
    return new Promise((resolve, reject) => {
      if (!window.APP_CONFIG?.BRIDGE_URL) {
        reject(new Error("BRIDGE_URL belum diisi di config.js"));
        return;
      }
      const iframe = document.getElementById("mmBridgeFrame");
      if (!iframe) {
        reject(new Error("Bridge belum siap."));
        return;
      }
      const id = `mm_${Date.now()}_${++requestSeq}`;
      pending.set(id, { resolve, reject });
      iframe.contentWindow.postMessage({ source: "moyashi-motor", id, action, payload }, "*");
      setTimeout(() => {
        if (pending.has(id)) {
          pending.delete(id);
          reject(new Error("Permintaan ke server timeout."));
        }
      }, 30000);
    });
  }

  window.addEventListener("message", event => {
    const data = event.data;
    if (!data || data.source !== "moyashi-motor-bridge") return;
    const item = pending.get(data.id);
    if (!item) return;
    pending.delete(data.id);
    if (data.ok) item.resolve(data.result);
    else item.reject(new Error(data.error || "Server error"));
  });

  function mountBridge() {
    const existing = document.getElementById("mmBridgeFrame");
    if (existing) return existing._mmReady || Promise.resolve(existing);
    const iframe = document.createElement("iframe");
    iframe.id = "mmBridgeFrame";
    iframe.title = "Moyashi Motor API bridge";
    iframe.src = `${window.APP_CONFIG.BRIDGE_URL}${window.APP_CONFIG.BRIDGE_URL.includes("?") ? "&" : "?"}bridge=1`;
    iframe.style.display = "none";
    const ready = new Promise((resolve, reject) => {
      iframe.onload = () => resolve(iframe);
      iframe.onerror = () => reject(new Error("Bridge Google Apps Script gagal dimuat."));
    });
    iframe._mmReady = ready;
    document.body.appendChild(iframe);
    return ready;
  }
  return { call, mountBridge };
})();