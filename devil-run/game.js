
/* =====================================================
   DEVIL GAMES — PART 10
   FILE: devil-run/game.js
   FEATURES: RUNNER MOVEMENT, JUMP, SLIDE, OBSTACLES,
             COINS, SCORE, SOUND, PAUSE, RESTART
   NEXT: PART 11 — DEVIL BRICKS HTML
===================================================== */

"use strict";

(() => {
  const $ = (selector) => document.querySelector(selector);

  const world = $("#runnerWorld");
  const player = $("#runnerPlayer");
  const obstacleLayer = $("#obstacleLayer");
  const coinLayer = $("#coinLayer");

  const distanceValue = $("#distanceValue");
  const coinValue = $("#coinValue");
  const bestValue = $("#bestValue");

  const startBtn = $("#startBtn");
  const pauseBtn = $("#pauseBtn");
  const resumeBtn = $("#resumeBtn");
  const jumpBtn = $("#jumpBtn");
  const slideBtn = $("#slideBtn");
  const soundBtn = $("#soundBtn");
  const restartBtn = $("#restartBtn");

  const runnerMessage = $("#runnerMessage");
  const pauseOverlay = $("#pauseOverlay");
  const gameOverModal = $("#gameOverModal");
  const playAgainBtn = $("#playAgainBtn");

  const finalDistance = $("#finalDistance");
  const finalCoins = $("#finalCoins");

  let running = false;
  let paused = false;
  let soundOn = true;

  let distance = 0;
  let coins = 0;
  let best = Number(localStorage.getItem("devilRunBest") || 0);

  let speed = 240;
  let lastTime = 0;
  let spawnTimer = 0;
  let coinTimer = 0;
  let animationFrame = 0;
  let objects = [];
  let jumpTimeout = null;
  let slideTimeout = null;
  let audioContext = null;

  let playerLane = 1;
  let isJumping = false;
  let isSliding = false;

  const LANES = [25, 50, 75];

  bestValue.textContent = `${best} m`;

  function tone(frequency = 520, duration = 0.08) {
    if (!soundOn) return;

    try {
      const AudioClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioClass) return;

      audioContext ||= new AudioClass();

      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();

      oscillator.type = "sine";
      oscillator.frequency.value = frequency;

      gain.gain.setValueAtTime(0.07, audioContext.currentTime);
      gain.gain.exponentialRampToValueAtTime(
        0.001,
        audioContext.currentTime + duration
      );

      oscillator.connect(gain);
      gain.connect(audioContext.destination);

      oscillator.start();
      oscillator.stop(audioContext.currentTime + duration);
    } catch (_) {
      // Sound is optional when the browser does not support it.
    }
  }

  function updateHUD() {
    distanceValue.textContent = `${Math.floor(distance)} m`;
    coinValue.textContent = `🪙 ${coins}`;
    bestValue.textContent = `${best} m`;
  }

  function clearObjects() {
    objects.forEach((object) => object.element.remove());
    objects = [];
    obstacleLayer.innerHTML = "";
    coinLayer.innerHTML = "";
  }

  function positionPlayer() {
    player.style.left = `${LANES[playerLane]}%`;
  }

  function resetWorld() {
    cancelAnimationFrame(animationFrame);
    clearTimeout(jumpTimeout);
    clearTimeout(slideTimeout);

    running = false;
    paused = false;
    distance = 0;
    coins = 0;
    speed = 240;
    lastTime = 0;
    spawnTimer = 0;
    coinTimer = 0;
    playerLane = 1;
    isJumping = false;
    isSliding = false;

    player.classList.remove("jumping", "sliding");
    player.style.left = "50%";

    clearObjects();
    updateHUD();

    pauseOverlay.classList.add("hidden");
    gameOverModal.classList.add("hidden");
    runnerMessage.classList.remove("hidden");
  }

  function startGame() {
    resetWorld();

    running = true;
    lastTime = performance.now();

    runnerMessage.classList.add("hidden");
    pauseOverlay.classList.add("hidden");
    gameOverModal.classList.add("hidden");

    tone(620, 0.12);
    animationFrame = requestAnimationFrame(gameLoop);
  }

  function pauseGame() {
    if (!running || paused) return;

    paused = true;
    cancelAnimationFrame(animationFrame);
    pauseOverlay.classList.remove("hidden");
  }

  function resumeGame() {
    if (!running || !paused) return;

    paused = false;
    lastTime = performance.now();
    pauseOverlay.classList.add("hidden");

    animationFrame = requestAnimationFrame(gameLoop);
  }

  function finishGame() {
    if (!running) return;

    running = false;
    paused = false;

    cancelAnimationFrame(animationFrame);
    clearTimeout(jumpTimeout);
    clearTimeout(slideTimeout);

    if (Math.floor(distance) > best) {
      best = Math.floor(distance);
      localStorage.setItem("devilRunBest", String(best));
    }

    updateHUD();

    finalDistance.textContent = `${Math.floor(distance)} m`;
    finalCoins.textContent = String(coins);

    gameOverModal.classList.remove("hidden");
    pauseOverlay.classList.add("hidden");

    tone(180, 0.25);
  }

  function jump() {
    if (!running || paused || isJumping || isSliding) return;

    isJumping = true;
    player.classList.add("jumping");
    tone(650, 0.08);

    jumpTimeout = setTimeout(() => {
      isJumping = false;
      player.classList.remove("jumping");
    }, 650);
  }

  function slide() {
    if (!running || paused || isJumping || isSliding) return;

    isSliding = true;
    player.classList.add("sliding");
    tone(340, 0.07);

    slideTimeout = setTimeout(() => {
      isSliding = false;
      player.classList.remove("sliding");
    }, 550);
  }

  function createObject(type) {
    const lane = Math.floor(Math.random() * 3);
    const element = document.createElement("div");

    element.dataset.lane = String(lane);
    element.style.left = `${LANES[lane]}%`;
    element.style.transform = "translateX(-50%)";

    if (type === "coin") {
      element.className = "runner-coin";
      element.textContent = "●";
      element.style.bottom = `${25 + Math.random() * 15}%`;
      coinLayer.appendChild(element);
    } else {
      element.className = Math.random() < 0.35
        ? "runner-obstacle tall"
        : "runner-obstacle";

      obstacleLayer.appendChild(element);
    }

    const object = {
      type,
      lane,
      element,
      y: -12,
      hit: false,
      size: type === "coin" ? 25 : 42
    };

    objects.push(object);
  }

  function moveObject(object, delta) {
    object.y += speed * delta / 1000;
    object.element.style.top = `${object.y}%`;
  }

  function playerIsSafeFrom(object) {
    if (object.lane !== playerLane) return true;

    if (object.type === "coin") return false;

    if (object.element.classList.contains("tall")) {
      return isSliding;
    }

    return isJumping;
  }

  function collectCoin(object) {
    object.hit = true;
    coins += 1;
    object.element.remove();

    tone(850, 0.07);
    updateHUD();
  }

  function gameLoop(now) {
    if (!running || paused) return;

    const delta = Math.min(now - lastTime, 40);
    lastTime = now;

    const seconds = delta / 1000;

    distance += seconds * (speed / 12);
    speed = Math.min(560, 240 + distance * 0.35);

    spawnTimer += delta;
    coinTimer += delta;

    if (spawnTimer > Math.max(520, 1150 - distance * 0.5)) {
      createObject("obstacle");
      spawnTimer = 0;
    }

    if (coinTimer > 850) {
      createObject("coin");
      coinTimer = 0;
    }

    objects = objects.filter((object) => {
      if (object.hit) return false;

      moveObject(object, delta);

      if (object.y > 75 && object.y < 92) {
        if (playerIsSafeFrom(object)) {
          if (object.type === "coin") {
            collectCoin(object);
          }
        } else if (object.type === "obstacle") {
          finishGame();
          return false;
        }
      }

      if (object.y > 115) {
        object.element.remove();
        return false;
      }

      return true;
    });

    updateHUD();
    animationFrame = requestAnimationFrame(gameLoop);
  }

  function moveLane(direction) {
    if (!running || paused) return;

    playerLane = Math.max(0, Math.min(2, playerLane + direction));
    positionPlayer();
    tone(390, 0.04);
  }

  startBtn.addEventListener("click", startGame);
  pauseBtn.addEventListener("click", pauseGame);
  resumeBtn.addEventListener("click", resumeGame);
  restartBtn.addEventListener("click", startGame);
  playAgainBtn.addEventListener("click", startGame);

  jumpBtn.addEventListener("click", jump);
  slideBtn.addEventListener("click", slide);

  soundBtn.addEventListener("click", () => {
    soundOn = !soundOn;
    soundBtn.textContent = soundOn ? "♫ SOUND ON" : "♪ SOUND OFF";
    if (soundOn) tone(520, 0.08);
  });

  let touchStartX = 0;
  let touchStartY = 0;

  world.addEventListener("touchstart", (event) => {
    const touch = event.changedTouches[0];
    touchStartX = touch.clientX;
    touchStartY = touch.clientY;
  }, { passive: true });

  world.addEventListener("touchend", (event) => {
    const touch = event.changedTouches[0];
    const dx = touch.clientX - touchStartX;
    const dy = touch.clientY - touchStartY;

    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 30) {
      moveLane(dx > 0 ? 1 : -1);
    } else if (dy < -30) {
      jump();
    } else if (dy > 30) {
      slide();
    }
  }, { passive: true });

  document.addEventListener("keydown", (event) => {
    if (event.key === "ArrowLeft" || event.key.toLowerCase() === "a") {
      moveLane(-1);
    }

    if (event.key === "ArrowRight" || event.key.toLowerCase() === "d") {
      moveLane(1);
    }

    if (event.key === "ArrowUp" || event.key === " ") {
      event.preventDefault();
      jump();
    }

    if (event.key === "ArrowDown" || event.key.toLowerCase() === "s") {
      slide();
    }

    if (event.key === "Escape") {
      if (paused) resumeGame();
      else pauseGame();
    }
  });

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) pauseGame();
  });

  window.addEventListener("devil:sound-setting", (event) => {
    soundOn = Boolean(event.detail?.enabled);
    soundBtn.textContent = soundOn ? "♫ SOUND ON" : "♪ SOUND OFF";
  });

  resetWorld();

})();

/* =====================================================
   PART 10 END
   FILE: devil-run/game.js
   NEXT: PART 11 — DEVIL BRICKS HTML
===================================================== */
        
