
// =====================================================
// DEVIL GAMES
// PART 16: DEVIL TIC TAC TOE — GAME LOGIC
// FILE: devil-tic-tac-toe/game.js
// NEXT: PART 17 — devil-match/index.html
// =====================================================

(() => {
  "use strict";

  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => [...document.querySelectorAll(selector)];

  const cells = $$(".ttt-cell");
  const status = $("#tttStatus");
  const statusDot = $("#tttStatusDot");

  const modeButtons = $$(".ttt-mode-btn");
  const difficultySelect = $("#tttDifficulty");
  const difficultyWrap = $("#tttDifficultyWrap");

  const playerX = $("#tttPlayerX");
  const playerO = $("#tttPlayerO");

  const resultModal = $("#tttResultModal");
  const settingsModal = $("#tttSettingsModal");

  const STORAGE_KEY = "devilTicTacToeStats";
  const SETTINGS_KEY = "devilGamesSettings";
  const GAME_SETTINGS_KEY = "devilTicTacToeSettings";

  const WIN_LINES = [
    [0, 1, 2],
    [3, 4, 5],
    [6, 7, 8],
    [0, 3, 6],
    [1, 4, 7],
    [2, 5, 8],
    [0, 4, 8],
    [2, 4, 6]
  ];

  let board = Array(9).fill("");
  let currentPlayer = "X";
  let mode = "ai";
  let difficulty = "medium";
  let roundFinished = false;
  let aiThinking = false;
  let aiTimer = null;
  let soundEnabled = true;
  let vibrationEnabled = false;
  let audioContext = null;

  let moveHistory = [];
  let winningLine = [];

  let stats = loadStats();

  function loadStats() {
    try {
      return {
        xWins: 0,
        oWins: 0,
        draws: 0,
        totalWins: 0,
        streak: 0,
        ...JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}")
      };
    } catch {
      return {
        xWins: 0,
        oWins: 0,
        draws: 0,
        totalWins: 0,
        streak: 0
      };
    }
  }

  function saveStats() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(stats));
    } catch {}
  }

  function loadGameSettings() {
    try {
      const saved = JSON.parse(
        localStorage.getItem(GAME_SETTINGS_KEY) || "{}"
      );

      soundEnabled = saved.soundEnabled !== false;
      vibrationEnabled = saved.vibrationEnabled === true;
      difficulty = saved.difficulty || "medium";
    } catch {}

    difficultySelect.value = difficulty;

    $("#tttSoundToggle").checked = soundEnabled;
    $("#tttVibrationToggle").checked = vibrationEnabled;

    updateSoundButton();
  }

  function saveGameSettings() {
    try {
      localStorage.setItem(
        GAME_SETTINGS_KEY,
        JSON.stringify({
          soundEnabled,
          vibrationEnabled,
          difficulty
        })
      );
    } catch {}
  }

  // SOUND EFFECTS

  function playTone(frequency = 440, duration = 0.08, type = "sine") {
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

      gain.gain.setValueAtTime(0.07, audioContext.currentTime);
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

  function vibrate(pattern = 25) {
    if (!vibrationEnabled) return;

    try {
      if ("vibrate" in navigator) navigator.vibrate(pattern);
    } catch {}
  }

  function updateSoundButton() {
    $("#tttSoundBtn").textContent = soundEnabled
      ? "🔊 SOUND ON"
      : "🔇 SOUND OFF";

    $("#tttSoundToggle").checked = soundEnabled;
  }

  $("#tttSoundBtn").addEventListener("click", () => {
    soundEnabled = !soundEnabled;
    updateSoundButton();
    saveGameSettings();
    playTone(550, 0.08);
  });

  window.addEventListener("devil:sound-setting", (event) => {
    soundEnabled = event.detail?.enabled !== false;
    updateSoundButton();
    saveGameSettings();
  });

  // SCOREBOARD

  function updateStatsUI() {
    $("#tttScoreX").textContent = `WINS: ${stats.xWins}`;
    $("#tttScoreO").textContent = `WINS: ${stats.oWins}`;
    $("#tttTotalWins").textContent = stats.totalWins;
    $("#tttDraws").textContent = stats.draws;
    $("#tttStreak").textContent = stats.streak;
  }

  function updatePlayerLabels() {
    $("#tttNameX").textContent = "PLAYER X";
    $("#tttNameO").textContent = mode === "ai" ? "DEVIL AI" : "PLAYER O";
  }

  function updateTurnUI() {
    playerX.classList.toggle(
      "active",
      !roundFinished && currentPlayer === "X"
    );

    playerO.classList.toggle(
      "active",
      !roundFinished && currentPlayer === "O"
    );

    statusDot.style.background =
      currentPlayer === "X" ? "#ff477e" : "#39dfff";

    statusDot.style.boxShadow =
      currentPlayer === "X"
        ? "0 0 10px rgba(255,71,126,.6)"
        : "0 0 10px rgba(57,223,255,.6)";

    if (!roundFinished) {
      status.textContent = aiThinking
        ? "DEVIL AI IS THINKING..."
        : `${currentPlayer === "X" ? "PLAYER X" : mode === "ai" ? "DEVIL AI" : "PLAYER O"}'S TURN`;
    }
  }

  // BOARD RENDERING

  function renderBoard() {
    cells.forEach((cell, index) => {
      const mark = board[index];

      cell.textContent =
        mark === "X" ? "✕" : mark === "O" ? "○" : "";

      cell.classList.toggle("mark-x", mark === "X");
      cell.classList.toggle("mark-o", mark === "O");
      cell.classList.toggle(
        "winning-cell",
        winningLine.includes(index)
      );

      cell.disabled =
        Boolean(mark) ||
        roundFinished ||
        aiThinking ||
        (mode === "ai" && currentPlayer === "O");

      cell.setAttribute(
        "aria-label",
        `Cell ${index + 1}${mark ? `, ${mark}` : ", empty"}`
      );
    });

    updateTurnUI();
  }

  function findWinner(state) {
    for (const line of WIN_LINES) {
      const [a, b, c] = line;

      if (
        state[a] &&
        state[a] === state[b] &&
        state[a] === state[c]
      ) {
        return {
          winner: state[a],
          line
        };
      }
    }

    if (state.every(Boolean)) {
      return { winner: "draw", line: [] };
    }

    return null;
  }

  // MOVE PROCESSING

  function makeMove(index) {
    if (
      roundFinished ||
      aiThinking ||
      board[index] ||
      (mode === "ai" && currentPlayer === "O")
    ) {
      return;
    }

    board[index] = currentPlayer;
    moveHistory.push({
      index,
      player: currentPlayer
    });

    playTone(currentPlayer === "X" ? 480 : 380, 0.07, "triangle");
    vibrate(20);

    renderBoard();

    const result = findWinner(board);

    if (result) {
      endRound(result);
      return;
    }

    currentPlayer = currentPlayer === "X" ? "O" : "X";
    renderBoard();

    if (mode === "ai" && currentPlayer === "O") {
      scheduleAI();
    }
  }

  function endRound(result) {
    roundFinished = true;
    aiThinking = false;
    winningLine = result.line || [];

    if (result.winner === "draw") {
      stats.draws++;
      status.textContent = "IT'S A DRAW!";
      $("#tttResultIcon").textContent = "🤝";
      $("#tttResultTitle").textContent = "IT'S A DRAW!";
      $("#tttResultText").textContent = "A close match! Try another round.";
      playTone(320, 0.18);
    } else {
      const winner = result.winner;
      const playerWon = mode === "local" || winner === "X";

      if (winner === "X") {
        stats.xWins++;
      } else {
        stats.oWins++;
      }

      if (playerWon) {
        stats.totalWins++;
        stats.streak++;
        $("#tttResultIcon").textContent = "🏆";
        $("#tttResultTitle").textContent = "YOU WIN!";
        $("#tttResultText").textContent =
          mode === "ai"
            ? "Excellent strategy! You defeated the Devil AI."
            : `Player ${winner} wins this round!`;

        playTone(760, 0.25, "triangle");
        vibrate([40, 40, 80]);
      } else {
        stats.streak = 0;
        $("#tttResultIcon").textContent = "😈";
        $("#tttResultTitle").textContent = "DEVIL AI WINS";
        $("#tttResultText").textContent =
          "The AI won this round. Try a new strategy.";

        playTone(170, 0.3, "sawtooth");
      }

      status.textContent = `PLAYER ${winner} WINS!`;
    }

    saveStats();
    updateStatsUI();
    renderBoard();

    window.setTimeout(() => {
      resultModal.hidden = false;
    }, 250);
  }

  // AI LOGIC

  function getAvailableMoves(state) {
    return state
      .map((value, index) => value ? -1 : index)
      .filter((index) => index !== -1);
  }

  function findImmediateMove(state, player) {
    for (const index of getAvailableMoves(state)) {
      state[index] = player;
      const result = findWinner(state);
      state[index] = "";

      if (result?.winner === player) return index;
    }

    return -1;
  }

  function getEasyMove() {
    const available = getAvailableMoves(board);
    return available[Math.floor(Math.random() * available.length)];
  }

  function getMediumMove() {
    const winningMove = findImmediateMove(board, "O");
    if (winningMove !== -1) return winningMove;

    const blockingMove = findImmediateMove(board, "X");
    if (blockingMove !== -1) return blockingMove;

    if (!board[4]) return 4;

    const corners = [0, 2, 6, 8].filter((index) => !board[index]);

    if (corners.length && Math.random() < 0.75) {
      return corners[Math.floor(Math.random() * corners.length)];
    }

    return getEasyMove();
  }

  function minimax(state, isMaximizing, depth = 0) {
    const result = findWinner(state);

    if (result?.winner === "O") return 10 - depth;
    if (result?.winner === "X") return depth - 10;
    if (result?.winner === "draw") return 0;

    const available = getAvailableMoves(state);

    if (isMaximizing) {
      let bestScore = -Infinity;

      for (const index of available) {
        state[index] = "O";
        const score = minimax(state, false, depth + 1);
        state[index] = "";
        bestScore = Math.max(bestScore, score);
      }

      return bestScore;
    }

    let bestScore = Infinity;

    for (const index of available) {
      state[index] = "X";
      const score = minimax(state, true, depth + 1);
      state[index] = "";
      bestScore = Math.min(bestScore, score);
    }

    return bestScore;
  }

  function getHardMove() {
    let bestScore = -Infinity;
    let bestMoves = [];

    for (const index of getAvailableMoves(board)) {
      board[index] = "O";
      const score = minimax(board, false);
      board[index] = "";

      if (score > bestScore) {
        bestScore = score;
        bestMoves = [index];
      } else if (score === bestScore) {
        bestMoves.push(index);
      }
    }

    return bestMoves[Math.floor(Math.random() * bestMoves.length)];
  }

  function getAIMove() {
    if (difficulty === "easy") return getEasyMove();
    if (difficulty === "hard") return getHardMove();
    return getMediumMove();
  }

  function scheduleAI() {
    aiThinking = true;
    renderBoard();

    aiTimer = window.setTimeout(() => {
      if (roundFinished || mode !== "ai" || currentPlayer !== "O") {
        aiThinking = false;
        renderBoard();
        return;
      }

      const move = getAIMove();
      aiThinking = false;

      if (move !== undefined && move >= 0) {
        board[move] = "O";
        moveHistory.push({
          index: move,
          player: "O"
        });

        playTone(390, 0.07, "triangle");
        renderBoard();

        const result = findWinner(board);

        if (result) {
          endRound(result);
          return;
        }

        currentPlayer = "X";
      }

      renderBoard();
    }, difficulty === "easy" ? 350 : 550);
  }

  // ROUND / MODE CONTROLS

  function newRound() {
    window.clearTimeout(aiTimer);

    board = Array(9).fill("");
    currentPlayer = "X";
    roundFinished = false;
    aiThinking = false;
    winningLine = [];
    moveHistory = [];

    resultModal.hidden = true;

    status.textContent = "PLAYER X'S TURN";
    renderBoard();
    playTone(520, 0.06);
  }

  function setMode(nextMode) {
    mode = nextMode;

    modeButtons.forEach((button) => {
      button.classList.toggle(
        "active",
        button.dataset.mode === mode
      );
    });

    difficultyWrap.hidden = mode !== "ai";
    updatePlayerLabels();
    newRound();
  }

  modeButtons.forEach((button) => {
    button.addEventListener("click", () => {
      setMode(button.dataset.mode);
    });
  });

  cells.forEach((cell) => {
    cell.addEventListener("click", () => {
      const index = Number(cell.dataset.cell);
      if (Number.isInteger(index)) makeMove(index);
    });
  });

  $("#tttRestartBtn").addEventListener("click", newRound);

  $("#tttPlayAgainBtn").addEventListener("click", newRound);

  $("#tttCloseResultBtn").addEventListener("click", () => {
    resultModal.hidden = true;
  });

  $("#tttUndoBtn").addEventListener("click", () => {
    if (!moveHistory.length || roundFinished) return;

    window.clearTimeout(aiTimer);
    aiThinking = false;

    if (mode === "ai") {
      const lastMove = moveHistory.pop();

      if (lastMove) board[lastMove.index] = "";

      if (moveHistory.length && moveHistory[moveHistory.length - 1].player === "X") {
        const previousMove = moveHistory.pop();
        board[previousMove.index] = "";
      }

      currentPlayer = "X";
    } else {
      const lastMove = moveHistory.pop();
      if (lastMove) {
        board[lastMove.index] = "";
        currentPlayer = lastMove.player;
      }
    }

    winningLine = [];
    renderBoard();
    setMessageSafe("Move undone.");
    playTone(300, 0.06);
  });

  function setMessageSafe(text) {
    status.textContent = text;
  }

  difficultySelect.addEventListener("change", () => {
    difficulty = difficultySelect.value;
    saveGameSettings();
    newRound();
  });

  // SETTINGS

  $("#tttSettingsBtn").addEventListener("click", () => {
    settingsModal.hidden = false;
  });

  $("#tttCloseSettingsBtn").addEventListener("click", () => {
    settingsModal.hidden = true;
  });

  $("#tttSettingsDoneBtn").addEventListener("click", () => {
    settingsModal.hidden = true;
    soundEnabled = $("#tttSoundToggle").checked;
    vibrationEnabled = $("#tttVibrationToggle").checked;
    updateSoundButton();
    saveGameSettings();
    playTone(520, 0.06);
  });

  $("#tttSoundToggle").addEventListener("change", () => {
    soundEnabled = $("#tttSoundToggle").checked;
    updateSoundButton();
    saveGameSettings();
  });

  $("#tttVibrationToggle").addEventListener("change", () => {
    vibrationEnabled = $("#tttVibrationToggle").checked;
    saveGameSettings();
  });

  $("#tttResetStatsBtn").addEventListener("click", () => {
    const confirmed = window.confirm("Reset all Tic Tac Toe statistics?");

    if (!confirmed) return;

    stats = {
      xWins: 0,
      oWins: 0,
      draws: 0,
      totalWins: 0,
      streak: 0
    };

    saveStats();
    updateStatsUI();
    newRound();
  });

  // CLOSE MODALS BY TAPPING OUTSIDE

  [resultModal, settingsModal].forEach((modal) => {
    modal.addEventListener("click", (event) => {
      if (event.target === modal) {
        modal.hidden = true;
      }
    });
  });

  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      resultModal.hidden = true;
      settingsModal.hidden = true;
    }
  });

  // INITIALIZE

  loadGameSettings();
  updateStatsUI();
  updatePlayerLabels();
  renderBoard();

})();

// =====================================================
// PART 16 END
// FILE: devil-tic-tac-toe/game.js
// NEXT PART 17: devil-match/index.html
// =====================================================
          
