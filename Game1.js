const viewWidth = 960;
const viewHeight = 540;
const levelWidth = 5400;
const sectionWidth = levelWidth / 2;
const floorY = 500;
const playerMoveSpeed = 11;
const jumpSpeed = 40;
const enemyHeight = 30;
const shotCooldownFrames = 14;
const projectileSpeed = 15;
const spawnPoint = { x: 82, y: 448 };
const checkpointPoints = [1050, 1880, 3750, 4580];
const firstSectionEnemies = [
  { min: 285, max: 405, y: floorY - enemyHeight / 2, speed: 0.8 },
  { min: 875, max: 980, y: floorY - enemyHeight / 2, speed: 0.9 },
  { min: 1490, max: 1615, y: floorY - enemyHeight / 2, speed: 0.75 },
  { min: 2040, max: 2160, y: floorY - enemyHeight / 2, speed: 0.85 }
];
const enemySpots = [
  ...firstSectionEnemies,
  ...firstSectionEnemies.map(enemy => ({
    ...enemy,
    min: enemy.min + sectionWidth,
    max: enemy.max + sectionWidth
  }))
];
const firstSectionCoins = [
  [225, 435], [365, 435], [535, 350], [825, 320],
  [1050, 275], [1150, 275], [1435, 360], [1600, 292],
  [1770, 292], [2040, 350], [2250, 280], [2390, 280]
];
const coinSpots = [
  ...firstSectionCoins,
  ...firstSectionCoins.map(([x, y]) => [x + sectionWidth, y])
];

let player;
let terrain;
let coins;
let enemies = [];
let projectiles = [];
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
let touchShoot = false;
let jumpWasPressed = false;
let invulnerableUntilFrame = 0;
let facing = 1;
let nextShotFrame = 0;
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
  canvas.setAttribute("aria-label", "Mallow Meadow game. Use the left and right arrow keys to move, space to jump, and X to shoot.");
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
  ].forEach(([x, y, width, height]) => {
    for (const offset of [0, sectionWidth]) {
      createPlatform(x + offset + width / 2, y, width, height);
    }
  });

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

  enemies = enemySpots.map(createEnemy);
  projectiles = [];

  goal = new Sprite(levelWidth - 105, 410, 54, 180);
  goal.collider = "static";
  goal.color = "#f5f0dc";
  goal.stroke = "#7e6948";
  goal.strokeWeight = 3;

  flag = new Sprite(levelWidth - 126, 352, 62, 35);
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
  player.maxSpeed = 14;
  player.drag = 0.88;
  facing = 1;
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
    updateProjectiles();
    updateEnemies();
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
    facing = -1;
  } else if (movingRight && !movingLeft) {
    player.vel.x = playerMoveSpeed;
    facing = 1;
  } else {
    player.vel.x *= 0.8;
  }

  if ((kb.pressing("x") || touchShoot) && frameCount >= nextShotFrame) {
    shoot();
  }

  const onGround = player.colliding(terrain);
  if (jumpPressed && onGround) player.vel.y = -jumpSpeed;
  jumpWasPressed = wantsToJump;
}

function shoot() {
  const bullet = new Sprite(player.x + facing * 21, player.y - 3, 18, 12);
  bullet.collider = "none";
  bullet.color = "#fff1a5";
  bullet.stroke = "#e99a42";
  bullet.strokeWeight = 3;
  bullet.direction = facing;
  bullet.distance = 0;
  bullet.active = true;
  projectiles.push(bullet);
  levelSprites.push(bullet);
  nextShotFrame = frameCount + shotCooldownFrames;
}

function updateProjectiles() {
  for (const bullet of projectiles) {
    bullet.x += projectileSpeed * bullet.direction;
    bullet.distance += projectileSpeed;

    const target = enemies.find(enemy =>
      enemy.alive &&
      Math.abs(bullet.x - enemy.body.x) < 27 &&
      Math.abs(bullet.y - enemy.body.y) < 25
    );
    if (target) {
      defeatEnemy(target);
      bullet.remove();
      bullet.active = false;
    } else if (bullet.distance > 620 || bullet.x < 0 || bullet.x > levelWidth) {
      bullet.remove();
      bullet.active = false;
    }
  }
  projectiles = projectiles.filter(bullet => bullet.active);
}

function createEnemy({ min, max, y, speed }) {
  const body = new Sprite(min, y, 36, enemyHeight);
  body.collider = "none";
  body.color = "#986044";
  body.stroke = "#69412f";
  body.strokeWeight = 3;

  const eyes = [-1, 1].map(side => {
    const eye = new Sprite(min + side * 6, y - 3, 9, 11);
    eye.collider = "none";
    eye.color = "#fff8e7";
    eye.stroke = "#69412f";
    eye.strokeWeight = 1;
    const pupil = new Sprite(min + side * 6, y - 2, 3, 5);
    pupil.collider = "none";
    pupil.color = "#3c3935";
    pupil.stroke = "#3c3935";
    return { eye, pupil, side };
  });

  levelSprites.push(body, ...eyes.flatMap(({ eye, pupil }) => [eye, pupil]));
  return { body, eyes, min, max, speed, direction: 1, alive: true };
}

function updateEnemies() {
  for (const enemy of enemies) {
    if (!enemy.alive) continue;

    enemy.body.x += enemy.speed * enemy.direction;
    if (enemy.body.x >= enemy.max || enemy.body.x <= enemy.min) {
      enemy.direction *= -1;
      enemy.body.x = constrain(enemy.body.x, enemy.min, enemy.max);
    }

    for (const { eye, pupil, side } of enemy.eyes) {
      eye.x = enemy.body.x + side * 6;
      pupil.x = eye.x + enemy.direction * 1.5;
      eye.y = enemy.body.y - 3;
      pupil.y = enemy.body.y - 2;
    }

    player.overlaps(enemy.body, () => handleEnemyContact(enemy));
  }
}

function handleEnemyContact(enemy) {
  if (!enemy.alive || frameCount < invulnerableUntilFrame) return;

  if (player.vel.y > 0 && player.y < enemy.body.y - 12) {
    defeatEnemy(enemy);
    player.vel.y = -jumpSpeed * 0.65;
    showToast("NICE STOMP!");
    return;
  }

  invulnerableUntilFrame = frameCount + 75;
  respawnPlayer();
}

function defeatEnemy(enemy) {
  if (!enemy.alive) return;
  enemy.alive = false;
  enemy.body.remove();
  enemy.eyes.forEach(({ eye, pupil }) => {
    eye.remove();
    pupil.remove();
  });
  showToast("ENEMY ZAPPED!");
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
  invulnerableUntilFrame = 0;
  touchLeft = false;
  touchRight = false;
  touchJump = false;
  touchShoot = false;
  projectiles = [];
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
  if (direction === "shoot") touchShoot = pressed;
}
