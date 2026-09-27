const gameWidth = 1200;
const gameHeight = 630;
const energyCellChance = 0.2;
const canvasWrap = document.getElementById("canvasWrap");
const statusPanel = document.getElementById("statusPanel");
const statusTitle = document.getElementById("statusTitle");
const statusMessage = document.getElementById("statusMessage");
const statusButton = document.getElementById("statusButton");
const distanceDisplay = document.getElementById("distance");
const coinDisplay = document.getElementById("coins");
const cellDisplay = document.getElementById("cells");
const toast = document.getElementById("toast");

const stars = Array.from({ length: 110 }, () => ({
  x: Math.random() * gameWidth,
  y: Math.random() * gameHeight,
  size: Math.random() * 2 + 0.5,
  depth: Math.random() * 0.8 + 0.2,
  phase: Math.random() * Math.PI * 2
}));

let gameSurface;
let pilot;
let obstacles = [];
let energyCells = [];
let coins = [];
let buildings = [];
let distance = 0;
let cellsCollected = 0;
let coinsCollected = 0;
let scrollSpeed = 5;
let speedMultiplier = 1;
let runFrames = 0;
let nextHazard = 0;
let thrusting = false;
let running = false;
let gameOver = false;
let toastTimeout;

function setup() {
  gameSurface = new Canvas(gameWidth, gameHeight);
  gameSurface.id = "gameCanvas";
  gameSurface.setAttribute("aria-label", "Neon Run flight game. Hold the mouse button, touch, or space to fly upward.");
  canvasWrap.insertBefore(gameSurface, canvasWrap.firstChild);
  world.gravity.y = 0;
  world.gravity.x = 0;
  gameSurface.addEventListener("pointerdown", startThrust);
  window.addEventListener("pointerup", stopThrust);
  window.addEventListener("pointercancel", stopThrust);
  window.addEventListener("keydown", handleKeyDown);
  window.addEventListener("keyup", handleKeyUp);
  statusButton.addEventListener("click", startGame);
  document.getElementById("resetButton").addEventListener("click", showReady);
  window.addEventListener("blur", () => { thrusting = false; });
  buildCity();
  resetFlight();
}

function buildCity() {
  buildings.forEach(building => building.remove());
  buildings = [];
  for (let x = 0; x < gameWidth + 180; x += 72) {
    const height = random(85, 255);
    const building = new Sprite(x, gameHeight - height / 2, random(38, 66), height);
    building.collider = "none";
    building.visible = false;
    building.color = random(["#151a3b", "#171b40", "#1b1c48", "#171f42"]);
    building.stroke = "#30345e";
    buildings.push(building);
  }
}

function resetFlight() {
  obstacles.forEach(hazard => hazard.sprite.remove());
  [...energyCells, ...coins].forEach(item => item.remove());
  if (pilot) pilot.remove();
  obstacles = [];
  energyCells = [];
  coins = [];
  distance = 0;
  cellsCollected = 0;
  coinsCollected = 0;
  scrollSpeed = 5;
  speedMultiplier = 1;
  runFrames = 0;
  nextHazard = 100;
  thrusting = false;
  pilot = new Sprite(260, gameHeight * 0.48, 45, 39);
  pilot.collider = "none";
  pilot.visible = false;
  pilot.color = "#68f4ed";
  pilot.stroke = "#c7fffc";
  pilot.strokeWeight = 2;
  pilot.rotationLock = true;
  pilot.velocityY = 0;
  updateHud();
}

function showReady() {
  running = false;
  gameOver = false;
  resetFlight();
  statusTitle.innerHTML = "NEON<br><span>RUN</span>";
  statusMessage.innerHTML = "A city of lights. An endless sky.<br>How far can you fly?";
  statusButton.innerHTML = 'IGNITE JETPACK <span>↗</span>';
  statusPanel.classList.remove("hidden");
}

function startGame() {
  resetFlight();
  running = true;
  gameOver = false;
  statusPanel.classList.add("hidden");
}

function startThrust(event) {
  if (!running) return;
  if (event.pointerType === "mouse" && event.button !== 0) return;
  thrusting = true;
  event.preventDefault();
}

function stopThrust() {
  thrusting = false;
}

function handleKeyDown(event) {
  if (event.code !== "Space" && event.code !== "ArrowUp") return;
  event.preventDefault();
  if (running) thrusting = true;
  else startGame();
}

function handleKeyUp(event) {
  if (event.code === "Space" || event.code === "ArrowUp") thrusting = false;
}

function draw() {
  drawSky();
  drawCity();

  if (!running) {
    if (pilot) drawPilot();
    return;
  }

  runFrames++;
  const baseSpeed = min(8.2, 5 + distance / 1150);
  scrollSpeed = baseSpeed * speedMultiplier;
  distance += scrollSpeed / 60;
  pilot.velocityY += thrusting ? -0.43 : 0.24;
  pilot.velocityY = constrain(pilot.velocityY, -6.1, 5.4);
  pilot.y += pilot.velocityY;
  pilot.y = constrain(pilot.y, 30, gameHeight - 35);
  if (pilot.y === 30 || pilot.y === gameHeight - 35) pilot.velocityY = 0;

  if (runFrames >= nextHazard) spawnHazard();
  moveHazardsAndPickups();
  drawHazards();
  drawPickups();
  checkCollisions();
  drawPilot();
  drawAltitude();

  if (runFrames % 8 === 0) updateHud();
}

function drawSky() {
  const ctx = drawingContext;
  const sky = ctx.createLinearGradient(0, 0, 0, gameHeight);
  sky.addColorStop(0, "#11132f");
  sky.addColorStop(0.55, "#1c1740");
  sky.addColorStop(1, "#29183f");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, gameWidth, gameHeight);

  noStroke();
  for (const star of stars) {
    const shimmer = 0.45 + 0.45 * sin(runFrames * 0.045 + star.phase);
    fill(190, 216, 255, shimmer * 210);
    circle((star.x - runFrames * star.depth * 0.45 + gameWidth * 3) % gameWidth, star.y, star.size);
  }

  drawingContext.save();
  drawingContext.globalAlpha = 0.35;
  noStroke();
  fill("#6b3ec1");
  circle(920, 125, 250);
  drawingContext.restore();
  noStroke();
  fill("#f1b5ff");
  circle(920, 125, 96);
  fill("#cc8af7");
  circle(935, 114, 90);
  fill("#151437");
  circle(955, 103, 83);
}

function drawCity() {
  for (const building of buildings) {
    building.x -= running ? scrollSpeed * 0.72 : 0.7;
    if (building.x < -80) {
      building.x = gameWidth + random(25, 95);
      building.h = random(85, 255);
      building.y = gameHeight - building.h / 2;
    }
    const width = building.w;
    const height = building.h;
    noStroke();
    fill(building.color);
    rect(building.x - width / 2, gameHeight - height, width, height);
    stroke(100, 108, 188, 75);
    strokeWeight(1);
    line(building.x - width / 2, gameHeight - height, building.x + width / 2, gameHeight - height);
    noStroke();
    for (let wy = gameHeight - height + 15; wy < gameHeight - 8; wy += 21) {
      for (let wx = building.x - width / 2 + 10; wx < building.x + width / 2 - 5; wx += 17) {
        const lit = (floor(wx / 17) + floor(wy / 21)) % 3;
        fill(lit ? color(104, 244, 237, 145) : color(250, 99, 188, 110));
        rect(wx, wy, 4, 7, 1);
      }
    }
  }

  noStroke();
  fill("#191832");
  rect(0, gameHeight - 4, gameWidth, 4);
  fill(104, 244, 237, 140);
  rect(0, gameHeight - 4, gameWidth, 2);
}

function spawnHazard() {
  const hazardType = random(["zapper", "mine", "missile"]);
  if (hazardType === "zapper") {
    const angle = random([-35, -25, 25, 35]);
    const y = random(145, gameHeight - 145);
    addHazard("zapper", gameWidth + 150, y, 236, 34, angle);
  } else if (hazardType === "mine") {
    const mineY = random(130, gameHeight - 190);
    addHazard("mine", gameWidth + 70, mineY, 48, 48);
    addHazard("mine", gameWidth + 70, mineY + random(115, 155), 48, 48);
  } else {
    addHazard("missile", gameWidth + 100, random(110, gameHeight - 110), 88, 34);
  }

  spawnCoinFormation();

  if (random() < energyCellChance) {
    const cell = new Sprite(gameWidth + random(480, 620), random(100, gameHeight - 100), 23);
    cell.collider = "none";
    cell.visible = false;
    cell.color = "#68f4ed";
    cell.stroke = "#e1fffd";
    cell.strokeWeight = 2;
    energyCells.push(cell);
  }
  nextHazard = runFrames + floor(random(115, 150));
}

function spawnCoinFormation() {
  const formation = random(["line", "triangle", "arc"]);
  const startX = gameWidth + random(310, 440);
  const centerY = random(150, gameHeight - 150);
  let positions;

  if (formation === "line") {
    positions = Array.from({ length: 6 }, (_, index) => [index * 48, 0]);
  } else if (formation === "triangle") {
    positions = [
      [0, 0],
      [48, -28], [48, 28],
      [96, -56], [96, 0], [96, 56]
    ];
  } else {
    positions = [
      [0, -66], [42, -39], [84, -18], [126, -6],
      [168, -18], [210, -39], [252, -66]
    ];
  }

  for (const [offsetX, offsetY] of positions) {
    const coin = new Sprite(startX + offsetX, centerY + offsetY, 23);
    coin.collider = "none";
    coin.visible = false;
    coin.color = "#ffd166";
    coin.stroke = "#fff0b8";
    coin.strokeWeight = 2;
    coins.push(coin);
  }
}

function addHazard(type, x, y, width, height, angle = 0) {
  const sprite = new Sprite(x, y, width, height);
  sprite.collider = "none";
  sprite.visible = false;
  obstacles.push({ type, sprite, angle });
}

function moveHazardsAndPickups() {
  for (const hazard of obstacles) {
    hazard.sprite.x -= scrollSpeed;
    if (hazard.type === "missile") {
      hazard.sprite.x -= 2.8;
    }
  }
  for (const item of [...energyCells, ...coins]) {
    item.x -= scrollSpeed;
    item.rotation += 3;
  }

  obstacles = obstacles.filter(hazard => {
    if (hazard.sprite.x < -150) {
      hazard.sprite.remove();
      return false;
    }
    return true;
  });
  energyCells = energyCells.filter(cell => {
    if (cell.x < -60) {
      cell.remove();
      return false;
    }
    return true;
  });
  coins = coins.filter(coin => {
    if (coin.x < -60) {
      coin.remove();
      return false;
    }
    return true;
  });
}

function drawHazards() {
  for (const hazard of obstacles) {
    if (hazard.type === "zapper") {
      drawZapper(hazard);
    } else if (hazard.type === "mine") {
      drawMine(hazard);
    } else {
      drawMissile(hazard);
    }
  }
}

function drawZapper(hazard) {
  push();
  translate(hazard.sprite.x, hazard.sprite.y);
  rotate(radians(hazard.angle));
  stroke(251, 99, 188, 45);
  strokeWeight(27);
  line(-hazard.sprite.w / 2, 0, hazard.sprite.w / 2, 0);
  stroke("#fb63bc");
  strokeWeight(12);
  line(-hazard.sprite.w / 2, 0, hazard.sprite.w / 2, 0);
  stroke("#fff0fb");
  strokeWeight(3);
  line(-hazard.sprite.w / 2, 0, hazard.sprite.w / 2, 0);
  noStroke();
  for (const end of [-hazard.sprite.w / 2, hazard.sprite.w / 2]) {
    fill("#34204d");
    stroke("#ff9cda");
    strokeWeight(3);
    circle(end, 0, 26);
    noStroke();
    fill("#fff0fb");
    circle(end, 0, 8);
  }
  pop();
}

function drawMine(hazard) {
  const pulse = 1 + 0.12 * sin(runFrames * 0.16);
  push();
  translate(hazard.sprite.x, hazard.sprite.y);
  noStroke();
  fill(251, 99, 188, 34);
  circle(0, 0, 58 * pulse);
  stroke("#fb63bc");
  strokeWeight(3);
  fill("#32204b");
  circle(0, 0, 38);
  noStroke();
  fill("#ffb1df");
  circle(0, 0, 15);
  stroke("#ff82ce");
  strokeWeight(4);
  for (let i = 0; i < 8; i++) {
    const angle = TWO_PI * i / 8;
    line(cos(angle) * 20, sin(angle) * 20, cos(angle) * 26, sin(angle) * 26);
  }
  pop();
}

function drawMissile(hazard) {
  push();
  translate(hazard.sprite.x, hazard.sprite.y);
  noStroke();
  fill(251, 99, 188, 75);
  triangle(44, -4, 44, 4, 72, 0);
  fill("#fb63bc");
  triangle(40, -3, 40, 3, 60, 0);
  fill("#a9b5d2");
  rect(-35, -12, 64, 24, 7);
  fill("#e2e8f8");
  rect(-22, -8, 38, 16, 5);
  fill("#fb63bc");
  triangle(-30, -10, -30, 10, -43, 0);
  triangle(0, -10, 11, -20, 15, -10);
  triangle(0, 10, 11, 20, 15, 10);
  fill("#68f4ed");
  circle(5, 0, 9);
  pop();
}

function drawPickups() {
  for (const cell of energyCells) {
    noFill();
    stroke(104, 244, 237, 70);
    strokeWeight(5);
    circle(cell.x, cell.y, 34);
    noStroke();
    fill("#ecffff");
    circle(cell.x, cell.y, 6);
  }

  for (const coin of coins) {
    noStroke();
    fill(255, 209, 102, 45);
    circle(coin.x, coin.y, 35);
    fill("#ffd166");
    circle(coin.x, coin.y, 22);
    fill("#fff0b8");
    circle(coin.x, coin.y, 14);
    fill("#c48726");
    circle(coin.x, coin.y, 8);
  }
}

function checkCollisions() {
  const px = pilot.x;
  const py = pilot.y;
  for (const hazard of obstacles) {
    const sprite = hazard.sprite;
    let hit = false;
    if (hazard.type === "zapper") {
      const halfLength = sprite.w / 2;
      const angle = radians(hazard.angle);
      const dx = cos(angle) * halfLength;
      const dy = sin(angle) * halfLength;
      hit = distanceToSegment(px, py, sprite.x - dx, sprite.y - dy, sprite.x + dx, sprite.y + dy) < 25;
    } else if (hazard.type === "mine") {
      hit = dist(px, py, sprite.x, sprite.y) < 40;
    } else {
      const closestX = constrain(px, sprite.x - sprite.w / 2, sprite.x + sprite.w / 2);
      const closestY = constrain(py, sprite.y - sprite.h / 2, sprite.y + sprite.h / 2);
      hit = dist(px, py, closestX, closestY) < 23;
    }
    if (hit) {
      endFlight();
      return;
    }
  }

  energyCells = energyCells.filter(cell => {
    if (dist(px, py, cell.x, cell.y) < 34) {
      cell.remove();
      cellsCollected++;
      speedMultiplier *= 1.2;
      scrollSpeed = min(8.2, 5 + distance / 1150) * speedMultiplier;
      showToast("ENERGY CELL: SPEED +20%");
      updateHud();
      return false;
    }
    return true;
  });

  coins = coins.filter(coin => {
    if (dist(px, py, coin.x, coin.y) < 34) {
      coin.remove();
      coinsCollected++;
      showToast("+1 COIN");
      updateHud();
      return false;
    }
    return true;
  });

}

function distanceToSegment(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lengthSquared = dx * dx + dy * dy;
  const projection = constrain(((px - x1) * dx + (py - y1) * dy) / lengthSquared, 0, 1);
  return dist(px, py, x1 + projection * dx, y1 + projection * dy);
}

function drawPilot() {
  const tilt = constrain(pilot.velocityY * 2.2, -18, 16);
  push();
  translate(pilot.x, pilot.y);
  rotate(radians(tilt));

  noStroke();
  if (thrusting && running) {
    const flameHeight = random(18, 31);
    fill(251, 99, 188, 90);
    triangle(-26, -7, -26, 7, -26 - flameHeight, 0);
    fill("#fb63bc");
    triangle(-25, -4, -25, 4, -25 - flameHeight * 0.68, 0);
    fill("#fff0c2");
    triangle(-25, -2, -25, 2, -25 - flameHeight * 0.38, 0);
  }

  fill("#dce8ff");
  rect(-18, -11, 15, 22, 5);
  fill("#aebce3");
  rect(-16, -7, 10, 3, 1);
  rect(-16, 1, 10, 3, 1);

  fill("#68f4ed");
  stroke("#e1fffd");
  strokeWeight(2);
  rect(-8, -12, 25, 24, 8);
  noStroke();
  fill("#c1fffa");
  circle(9, -1, 18);
  fill("#273253");
  circle(12, -2, 12);
  fill("#fb63bc");
  rect(13, -5, 5, 4, 2);
  pop();
}

function drawAltitude() {
  const barHeight = 100;
  const barY = gameHeight / 2 - barHeight / 2;
  noStroke();
  fill(255, 255, 255, 35);
  rect(gameWidth - 25, barY, 3, barHeight, 2);
  fill("#68f4ed");
  const position = constrain(map(pilot.y, 45, gameHeight - 45, 0, barHeight - 12), 0, barHeight - 12);
  rect(gameWidth - 27, barY + position, 7, 12, 3);
}

function endFlight() {
  if (gameOver) return;
  gameOver = true;
  running = false;
  thrusting = false;
  statusTitle.innerHTML = "FLIGHT<br><span>ENDED</span>";
  statusMessage.innerHTML = `Distance: ${floor(distance)} m<br>Coins: ${coinsCollected} · Speed cells: ${cellsCollected}<br>Ready to fly again?`;
  statusButton.innerHTML = 'FLY AGAIN <span>↗</span>';
  statusPanel.classList.remove("hidden");
}

function updateHud() {
  distanceDisplay.textContent = String(floor(distance)).padStart(5, "0");
  coinDisplay.textContent = String(coinsCollected).padStart(2, "0");
  cellDisplay.textContent = String(cellsCollected).padStart(2, "0");
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");
  window.clearTimeout(toastTimeout);
  toastTimeout = window.setTimeout(() => toast.classList.remove("show"), 850);
}