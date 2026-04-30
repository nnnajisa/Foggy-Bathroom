// Snow accumulation reference
// Same pixel-array technique as sketch.js
// Run this alongside the bathroom to compare fog refill speed

let snowG;       // p5.Graphics buffer — accumulated snow layer
let snowMap;     // Float32Array: per-pixel snow level 0.0 → 1.0
let flakes = [];

const N_FLAKES = 350;

function setup() {
  pixelDensity(1);
  createCanvas(630, 450);

  snowG = createGraphics(width, height);
  snowG.pixelDensity(1);
  snowG.clear();
  snowG.loadPixels();

  snowMap = new Float32Array(width * height); // all 0 = no snow

  for (let i = 0; i < N_FLAKES; i++) {
    flakes.push(newFlake(random(height))); // stagger starting y
  }
}

function newFlake(startY = 0) {
  return {
    x:  random(width),
    y:  -startY,
    vy: random(1.2, 3.0),
    r:  random(1.5, 3.5)
  };
}

// Deposit snow at (fx, fy) in a soft circular blob — mirrors drawFogEraseDot logic
function settle(fx, fy, r) {
  let ri = ceil(r);
  for (let dy = -ri; dy <= ri; dy++) {
    for (let dx = -ri; dx <= ri; dx++) {
      let d = sqrt(dx * dx + dy * dy);
      if (d > r) continue;
      let nx = constrain(fx + dx, 0, width  - 1);
      let ny = constrain(fy + dy, 0, height - 1);
      // Linear add — same principle as fogMap refill
      let add = (1 - d / r) * 0.45;
      let idx = nx + ny * width;
      snowMap[idx] = min(1, snowMap[idx] + add);
      let a = floor(snowMap[idx] * 255);
      let p = idx * 4;
      snowG.pixels[p]   = 218;
      snowG.pixels[p+1] = 228;
      snowG.pixels[p+2] = 245;
      snowG.pixels[p+3] = a;
    }
  }
}

function draw() {
  let wind = sin(frameCount * 0.003) * 0.8;

  // Night sky
  background(10, 14, 32);

  // Draw accumulated snow
  snowG.updatePixels();
  image(snowG, 0, 0);

  // Update + draw falling flakes
  noStroke();
  for (let i = flakes.length - 1; i >= 0; i--) {
    let f = flakes[i];

    f.x = (f.x + wind + random(-0.2, 0.2) + width) % width;
    f.y += f.vy;

    let fx = constrain(floor(f.x), 0, width  - 1);
    let fy = constrain(floor(f.y), 0, height - 1);

    // Settle if landed on existing snow or floor
    if (f.y >= 0 && (snowMap[fx + fy * width] > 0.55 || fy >= height - 1)) {
      settle(fx, fy, f.r);
      flakes[i] = newFlake();
      continue;
    }

    if (f.y > height + 20) {
      flakes[i] = newFlake();
      continue;
    }

    // Draw in-flight flake
    if (f.y >= 0) {
      fill(255, 255, 255, map(f.vy, 1.2, 3.0, 160, 220));
      ellipse(f.x, f.y, f.r * 2, f.r * 2);
    }
  }
}
