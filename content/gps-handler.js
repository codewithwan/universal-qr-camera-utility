(function () {
  if (window.deviceSandboxGps) return;

  let gpsEnabled = false;
  let gpsCoords = {
    latitude: -7.052546564004147,
    longitude: 110.43440956858382,
  };

  function initGps() {
    // Listen to GPS changes from the extension popup
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message && message.type === "QR_IMAGE_UPLOAD_POPUP_GPS_CHANGE") {
        // Double check lock status from storage to prevent unauthorized spoofing
        chrome.storage.local.get(["gpsUnlocked"], (res) => {
          const unlocked = res.gpsUnlocked ?? false;
          gpsEnabled = unlocked && message.gpsEnabled;
          gpsCoords = message.gpsCoords;
          updateGpsUi();
          sendResponse({ success: true });
        });
        return true; // Keep channel open for async response
      }
    });

    // Load initial GPS state from storage
    chrome.storage.local.get(["gpsEnabled", "gpsLat", "gpsLng", "gpsUnlocked"], (result) => {
      const unlocked = result.gpsUnlocked ?? false;
      gpsEnabled = unlocked && (result.gpsEnabled ?? false);
      gpsCoords.latitude = result.gpsLat ?? -7.052546564004147;
      gpsCoords.longitude = result.gpsLng ?? 110.43440956858382;
      updateGpsUi();
    });
  }

  function updateGpsUi() {
    window.postMessage(
      {
        type: "QR_IMAGE_UPLOAD_SET_GPS",
        enabled: gpsEnabled,
        coords: gpsCoords,
      },
      "*"
    );
  }

  // Export globally in Content Script isolated world context
  window.deviceSandboxGps = {
    init: initGps,
    update: updateGpsUi
  };
})();
