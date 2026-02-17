const canvas = document.getElementById("world");
const ctx = canvas.getContext("2d");

const scoreEl = document.getElementById("score");
const coordsEl = document.getElementById("coords");
const speedEl = document.getElementById("speed");
const biomeEl = document.getElementById("biome");
const enemiesEl = document.getElementById("enemies");

const CELL = 24;
const BASE_TPS = 8;
const MAX_FOOD = 18;
const SELF_COLLISION = true;
const MAX_ENEMIES = 6;
const VIEW_RADIUS = 32;

const BIOMES = [
  { name: "Plains", floor: "#16251d", accent: "#2f4a3d", food: "#ff8fab", relic: "#f7a8ff" },
  { name: "Desert", floor: "#2e2618", accent: "#5b4a27", food: "#ffd166", relic: "#ffef99" },
  { name: "Snow", floor: "#1f2e36", accent: "#4a6470", food: "#a9def9", relic: "#f0f6ff" },
  { name: "Volcanic", floor: "#2c1d1f", accent: "#5a2b2b", food: "#ff6b6b", relic: "#ff9f7a" },
  { name: "Swamp", floor: "#1e2920", accent: "#3d553a", food: "#caffbf", relic: "#baff7a" },
];

const state = {
  snake: [
    { x: 0, y: 0 },
    { x: -1, y: 0 },
    { x: -2, y: 0 },
  ],
  direction: { x: 1, y: 0 },
  queuedDirection: { x: 1, y: 0 },
  food: new Map(),
  relics: new Map(),
  enemies: [],
  score: 0,
  paused: false,
  dead: false,
  tickTime: 1 / BASE_TPS,
};

function key(x, y) {
  return `${x},${y}`;
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function hash2D(x, y, seed = 0) {
  const value = Math.sin(x * 127.1 + y * 311.7 + seed * 13.7) * 43758.5453;
  return value - Math.floor(value);
}

// Larger biome shapes using coarser sampling.
function sampleBiomeNoise(x, y) {
  const largeScale = hash2D(Math.floor(x / 42), Math.floor(y / 42), 1);
  const midScale = hash2D(Math.floor(x / 18), Math.floor(y / 18), 7) * 0.55;
  const fineScale = hash2D(Math.floor(x / 9), Math.floor(y / 9), 19) * 0.18;
  return (largeScale + midScale + fineScale) / 1.73;
}

function getBiomeAt(x, y) {
  const noise = sampleBiomeNoise(x, y);
  const biomeIndex = Math.min(BIOMES.length - 1, Math.floor(noise * BIOMES.length));
  return BIOMES[biomeIndex];
}

function hexToRgb(hex) {
  const normalized = hex.replace("#", "");
  const bigint = Number.parseInt(normalized, 16);
  return {
    r: (bigint >> 16) & 255,
    g: (bigint >> 8) & 255,
    b: bigint & 255,
  };
}

function occupiedBySnake(x, y) {
  return state.snake.some((part) => part.x === x && part.y === y);
}

function enemyAt(x, y) {
  return state.enemies.some((enemy) => enemy.x === x && enemy.y === y);
}

function spawnFoodAround(centerX, centerY, radius = 34) {
  let attempts = 0;
  while (state.food.size < MAX_FOOD && attempts < 700) {
    attempts += 1;
    const x = centerX + randomInt(-radius, radius);
    const y = centerY + randomInt(-radius, radius);
    const id = key(x, y);

    if (!state.food.has(id) && !state.relics.has(id) && !occupiedBySnake(x, y) && !enemyAt(x, y)) {
      const biome = getBiomeAt(x, y);
      state.food.set(id, { x, y, color: biome.food });
    }
  }
}

function spawnRelicAround(centerX, centerY, radius = 90) {
  let attempts = 0;
  while (state.relics.size < BIOMES.length && attempts < 900) {
    attempts += 1;
    const x = centerX + randomInt(-radius, radius);
    const y = centerY + randomInt(-radius, radius);
    const id = key(x, y);

    if (state.food.has(id) || state.relics.has(id) || occupiedBySnake(x, y) || enemyAt(x, y)) {
      continue;
    }

    const biome = getBiomeAt(x, y);
    // Rare relic chance so exploration is rewarded.
    if (hash2D(x, y, 91) > 0.94) {
      state.relics.set(id, {
        x,
        y,
        biomeName: biome.name,
        color: biome.relic,
        value: 4,
      });
    }
  }
}

function spawnEnemyAround(centerX, centerY, radius = 30) {
  let attempts = 0;
  while (state.enemies.length < MAX_ENEMIES && attempts < 300) {
    attempts += 1;
    const x = centerX + randomInt(-radius, radius);
    const y = centerY + randomInt(-radius, radius);

    if (Math.abs(x - centerX) + Math.abs(y - centerY) < 10) continue;
    if (occupiedBySnake(x, y) || enemyAt(x, y)) continue;
    if (state.food.has(key(x, y)) || state.relics.has(key(x, y))) continue;

    state.enemies.push({ x, y, stepBias: hash2D(x, y, 44) });
  }
}

function reset() {
  state.snake = [
    { x: 0, y: 0 },
    { x: -1, y: 0 },
    { x: -2, y: 0 },
  ];
  state.direction = { x: 1, y: 0 };
  state.queuedDirection = { x: 1, y: 0 };
  state.food.clear();
  state.relics.clear();
  state.enemies = [];
  state.score = 0;
  state.paused = false;
  state.dead = false;
  state.tickTime = 1 / BASE_TPS;
  spawnFoodAround(0, 0, 30);
  spawnRelicAround(0, 0, 130);
  spawnEnemyAround(0, 0, 34);
  updateHud();
}

function updateHud() {
  const head = state.snake[0];
  const biome = getBiomeAt(head.x, head.y);
  scoreEl.textContent = `Score: ${state.score}`;
  coordsEl.textContent = `Head: (${head.x}, ${head.y})`;
  speedEl.textContent = `Speed: ${(1 / state.tickTime).toFixed(1)} tps`;
  biomeEl.textContent = `Biome: ${biome.name}`;
  enemiesEl.textContent = `Enemies: ${state.enemies.length}`;
}

function queueDirection(next) {
  if (state.dead) {
    reset();
    return;
  }

  if (next.x === -state.direction.x && next.y === -state.direction.y) {
    return;
  }

  state.queuedDirection = next;
}

window.addEventListener("keydown", (event) => {
  const k = event.key.toLowerCase();

  if (k === " ") {
    event.preventDefault();
    state.paused = !state.paused;
    return;
  }

  if (k === "arrowup" || k === "w") queueDirection({ x: 0, y: -1 });
  if (k === "arrowdown" || k === "s") queueDirection({ x: 0, y: 1 });
  if (k === "arrowleft" || k === "a") queueDirection({ x: -1, y: 0 });
  if (k === "arrowright" || k === "d") queueDirection({ x: 1, y: 0 });
});

function moveEnemies() {
  const head = state.snake[0];

  state.enemies = state.enemies.map((enemy) => {
    const dx = head.x - enemy.x;
    const dy = head.y - enemy.y;
    const manhattan = Math.abs(dx) + Math.abs(dy);

    let step = { x: 0, y: 0 };

    if (manhattan < 14) {
      if (Math.abs(dx) > Math.abs(dy)) {
        step.x = Math.sign(dx);
      } else {
        step.y = Math.sign(dy);
      }
    } else {
      const roll = Math.random();
      if (roll < 0.25) step = { x: 1, y: 0 };
      else if (roll < 0.5) step = { x: -1, y: 0 };
      else if (roll < 0.75) step = { x: 0, y: 1 };
      else step = { x: 0, y: -1 };
    }

    const candidate = { x: enemy.x + step.x, y: enemy.y + step.y, stepBias: enemy.stepBias };

    if (occupiedBySnake(candidate.x, candidate.y)) {
      state.dead = true;
      return enemy;
    }

    return candidate;
  });
}

function tick() {
  if (state.paused || state.dead) return;

  state.direction = state.queuedDirection;

  const head = state.snake[0];
  const newHead = {
    x: head.x + state.direction.x,
    y: head.y + state.direction.y,
  };

  if (SELF_COLLISION && occupiedBySnake(newHead.x, newHead.y)) {
    state.dead = true;
    return;
  }

  if (enemyAt(newHead.x, newHead.y)) {
    state.dead = true;
    return;
  }

  state.snake.unshift(newHead);

  const foodKey = key(newHead.x, newHead.y);
  if (state.food.has(foodKey)) {
    state.food.delete(foodKey);
    state.score += 1;
    state.tickTime = Math.max(1 / 16, state.tickTime * 0.97);
    spawnFoodAround(newHead.x, newHead.y, 34);
  } else if (state.relics.has(foodKey)) {
    const relic = state.relics.get(foodKey);
    state.relics.delete(foodKey);
    state.score += relic.value;
    // Relics give growth + small speed boost to make them worth hunting.
    state.tickTime = Math.max(1 / 18, state.tickTime * 0.94);
    spawnRelicAround(newHead.x, newHead.y, 150);
  } else {
    state.snake.pop();
  }

  moveEnemies();

  if (state.food.size < MAX_FOOD) {
    spawnFoodAround(newHead.x, newHead.y, 44);
  }
  if (state.relics.size < BIOMES.length) {
    spawnRelicAround(newHead.x, newHead.y, 180);
  }
  if (state.enemies.length < MAX_ENEMIES) {
    spawnEnemyAround(newHead.x, newHead.y, 42);
  }

  updateHud();
}

function drawBiomeTiles(camera) {
  const visibleCols = Math.ceil(canvas.width / CELL) + 2;
  const visibleRows = Math.ceil(canvas.height / CELL) + 2;
  const startX = camera.x - Math.floor(visibleCols / 2);
  const startY = camera.y - Math.floor(visibleRows / 2);

  for (let iy = 0; iy < visibleRows; iy += 1) {
    for (let ix = 0; ix < visibleCols; ix += 1) {
      const worldX = startX + ix;
      const worldY = startY + iy;
      const biome = getBiomeAt(worldX, worldY);
      const jitter = hash2D(worldX, worldY, 33) * 0.12 - 0.06;
      const x = Math.floor((ix - 1) * CELL + ((camera.x % 1) * -CELL));
      const y = Math.floor((iy - 1) * CELL + ((camera.y % 1) * -CELL));

      ctx.fillStyle = biome.floor;
      ctx.fillRect(x, y, CELL, CELL);

      const accentRgb = hexToRgb(biome.accent);
      const alpha = Math.min(0.6, Math.max(0.12, 0.24 + jitter));
      ctx.fillStyle = `rgba(${accentRgb.r}, ${accentRgb.g}, ${accentRgb.b}, ${alpha})`;
      ctx.fillRect(x + 3, y + 3, CELL - 6, CELL - 6);
    }
  }
}

function drawGrid(cameraX, cameraY) {
  ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue("--grid").trim();
  ctx.lineWidth = 1;

  const cols = Math.ceil(canvas.width / CELL) + 2;
  const rows = Math.ceil(canvas.height / CELL) + 2;

  const offsetX = ((cameraX % CELL) + CELL) % CELL;
  const offsetY = ((cameraY % CELL) + CELL) % CELL;

  for (let col = -1; col < cols; col += 1) {
    const x = col * CELL - offsetX;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, canvas.height);
    ctx.stroke();
  }

  for (let row = -1; row < rows; row += 1) {
    const y = row * CELL - offsetY;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(canvas.width, y);
    ctx.stroke();
  }
}

function worldToScreen(world, camera) {
  return {
    x: canvas.width / 2 + (world.x - camera.x) * CELL,
    y: canvas.height / 2 + (world.y - camera.y) * CELL,
  };
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const camera = state.snake[0];
  drawBiomeTiles(camera);
  drawGrid(camera.x * CELL, camera.y * CELL);

  for (const relic of state.relics.values()) {
    const { x, y } = worldToScreen(relic, camera);
    if (x < -CELL || y < -CELL || x > canvas.width + CELL || y > canvas.height + CELL) continue;

    ctx.fillStyle = relic.color;
    ctx.beginPath();
    ctx.moveTo(x + CELL / 2, y + 3);
    ctx.lineTo(x + CELL - 3, y + CELL / 2);
    ctx.lineTo(x + CELL / 2, y + CELL - 3);
    ctx.lineTo(x + 3, y + CELL / 2);
    ctx.closePath();
    ctx.fill();
  }

  for (const item of state.food.values()) {
    const { x, y } = worldToScreen(item, camera);
    if (x < -CELL || y < -CELL || x > canvas.width + CELL || y > canvas.height + CELL) continue;

    ctx.fillStyle = item.color;
    ctx.beginPath();
    ctx.arc(x + CELL / 2, y + CELL / 2, CELL * 0.32, 0, Math.PI * 2);
    ctx.fill();
  }

  for (const enemy of state.enemies) {
    const { x, y } = worldToScreen(enemy, camera);
    if (x < -CELL || y < -CELL || x > canvas.width + CELL || y > canvas.height + CELL) continue;

    ctx.fillStyle = "#ff3b3b";
    ctx.fillRect(x + 4, y + 4, CELL - 8, CELL - 8);
    ctx.fillStyle = "#ffdede";
    ctx.fillRect(x + 7, y + 7, 4, 4);
    ctx.fillRect(x + CELL - 11, y + 7, 4, 4);
  }

  state.snake.forEach((part, index) => {
    const { x, y } = worldToScreen(part, camera);
    if (x < -CELL || y < -CELL || x > canvas.width + CELL || y > canvas.height + CELL) return;

    ctx.fillStyle = index === 0 ? "#7fffb2" : "#57e389";
    ctx.fillRect(x + 1.5, y + 1.5, CELL - 3, CELL - 3);
  });

  if (state.paused) {
    overlayText("Paused", "Press Space to resume");
  } else if (state.dead) {
    overlayText("Game Over", "An enemy caught you. Press movement key to restart");
  }
}

function overlayText(title, subtitle) {
  ctx.fillStyle = "rgb(0 0 0 / 45%)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.textAlign = "center";
  ctx.fillStyle = "#e8edf2";
  ctx.font = "700 52px Inter, sans-serif";
  ctx.fillText(title, canvas.width / 2, canvas.height / 2 - 8);

  ctx.fillStyle = "#b8c0ca";
  ctx.font = "500 24px Inter, sans-serif";
  ctx.fillText(subtitle, canvas.width / 2, canvas.height / 2 + 34);
}

let tickAccumulator = 0;
let previous = performance.now();

function frame(now) {
  const delta = (now - previous) / 1000;
  previous = now;
  tickAccumulator += delta;

  while (tickAccumulator >= state.tickTime) {
    tick();
    tickAccumulator -= state.tickTime;
  }

  draw();
  requestAnimationFrame(frame);
}

reset();
requestAnimationFrame(frame);
