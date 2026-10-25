
// =====================================================
// DEVIL GAMES
// PART 19: DEVIL MATCH — MATCH-3 GAME LOGIC
// FILE: devil-match/game.js
// NEXT: PART 20 — SHARED GAME FEATURES / IMPROVEMENTS
// =====================================================

(() => {
  "use strict";

  const ROWS = 8;
  const COLS = 8;
  const START_MOVES = 30;

  const BEST_KEY = "devilMatchBest";
  const SOUND_KEY = "devilMatchSound";

  const GEM_TYPES = [
    { icon: "🔴", name: "Ruby", points: 10 },
    { icon: "🔵", name: "Sapphire", points: 10 },
    { icon: "🟢", name: "Emerald", points: 10 },
    { icon: "🟡", name: "Topaz", points: 10 },
    { icon: "🟣", name: "Amethyst", points: 10 },
    { icon: "🟠", name: "Amber", points: 10 }
  ];

  const $ = (id) => document.getElementById(id);

  const boardElement = $("matchBoard");
  const scoreElement = $("matchScoreValue");
  const bestElement = $("matchBestValue");
  const movesElement = $("matchMovesValue");
  const messageElement = $("matchMessage");
  const statusElement = $("matchStatusLabel");

  const startOverlay = $("matchStartOverlay");
  const pauseOverlay = $("matchPauseOverlay");
  const gameOverModal = $("matchGameOverModal");

  const startButton = $("matchStartBtn");
  const pauseButton = $("matchPauseBtn");
  const pauseControlButton = $("matchPauseControlBtn");
  const resumeButton = $("matchResumeBtn");
  const restartButton = $("matchRestartBtn");
  const hintButton = $("matchHintBtn");
  const soundButton = $("matchSoundBtn");
  const playAgainButton = $("matchPlayAgainBtn");

  if (!boardElement) {
    console.error("DEVIL MATCH: Game board not found.");
    return;
  }

  let board = [];
  let score = 0;
  let bestScore = readNumber(BEST_KEY);
  let movesLeft = START_MOVES;
  let selectedCell = null;
  let running = false;
  let paused = false;
  let gameOver = false;
  let busy = false;
  let soundEnabled = readSoundSetting();
  let audioContext = null;
  let hintTimer = null;

  function readNumber(key) {
    try {
      return Math.max(0, Number(localStorage.getItem(key)) || 0);
    } catch {
      return 0;
    }
  }

  function readSoundSetting() {
    try {
      return localStorage.getItem(SOUND_KEY) !== "off";
    } catch {
      return true;
    }
  }

  function saveValue(key, value) {
    try {
      localStorage.setItem(key, String(value));
    } catch {
      // Game continues if browser storage is unavailable.
    }
  }

  function randomGem() {
    return Math.floor(Math.random() * GEM_TYPES.length);
  }

  function wait(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function setMessage(message) {
    if (messageElement) {
      messageElement.textContent = message;
    }
  }

  function setStatus(message) {
    if (statusElement) {
      statusElement.textContent = message;
    }
  }

  function playTone(frequency = 440, duration = 0.07, type = "sine") {
    if (!soundEnabled) return;

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
        frequency,
        audioContext.currentTime
      );

      gain.gain.setValueAtTime(0.045, audioContext.currentTime);
      gain.gain.exponentialRampToValueAtTime(
        0.001,
        audioContext.currentTime + duration
      );

      oscillator.connect(gain);
      gain.connect(audioContext.destination);

      oscillator.start();
      oscillator.stop(audioContext.currentTime + duration);
    } catch {
      // Audio is optional.
    }
  }

  function updateSoundButton() {
    if (!soundButton) return;

    soundButton.textContent = soundEnabled ? "🔊" : "🔇";
    soundButton.setAttribute(
      "aria-label",
      soundEnabled ? "Turn sound off" : "Turn sound on"
    );
  }

  function updateStats() {
    if (scoreElement) scoreElement.textContent = score.toLocaleString();
    if (bestElement) bestElement.textContent = bestScore.toLocaleString();
    if (movesElement) movesElement.textContent = String(movesLeft);
  }

  function createEmptyBoard() {
    board = Array.from({ length: ROWS }, () =>
      Array.from({ length: COLS }, () => null)
    );

    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) {
        let gem;

        do {
          gem = randomGem();
        } while (
          (col >= 2 &&
            board[row][col - 1] === gem &&
            board[row][col - 2] === gem) ||
          (row >= 2 &&
            board[row - 1][col] === gem &&
            board[row - 2][col] === gem)
        );

        board[row][col] = gem;
      }
    }

    if (!hasPossibleMove()) {
      createEmptyBoard();
    }
  }

  function renderBoard() {
    const fragment = document.createDocumentFragment();

    boardElement.innerHTML = "";
    boardElement.setAttribute("aria-rowcount", String(ROWS));
    boardElement.setAttribute("aria-colcount", String(COLS));

    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) {
        const gemIndex = board[row][col];
        const button = document.createElement("button");

        button.type = "button";
        button.className = "match-gem";
        button.dataset.row = String(row);
        button.dataset.col = String(col);
        button.setAttribute("role", "gridcell");
        button.setAttribute(
          "aria-label",
          `${GEM_TYPES[gemIndex].name}, row ${row + 1}, column ${col + 1}`
        );

        button.textContent = GEM_TYPES[gemIndex].icon;

        if (
          selectedCell &&
          selectedCell.row === row &&
          selectedCell.col === col
        ) {
          button.classList.add("selected");
          button.setAttribute("aria-pressed", "true");
        }

        if (!running || paused || busy || gameOver) {
          button.disabled = true;
        }

        fragment.appendChild(button);
      }
    }

    boardElement.appendChild(fragment);
  }

  function findMatches() {
    const matched = new Set();

    // Horizontal matches.
    for (let row = 0; row < ROWS; row++) {
      let start = 0;

      while (start < COLS) {
        const gem = board[row][start];
        let end = start + 1;

        while (end < COLS && board[row][end] === gem) {
          end++;
        }

        if (gem !== null && end - start >= 3) {
          for (let col = start; col < end; col++) {
            matched.add(`${row},${col}`);
          }
        }

        start = end;
      }
    }

    // Vertical matches.
    for (let col = 0; col < COLS; col++) {
      let start = 0;

      while (start < ROWS) {
        const gem = board[start][col];
        let end = start + 1;

        while (end < ROWS && board[end][col] === gem) {
          end++;
        }

        if (gem !== null && end - start >= 3) {
          for (let row = start; row < end; row++) {
            matched.add(`${row},${col}`);
          }
        }

        start = end;
      }
    }

    return matched;
  }

  function getAdjacentMoves() {
    const candidates = [];

    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) {
        if (col + 1 < COLS) {
          candidates.push([
            { row, col },
            { row, col: col + 1 }
          ]);
        }

        if (row + 1 < ROWS) {
          candidates.push([
            { row, col },
            { row: row + 1, col }
          ]);
        }
      }
    }

    return candidates;
  }

  function swapBoardCells(a, b) {
    const temporary = board[a.row][a.col];
    board[a.row][a.col] = board[b.row][b.col];
    board[b.row][b.col] = temporary;
  }

  function hasPossibleMove() {
    const candidates = getAdjacentMoves();

    for (const [a, b] of candidates) {
      swapBoardCells(a, b);
      const foundMatch = findMatches().size > 0;
      swapBoardCells(a, b);

      if (foundMatch) return true;
    }

    return false;
  }

  function areAdjacent(a, b) {
    return (
      Math.abs(a.row - b.row) + Math.abs(a.col - b.col) === 1
    );
  }

  async function handleCellClick(row, col) {
    if (!running || paused || busy || gameOver) return;

    const current = { row, col };

    if (!selectedCell) {
      selectedCell = current;
      renderBoard();
      playTone(520, 0.04);
      return;
    }

    if (
      selectedCell.row === row &&
      selectedCell.col === col
    ) {
      selectedCell = null;
      renderBoard();
      return;
    }

    if (!areAdjacent(selectedCell, current)) {
      selectedCell = current;
      renderBoard();
      playTone(520, 0.04);
      return;
    }

    const first = selectedCell;
    selectedCell = null;

    await attemptSwap(first, current);
  }

  async function attemptSwap(a, b) {
    if (!running || paused || busy || gameOver) return;

    busy = true;
    swapBoardCells(a, b);
    renderBoard();

    await wait(100);

    if (findMatches().size === 0) {
      swapBoardCells(a, b);
      renderBoard();
      setMessage("No match! Try another swap.");
      playTone(180, 0.09, "triangle");
      busy = false;
      return;
    }

    movesLeft--;
    updateStats();
    playTone(620, 0.07);
    setMessage("Nice move! Keep matching gems.");

    await resolveMatches();

    busy = false;

    if (movesLeft <= 0) {
      finishGame();
      return;
    }

    if (!hasPossibleMove()) {
      setMessage("Board shuffled — find new matches!");
      createEmptyBoard();
      renderBoard();
    } else {
      renderBoard();
    }

    setStatus("GAME IN PROGRESS");
  }

  async function resolveMatches() {
    let combo = 0;

    while (true) {
      const matches = findMatches();
      if (matches.size === 0) break;

      combo++;

      matches.forEach((key) => {
        const [row, col] = key.split(",").map(Number);
        const cell = boardElement.querySelector(
          `[data-row="${row}"][data-col="${col}"]`
        );

        if (cell) cell.classList.add("matched");
      });

      score += matches.size * 10 * combo;

      if (matches.size >= 4) {
        score += (matches.size - 3) * 25;
      }

      if (combo > 1) {
        setMessage(`COMBO x${combo}! Bonus points!`);
        playTone(600 + combo * 100, 0.11, "sine");
      }

      if (score > bestScore) {
        bestScore = score;
        saveValue(BEST_KEY, bestScore);
      }

      updateStats();
      await wait(230);

      for (const key of matches) {
        const [row, col] = key.split(",").map(Number);
        board[row][col] = null;
      }

      // Drop gems downward.
      for (let col = 0; col < COLS; col++) {
        let writeRow = ROWS - 1;

        for (let row = ROWS - 1; row >= 0; row--) {
          if (board[row][col] !== null) {
            board[writeRow][col] = board[row][col];
            writeRow--;
          }
        }

        while (writeRow >= 0) {
          board[writeRow][col] = randomGem();
          writeRow--;
        }
      }

      renderBoard();
      await wait(150);
    }

    if (score > bestScore) {
      bestScore = score;
      saveValue(BEST_KEY, bestScore);
    }

    updateStats();
  }

  function startGame() {
    clearTimeout(hintTimer);

    score = 0;
    movesLeft = START_MOVES;
    selectedCell = null;
    running = true;
    paused = false;
    gameOver = false;
    busy = false;

    if (startOverlay) startOverlay.hidden = true;
    if (pauseOverlay) pauseOverlay.hidden = true;
    if (gameOverModal) gameOverModal.hidden = true;

    createEmptyBoard();
    updateStats();
    renderBoard();

    setStatus("GAME IN PROGRESS");
    setMessage("Match 3 or more gems to score points!");
    playTone(520, 0.08);
  }

  function pauseGame() {
    if (!running || gameOver || busy) return;

    paused = !paused;

    if (pauseOverlay) pauseOverlay.hidden = !paused;

    if (paused) {
      setStatus("GAME PAUSED");
      setMessage("Game paused. Resume when ready.");
    } else {
      setStatus("GAME IN PROGRESS");
      setMessage("Back to the puzzle!");
    }

    renderBoard();
  }

  function finishGame() {
    running = false;
    paused = false;
    gameOver = true;
    selectedCell = null;

    if (pauseOverlay) pauseOverlay.hidden = true;
    if (gameOverModal) gameOverModal.hidden = false;

    const finalScore = $("matchFinalScore");
    const resultTitle = $("matchResultTitle");
    const resultIcon = $("matchResultIcon");

    if (finalScore) finalScore.textContent = score.toLocaleString();

    if (resultTitle) {
      resultTitle.textContent =
        score >= bestScore && score > 0
          ? "New Best Score!"
          : "Game Over!";
    }

    if (resultIcon) {
      resultIcon.textContent =
        score >= bestScore && score > 0 ? "🏆" : "💎";
    }

    setStatus("CHALLENGE COMPLETE");
    setMessage("No moves left. Try again and beat your score!");
    updateStats();
    renderBoard();
    playTone(260, 0.25, "triangle");
  }

  function showHint() {
    if (!running || paused || busy || gameOver) {
      setMessage("Start or resume the game to use hints.");
      return;
    }

    clearTimeout(hintTimer);

    for (const [a, b] of getAdjacentMoves()) {
      swapBoardCells(a, b);
      const hasMatch = findMatches().size > 0;
      swapBoardCells(a, b);

      if (hasMatch) {
        selectedCell = a;
        renderBoard();

        const hintedCell = boardElement.querySelector(
          `[data-row="${b.row}"][data-col="${b.col}"]`
        );

        if (hintedCell) {
          hintedCell.classList.add("selected");
        }

        setMessage("Hint: try swapping the two highlighted gems!");
        playTone(780, 0.08);

        hintTimer = setTimeout(() => {
          selectedCell = null;
          renderBoard();
        }, 1400);

        return;
      }
    }

    createEmptyBoard();
    renderBoard();
    setMessage("New board ready — look for a match!");
  }

  function toggleSound() {
    soundEnabled = !soundEnabled;
    saveValue(SOUND_KEY, soundEnabled ? "on" : "off");
    updateSoundButton();

    if (soundEnabled) {
      playTone(660, 0.08);
      setMessage("Sound enabled.");
    } else {
      setMessage("Sound muted.");
    }
  }

  // Tap support.
  boardElement.addEventListener("click", (event) => {
    const cell = event.target.closest(".match-gem, .match-cell");
    if (!cell || !boardElement.contains(cell)) return;

    const row = Number(cell.dataset.row);
    const col = Number(cell.dataset.col);

    if (!Number.isInteger(row) || !Number.isInteger(col)) return;

    handleCellClick(row, col);
  });

  // Swipe support for touchscreen devices.
  let touchStart = null;

  boardElement.addEventListener("pointerdown", (event) => {
    const cell = event.target.closest(".match-gem, .match-cell");
    if (!cell || event.pointerType === "mouse") return;

    touchStart = {
      x: event.clientX,
      y: event.clientY,
      row: Number(cell.dataset.row),
      col: Number(cell.dataset.col)
    };
  });

  boardElement.addEventListener("pointerup", (event) => {
    if (!touchStart || event.pointerType === "mouse") return;

    const start = touchStart;
    touchStart = null;

    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;

    if (Math.max(Math.abs(dx), Math.abs(dy)) < 18) return;

    let row = start.row;
    let col = start.col;

    if (Math.abs(dx) > Math.abs(dy)) {
      col += dx > 0 ? 1 : -1;
    } else {
      row += dy > 0 ? 1 : -1;
    }

    if (row < 0 || row >= ROWS || col < 0 || col >= COLS) {
      return;
    }

    if (!running || paused || busy || gameOver) return;

    selectedCell = null;
    attemptSwap(start, { row, col });
  });

  boardElement.addEventListener("pointercancel", () => {
    touchStart = null;
  });

  if (startButton) startButton.addEventListener("click", startGame);
  if (resumeButton) resumeButton.addEventListener("click", pauseGame);
  if (pauseButton) pauseButton.addEventListener("click", pauseGame);
  if (pauseControlButton) {
    pauseControlButton.addEventListener("click", pauseGame);
  }
  if (restartButton) restartButton.addEventListener("click", startGame);
  if (playAgainButton) playAgainButton.addEventListener("click", startGame);
  if (hintButton) hintButton.addEventListener("click", showHint);
  if (soundButton) soundButton.addEventListener("click", toggleSound);

  // Initial screen.
  bestScore = readNumber(BEST_KEY);
  updateStats();
  updateSoundButton();
  createEmptyBoard();
  renderBoard();

  if (startOverlay) startOverlay.hidden = false;
  if (pauseOverlay) pauseOverlay.hidden = true;
  if (gameOverModal) gameOverModal.hidden = true;

  setStatus("READY TO PLAY");
  setMessage("Press START GAME to begin.");

  // ===================================================
  // PART 19 COMPLETE
  // NEXT PART: PART 20 — SHARED GAME FEATURES / IMPROVEMENTS
  // ===================================================
})();
    
