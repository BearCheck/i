const SIZE = 4;

const boardEl = document.getElementById("board");
const gridEl = document.querySelector(".grid");
const tilesEl = document.getElementById("tiles");
const scoreEl = document.getElementById("score");
const bestEl = document.getElementById("best");
const overlayEl = document.getElementById("overlay");
const overlayTitleEl = document.getElementById("overlayTitle");
const overlayMsgEl = document.getElementById("overlayMsg");
const newGameBtn = document.getElementById("newGame");
const tryAgainBtn = document.getElementById("tryAgain");
const keepPlayingBtn = document.getElementById("keepPlaying");

const BEST_KEY = "bestScore.v1";

function uid() {
  return Math.random().toString(16).slice(2) + Date.now().toString(16);
}

function clamp(v, a, b) {
  return Math.max(a, Math.min(b, v));
}

function loadBest() {
  const n = Number(localStorage.getItem(BEST_KEY));
  return Number.isFinite(n) ? n : 0;
}

function saveBest(n) {
  localStorage.setItem(BEST_KEY, String(n));
}

function buildStaticGrid() {
  gridEl.innerHTML = "";
  for (let i = 0; i < SIZE * SIZE; i++) {
    const cell = document.createElement("div");
    cell.className = "cell";
    gridEl.appendChild(cell);
  }
}

function getLayout() {
  const styles = getComputedStyle(document.documentElement);
  const tileSize = parseFloat(styles.getPropertyValue("--tile-size"));
  const gap = parseFloat(styles.getPropertyValue("--gap"));
  return {
    tileSize,
    gap,
    step: tileSize + gap,
  };
}

function posToPx(r, c, layout) {
  return { x: c * layout.step, y: r * layout.step };
}

function emptyCells(grid) {
  const out = [];
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if (grid[r][c] == null) out.push({ r, c });
    }
  }
  return out;
}

function spawnRandom(grid) {
  const empties = emptyCells(grid);
  if (empties.length === 0) return null;
  const pick = empties[Math.floor(Math.random() * empties.length)];
  const value = Math.random() < 0.9 ? 2 : 4;
  const tile = { id: uid(), v: value, r: pick.r, c: pick.c, mergedFrom: null };
  grid[pick.r][pick.c] = tile;
  return tile;
}

function cloneGrid(grid) {
  return grid.map((row) => row.slice());
}

function resetMergeFlags(grid) {
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      const t = grid[r][c];
      if (t) t.mergedFrom = null;
    }
  }
}

function canMove(grid) {
  if (emptyCells(grid).length > 0) return true;
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      const t = grid[r][c];
      if (!t) continue;
      if (r + 1 < SIZE && grid[r + 1][c] && grid[r + 1][c].v === t.v) return true;
      if (c + 1 < SIZE && grid[r][c + 1] && grid[r][c + 1].v === t.v) return true;
    }
  }
  return false;
}

function maxTileValue(grid) {
  let m = 0;
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      const t = grid[r][c];
      if (t && t.v > m) m = t.v;
    }
  }
  return m;
}

function makeEmptyGrid() {
  return Array.from({ length: SIZE }, () => Array.from({ length: SIZE }, () => null));
}

function lineReadOrder(dir, idx) {
  // Returns list of (r,c) along a line depending on direction
  const cells = [];
  for (let i = 0; i < SIZE; i++) {
    if (dir === "left") cells.push({ r: idx, c: i });
    if (dir === "right") cells.push({ r: idx, c: SIZE - 1 - i });
    if (dir === "up") cells.push({ r: i, c: idx });
    if (dir === "down") cells.push({ r: SIZE - 1 - i, c: idx });
  }
  return cells;
}

function targetCellFor(dir, lineIndex, offset) {
  if (dir === "left") return { r: lineIndex, c: offset };
  if (dir === "right") return { r: lineIndex, c: SIZE - 1 - offset };
  if (dir === "up") return { r: offset, c: lineIndex };
  return { r: SIZE - 1 - offset, c: lineIndex }; // down
}

function move(grid, dir) {
  resetMergeFlags(grid);

  const oldGrid = cloneGrid(grid);
  const newGrid = makeEmptyGrid();

  let moved = false;
  let scoreGain = 0;
  const merges = new Set();

  for (let line = 0; line < SIZE; line++) {
    const readCells = lineReadOrder(dir, line);
    const tiles = [];
    for (const { r, c } of readCells) {
      const t = oldGrid[r][c];
      if (t) tiles.push(t);
    }

    let write = 0;
    for (let i = 0; i < tiles.length; i++) {
      const cur = tiles[i];
      const next = tiles[i + 1];

      if (next && next.v === cur.v) {
        const target = targetCellFor(dir, line, write);
        const merged = {
          id: uid(),
          v: cur.v * 2,
          r: target.r,
          c: target.c,
          mergedFrom: [cur.id, next.id],
        };

        // update moving sources (used for animation mapping)
        cur._to = target;
        next._to = target;

        newGrid[target.r][target.c] = merged;
        merges.add(merged.id);

        scoreGain += merged.v;
        i++;
        write++;
      } else {
        const target = targetCellFor(dir, line, write);
        cur._to = target;
        const placed = { ...cur, r: target.r, c: target.c };
        newGrid[target.r][target.c] = placed;
        write++;
      }
    }
  }

  // determine moved
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      const a = oldGrid[r][c];
      const b = newGrid[r][c];
      if (a && (!b || a.id !== b.id || a.v !== b.v)) moved = true;
      if (!a && b) moved = true;
    }
  }

  return { newGrid, moved, scoreGain, merges };
}

function keyToDir(key) {
  if (key === "ArrowLeft") return "left";
  if (key === "ArrowRight") return "right";
  if (key === "ArrowUp") return "up";
  if (key === "ArrowDown") return "down";
  return null;
}

function setupTouch(onDir) {
  let startX = 0;
  let startY = 0;
  let active = false;

  const minDist = 18;

  boardEl.addEventListener(
    "pointerdown",
    (e) => {
      active = true;
      startX = e.clientX;
      startY = e.clientY;
    },
    { passive: true }
  );

  boardEl.addEventListener(
    "pointerup",
    (e) => {
      if (!active) return;
      active = false;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      if (Math.abs(dx) < minDist && Math.abs(dy) < minDist) return;

      if (Math.abs(dx) > Math.abs(dy)) {
        onDir(dx > 0 ? "right" : "left");
      } else {
        onDir(dy > 0 ? "down" : "up");
      }
    },
    { passive: true }
  );
}

class Game {
  constructor() {
    this.grid = makeEmptyGrid();
    this.score = 0;
    this.best = loadBest();
    this.won = false;
    this.keepPlaying = false;

    this.tileEls = new Map(); // id -> element
    this.inputLocked = false;

    bestEl.textContent = String(this.best);
  }

  newGame() {
    this.grid = makeEmptyGrid();
    this.score = 0;
    this.won = false;
    this.keepPlaying = false;
    this.hideOverlay();

    tilesEl.innerHTML = "";
    this.tileEls.clear();

    spawnRandom(this.grid);
    spawnRandom(this.grid);

    this.syncScore();
    this.renderFull();
  }

  syncScore() {
    scoreEl.textContent = String(this.score);
    if (this.score > this.best) {
      this.best = this.score;
      bestEl.textContent = String(this.best);
      saveBest(this.best);
    }
  }

  showOverlay(type) {
    overlayEl.hidden = false;
    if (type === "over") {
      overlayTitleEl.textContent = "Game over";
      overlayMsgEl.textContent = "No more moves.";
      keepPlayingBtn.hidden = true;
    } else if (type === "win") {
      overlayTitleEl.textContent = "You win!";
      overlayMsgEl.textContent = "Keep going for a higher score?";
      keepPlayingBtn.hidden = false;
    }
  }

  hideOverlay() {
    overlayEl.hidden = true;
  }

  renderFull() {
    const layout = getLayout();

    // create/update
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        const t = this.grid[r][c];
        if (!t) continue;
        this.ensureTileEl(t);
        this.placeTileEl(t, layout);
      }
    }

    // cleanup orphan elements
    const presentIds = new Set();
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        const t = this.grid[r][c];
        if (t) presentIds.add(t.id);
      }
    }

    for (const [id, el] of this.tileEls.entries()) {
      if (!presentIds.has(id)) {
        el.remove();
        this.tileEls.delete(id);
      }
    }
  }

  ensureTileEl(tile) {
    let el = this.tileEls.get(tile.id);
    if (el) {
      // update value
      el.textContent = String(tile.v);
      el.dataset.v = String(tile.v);
      return el;
    }

    el = document.createElement("div");
    el.className = "tile tile--new";
    el.textContent = String(tile.v);
    el.dataset.v = String(tile.v);
    el.dataset.id = tile.id;
    tilesEl.appendChild(el);
    this.tileEls.set(tile.id, el);

    // remove new animation class after it runs
    window.setTimeout(() => {
      el.classList.remove("tile--new");
    }, 160);

    return el;
  }

  placeTileEl(tile, layout) {
    const el = this.tileEls.get(tile.id);
    if (!el) return;

    const { x, y } = posToPx(tile.r, tile.c, layout);
    el.style.setProperty("--tx", `${x}px`);
    el.style.setProperty("--ty", `${y}px`);
    el.style.transform = `translate3d(${x}px, ${y}px, 0)`;
  }

  async applyMove(dir) {
    if (this.inputLocked) return;
    if (!this.keepPlaying && this.won) return;

    const { newGrid, moved, scoreGain, merges } = move(this.grid, dir);
    if (!moved) return;

    this.inputLocked = true;

    // Animate: move existing tile elements to their new positions.
    // We need a mapping from old tiles to target positions.
    const layout = getLayout();

    // Build map of old tile id -> destination (using _to set in move())
    const toMap = new Map();

    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        const t = this.grid[r][c];
        if (t && t._to) {
          toMap.set(t.id, { r: t._to.r, c: t._to.c });
        }
      }
    }

    // Move old elements first (pre-merge)
    for (const [id, dest] of toMap.entries()) {
      const el = this.tileEls.get(id);
      if (!el) continue;
      const { x, y } = posToPx(dest.r, dest.c, layout);
      el.style.setProperty("--tx", `${x}px`);
      el.style.setProperty("--ty", `${y}px`);
      el.style.transform = `translate3d(${x}px, ${y}px, 0)`;
    }

    // Wait for move animation to complete
    await waitMs(getMoveMs());

    // Commit new state
    this.grid = newGrid;
    this.score += scoreGain;
    this.syncScore();

    // Remove all old tile elements that were merged (they are not in newGrid)
    const presentIds = new Set();
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        const t = this.grid[r][c];
        if (t) presentIds.add(t.id);
      }
    }

    for (const [id, el] of this.tileEls.entries()) {
      if (!presentIds.has(id)) {
        el.remove();
        this.tileEls.delete(id);
      }
    }

    // Ensure/create elements for all tiles in the new grid and position them
    this.renderFull();

    // Mark merged tiles for pop animation
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        const t = this.grid[r][c];
        if (!t) continue;
        if (t.mergedFrom && t.mergedFrom.length === 2) {
          const el = this.tileEls.get(t.id);
          if (el) {
            el.classList.remove("tile--new");
            el.classList.add("tile--merged");
            window.setTimeout(() => el.classList.remove("tile--merged"), 160);
          }
        }
      }
    }

    // Spawn after move/merge
    const spawned = spawnRandom(this.grid);
    if (spawned) {
      const el = this.ensureTileEl(spawned);
      this.placeTileEl(spawned, layout);
      // keep tile--new class for spawned
      window.setTimeout(() => el.classList.remove("tile--new"), 160);
    }

    // Win / lose check
    const maxV = maxTileValue(this.grid);
    if (!this.won && maxV >= 2048) {
      this.won = true;
      this.showOverlay("win");
    } else if (!canMove(this.grid)) {
      this.showOverlay("over");
    }

    // cleanup move hints
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        const t = this.grid[r][c];
        if (t) delete t._to;
      }
    }

    // unlock input after a small buffer
    await waitMs(20);
    this.inputLocked = false;
  }
}

function getMoveMs() {
  const styles = getComputedStyle(document.documentElement);
  const v = styles.getPropertyValue("--move-ms").trim();
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : 130;
}

function waitMs(ms) {
  return new Promise((res) => window.setTimeout(res, ms));
}

function init() {
  buildStaticGrid();

  const game = new Game();
  game.newGame();

  window.addEventListener("keydown", (e) => {
    const dir = keyToDir(e.key);
    if (!dir) return;
    e.preventDefault();
    game.applyMove(dir);
  });

  setupTouch((dir) => game.applyMove(dir));

  newGameBtn.addEventListener("click", () => game.newGame());
  tryAgainBtn.addEventListener("click", () => game.newGame());
  keepPlayingBtn.addEventListener("click", () => {
    game.keepPlaying = true;
    game.hideOverlay();
  });

  window.addEventListener("resize", () => {
    // Re-place tiles on layout changes
    game.renderFull();
  });
}

init();
