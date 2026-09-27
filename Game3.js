const gameWidth = 1200;
const gameHeight = 654;
const worldWidth = 4200;
const worldHeight = 3000;
const arena = document.getElementById("arena");
const statusPanel = document.getElementById("statusPanel");
const statusTitle = document.getElementById("statusTitle");
const statusMessage = document.getElementById("statusMessage");
const statusButton = document.getElementById("statusButton");
const scoreDisplay = document.getElementById("score");
const highscoreDisplay = document.getElementById("highscore");
const timeDisplay = document.getElementById("time");
const waveDisplay = document.getElementById("wave");
const enemyCountDisplay = document.getElementById("enemyCount");
const healthBar = document.getElementById("healthBar");
const healthText = document.getElementById("healthText");
const toast = document.getElementById("toast");
const highscoreKey = "moonfall-highscore";

let stars = [];
let forestProps = [];
const enemyKinds = [
  { name: "wraith", health: 1, speed: 1.25, radius: 16, score: 100, color: "#b48aff" },
  { name: "fang", health: 2, speed: 0.91, radius: 22, score: 180, color: "#f280a8" },
  { name: "brute", health: 5, speed: 0.56, radius: 29, score: 320, color: "#e6a65e" }
];

let gameSurface;
let player;
let cameraX = 0;
let cameraY = 0;
let enemies = [];
let bolts = [];
let enemyBolts = [];
let gems = [];
let particles = [];
let running = false;
let gameOver = false;
let elapsed = 0;
let score = 0;
let kills = 0;
let health = 100;
let invulnerable = 0;
let fireCooldown = 0;
let spawnCooldown = 0;
let toastTimeout;
let highscore = loadHighscore();

function setup() {
  gameSurface = new Canvas(gameWidth, gameHeight);
  gameSurface.id = "gameCanvas";
  gameSurface.setAttribute("aria-label", "Moonfall. Move your mouse away from the hero to steer through the forest. The camera follows your hero while magic auto-fires.");
  arena.insertBefore(gameSurface, arena.firstChild);
  world.gravity.x = 0;
  world.gravity.y = 0;
  statusButton.addEventListener("click", startGame);
  document.getElementById("resetButton").addEventListener("click", showReady);
  window.addEventListener("keydown", handleKeyDown);
  highscoreDisplay.textContent = formatScore(highscore);
  createScenery();
  resetGame();
}

function createScenery() {
  stars = Array.from({ length: 360 }, () => ({
    x: random(worldWidth),
    y: random(worldHeight),
    size: random(0.5, 2.5),
    phase: random(TWO_PI)
  }));
  forestProps = Array.from({ length: 600 }, () => ({
    x: random(worldWidth),
    y: random(worldHeight),
    size: random(0.65, 1.45),
    shade: random(["#27253a", "#222234", "#1c202f", "#292438"]),
    phase: random(TWO_PI)
  }));
}

function loadHighscore() {
  try {
    const value = Number(localStorage.getItem(highscoreKey));
    return Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
  } catch (error) {
    console.warn("Could not load the Moonfall high score.", error);
    return 0;
  }
}

function saveHighscore(value) {
  try {
    localStorage.setItem(highscoreKey, String(value));
  } catch (error) {
    console.warn("Could not save the Moonfall high score.", error);
  }
}

function resetGame() {
  enemies.forEach(enemy => enemy.sprite.remove());
  if (player && typeof player.remove === "function") player.remove();
  enemies = [];
  bolts = [];
  enemyBolts = [];
  gems = [];
  particles = [];
  elapsed = 0;
  score = 0;
  kills = 0;
  health = 100;
  invulnerable = 0;
  fireCooldown = 0;
  spawnCooldown = 0.8;
  player = new Sprite(worldWidth / 2, worldHeight / 2, 30, 30);
  player.collider = "none";
  player.visible = false;
  player.radius = 18;
  player.speed = 320;
  updateCamera();
  updateHud();
}

function showReady() {
  running = false;
  gameOver = false;
  resetGame();
  statusTitle.innerHTML = 'MOON<span>FALL</span>';
  statusMessage.textContent = "The Hollow is hungry. How long can you survive?";
  statusButton.innerHTML = 'ENTER THE HOLLOW <span>↗</span>';
  statusPanel.classList.remove("hidden");
}

function startGame() {
  resetGame();
  running = true;
  gameOver = false;
  statusPanel.classList.add("hidden");
}

function handleKeyDown(event) {
  if (event.code === "KeyR") showReady();
  if (event.code === "Enter" && !running) startGame();
}

function updateCamera() {
  cameraX = constrain(player.x, gameWidth / 2, worldWidth - gameWidth / 2);
  cameraY = constrain(player.y, gameHeight / 2, worldHeight - gameHeight / 2);
}

function draw() {
  if (!player) return;
  updateCamera();
  if (running) updateGame();
  updateCamera();
  background("#171526");
  push();
  translate(gameWidth / 2 - cameraX, gameHeight / 2 - cameraY);
  drawForest();
  drawGems();
  drawBolts();
  drawEnemies();
  drawParticles();
  drawPlayer();
  pop();
  camera.off();
}

function updateGame() {
  elapsed += deltaTime / 1000;
  if (invulnerable > 0) invulnerable -= deltaTime / 1000;
  fireCooldown -= deltaTime / 1000;
  spawnCooldown -= deltaTime / 1000;

  const playerScreenX = gameWidth / 2 + player.x - cameraX;
  const playerScreenY = gameHeight / 2 + player.y - cameraY;
  const steerX = mouseX - playerScreenX;
  const steerY = mouseY - playerScreenY;
  const steerDistance = Math.hypot(steerX, steerY);
  if (steerDistance > 18) {
    const step = min(steerDistance, player.speed * deltaTime / 1000);
    player.x = constrain(player.x + steerX / steerDistance * step, gameWidth / 2, worldWidth - gameWidth / 2);
    player.y = constrain(player.y + steerY / steerDistance * step, gameHeight / 2, worldHeight - gameHeight / 2);
  }

  if (spawnCooldown <= 0) spawnEnemy();
  updateEnemies();
  updatePlayerBolts();
  updateEnemyBolts();
  updateGems();
  updateParticles();
  checkPlayerCollisions();
  autoFire();
  if (elapsed >= 0 && floor(elapsed) !== floor(elapsed - deltaTime / 1000)) updateHud();
}

function drawForest() {
  const ctx = drawingContext;
  const sky = ctx.createLinearGradient(0, 0, 0, worldHeight);
  sky.addColorStop(0, "#171729");
  sky.addColorStop(0.58, "#242039");
  sky.addColorStop(1, "#171927");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, worldWidth, worldHeight);

  noStroke();
  for (const star of stars) {
    if (star.x < cameraX - gameWidth / 2 || star.x > cameraX + gameWidth / 2 ||
        star.y < cameraY - gameHeight / 2 || star.y > cameraY + gameHeight / 2) continue;
    const shimmer = 0.34 + 0.38 * sin(frameCount * 0.027 + star.phase);
    fill(218, 206, 255, shimmer * 210);
    circle(star.x, star.y, star.size);
  }

  drawMoon();
  for (const tree of forestProps) {
    if (tree.x < cameraX - gameWidth / 2 - 60 || tree.x > cameraX + gameWidth / 2 + 60 ||
        tree.y < cameraY - gameHeight / 2 - 110 || tree.y > cameraY + gameHeight / 2 + 40) continue;
    drawTree(tree);
  }

  noStroke();
  fill("#191a29");
  rect(0, 0, worldWidth, 12);
  rect(0, worldHeight - 12, worldWidth, 12);
  rect(0, 0, 12, worldHeight);
  rect(worldWidth - 12, 0, 12, worldHeight);
}

function drawMoon() {
  const moonX = worldWidth * 0.72;
  const moonY = worldHeight * 0.19;
  drawingContext.save();
  drawingContext.globalAlpha = 0.18;
  noStroke();
  fill("#a587db");
  circle(moonX, moonY, 216);
  drawingContext.restore();
  noStroke();
  fill("#e7d9e8");
  circle(moonX, moonY, 84);
  fill("#b6a0c8");
  circle(moonX + 25, moonY - 15, 77);
  fill("#191729");
  circle(moonX + 45, moonY - 27, 71);
}

function drawTree(tree) {
  const size = tree.size;
  const sway = sin(frameCount * 0.006 + tree.phase) * 3;
  const topY = tree.y - 82 * size;
  noStroke();
  fill(tree.shade);
  triangle(tree.x - 50 * size + sway, tree.y + 30 * size, tree.x + sway, topY - 43 * size, tree.x + 48 * size + sway, tree.y + 30 * size);
  triangle(tree.x - 40 * size + sway, tree.y - 14 * size, tree.x + sway, topY - 12 * size, tree.x + 41 * size + sway, tree.y - 14 * size);
  rect(tree.x - 4 * size + sway, tree.y - 5 * size, 8 * size, 36 * size);
  fill(184, 160, 220, 24);
  circle(tree.x + 20 * size + sway, tree.y - 30 * size, 3 * size);
  circle(tree.x - 24 * size + sway, tree.y - 63 * size, 2 * size);
}

function spawnEnemy() {
  const wave = floor(elapsed / 22) + 1;
  const angle = random(TWO_PI);
  const spawnDistance = Math.hypot(gameWidth / 2, gameHeight / 2) + random(95, 250);
  const x = constrain(player.x + cos(angle) * spawnDistance, 32, worldWidth - 32);
  const y = constrain(player.y + sin(angle) * spawnDistance, 32, worldHeight - 32);
  let kind = enemyKinds[0];
  const roll = random();
  if (wave >= 3 && roll < 0.13) kind = enemyKinds[2];
  else if (wave >= 2 && roll < 0.38) kind = enemyKinds[1];
  const scale = min(1.8, 1 + max(0, wave - 1) * 0.12);
  const sprite = new Sprite(x, y, kind.radius * 2, kind.radius * 2);
  sprite.collider = "none";
  sprite.visible = false;
  enemies.push({
    sprite,
    x, y, radius: kind.radius, health: kind.health + floor((wave - 1) / 4),
    maxHealth: kind.health + floor((wave - 1) / 4), speed: kind.speed * scale,
    score: kind.score, color: kind.color, type: kind.name, phase: random(TWO_PI),
    shotCooldown: random(1.3, 3.7)
  });
  const interval = max(0.32, 1.18 - elapsed * 0.008);
  spawnCooldown = random(interval * 0.66, interval * 1.25);
}

function updateEnemies() {
  for (let i = enemies.length - 1; i >= 0; i--) {
    const enemy = enemies[i];
    const angle = atan2(player.y - enemy.y, player.x - enemy.x);
    enemy.x += cos(angle) * enemy.speed;
    enemy.y += sin(angle) * enemy.speed;
    enemy.sprite.x = enemy.x;
    enemy.sprite.y = enemy.y;
    enemy.phase += 0.065;
    if (enemy.type === "brute") {
      enemy.shotCooldown -= deltaTime / 1000;
      if (enemy.shotCooldown <= 0) {
        enemyBolts.push({ x: enemy.x, y: enemy.y, vx: cos(angle) * 3, vy: sin(angle) * 3, radius: 7 });
        enemy.shotCooldown = random(2.8, 4.2);
      }
    }
  }
}

function autoFire() {
  if (fireCooldown > 0 || enemies.length === 0) return;
  let target = enemies[0];
  let closest = Infinity;
  for (const enemy of enemies) {
    const distance = dist(player.x, player.y, enemy.x, enemy.y);
    if (distance < closest) {
      closest = distance;
      target = enemy;
    }
  }
  const angle = atan2(target.y - player.y, target.x - player.x);
  const speed = 9.2;
  bolts.push({ x: player.x + cos(angle) * 18, y: player.y + sin(angle) * 18, vx: cos(angle) * speed, vy: sin(angle) * speed, radius: 5 });
  fireCooldown = max(0.105, 0.31 - elapsed * 0.0011);
  addParticles(player.x + cos(angle) * 20, player.y + sin(angle) * 20, "#c9a9ff", 3, 1.1);
}

function updatePlayerBolts() {
  for (let i = bolts.length - 1; i >= 0; i--) {
    const bolt = bolts[i];
    bolt.x += bolt.vx;
    bolt.y += bolt.vy;
    if (bolt.x < -20 || bolt.x > worldWidth + 20 || bolt.y < -20 || bolt.y > worldHeight + 20) {
      bolts.splice(i, 1);
      continue;
    }
    for (let j = enemies.length - 1; j >= 0; j--) {
      const enemy = enemies[j];
      if (dist(bolt.x, bolt.y, enemy.x, enemy.y) >= bolt.radius + enemy.radius - 3) continue;
      enemy.health--;
      bolts.splice(i, 1);
      addParticles(bolt.x, bolt.y, enemy.color, 5, 2);
      if (enemy.health <= 0) defeatEnemy(j);
      break;
    }
  }
}

function defeatEnemy(index) {
  const [enemy] = enemies.splice(index, 1);
  enemy.sprite.remove();
  kills++;
  score += enemy.score;
  if (random() < 0.24) gems.push({ x: enemy.x, y: enemy.y, phase: random(TWO_PI) });
  addParticles(enemy.x, enemy.y, enemy.color, 15, 3);
  if (score > highscore) {
    highscore = score;
    saveHighscore(highscore);
    highscoreDisplay.textContent = formatScore(highscore);
  }
  updateScore();
  if (kills % 10 === 0) showToast("✧ " + kills + " SHADES BANISHED");
}

function updateEnemyBolts() {
  for (let i = enemyBolts.length - 1; i >= 0; i--) {
    const bolt = enemyBolts[i];
    bolt.x += bolt.vx;
    bolt.y += bolt.vy;
    if (bolt.x < -20 || bolt.x > worldWidth + 20 || bolt.y < -20 || bolt.y > worldHeight + 20) {
      enemyBolts.splice(i, 1);
      continue;
    }
    if (dist(bolt.x, bolt.y, player.x, player.y) < bolt.radius + player.radius && invulnerable <= 0) {
      enemyBolts.splice(i, 1);
      takeDamage(13);
    }
  }
}

function updateGems() {
  for (let i = gems.length - 1; i >= 0; i--) {
    const gem = gems[i];
    const distance = dist(gem.x, gem.y, player.x, player.y);
    if (distance < 115) {
      const angle = atan2(player.y - gem.y, player.x - gem.x);
      gem.x += cos(angle) * (distance < 32 ? 6 : 3.8);
      gem.y += sin(angle) * (distance < 32 ? 6 : 3.8);
    }
    if (distance < 23) {
      gems.splice(i, 1);
      score += 45;
      if (score > highscore) {
        highscore = score;
        saveHighscore(highscore);
        highscoreDisplay.textContent = formatScore(highscore);
      }
      updateScore();
      addParticles(gem.x, gem.y, "#f4d28e", 10, 2.5);
    }
  }
}

function checkPlayerCollisions() {
  if (invulnerable > 0) return;
  for (const enemy of enemies) {
    if (dist(player.x, player.y, enemy.x, enemy.y) < player.radius + enemy.radius - 4) {
      takeDamage(enemy.type === "brute" ? 22 : 16);
      const angle = atan2(player.y - enemy.y, player.x - enemy.x);
      player.x = constrain(player.x + cos(angle) * 23, gameWidth / 2, worldWidth - gameWidth / 2);
      player.y = constrain(player.y + sin(angle) * 23, gameHeight / 2, worldHeight - gameHeight / 2);
      break;
    }
  }
}

function takeDamage(amount) {
  health = max(0, health - amount);
  invulnerable = 0.82;
  addParticles(player.x, player.y, "#ff8aa9", 12, 3);
  updateHud();
  if (health <= 0) endGame();
}

function endGame() {
  running = false;
  gameOver = true;
  statusTitle.innerHTML = 'THE NIGHT <span>CLAIMS YOU</span>';
  statusMessage.textContent = "Score " + formatScore(score) + " · " + formatTime(elapsed) + " survived · " + kills + " shades banished";
  statusButton.innerHTML = 'RISE AGAIN <span>↗</span>';
  statusPanel.classList.remove("hidden");
}

function addParticles(x, y, particleColor, count, speed) {
  for (let i = 0; i < count; i++) {
    const angle = random(TWO_PI);
    const velocity = random(0.4, speed);
    particles.push({ x, y, vx: cos(angle) * velocity, vy: sin(angle) * velocity, life: random(15, 31), maxLife: 31, color: particleColor, size: random(2, 5) });
  }
}

function updateParticles() {
  for (let i = particles.length - 1; i >= 0; i--) {
    const particle = particles[i];
    particle.x += particle.vx;
    particle.y += particle.vy;
    particle.vx *= 0.96;
    particle.vy *= 0.96;
    particle.life--;
    if (particle.life <= 0) particles.splice(i, 1);
  }
}

function drawGems() {
  noStroke();
  for (const gem of gems) {
    const pulse = 9 + sin(frameCount * 0.12 + gem.phase) * 2;
    drawingContext.save();
    drawingContext.shadowColor = "#f4d28e";
    drawingContext.shadowBlur = 17;
    fill("#f4d28e");
    circle(gem.x, gem.y, pulse);
    fill("#fff1c8");
    circle(gem.x, gem.y, 3);
    drawingContext.restore();
  }
}

function drawBolts() {
  noStroke();
  drawingContext.save();
  drawingContext.shadowBlur = 17;
  drawingContext.shadowColor = "#b996ff";
  fill("#dfcaff");
  for (const bolt of bolts) circle(bolt.x, bolt.y, bolt.radius * 2);
  drawingContext.restore();
  drawingContext.save();
  drawingContext.shadowBlur = 14;
  drawingContext.shadowColor = "#ff869f";
  fill("#ffb0ba");
  for (const bolt of enemyBolts) circle(bolt.x, bolt.y, bolt.radius * 2);
  drawingContext.restore();
}

function drawEnemies() {
  for (const enemy of enemies) {
    const bob = sin(enemy.phase) * 3;
    drawingContext.save();
    drawingContext.shadowColor = enemy.color;
    drawingContext.shadowBlur = 16;
    noStroke();
    fill(35, 26, 51, 215);
    circle(enemy.x, enemy.y + bob, enemy.radius * 2);
    fill(enemy.color);
    circle(enemy.x, enemy.y - enemy.radius * 0.06 + bob, enemy.radius * 1.2);
    fill("#211b31");
    ellipse(enemy.x, enemy.y + enemy.radius * 0.35 + bob, enemy.radius * 1.5, enemy.radius * 0.9);
    fill("#ffe8af");
    circle(enemy.x - enemy.radius * 0.24, enemy.y - enemy.radius * 0.05 + bob, 3.5);
    circle(enemy.x + enemy.radius * 0.24, enemy.y - enemy.radius * 0.05 + bob, 3.5);
    drawingContext.restore();
    if (enemy.maxHealth > 1) {
      noStroke();
      fill("#0b0a12aa");
      rect(enemy.x - enemy.radius, enemy.y - enemy.radius - 11, enemy.radius * 2, 3, 2);
      fill(enemy.color);
      rect(enemy.x - enemy.radius, enemy.y - enemy.radius - 11, enemy.radius * 2 * enemy.health / enemy.maxHealth, 3, 2);
    }
  }
}

function drawParticles() {
  noStroke();
  for (const particle of particles) {
    const alpha = 255 * particle.life / particle.maxLife;
    const shade = color(particle.color);
    shade.setAlpha(alpha);
    fill(shade);
    circle(particle.x, particle.y, particle.size * particle.life / particle.maxLife);
  }
}

function drawPlayer() {
  if (invulnerable > 0 && frameCount % 6 < 3) return;
  const nearest = findNearestEnemy();
  if (nearest) {
    const angle = atan2(nearest.y - player.y, nearest.x - player.x);
    noFill();
    stroke(214, 193, 255, 90);
    strokeWeight(1);
    circle(nearest.x, nearest.y, nearest.radius * 2 + 13);
    noStroke();
    drawingContext.save();
    drawingContext.shadowColor = "#c7a6ff";
    drawingContext.shadowBlur = 24;
    fill("#d6c5f5");
    circle(player.x, player.y, 30);
    fill("#614c84");
    circle(player.x, player.y, 19);
    fill("#f3dfcb");
    ellipse(player.x + cos(angle) * 5, player.y + sin(angle) * 5, 12, 13);
    fill("#221a32");
    triangle(player.x - 15, player.y - 10, player.x + 14, player.y - 10, player.x, player.y - 24);
    circle(player.x - 11, player.y - 4, 8);
    circle(player.x + 11, player.y - 4, 8);
    drawingContext.restore();
  } else {
    noStroke();
    drawingContext.save();
    drawingContext.shadowColor = "#c7a6ff";
    drawingContext.shadowBlur = 24;
    fill("#d6c5f5");
    circle(player.x, player.y, 30);
    fill("#614c84");
    circle(player.x, player.y, 19);
    fill("#f3dfcb");
    ellipse(player.x, player.y + 3, 12, 13);
    fill("#221a32");
    triangle(player.x - 15, player.y - 10, player.x + 14, player.y - 10, player.x, player.y - 24);
    circle(player.x - 11, player.y - 4, 8);
    circle(player.x + 11, player.y - 4, 8);
    drawingContext.restore();
  }
}

function findNearestEnemy() {
  let nearest = null;
  let closest = Infinity;
  for (const enemy of enemies) {
    const distance = dist(player.x, player.y, enemy.x, enemy.y);
    if (distance < closest) {
      closest = distance;
      nearest = enemy;
    }
  }
  return nearest;
}

function updateHud() {
  updateScore();
  timeDisplay.textContent = formatTime(elapsed);
  waveDisplay.textContent = toRoman(floor(elapsed / 22) + 1);
  enemyCountDisplay.textContent = enemies.length + (enemies.length === 1 ? " WRAITH" : " WRAITHS");
  healthBar.style.width = health + "%";
  healthText.textContent = String(health);
  healthBar.style.background = health <= 30 ? "#ff688c" : "";
}

function updateScore() {
  scoreDisplay.textContent = formatScore(score);
  highscoreDisplay.textContent = formatScore(highscore);
}

function formatScore(value) {
  return String(value).padStart(6, "0");
}

function formatTime(seconds) {
  const total = floor(seconds);
  return String(floor(total / 60)).padStart(2, "0") + ":" + String(total % 60).padStart(2, "0");
}

function toRoman(value) {
  const numerals = [[10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"]];
  let remainder = min(10, value);
  let result = "";
  for (const [amount, numeral] of numerals) {
    while (remainder >= amount) {
      result += numeral;
      remainder -= amount;
    }
  }
  return result;
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => toast.classList.remove("show"), 1200);
}
