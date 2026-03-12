var ROWS = 15;
var COLS = 15;
var CELL = 42;
var PADDING = 21;
var RADIUS = 16;
var READ_LIMIT = 30;
var GAME_LIMIT = 10 * 60;

var board = [];
var currentPlayer = 1;
var gameOver = false;
var totalPieces = 0;
var moveRecords = [];
var lastMove = null;
var showMoveNumbers = false;
var gameMode = 'casual';

var gameSeconds = GAME_LIMIT;
var readSeconds = READ_LIMIT;
var gameTimerHandle = null;
var readTimerHandle = null;
var timersStarted = false;
var inReadMode = false;

var canvas = document.getElementById('board');
var ctx = canvas.getContext('2d');
var restartBtn = document.getElementById('restart');
var undoBtn = document.getElementById('undo-btn');
var toggleMoveNumBtn = document.getElementById('toggle-move-num-btn');
var modeCasualBtn = document.getElementById('mode-casual-btn');
var modeMatchBtn = document.getElementById('mode-match-btn');
var recordListEl = document.getElementById('record-list');
var pieceIconEl = document.getElementById('piece-icon');
var playerNameEl = document.getElementById('player-name');
var playerActionEl = document.getElementById('player-action');
var moveCountEl = document.getElementById('move-count');
var gameTimerEl = document.getElementById('game-timer');
var moveTimerEl = document.getElementById('move-timer');
var modalOverlay = document.getElementById('modal-overlay');
var modalIcon = document.getElementById('modal-icon');
var modalTitle = document.getElementById('modal-title');
var modalMessage = document.getElementById('modal-message');
var modalActionsEl = document.getElementById('modal-actions');
var modalCancelBtn = document.getElementById('modal-cancel');
var modalConfirmBtn = document.getElementById('modal-confirm');

var modalConfirmAction = null;

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
  stopTimers();
  gameOver = true;
  canvas.classList.add('locked');
  updateTurnPanel();
  var loser = currentPlayer === 1 ? '黑棋' : '白棋';
  var winner = currentPlayer === 1 ? '白棋' : '黑棋';
  showResultModal('⏰', winner + '获胜', loser + '读秒耗尽，判负');
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

function drawMoveNumbers() {
  if (!showMoveNumbers || moveRecords.length === 0) {
    return;
  }

  ctx.save();
  ctx.font = 'bold 11px "Courier New", monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  for (var i = 0; i < moveRecords.length; i++) {
    var rec = moveRecords[i];
    var x = PADDING + rec.col * CELL;
    var y = PADDING + rec.row * CELL;
    var text = String(rec.move);
    ctx.fillStyle = rec.player === 1 ? '#f2dfad' : '#2e2100';
    ctx.fillText(text, x, y);
  }

  ctx.restore();
}

function updateMoveNumBtn() {
  toggleMoveNumBtn.textContent = showMoveNumbers ? '取消手数' : '显示手数';
}

function updateModeUI() {
  document.body.classList.toggle('mode-casual', gameMode === 'casual');
  document.body.classList.toggle('mode-match', gameMode === 'match');
  modeCasualBtn.classList.toggle('active', gameMode === 'casual');
  modeMatchBtn.classList.toggle('active', gameMode === 'match');
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
    showConfirmModal('切换对局模式', '切换到' + targetName + '会丢失当前对局，是否继续？', function() {
      applyGameMode(mode);
    }, '继续', '取消', '⚠️');
    return;
  }

  applyGameMode(mode);
}

function applyGameMode(mode) {
  gameMode = mode;
  hideModal();
  initBoard();
}

function isGameInProgress() {
  return totalPieces > 0 && !gameOver;
}

function toggleMoveNumbers() {
  showMoveNumbers = !showMoveNumbers;
  updateMoveNumBtn();
  drawBoard();
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

  if (player === 1) {
    var grad = ctx.createRadialGradient(cx - 5, cy - 5, 2, cx, cy, RADIUS);
    grad.addColorStop(0, '#888');
    grad.addColorStop(0.4, '#222');
    grad.addColorStop(1, '#000');
    ctx.fillStyle = grad;
  } else {
    var grad2 = ctx.createRadialGradient(cx - 5, cy - 5, 2, cx, cy, RADIUS);
    grad2.addColorStop(0, '#fff');
    grad2.addColorStop(0.5, '#ddd');
    grad2.addColorStop(1, '#aaa');
    ctx.fillStyle = grad2;
  }

  ctx.fill();
  ctx.strokeStyle = player === 1 ? '#000' : '#888';
  ctx.lineWidth = 1;
  ctx.stroke();
}

function drawLastMoveHighlight() {
  if (!lastMove) return;
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

function countDir(r, c, dr, dc, player) {
  var count = 0;
  var nr = r + dr;
  var nc = c + dc;

  while (nr >= 0 && nr < ROWS && nc >= 0 && nc < COLS && board[nr][nc] === player) {
    count++;
    nr += dr;
    nc += dc;
  }

  return count;
}

function checkWin(r, c, player) {
  var directions = [[0, 1], [1, 0], [1, 1], [1, -1]];

  for (var i = 0; i < directions.length; i++) {
    var dr = directions[i][0];
    var dc = directions[i][1];
    var count = 1 + countDir(r, c, dr, dc, player) + countDir(r, c, -dr, -dc, player);
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

    var num = document.createElement('span');
    num.className = 'rec-num';
    num.textContent = item.move + '.';

    var piece = document.createElement('span');
    piece.className = 'rec-piece ' + (item.player === 1 ? 'p-black' : 'p-white');

    var coord = document.createElement('span');
    coord.className = 'rec-coord';
    coord.textContent = item.coord;

    rowEl.appendChild(num);
    rowEl.appendChild(piece);
    rowEl.appendChild(coord);
    recordListEl.appendChild(rowEl);
  }

  recordListEl.scrollTop = recordListEl.scrollHeight;
}

function updateUndoBtn() {
  undoBtn.disabled = gameMode === 'match' || moveRecords.length === 0;
}

function updateTurnPanel() {
  pieceIconEl.classList.remove('p-black', 'p-white');

  if (gameOver) {
    playerNameEl.textContent = '已结束';
    playerActionEl.textContent = '对局完成';
  } else {
    var blackTurn = currentPlayer === 1;
    pieceIconEl.classList.add(blackTurn ? 'p-black' : 'p-white');
    playerNameEl.textContent = blackTurn ? '黑 棋' : '白 棋';
    playerActionEl.textContent = '请落子';
  }

  moveCountEl.textContent = '手数 ' + totalPieces;
}


function showModal(icon, title, message, confirmText, showCancel, onConfirm) {
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
  modalOverlay.classList.remove('hidden');
}

function showResultModal(icon, title, message) {
  showModal(icon, title, message, '再来一局', false, function() {
    initBoard();
  });
}

function showConfirmModal(title, message, onConfirm, confirmText, cancelText, icon) {
  modalCancelBtn.textContent = cancelText || '取消';
  showModal(icon || '⚠️', title, message, confirmText || '确定', true, onConfirm || null);
}

function hideModal() {
  modalOverlay.classList.add('hidden');
  modalConfirmAction = null;
}

function undoMove() {
  if (gameMode === 'match') return;
  if (moveRecords.length === 0) return;

  var last = moveRecords.pop();
  board[last.row][last.col] = 0;
  totalPieces--;
  currentPlayer = last.player;
  lastMove = moveRecords.length > 0
    ? { row: moveRecords[moveRecords.length - 1].row, col: moveRecords[moveRecords.length - 1].col }
    : null;

  if (gameOver) {
    gameOver = false;
    canvas.classList.remove('locked');
    hideModal();
  }

  stopTimers();
  timersStarted = false;
  resetAllTimers();

  renderRecordList();
  updateTurnPanel();
  updateUndoBtn();
  drawBoard();
}

function initBoard() {
  board = [];
  for (var r = 0; r < ROWS; r++) {
    board.push([]);
    for (var c = 0; c < COLS; c++) {
      board[r].push(0);
    }
  }

  currentPlayer = 1;
  gameOver = false;
  totalPieces = 0;
  moveRecords = [];
  lastMove = null;
  showMoveNumbers = false;

  timersStarted = false;
  stopTimers();
  resetAllTimers();

  canvas.classList.remove('locked');
  updateModeUI();
  renderRecordList();
  updateTurnPanel();
  updateUndoBtn();
  updateMoveNumBtn();
  drawBoard();
}

canvas.addEventListener('click', function(e) {
  if (gameOver) return;

  var rect = canvas.getBoundingClientRect();
  var scaleX = canvas.width / rect.width;
  var scaleY = canvas.height / rect.height;
  var x = (e.clientX - rect.left) * scaleX;
  var y = (e.clientY - rect.top) * scaleY;

  var col = Math.round((x - PADDING) / CELL);
  var row = Math.round((y - PADDING) / CELL);

  if (col < 0 || col >= COLS || row < 0 || row >= ROWS) return;
  if (board[row][col] !== 0) return;

  board[row][col] = currentPlayer;
  totalPieces++;
  lastMove = { row: row, col: col };
  addMoveRecord(row, col, currentPlayer);
  if (gameMode === 'match' && !timersStarted && currentPlayer === 1) {
    startTimers();
  }
  drawBoard();

  if (checkWin(row, col, currentPlayer)) {
    gameOver = true;
    stopTimers();
    canvas.classList.add('locked');
    updateTurnPanel();
    var winner = currentPlayer === 1 ? '黑棋' : '白棋';
    showResultModal(currentPlayer === 1 ? '⚫' : '⚪', winner + '获胜', '恭喜获得本局胜利');
    return;
  }

  if (totalPieces === ROWS * COLS) {
    gameOver = true;
    stopTimers();
    canvas.classList.add('locked');
    pieceIconEl.classList.remove('p-black', 'p-white');
    playerNameEl.textContent = '平 局';
    playerActionEl.textContent = '棋逢对手';
    moveCountEl.textContent = '手数 ' + totalPieces;
    showResultModal('🤝', '平  局', '双方势均力敌，再战一局？');
    return;
  }

  currentPlayer = currentPlayer === 1 ? 2 : 1;
  resetReadTimer();
  updateTurnPanel();
});

undoBtn.addEventListener('click', undoMove);
toggleMoveNumBtn.addEventListener('click', toggleMoveNumbers);
modeCasualBtn.addEventListener('click', function() { setGameMode('casual'); });
modeMatchBtn.addEventListener('click', function() { setGameMode('match'); });

modalOverlay.addEventListener('click', function(e) {
  e.stopPropagation();
});

restartBtn.addEventListener('click', function() {
  if (isGameInProgress()) {
    showConfirmModal('确认重新开始', '重新开始会丢失当前对局，是否继续？', function() {
      initBoard();
    }, '继续', '取消', '⚠️');
    return;
  }
  hideModal();
  initBoard();
});

modalConfirmBtn.addEventListener('click', function() {
  var action = modalConfirmAction;
  hideModal();
  if (action) {
    action();
  }
});

modalCancelBtn.addEventListener('click', function() {
  hideModal();
});

initBoard();
