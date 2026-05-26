(function () {
  if (window.deviceSandboxUi) return;

  const ROOT_ID = "qr-image-upload-root";
  const PREVIEW_ID = "qr-image-upload-preview";

  let root;
  let fileInput;
  let previewNode;
  let statusNode;

  function ensureUi(callbacks) {
    if (document.getElementById(ROOT_ID)) return root;

    root = document.createElement("div");
    root.id = ROOT_ID;
    root.innerHTML = [
      '<button type="button" class="pqu-icon-button pqu-upload-button" data-action="upload" title="Upload QR image" aria-label="Upload QR image">',
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5v13a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 18.5v-13Zm2.5-.7a.7.7 0 0 0-.7.7v10.2l3.3-3.3a1.7 1.7 0 0 1 2.4 0l1.2 1.2 3-3a1.7 1.7 0 0 1 2.4 0l.1.1V5.5a.7.7 0 0 0-.7-.7h-11Zm11.7 8.5-1.3-1.3-3.6 3.6a.9.9 0 0 1-1.3 0l-1.8-1.8-4.4 4.4v.3c0 .4.3.7.7.7h11c.4 0 .7-.3.7-.7v-5.2ZM9 8.5A1.5 1.5 0 1 1 12 8.5 1.5 1.5 0 0 1 9 8.5Z"/></svg>',
      "</button>",
      '<button type="button" class="pqu-icon-button pqu-confirm-button" data-action="confirm" title="Use uploaded QR" aria-label="Use uploaded QR">',
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9.2 16.6 4.9 12.3l1.7-1.7 2.6 2.6 8.2-8.2 1.7 1.7-9.9 9.9Z"/></svg>',
      "</button>",
      '<button type="button" class="pqu-icon-button pqu-cancel-button" data-action="clear" title="Cancel uploaded QR" aria-label="Cancel uploaded QR">',
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6.4 5 5.6 5.6L17.6 5 19 6.4 13.4 12 19 17.6 17.6 19 12 13.4 6.4 19 5 17.6l5.6-5.6L5 6.4 6.4 5Z"/></svg>',
      "</button>",
      '<input class="pqu-file" type="file" accept="image/*">',
    ].join("");

    document.documentElement.appendChild(root);

    previewNode = document.createElement("div");
    previewNode.id = PREVIEW_ID;
    previewNode.innerHTML = '<img alt="">';
    document.documentElement.appendChild(previewNode);

    fileInput = root.querySelector(".pqu-file");

    // Bind event callbacks
    root.querySelector('[data-action="upload"]').addEventListener("click", () => fileInput.click());
    if (callbacks.onConfirm) root.querySelector('[data-action="confirm"]').addEventListener("click", callbacks.onConfirm);
    if (callbacks.onCancel) root.querySelector('[data-action="clear"]').addEventListener("click", callbacks.onCancel);
    if (callbacks.onFileSelect) fileInput.addEventListener("change", (e) => callbacks.onFileSelect(e, fileInput));

    return root;
  }

  function positionUi(cameraFrame) {
    if (!root || !cameraFrame) return;

    const rect = cameraFrame.getBoundingClientRect();
    const rootRect = root.getBoundingClientRect();
    const margin = 10;
    const top = Math.max(8, rect.top + margin);
    const left = Math.min(
      window.innerWidth - rootRect.width - 8,
      Math.max(8, rect.right - rootRect.width - margin)
    );

    root.style.top = `${top}px`;
    root.style.left = `${left}px`;

    // Position preview element directly on top of the camera viewport
    if (previewNode) {
      previewNode.style.top = `${rect.top}px`;
      previewNode.style.left = `${rect.left}px`;
      previewNode.style.width = `${rect.width}px`;
      previewNode.style.height = `${rect.height}px`;
    }
  }

  function setPreviewImage(imageUrl) {
    if (!previewNode) return;
    const image = previewNode.querySelector("img");
    image.src = imageUrl;
    previewNode.classList.add("pqu-visible");
  }

  function clearPreviewImage() {
    if (!previewNode) return;
    const image = previewNode.querySelector("img");
    image.removeAttribute("src");
    previewNode.classList.remove("pqu-visible");
  }

  function setStatus(text) {
    // We log to console or set visual overlay text if needed
    console.log("[Device Sandbox Status]", text);
  }

  function getUiNodes() {
    return { root, previewNode, fileInput };
  }

  // Export globally in Content Script isolated world context
  window.deviceSandboxUi = {
    ensureUi,
    positionUi,
    setPreviewImage,
    clearPreviewImage,
    setStatus,
    getUiNodes
  };
})();
