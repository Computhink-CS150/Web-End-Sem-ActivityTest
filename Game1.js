const viewWidth = 960;
const viewHeight = 540;
const levelWidth = 2700;
const floorY = 500;
const playerMoveSpeed = 18;
const spawnPoint = { x: 82, y: 448 };
const checkpointPoints = [1050, 1880];
const coinSpots = [
  [225, 435], [365, 435], [535, 350], [825, 320],
  [1050, 275], [1150, 275], [1435, 360], [1600, 292],
  [1770, 292], [2040, 350], [2250, 280], [2390, 280]
];

let player;
let terrain;
let coins;
let goal;
let flag;
let checkpointFlags = [];
let levelSprites = [];
let score = 0;
let checkpointIndex = -1;
let gameWon = false;
let cameraX = viewWidth / 2;
let touchLeft = false;
let touchRight = false;
let touchJump = false;
let jumpWasPressed = false;
let toastTimer;

const coinCount = document.getElementById("coinCount");
const finishPanel = document.getElementById("finishPanel");
const finishTitle = document.getElementById("finishTitle");
const finishMessage = document.getElementById("finishMessage");
const finishKicker = document.getElementById("finishKicker");
const checkpointStatus = document.getElementById("checkpointStatus");
const toast = document.getElementById("toast");
const gameStage = document.getElementById("gameStage");

function setup() {
  const canvas = new Canvas(viewWidth, viewHeight);
  canvas.id = "gameCanvas";
  canvas.setAttribute("aria-label", "Mallow Meadow game. Use the left and right arrow keys to move and space to jump.");
  canvas.setAttribute("tabindex", "0");
  gameStage.insertBefore(canvas, gameStage.firstChild);

  world.gravity.y = 240;
  buildLevel();
  resetPlayer();
  camera.x = viewWidth / 2;
  camera.y = viewHeight / 2;
  camera.x = cameraX;

  document.getElementById("resetButton").addEventListener("click", restartGame);
  document.getElementById("playAgain").addEventListener("click", restartGame);
  window.addEventListener("keydown", handleKeyDown);
  document.querySelectorAll(".touch-button").forEach(button => {
    const direction = button.dataset.move;
    button.addEventListener("pointerdown", event => {
      event.preventDefault();
      button.setPointerCapture(event.pointerId);
      setTouchDirection(direction, true);
    });
    button.addEventListener("pointerup", () => setTouchDirection(direction, false));
    button.addEventListener("pointercancel", () => setTouchDirection(direction, false));
    button.addEventListener("lostpointercapture", () => setTouchDirection(direction, false));
  });
}

function buildLevel() {
  levelSprites.forEach(sprite => sprite.remove());
  levelSprites = [];
  terrain = new Group();
  terrain.collider = "static";
  terrain.color = "#985b3c";
  terrain.stroke = "#784632";
  terrain.strokeWeight = 2;

  [
    [0, floorY, 650, 80],
    [750, floorY, 490, 80],
    [1340, floorY, 470, 80],
    [1910, floorY, 790, 80],
    [465, 405, 165, 22],
    [790, 375, 160, 22],
    [1035, 310, 165, 22],
    [1420, 415, 170, 22],
    [1595, 345, 185, 22],
    [2015, 405, 175, 22],
    [2225, 335, 210, 22]
  ].forEach(([x, y, width, height]) => createPlatform(x + width / 2, y, width, height));

  coins = new Group();
  for (const [x, y] of coinSpots) {
    const coin = new Sprite(x, y, 20, 24);
    coin.collider = "none";
    coin.color = "#ffd45e";
    coin.stroke = "#e99a42";
    coin.strokeWeight = 3;
    coins.add(coin);
    levelSprites.push(coin);
  }

  goal = new Sprite(2595, 410, 54, 180);
  goal.collider = "static";
  goal.color = "#f5f0dc";
  goal.stroke = "#7e6948";
  goal.strokeWeight = 3;

  flag = new Sprite(2574, 352, 62, 35);
  flag.collider = "none";
  flag.color = "#ff6f78";
  flag.stroke = "#d44c64";
  flag.strokeWeight = 2;

  levelSprites.push(goal, flag);
  checkpointFlags = checkpointPoints.map(x => {
    const pole = new Sprite(x, floorY - 48, 8, 96);
    pole.collider = "none";
    pole.color = "#fff5df";
    pole.stroke = "#e0a963";
    pole.strokeWeight = 2;
    const pennant = new Sprite(x + 16, floorY - 79, 38, 24);
    pennant.collider = "none";
    pennant.color = "#63c99b";
    pennant.stroke = "#429a7c";
    pennant.strokeWeight = 2;
    levelSprites.push(pole, pennant);
    return { x, pole, pennant };
  });
}

function createPlatform(x, y, width, height) {
  const platform = new Sprite(x, y + height / 2, width, height);
  platform.collider = "static";
  platform.color = "#985b3c";
  platform.stroke = "#784632";
  platform.strokeWeight = 2;

  const grass = new Sprite(x, y + 2, width, 8);
  grass.collider = "static";
  grass.color = "#74c86d";
  grass.stroke = "#4b9d59";
  grass.strokeWeight = 1;
  terrain.add(platform);
  terrain.add(grass);
  levelSprites.push(platform, grass);
}

function resetPlayer() {
  if (player) player.remove();
  player = new Sprite(spawnPoint.x, spawnPoint.y, 31, 44);
  player.collider = "dynamic";
  player.color = "#f57870";
  player.stroke = "#a84857";
  player.strokeWeight = 3;
  player.rotationLock = true;
  player.bounciness = 0;
  player.maxSpeed = 22;
  player.drag = 0.88;
}

function draw() {
  background("#a8e5f1");
  cameraX = constrain(player.x, viewWidth / 2, levelWidth - viewWidth / 2);
  drawMeadowBackdrop();
  camera.x = cameraX;
  camera.y = viewHeight / 2;

  if (!gameWon) {
    updatePlayer();
    player.collides(terrain);
    player.overlaps(coins, collectCoin);
    updateCheckpoints();
    if (player.overlaps(goal)) finishGame();
    if (player.y > viewHeight + 120) respawnPlayer();
    for (const coin of coins) coin.rotation = sin(frameCount * 4 + coin.x) * 12;
  }
}

function updatePlayer() {
  const movingLeft = kb.pressing("left") || kb.pressing("a") || touchLeft;
  const movingRight = kb.pressing("right") || kb.pressing("d") || touchRight;
  const wantsToJump = kb.pressing("space") || kb.pressing("up") || touchJump;
  const jumpPressed = wantsToJump && !jumpWasPressed;

  if (movingLeft && !movingRight) {
    player.vel.x = -playerMoveSpeed;
  } else if (movingRight && !movingLeft) {
    player.vel.x = playerMoveSpeed;
  } else {
    player.vel.x *= 0.8;
  }

  const onGround = player.colliding(terrain);
  if (jumpPressed && onGround) player.vel.y = -52;
  jumpWasPressed = wantsToJump;
}

function updateCheckpoints() {
  if (checkpointIndex + 1 < checkpointPoints.length &&
      player.x > checkpointPoints[checkpointIndex + 1]) {
    checkpointIndex++;
    checkpointStatus.textContent = `Checkpoint ${checkpointIndex + 1} reached`;
    showToast("CHECKPOINT SAVED!");
  }
}

function respawnPlayer() {
  const x = checkpointIndex >= 0 ? checkpointPoints[checkpointIndex] + 36 : spawnPoint.x;
  player.position.x = x;
  player.position.y = spawnPoint.y;
  player.vel.x = 0;
  player.vel.y = 0;
  showToast("BACK ON THE TRAIL");
}

function collectCoin(playerSprite, coin) {
  coin.remove();
  score++;
  coinCount.textContent = `${String(score).padStart(2, "0")} / ${coinSpots.length}`;
  showToast("SUN COIN +1");
}

function finishGame() {
  if (gameWon) return;
  gameWon = true;
  player.vel.x = 0;
  player.vel.y = 0;
  finishKicker.textContent = score === coinSpots.length ? "MEADOW MASTER" : "TRAIL COMPLETE";
  finishTitle.textContent = score === coinSpots.length ? "You found them all!" : "You made it!";
  finishMessage.textContent = `You collected ${score} of ${coinSpots.length} sun coins.`;
  finishPanel.classList.remove("hidden");
}

function restartGame() {
  score = 0;
  checkpointIndex = -1;
  gameWon = false;
  jumpWasPressed = false;
  touchLeft = false;
  touchRight = false;
  touchJump = false;
  finishPanel.classList.add("hidden");
  checkpointStatus.textContent = "Checkpoints save your spot";
  coinCount.textContent = `00 / ${coinSpots.length}`;
  buildLevel();
  resetPlayer();
  cameraX = viewWidth / 2;
}

function drawMeadowBackdrop() {
  const sky = drawingContext.createLinearGradient(0, 0, 0, viewHeight);
  sky.addColorStop(0, "#91dcf2");
  sky.addColorStop(0.68, "#d8f4dc");
  sky.addColorStop(1, "#f7e7ad");
  drawingContext.fillStyle = sky;
  drawingContext.fillRect(0, 0, viewWidth, viewHeight);

  push();
  translate(viewWidth / 2 - cameraX * 0.24, 0);
  noStroke();
  fill("#fff1a5");
  circle(420, 105, 88);

  fill("#b5e6b4");
  drawCloud(115, 115, 94, 35);
  drawCloud(610, 155, 106, 39);
  drawCloud(1110, 96, 92, 34);
  drawCloud(1640, 142, 112, 40);
  drawCloud(2220, 105, 100, 36);

  fill("#a5dca0");
  beginShape();
  vertex(-500, 470);
  vertex(-280, 320);
  vertex(-45, 470);
  vertex(185, 335);
  vertex(405, 470);
  vertex(665, 315);
  vertex(900, 470);
  vertex(1175, 330);
  vertex(1400, 470);
  vertex(1640, 310);
  vertex(1875, 470);
  vertex(2110, 340);
  vertex(2350, 470);
  vertex(2600, 320);
  vertex(2840, 470);
  vertex(2840, 560);
  vertex(-500, 560);
  endShape(CLOSE);

  fill("#8bd187");
  beginShape();
  vertex(-500, 492);
  vertex(-285, 395);
  vertex(-30, 492);
  vertex(235, 382);
  vertex(485, 492);
  vertex(760, 397);
  vertex(990, 492);
  vertex(1260, 380);
  vertex(1500, 492);
  vertex(1750, 400);
  vertex(2010, 492);
  vertex(2290, 385);
  vertex(2550, 492);
  vertex(2840, 400);
  vertex(2840, 560);
  vertex(-500, 560);
  endShape(CLOSE);
  pop();
}

function drawCloud(x, y, width, height) {
  ellipse(x, y, width, height);
  ellipse(x + width * 0.28, y - height * 0.3, width * 0.62, height * 0.86);
  ellipse(x - width * 0.3, y - height * 0.15, width * 0.58, height * 0.75);
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 1250);
}

function handleKeyDown(event) {
  if (event.target instanceof HTMLButtonElement) return;
  if (["ArrowLeft", "ArrowRight", "ArrowUp", "Space"].includes(event.code)) event.preventDefault();
  if (event.key.toLowerCase() === "r") restartGame();
}

function setTouchDirection(direction, pressed) {
  if (direction === "left") touchLeft = pressed;
  if (direction === "right") touchRight = pressed;
  if (direction === "jump") touchJump = pressed;
}
