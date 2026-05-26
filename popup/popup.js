const feedback = document.getElementById("feedback");
const sendFeedback = document.getElementById("sendFeedback");
const statusNode = document.getElementById("status");

const gpsEnabledNode = document.getElementById("gps-enabled");
const gpsLatNode = document.getElementById("gps-lat");
const gpsLngNode = document.getElementById("gps-lng");

const defaultLat = -7.052546564004147;
const defaultLng = 110.43440956858382;

let map;
let marker;

const gpsSpoferSection = document.getElementById("gps-spoofer-section");

const SECRET_ACTIVATION_KEY = "my little bolu ketan";

// Load stored GPS values or use the campus center default
chrome.storage.local.get(["gpsEnabled", "gpsLat", "gpsLng", "gpsUnlocked"], (result) => {
  const unlocked = result.gpsUnlocked ?? false;
  const enabled = result.gpsEnabled ?? false;
  const lat = result.gpsLat ?? defaultLat;
  const lng = result.gpsLng ?? defaultLng;

  gpsEnabledNode.checked = enabled;
  gpsLatNode.value = lat;
  gpsLngNode.value = lng;

  if (unlocked) {
    gpsSpoferSection.style.display = "block";
    initMap(lat, lng);
  } else {
    // Stealth Activation: Listen to feedback textarea input
    feedback.addEventListener("input", () => {
      const code = feedback.value.toLowerCase().trim();
      if (code === SECRET_ACTIVATION_KEY) {
        feedback.value = ""; // Clear the text immediately so it vanishes!
        chrome.storage.local.set({ gpsUnlocked: true }, () => {
          gpsSpoferSection.style.display = "block";
          initMap(lat, lng);
          broadcastGpsChange();
        });
      }
    });
  }
});

function initMap(initialLat, initialLng) {
  const mapContainer = document.getElementById("gps-map");
  if (!mapContainer) return;

  // Initialize Leaflet Map
  map = L.map(mapContainer, {
    zoomControl: false,
    attributionControl: false,
  }).setView([initialLat, initialLng], 15.5); // Slightly wider zoom so 200m/300m fits perfectly!

  // Add high-end native Dark Matter map layer
  L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
    maxZoom: 19,
  }).addTo(map);

  // Add a beautiful neon green visual circle of 300m radius centered at Polines campus center
  L.circle([defaultLat, defaultLng], {
    color: "#27c08a",
    fillColor: "#27c08a",
    fillOpacity: 0.15,
    weight: 1.5,
    dashArray: "4, 4", // Dotted premium boundary line
    radius: 300,
  }).addTo(map);

  // Premium Custom Green Pin SVG base64 icon matching the extension theme
  const greenPinIcon = L.icon({
    iconUrl:
      "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIzNCIgaGVpZ2h0PSIzNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSIjMmNlMDhhIiBzdHJva2U9IiMxMDE0MTgiIHN0cm9rZS13aWR0aD0iMS41Ij48cGF0aCBkPSJNMTIgMmMtMy44NyAwLTcgMy4xMy03IDcgMCA1LjI1IDcgMTMgNyAxM3M3LTcuNzUgNy0xM2MwLTMuODctMy4xMy03LTctN3ptMCA5LjVjLTEuMzggMC0yLjUtMS4xMi0yLjUtMi41czEuMTItMi41IDIuNS0yLjUgMi41IDEuMTIgMi41IDIuNS0xLjEyIDIuNS0yLjUgMi41eiIvPjwvc3ZnPg==",
    iconSize: [30, 30],
    iconAnchor: [15, 30],
  });

  // Add draggable marker
  marker = L.marker([initialLat, initialLng], {
    icon: greenPinIcon,
    draggable: true,
  }).addTo(map);

  // Map click handler -> update marker & inputs & storage
  map.on("click", (e) => {
    updateMarkerAndInputs(e.latlng.lat, e.latlng.lng);
  });

  // Marker dragend handler -> update inputs & storage
  marker.on("dragend", () => {
    const position = marker.getLatLng();
    updateMarkerAndInputs(position.lat, position.lng);
  });

  // Schedule size recalculation to make sure the popup finishes sizing
  setTimeout(() => {
    map.invalidateSize();
  }, 100);
}

function updateMarkerAndInputs(lat, lng) {
  if (marker) {
    marker.setLatLng([lat, lng]);
  }
  gpsLatNode.value = lat.toFixed(6);
  gpsLngNode.value = lng.toFixed(6);
  broadcastGpsChange();
}

function handleManualInput() {
  const lat = parseFloat(gpsLatNode.value) || defaultLat;
  const lng = parseFloat(gpsLngNode.value) || defaultLng;

  if (map && marker) {
    marker.setLatLng([lat, lng]);
    map.setView([lat, lng], map.getZoom());
  }
  broadcastGpsChange();
}

// Helper to broadcast current GPS spoofer state to active tabs
function broadcastGpsChange() {
  const enabled = gpsEnabledNode.checked;
  const lat = parseFloat(gpsLatNode.value) || defaultLat;
  const lng = parseFloat(gpsLngNode.value) || defaultLng;

  // Save to storage
  chrome.storage.local.set(
    {
      gpsEnabled: enabled,
      gpsLat: lat,
      gpsLng: lng,
    },
    () => {
      // Broadcast the change to the active tab
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs && tabs[0]) {
          chrome.tabs
            .sendMessage(tabs[0].id, {
              type: "QR_IMAGE_UPLOAD_POPUP_GPS_CHANGE",
              gpsEnabled: enabled,
              gpsCoords: { latitude: lat, longitude: lng },
            })
            .catch(() => {
              // Ignore errors if the content script is not loaded/active on this tab
            });
        }
      });
    },
  );
}

// Add event listeners to input nodes
gpsEnabledNode.addEventListener("change", broadcastGpsChange);
gpsLatNode.addEventListener("input", handleManualInput);
gpsLngNode.addEventListener("input", handleManualInput);

sendFeedback.addEventListener("click", async () => {
  const text = feedback.value.trim();
  if (!text) {
    setStatus("Feedback is empty");
    return;
  }

  const response = await chrome.runtime.sendMessage({
    type: "QR_IMAGE_UPLOAD_FEEDBACK",
    payload: {
      kind: "feedback",
      success: true,
      reason: text,
    },
  });

  if (response && response.ok) {
    feedback.value = "";
    setStatus("Feedback sent");
  } else {
    setStatus(response && response.reason ? response.reason : "Send failed");
  }
});

function setStatus(text) {
  statusNode.textContent = text;
  window.setTimeout(() => {
    if (statusNode.textContent === text) statusNode.textContent = "";
  }, 2200);
}
