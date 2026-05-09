/**
 * CrewSpace Desktop (Electron) — Loading screen controller
 */

const MESSAGES = [
  "Starting server...",
  "Initializing embedded database...",
  "Applying migrations...",
  "Loading CrewSpace...",
  "Almost there...",
];

const DETAILS = [
  "Setting up local environment",
  "Booting PostgreSQL",
  "Checking schema version",
  "Loading UI assets",
  "Preparing workspace",
];

function getElements() {
  return {
    card: document.getElementById("status-container").parentElement,
    spinner: document.getElementById("spinner"),
    statusText: document.getElementById("status-text"),
    progressFill: document.getElementById("progress-fill"),
    detail: document.getElementById("detail"),
  };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function setProgress(el, pct, messageIndex) {
  el.progressFill.style.width = `${pct}%`;
  el.statusText.textContent =
    MESSAGES[messageIndex] ?? MESSAGES[MESSAGES.length - 1];
  el.detail.textContent =
    DETAILS[messageIndex] ?? DETAILS[DETAILS.length - 1];
}

async function pollHealth(serverUrl, maxAttempts = 120) {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const ok = await window.electronAPI.checkServerHealth();
      if (ok) return true;
    } catch {
      // Not ready yet
    }

    try {
      const resp = await fetch(`${serverUrl}api/health`, {
        method: "GET",
        cache: "no-store",
      });
      if (resp.ok) return true;
    } catch {
      // Expected while server is starting
    }

    await sleep(500);
  }
  return false;
}

async function run() {
  const el = getElements();

  try {
    const serverUrl = await window.electronAPI.getServerUrl();

    let animatedPct = 0;
    let messageIndex = 0;
    const animationInterval = setInterval(() => {
      animatedPct += Math.random() * 4;
      if (animatedPct > 90) animatedPct = 90;

      const newIndex = Math.min(
        Math.floor((animatedPct / 100) * MESSAGES.length),
        MESSAGES.length - 1
      );
      if (newIndex > messageIndex) messageIndex = newIndex;

      setProgress(el, animatedPct, messageIndex);
    }, 600);

    const healthy = await pollHealth(serverUrl);
    clearInterval(animationInterval);

    if (healthy) {
      setProgress(el, 100, MESSAGES.length - 1);
      el.spinner.style.borderColor = "#5db872";
      el.spinner.style.borderTopColor = "#5db872";
      el.statusText.textContent = "Ready";
      el.detail.textContent = "Launching CrewSpace";

      await sleep(400);
      window.location.replace(serverUrl);
    } else {
      el.card.classList.add("is-error");
      el.statusText.textContent = "Server failed to start";
      el.detail.textContent =
        "Please check the logs or restart CrewSpace. If this persists, contact support.";
      el.progressFill.style.width = "100%";
    }
  } catch (err) {
    el.card.classList.add("is-error");
    el.statusText.textContent = "Unexpected error";
    el.detail.textContent = String(err);
    el.progressFill.style.width = "100%";
  }
}

run();
