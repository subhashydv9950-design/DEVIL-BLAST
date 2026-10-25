
/* =====================================================
   DEVIL GAMES — PART 06
   FILE: devil-blast/game.js
   PURPOSE: 8x8 BLOCK PUZZLE GAME LOGIC
   FEATURES: SCORING, BLOCK PLACEMENT, ROW/COLUMN CLEAR,
             HIGH SCORE, HINT, PAUSE, RESTART, SOUND
   NEXT: PART 07 — DEVIL BLAST IMPROVEMENTS
===================================================== */

"use strict";

(() => {
  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => [...document.querySelectorAll(selector)];

  const boardElement = $("#gameBoard");
  const trayElement = $("#blockTray");
  const scoreElement = $("#scoreValue");
  const bestElement = $("#bestValue");
  const clearElement = $("#clearValue");
  const blocksLeftElement = $("#blocksLeft");
  const messageTitle = $("#messageTitle");
  const messageText = $("#messageText");

  const modal = $("#gameModal");
  const modalTitle = $("#modalTitle");
  const modalText = $("#modalText");
  const modalSymbol = $("#modalSymbol");
  const resumeBtn = $("#resumeBtn");
  const restartBtn = $("#restartBtn");
  const modalRestartBtn = $("#modalRestartBtn");
  const pauseBtn = $("#pauseBtn");
  const soundBtn = $("#soundBtn");
  const hintBtn = $("#hintBtn");
  const finalScoreBox = $("#finalScoreBox");
  const finalScore = $("#finalScore");

  const SIZE = 8;
  const COLORS = [
    "red", "blue", "green", "yellow",
    "purple", "orange", "pink", "cyan"
  ];

  const SHAPES = [
    [[0, 0]],
    [[0, 0], [0, 1]],
    [[0, 0], [1, 0]],
    [[0, 0], [0, 1], [0, 2]],
    [[0, 0], [1, 0], [2, 0]],
    [[0, 0], [0, 1], [1, 0], [1, 1]],
    [[0, 0], [0, 1], [0, 2], [1, 1]],
    [[0, 0], [1, 0], [2, 0], [2, 1]],
    [[0, 0], [0, 1], [0, 2], [1, 0]],
    [[0, 0], [1, 0], [1, 1], [2, 1]],
    [[0, 0], [0, 1], [0, 2], [0, 3]],
    [[0, 0], [1, 0], [2, 0], [3, 0]],
    [[0, 0], [0, 1], [0, 2], [1, 0], [1, 1], [1, 2]],
    [[0, 0], [1, 0], [2, 0], [0, 1], [1, 1], [2, 1]],
    [[0, 0], [1, 0], [1, 1], [1, 2]]
  ];

  let board = [];
  let pieces = [];
  let selectedSlot = -1;
  let score = 0;
  let clearedCount = 0;
  let bestScore = Number(localStorage.getItem("devilBlastBest") || 0);
  let paused = false;
  let gameOver = false;
  let soundOn = true;
  let audioContext = null;
  let hintPosition = null;

  const makeEmptyBoard = () =>
    Array.from({ length: SIZE }, () => Array(SIZE).fill(null));

  function randomPiece() {
    const shape = SHAPES[Math.floor(Math.random() * SHAPES.length)];
    const color = COLORS[Math.floor(Math.random() * COLORS.length)];

    return {
      shape: shape.map(([r, c]) => [r, c]),
      color
    };
  }

  function updateMessage(title, text) {
    messageTitle.textContent = title;
    messageText.textContent = text;
  }

  function playTone(frequency = 520, duration = 0.07) {
    if (!soundOn) return;

    try {
      const AudioContextClass =
        window.AudioContext || window.webkitAudioContext;

      if (!AudioContextClass) return;

      audioContext ||= new AudioContextClass();

      if (audioContext.state === "suspended") {
        audioContext.resume();
      }

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
    } catch (error) {
      console.warn("Audio unavailable:", error);
    }
  }

  function updateScore(points) {
    score += points;

    if (score > bestScore) {
      bestScore = score;
      localStorage.setItem("devilBlastBest", String(bestScore));
    }

    scoreElement.textContent = score.toLocaleString();
    bestElement.textContent = bestScore.toLocaleString();
  }

  function updateClearedCount(count) {
    clearedCount += count;
    clearElement.textContent = clearedCount.toLocaleString();
  }

  function renderBoard() {
    boardElement.innerHTML = "";

    for (let row = 0; row < SIZE; row++) {
      for (let col = 0; col < SIZE; col++) {
        const cell = document.createElement("button");

        cell.type = "button";
        cell.className = "board-cell";
        cell.dataset.row = row;
        cell.dataset.col = col;
        cell.setAttribute("role", "gridcell");
        cell.setAttribute(
          "aria-label",
          `Row ${row + 1}, column ${col + 1}`
        );

        if (board[row][col]) {
          cell.classList.add("filled", `block-${board[row][col]}`);
        }

        boardElement.appendChild(cell);
      }
    }
  }

  function renderTray() {
    $$(".block-slot").forEach((slot, index) => {
      const shapeContainer = slot.querySelector(".block-shape");
      const piece = pieces[index];

      shapeContainer.innerHTML = "";
      slot.classList.toggle("selected", index === selectedSlot);
      slot.classList.toggle("empty", !piece);

      if (!piece) {
        slot.disabled = true;
        return;
      }

      slot.disabled = false;

      const maxRow = Math.max(...piece.shape.map(([r]) => r));
      const maxCol = Math.max(...piece.shape.map(([, c]) => c));

      shapeContainer.style.gridTemplateRows =
        `repeat(${maxRow + 1}, auto)`;
      shapeContainer.style.gridTemplateColumns =
        `repeat(${maxCol + 1}, auto)`;

      piece.shape.forEach(([r, c]) => {
        const block = document.createElement("span");
        block.className = `shape-cell block-${piece.color}`;
        block.style.gridRow = String(r + 1);
        block.style.gridColumn = String(c + 1);
        shapeContainer.appendChild(block);
      });
    });

    const count = pieces.filter(Boolean).length;
    blocksLeftElement.textContent = `${count} BLOCK${count === 1 ? "" : "S"}`;
  }

  function canPlace(piece, startRow, startCol) {
    if (!piece) return false;

    return piece.shape.every(([r, c]) => {
      const row = startRow + r;
      const col = startCol + c;

      return (
        row >= 0 &&
        row < SIZE &&
        col >= 0 &&
        col < SIZE &&
        board[row][col] === null
      );
    });
  }

  function clearPreview() {
    $$(".board-cell").forEach((cell) => {
      cell.classList.remove("preview-valid", "preview-invalid");
    });
  }

  function showPreview(row, col) {
    clearPreview();

    if (
      paused ||
      gameOver ||
      selectedSlot < 0 ||
      !pieces[selectedSlot]
    ) {
      return;
    }

    const piece = pieces[selectedSlot];
    const valid = canPlace(piece, row, col);

    piece.shape.forEach(([r, c]) => {
      const target = boardElement.querySelector(
        `[data-row="${row + r}"][data-col="${col + c}"]`
      );

      if (target) {
        target.classList.add(
          valid ? "preview-valid" : "preview-invalid"
        );
      }
    });
  }

  function findClears() {
    const rows = [];
    const cols = [];

    for (let row = 0; row < SIZE; row++) {
      if (board[row].every(Boolean)) rows.push(row);
    }

    for (let col = 0; col < SIZE; col++) {
      if (board.every((row) => Boolean(row[col]))) cols.push(col);
    }

    return { rows, cols };
  }

  function clearLines() {
    const { rows, cols } = findClears();
    const uniqueCells = new Set();

    rows.forEach((row) => {
      for (let col = 0; col < SIZE; col++) {
        uniqueCells.add(`${row},${col}`);
      }
    });

    cols.forEach((col) => {
      for (let row = 0; row < SIZE; row++) {
        uniqueCells.add(`${row},${col}`);
      }
    });

    if (!uniqueCells.size) return 0;

    uniqueCells.forEach((key) => {
      const [row, col] = key.split(",").map(Number);
      board[row][col] = null;
    });

    const lineCount = rows.length + cols.length;
    updateScore(uniqueCells.size * 10 + lineCount * 25);
    updateClearedCount(lineCount);
    playTone(760, 0.18);

    updateMessage(
      "GREAT BLAST!",
      `${lineCount} line${lineCount === 1 ? "" : "s"} cleared! Keep going.`
    );

    return lineCount;
  }

  function placePiece(row, col) {
    if (paused || gameOver || selectedSlot < 0) return;

    const piece = pieces[selectedSlot];
    if (!piece) return;

    if (!canPlace(piece, row, col)) {
      updateMessage("Can't place here", "Choose an empty area on the board.");
      playTone(180, 0.08);
      return;
    }

    piece.shape.forEach(([r, c]) => {
      board[row + r][col + c] = piece.color;
    });

    const placedBlocks = piece.shape.length;
    pieces[selectedSlot] = null;
    selectedSlot = -1;

    updateScore(placedBlocks);
    playTone(480, 0.06);

    clearLines();
    renderBoard();
    renderTray();
    clearPreview();

    if (pieces.every((item) => item === null)) {
      pieces = [randomPiece(), randomPiece(), randomPiece()];
      renderTray();
      updateMessage("New blocks!", "Choose your next shape.");
    }

    checkGameOver();
  }

  function hasAnyMove() {
    return pieces.some((piece) => {
      if (!piece) return false;

      for (let row = 0; row < SIZE; row++) {
        for (let col = 0; col < SIZE; col++) {
          if (canPlace(piece, row, col)) return true;
        }
      }

      return false;
    });
  }

  function checkGameOver() {
    if (hasAnyMove()) return;

    gameOver = true;
    selectedSlot = -1;
    modalSymbol.textContent = "✦";
    modalTitle.textContent = "Game Over!";
    modalText.textContent = "No more blocks fit on the board.";
    finalScore.textContent = score.toLocaleString();
    finalScoreBox.classList.remove("hidden");
    resumeBtn.classList.add("hidden");
    modalRestartBtn.textContent = "PLAY AGAIN";
    modal.classList.remove("hidden");

    playTone(220, 0.25);
  }

  function openPause() {
    if (gameOver) return;

    paused = true;
    clearPreview();

    modalSymbol.textContent = "Ⅱ";
    modalTitle.textContent = "Game Paused";
    modalText.textContent = "Your blocks are waiting.";
    finalScoreBox.classList.add("hidden");
    resumeBtn.classList.remove("hidden");
    modalRestartBtn.textContent = "RESTART GAME";
    modal.classList.remove("hidden");
  }

  function resumeGame() {
    if (gameOver) return;

    paused = false;
    modal.classList.add("hidden");
  }

  function restartGame() {
    board = makeEmptyBoard();
    pieces = [randomPiece(), randomPiece(), randomPiece()];
    selectedSlot = -1;
    score = 0;
    clearedCount = 0;
    paused = false;
    gameOver = false;
    hintPosition = null;

    scoreElement.textContent = "0";
    clearElement.textContent = "0";
    bestElement.textContent = bestScore.toLocaleString();

    modal.classList.add("hidden");
    resumeBtn.classList.remove("hidden");
    finalScoreBox.classList.add("hidden");

    updateMessage("Ready to Blast?", "Place blocks and complete full rows or columns.");

    renderBoard();
    renderTray();
    clearPreview();
  }

  function showHint() {
    if (paused || gameOver) return;

    for (let slot = 0; slot < pieces.length; slot++) {
      const piece = pieces[slot];
      if (!piece) continue;

      for (let row = 0; row < SIZE; row++) {
        for (let col = 0; col < SIZE; col++) {
          if (canPlace(piece, row, col)) {
            selectedSlot = slot;
            hintPosition = { row, col };
            renderTray();
            showPreview(row, col);
            updateMessage("Hint found!", "The green area shows a possible placement.");
            playTone(680, 0.1);
            return;
          }
        }
      }
    }

    updateMessage("No moves left", "Restart to start a new round.");
    checkGameOver();
  }

  trayElement.addEventListener("click", (event) => {
    const slot = event.target.closest(".block-slot");
    if (!slot || paused || gameOver) return;

    const index = Number(slot.dataset.slot);
    if (!pieces[index]) return;

    selectedSlot = selectedSlot === index ? -1 : index;
    hintPosition = null;

    renderTray();
    clearPreview();

    if (selectedSlot >= 0) {
      updateMessage("Block selected", "Now tap an empty spot on the board.");
      playTone(400, 0.05);
    }
  });

  boardElement.addEventListener("click", (event) => {
    const cell = event.target.closest(".board-cell");
    if (!cell) return;

    placePiece(Number(cell.dataset.row), Number(cell.dataset.col));
  });

  boardElement.addEventListener("pointerover", (event) => {
    const cell = event.target.closest(".board-cell");
    if (!cell) return;

    showPreview(Number(cell.dataset.row), Number(cell.dataset.col));
  });

  boardElement.addEventListener("pointerleave", clearPreview);

  pauseBtn.addEventListener("click", openPause);
  resumeBtn.addEventListener("click", resumeGame);
  restartBtn.addEventListener("click", restartGame);
  modalRestartBtn.addEventListener("click", restartGame);
  hintBtn.addEventListener("click", showHint);

  soundBtn.addEventListener("click", () => {
    soundOn = !soundOn;
    soundBtn.innerHTML = soundOn
      ? "<span>♫</span><small>SOUND ON</small>"
      : "<span>♪</span><small>SOUND OFF</small>";

    if (soundOn) playTone(550, 0.08);
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      if (!modal.classList.contains("hidden")) {
        if (paused) resumeGame();
      } else {
        openPause();
      }
    }
  });

  document.addEventListener("visibilitychange", () => {
    if (document.hidden && !gameOver && modal.classList.contains("hidden")) {
      openPause();
    }
  });

  window.addEventListener("devil:sound-setting", (event) => {
    soundOn = Boolean(event.detail?.enabled);
    soundBtn.innerHTML = soundOn
      ? "<span>♫</span><small>SOUND ON</small>"
      : "<span>♪</span><small>SOUND OFF</small>";
  });

  restartGame();

})();

/* =====================================================
   DEVIL GAMES — PART 07
   FILE: devil-blast/game.js
   PURPOSE: MOBILE DRAG-AND-DROP IMPROVEMENTS
   NOTE: ADD BEFORE THE PART 06 END COMMENT
   NEXT: PART 08 — DEVIL RUN HTML
===================================================== */

(() => {
  const board = document.getElementById("gameBoard");
  const tray = document.getElementById("blockTray");

  if (!board || !tray) return;

  let dragSlot = null;
  let dragPointerId = null;

  tray.querySelectorAll(".block-slot").forEach((slot) => {
    slot.addEventListener("pointerdown", (event) => {
      if (slot.disabled) return;

      dragSlot = slot;
      dragPointerId = event.pointerId;

      slot.classList.add("dragging");

      try {
        slot.setPointerCapture(event.pointerId);
      } catch (_) {
        // Pointer capture may not be supported by every browser.
      }
    });

    slot.addEventListener("pointerup", (event) => {
      if (dragSlot !== slot || dragPointerId !== event.pointerId) return;

      slot.classList.remove("dragging");

      const target = document.elementFromPoint(
        event.clientX,
        event.clientY
      );

      const cell = target?.closest(".board-cell");

      if (cell && !cell.closest("#blockTray")) {
        cell.click();
      } else {
        slot.click();
      }

      dragSlot = null;
      dragPointerId = null;
    });

    slot.addEventListener("pointercancel", () => {
      slot.classList.remove("dragging");
      dragSlot = null;
      dragPointerId = null;
    });
  });

  document.addEventListener("contextmenu", (event) => {
    if (event.target.closest("#gameBoard, #blockTray")) {
      event.preventDefault();
    }
  });
})();

/* =====================================================
   PART 07 END
   FILE: devil-blast/game.js
   NEXT: PART 08 — DEVIL RUN HTML
===================================================== */


/* =====================================================
   PART 06 END
   FILE: devil-blast/game.js
   NEXT: PART 07 — DEVIL BLAST TESTING & IMPROVEMENTS
===================================================== */
    
