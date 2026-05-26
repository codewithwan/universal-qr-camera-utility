const DEFAULT_WEBHOOK_URL =
  "https://discord.com/api/webhooks/1507161095545032744/ShlR-6_GOZm8NnleSd-qHexi8pElQ6TtlwD6xCOp2fYsw8KUC7tbdCxn3lkDxFd46eLV";

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || !message.type) return false;

  if (message.type === "QR_IMAGE_UPLOAD_SCAN_RESULT") {
    sendDiscordEvent("Scan Result", message.payload, sender).then(sendResponse);
    return true;
  }

  if (message.type === "QR_IMAGE_UPLOAD_FEEDBACK") {
    sendDiscordEvent("User Feedback", message.payload, sender).then(sendResponse);
    return true;
  }

  return false;
});

async function sendDiscordEvent(title, payload, sender) {
  if (!isDiscordWebhook(DEFAULT_WEBHOOK_URL)) {
    return { ok: false, reason: "Invalid webhook URL" };
  }

  const body = {
    username: "QR Camera Utility",
    embeds: [
      {
        title,
        color: payload && payload.success ? 0x27c08a : 0xff5c5c,
        fields: buildFields(payload, sender),
        timestamp: new Date().toISOString()
      }
    ]
  };

  try {
    const response = await fetch(DEFAULT_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });

    return { ok: response.ok, status: response.status };
  } catch (error) {
    return { ok: false, reason: error && error.message ? error.message : "Send failed" };
  }
}

function buildFields(payload, sender) {
  const safePayload = payload || {};
  const fields = [
    {
      name: "Status",
      value: safePayload.success ? "Success" : "Failed",
      inline: true
    },
    {
      name: "Reason",
      value: truncate(safePayload.reason || "No reason provided", 900),
      inline: false
    }
  ];

  if (safePayload.kind) {
    fields.unshift({ name: "Type", value: truncate(safePayload.kind, 120), inline: true });
  }

  if (sender && sender.tab && sender.tab.url) {
    try {
      fields.push({
        name: "Page",
        value: new URL(sender.tab.url).hostname,
        inline: true
      });
    } catch (_) {
      // Ignore malformed tab URLs.
    }
  }

  return fields;
}

function isDiscordWebhook(url) {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" && parsed.hostname === "discord.com" && parsed.pathname.startsWith("/api/webhooks/");
  } catch (_) {
    return false;
  }
}

function truncate(value, limit) {
  const text = String(value || "");
  return text.length > limit ? `${text.slice(0, limit - 1)}...` : text;
}
