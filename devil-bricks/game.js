
// =====================================================
// DEVIL GAMES
// PART 13: DEVIL BRICKS — GAME LOGIC
// FILE: devil-bricks/game.js
// NEXT: PART 14 — devil-tic-tac-toe/index.html
// =====================================================

(() => {
  "use strict";

  const $ = (selector) => document.querySelector(selector);

  const canvas = $("#brickCanvas");
  const ctx = canvas.getContext("2d");

  const scoreEl = $("#brickScoreValue");
  const bestEl = $("#brickBestValue");
  const livesEl = $("#brickLivesValue");
  const messageEl = $("#brickMessage");

  const startOverlay = $("#brickStartOverlay");
  const pauseOverlay = $("#brickPauseOverlay");
  const gameOverModal = $("#brickGameOverModal");

  const startBtn = $("#brickStartBtn");
  const pauseBtn = $("#brickPauseBtn");
  const resumeBtn = $("#brickResumeBtn");
  const launchBtn = $("#launchBtn");
  const restartBtn = $("#brickRestartBtn");
  const soundBtn = $("#brickSoundBtn");
  const playAgainBtn = $("#brickPlayAgainBtn");

  const leftBtn = $("#moveLeftBtn");
  const rightBtn = $("#moveRightBtn");

  const STORAGE_KEY = "devilBricksBest";
  const SETTINGS_KEY = "devilGamesSettings";

  let width = 360;
  let height = 500;
  let dpr = 1;

  let score = 0;
  let best = readBest();
  let lives = 3;
  let running = false;
  let paused = false;
  let gameOver = false;
  let ballAttached = true;
  let soundEnabled = readSoundSetting();

  let animationId = 0;
  let lastTime = 0;
  let moveDirection = 0;
  let pointerActive = false;
  let audioContext = null;

  const paddle = {
    x: 0,
    y: 0,
    width: 84,
    height: 12,
    speed: 390
  };

  const ball = {
    x: 0,
    y: 0,
    radius: 7,
    vx: 190,
    vy: -260
  };

  let bricks = [];
  let particles = [];

  const colors = [
    "#ff477e",
    "#ff9f43",
    "#ffe45e",
    "#35e5a1",
    "#39c8ff",
    "#8b70ff",
    "#e76bff"
  ];

  function readBest() {
    try {
      return Number(localStorage.getItem(STORAGE_KEY)) || 0;
    } catch {
      return 0;
    }
  }

  function readSoundSetting() {
    try {
      const settings = JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}");
      return settings.sound !== false;
    } catch {
      return true;
    }
  }

  function saveBest() {
    try {
      localStorage.setItem(STORAGE_KEY, String(best));
    } catch {}
  }

  function updateStats() {
    scoreEl.textContent = score;
    bestEl.textContent = best;
    livesEl.textContent = lives;
  }

  function setMessage(text) {
    messageEl.textContent = text;
  }

  // AUDIO EFFECTS

  function playTone(frequency = 440, duration = 0.07, type = "sine") {
    if (!soundEnabled) return;

    try {
      const AudioContextClass =
        window.AudioContext || window.webkitAudioContext;

      if (!AudioContextClass) return;

      if (!audioContext) audioContext = new AudioContextClass();

      if (audioContext.state === "suspended") {
        audioContext.resume();
      }

      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();

      oscillator.type = type;
      oscillator.frequency.value = frequency;

      gain.gain.setValueAtTime(0.08, audioContext.currentTime);
      gain.gain.exponentialRampToValueAtTime(
        0.001,
        audioContext.currentTime + duration
      );

      oscillator.connect(gain);
      gain.connect(audioContext.destination);

      oscillator.start();
      oscillator.stop(audioContext.currentTime + duration);
    } catch {}
  }

  function updateSoundButton() {
    soundBtn.textContent = soundEnabled ? "🔊 SOUND ON" : "🔇 SOUND OFF";
  }

  soundBtn.addEventListener("click", () => {
    soundEnabled = !soundEnabled;
    updateSoundButton();
    playTone(620, 0.08);
  });

  window.addEventListener("devil:sound-setting", (event) => {
    soundEnabled = event.detail?.enabled !== false;
    updateSoundButton();
  });

  // CANVAS RESIZE

  function resizeCanvas() {
    const rect = canvas.getBoundingClientRect();

    if (!rect.width || !rect.height) return;

    dpr = Math.min(window.devicePixelRatio || 1, 2);
    width = rect.width;
    height = rect.height;

    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    paddle.width = Math.min(88, width * 0.25);
    paddle.height = 12;
    paddle.y = height - 37;

    paddle.x = clamp(paddle.x || width / 2, paddle.width / 2, width - paddle.width / 2);

    if (ballAttached) attachBall();

    draw();
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  window.addEventListener("resize", resizeCanvas);

  // BRICK FIELD

  function createBricks() {
    bricks = [];

    const columns = width < 400 ? 7 : 9;
    const rows = 5;
    const gap = 5;
    const sidePadding = 12;
    const brickWidth =
      (width - sidePadding * 2 - gap * (columns - 1)) / columns;
    const brickHeight = 17;
    const top = 58;

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < columns; col++) {
        bricks.push({
          x: sidePadding + col * (brickWidth + gap),
          y: top + row * (brickHeight + gap),
          width: brickWidth,
          height: brickHeight,
          color: colors[(row + col) % colors.length],
          hits: row === 4 ? 2 : 1,
          alive: true
        });
      }
    }
  }

  function resetBall() {
    ball.radius = 7;
    ball.vx = (Math.random() < 0.5 ? -1 : 1) * 185;
    ball.vy = -260;
    ballAttached = true;
    attachBall();
  }

  function attachBall() {
    ball.x = paddle.x;
    ball.y = paddle.y - ball.radius - 2;
  }

  function resetGame() {
    cancelAnimationFrame(animationId);

    score = 0;
    lives = 3;
    running = false;
    paused = false;
    gameOver = false;
    moveDirection = 0;
    particles = [];

    paddle.x = width / 2;
    paddle.y = height - 37;

    resetBall();
    createBricks();
    updateStats();

    startOverlay.hidden = false;
    pauseOverlay.hidden = true;
    gameOverModal.hidden = true;

    pauseBtn.textContent = "Ⅱ";
    setMessage("Tap START GAME to begin.");
    draw();
  }

  // DRAWING

  function roundedRect(x, y, w, h, r) {
    const radius = Math.min(r, w / 2, h / 2);

    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.arcTo(x + w, y, x + w, y + h, radius);
    ctx.arcTo(x + w, y + h, x, y + h, radius);
    ctx.arcTo(x, y + h, x, y, radius);
    ctx.arcTo(x, y, x + w, y, radius);
    ctx.closePath();
  }

  function drawBackground() {
    const gradient = ctx.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, "#111125");
    gradient.addColorStop(0.55, "#090915");
    gradient.addColorStop(1, "#160c24");

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    ctx.save();
    ctx.strokeStyle = "rgba(180, 160, 255, 0.045)";
    ctx.lineWidth = 1;

    const gridSize = 28;

    for (let x = 0; x < width; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }

    for (let y = 0; y < height; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    ctx.restore();
  }

  function drawBricks() {
    bricks.forEach((brick) => {
      if (!brick.alive) return;

      ctx.save();

      ctx.shadowColor = brick.color;
      ctx.shadowBlur = 8;

      roundedRect(
        brick.x,
        brick.y,
        brick.width,
        brick.height,
        4
      );

      ctx.fillStyle =
        brick.hits > 1 ? "#ffffff" : brick.color;

      ctx.fill();

      ctx.shadowBlur = 0;
      roundedRect(
        brick.x + 2,
        brick.y + 2,
        brick.width - 4,
        3,
        2
      );

      ctx.fillStyle = "rgba(255,255,255,0.35)";
      ctx.fill();

      if (brick.hits > 1) {
        ctx.fillStyle = "#28203d";
        ctx.font = "bold 10px Arial";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(
          "2",
          brick.x + brick.width / 2,
          brick.y + brick.height / 2 + 1
        );
      }

      ctx.restore();
    });
  }

  function drawPaddle() {
    ctx.save();

    const gradient = ctx.createLinearGradient(
      paddle.x - paddle.width / 2,
      paddle.y,
      paddle.x + paddle.width / 2,
      paddle.y + paddle.height
    );

    gradient.addColorStop(0, "#39c8ff");
    gradient.addColorStop(0.5, "#a855f7");
    gradient.addColorStop(1, "#ff477e");

    ctx.shadowColor = "#a855f7";
    ctx.shadowBlur = 18;

    roundedRect(
      paddle.x - paddle.width / 2,
      paddle.y,
      paddle.width,
      paddle.height,
      7
    );

    ctx.fillStyle = gradient;
    ctx.fill();

    ctx.restore();
  }

  function drawBall() {
    ctx.save();

    ctx.shadowColor = "#ffffff";
    ctx.shadowBlur = 17;

    const gradient = ctx.createRadialGradient(
      ball.x - 2,
      ball.y - 3,
      1,
      ball.x,
      ball.y,
      ball.radius
    );

    gradient.addColorStop(0, "#ffffff");
    gradient.addColorStop(0.45, "#d9faff");
    gradient.addColorStop(1, "#39c8ff");

    ctx.beginPath();
    ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
    ctx.fillStyle = gradient;
    ctx.fill();

    ctx.restore();
  }

  function drawParticles() {
    particles.forEach((particle) => {
      ctx.globalAlpha = Math.max(0, particle.life);
      ctx.fillStyle = particle.color;
      ctx.fillRect(
        particle.x,
        particle.y,
        particle.size,
        particle.size
      );
    });

    ctx.globalAlpha = 1;
  }

  function draw() {
    if (!ctx) return;

    drawBackground();
    drawBricks();
    drawPaddle();
    drawBall();
    drawParticles();
  }

  // PARTICLE EFFECT

  function burst(x, y, color) {
    for (let i = 0; i < 8; i++) {
      particles.push({
        x,
        y,
        vx: (Math.random() - 0.5) * 180,
        vy: (Math.random() - 0.5) * 180,
        size: 2 + Math.random() * 4,
        life: 1,
        color
      });
    }
  }

  function updateParticles(dt) {
    particles.forEach((particle) => {
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      particle.life -= dt * 1.8;
    });

    particles = particles.filter((particle) => particle.life > 0);
  }

  // GAME START / PAUSE

  function startGame() {
    if (gameOver) resetGame();

    startOverlay.hidden = true;
    pauseOverlay.hidden = true;
    gameOverModal.hidden = true;

    running = true;
    paused = false;

    if (ballAttached) launchBall();

    lastTime = performance.now();
    cancelAnimationFrame(animationId);
    animationId = requestAnimationFrame(loop);

    setMessage("Break the bricks and collect points!");
  }

  function launchBall() {
    if (!running || paused || gameOver) {
      if (!gameOver && !paused) startGame();
      return;
    }

    if (!ballAttached) return;

    ballAttached = false;
    ball.vx = (Math.random() < 0.5 ? -1 : 1) * 185;
    ball.vy = -270;

    playTone(540, 0.08, "triangle");
    setMessage("Ball launched!");
  }

  function pauseGame() {
    if (!running || gameOver) return;

    paused = !paused;
    pauseOverlay.hidden = !paused;
    pauseBtn.textContent = paused ? "▶" : "Ⅱ";

    if (paused) {
      cancelAnimationFrame(animationId);
      setMessage("Game paused.");
    } else {
      lastTime = performance.now();
      animationId = requestAnimationFrame(loop);
      setMessage("Keep breaking bricks!");
    }
  }

  function finishGame(won = false) {
    if (gameOver) return;

    gameOver = true;
    running = false;
    paused = false;

    cancelAnimationFrame(animationId);

    if (score > best) {
      best = score;
      saveBest();
    }

    updateStats();

    $("#brickResultTitle").textContent = won ? "YOU WIN!" : "GAME OVER";
    $("#brickResultIcon").textContent = won ? "🏆" : "💥";
    $("#brickFinalScore").textContent = score;

    gameOverModal.hidden = false;
    pauseOverlay.hidden = true;

    setMessage(won ? "Amazing! All bricks cleared." : "Try again and beat your best!");
    playTone(won ? 740 : 180, 0.25, "sawtooth");
  }

  // COLLISION HELPERS

  function circleRectCollision(circle, rect) {
    const nearestX = clamp(circle.x, rect.x, rect.x + rect.width);
    const nearestY = clamp(circle.y, rect.y, rect.y + rect.height);

    const dx = circle.x - nearestX;
    const dy = circle.y - nearestY;

    return dx * dx + dy * dy < circle.radius * circle.radius;
  }

  function hitBrick(brick) {
    brick.hits--;

    if (brick.hits <= 0) {
      brick.alive = false;
      score += 10;
      burst(
        brick.x + brick.width / 2,
        brick.y + brick.height / 2,
        brick.color
      );

      playTone(460 + Math.random() * 300, 0.045, "triangle");
    } else {
      score += 5;
      playTone(300, 0.04);
    }

    if (score > best) best = score;
    updateStats();

    if (bricks.every((item) => !item.alive)) {
      finishGame(true);
    }
  }

  function loseLife() {
    lives--;
    updateStats();

    playTone(140, 0.22, "sawtooth");

    if (lives <= 0) {
      finishGame(false);
      return;
    }

    resetBall();
    setMessage("Life lost! Tap LAUNCH BALL to continue.");
  }

  // PHYSICS

  function update(dt) {
    if (!running || paused || gameOver) return;

    if (moveDirection !== 0) {
      paddle.x += moveDirection * paddle.speed * dt;
      paddle.x = clamp(
        paddle.x,
        paddle.width / 2,
        width - paddle.width / 2
      );
    }

    if (ballAttached) {
      attachBall();
      updateParticles(dt);
      draw();
      return;
    }

    ball.x += ball.vx * dt;
    ball.y += ball.vy * dt;

    // Side walls
    if (ball.x - ball.radius < 0) {
      ball.x = ball.radius;
      ball.vx = Math.abs(ball.vx);
      playTone(260, 0.025);
    }

    if (ball.x + ball.radius > width) {
      ball.x = width - ball.radius;
      ball.vx = -Math.abs(ball.vx);
      playTone(260, 0.025);
    }

    // Top wall
    if (ball.y - ball.radius < 0) {
      ball.y = ball.radius;
      ball.vy = Math.abs(ball.vy);
      playTone(300, 0.025);
    }

    // Paddle collision
    const paddleRect = {
      x: paddle.x - paddle.width / 2,
      y: paddle.y,
      width: paddle.width,
      height: paddle.height
    };

    if (
      ball.vy > 0 &&
      circleRectCollision(ball, paddleRect)
    ) {
      ball.y = paddle.y - ball.radius;
      const offset = (ball.x - paddle.x) / (paddle.width / 2);

      ball.vx = clamp(offset, -1, 1) * 320;
      if (Math.abs(ball.vx) < 65) {
        ball.vx = ball.vx < 0 ? -65 : 65;
      }

      ball.vy = -Math.max(220, Math.sqrt(270 * 270 - Math.min(ball.vx * ball.vx, 60000)));
      playTone(520, 0.06, "triangle");
    }

    // Brick collisions
    for (const brick of bricks) {
      if (!brick.alive) continue;

      if (circleRectCollision(ball, brick)) {
        const previousX = ball.x - ball.vx * dt;
        const previousY = ball.y - ball.vy * dt;

        if (
          previousY + ball.radius <= brick.y ||
          previousY - ball.radius >= brick.y + brick.height
        ) {
          ball.vy *= -1;
        } else if (
          previousX + ball.radius <= brick.x ||
          previousX - ball.radius >= brick.x + brick.width
        ) {
          ball.vx *= -1;
        } else {
          ball.vy *= -1;
        }

        hitBrick(brick);
        break;
      }
    }

    // Ball fell below the paddle
    if (ball.y - ball.radius > height) {
      loseLife();
    }

    updateParticles(dt);
    draw();
  }

  function loop(timestamp) {
    if (!running || paused || gameOver) return;

    const dt = Math.min((timestamp - lastTime) / 1000, 0.032);
    lastTime = timestamp;

    update(dt);

    if (running && !paused && !gameOver) {
      animationId = requestAnimationFrame(loop);
    }
  }

  // CONTROLS

  startBtn.addEventListener("click", startGame);
  resumeBtn.addEventListener("click", pauseGame);
  pauseBtn.addEventListener("click", pauseGame);
  launchBtn.addEventListener("click", launchBall);

  restartBtn.addEventListener("click", resetGame);
  playAgainBtn.addEventListener("click", () => {
    resetGame();
    startGame();
  });

  function setDirection(direction) {
    moveDirection = direction;
  }

  function bindHoldButton(button, direction) {
    button.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      setDirection(direction);

      try {
        button.setPointerCapture(event.pointerId);
      } catch {}
    });

    const stop = () => {
      if (moveDirection === direction) setDirection(0);
    };

    button.addEventListener("pointerup", stop);
    button.addEventListener("pointercancel", stop);
    button.addEventListener("lostpointercapture", stop);
    button.addEventListener("contextmenu", (event) => event.preventDefault());
  }

  bindHoldButton(leftBtn, -1);
  bindHoldButton(rightBtn, 1);

  canvas.addEventListener("pointerdown", (event) => {
    if (gameOver) return;

    pointerActive = true;
    canvas.setPointerCapture?.(event.pointerId);

    const rect = canvas.getBoundingClientRect();
    paddle.x = clamp(
      event.clientX - rect.left,
      paddle.width / 2,
      width - paddle.width / 2
    );

    if (ballAttached && running && !paused) attachBall();
    draw();
  });

  canvas.addEventListener("pointermove", (event) => {
    if (!pointerActive || !running || paused || gameOver) return;

    const rect = canvas.getBoundingClientRect();

    paddle.x = clamp(
      event.clientX - rect.left,
      paddle.width / 2,
      width - paddle.width / 2
    );

    if (ballAttached) attachBall();
    draw();
  });

  canvas.addEventListener("pointerup", () => {
    pointerActive = false;
  });

  canvas.addEventListener("pointercancel", () => {
    pointerActive = false;
  });

  window.addEventListener("keydown", (event) => {
    if (["ArrowLeft", "ArrowRight", " "].includes(event.key)) {
      event.preventDefault();
    }

    if (event.key === "ArrowLeft" || event.key.toLowerCase() === "a") {
      setDirection(-1);
    }

    if (event.key === "ArrowRight" || event.key.toLowerCase() === "d") {
      setDirection(1);
    }

    if (event.key === " " || event.key === "Enter") {
      if (!running) startGame();
      else if (ballAttached) launchBall();
    }

    if (event.key.toLowerCase() === "p" || event.key === "Escape") {
      if (running) pauseGame();
    }
  });

  window.addEventListener("keyup", (event) => {
    if (
      ["ArrowLeft", "ArrowRight"].includes(event.key) ||
      ["a", "d"].includes(event.key.toLowerCase())
    ) {
      setDirection(0);
    }
  });

  // INITIALIZE

  updateSoundButton();
  bestEl.textContent = best;
  resizeCanvas();
  resetGame();

})();

// =====================================================
// PART 13 END
// FILE: devil-bricks/game.js
// NEXT PART 14: devil-tic-tac-toe/index.html
// =====================================================
      
