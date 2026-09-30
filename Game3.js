const gameWidth = 1200;
const gameHeight = 655;
const arena = document.getElementById("arena");
const statusPanel = document.getElementById("statusPanel");
const statusTitle = document.getElementById("statusTitle");
const statusMessage = document.getElementById("statusMessage");
const statusButton = document.getElementById("statusButton");
const statusKicker = document.getElementById("statusKicker");
const overlayHint = document.getElementById("overlayHint");
const upgradeChoices = document.getElementById("upgradeChoices");
const scoreDisplay = document.getElementById("score");
const highscoreDisplay = document.getElementById("highscore");
const timeDisplay = document.getElementById("time");
const waveDisplay = document.getElementById("wave");
const enemyCountDisplay = document.getElementById("enemyCount");
const healthBar = document.getElementById("healthBar");
const healthText = document.getElementById("healthText");
const playerLevelDisplay = document.getElementById("playerLevel");
const xpBar = document.getElementById("xpBar");
const xpCount = document.getElementById("xpCount");
const toast = document.getElementById("toast");
const highscoreKey = "moonfall-highscore";
const upgradeDefinitions = [
  { id: "rapidCast", name: "Swift Casting", icon: "⌁", max: 5 },
  { id: "spreadShot", name: "Fan of Souls", icon: "✣", max: 3 },
  { id: "piercing", name: "Wraithpiercer", icon: "➶", max: Infinity },
  { id: "soulburst", name: "Soulburst", icon: "✺", max: 1 },
  { id: "magnet", name: "Grave Magnet", icon: "♧", max: Infinity },
  { id: "arcaneMight", name: "Eldritch Might", icon: "✧", max: Infinity },
  { id: "soulHarvest", name: "Soul Harvest", icon: "✦", max: 5 }
];

const stars = Array.from({ length: 105 }, () => ({
  x: Math.random() * gameWidth,
  y: Math.random() * gameHeight,
  size: Math.random() * 1.8 + 0.5,
  phase: Math.random() * Math.PI * 2
}));
const trees = Array.from({ length: 33 }, (_, index) => ({
  x: index * 39 - 8,
  height: 75 + Math.random() * 95,
  width: 30 + Math.random() * 31
}));

let gameSurface;
let player;
let enemies = [];
let projectiles = [];
let xpOrbs = [];
let particles = [];
let running = false;
let choosingUpgrade = false;
let health = 100;
let score = 0;
let highscore = 0;
let elapsed = 0;
let playerLevel = 1;
let xp = 0;
let xpRequired = 8;
let pendingLevelUps = 0;
let upgrades = {};
let lastFrameTime = 0;
let lastShot = 0;
let nextSpawn = 0;
let lastDamage = 0;
let lastHudUpdate = 0;
let lastWave = 1;
let toastTimer;
let pointerX = gameWidth / 2;
let pointerY = gameHeight / 2;
let storageAvailable = true;

function setup() {
  gameSurface = new Canvas(gameWidth, gameHeight);
  gameSurface.id = "gameCanvas";
  gameSurface.setAttribute(
    "aria-label",
    "Moonfall arcane survivor. Move the mouse to steer and guide your aim; attacks fire automatically."
  );
  arena.insertBefore(gameSurface, arena.firstChild);
  world.gravity.x = 0;
  world.gravity.y = 0;

  highscore = loadHighscore();
  highscoreDisplay.textContent = formatScore(highscore);
  gameSurface.addEventListener("pointermove", updatePointer);
  gameSurface.addEventListener("pointerdown", updatePointer);
  gameSurface.addEventListener("contextmenu", event => event.preventDefault());
  statusButton.addEventListener("click", startGame);
  document.getElementById("resetButton").addEventListener("click", showReady);
  window.addEventListener("blur", () => {
    pointerX = player ? player.x : gameWidth / 2;
    pointerY = player ? player.y : gameHeight / 2;
  });
  resetRun();
  updateHud();
}

function loadHighscore() {
  try {
    const saved = Number(window.localStorage.getItem(highscoreKey));
    return Number.isFinite(saved) && saved > 0 ? Math.floor(saved) : 0;
  } catch (error) {
    storageAvailable = false;
    console.warn("Moonfall could not read the saved high score.", error);
    return 0;
  }
}

function saveHighscore() {
  if (!storageAvailable) return;
  try {
    window.localStorage.setItem(highscoreKey, String(highscore));
  } catch (error) {
    storageAvailable = false;
    console.warn("Moonfall could not save the high score.", error);
  }
}

function updatePointer(event) {
  const bounds = gameSurface.getBoundingClientRect();
  pointerX = constrain((event.clientX - bounds.left) * gameWidth / bounds.width, 0, gameWidth);
  pointerY = constrain((event.clientY - bounds.top) * gameHeight / bounds.height, 0, gameHeight);
  event.preventDefault();
}

function makeSprite(x, y, size) {
  const sprite = new Sprite(x, y, size);
  sprite.collider = "none";
  sprite.visible = false;
  sprite.rotationLock = true;
  return sprite;
}

function clearSprites(items) {
  items.forEach(item => item.sprite.remove());
}

function resetRun() {
  clearSprites(enemies);
  clearSprites(projectiles);
  clearSprites(xpOrbs);
  if (player) player.remove();
  enemies = [];
  projectiles = [];
  xpOrbs = [];
  particles = [];
  choosingUpgrade = false;
  playerLevel = 1;
  xp = 0;
  xpRequired = 8;
  pendingLevelUps = 0;
  upgrades = Object.fromEntries(upgradeDefinitions.map(upgrade => [upgrade.id, 0]));
  health = 100;
  score = 0;
  elapsed = 0;
  lastFrameTime = millis();
  lastShot = 0;
  nextSpawn = 700;
  lastDamage = -2000;
  lastHudUpdate = 0;
  lastWave = 1;
  pointerX = gameWidth / 2;
  pointerY = gameHeight / 2;
  player = makeSprite(gameWidth / 2, gameHeight / 2, 30);
  updateHud();
}

function showReady() {
  running = false;
  resetRun();
  statusKicker.innerHTML = "<span>✦</span> A CURSE STIRS IN THE WOODS";
  statusTitle.innerHTML = "MOON<span>FALL</span>";
  statusMessage.textContent = "The Hollow is hungry. How long can you survive?";
  statusButton.innerHTML = "ENTER THE HOLLOW <span>↗</span>";
  statusButton.hidden = false;
  overlayHint.hidden = false;
  upgradeChoices.hidden = true;
  upgradeChoices.replaceChildren();
  statusPanel.classList.remove("upgrade-mode");
  statusPanel.classList.remove("hidden");
}

function startGame() {
  resetRun();
  running = true;
  lastFrameTime = millis();
  statusPanel.classList.add("hidden");
}

function draw() {
  const now = millis();
  const delta = Math.min((now - lastFrameTime) / 1000, 0.04);
  lastFrameTime = now;
  drawHollow(now);

  if (running) {
    elapsed += delta;
    score += delta;
    movePlayer(delta);
    spawnEnemies(now);
    updateEnemies(delta, now);
    if (health <= 0) {
      endGame();
    } else {
      updateProjectiles(delta);
      updateXpOrbs(delta);
      updateParticles(delta);
      updateHighscore();
      if (running && now - lastShot >= fireInterval()) fireAtTarget(now);
    }
    if (now - lastHudUpdate > 120) updateHud();
  } else {
    updateParticles(delta);
  }

  drawSouls();
  drawXpOrbs(now);
  drawProjectiles();
  drawEnemies(now);
  drawPlayer(now);
  drawParticles();
}

function drawHollow(now) {
  background("#11111f");
  noStroke();
  for (let y = 0; y < gameHeight; y += 5) {
    const amount = y / gameHeight;
    fill(18 + amount * 5, 18 + amount * 5, 34 + amount * 11);
    rect(0, y, gameWidth, 5);
  }

  for (const star of stars) {
    const shimmer = 85 + Math.sin(now / 700 + star.phase) * 30;
    fill(190, 178, 226, shimmer);
    circle(star.x, star.y, star.size);
  }

  drawMoon();
  drawRuins();
  drawForest();
  drawGroundRunes(now);
}

function drawMoon() {
  noStroke();
  fill(198, 161, 236, 15);
  circle(922, 150, 176);
  fill(220, 196, 244, 24);
  circle(922, 150, 142);
  fill("#d9c4ed");
  circle(922, 150, 105);
  fill("#191727");
  circle(952, 129, 92);
}

function drawRuins() {
  noStroke();
  fill("#222033");
  rect(151, 388, 18, 131);
  rect(143, 377, 34, 14);
  rect(1018, 404, 16, 114);
  rect(1010, 393, 32, 13);
  fill("#302a43");
  rect(160, 458, 25, 60);
  rect(1028, 447, 25, 71);
  fill(176, 127, 226, 105);
  circle(160, 414, 4);
  circle(1026, 428, 4);
}

function drawForest() {
  noStroke();
  for (let layer = 0; layer < 2; layer++) {
    const offset = layer * 20;
    fill(layer === 0 ? "#1b1a2a" : "#211d31");
    trees.forEach(tree => {
      const x = tree.x + offset;
      const top = gameHeight - tree.height + layer * 32;
      triangle(x - tree.width / 2, top + 70, x, top, x + tree.width / 2, top + 70);
      triangle(x - tree.width / 2, top + 110, x, top + 33, x + tree.width / 2, top + 110);
      rect(x - 3, top + 91, 6, 34);
    });
  }
  fill("#292237");
  rect(0, 518, gameWidth, gameHeight - 518);
  fill("#3b2d49");
  rect(0, 518, gameWidth, 2);
}

function drawGroundRunes(now) {
  push();
  noFill();
  stroke(169, 124, 215, 22 + Math.sin(now / 700) * 8);
  strokeWeight(1);
  for (let index = 0; index < 5; index++) {
    const x = 115 + index * 245;
    const y = 590 + Math.sin(index * 2 + now / 1800) * 3;
    ellipse(x, y, 105, 28);
    ellipse(x, y, 76, 17);
    line(x - 31, y, x + 31, y);
    line(x, y - 8, x, y + 8);
  }
  pop();
}

function movePlayer(delta) {
  const dx = pointerX - player.x;
  const dy = pointerY - player.y;
  const distance = Math.hypot(dx, dy);
  if (distance > 8) {
    const step = Math.min(distance, 340 * delta);
    player.x += dx / distance * step;
    player.y += dy / distance * step;
  }
  player.x = constrain(player.x, 22, gameWidth - 22);
  player.y = constrain(player.y, 60, gameHeight - 35);
}

function currentWave() {
  return Math.floor(elapsed / 22) + 1;
}

function spawnEnemies(now) {
  const wave = currentWave();
  if (wave !== lastWave) {
    lastWave = wave;
    showToast(`WAVE ${toRoman(wave)} — THE HOLLOW STIRS`);
  }

  const interval = Math.max(260, 1050 - (wave - 1) * 58);
  if (now < nextSpawn || enemies.length >= Math.min(38, 10 + wave * 3)) return;
  nextSpawn = now + interval;
  spawnEnemy(wave);
}

function spawnEnemy(wave) {
  const side = Math.floor(Math.random() * 4);
  const margin = 28;
  let x;
  let y;
  if (side === 0) {
    x = Math.random() * gameWidth;
    y = -margin;
  } else if (side === 1) {
    x = gameWidth + margin;
    y = 55 + Math.random() * (gameHeight - 110);
  } else if (side === 2) {
    x = Math.random() * gameWidth;
    y = gameHeight + margin;
  } else {
    x = -margin;
    y = 55 + Math.random() * (gameHeight - 110);
  }

  const roll = Math.random();
  let type = "wraith";
  if (wave >= 4 && roll > 0.82) type = "brute";
  else if (wave >= 2 && roll > 0.62) type = "shade";

  const settings = {
    wraith: { size: 27, speed: 68 + wave * 3.4, health: 1, color: "#a68bd1", points: 100 },
    shade: { size: 20, speed: 103 + wave * 4, health: 1, color: "#82b7b0", points: 150 },
    brute: { size: 38, speed: 43 + wave * 2.4, health: 3, color: "#d47c9a", points: 300 }
  }[type];
  const sprite = makeSprite(x, y, settings.size);
  enemies.push({
    sprite,
    type,
    size: settings.size,
    speed: settings.speed,
    health: settings.health,
    maxHealth: settings.health,
    color: settings.color,
    points: settings.points,
    phase: Math.random() * Math.PI * 2
  });
}

function updateEnemies(delta, now) {
  for (const enemy of enemies) {
    const dx = player.x - enemy.sprite.x;
    const dy = player.y - enemy.sprite.y;
    const distance = Math.hypot(dx, dy) || 1;
    enemy.sprite.x += dx / distance * enemy.speed * delta;
    enemy.sprite.y += dy / distance * enemy.speed * delta;
    enemy.sprite.x = constrain(enemy.sprite.x, -50, gameWidth + 50);
    enemy.sprite.y = constrain(enemy.sprite.y, -50, gameHeight + 50);

    if (distance < (enemy.size + 25) * 0.5 && now - lastDamage > 800) {
      health = Math.max(0, health - 16);
      lastDamage = now;
      burst(player.x, player.y, "#f28aa9", 12);
      updateHud();
    }
  }
}

function findAimTarget() {
  let target = null;
  let closestToCursor = Infinity;
  for (const enemy of enemies) {
    const distance = Math.hypot(enemy.sprite.x - pointerX, enemy.sprite.y - pointerY);
    if (distance < closestToCursor) {
      target = enemy;
      closestToCursor = distance;
    }
  }
  if (closestToCursor > 310) {
    let closestToPlayer = Infinity;
    for (const enemy of enemies) {
      const distance = Math.hypot(enemy.sprite.x - player.x, enemy.sprite.y - player.y);
      if (distance < closestToPlayer) {
        target = enemy;
        closestToPlayer = distance;
      }
    }
  }
  return target;
}

function fireAtTarget(now) {
  const target = findAimTarget();
  if (!target) return;
  lastShot = now;
  const dx = target.sprite.x - player.x;
  const dy = target.sprite.y - player.y;
  const distance = Math.hypot(dx, dy) || 1;
  const baseAngle = Math.atan2(dy, dx);
  const shotCount = 1 + upgrades.spreadShot * 2;
  const spread = 0.14;
  for (let index = 0; index < shotCount; index++) {
    const angle = baseAngle + (index - (shotCount - 1) / 2) * spread;
    const sprite = makeSprite(
      player.x + Math.cos(angle) * 22,
      player.y + Math.sin(angle) * 22,
      9
    );
    projectiles.push({
      sprite,
      vx: Math.cos(angle) * 555,
      vy: Math.sin(angle) * 555,
      life: 1.7,
      angle,
      damage: 1 + upgrades.arcaneMight,
      pierceRemaining: upgrades.piercing,
      hitEnemies: new Set()
    });
  }
  burst(player.x + dx / distance * 20, player.y + dy / distance * 20, "#f3d08f", 3);
}

function fireInterval() {
  return Math.max(220, 620 * Math.pow(0.88, upgrades.rapidCast));
}

function updateProjectiles(delta) {
  for (let projectileIndex = projectiles.length - 1; projectileIndex >= 0; projectileIndex--) {
    const projectile = projectiles[projectileIndex];
    projectile.sprite.x += projectile.vx * delta;
    projectile.sprite.y += projectile.vy * delta;
    projectile.life -= delta;

    let removeProjectile = false;
    for (const enemy of [...enemies]) {
      if (projectile.hitEnemies.has(enemy)) continue;
      if (Math.hypot(projectile.sprite.x - enemy.sprite.x, projectile.sprite.y - enemy.sprite.y) >
          (enemy.size + 9) * 0.5) continue;
      projectile.hitEnemies.add(enemy);
      damageEnemy(enemy, projectile.damage);
      burst(projectile.sprite.x, projectile.sprite.y, enemy.color, 5);
      if (upgrades.soulburst > 0) {
        burst(projectile.sprite.x, projectile.sprite.y, "#d7a6ff", 15);
        damageNearbyEnemies(projectile.sprite.x, projectile.sprite.y, 76, projectile.damage, enemy);
      }
      if (projectile.pierceRemaining > 0) projectile.pierceRemaining--;
      else {
        removeProjectile = true;
        break;
      }
    }

    if (removeProjectile || projectile.life <= 0 ||
        projectile.sprite.x < -15 || projectile.sprite.x > gameWidth + 15 ||
        projectile.sprite.y < -15 || projectile.sprite.y > gameHeight + 15) {
      projectile.sprite.remove();
      projectiles.splice(projectileIndex, 1);
    }
  }
}

function damageEnemy(enemy, amount) {
  enemy.health -= amount;
  if (enemy.health > 0) return;
  const index = enemies.indexOf(enemy);
  if (index !== -1) defeatEnemy(index);
}

function damageNearbyEnemies(x, y, radius, amount, excludedEnemy) {
  for (const enemy of [...enemies]) {
    if (enemy === excludedEnemy) continue;
    if (Math.hypot(enemy.sprite.x - x, enemy.sprite.y - y) <= radius) {
      damageEnemy(enemy, amount);
    }
  }
}

function defeatEnemy(index) {
  const [enemy] = enemies.splice(index, 1);
  score += enemy.points * currentWave();
  burst(enemy.sprite.x, enemy.sprite.y, enemy.color, 18);
  spawnXpOrb(enemy.sprite.x, enemy.sprite.y, enemy.type === "brute" ? 4 : enemy.type === "shade" ? 2 : 1);
  enemy.sprite.remove();
}

function spawnXpOrb(x, y, value) {
  xpOrbs.push({
    sprite: makeSprite(x, y, 12),
    value,
    phase: Math.random() * Math.PI * 2
  });
}

function updateXpOrbs(delta) {
  const magnetRadius = 92 + upgrades.magnet * 68;
  for (let index = xpOrbs.length - 1; index >= 0; index--) {
    const orb = xpOrbs[index];
    const dx = player.x - orb.sprite.x;
    const dy = player.y - orb.sprite.y;
    const distance = Math.hypot(dx, dy) || 1;
    if (distance < magnetRadius) {
      const speed = distance < 100 ? 360 : 240 + upgrades.magnet * 80;
      orb.sprite.x += dx / distance * Math.min(speed * delta, distance);
      orb.sprite.y += dy / distance * Math.min(speed * delta, distance);
    }
    if (distance > 26) continue;

    xpOrbs.splice(index, 1);
    orb.sprite.remove();
    burst(orb.sprite.x, orb.sprite.y, "#bca0ff", 8);
    gainXp(orb.value);
    if (choosingUpgrade) break;
  }
}

function gainXp(amount) {
  const xpGained = amount * Math.pow(2, upgrades.soulHarvest);
  xp += xpGained;
  while (xp >= xpRequired) {
    xp -= xpRequired;
    playerLevel++;
    xpRequired = 8 + (playerLevel - 1) * 5;
    pendingLevelUps++;
  }
  updateHud();
  if (pendingLevelUps > 0 && !choosingUpgrade) showUpgradeChoice();
}

function showUpgradeChoice() {
  pendingLevelUps--;
  running = false;
  choosingUpgrade = true;
  lastFrameTime = millis();
  const available = upgradeDefinitions.filter(upgrade => upgrades[upgrade.id] < upgrade.max);
  const choices = available.slice();
  for (let index = choices.length - 1; index > 0; index--) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [choices[index], choices[swapIndex]] = [choices[swapIndex], choices[index]];
  }
  choices.length = Math.min(3, choices.length);
  statusKicker.innerHTML = "<span>✦</span> A NEW POWER AWAKENS";
  statusTitle.innerHTML = "CHOOSE YOUR<br><span>BLESSING</span>";
  statusMessage.textContent = `Level ${playerLevel} reached. Choose one upgrade to continue.`;
  statusButton.hidden = true;
  overlayHint.hidden = true;
  upgradeChoices.hidden = false;
  upgradeChoices.replaceChildren();
  statusPanel.classList.add("upgrade-mode");

  choices.forEach(upgrade => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "upgrade-choice";
    const icon = document.createElement("span");
    icon.className = "upgrade-icon";
    icon.textContent = upgrade.icon;
    const name = document.createElement("span");
    name.className = "upgrade-name";
    name.textContent = upgrade.name;
    const description = document.createElement("span");
    description.className = "upgrade-description";
    description.textContent = describeUpgrade(upgrade);
    button.append(icon, name, description);
    button.addEventListener("click", () => chooseUpgrade(upgrade.id));
    upgradeChoices.append(button);
  });
  statusPanel.classList.remove("hidden");
}

function describeUpgrade(upgrade) {
  const level = upgrades[upgrade.id];
  const descriptions = {
    rapidCast: `Fire bolts ${Math.round((1 - Math.pow(0.88, level + 1)) * 100)}% faster. ${upgradeRank(upgrade, level)}`,
    spreadShot: `Fire ${3 + level * 2} bolts in a widening fan. ${upgradeRank(upgrade, level)}`,
    piercing: `Bolts pierce ${level + 1} additional wraith${level === 0 ? "" : "s"}. ${upgradeRank(upgrade, level)}`,
    soulburst: "Bolts burst on impact, damaging nearby wraiths.",
    magnet: `Collect souls from much farther away. ${upgradeRank(upgrade, level)}`,
    arcaneMight: `Bolts deal ${level + 2} damage. ${upgradeRank(upgrade, level)}`,
    soulHarvest: `Gain ${2 ** (level + 1)}× XP from every soul. ${upgradeRank(upgrade, level)}`
  };
  return descriptions[upgrade.id];
}

function upgradeRank(upgrade, currentLevel) {
  return upgrade.max === Infinity
    ? `Rank ${currentLevel + 1}`
    : `(${currentLevel + 1}/${upgrade.max})`;
}

function chooseUpgrade(id) {
  if (!choosingUpgrade || !Object.prototype.hasOwnProperty.call(upgrades, id)) return;
  const definition = upgradeDefinitions.find(upgrade => upgrade.id === id);
  if (!definition || upgrades[id] >= definition.max) return;
  upgrades[id]++;
  choosingUpgrade = false;
  upgradeChoices.hidden = true;
  upgradeChoices.replaceChildren();
  statusPanel.classList.remove("upgrade-mode");
  statusPanel.classList.add("hidden");
  showToast(`${definition.name.toUpperCase()} — UPGRADE ${upgrades[id]}`);
  updateHud();

  if (pendingLevelUps > 0) showUpgradeChoice();
  else {
    running = true;
    lastFrameTime = millis();
  }
}

function updateParticles(delta) {
  particles = particles.filter(particle => {
    particle.life -= delta;
    particle.x += particle.vx * delta;
    particle.y += particle.vy * delta;
    particle.vx *= 0.98;
    particle.vy *= 0.98;
    return particle.life > 0;
  });
}

function burst(x, y, color, count) {
  for (let index = 0; index < count; index++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 25 + Math.random() * 125;
    particles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 0.2 + Math.random() * 0.5,
      maxLife: 0.7,
      size: 2 + Math.random() * 4,
      color
    });
  }
}

function updateHighscore() {
  const currentScore = Math.floor(score);
  if (currentScore <= highscore) return;
  highscore = currentScore;
  highscoreDisplay.textContent = formatScore(highscore);
  saveHighscore();
}

function updateHud() {
  scoreDisplay.textContent = formatScore(score);
  highscoreDisplay.textContent = formatScore(highscore);
  const seconds = Math.floor(elapsed);
  timeDisplay.textContent = `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
  waveDisplay.textContent = toRoman(currentWave());
  enemyCountDisplay.textContent = `${enemies.length} ${enemies.length === 1 ? "WRAITH" : "WRAITHS"}`;
  healthBar.style.width = `${health}%`;
  healthText.textContent = String(Math.ceil(health));
  playerLevelDisplay.textContent = String(playerLevel);
  xpBar.style.width = `${xp / xpRequired * 100}%`;
  xpCount.textContent = `${xp} / ${xpRequired} XP`;
  lastHudUpdate = millis();
}

function formatScore(value) {
  return String(Math.floor(value)).padStart(6, "0");
}

function toRoman(value) {
  const numerals = [
    [1000, "M"], [900, "CM"], [500, "D"], [400, "CD"],
    [100, "C"], [90, "XC"], [50, "L"], [40, "XL"],
    [10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"]
  ];
  let number = value;
  let result = "";
  for (const [amount, numeral] of numerals) {
    while (number >= amount) {
      result += numeral;
      number -= amount;
    }
  }
  return result;
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => toast.classList.remove("show"), 1600);
}

function endGame() {
  running = false;
  choosingUpgrade = false;
  pendingLevelUps = 0;
  upgradeChoices.hidden = true;
  upgradeChoices.replaceChildren();
  statusPanel.classList.remove("upgrade-mode");
  updateHighscore();
  updateHud();
  statusKicker.innerHTML = "<span>✦</span> THE HOLLOW CLAIMS ANOTHER";
  statusTitle.innerHTML = "THE NIGHT<br><span>CLAIMS YOU</span>";
  statusMessage.textContent = `You held out for ${timeDisplay.textContent}. Score ${formatScore(score)}. Best ${formatScore(highscore)}.`;
  statusButton.innerHTML = "FACE THE HOLLOW AGAIN <span>↗</span>";
  statusButton.hidden = false;
  overlayHint.hidden = true;
  statusPanel.classList.remove("hidden");
}

function drawPlayer(now) {
  const target = findAimTarget();
  const aimX = target ? target.sprite.x - player.x : pointerX - player.x;
  const aimY = target ? target.sprite.y - player.y : pointerY - player.y;
  const angle = Math.atan2(aimY, aimX);
  const hurtFlash = running && now - lastDamage < 180;

  push();
  translate(player.x, player.y);
  noStroke();
  fill(213, 183, 239, 25);
  ellipse(0, 9, 48, 20);
  fill("#332944");
  ellipse(0, 12, 24, 12);
  fill(hurtFlash ? "#ffe3e9" : "#c6a7e5");
  ellipse(0, 1 + Math.sin(now / 170) * 2, 25, 29);
  fill("#382a48");
  ellipse(0, -7, 23, 17);
  fill("#1a1825");
  triangle(-10, -10, -2, -24, 4, -9);
  triangle(1, -9, 10, -23, 12, -5);
  fill("#f2b9cb");
  ellipse(-5, 2, 3, 3);
  ellipse(5, 2, 3, 3);

  rotate(angle);
  fill("#382b47");
  rect(4, -3, 23, 6, 3);
  fill("#f3d08f");
  triangle(27, 0, 18, -5, 18, 5);
  fill(243, 208, 143, 65);
  circle(30, 0, 17);
  pop();

  if (running) {
    push();
    noFill();
    stroke(207, 174, 242, 95);
    strokeWeight(1);
    ellipse(player.x, player.y + 19, 36, 9);
    pop();
  }
}

function drawEnemies(now) {
  for (const enemy of enemies) {
    const x = enemy.sprite.x;
    const y = enemy.sprite.y + Math.sin(now / 190 + enemy.phase) * 3;
    push();
    translate(x, y);
    noStroke();
    fill(0, 0, 0, 65);
    ellipse(0, enemy.size * 0.43, enemy.size * 1.1, 8);
    fill(enemy.color);
    if (enemy.type === "brute") {
      ellipse(0, 0, enemy.size, enemy.size * 0.9);
      triangle(-11, -10, -17, -22, -4, -12);
      triangle(11, -10, 17, -22, 4, -12);
    } else {
      ellipse(0, 0, enemy.size * 0.88, enemy.size * 1.05);
      triangle(-8, 7, -10, 21, -1, 11);
      triangle(8, 7, 10, 21, 1, 11);
    }
    fill("#f5d6a0");
    circle(-5, -2, enemy.type === "brute" ? 4 : 3);
    circle(5, -2, enemy.type === "brute" ? 4 : 3);
    fill(245, 214, 160, 80);
    ellipse(0, 1, enemy.size * 1.45, enemy.size * 1.5);
    pop();

    if (enemy.maxHealth > 1) {
      fill("#120f1b");
      rect(x - 19, y - enemy.size * 0.7, 38, 4, 2);
      fill("#e48aa5");
      rect(x - 19, y - enemy.size * 0.7, 38 * enemy.health / enemy.maxHealth, 4, 2);
    }
  }
}

function drawProjectiles() {
  for (const projectile of projectiles) {
    const x = projectile.sprite.x;
    const y = projectile.sprite.y;
    push();
    translate(x, y);
    rotate(projectile.angle);
    noStroke();
    fill(243, 208, 143, 38);
    ellipse(-5, 0, 24, 13);
    fill("#ffe2a6");
    ellipse(0, 0, 10, 6);
    fill("#fff7dc");
    ellipse(1, 0, 4, 3);
    pop();
  }
}

function drawXpOrbs(now) {
  for (const orb of xpOrbs) {
    const x = orb.sprite.x;
    const y = orb.sprite.y + Math.sin(now / 190 + orb.phase) * 3;
    push();
    translate(x, y);
    rotate(Math.PI / 4);
    noStroke();
    fill(186, 153, 255, 50);
    rect(-8, -8, 16, 16, 3);
    fill("#c7a5ff");
    rect(-5, -5, 10, 10, 2);
    fill("#f3e7ff");
    rect(-2, -2, 4, 4, 1);
    pop();
  }
}

function drawParticles() {
  noStroke();
  for (const particle of particles) {
    fill(particle.color);
    circle(particle.x, particle.y, particle.size * particle.life / particle.maxLife);
  }
}

function drawSouls() {
  const count = Math.min(health / 25, 4);
  for (let index = 0; index < count; index++) {
    const x = 18 + index * 15;
    const y = gameHeight - 25;
    fill("#f08cae");
    circle(x - 3, y, 7);
    circle(x + 3, y, 7);
    triangle(x - 7, y + 1, x + 7, y + 1, x, y + 10);
  }
}