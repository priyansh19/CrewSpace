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
}

// ── Step 3: Connect Services ────────────────────────────────────────
function collectAuthConfig() {
  return {
    github: {
      appId: $("gh-app-id")?.value?.trim() || "",
      privateKey: $("gh-private-key")?.value?.trim() || "",
      clientId: $("gh-client-id")?.value?.trim() || "",
      clientSecret: $("gh-client-secret")?.value?.trim() || "",
    },
    kimi: {
      apiKey: $("kimi-api-key")?.value?.trim() || "",
    },
  };
}

function initConnect() {
  $("btn-connect-save").addEventListener("click", async () => {
    const btn = $("btn-connect-save");
    btn.disabled = true;
    btn.textContent = "Saving...";

    try {
      const auth = collectAuthConfig();
      await window.electronAPI.saveAuthConfig(auth);
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

  // Mark first run complete
  await window.electronAPI.markFirstRunComplete();

  // Wait a moment then navigate
  await sleep(600);

  try {
    const serverUrl = await window.electronAPI.getServerUrl();
    window.location.replace(serverUrl);
  } catch (err) {
    detail.textContent = "Redirecting...";
    await sleep(500);
    // Fallback: reload to let the normal loading screen take over
    window.location.reload();
  }
}

// ── Main ────────────────────────────────────────────────────────────
async function run() {
  initWelcome();
  initFeatures();
  initTheme();
  initConnect();

  // Start background server health polling early so it's ready by step 4
  pollServerHealthInBackground();
}

async function pollServerHealthInBackground() {
  const serverUrl = await window.electronAPI.getServerUrl();
  let attempts = 0;
  const maxAttempts = 240; // 2 minutes

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
