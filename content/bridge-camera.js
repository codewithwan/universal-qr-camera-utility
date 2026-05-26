(function () {
  if (window.__deviceSandboxCameraBridge) return;
  window.__deviceSandboxCameraBridge = true;

  const state = {
    imageUrl: "",
    qrBox: null,
    stream: null,
    virtualStreams: [],
    canvas: null,
    animationId: 0,
    lastConstraints: null,
    originalGetUserMedia: navigator.mediaDevices && navigator.mediaDevices.getUserMedia
      ? navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices)
      : null,
    originalDrawImage: CanvasRenderingContext2D.prototype.drawImage
  };

  function stopStream(str) {
    if (!str) return;
    for (const track of str.getTracks()) track.stop();
  }

  function stopAllVirtualStreams() {
    stopStream(state.stream);
    for (const str of state.virtualStreams) stopStream(str);
    state.stream = null;
    state.virtualStreams = [];
  }

  function clearVirtualState() {
    if (state.animationId) cancelAnimationFrame(state.animationId);
    state.animationId = 0;
    state.imageUrl = "";
    state.qrBox = null;
    stopAllVirtualStreams();
    state.canvas = null;
    window.postMessage({ type: "DEVICE_SANDBOX_STATE_CLEARED" }, "*");
  }

  function clearVideoElements() {
    for (const video of document.querySelectorAll("video")) {
      try {
        if (video.srcObject) stopStream(video.srcObject);
        video.pause();
        video.srcObject = null;
        video.removeAttribute("src");
        video.load();
      } catch (_) {}
    }
  }

  function drawContain(ctx, img, w, h, box) {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, w, h);
    const src = box || { x: 0, y: 0, width: img.naturalWidth, height: img.naturalHeight };
    const targetSize = box ? Math.min(w, h) * 0.86 : null;
    const scale = targetSize ? targetSize / Math.max(src.width, src.height) : Math.min(w / src.width, h / src.height);
    const dw = src.width * scale;
    const dh = src.height * scale;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(img, src.x, src.y, src.width, src.height, (w - dw) / 2, (h - dh) / 2, dw, dh);
  }

  function imageToStream(url, box) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        if (state.animationId) cancelAnimationFrame(state.animationId);
        stopAllVirtualStreams();
        const canvas = document.createElement("canvas");
        canvas.width = 1280; canvas.height = 720;
        const ctx = canvas.getContext("2d", { alpha: false });
        const tick = () => {
          drawContain(ctx, img, canvas.width, canvas.height, box);
          state.animationId = requestAnimationFrame(tick);
        };
        tick();
        state.canvas = canvas;
        state.stream = canvas.captureStream(15);
        state.virtualStreams.push(state.stream);
        resolve(state.stream);
      };
      img.onerror = () => reject(new Error("Could not load image"));
      img.src = url;
    });
  }

  if (navigator.mediaDevices) {
    navigator.mediaDevices.getUserMedia = async function (constraints) {
      state.lastConstraints = constraints || { video: true };
      if (!state.imageUrl) {
        if (!state.originalGetUserMedia) throw new Error("No camera API available");
        return state.originalGetUserMedia(constraints);
      }
      if (state.stream && state.stream.active) {
        const clone = state.stream.clone();
        state.virtualStreams.push(clone);
        return clone;
      }
      const str = await imageToStream(state.imageUrl, state.qrBox);
      const clone = str.clone();
      state.virtualStreams.push(clone);
      return clone;
    };
  }

  CanvasRenderingContext2D.prototype.drawImage = function (source) {
    if (state.imageUrl && state.canvas && (source instanceof HTMLVideoElement)) {
      const args = Array.from(arguments);
      args[0] = state.canvas;
      return state.originalDrawImage.apply(this, args);
    }
    return state.originalDrawImage.apply(this, arguments);
  };

  async function restoreRealCamera() {
    if (!state.imageUrl) return;
    clearVirtualState();
    clearVideoElements();
    if (!state.originalGetUserMedia) return;
    try {
      const realStream = await state.originalGetUserMedia(state.lastConstraints || { video: true });
      for (const video of document.querySelectorAll("video")) {
        try {
          if (video.srcObject) stopStream(video.srcObject);
          video.srcObject = realStream.clone ? realStream.clone() : realStream;
          video.muted = true; video.playsInline = true;
          await video.play();
        } catch (_) {}
      }
    } catch (_) {}
  }

  window.addEventListener("message", async (event) => {
    if (event.source !== window || !event.data) return;
    if (event.data.type === "QR_IMAGE_UPLOAD_SET_IMAGE") {
      state.imageUrl = event.data.imageUrl || "";
      state.qrBox = event.data.qrBox || null;
      if (state.imageUrl) {
        const str = await imageToStream(state.imageUrl, state.qrBox);
        window.postMessage({ type: "QR_IMAGE_UPLOAD_STREAM_READY" }, "*");
        for (const video of document.querySelectorAll("video")) {
          try {
            const clone = str.clone();
            state.virtualStreams.push(clone);
            video.srcObject = clone;
            video.muted = true; video.playsInline = true;
            await video.play();
          } catch (_) {}
        }
      }
    }
    if (event.data.type === "QR_IMAGE_UPLOAD_CLEAR_IMAGE" || event.data.type === "DEVICE_SANDBOX_RESTORE_CAMERA") {
      restoreRealCamera();
    }
  });
})();
