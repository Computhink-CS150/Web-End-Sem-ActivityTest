const gameWidth = 1200;
const gameHeight = 655;
const groundY = 552;
const sling = { x: 190, y: 442, maxPull: 112 };
const gameArea = document.querySelector(".canvas-wrap");
const statusPanel = document.getElementById("statusPanel");
const statusTitle = document.getElementById("statusTitle");
const statusMessage = document.getElementById("statusMessage");
const statusButton = document.getElementById("statusButton");
const scoreElement = document.getElementById("score");
const birdTray = document.getElementById("birdTray");
const toast = document.getElementById("toast");

const levels = [
  {
    name: "SUNSET OUTPOST",
    pigs: [{ x: 880, y: 481 }, { x: 960, y: 481 }, { x: 920, y: 411 }],
    blocks: [
      { x: 840, y: 518, w: 20, h: 34, type: "wood" },
      { x: 980, y: 518, w: 20, h: 34, type: "wood" },
      { x: 830, y: 500, w: 180, h: 18, type: "stone" },
      { x: 870, y: 448, w: 20, h: 34, type: "glass" },
      { x: 950, y: 448, w: 20, h: 34, type: "glass" },
      { x: 865, y: 430, w: 110, h: 18, type: "wood" },
      { x: 890, y: 377, w: 20, h: 36, type: "wood" },
      { x: 930, y: 377, w: 20, h: 36, type: "wood" },
      { x: 880, y: 359, w: 80, h: 18, type: "stone" }
    ]
  },
  {
    name: "CANYON CAMP",
    pigs: [{ x: 820, y: 481 }, { x: 940, y: 481 }, { x: 1060, y: 481 }, { x: 940, y: 411 }],
    blocks: [
      { x: 770, y: 518, w: 20, h: 34, type: "wood" },
      { x: 1090, y: 518, w: 20, h: 34, type: "wood" },
      { x: 760, y: 500, w: 360, h: 18, type: "stone" },
      { x: 800, y: 448, w: 20, h: 34, type: "glass" },
      { x: 1060, y: 448, w: 20, h: 34, type: "glass" },
      { x: 795, y: 430, w: 290, h: 18, type: "wood" },
      { x: 890, y: 377, w: 20, h: 36, type: "wood" },
      { x: 970, y: 377, w: 20, h: 36, type: "wood" },
      { x: 880, y: 359, w: 120, h: 18, type: "stone" },
      { x: 920, y: 307, w: 20, h: 34, type: "glass" },
      { x: 960, y: 307, w: 20, h: 34, type: "glass" },
      { x: 910, y: 289, w: 80, h: 18, type: "wood" }
    ]
  }
];

let gameSurface;
let levelIndex = 0;
let score = 0;
let groundSprite;
let blockTargets = [];
let pigTargets = [];
let sceneSprites = [];
let birdsUsed = 0;
let activeBird = null;
let dragging = false;
let started = false;
let gameOver = false;
let won = false;
let shotFrames = 0;
let settledFrames = 0;
let toastTimer;

function setup() {
  gameSurface = new Canvas(gameWidth, gameHeight);
  gameSurface.id = "gameCanvas";
  gameSurface.setAttribute("aria-label", "Slingshot game canvas");
  gameArea.insertBefore(gameSurface, statusPanel);
  world.gravity.y = 0;
  createLevel();
  statusButton.addEventListener("click", handleStatusButton);
  document.getElementById("resetButton").addEventListener("click", resetGame);
  window.addEventListener("keydown", event => {
    if (event.key.toLowerCase() === "r") resetGame();
  });
  gameSurface.addEventListener("pointerdown", beginDrag);
  gameSurface.addEventListener("pointermove", dragBird);
  gameSurface.addEventListener("pointerup", releaseBird);
  gameSurface.addEventListener("pointercancel", releaseBird);
}

function createLevel() {
  sceneSprites.forEach(sprite => sprite.remove());
  sceneSprites = [];
  blockTargets = [];
  pigTargets = [];
  activeBird = null;
  birdsUsed = 0;
  dragging = false;
  started = false;
  gameOver = false;
  won = false;
  world.gravity.y = 0;

  groundSprite = new Sprite(gameWidth / 2, groundY + 13, gameWidth, 26);
  groundSprite.collider = "static";
  groundSprite.color = "#5b876a";
  groundSprite.stroke = "#365d4a";
  sceneSprites.push(groundSprite);

  const level = levels[levelIndex];
  for (const [index, block] of level.blocks.entries()) {
    const sprite = new Sprite(block.x + block.w / 2, block.y + block.h / 2, block.w, block.h);
    sprite.collider = "dynamic";
    sprite.color = block.type === "wood" ? "#b8794c" : block.type === "glass" ? "#83c7bc" : "#768b8b";
    sprite.stroke = "#355451";
    sprite.strokeWeight = 2;
    sprite.friction = 0.8;
    sprite.bounciness = 0.04;
    blockTargets.push({ sprite, hp: block.type === "stone" ? 2 : 1, type: block.type, alive: true, index });
    sceneSprites.push(sprite);
  }

  for (const [index, pig] of level.pigs.entries()) {
    const sprite = new Sprite(pig.x, pig.y, 38);
    sprite.collider = "dynamic";
    sprite.color = "#76b983";
    sprite.stroke = "#356d59";
    sprite.strokeWeight = 2;
    sprite.friction = 0.7;
    sprite.bounciness = 0.08;
    sprite.rotationLock = true;
    pigTargets.push({ sprite, alive: true, index });
    sceneSprites.push(sprite);
  }

  updateBirdTray();
  updateScore();
  document.getElementById("levelLabel").innerHTML =
    `LEVEL ${String(levelIndex + 1).padStart(2, "0")} <span>•</span> ${level.name}`;
}

function startSiege() {
  statusPanel.classList.add("hidden");
  started = true;
  world.gravity.y = 240;
  launchNextBird();
}

function launchNextBird() {
  if (birdsUsed >= 3) {
    finishGame(false);
    return;
  }
  birdsUsed++;
  activeBird = new Sprite(sling.x, sling.y, 42);
  activeBird.collider = "none";
  activeBird.color = "#e56d52";
  activeBird.stroke = "#763c37";
  activeBird.strokeWeight = 3;
  activeBird.rotationLock = true;
  activeBird.launched = false;
  activeBird.friction = 0.45;
  activeBird.bounciness = 0.3;
  sceneSprites.push(activeBird);
  shotFrames = 0;
  settledFrames = 0;
  updateBirdTray();
}

function handleStatusButton() {
  if (won && levelIndex < levels.length - 1) {
    levelIndex++;
  } else if (gameOver) {
    score = 0;
  }
  createLevel();
  startSiege();
}

function resetGame() {
  score = 0;
  createLevel();
  statusTitle.textContent = "Take aim.";
  statusMessage.textContent = "Drag the scout back, then release to launch.";
  statusButton.textContent = "Start siege";
  statusPanel.classList.remove("hidden");
}

function beginDrag(event) {
  if (!started || gameOver || !activeBird || activeBird.launched) return;
  const point = canvasPoint(event);
  if (Math.hypot(point.x - activeBird.x, point.y - activeBird.y) > 38) return;
  dragging = true;
  gameSurface.setPointerCapture(event.pointerId);
  event.preventDefault();
}

function dragBird(event) {
  if (!dragging || !activeBird) return;
  const point = canvasPoint(event);
  const dx = point.x - sling.x;
  const dy = point.y - sling.y;
  const distance = Math.hypot(dx, dy);
  const scale = distance > sling.maxPull ? sling.maxPull / distance : 1;
  activeBird.x = sling.x + dx * scale;
  activeBird.y = sling.y + dy * scale;
}

function releaseBird() {
  if (!dragging || !activeBird) return;
  dragging = false;
  const pullX = sling.x - activeBird.x;
  const pullY = sling.y - activeBird.y;
  if (Math.hypot(pullX, pullY) < 8) {
    activeBird.x = sling.x;
    activeBird.y = sling.y;
    return;
  }
  activeBird.collider = "dynamic";
  activeBird.isSuperFast = true;
  activeBird.vel.x = pullX * 0.62;
  activeBird.vel.y = pullY * 0.62;
  activeBird.launched = true;
  showToast("SCOUT AWAY");
  updateBirdTray();
}

function canvasPoint(event) {
  const rect = gameSurface.getBoundingClientRect();
  return {
    x: (event.clientX - rect.left) * gameWidth / rect.width,
    y: (event.clientY - rect.top) * gameHeight / rect.height
  };
}

function draw() {
  drawLandscape();
  drawSling();
  if (activeBird && activeBird.launched) checkBirdCollisions();
}

function drawLandscape() {
  const gradient = drawingContext.createLinearGradient(0, 0, 0, gameHeight);
  gradient.addColorStop(0, "#b8ddd4");
  gradient.addColorStop(0.66, "#dce0bf");
  gradient.addColorStop(1, "#e5bf84");
  drawingContext.fillStyle = gradient;
  drawingContext.fillRect(0, 0, gameWidth, gameHeight);

  noStroke();
  fill("rgba(255,246,199,.42)");
  circle(975, 125, 144);
  fill("#d89e6a");
  beginShape();
  vertex(0, 475);
  bezierVertex(100, 445, 205, 430, 335, 492);
  vertex(335, groundY);
  vertex(0, groundY);
  endShape(CLOSE);
  fill("#87ad82");
  rect(0, groundY, gameWidth, gameHeight - groundY);
  fill("#5b876a");
  rect(0, groundY, gameWidth, 7);
}

function drawSling() {
  stroke("#51382f");
  strokeWeight(12);
  line(sling.x - 17, 500, sling.x - 10, sling.y - 28);
  line(sling.x + 17, 500, sling.x + 10, sling.y - 28);
  if (activeBird && !activeBird.launched) {
    stroke("#614034");
    strokeWeight(5);
    line(sling.x - 10, sling.y - 26, activeBird.x, activeBird.y);
    line(activeBird.x, activeBird.y, sling.x + 10, sling.y - 26);
  }
}

function checkBirdCollisions() {
  const bird = activeBird;
  if (!bird || !bird.launched) return;
  for (const target of blockTargets) {
    if (target.alive) {
      bird.collides(target.sprite, () => damageBlock(target));
    }
  }
  for (const target of pigTargets) {
    if (target.alive) {
      bird.collides(target.sprite, () => defeatPig(target));
      if (target.alive && target.sprite.y > groundY + 45) defeatPig(target);
    }
  }

  shotFrames++;
  const speed = Math.hypot(bird.vel.x, bird.vel.y);
  if (bird.x < -80 || bird.x > gameWidth + 80 || bird.y > gameHeight + 80) {
    finishShot();
  } else if (shotFrames > 45 && speed < 1.2) {
    settledFrames++;
    if (settledFrames > 36) finishShot();
  } else {
    settledFrames = 0;
  }
}

function damageBlock(target) {
  if (!target.alive) return;
  target.hp--;
  if (target.hp > 0) return;
  target.alive = false;
  target.sprite.remove();
  score += target.type === "stone" ? 100 : 150;
  updateScore();
}

function defeatPig(target) {
  if (!target.alive) return;
  target.alive = false;
  target.sprite.remove();
  score += 500;
  updateScore();
  showToast("+500 TARGET DOWN");
  if (!pigTargets.some(pig => pig.alive)) finishGame(true);
}

function finishShot() {
  if (!activeBird) return;
  activeBird.remove();
  activeBird = null;
  if (!pigTargets.some(pig => pig.alive)) {
    finishGame(true);
  } else {
    launchNextBird();
  }
}

function finishGame(success) {
  if (gameOver) return;
  gameOver = true;
  won = success;
  dragging = false;
  if (success && activeBird) {
    activeBird.remove();
    activeBird = null;
  }
  statusTitle.textContent = success ? "Outpost cleared." : "The siege is over.";
  statusMessage.textContent = success ? `${score} points secured.` : "The defenders held this round. Try a different angle.";
  statusButton.textContent = success && levelIndex < levels.length - 1 ? "Next level" : "Play again";
  statusPanel.classList.remove("hidden");
}

function updateBirdTray() {
  birdTray.innerHTML = [0, 1, 2].map(index => {
    const used = index < birdsUsed;
    const current = index === birdsUsed && !gameOver;
    return `<span class="bird-dot ${used ? "used" : ""} ${current ? "current" : ""}">${index === 0 ? "✦" : "•"}</span>`;
  }).join("");
}

function updateScore() {
  scoreElement.textContent = String(score).padStart(6, "0");
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 1300);
}
