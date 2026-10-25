
// =====================================================
// DEVIL GAMES
// PART 20: SHARED GAME FEATURES
// FILE: shared.js
// LOCATION: ROOT FOLDER
// NEXT: PART 21 — CONNECT SHARED FEATURES
// =====================================================

(() => {
  "use strict";

  const STORAGE_KEYS = {
    language: "devilGamesLanguage",
    sound: "devilGamesSound",
    music: "devilGamesMusic",
    settings: "devilGamesSettings"
  };

  const DEFAULT_SETTINGS = {
    language: "en",
    sound: true,
    music: false,
    vibration: true
  };

  function safeRead(key, fallback = null) {
    try {
      const value = localStorage.getItem(key);
      return value === null ? fallback : value;
    } catch {
      return fallback;
    }
  }

  function safeWrite(key, value) {
    try {
      localStorage.setItem(key, String(value));
      return true;
    } catch {
      return false;
    }
  }

  function loadSettings() {
    let saved = {};

    try {
      saved = JSON.parse(
        safeRead(STORAGE_KEYS.settings, "{}")
      );
    } catch {
      saved = {};
    }

    return {
      ...DEFAULT_SETTINGS,
      ...saved,
      language: saved.language === "hi" ? "hi" : "en",
      sound: typeof saved.sound === "boolean"
        ? saved.sound
        : safeRead(STORAGE_KEYS.sound, "on") !== "off",
      music: typeof saved.music === "boolean"
        ? saved.music
        : safeRead(STORAGE_KEYS.music, "off") === "on",
      vibration: typeof saved.vibration === "boolean"
        ? saved.vibration
        : true
    };
  }

  let settings = loadSettings();
  let audioContext = null;

  function saveSettings() {
    safeWrite(STORAGE_KEYS.settings, JSON.stringify(settings));
    safeWrite(STORAGE_KEYS.language, settings.language);
    safeWrite(STORAGE_KEYS.sound, settings.sound ? "on" : "off");
    safeWrite(STORAGE_KEYS.music, settings.music ? "on" : "off");
  }

  function updateSettings(changes = {}) {
    settings = {
      ...settings,
      ...changes
    };

    settings.language = settings.language === "hi" ? "hi" : "en";
    settings.sound = Boolean(settings.sound);
    settings.music = Boolean(settings.music);
    settings.vibration = Boolean(settings.vibration);

    saveSettings();
    return getSettings();
  }

  function getSettings() {
    return { ...settings };
  }

  function playSound(
    frequency = 440,
    duration = 0.08,
    type = "sine",
    volume = 0.04
  ) {
    if (!settings.sound) return;

    try {
      const AudioContextClass =
        window.AudioContext || window.webkitAudioContext;

      if (!AudioContextClass) return;

      if (!audioContext) {
        audioContext = new AudioContextClass();
      }

      if (audioContext.state === "suspended") {
        audioContext.resume().catch(() => {});
      }

      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();

      oscillator.type = type;
      oscillator.frequency.setValueAtTime(
        Math.max(40, Math.min(2000, frequency)),
        audioContext.currentTime
      );

      gain.gain.setValueAtTime(
        Math.max(0.001, Math.min(0.15, volume)),
        audioContext.currentTime
      );

      gain.gain.exponentialRampToValueAtTime(
        0.001,
        audioContext.currentTime + Math.max(0.03, duration)
      );

      oscillator.connect(gain);
      gain.connect(audioContext.destination);

      oscillator.start();
      oscillator.stop(
        audioContext.currentTime + Math.max(0.03, duration)
      );
    } catch {
      // Sound is optional; game should still work.
    }
  }

  function vibrate(pattern = 25) {
    if (!settings.vibration) return;

    try {
      if ("vibrate" in navigator) {
        navigator.vibrate(pattern);
      }
    } catch {
      // Vibration may not be supported.
    }
  }

  function formatNumber(value) {
    const number = Number(value) || 0;

    return number.toLocaleString(
      settings.language === "hi" ? "hi-IN" : "en-US"
    );
  }

  function translate(key, fallback = "") {
    const dictionary = {
      en: {
        home: "HOME",
        play: "PLAY",
        pause: "PAUSE",
        resume: "RESUME",
        restart: "RESTART",
        score: "SCORE",
        best: "BEST",
        settings: "SETTINGS",
        sound: "SOUND",
        music: "MUSIC",
        language: "LANGUAGE",
        gameOver: "GAME OVER",
        playAgain: "PLAY AGAIN",
        backHome: "BACK TO HOME"
      },
      hi: {
        home: "होम",
        play: "खेलें",
        pause: "रोकें",
        resume: "जारी रखें",
        restart: "फिर से खेलें",
        score: "स्कोर",
        best: "सर्वश्रेष्ठ",
        settings: "सेटिंग्स",
        sound: "आवाज़",
        music: "म्यूज़िक",
        language: "भाषा",
        gameOver: "गेम समाप्त",
        playAgain: "फिर से खेलें",
        backHome: "होम पर जाएँ"
      }
    };

    return dictionary[settings.language]?.[key] || fallback || key;
  }

  function getBestScore(key) {
    return Math.max(0, Number(safeRead(key, "0")) || 0);
  }

  function saveBestScore(key, score) {
    const nextScore = Math.max(0, Number(score) || 0);
    const best = Math.max(getBestScore(key), nextScore);

    safeWrite(key, best);
    return best;
  }

  function resetBestScore(key) {
    try {
      localStorage.removeItem(key);
      return true;
    } catch {
      return false;
    }
  }

  function createId(prefix = "devil") {
    return `${prefix}-${Date.now().toString(36)}-${Math.random()
      .toString(36)
      .slice(2, 8)}`;
  }

  function onReady(callback) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", callback, {
        once: true
      });
    } else {
      callback();
    }
  }

  const DevilGames = {
    version: "1.0.0",
    getSettings,
    updateSettings,
    saveSettings,
    playSound,
    vibrate,
    formatNumber,
    translate,
    getBestScore,
    saveBestScore,
    resetBestScore,
    createId,
    onReady
  };

  window.DevilGames = DevilGames;

  saveSettings();
})();

// =====================================================
// PART 20 COMPLETE
// NEXT PART: PART 21 — CONNECT SHARED FEATURES
// =====================================================
