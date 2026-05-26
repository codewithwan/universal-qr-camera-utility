(function () {
  if (window.__deviceSandboxGpsBridge) return;
  window.__deviceSandboxGpsBridge = true;

  const state = {
    gpsEnabled: false,
    gpsCoords: {
      latitude: -7.052546564004147,
      longitude: 110.43440956858382,
      accuracy: 15.0
    },
    originalGeolocation: {
      getCurrentPosition: navigator.geolocation && navigator.geolocation.getCurrentPosition
        ? navigator.geolocation.getCurrentPosition.bind(navigator.geolocation)
        : null,
      watchPosition: navigator.geolocation && navigator.geolocation.watchPosition
        ? navigator.geolocation.watchPosition.bind(navigator.geolocation)
        : null,
      clearWatch: navigator.geolocation && navigator.geolocation.clearWatch
        ? navigator.geolocation.clearWatch.bind(navigator.geolocation)
        : null
    },
    watches: new Map(),
    watchCounter: 0
  };

  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition = function patchedGetCurrentPosition(success, error, options) {
      if (!state.gpsEnabled) {
        if (state.originalGeolocation.getCurrentPosition) {
          return state.originalGeolocation.getCurrentPosition(success, error, options);
        }
        if (error) error({ code: 1, message: "User denied Geolocation" });
        return;
      }
      setTimeout(() => {
        success({
          coords: {
            latitude: state.gpsCoords.latitude,
            longitude: state.gpsCoords.longitude,
            accuracy: state.gpsCoords.accuracy,
            altitude: null,
            altitudeAccuracy: null,
            heading: null,
            speed: null
          },
          timestamp: Date.now()
        });
      }, 0);
    };

    navigator.geolocation.watchPosition = function patchedWatchPosition(success, error, options) {
      if (!state.gpsEnabled) {
        if (state.originalGeolocation.watchPosition) {
          return state.originalGeolocation.watchPosition(success, error, options);
        }
        if (error) error({ code: 1, message: "User denied Geolocation" });
        return 1;
      }

      state.watchCounter++;
      const watchId = state.watchCounter;

      setTimeout(() => {
        success({
          coords: {
            latitude: state.gpsCoords.latitude,
            longitude: state.gpsCoords.longitude,
            accuracy: state.gpsCoords.accuracy,
            altitude: null,
            altitudeAccuracy: null,
            heading: null,
            speed: null
          },
          timestamp: Date.now()
        });
      }, 0);

      const intervalId = setInterval(() => {
        success({
          coords: {
            latitude: state.gpsCoords.latitude,
            longitude: state.gpsCoords.longitude,
            accuracy: state.gpsCoords.accuracy,
            altitude: null,
            altitudeAccuracy: null,
            heading: null,
            speed: null
          },
          timestamp: Date.now()
        });
      }, 3000);

      state.watches.set(watchId, intervalId);
      return watchId;
    };

    navigator.geolocation.clearWatch = function patchedClearWatch(watchId) {
      if (state.watches.has(watchId)) {
        clearInterval(state.watches.get(watchId));
        state.watches.delete(watchId);
      } else if (state.originalGeolocation.clearWatch) {
        state.originalGeolocation.clearWatch(watchId);
      }
    };
  }

  // Listen to coordinate updates broadcasted from the content script
  window.addEventListener("message", (event) => {
    if (event.source !== window || !event.data) return;
    if (event.data.type === "QR_IMAGE_UPLOAD_SET_GPS") {
      state.gpsEnabled = event.data.enabled;
      if (event.data.coords) {
        state.gpsCoords.latitude = event.data.coords.latitude;
        state.gpsCoords.longitude = event.data.coords.longitude;
      }
    }
  });
})();
