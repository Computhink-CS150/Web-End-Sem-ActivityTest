const gameWidth = 1200;
const gameHeight = 630;
const canvasWrap = document.getElementById("canvasWrap");
const statusPanel = document.getElementById("statusPanel");
const statusTitle = document.getElementById("statusTitle");
const statusMessage = document.getElementById("statusMessage");
const statusButton = document.getElementById("statusButton");
const scoreDisplay = document.getElementById("score");
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
let pickups = [];
let buildings = [];
let distance = 0;
let cellsCollected = 0;
let scrollSpeed = 5;
let frameCount = 0;
let nextGate = 0;
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
  [...obstacles, ...pickups].forEach(item => item.remove());
  if (pilot) pilot.remove();
  obstacles = [];
  pickups = [];
  distance = 0;
  cellsCollected = 0;
  scrollSpeed = 5;
  frameCount = 0;
  nextGate = 88;
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

  frameCount++;
  distance += scrollSpeed / 60;
  scrollSpeed = min(8.2, 5 + distance / 1150);
  pilot.velocityY += thrusting ? -0.43 : 0.24;
  pilot.velocityY = constrain(pilot.velocityY, -6.1, 5.4);
  pilot.y += pilot.velocityY;
  pilot.y = constrain(pilot.y, 30, gameHeight - 35);

  if (frameCount >= nextGate) spawnGate();
  moveHazardsAndPickups();
  drawGateDetails();
  drawPickups();
  checkCollisions();
  drawPilot();
  drawAltitude();

  if (frameCount % 8 === 0) updateHud();
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
    const shimmer = 0.45 + 0.45 * sin(frameCount * 0.045 + star.phase);
    fill(190, 216, 255, shimmer * 210);
    circle((star.x - frameCount * star.depth * 0.45 + gameWidth * 3) % gameWidth, star.y, star.size);
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

function spawnGate() {
  const gapHeight = max(172, 208 - distance / 95);
  const gapCenter = random(140 + gapHeight / 2, gameHeight - 105 - gapHeight / 2);
  const gateX = gameWidth + 45;
  const gateWidth = 58;
  const topHeight = gapCenter - gapHeight / 2;
  const bottomY = gapCenter + gapHeight / 2;
  addGate(gateX, topHeight / 2, gateWidth, topHeight);
  addGate(gateX, bottomY + (gameHeight - bottomY) / 2, gateWidth, gameHeight - bottomY);
  obstacles[obstacles.length - 2].gateTop = true;
  obstacles[obstacles.length - 1].gateBottom = true;

  const pickupY = random(gapCenter - gapHeight * 0.3, gapCenter + gapHeight * 0.3);
  const pickup = new Sprite(gateX + random(90, 160), pickupY, 23);
  pickup.collider = "none";
  pickup.visible = false;
  pickup.color = "#68f4ed";
  pickup.stroke = "#e1fffd";
  pickup.strokeWeight = 2;
  pickups.push(pickup);
  nextGate = frameCount + floor(random(82, 108));
}

function addGate(x, y, width, height) {
  const gate = new Sprite(x, y, width, height);
  gate.collider = "none";
  gate.visible = false;
  gate.color = "#292451";
  gate.stroke = "#fb63bc";
  gate.strokeWeight = 2;
  obstacles.push(gate);
}

function moveHazardsAndPickups() {
  for (const gate of obstacles) gate.x -= scrollSpeed;
  for (const pickup of pickups) {
    pickup.x -= scrollSpeed;
    pickup.rotation += 3;
  }

  obstacles = obstacles.filter(gate => {
    if (gate.x < -100) {
      gate.remove();
      return false;
    }
    return true;
  });
  pickups = pickups.filter(pickup => {
    if (pickup.x < -60) {
      pickup.remove();
      return false;
    }
    return true;
  });
}

function drawGateDetails() {
  for (const gate of obstacles) {
    const left = gate.x - gate.w / 2;
    const right = gate.x + gate.w / 2;
    const top = gate.y - gate.h / 2;
    const bottom = gate.y + gate.h / 2;
    noStroke();
    fill(251, 99, 188, 180);
    if (gate.gateTop) rect(left - 2, bottom - 9, gate.w + 4, 9);
    if (gate.gateBottom) rect(left - 2, top, gate.w + 4, 9);
    stroke(255, 189, 237, 105);
    strokeWeight(1);
    line(left + 11, top + 6, left + 11, bottom - 6);
    line(right - 11, top + 6, right - 11, bottom - 6);
  }
}

function drawPickups() {
  for (const pickup of pickups) {
    noFill();
    stroke(104, 244, 237, 70);
    strokeWeight(5);
    circle(pickup.x, pickup.y, 34);
    noStroke();
    fill("#ecffff");
    circle(pickup.x, pickup.y, 6);
  }
}

function checkCollisions() {
  const px = pilot.x;
  const py = pilot.y;
  for (const gate of obstacles) {
    const closestX = constrain(px, gate.x - gate.w / 2, gate.x + gate.w / 2);
    const closestY = constrain(py, gate.y - gate.h / 2, gate.y + gate.h / 2);
    if (dist(px, py, closestX, closestY) < 23) {
      endFlight();
      return;
    }
  }

  pickups = pickups.filter(pickup => {
    if (dist(px, py, pickup.x, pickup.y) < 34) {
      pickup.remove();
      cellsCollected++;
      showToast("+1 ENERGY CELL");
      updateHud();
      return false;
    }
    return true;
  });

  if (pilot.y <= 32 || pilot.y >= gameHeight - 36) endFlight();
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
  statusMessage.innerHTML = `You scored ${floor(distance) + cellsCollected * 50} points and found ${cellsCollected} energy cell${cellsCollected === 1 ? "" : "s"}.<br>Ready to beat your record?`;
  statusButton.innerHTML = 'FLY AGAIN <span>↗</span>';
  statusPanel.classList.remove("hidden");
}

function updateHud() {
  scoreDisplay.textContent = String(floor(distance) + cellsCollected * 50).padStart(5, "0");
  cellDisplay.textContent = String(cellsCollected).padStart(2, "0");
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");
  window.clearTimeout(toastTimeout);
  toastTimeout = window.setTimeout(() => toast.classList.remove("show"), 850);
}