
/* =====================================================
   DEVIL GAMES — PART 03 START
   FILE: hub.js
   PURPOSE: Hub Controls, Navigation & Settings
===================================================== */

"use strict";

/* ---------- 1. BASIC HELPERS ---------- */

const $ = (selector, root = document) =>
  root.querySelector(selector);

const $$ = (selector, root = document) =>
  [...root.querySelectorAll(selector)];

const STORAGE_KEY = "devilGamesSettings";

const defaultSettings = {
  sound: true,
  music: true,
  language: "en"
};

function loadSettings() {
  try {
    const saved = JSON.parse(
      localStorage.getItem(STORAGE_KEY) || "{}"
    );

    return { ...defaultSettings, ...saved };
  } catch (error) {
    return { ...defaultSettings };
  }
}

let settings = loadSettings();

function saveSettings() {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(settings)
    );
  } catch (error) {
    console.warn("Settings could not be saved.");
  }
}


/* ---------- 2. ELEMENT REFERENCES ---------- */

const menuBtn = $("#menuBtn");
const menuOverlay = $("#menuOverlay");
const closeMenuBtn = $("#closeMenuBtn");

const aboutBtn = $("#aboutBtn");
const aboutModal = $("#aboutModal");
const closeAboutBtn = $("#closeAboutBtn");
const aboutDoneBtn = $("#aboutDoneBtn");

const settingsBtn = $("#settingsBtn");
const settingsModal = $("#settingsModal");
const closeSettingsBtn = $("#closeSettingsBtn");
const closeSettingsDoneBtn = $("#closeSettingsDoneBtn");

const soundToggle = $("#soundToggle");
const musicToggle = $("#musicToggle");
const languageSelect = $("#languageSelect");
const fullscreenBtn = $("#fullscreenBtn");

const exploreBtn = $("#exploreBtn");
const gamesSection = $("#gamesSection");


/* ---------- 3. POPUP HELPERS ---------- */

function openModal(modal) {
  if (!modal) return;

  modal.hidden = false;
  document.body.style.overflow = "hidden";

  const closeButton = $(
    "button",
    modal
  );

  if (closeButton) {
    closeButton.focus();
  }
}

function closeModal(modal) {
  if (!modal) return;

  modal.hidden = true;

  const anotherPopupOpen = [
    menuOverlay,
    aboutModal,
    settingsModal
  ].some(element => element && !element.hidden);

  document.body.style.overflow =
    anotherPopupOpen ? "hidden" : "";

  if (!anotherPopupOpen) {
    const active = document.activeElement;

    if (active && active.blur) {
      active.blur();
    }
  }
}


/* ---------- 4. MAIN MENU DRAWER ---------- */

function openMenu() {
  if (!menuOverlay) return;

  menuOverlay.hidden = false;
  document.body.style.overflow = "hidden";

  closeMenuBtn?.focus();
}

function closeMenu() {
  if (!menuOverlay) return;

  menuOverlay.hidden = true;

  const anotherPopupOpen = [
    aboutModal,
    settingsModal
  ].some(element => element && !element.hidden);

  document.body.style.overflow =
    anotherPopupOpen ? "hidden" : "";

  menuBtn?.focus();
}

menuBtn?.addEventListener("click", openMenu);
closeMenuBtn?.addEventListener("click", closeMenu);

menuOverlay?.addEventListener("click", event => {
  if (event.target === menuOverlay) {
    closeMenu();
  }
});


/* ---------- 5. ABOUT POPUP ---------- */

function showAbout() {
  closeMenu();
  openModal(aboutModal);
}

function hideAbout() {
  closeModal(aboutModal);
  aboutBtn?.focus();
}

aboutBtn?.addEventListener("click", showAbout);
closeAboutBtn?.addEventListener("click", hideAbout);
aboutDoneBtn?.addEventListener("click", hideAbout);

aboutModal?.addEventListener("click", event => {
  if (event.target === aboutModal) {
    hideAbout();
  }
});


/* ---------- 6. SETTINGS POPUP ---------- */

function showSettings() {
  closeMenu();
  openModal(settingsModal);
}

function hideSettings() {
  closeModal(settingsModal);
  settingsBtn?.focus();
}

settingsBtn?.addEventListener("click", showSettings);

closeSettingsBtn?.addEventListener(
  "click",
  hideSettings
);

closeSettingsDoneBtn?.addEventListener(
  "click",
  hideSettings
);

settingsModal?.addEventListener("click", event => {
  if (event.target === settingsModal) {
    hideSettings();
  }
});


/* ---------- 7. LOAD SAVED SETTINGS ---------- */

function updateSettingsUI() {
  if (soundToggle) {
    soundToggle.checked = settings.sound;
  }

  if (musicToggle) {
    musicToggle.checked = settings.music;
  }

  if (languageSelect) {
    languageSelect.value = settings.language;
  }
}

updateSettingsUI();


/* ---------- 8. SOUND & MUSIC SETTINGS ---------- */

soundToggle?.addEventListener("change", () => {
  settings.sound = soundToggle.checked;
  saveSettings();

  window.dispatchEvent(
    new CustomEvent("devil:sound-setting", {
      detail: { enabled: settings.sound }
    })
  );
});

musicToggle?.addEventListener("change", () => {
  settings.music = musicToggle.checked;
  saveSettings();

  window.dispatchEvent(
    new CustomEvent("devil:music-setting", {
      detail: { enabled: settings.music }
    })
  );
});


/* ---------- 9. LANGUAGE SETTING ---------- */

languageSelect?.addEventListener("change", () => {
  settings.language = languageSelect.value;
  saveSettings();

  document.documentElement.lang =
    settings.language === "hi" ? "hi" : "en";

  window.dispatchEvent(
    new CustomEvent("devil:language-setting", {
      detail: { language: settings.language }
    })
  );
});


/* ---------- 10. FULLSCREEN ---------- */

async function toggleFullscreen() {
  try {
    if (!document.fullscreenElement) {
      if (!document.documentElement.requestFullscreen) {
        alert(
          "Fullscreen is not supported in this browser. " +
          "Try opening the game in a supported browser."
        );
        return;
      }

      await document.documentElement.requestFullscreen();
    } else {
      await document.exitFullscreen();
    }
  } catch (error) {
    console.warn("Fullscreen request was not completed.");

    alert(
      "Fullscreen could not be enabled. " +
      "Try again using the browser's supported controls."
    );
  }
}

fullscreenBtn?.addEventListener(
  "click",
  toggleFullscreen
);

document.addEventListener("fullscreenchange", () => {
  if (!fullscreenBtn) return;

  fullscreenBtn.innerHTML =
    document.fullscreenElement
      ? "⛶ Exit Fullscreen"
      : "⛶ Enter Fullscreen";
});


/* ---------- 11. GAME CATEGORY FILTERS ---------- */

const filterButtons = $$(".filter-btn");
const gameCards = $$(".game-card");

filterButtons.forEach(button => {
  button.addEventListener("click", () => {
    const filter = button.dataset.filter;

    filterButtons.forEach(item => {
      item.classList.toggle(
        "active",
        item === button
      );
    });

    gameCards.forEach(card => {
      const category = card.dataset.category;

      card.hidden =
        filter !== "all" && category !== filter;
    });
  });
});


/* ---------- 12. EXPLORE GAMES ---------- */

exploreBtn?.addEventListener("click", () => {
  gamesSection?.scrollIntoView({
    behavior: "smooth",
    block: "start"
  });
});


/* ---------- 13. HUB NAVIGATION ---------- */

function goToHome() {
  closeMenu();

  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });

  setActiveNavigation("home");
}

function goToGames() {
  closeMenu();

  gamesSection?.scrollIntoView({
    behavior: "smooth",
    block: "start"
  });

  setActiveNavigation("games");
}

function setActiveNavigation(name) {
  $$("[data-nav]").forEach(button => {
    button.classList.toggle(
      "active",
      button.dataset.nav === name
    );
  });
}

function handleNavigation(name) {
  switch (name) {
    case "home":
      goToHome();
      break;

    case "games":
      goToGames();
      break;

    case "settings":
      showSettings();
      break;

    case "about":
      showAbout();
      break;
  }
}

$$("[data-nav]").forEach(button => {
  button.addEventListener("click", () => {
    handleNavigation(button.dataset.nav);
  });
});

$$("[data-drawer]").forEach(button => {
  button.addEventListener("click", () => {
    handleNavigation(button.dataset.drawer);
  });
});


/* ---------- 14. GAME OPENING ---------- */

const gameRoutes = {
  "devil-blast": "devil-blast/index.html",
  "devil-run": "devil-run/index.html",
  "devil-bricks": "devil-bricks/index.html",
  "devil-tic-tac-toe": "devil-tic-tac-toe/index.html",
  "devil-match": "devil-match/index.html"
};

$$("[data-open-game]").forEach(button => {
  button.addEventListener("click", () => {
    const gameId = button.dataset.openGame;
    const route = gameRoutes[gameId];

    if (!route) {
      console.error("Unknown game:", gameId);
      return;
    }

    /*
      Game pages will be created in later parts.
      This opens the selected game's HTML page.
    */

    window.location.href = route;
  });
});


/* ---------- 15. ESCAPE KEY ---------- */

document.addEventListener("keydown", event => {
  if (event.key !== "Escape") return;

  if (aboutModal && !aboutModal.hidden) {
    hideAbout();
    return;
  }

  if (settingsModal && !settingsModal.hidden) {
    hideSettings();
    return;
  }

  if (menuOverlay && !menuOverlay.hidden) {
    closeMenu();
  }
});


/* ---------- 16. INITIALIZE HUB ---------- */

document.documentElement.lang =
  settings.language === "hi" ? "hi" : "en";

setActiveNavigation("home");

console.log("DEVIL GAMES Hub initialized successfully.");


/* =====================================================
   DEVIL GAMES — PART 03 END
   NEXT: PART 04 — DEVIL BLAST HTML
===================================================== */
