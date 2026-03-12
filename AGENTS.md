# AGENTS.md - 弈星五子棋 (Gomoku Game)

## Project Overview

A single-page web Gomoku (Five-in-a-Row) game with:
- Vanilla HTML5, CSS3, JavaScript
- Canvas-based game board rendering
- Two game modes: Casual (休闲) and Match (比赛)
- Timer system with byoyomi (读秒)
- Move history and undo functionality

## Build & Serve Commands

### Development Server
```bash
# From project root
cd gomoku
python3 -m http.server 8000
# Access at http://localhost:8000
```

### Syntax Validation
```bash
# JavaScript syntax check
node --check gomoku/script.js
```

## Code Style Guidelines

### General Principles
- Keep code self-documenting; avoid unnecessary comments
- Use clear, descriptive variable and function names in Chinese/English
- Maintain consistent indentation (2 spaces)
- Remove trailing whitespace

### HTML (index.html)
- Use lowercase tags and attributes
- Quote all attribute values
- Self-closing tags for void elements (`<meta />`, `<link />`)
- Order: charset → viewport → title → favicon → stylesheet → body content → scripts

### CSS (styles.css)
- Use meaningful class names (e.g., `.modal-overlay`, `.player-panel`)
- Prefer CSS custom properties for theme colors
- Mobile-first responsive with `@media (max-width: 980px)`
- Group related styles with comments (e.g., `/* ── Modal ─────────────────────────────────────────────────────── */`)
- Avoid `!important` except for button state overrides

### JavaScript (script.js)

#### Variables & Constants
```javascript
// Constants: UPPER_SNAKE_CASE
var ROWS = 15;
var COLS = 15;
var CELL = 42;

// Variables: camelCase
var board = [];
var currentPlayer = 1;

// Boolean flags: is/has/can prefix
var showMoveNumbers = false;
var timersStarted = false;
```

#### Functions
- Use function declarations (not arrow functions for top-level)
- Name with verb prefix: `initBoard()`, `drawBoard()`, `checkWin()`, `renderTimers()`
- Keep functions under 50 lines; split complex logic

#### DOM Access
```javascript
// Cache DOM references at top of file
var canvas = document.getElementById('board');
var ctx = canvas.getContext('2d');

// Use querySelector only when needed
var modalActionsEl = document.getElementById('modal-actions');
```

#### Event Handling
```javascript
// Named handler functions for reusability
undoBtn.addEventListener('click', undoMove);
modalConfirmBtn.addEventListener('click', handleModalConfirm);
```

#### Error Handling
- Never suppress errors with `// eslint-disable` or `as any`
- Use early returns for invalid conditions
- Validate function arguments where critical

#### Timing & Animations
- Use `setInterval` for game timers (1000ms)
- CSS animations for UI feedback (`@keyframes pulse`)
- Clear intervals on game end or page unload

### Naming Conventions

| Type | Convention | Example |
|------|------------|---------|
| HTML IDs | kebab-case | `modal-overlay`, `undo-btn` |
| CSS Classes | kebab-case | `.side-panel`, `.timer-section` |
| JS Variables | camelCase | `moveRecords`, `lastMove` |
| JS Constants | UPPER_SNAKE | `GAME_LIMIT`, `READ_LIMIT` |
| Functions | verbCamel | `initBoard()`, `showModal()` |

### Project Structure
```
gomoku/
├── index.html    # Main HTML entry
├── styles.css   # All styles
├── script.js    # Game logic
└── favicon.svg  # Site icon
```

### Common Patterns

#### Modal System
- Single reusable modal with action buttons
- Toggle visibility with `.hidden` class
- Prevent click-through with `stopPropagation()`

#### Game State
```javascript
var gameMode = 'casual'; // or 'match'
var currentPlayer = 1;   // 1=black, 2=white
var gameOver = false;
var totalPieces = 0;
```

#### Timer Logic
- Game timer: counts down from 10:00 (match mode only)
- Read timer: 30-second byoyomi after game timer expires
- Only start timers on first black move

## Testing

### Manual Testing Checklist
- [ ] Game initializes with empty board
- [ ] Black plays first
- [ ] Win detection works (horizontal, vertical, diagonal)
- [ ] Draw detection when board full
- [ ] Timer counts correctly in match mode
- [ ] Timer hidden/dimmed in casual mode
- [ ] Undo works in casual, disabled in match
- [ ] Mode switch shows confirmation when game in progress
- [ ] Restart shows confirmation when game in progress
- [ ] Move numbers toggle displays correctly
- [ ] Last move highlight visible
- [ ] Mobile layout adapts properly

## Notes for Agents

- This is a vanilla JS project - no frameworks, no build tools
- All IDs in HTML must match `getElementById` calls in JS
- CSS uses `100dvh` for dynamic viewport height (mobile support)
- Game board uses Canvas API - coordinate system starts at top-left
- Chess notation: columns A-O, rows 15-1 (e.g., H8 = center)
