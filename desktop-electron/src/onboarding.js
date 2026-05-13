/**
 * CrewSpace Desktop — Onboarding Wizard Controller
 */

// ── State ───────────────────────────────────────────────────────────
let currentStep = 0;
let selectedTheme = "dark";
let carouselInterval = null;
let carouselIndex = 0;
const totalSteps = 5;

// ── Helpers ─────────────────────────────────────────────────────────
function $(id) {
  return document.getElementById(id);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getStepEl(index) {
  return document.querySelector(`.step[data-step="${index}"]`);
}

// ── Navigation ──────────────────────────────────────────────────────
function updateProgressDots() {
  const dots = document.querySelectorAll(".progress-dot");
  const lines = document.querySelectorAll(".progress-line");

  dots.forEach((dot, i) => {
    dot.classList.remove("active", "completed");
    if (i < currentStep) dot.classList.add("completed");
    if (i === currentStep) dot.classList.add("active");
  });

  lines.forEach((line, i) => {
    line.classList.toggle("completed", i < currentStep);
  });
}

function showProgress() {
  $("top-progress").classList.add("visible");
}

async function goToStep(index) {
  if (index < 0 || index >= totalSteps) return;

  const currentEl = getStepEl(currentStep);
  const nextEl = getStepEl(index);

  if (currentEl) {
    currentEl.classList.add("exit");
    await sleep(350);
    currentEl.classList.remove("active", "exit");
  }

  nextEl.classList.add("active");
  currentStep = index;
  updateProgressDots();
}

// ── Step 0: Welcome ─────────────────────────────────────────────────
function initWelcome() {
  $("btn-welcome-start").addEventListener("click", () => {
    showProgress();
    goToStep(1);
    startCarousel();
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && currentStep === 0) {
      showProgress();
      goToStep(1);
      startCarousel();
    }
  });
}

// ── Step 1: Feature Carousel ────────────────────────────────────────
function updateCarousel(index) {
  const slides = document.querySelectorAll(".carousel-slide");
  const dots = document.querySelectorAll(".carousel-dots .dot");

  slides.forEach((slide, i) => {
    slide.classList.remove("active", "prev");
    if (i === index) slide.classList.add("active");
    else if (i < index) slide.classList.add("prev");
  });

  dots.forEach((dot, i) => {
    dot.classList.toggle("active", i === index);
  });

  carouselIndex = index;
}

function startCarousel() {
  if (carouselInterval) return;
  carouselInterval = setInterval(() => {
    const next = (carouselIndex + 1) % 4;
    updateCarousel(next);
  }, 4500);
}

function stopCarousel() {
  if (carouselInterval) {
    clearInterval(carouselInterval);
    carouselInterval = null;
  }
}

function initFeatures() {
  document.querySelectorAll(".carousel-dots .dot").forEach((dot) => {
    dot.addEventListener("click", () => {
      stopCarousel();
      updateCarousel(Number(dot.dataset.slide));
      startCarousel();
    });
  });

  $("btn-features-continue").addEventListener("click", () => {
    stopCarousel();
    goToStep(2);
  });

  $("btn-features-back").addEventListener("click", () => {
    stopCarousel();
    goToStep(0);
  });
}

// ── Step 2: Theme Picker ────────────────────────────────────────────
function initTheme() {
  const cards = document.querySelectorAll(".theme-card");

  cards.forEach((card) => {
    card.addEventListener("click", () => {
      cards.forEach((c) => c.classList.remove("active"));
      card.classList.add("active");
      selectedTheme = card.dataset.theme;
    });
  });

  $("btn-theme-continue").addEventListener("click", async () => {
    await window.electronAPI.saveThemePreference(selectedTheme);
    goToStep(3);
  });

  $("btn-theme-back").addEventListener("click", () => {
    goToStep(1);
    startCarousel();
  });
}

// ── Step 3: Connect Services ────────────────────────────────────────
let githubConnected = false;
let kimiConnected = false;

function collectAuthConfig() {
  return {
    github: {
      pat: $("gh-pat")?.value?.trim() || "",
    },
    kimi: {
      apiKey: $("kimi-api-key")?.value?.trim() || "",
    },
  };
}

function updateGitHubStatus(connected) {
  const statusEl = $("github-status");
  if (!statusEl) return;
  if (connected) {
    statusEl.classList.add("connected");
    statusEl.innerHTML = '<span class="status-dot"></span> Connected';
  } else {
    statusEl.classList.remove("connected");
    statusEl.innerHTML = '<span class="status-dot"></span> Not connected';
  }
}

function showGitHubConnected() {
  githubConnected = true;
  updateGitHubStatus(true);
  $("pat-form").classList.add("hidden");
  $("pat-connected").classList.remove("hidden");
}

function showGitHubDisconnected() {
  githubConnected = false;
  updateGitHubStatus(false);
  $("gh-pat").value = "";
  $("pat-form").classList.remove("hidden");
  $("pat-connected").classList.add("hidden");
}

function updateKimiStatus(connected) {
  const statusEl = $("kimi-status");
  if (!statusEl) return;
  if (connected) {
    statusEl.classList.add("connected");
    statusEl.innerHTML = '<span class="status-dot"></span> Connected';
  } else {
    statusEl.classList.remove("connected");
    statusEl.innerHTML = '<span class="status-dot"></span> Not connected';
  }
}

function showKimiConnected() {
  kimiConnected = true;
  updateKimiStatus(true);
  $("kimi-form").classList.add("hidden");
  $("kimi-connected").classList.remove("hidden");
}

function showKimiDisconnected() {
  kimiConnected = false;
  updateKimiStatus(false);
  $("kimi-api-key").value = "";
  $("kimi-form").classList.remove("hidden");
  $("kimi-connected").classList.add("hidden");
}

async function loadExistingAuth() {
  try {
    const auth = await window.electronAPI.getGitHubAuthConfig();
    if (auth?.pat) {
      $("gh-pat").value = auth.pat;
      showGitHubConnected();
    }
    if (auth?.apiKey) {
      $("kimi-api-key").value = auth.apiKey;
      showKimiConnected();
    }
  } catch (err) {
    console.error("[onboarding] Failed to load existing auth:", err);
  }
}

function initConnect() {
  loadExistingAuth();

  $("link-gh-tokens")?.addEventListener("click", (e) => {
    e.preventDefault();
    window.electronAPI.openExternal("https://github.com/settings/tokens");
  });

  $("btn-gh-disconnect")?.addEventListener("click", () => {
    showGitHubDisconnected();
  });

  $("link-kimi-keys")?.addEventListener("click", (e) => {
    e.preventDefault();
    window.electronAPI.openExternal("https://platform.moonshot.cn");
  });

  $("btn-kimi-disconnect")?.addEventListener("click", () => {
    showKimiDisconnected();
  });

  $("btn-connect-save").addEventListener("click", async () => {
    const btn = $("btn-connect-save");
    btn.disabled = true;
    btn.textContent = "Saving...";

    try {
      const auth = collectAuthConfig();
      if (auth.github.pat) {
        await window.electronAPI.saveAuthConfig(auth);
        await window.electronAPI.restartServerWithAuth();
      }
      goToStep(4);
      runLaunchSequence();
    } catch (err) {
      console.error("[onboarding] Failed to save auth:", err);
      btn.textContent = "Save & Continue";
      btn.disabled = false;
    }
  });

  $("btn-connect-skip").addEventListener("click", () => {
    goToStep(4);
    runLaunchSequence();
  });

  $("btn-connect-back").addEventListener("click", () => {
    goToStep(2);
  });
}

// ── Step 4: Launch ──────────────────────────────────────────────────
async function runLaunchSequence() {
  const fill = $("launch-progress-fill");
  const detail = $("launch-detail");
  const messages = [
    { pct: 15, text: "Saving configuration..." },
    { pct: 35, text: "Starting server..." },
    { pct: 55, text: "Initializing embedded database..." },
    { pct: 75, text: "Applying migrations..." },
    { pct: 90, text: "Loading CrewSpace..." },
    { pct: 100, text: "Ready to go" },
  ];

  for (const step of messages) {
    await sleep(600);
    fill.style.width = `${step.pct}%`;
    detail.textContent = step.text;
  }

  detail.textContent = "Finalizing setup...";
  try {
    const result = await window.electronAPI.completeOnboarding({
      theme: selectedTheme,
      auth: collectAuthConfig(),
    });
    if (result.restored) {
      detail.textContent = "Backup restored. Launching...";
      await sleep(400);
    }
    if (result.success) {
      const rendererUrl = await window.electronAPI.getRendererUrl();
      window.location.replace(rendererUrl);
    } else {
      window.location.reload();
    }
  } catch (err) {
    console.error("[onboarding] Launch failed:", err);
    detail.textContent = "Launching...";
    await sleep(500);
    window.location.reload();
  }
}

// ── Main ────────────────────────────────────────────────────────────
async function run() {
  initWelcome();
  initFeatures();
  initTheme();
  initConnect();

  pollServerHealthInBackground();
}

async function pollServerHealthInBackground() {
  const serverUrl = await window.electronAPI.getServerUrl();
  let attempts = 0;
  const maxAttempts = 240;

  while (attempts < maxAttempts) {
    try {
      const resp = await fetch(`${serverUrl}/api/health`, {
        method: "GET",
        cache: "no-store",
      });
      if (resp.ok) break;
    } catch {
      // Server not ready yet
    }
    attempts++;
    await sleep(500);
  }
}

run();
