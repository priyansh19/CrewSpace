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
    lanUrl: document.getElementById("lan-url"),
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

function showError(el, title, message) {
  el.card.classList.add("is-error");
  el.spinner.style.display = "none";
  el.statusText.textContent = title;
  el.detail.textContent = message;
  el.progressFill.style.width = "100%";
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
      const resp = await fetch(`${serverUrl}/api/health`, {
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

// Update loading-screen title bar maximize button icon
function updateMaximizeButton(isMax) {
  const btn = document.querySelector('.titlebar-btn:nth-child(2)');
  if (!btn) return;
  if (isMax) {
    btn.innerHTML = '<svg viewBox="0 0 24 24"><rect x="8" y="8" width="13" height="13" rx="1.5" ry="1.5"></rect><path d="M4 16V4h12"></path></svg>';
    btn.title = 'Restore';
  } else {
    btn.innerHTML = '<svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect></svg>';
    btn.title = 'Maximize';
  }
}

if (window.electronAPI.onWindowMaximizedChanged) {
  window.electronAPI.onWindowMaximizedChanged((isMax) => updateMaximizeButton(isMax));
}

async function run() {
  const el = getElements();

  // Listen for main-process server events
  if (window.electronAPI.onServerCrashed) {
    window.electronAPI.onServerCrashed((code) => {
      showError(el, "Server crashed", `Exit code: ${code}. Please restart CrewSpace.`);
    });
  }
  if (window.electronAPI.onServerError) {
    window.electronAPI.onServerError((message) => {
      showError(el, "Server error", message);
    });
  }

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

      // Show LAN URL if available
      try {
        const lanUrl = await window.electronAPI.getLanServerUrl();
        if (lanUrl && el.lanUrl) {
          el.lanUrl.textContent = `LAN: ${lanUrl}`;
          el.lanUrl.style.display = "block";
        }
      } catch {
        // ignore
      }

      await sleep(800);
      const rendererUrl = await window.electronAPI.getRendererUrl();
      window.location.replace(rendererUrl);
    } else {
      showError(el, "Server failed to start", "Please check the logs or restart CrewSpace. If this persists, contact support.");
    }
  } catch (err) {
    showError(el, "Unexpected error", String(err));
  }
}

run();
