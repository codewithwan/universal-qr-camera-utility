(function () {
  if (window.__deviceSandboxContent) return;
  window.__deviceSandboxContent = true;

  let pendingUpload = null;
  let lastDecodedText = "";
  let didRestartForCurrentUpload = false;
  let didClickPermissionForCurrentUpload = false;
  let permissionTimers = [];
  let restartTimer = 0;

  // Inject our 3 isolated main-world scripts
  injectPageBridges();

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  function injectPageBridges() {
    ["bridge-geolocation.js", "bridge-camera.js", "bridge-network.js"].forEach((file) => {
      const script = document.createElement("script");
      script.src = chrome.runtime.getURL(`content/${file}`);
      script.onload = () => script.remove();
      (document.documentElement || document.head).appendChild(script);
    });
  }

  function init() {
    const root = deviceSandboxUi.ensureUi({
      onConfirm: armPendingUpload,
      onCancel: clearCurrentUpload,
      onFileSelect: handleFileSelect
    });

    deviceSandboxGps.init();
    deviceSandboxCameraObserver.observeCameraSurface(refreshVisibility);
    window.addEventListener("message", handleBridgeMessage);
  }

  function refreshVisibility() {
    const frame = deviceSandboxCameraObserver.findCameraFrame();
    const root = document.getElementById("qr-image-upload-root");
    const preview = document.getElementById("qr-image-upload-preview");
    
    if (root) root.classList.toggle("pqu-visible", Boolean(frame));
    if (preview) preview.classList.toggle("pqu-visible", Boolean(frame && pendingUpload));
    if (frame) deviceSandboxUi.positionUi(frame);
  }

  async function handleFileSelect(e, fileInput) {
    const file = fileInput.files && fileInput.files[0];
    if (!file) return;
    try {
      deviceSandboxUi.setStatus("Reading image...");
      didRestartForCurrentUpload = false;
      didClickPermissionForCurrentUpload = false;
      clearPermissionTimers();
      
      const imageUrl = await deviceSandboxQrDetector.readFileAsDataUrl(file);
      const qr = await deviceSandboxQrDetector.detectQrFromFile(file);
      lastDecodedText = qr.text || "";

      pendingUpload = {
        imageUrl,
        previewUrl: qr.previewUrl || imageUrl,
        qrBox: qr.box,
        text: qr.text || ""
      };

      deviceSandboxUi.setPreviewImage(pendingUpload.previewUrl);
      const root = document.getElementById("qr-image-upload-root");
      if (root) root.classList.add("pqu-has-pending");
      deviceSandboxUi.setStatus(qr.text ? "Confirm QR" : "Confirm image");
      refreshVisibility();
    } catch (err) {
      deviceSandboxUi.setStatus("Error loading image");
    } finally {
      fileInput.value = "";
    }
  }

  function armPendingUpload() {
    if (!pendingUpload) return;
    lastDecodedText = pendingUpload.text || "";
    didRestartForCurrentUpload = false;
    didClickPermissionForCurrentUpload = false;
    clearPermissionTimers();

    window.postMessage({
      type: "QR_IMAGE_UPLOAD_SET_IMAGE",
      imageUrl: pendingUpload.imageUrl,
      qrBox: pendingUpload.qrBox
    }, "*");

    const root = document.getElementById("qr-image-upload-root");
    if (root) root.classList.remove("pqu-has-pending");
    pendingUpload = null;
    deviceSandboxUi.clearPreviewImage();
    deviceSandboxUi.setStatus("Arming QR...");
    refreshVisibility();
  }

  function clearCurrentUpload() {
    pendingUpload = null;
    deviceSandboxUi.clearPreviewImage();
    lastDecodedText = "";
    didRestartForCurrentUpload = false;
    didClickPermissionForCurrentUpload = false;
    clearPermissionTimers();
    
    const root = document.getElementById("qr-image-upload-root");
    if (root) root.classList.remove("pqu-has-pending");
    deviceSandboxUi.setStatus("Cleared");
    window.postMessage({ type: "QR_IMAGE_UPLOAD_CLEAR_IMAGE" }, "*");
    refreshVisibility();
  }

  function handleBridgeMessage(event) {
    if (event.source !== window || !event.data) return;
    if (event.data.type === "QR_IMAGE_UPLOAD_STREAM_READY") {
      deviceSandboxUi.setStatus("Virtual camera active");
      if (!didRestartForCurrentUpload) {
        didRestartForCurrentUpload = true;
        if (restartTimer) clearTimeout(restartTimer);
        restartTimer = window.setTimeout(restartScannerModal, 350);
      }
    }
    if (event.data.type === "DEVICE_SANDBOX_STATE_CLEARED") {
      lastDecodedText = "";
      pendingUpload = null;
      deviceSandboxUi.clearPreviewImage();
      const root = document.getElementById("qr-image-upload-root");
      if (root) root.classList.remove("pqu-has-pending");
      didRestartForCurrentUpload = false;
      didClickPermissionForCurrentUpload = false;
      clearPermissionTimers();
      deviceSandboxUi.setStatus("Camera restored");
    }
    if (event.data.type === "QR_IMAGE_UPLOAD_SCAN_RESULT") {
      chrome.runtime.sendMessage({ type: "QR_IMAGE_UPLOAD_SCAN_RESULT", payload: event.data.payload });
    }
  }

  function restartScannerModal() {
    const modal = findScannerModal();
    const closeBtn = findCloseBtn(modal);
    const scanBtn = findScanBtn();

    if (!scanBtn) {
      deviceSandboxUi.setStatus("Reopen scan manually");
      return;
    }

    deviceSandboxUi.setStatus("Restarting scan...");
    if (closeBtn) {
      closeBtn.click();
    } else {
      const escape = { key: "Escape", code: "Escape", keyCode: 27, which: 27, bubbles: true };
      document.dispatchEvent(new KeyboardEvent("keydown", escape));
      window.dispatchEvent(new KeyboardEvent("keydown", escape));
    }

    window.setTimeout(() => {
      scanBtn.click();
      deviceSandboxUi.setStatus("QR armed");
      
      // Auto click allow permissions
      clearPermissionTimers();
      [250, 700, 1200].forEach((delay) => {
        const timer = window.setTimeout(clickPermissionBtn, delay);
        permissionTimers.push(timer);
      });
    }, 450);
  }

  function clickPermissionBtn() {
    if (didClickPermissionForCurrentUpload) return;
    const modal = findScannerModal();
    const btn = findPermissionBtn(modal);
    if (!btn) return;

    didClickPermissionForCurrentUpload = true;
    clearPermissionTimers();
    btn.click();
  }

  function clearPermissionTimers() {
    permissionTimers.forEach(clearTimeout);
    permissionTimers = [];
  }

  // --- HTML DOM Query Helpers ---
  function findScannerModal() {
    const frame = deviceSandboxCameraObserver.findCameraFrame();
    if (frame) {
      let cur = frame;
      while (cur && cur !== document.documentElement) {
        const txt = cur.innerText || "";
        const cls = String(cur.className || "");
        if ((cur.getAttribute && cur.getAttribute("role") === "dialog") || /modal|dialog|swal|popup/i.test(cls) || (/kehadiran kelas|scan qr code|lokasi kamu|presensi/i.test(txt) && cur.getBoundingClientRect().width >= 320)) {
          if (deviceSandboxCameraObserver.isVisibleElement(cur)) return cur;
        }
        cur = cur.parentElement;
      }
    }
    const dialogs = Array.from(document.querySelectorAll("[role='dialog'], .modal, .modal-dialog, .ant-modal")).filter(deviceSandboxCameraObserver.isVisibleElement);
    return dialogs.find(d => /kehadiran kelas|scan qr code|lokasi kamu|presensi/i.test(d.innerText || "")) || null;
  }

  function findCloseBtn(modal) {
    const scope = modal || document;
    const btns = Array.from(scope.querySelectorAll("button, a, [role='button']")).filter(deviceSandboxCameraObserver.isVisibleElement);
    return btns.find(b => {
      const text = [b.innerText, b.getAttribute("aria-label"), b.getAttribute("title")].join(" ");
      return /^(x|×|close|tutup)$/i.test(b.innerText.trim()) || /close|modal.*close|btn-close/i.test(text || "");
    }) || null;
  }

  function findScanBtn() {
    const btns = Array.from(document.querySelectorAll("button, a, [role='button']")).filter(b => {
      const rootNode = document.getElementById("qr-image-upload-root");
      return (!rootNode || !rootNode.contains(b)) && deviceSandboxCameraObserver.isVisibleElement(b);
    });
    return btns.find(b => /\bscan\b|scan qr|qr code/i.test([b.innerText, b.getAttribute("title")].join(" "))) || null;
  }

  function findPermissionBtn(modal) {
    const scope = modal || document;
    const btns = Array.from(scope.querySelectorAll("button, a, [role='button']")).filter(deviceSandboxCameraObserver.isVisibleElement);
    return btns.find(b => {
      const label = [b.innerText, b.getAttribute("aria-label")].join(" ").trim();
      return /izinkan|allow|lanjut|continue|mulai scan|start scan/i.test(label) && !/upload|clear|close|tutup/i.test(label);
    }) || null;
  }
})();
