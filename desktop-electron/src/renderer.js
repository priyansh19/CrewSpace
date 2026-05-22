/**
 * CrewSpace Desktop — Startup Carousel Loading Screen Controller
 *
 * Features:
 *  - Auto-advancing feature carousel (6 slides, 6s each)
 *  - Real-time startup stage updates from main process
 *  - First-run extended timeout support
 *  - Error panel with retry, open data dir, view logs
 */

const AUTO_ADVANCE_MS = 6000;
const SLIDE_COUNT = 6;

// ── DOM refs ────────────────────────────────────────────────────
const els = {
  carouselView: document.getElementById("carousel-view"),
  errorView: document.getElementById("error-view"),
  slides: document.querySelectorAll(".slide"),
  illustrations: document.querySelectorAll(".illustration"),
  dotsContainer: document.getElementById("dot-indicators"),
  slideProgressFill: document.getElementById("slide-progress-fill"),
  navPrev: document.getElementById("nav-prev"),
  navNext: document.getElementById("nav-next"),
  startupPulse: document.getElementById("startup-pulse"),
  startupMessage: document.getElementById("startup-message"),
  startupProgressFill: document.getElementById("startup-progress-fill"),
  startupDetail: document.getElementById("startup-detail"),
  errorTitle: document.getElementById("error-title"),
  errorMessage: document.getElementById("error-message"),
  errorLogs: document.getElementById("error-logs"),
  errorLogsContent: document.getElementById("error-logs-content"),
  btnRetry: document.getElementById("btn-retry"),
  btnOpenData: document.getElementById("btn-open-data"),
  btnViewLogs: document.getElementById("btn-view-logs"),
  btnHideLogs: document.getElementById("btn-hide-logs"),
};

// ── Carousel State ──────────────────────────────────────────────
let currentSlide = 0;
let paused = false;
let slideProgress = 0;
let rafId = 0;
let slideStartTime = 0;

// ── Startup State ───────────────────────────────────────────────
let startupConfig = { firstRun: false, maxWaitSeconds: 60 };
let startupStage = "detecting";
let startupStageStartTime = Date.now();
let overallStartTime = Date.now();
let isReady = false;
let isError = false;
let serverLogs = "";

// Known stage durations (ms) for progress estimation
const STAGE_DURATIONS = {
  "detecting": { typical: 2000, firstRun: 2000 },
  "init-db": { typical: 5000, firstRun: 60000 },
  "start-db": { typical: 3000, firstRun: 5000 },
  "migrations": { typical: 5000, firstRun: 15000 },
  "boot-app": { typical: 3000, firstRun: 5000 },
  "ready": { typical: 500, firstRun: 500 },
};

const STAGE_ORDER = ["detecting", "init-db", "start-db", "migrations", "boot-app", "ready"];

// ── Helpers ─────────────────────────────────────────────────────
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function setSlide(index) {
  // Wrap index
  let i = ((index % SLIDE_COUNT) + SLIDE_COUNT) % SLIDE_COUNT;
  currentSlide = i;

  // Update slides
  els.slides.forEach((slide, idx) => {
    slide.classList.remove("active", "prev");
    if (idx === i) {
      slide.classList.add("active");
    } else if (idx < i) {
      slide.classList.add("prev");
    }
  });

  // Update illustrations
  els.illustrations.forEach((illo, idx) => {
    illo.classList.toggle("active", idx === i);
  });

  // Update dots
  const dots = els.dotsContainer.querySelectorAll(".dot");
  dots.forEach((dot, idx) => {
    dot.classList.toggle("active", idx === i);
    dot.style.width = idx === i ? "20px" : "4px";
  });

  // Reset slide progress
  slideProgress = 0;
  slideStartTime = performance.now();
  updateSlideProgress();
}

function nextSlide() {
  setSlide(currentSlide + 1);
}

function prevSlide() {
  setSlide(currentSlide - 1);
}

function updateSlideProgress() {
  els.slideProgressFill.style.width = `${slideProgress * 100}%`;
}

function startAutoAdvance() {
  cancelAnimationFrame(rafId);
  slideStartTime = performance.now();

  const tick = () => {
    if (paused || isReady || isError) {
      rafId = requestAnimationFrame(tick);
      return;
    }

    const elapsed = performance.now() - slideStartTime;
    slideProgress = Math.min(elapsed / AUTO_ADVANCE_MS, 1);
    updateSlideProgress();

    if (slideProgress >= 1) {
      nextSlide();
      slideStartTime = performance.now();
    }

    rafId = requestAnimationFrame(tick);
  };

  rafId = requestAnimationFrame(tick);
}

function createDots() {
  els.dotsContainer.innerHTML = "";
  for (let i = 0; i < SLIDE_COUNT; i++) {
    const dot = document.createElement("button");
    dot.className = "dot";
    dot.setAttribute("aria-label", `Slide ${i + 1}`);
    dot.style.width = i === 0 ? "20px" : "4px";
    if (i === 0) dot.classList.add("active");
    dot.addEventListener("click", () => {
      setSlide(i);
      slideStartTime = performance.now();
    });
    els.dotsContainer.appendChild(dot);
  }
}

// ── Startup Progress ────────────────────────────────────────────
function getStageDuration(stage) {
  const dur = STAGE_DURATIONS[stage];
  if (!dur) return 5000;
  return startupConfig.firstRun ? dur.firstRun : dur.typical;
}

function getStageIndex(stage) {
  return STAGE_ORDER.indexOf(stage);
}

function estimateOverallProgress() {
  const stageIdx = getStageIndex(startupStage);
  if (stageIdx < 0) return 0;

  // Progress through completed stages
  let completedProgress = 0;
  for (let i = 0; i < stageIdx; i++) {
    completedProgress += getStageDuration(STAGE_ORDER[i]);
  }

  // Progress within current stage
  const stageElapsed = Date.now() - startupStageStartTime;
  const stageDur = getStageDuration(startupStage);
  const currentProgress = Math.min(stageElapsed / stageDur, 1) * stageDur;

  const totalTypical = startupConfig.firstRun ? 82000 : 18000;
  const raw = (completedProgress + currentProgress) / totalTypical;
  return Math.min(raw * 100, 95); // Never show 100% until actually ready
}

function updateStartupProgress() {
  if (isReady || isError) return;
  const pct = estimateOverallProgress();
  els.startupProgressFill.style.width = `${pct}%`;
}

function setStartupStage(stageData) {
  const { stage, message, detail } = stageData;
  startupStage = stage;
  startupStageStartTime = Date.now();

  if (els.startupMessage) {
    els.startupMessage.textContent = message || "Starting server...";
  }
  if (els.startupDetail) {
    els.startupDetail.textContent = detail || "";
  }

  updateStartupProgress();
}

function setStartupReady() {
  isReady = true;
  els.startupPulse.classList.add("done");
  els.startupMessage.textContent = "Ready";
  els.startupDetail.textContent = "Launching CrewSpace...";
  els.startupProgressFill.style.width = "100%";
}

function showErrorPanel(title, message, logs) {
  isError = true;
  serverLogs = logs || "";

  els.carouselView.classList.add("hidden");
  els.errorView.classList.remove("hidden");

  els.errorTitle.textContent = title || "Server failed to start";
  els.errorMessage.textContent = message || "Please check the logs or restart CrewSpace.";
  els.errorLogsContent.textContent = serverLogs;
}

function hideErrorPanel() {
  isError = false;
  els.errorView.classList.add("hidden");
  els.carouselView.classList.remove("hidden");
}

// ── IPC Event Listeners ─────────────────────────────────────────
function setupIpcListeners() {
  if (!window.electronAPI) {
    console.warn("[renderer] electronAPI not available");
    return;
  }

  // Startup config from main
  if (window.electronAPI.onStartupConfig) {
    window.electronAPI.onStartupConfig((config) => {
      startupConfig = config || startupConfig;
      console.log("[renderer] Startup config:", startupConfig);
    });
  }

  // Also try to get it directly
  if (window.electronAPI.getStartupConfig) {
    window.electronAPI.getStartupConfig().then((config) => {
      if (config) startupConfig = config;
    }).catch(() => {});
  }

  // Startup stage updates
  if (window.electronAPI.onStartupStage) {
    window.electronAPI.onStartupStage((data) => {
      console.log("[renderer] Startup stage:", data);
      setStartupStage(data);
    });
  }

  // Server ready
  if (window.electronAPI.onStartupReady) {
    window.electronAPI.onStartupReady(() => {
      console.log("[renderer] Startup ready");
      setStartupReady();
      transitionToApp();
    });
  }

  // Server error
  if (window.electronAPI.onStartupError) {
    window.electronAPI.onStartupError((data) => {
      console.error("[renderer] Startup error:", data);
      showErrorPanel(data.title, data.message, data.logs);
    });
  }

  // Legacy events (fallback)
  if (window.electronAPI.onServerCrashed) {
    window.electronAPI.onServerCrashed((code) => {
      showErrorPanel(
        "Server crashed",
        `The server exited unexpectedly (code: ${code}). Please restart CrewSpace.`,
        serverLogs
      );
    });
  }

  if (window.electronAPI.onServerError) {
    window.electronAPI.onServerError((message) => {
      showErrorPanel("Server error", message, serverLogs);
    });
  }
}

// ── Health Polling ──────────────────────────────────────────────
async function pollHealth() {
  if (!window.electronAPI) return false;

  // Wait briefly for startup config from main process
  // so we use the correct timeout (300s for first run)
  for (let i = 0; i < 20; i++) {
    if (startupConfig.maxWaitSeconds !== 60) break; // Config received
    await sleep(100);
  }

  const maxWaitMs = startupConfig.maxWaitSeconds * 1000;
  const intervalMs = 500;
  const maxAttempts = Math.ceil(maxWaitMs / intervalMs);

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    if (isReady) return true;
    if (isError) return false;

    try {
      const ok = await window.electronAPI.checkServerHealth();
      if (ok) {
        setStartupReady();
        return true;
      }
    } catch {
      // Not ready yet
    }

    updateStartupProgress();
    await sleep(intervalMs);
  }

  // Timed out — but only show error if main hasn't already sent one
  if (!isReady && !isError) {
    showErrorPanel(
      "Server failed to start",
      startupConfig.firstRun
        ? "The server is taking longer than expected to start. On first run, the embedded database needs time to initialize. Please try restarting CrewSpace."
        : "The server did not start within the expected time. Please check the logs or restart CrewSpace.",
      serverLogs
    );
  }

  return false;
}

// ── Transition to App ───────────────────────────────────────────
let transitioning = false;

async function transitionToApp() {
  if (transitioning) return;
  transitioning = true;

  await sleep(600);
  els.carouselView.classList.add("fade-out");
  await sleep(500);

  if (window.electronAPI && window.electronAPI.loadRenderer) {
    await window.electronAPI.loadRenderer();
  }
}

// ── Event Bindings ──────────────────────────────────────────────
function setupEventBindings() {
  // Carousel nav
  els.navPrev.addEventListener("click", () => {
    prevSlide();
    slideStartTime = performance.now();
  });
  els.navNext.addEventListener("click", () => {
    nextSlide();
    slideStartTime = performance.now();
  });

  // Pause on hover over left panel
  const leftPanel = document.getElementById("left-panel");
  if (leftPanel) {
    leftPanel.addEventListener("mouseenter", () => { paused = true; });
    leftPanel.addEventListener("mouseleave", () => { paused = false; });
  }

  // Keyboard nav
  document.addEventListener("keydown", (e) => {
    if (e.key === "ArrowLeft") {
      prevSlide();
      slideStartTime = performance.now();
    } else if (e.key === "ArrowRight") {
      nextSlide();
      slideStartTime = performance.now();
    }
  });

  // Error panel buttons
  els.btnRetry.addEventListener("click", async () => {
    els.btnRetry.textContent = "Retrying...";
    els.btnRetry.disabled = true;
    hideErrorPanel();

    // Reset state
    isError = false;
    isReady = false;
    startupStage = "detecting";
    startupStageStartTime = Date.now();
    els.startupPulse.classList.remove("done", "error");
    els.startupMessage.textContent = "Retrying...";
    els.startupDetail.textContent = "Restarting server";
    els.startupProgressFill.style.width = "0%";

    try {
      const result = await window.electronAPI.retryServerStart();
      if (result.success) {
        setStartupReady();
        transitionToApp();
      } else {
        showErrorPanel("Server failed to start", result.error || "Retry failed.", result.logs || serverLogs);
      }
    } catch (err) {
      showErrorPanel("Retry failed", String(err), serverLogs);
    } finally {
      els.btnRetry.textContent = "Retry";
      els.btnRetry.disabled = false;
    }
  });

  els.btnOpenData.addEventListener("click", () => {
    if (window.electronAPI && window.electronAPI.openDataDir) {
      window.electronAPI.openDataDir();
    }
  });

  els.btnViewLogs.addEventListener("click", () => {
    els.errorLogs.classList.remove("hidden");
  });

  els.btnHideLogs.addEventListener("click", () => {
    els.errorLogs.classList.add("hidden");
  });

  // Maximize button icon update
  if (window.electronAPI && window.electronAPI.onWindowMaximizedChanged) {
    window.electronAPI.onWindowMaximizedChanged((isMax) => {
      const btn = document.querySelector('.titlebar-btn:nth-child(2)');
      if (!btn) return;
      if (isMax) {
        btn.innerHTML = '<svg viewBox="0 0 24 24"><rect x="8" y="8" width="13" height="13" rx="1.5" ry="1.5"></rect><path d="M4 16V4h12"></path></svg>';
        btn.title = 'Restore';
      } else {
        btn.innerHTML = '<svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect></svg>';
        btn.title = 'Maximize';
      }
    });
  }
}

// ── Main ────────────────────────────────────────────────────────
async function main() {
  createDots();
  setSlide(0);
  startAutoAdvance();
  setupEventBindings();
  setupIpcListeners();

  // Start health polling
  const healthy = await pollHealth();
  if (healthy) {
    await transitionToApp();
  }
}

main();
