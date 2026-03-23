var ROWS = 15;
var COLS = 15;
var CELL = 42;
var PADDING = 21;
var RADIUS = 16;
var READ_LIMIT = 30;
var GAME_LIMIT = 10 * 60;
var UNDO_STEP_DELAY = 220;
var BLACK_PLAYER = 1;
var WHITE_PLAYER = 2;
var CENTER_INDEX = Math.floor(ROWS / 2);
var DIRECTIONS = [[0, 1], [1, 0], [1, 1], [1, -1]];
var AI_PATTERNS = [
  { regex: /xxxxx/, score: 200000 },
  { regex: /_xxxx_/, score: 50000 },
  { regex: /xxxx_|_xxxx|xxx_x|xx_xx|x_xxx/, score: 18000 },
  { regex: /_xxx_/, score: 6000 },
  { regex: /_xx_x_|_x_xx_/, score: 4500 },
  { regex: /xx__x|x__xx|xxx__|__xxx|xx_x_|_x_xx|x_xx_|_xx_x/, score: 1600 },
  { regex: /_xx_|_x_x_/, score: 260 },
  { regex: /xx___|___xx|x_x__|__x_x|x__x_/, score: 90 }
];

var board = [];
var currentPlayer = BLACK_PLAYER;
var gameOver = false;
var finishedWinner = 0;
var totalPieces = 0;
var moveRecords = [];
var lastMove = null;
var showMoveNumbers = false;
var gameMode = 'casual';
var battleMode = 'human';
var humanPlayer = BLACK_PLAYER;
var aiPlayer = WHITE_PLAYER;

var gameSeconds = GAME_LIMIT;
var readSeconds = READ_LIMIT;
var gameTimerHandle = null;
var readTimerHandle = null;
var aiMoveHandle = null;
var undoAnimationHandle = null;
var timersStarted = false;
var inReadMode = false;
var isAiThinking = false;
var isUndoAnimating = false;

var canvas = document.getElementById('board');
var ctx = canvas.getContext('2d');
var restartBtn = document.getElementById('restart');
var hintBtn = document.getElementById('hint-btn');
var undoBtn = document.getElementById('undo-btn');
var toggleMoveNumBtn = document.getElementById('toggle-move-num-btn');
var modeCasualBtn = document.getElementById('mode-casual-btn');
var modeMatchBtn = document.getElementById('mode-match-btn');
var battleConfigBtn = document.getElementById('battle-config-btn');
var recordListEl = document.getElementById('record-list');
var pieceIconEl = document.getElementById('piece-icon');
var playerNameEl = document.getElementById('player-name');
var playerActionEl = document.getElementById('player-action');
var moveCountEl = document.getElementById('move-count');
var battleStatusEl = document.getElementById('battle-status');
var gameTimerEl = document.getElementById('game-timer');
var moveTimerEl = document.getElementById('move-timer');
var modalOverlay = document.getElementById('modal-overlay');
var modalIcon = document.getElementById('modal-icon');
var modalTitle = document.getElementById('modal-title');
var modalMessage = document.getElementById('modal-message');
var modalActionsEl = document.getElementById('modal-actions');
var modalCancelBtn = document.getElementById('modal-cancel');
var modalConfirmBtn = document.getElementById('modal-confirm');
var modalCloseBtn = document.getElementById('modal-close');
var appShell = document.getElementById('app-shell');
var appStage = document.getElementById('app-stage');
var appContainer = document.getElementById('app-container');

var modalConfirmAction = null;
var modalCancelAction = null;
var modalAllowClose = false;
var PIECE_ICON_CLASSES = ['p-black', 'p-white', 'p-finished', 'p-finished-black-win', 'p-finished-white-win'];

function padTwo(n) {
  return n < 10 ? '0' + n : String(n);
}

function fmtGame(s) {
  var m = Math.floor(s / 60);
  var sec = s % 60;
  return m + ':' + padTwo(sec);
}

function fmtRead(s) {
  var m = Math.floor(s / 60);
  var sec = s % 60;
  return padTwo(m) + ':' + padTwo(sec);
}

function getOpponent(player) {
  return player === BLACK_PLAYER ? WHITE_PLAYER : BLACK_PLAYER;
}

function clearPieceIconState() {
  pieceIconEl.classList.remove.apply(pieceIconEl.classList, PIECE_ICON_CLASSES);
}

function setActivePieceIcon(player) {
  clearPieceIconState();
  pieceIconEl.classList.add(player === BLACK_PLAYER ? 'p-black' : 'p-white');
}

function setFinishedPieceIcon(winner) {
  clearPieceIconState();
  pieceIconEl.classList.add('p-finished');
  if (winner === BLACK_PLAYER) {
    pieceIconEl.classList.add('p-finished-black-win');
  } else if (winner === WHITE_PLAYER) {
    pieceIconEl.classList.add('p-finished-white-win');
  }
}

function isAiMode() {
  return battleMode === 'ai';
}

function isAiTurn() {
  return isAiMode() && currentPlayer === aiPlayer;
}

function isBoardBusy() {
  return isAiThinking || isUndoAnimating;
}

function isGameInProgress() {
  return totalPieces > 0 && !gameOver;
}

function syncCanvasLock() {
  canvas.classList.toggle('locked', gameOver || isBoardBusy() || isAiTurn());
}

function clearAiMove() {
  if (aiMoveHandle !== null) {
    clearTimeout(aiMoveHandle);
    aiMoveHandle = null;
  }
  isAiThinking = false;
}

function clearUndoAnimation() {
  if (undoAnimationHandle !== null) {
    clearTimeout(undoAnimationHandle);
    undoAnimationHandle = null;
  }
  isUndoAnimating = false;
}

function updateAppScale() {
  if (!appShell || !appStage || !appContainer) {
    return;
  }

  var naturalWidth = appContainer.offsetWidth;
  var naturalHeight = appContainer.offsetHeight;
  var shellStyle = window.getComputedStyle(appShell);
  var availableWidth = appShell.clientWidth
    - parseFloat(shellStyle.paddingLeft)
    - parseFloat(shellStyle.paddingRight);
  var availableHeight = appShell.clientHeight
    - parseFloat(shellStyle.paddingTop)
    - parseFloat(shellStyle.paddingBottom);

  if (naturalWidth === 0 || naturalHeight === 0 || availableWidth <= 0 || availableHeight <= 0) {
    return;
  }

  var scale = Math.min(
    availableWidth / naturalWidth,
    availableHeight / naturalHeight,
    1
  );

  appStage.style.width = naturalWidth * scale + 'px';
  appStage.style.height = naturalHeight * scale + 'px';
  appContainer.style.transform = 'scale(' + scale + ')';
}

function getPlayerSideName(player) {
  return player === BLACK_PLAYER ? '黑棋' : '白棋';
}

function getPlayerLabel(player) {
  if (!isAiMode()) {
    return getPlayerSideName(player);
  }
  return player === aiPlayer ? 'AI' : '你';
}

function getBattleStatusText() {
  if (gameMode === 'match') {
    return '比赛 · 双人对局';
  }
  if (isAiMode()) {
    return '休闲 · 人机 · ' + (humanPlayer === BLACK_PLAYER ? '你先手' : 'AI先手');
  }
  return '休闲 · 双人对局';
}

function getWinnerTitle(player) {
  if (!isAiMode()) {
    return getPlayerSideName(player) + '获胜';
  }
  return player === aiPlayer ? 'AI 获胜' : '你赢了';
}

function getWinnerIcon(player) {
  if (isAiMode() && player === aiPlayer) {
    return '🤖';
  }
  return player === BLACK_PLAYER ? '⚫' : '⚪';
}

function getWinnerMessage(player) {
  if (!isAiMode()) {
    return '恭喜获得本局胜利';
  }
  return player === aiPlayer ? 'AI 形成五连，再试一局？' : '漂亮的五连，再来一局？';
}

function renderTimers() {
  if (gameMode !== 'match') {
    gameTimerEl.textContent = '--:--';
    moveTimerEl.textContent = '--:--';
    moveTimerEl.classList.remove('urgent');
    return;
  }

  gameTimerEl.textContent = fmtGame(gameSeconds);
  moveTimerEl.textContent = fmtRead(readSeconds);

  if (inReadMode && readSeconds <= 10) {
    moveTimerEl.classList.add('urgent');
  } else {
    moveTimerEl.classList.remove('urgent');
  }
}

function stopTimers() {
  if (gameTimerHandle !== null) {
    clearInterval(gameTimerHandle);
    gameTimerHandle = null;
  }
  if (readTimerHandle !== null) {
    clearInterval(readTimerHandle);
    readTimerHandle = null;
  }
}

function resumeTimers() {
  if (gameMode !== 'match' || !timersStarted || gameOver) {
    return;
  }

  stopTimers();

  gameTimerHandle = setInterval(function() {
    if (!inReadMode && gameSeconds > 0) {
      gameSeconds--;
      if (gameSeconds <= 0) {
        gameSeconds = 0;
        inReadMode = true;
        readSeconds = READ_LIMIT;
      }
    }
    renderTimers();
  }, 1000);

  readTimerHandle = setInterval(function() {
    if (!inReadMode) {
      return;
    }

    readSeconds--;
    renderTimers();

    if (readSeconds <= 0) {
      onTimeout();
    }
  }, 1000);
}

function resetAllTimers() {
  gameSeconds = GAME_LIMIT;
  readSeconds = READ_LIMIT;
  inReadMode = false;
  renderTimers();
}

function startTimers() {
  if (gameMode !== 'match') {
    return;
  }
  timersStarted = true;
  resumeTimers();
}

function resetReadTimer() {
  if (gameMode !== 'match' || !inReadMode) {
    return;
  }
  readSeconds = READ_LIMIT;
  renderTimers();
}

function onTimeout() {
  if (gameMode !== 'match') {
    return;
  }

  var winner = getOpponent(currentPlayer);
  setGameFinishedState(winner);
  var loserLabel = getPlayerLabel(currentPlayer);
  showResultModal('⏰', getWinnerTitle(winner), loserLabel + '读秒耗尽，判负');
}

function updateMoveNumBtn() {
  toggleMoveNumBtn.textContent = showMoveNumbers ? '取消手数' : '显示手数';
}

function updateModeUI() {
  document.body.classList.toggle('mode-casual', gameMode === 'casual');
  document.body.classList.toggle('mode-match', gameMode === 'match');
  modeCasualBtn.classList.toggle('active', gameMode === 'casual');
  modeMatchBtn.classList.toggle('active', gameMode === 'match');
  battleConfigBtn.classList.toggle('active', gameMode === 'casual' && battleMode === 'ai');
  modeMatchBtn.disabled = isBoardBusy();
}

function updateUndoBtn() {
  undoBtn.disabled = gameMode === 'match' || moveRecords.length === 0 || isUndoAnimating;
}

function updateHintBtn() {
  hintBtn.disabled = gameMode !== 'casual' || gameOver || isBoardBusy() || isAiTurn();
}

function updateBattleConfigBtn() {
  battleConfigBtn.textContent = gameMode === 'match' ? '比赛仅双人' : '对战设置';
  battleConfigBtn.disabled = gameMode === 'match' || isBoardBusy();
}

function updateActionButtons() {
  updateUndoBtn();
  updateHintBtn();
  updateBattleConfigBtn();
}

function showDiscardCurrentGameModal(title, message, onConfirm) {
  showConfirmModal(title, message, onConfirm, '继续', '取消', '⚠️');
}

function resetBoardToFreshState() {
  hideModal();
  initBoard();
}

function setGameMode(mode) {
  if (mode !== 'casual' && mode !== 'match') {
    return;
  }
  if (gameMode === mode) {
    return;
  }

  if (isGameInProgress()) {
    var targetName = mode === 'match' ? '比赛对局' : '休闲对局';
    showDiscardCurrentGameModal('切换对局模式', '切换到' + targetName + '会丢失当前对局，是否继续？', function() {
      applyGameMode(mode);
    });
    return;
  }

  applyGameMode(mode);
}

function applyGameMode(mode) {
  gameMode = mode;

  if (mode === 'match') {
    battleMode = 'human';
  }

  resetBoardToFreshState();
}

function openAiSideModal() {
  var message = gameMode === 'match'
    ? '人机对战会切换为休闲对局，请选择先后手'
    : '请选择本局人机对战的先后手';

  showConfirmModal(
    '选择先后手',
    message,
    function() {
      applyAiBattleMode(BLACK_PLAYER);
    },
    '你先手',
    'AI先手',
    '🤖',
    function() {
      applyAiBattleMode(WHITE_PLAYER);
    },
    true
  );
}

function openBattleModeModal() {
  if (gameMode === 'match' || isBoardBusy()) {
    return;
  }

  showConfirmModal(
    '选择对战方式',
    '休闲模式下可在双人对局和人机对战之间切换',
    function() {
      setBattleMode('human');
    },
    '双人对局',
    '人机对战',
    '🎯',
    function() {
      setBattleMode('ai');
    },
    true
  );
}

function setBattleMode(mode) {
  if (mode !== 'human' && mode !== 'ai') {
    return;
  }
  if (mode === 'ai' && gameMode === 'match') {
    return;
  }
  if (mode === 'ai') {
    if (battleMode === 'ai' && isGameInProgress()) {
      showDiscardCurrentGameModal('重新选择先后手', '重新选择会丢失当前对局，是否继续？', function() {
        openAiSideModal();
      });
      return;
    }
    if (battleMode === 'ai') {
      openAiSideModal();
      return;
    }

    if (isGameInProgress()) {
      showDiscardCurrentGameModal('切换对战模式', '切换到人机对战会丢失当前对局，是否继续？', function() {
        openAiSideModal();
      });
      return;
    }

    openAiSideModal();
    return;
  }

  if (battleMode === mode) {
    return;
  }

  if (isGameInProgress()) {
    showDiscardCurrentGameModal('切换对战模式', '切换到双人对局会丢失当前对局，是否继续？', function() {
      applyBattleMode(mode);
    });
    return;
  }

  applyBattleMode(mode);
}

function applyBattleMode(mode) {
  battleMode = mode;
  resetBoardToFreshState();
}

function applyAiBattleMode(player) {
  humanPlayer = player;
  aiPlayer = getOpponent(player);
  battleMode = 'ai';
  gameMode = 'casual';
  resetBoardToFreshState();
}

function toggleMoveNumbers() {
  showMoveNumbers = !showMoveNumbers;
  updateMoveNumBtn();
  drawBoard();
}

function drawBoard() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawCoordinates();
  drawGrid();
  drawStarPoints();
  drawPieces();
  drawMoveNumbers();
  drawLastMoveHighlight();
}

function drawCoordinates() {
  ctx.save();
  ctx.fillStyle = '#4a3200';
  ctx.font = 'bold 12px "Courier New", monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  for (var c = 0; c < COLS; c++) {
    var letter = String.fromCharCode(65 + c);
    var x = PADDING + c * CELL;
    ctx.fillText(letter, x, 10);
  }

  ctx.textAlign = 'right';
  for (var r = 0; r < ROWS; r++) {
    var num = String(ROWS - r);
    var y = PADDING + r * CELL;
    ctx.fillText(num, 17, y);
  }

  ctx.restore();
}

function drawGrid() {
  ctx.strokeStyle = '#5a3e00';
  ctx.lineWidth = 1;

  for (var i = 0; i < ROWS; i++) {
    var x = PADDING + i * CELL;

    ctx.beginPath();
    ctx.moveTo(x, PADDING);
    ctx.lineTo(x, PADDING + (ROWS - 1) * CELL);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(PADDING, x);
    ctx.lineTo(PADDING + (COLS - 1) * CELL, x);
    ctx.stroke();
  }

  ctx.strokeStyle = '#3d2800';
  ctx.lineWidth = 2;
  ctx.strokeRect(PADDING, PADDING, (COLS - 1) * CELL, (ROWS - 1) * CELL);
}

function drawStarPoints() {
  var stars = [[3, 3], [3, 11], [7, 7], [11, 3], [11, 11]];
  ctx.fillStyle = '#3d2800';

  for (var i = 0; i < stars.length; i++) {
    var sr = stars[i][0];
    var sc = stars[i][1];
    ctx.beginPath();
    ctx.arc(PADDING + sc * CELL, PADDING + sr * CELL, 4, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawPieces() {
  for (var r = 0; r < ROWS; r++) {
    for (var c = 0; c < COLS; c++) {
      if (board[r][c] !== 0) {
        drawPiece(r, c, board[r][c]);
      }
    }
  }
}

function drawPiece(row, col, player) {
  var cx = PADDING + col * CELL;
  var cy = PADDING + row * CELL;

  ctx.beginPath();
  ctx.arc(cx, cy, RADIUS, 0, Math.PI * 2);

  if (player === BLACK_PLAYER) {
    var blackGradient = ctx.createRadialGradient(cx - 5, cy - 5, 2, cx, cy, RADIUS);
    blackGradient.addColorStop(0, '#888');
    blackGradient.addColorStop(0.4, '#222');
    blackGradient.addColorStop(1, '#000');
    ctx.fillStyle = blackGradient;
  } else {
    var whiteGradient = ctx.createRadialGradient(cx - 5, cy - 5, 2, cx, cy, RADIUS);
    whiteGradient.addColorStop(0, '#fff');
    whiteGradient.addColorStop(0.5, '#ddd');
    whiteGradient.addColorStop(1, '#aaa');
    ctx.fillStyle = whiteGradient;
  }

  ctx.fill();
  ctx.strokeStyle = player === BLACK_PLAYER ? '#000' : '#888';
  ctx.lineWidth = 1;
  ctx.stroke();
}

function drawMoveNumbers() {
  if (!showMoveNumbers || moveRecords.length === 0) {
    return;
  }

  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';

  for (var i = 0; i < moveRecords.length; i++) {
    var record = moveRecords[i];
    var moveText = String(record.move);
    var fontSize = moveText.length >= 3 ? 12 : 14;
    var x = PADDING + record.col * CELL;
    var y = PADDING + record.row * CELL;
    ctx.font = 'bold ' + fontSize + 'px "Courier New", monospace';
    ctx.lineWidth = moveText.length >= 3 ? 2 : 2.4;
    ctx.strokeStyle = record.player === BLACK_PLAYER ? 'rgba(35, 22, 0, 0.78)' : 'rgba(255, 247, 225, 0.92)';
    ctx.fillStyle = record.player === BLACK_PLAYER ? '#f8e7bb' : '#241700';
    ctx.strokeText(moveText, x, y);
    ctx.fillText(moveText, x, y);
  }

  ctx.restore();
}

function drawLastMoveHighlight() {
  if (!lastMove) {
    return;
  }

  var cx = PADDING + lastMove.col * CELL;
  var cy = PADDING + lastMove.row * CELL;

  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, RADIUS + 1, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(225,55,30,0.9)';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();
}

function countDir(row, col, dr, dc, player) {
  var count = 0;
  var nextRow = row + dr;
  var nextCol = col + dc;

  while (
    nextRow >= 0 &&
    nextRow < ROWS &&
    nextCol >= 0 &&
    nextCol < COLS &&
    board[nextRow][nextCol] === player
  ) {
    count++;
    nextRow += dr;
    nextCol += dc;
  }

  return count;
}

function checkWin(row, col, player) {
  for (var i = 0; i < DIRECTIONS.length; i++) {
    var dr = DIRECTIONS[i][0];
    var dc = DIRECTIONS[i][1];
    var count = 1 + countDir(row, col, dr, dc, player) + countDir(row, col, -dr, -dc, player);

    if (count >= 5) {
      return true;
    }
  }

  return false;
}

function toCoord(row, col) {
  var letter = String.fromCharCode(65 + col);
  var num = ROWS - row;
  return letter + num;
}

function addMoveRecord(row, col, player) {
  moveRecords.push({
    move: moveRecords.length + 1,
    player: player,
    coord: toCoord(row, col),
    row: row,
    col: col
  });

  renderRecordList();
  updateUndoBtn();
}

function renderRecordList() {
  recordListEl.innerHTML = '';

  for (var i = 0; i < moveRecords.length; i++) {
    var item = moveRecords[i];
    var rowEl = document.createElement('div');
    rowEl.className = 'record-item' + (i === moveRecords.length - 1 ? ' latest' : '');

    var numEl = document.createElement('span');
    numEl.className = 'rec-num';
    numEl.textContent = item.move + '.';

    var pieceEl = document.createElement('span');
    pieceEl.className = 'rec-piece ' + (item.player === BLACK_PLAYER ? 'p-black' : 'p-white');

    var coordEl = document.createElement('span');
    coordEl.className = 'rec-coord';
    coordEl.textContent = item.coord;

    rowEl.appendChild(numEl);
    rowEl.appendChild(pieceEl);
    rowEl.appendChild(coordEl);
    recordListEl.appendChild(rowEl);
  }

  recordListEl.scrollTop = recordListEl.scrollHeight;
}

function updateTurnPanel() {
  battleStatusEl.textContent = getBattleStatusText();

  if (gameOver) {
    setFinishedPieceIcon(finishedWinner);
    playerNameEl.textContent = '已结束';
    playerActionEl.textContent = isAiMode() ? '人机对局完成' : '对局完成';
  } else if (isUndoAnimating) {
    setActivePieceIcon(currentPlayer);
    playerNameEl.textContent = isAiMode() ? getPlayerLabel(currentPlayer) : getPlayerSideName(currentPlayer);
    playerActionEl.textContent = '悔棋回退中';
  } else if (isAiMode()) {
    setActivePieceIcon(currentPlayer);
    playerNameEl.textContent = currentPlayer === aiPlayer ? 'AI' : '你';
    playerActionEl.textContent = currentPlayer === aiPlayer ? '正在思考' : '请落子';
  } else {
    setActivePieceIcon(currentPlayer);
    playerNameEl.textContent = currentPlayer === BLACK_PLAYER ? '黑 棋' : '白 棋';
    playerActionEl.textContent = '请落子';
  }

  moveCountEl.textContent = '手数 ' + totalPieces;
  syncCanvasLock();
  updateActionButtons();
}

function showModal(icon, title, message, confirmText, showCancel, onConfirm, onCancel, allowClose) {
  modalIcon.textContent = icon;
  modalTitle.textContent = title;
  modalMessage.textContent = message;
  modalConfirmBtn.textContent = confirmText || '确 定';

  if (showCancel) {
    modalActionsEl.classList.remove('single');
  } else {
    modalActionsEl.classList.add('single');
  }

  modalConfirmAction = onConfirm || null;
  modalCancelAction = onCancel || null;
  modalAllowClose = allowClose !== false;
  modalCloseBtn.classList.toggle('hidden', !modalAllowClose);
  modalOverlay.classList.remove('hidden');
}

function restartCurrentGame() {
  if (isAiMode()) {
    openAiSideModal();
    return;
  }
  initBoard();
}

function showResultModal(icon, title, message) {
  showConfirmModal(
    title,
    message,
    function() {
      restartCurrentGame();
    },
    '再来一局',
    '先看看',
    icon,
    null,
    true
  );
}

function showConfirmModal(title, message, onConfirm, confirmText, cancelText, icon, onCancel, allowClose) {
  modalCancelBtn.textContent = cancelText || '取消';
  showModal(
    icon || '⚠️',
    title,
    message,
    confirmText || '确定',
    true,
    onConfirm || null,
    onCancel || null,
    allowClose
  );
}

function hideModal() {
  modalOverlay.classList.add('hidden');
  modalConfirmAction = null;
  modalCancelAction = null;
  modalAllowClose = false;
  modalCloseBtn.classList.add('hidden');
}

function getUndoStepCount() {
  if (!isAiMode()) {
    return moveRecords.length > 0 ? 1 : 0;
  }
  if (moveRecords.length === 0) {
    return 0;
  }
  if (moveRecords[moveRecords.length - 1].player === aiPlayer && moveRecords.length > 1) {
    return 2;
  }
  return 1;
}

function rollbackMoves(count) {
  for (var i = 0; i < count; i++) {
    var last = moveRecords.pop();
    if (!last) {
      break;
    }
    board[last.row][last.col] = 0;
    totalPieces--;
  }

  lastMove = moveRecords.length > 0
    ? {
      row: moveRecords[moveRecords.length - 1].row,
      col: moveRecords[moveRecords.length - 1].col
    }
    : null;

  currentPlayer = moveRecords.length > 0
    ? getOpponent(moveRecords[moveRecords.length - 1].player)
    : BLACK_PLAYER;
}

function renderUndoState() {
  renderRecordList();
  updateTurnPanel();
  drawBoard();
}

function finishUndoTransition() {
  clearUndoAnimation();
  renderUndoState();
}

function setGameFinishedState(winner) {
  clearAiMove();
  clearUndoAnimation();
  stopTimers();
  gameOver = true;
  finishedWinner = winner || 0;
  updateTurnPanel();
}

function animateUndoMoves(count) {
  if (count <= 0) {
    finishUndoTransition();
    return;
  }

  rollbackMoves(1);
  renderUndoState();

  if (count === 1) {
    finishUndoTransition();
    return;
  }

  undoAnimationHandle = setTimeout(function() {
    undoAnimationHandle = null;
    animateUndoMoves(count - 1);
  }, UNDO_STEP_DELAY);
}

function undoMove() {
  if (gameMode === 'match') {
    return;
  }

  var undoSteps = getUndoStepCount();
  if (undoSteps === 0) {
    return;
  }

  clearAiMove();
  clearUndoAnimation();

  if (gameOver) {
    gameOver = false;
    finishedWinner = 0;
    hideModal();
  }

  stopTimers();
  timersStarted = false;
  resetAllTimers();

  if (isAiMode() && undoSteps > 1) {
    isUndoAnimating = true;
    updateTurnPanel();
    animateUndoMoves(undoSteps);
    return;
  }

  rollbackMoves(undoSteps);
  renderUndoState();
}

function initBoard() {
  clearAiMove();
  clearUndoAnimation();
  board = [];

  for (var row = 0; row < ROWS; row++) {
    board.push([]);
    for (var col = 0; col < COLS; col++) {
      board[row].push(0);
    }
  }

  currentPlayer = BLACK_PLAYER;
  gameOver = false;
  finishedWinner = 0;
  totalPieces = 0;
  moveRecords = [];
  lastMove = null;
  showMoveNumbers = false;
  timersStarted = false;

  stopTimers();
  resetAllTimers();

  updateModeUI();
  renderRecordList();
  updateTurnPanel();
  updateMoveNumBtn();
  drawBoard();
  scheduleAiMove();
}

function endGameWithWinner(player) {
  setGameFinishedState(player);
  showResultModal(getWinnerIcon(player), getWinnerTitle(player), getWinnerMessage(player));
}

function endGameAsDraw() {
  setGameFinishedState(0);
  playerNameEl.textContent = '平 局';
  playerActionEl.textContent = '棋逢对手';
  showResultModal('🤝', '平  局', '双方势均力敌，再战一局？');
}

function performMove(row, col) {
  if (gameOver || board[row][col] !== 0) {
    return false;
  }

  var player = currentPlayer;
  board[row][col] = player;
  totalPieces++;
  lastMove = { row: row, col: col };
  addMoveRecord(row, col, player);

  if (gameMode === 'match' && !timersStarted && player === BLACK_PLAYER) {
    startTimers();
  }

  drawBoard();

  if (checkWin(row, col, player)) {
    endGameWithWinner(player);
    return true;
  }

  if (totalPieces === ROWS * COLS) {
    endGameAsDraw();
    return true;
  }

  currentPlayer = getOpponent(player);
  resetReadTimer();
  updateTurnPanel();
  scheduleAiMove();
  return true;
}

function getCellChar(row, col, player, offset) {
  if (offset === 0) {
    return 'x';
  }
  if (row < 0 || row >= ROWS || col < 0 || col >= COLS) {
    return 'b';
  }
  if (board[row][col] === 0) {
    return '_';
  }
  return board[row][col] === player ? 'x' : 'o';
}

function buildLineString(row, col, dr, dc, player) {
  var chars = [];

  for (var offset = -4; offset <= 4; offset++) {
    var cellRow = row + dr * offset;
    var cellCol = col + dc * offset;
    chars.push(getCellChar(cellRow, cellCol, player, offset));
  }

  return chars.join('');
}

function evaluateLine(line) {
  for (var i = 0; i < AI_PATTERNS.length; i++) {
    if (AI_PATTERNS[i].regex.test(line)) {
      return AI_PATTERNS[i].score;
    }
  }
  return 0;
}

function evaluatePoint(row, col, player) {
  var score = 0;

  for (var i = 0; i < DIRECTIONS.length; i++) {
    var dr = DIRECTIONS[i][0];
    var dc = DIRECTIONS[i][1];
    score += evaluateLine(buildLineString(row, col, dr, dc, player));
  }

  return score;
}

function countNearbyStones(row, col, player, range) {
  var count = 0;

  for (var r = Math.max(0, row - range); r <= Math.min(ROWS - 1, row + range); r++) {
    for (var c = Math.max(0, col - range); c <= Math.min(COLS - 1, col + range); c++) {
      if ((r !== row || c !== col) && board[r][c] === player) {
        count++;
      }
    }
  }

  return count;
}

function hasNearbyStone(row, col, range) {
  for (var r = Math.max(0, row - range); r <= Math.min(ROWS - 1, row + range); r++) {
    for (var c = Math.max(0, col - range); c <= Math.min(COLS - 1, col + range); c++) {
      if ((r !== row || c !== col) && board[r][c] !== 0) {
        return true;
      }
    }
  }

  return false;
}

function addCandidate(candidates, seen, row, col) {
  var key = row + '-' + col;
  if (!seen[key] && board[row][col] === 0) {
    seen[key] = true;
    candidates.push({ row: row, col: col });
  }
}

function collectCandidateMoves() {
  var candidates = [];
  var seen = {};

  if (totalPieces === 0) {
    return [{ row: CENTER_INDEX, col: CENTER_INDEX }];
  }

  if (board[CENTER_INDEX][CENTER_INDEX] === 0) {
    addCandidate(candidates, seen, CENTER_INDEX, CENTER_INDEX);
  }

  for (var row = 0; row < ROWS; row++) {
    for (var col = 0; col < COLS; col++) {
      if (board[row][col] === 0 && hasNearbyStone(row, col, 2)) {
        addCandidate(candidates, seen, row, col);
      }
    }
  }

  if (candidates.length > 0) {
    return candidates;
  }

  for (var r = 0; r < ROWS; r++) {
    for (var c = 0; c < COLS; c++) {
      addCandidate(candidates, seen, r, c);
    }
  }

  return candidates;
}

function isWinningMove(row, col, player) {
  board[row][col] = player;
  var wins = checkWin(row, col, player);
  board[row][col] = 0;
  return wins;
}

function findCriticalMove(player, candidates) {
  for (var i = 0; i < candidates.length; i++) {
    var candidate = candidates[i];
    if (isWinningMove(candidate.row, candidate.col, player)) {
      return candidate;
    }
  }
  return null;
}

function getCenterBonus(row, col) {
  var distance = Math.abs(row - CENTER_INDEX) + Math.abs(col - CENTER_INDEX);
  return Math.max(0, (ROWS - 1) - distance) * 2;
}

function scoreCandidate(row, col, player) {
  var opponent = getOpponent(player);
  var attackScore = evaluatePoint(row, col, player);
  var defendScore = evaluatePoint(row, col, opponent);
  var nearbySelf = countNearbyStones(row, col, player, 2);
  var nearbyOpponent = countNearbyStones(row, col, opponent, 2);
  var centerBonus = getCenterBonus(row, col);
  var score = attackScore * 1.12 + defendScore + nearbySelf * 18 + nearbyOpponent * 14 + centerBonus;

  if (totalPieces <= 4) {
    score += centerBonus * 8;
  }

  if (lastMove) {
    var distance = Math.abs(row - lastMove.row) + Math.abs(col - lastMove.col);
    score += Math.max(0, 8 - distance);
  }

  return score;
}

function pickBestMove(candidates, player) {
  var bestMove = null;
  var bestScore = -Infinity;

  for (var i = 0; i < candidates.length; i++) {
    var candidate = candidates[i];
    var score = scoreCandidate(candidate.row, candidate.col, player);

    if (!bestMove || score > bestScore) {
      bestMove = candidate;
      bestScore = score;
    }
  }

  return bestMove;
}

function chooseBestMoveForPlayer(player) {
  var candidates = collectCandidateMoves();
  var opponent = getOpponent(player);

  if (candidates.length === 0) {
    return null;
  }

  var winningMove = findCriticalMove(player, candidates);
  if (winningMove) {
    return winningMove;
  }

  var blockMove = findCriticalMove(opponent, candidates);
  if (blockMove) {
    return blockMove;
  }

  return pickBestMove(candidates, player);
}

function getAiThinkDelay() {
  return totalPieces < 6 ? 260 : 360;
}

function scheduleAiMove() {
  if (!isAiTurn() || gameOver) {
    syncCanvasLock();
    return;
  }

  clearAiMove();
  isAiThinking = true;
  updateTurnPanel();

  aiMoveHandle = setTimeout(function() {
    aiMoveHandle = null;

    if (!isAiTurn() || gameOver) {
      isAiThinking = false;
      updateTurnPanel();
      return;
    }

    isAiThinking = false;
    var move = chooseBestMoveForPlayer(aiPlayer);

    if (!move) {
      updateTurnPanel();
      return;
    }

    performMove(move.row, move.col);
  }, getAiThinkDelay());
}

function getBoardPoint(event) {
  var rect = canvas.getBoundingClientRect();
  var scaleX = canvas.width / rect.width;
  var scaleY = canvas.height / rect.height;
  var x = (event.clientX - rect.left) * scaleX;
  var y = (event.clientY - rect.top) * scaleY;
  var col = Math.round((x - PADDING) / CELL);
  var row = Math.round((y - PADDING) / CELL);

  if (col < 0 || col >= COLS || row < 0 || row >= ROWS) {
    return null;
  }

  return { row: row, col: col };
}

function handleBoardClick(event) {
  if (gameOver || isBoardBusy() || isAiTurn()) {
    return;
  }

  var point = getBoardPoint(event);
  if (!point || board[point.row][point.col] !== 0) {
    return;
  }

  performMove(point.row, point.col);
}

function handleHintMove() {
  if (hintBtn.disabled) {
    return;
  }

  var move = chooseBestMoveForPlayer(currentPlayer);
  if (!move) {
    return;
  }

  performMove(move.row, move.col);
}

function handleRestart() {
  if (isGameInProgress()) {
    showDiscardCurrentGameModal('确认重新开始', '重新开始会丢失当前对局，是否继续？', function() {
      restartCurrentGame();
    });
    return;
  }

  hideModal();
  restartCurrentGame();
}

function handleModalConfirm() {
  var action = modalConfirmAction;
  hideModal();

  if (action) {
    action();
  }
}

function handleModalCancel() {
  var action = modalCancelAction;
  hideModal();

  if (action) {
    action();
  }
}

function handleModalClose() {
  if (!modalAllowClose) {
    return;
  }
  hideModal();
}

function handleModalOverlayClick(event) {
  if (event.target !== modalOverlay || !modalAllowClose) {
    return;
  }
  hideModal();
}

function handleModalKeydown(event) {
  if (event.key !== 'Escape' || modalOverlay.classList.contains('hidden') || !modalAllowClose) {
    return;
  }
  event.preventDefault();
  hideModal();
}

function handleBeforeUnload() {
  clearAiMove();
  clearUndoAnimation();
  stopTimers();
}

canvas.addEventListener('click', handleBoardClick);
hintBtn.addEventListener('click', handleHintMove);
undoBtn.addEventListener('click', undoMove);
toggleMoveNumBtn.addEventListener('click', toggleMoveNumbers);
modeCasualBtn.addEventListener('click', function() {
  setGameMode('casual');
});
modeMatchBtn.addEventListener('click', function() {
  setGameMode('match');
});
battleConfigBtn.addEventListener('click', openBattleModeModal);
restartBtn.addEventListener('click', handleRestart);
modalConfirmBtn.addEventListener('click', handleModalConfirm);
modalCancelBtn.addEventListener('click', handleModalCancel);
modalCloseBtn.addEventListener('click', handleModalClose);
modalOverlay.addEventListener('click', handleModalOverlayClick);
window.addEventListener('keydown', handleModalKeydown);
window.addEventListener('resize', updateAppScale);
window.addEventListener('load', updateAppScale);
window.addEventListener('beforeunload', handleBeforeUnload);

initBoard();
updateAppScale();
