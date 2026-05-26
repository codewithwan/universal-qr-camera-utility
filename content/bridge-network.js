(function () {
  if (window.__deviceSandboxNetworkBridge) return;
  window.__deviceSandboxNetworkBridge = true;

  const originalFetch = window.fetch ? window.fetch.bind(window) : null;
  const originalSendBeacon = navigator.sendBeacon ? navigator.sendBeacon.bind(navigator) : null;
  const originalXhrOpen = XMLHttpRequest.prototype.open;
  const originalXhrSend = XMLHttpRequest.prototype.send;

  let submitted = false;
  let reported = false;

  window.addEventListener("message", (event) => {
    if (event.source !== window || !event.data) return;
    if (event.data.type === "QR_IMAGE_UPLOAD_SET_IMAGE") {
      submitted = false;
      reported = false;
    }
  });

  function checkAndTriggerRestore(method, url) {
    const m = String(method || "GET").toUpperCase();
    const u = String(url || "");
    if (["GET", "HEAD", "OPTIONS"].includes(m) || !u.includes("mahasiswa/presensi")) return false;
    if (submitted) return false;
    submitted = true;
    window.postMessage({ type: "DEVICE_SANDBOX_RESTORE_CAMERA" }, "*");
    return true;
  }

  function reportScan(status, text) {
    if (reported) return;
    reported = true;
    const result = parseResponse(status, text);
    window.postMessage({ type: "QR_IMAGE_UPLOAD_SCAN_RESULT", payload: result }, "*");
  }

  function reportError(err) {
    if (reported) return;
    reported = true;
    window.postMessage({
      type: "QR_IMAGE_UPLOAD_SCAN_RESULT",
      payload: { success: false, reason: sanitize(err && err.message ? err.message : "Network error") }
    }, "*");
  }

  function parseResponse(status, text) {
    const raw = String(text || "").trim();
    let msg = "";
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        msg = findReason(parsed);
      } catch (_) {}
      if (!msg) {
        const doc = new DOMParser().parseFromString(raw, "text/html");
        msg = doc.body ? doc.body.textContent.trim() : raw;
      }
    }
    const hasErr = /gagal|error|tidak sesuai|invalid|failed|ditolak/i.test(msg);
    const success = status >= 200 && status < 400 && !hasErr;
    const finalReason = success
      ? /berhasil|success|accepted/i.test(msg) ? msg : "Presence verified successfully"
      : msg || `HTTP ${status}`;

    return { kind: "scan_result", success, reason: sanitize(finalReason) };
  }

  function findReason(obj) {
    if (!obj || typeof obj !== "object") return "";
    for (const key of ["message", "error", "reason", "status", "title"]) {
      if (typeof obj[key] === "string" && obj[key].trim()) return obj[key];
    }
    if (obj.errors && typeof obj.errors === "object") {
      const first = Object.values(obj.errors).flat().find(Boolean);
      if (first) return String(first);
    }
    for (const child of Object.values(obj)) {
      if (typeof child === "string" && child.trim()) return child;
      const nested = findReason(child);
      if (nested) return nested;
    }
    return "";
  }

  function sanitize(text) {
    return String(text || "")
      .replace(/[A-Za-z0-9_-]{20,}/g, "[redacted]")
      .replace(/latitude|longitude|token|payload/gi, "[redacted]")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 900);
  }

  if (originalFetch) {
    window.fetch = function (input, init) {
      const method = (init && init.method) || (input && input.method) || "GET";
      const url = typeof input === "string" ? input : input && input.url;
      const track = checkAndTriggerRestore(method, url);
      const req = originalFetch(input, init);
      if (track) {
        req.then(r => r.clone().text().then(t => reportScan(r.status, t))).catch(reportError);
      }
      return req;
    };
  }

  if (originalSendBeacon) {
    navigator.sendBeacon = function (url, data) {
      checkAndTriggerRestore("POST", url);
      return originalSendBeacon(url, data);
    };
  }

  XMLHttpRequest.prototype.open = function (method, url) {
    this.__method = method;
    this.__url = url;
    return originalXhrOpen.apply(this, arguments);
  };

  XMLHttpRequest.prototype.send = function () {
    const track = checkAndTriggerRestore(this.__method, this.__url);
    if (track) {
      this.addEventListener("loadend", () => reportScan(this.status, this.responseText || ""), { once: true });
      this.addEventListener("error", () => reportError(new Error("Request failed")), { once: true });
    }
    return originalXhrSend.apply(this, arguments);
  };
})();
