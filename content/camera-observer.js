(function () {
  if (window.deviceSandboxCameraObserver) return;

  function findCameraFrame() {
    const candidates = Array.from(document.querySelectorAll("video, canvas"))
      .filter((node) => {
        const rect = node.getBoundingClientRect();
        const style = window.getComputedStyle(node);
        return (
          rect.width >= 160 &&
          rect.height >= 120 &&
          rect.bottom > 0 &&
          rect.right > 0 &&
          rect.top < window.innerHeight &&
          rect.left < window.innerWidth &&
          style.visibility !== "hidden" &&
          style.display !== "none"
        );
      })
      .sort((a, b) => {
        const aRect = a.getBoundingClientRect();
        const bRect = b.getBoundingClientRect();
        return bRect.width * bRect.height - aRect.width * aRect.height;
      });

    if (!candidates.length) return null;

    const media = candidates[0];
    return (
      media.closest(
        ".qr-reader, .scanner, .camera, [class*='scan'], [class*='qr'], [class*='camera']"
      ) || media
    );
  }

  function observeCameraSurface(onChange) {
    if (typeof onChange !== "function") return;
    
    // Initial call
    onChange();

    const observer = new MutationObserver(onChange);
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["class", "style"],
    });

    window.addEventListener("resize", onChange, { passive: true });
    window.addEventListener("scroll", onChange, { passive: true, capture: true });
  }

  function isVisibleElement(element) {
    if (!element) return false;
    const rect = element.getBoundingClientRect();
    const style = window.getComputedStyle(element);
    return (
      rect.width > 0 &&
      rect.height > 0 &&
      rect.bottom > 0 &&
      rect.right > 0 &&
      rect.top < window.innerHeight &&
      rect.left < window.innerWidth &&
      style.display !== "none" &&
      style.visibility !== "hidden" &&
      style.pointerEvents !== "none"
    );
  }

  // Export globally in Content Script isolated world context
  window.deviceSandboxCameraObserver = {
    findCameraFrame,
    observeCameraSurface,
    isVisibleElement
  };
})();
