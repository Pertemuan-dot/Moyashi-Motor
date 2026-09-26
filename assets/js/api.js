window.MMApi = (() => {
  let requestSeq = 0;
  const pending = new Map();

  function getBridge() {
    return document.getElementById("mmBridgeFrame");
  }

  function call(action, payload = {}) {
    return new Promise((resolve, reject) => {
      const bridgeUrl = window.APP_CONFIG?.BRIDGE_URL;

      if (!bridgeUrl) {
        reject(new Error("BRIDGE_URL belum diisi di config.js"));
        return;
      }

      const iframe = getBridge();

      if (!iframe || !iframe.contentWindow) {
        reject(new Error("Bridge belum siap."));
        return;
      }

      const id = `mm_${Date.now()}_${++requestSeq}`;

      pending.set(id, {
        resolve,
        reject,
        createdAt: Date.now()
      });

      try {
        iframe.contentWindow.postMessage(
          {
            source: "moyashi-motor",
            id,
            action,
            payload
          },
          "*"
        );
      } catch (err) {
        pending.delete(id);
        reject(err);
        return;
      }

      setTimeout(() => {
        if (!pending.has(id)) return;

        pending.delete(id);

        reject(
          new Error(
            "Backend tidak merespons dalam 20 detik. Periksa deployment Apps Script dan Bridge.html."
          )
        );
      }, 20000);
    });
  }

  window.addEventListener("message", event => {
    const data = event.data;

    if (!data) return;

    if (data.source !== "moyashi-motor-bridge") {
      return;
    }

    const iframe = getBridge();

    if (
      iframe &&
      iframe.contentWindow &&
      event.source !== iframe.contentWindow
    ) {
      return;
    }

    const item = pending.get(data.id);

    if (!item) return;

    pending.delete(data.id);

    if (data.ok) {
      item.resolve(data.result);
    } else {
      item.reject(
        new Error(data.error || "Server error")
      );
    }
  });

  function mountBridge() {
    const existing = getBridge();

    if (existing) {
      return existing._mmReady || Promise.resolve(existing);
    }

    const bridgeUrl = window.APP_CONFIG?.BRIDGE_URL;

    if (!bridgeUrl) {
      return Promise.reject(
        new Error("BRIDGE_URL belum diisi di config.js")
      );
    }

    const iframe = document.createElement("iframe");

    iframe.id = "mmBridgeFrame";
    iframe.title = "Moyashi Motor API Bridge";
    iframe.src =
      bridgeUrl +
      (bridgeUrl.includes("?") ? "&" : "?") +
      "bridge=1";

    iframe.style.position = "fixed";
    iframe.style.width = "1px";
    iframe.style.height = "1px";
    iframe.style.opacity = "0";
    iframe.style.pointerEvents = "none";
    iframe.style.border = "0";

    const ready = new Promise((resolve, reject) => {
      let finished = false;

      iframe.onload = () => {
        if (finished) return;

        finished = true;
        resolve(iframe);
      };

      iframe.onerror = () => {
        if (finished) return;

        finished = true;
        reject(
          new Error(
            "Bridge Google Apps Script gagal dimuat."
          )
        );
      };

      setTimeout(() => {
        if (finished) return;

        finished = true;
        reject(
          new Error(
            "Bridge terlalu lama dimuat."
          )
        );
      }, 20000);
    });

    iframe._mmReady = ready;

    document.body.appendChild(iframe);

    return ready;
  }

  return {
    call,
    mountBridge
  };
})();
