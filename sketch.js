//sound
let samplePlayers;
let ambientPlayer;
let delay, reverb, filter;
let noteDelay, noteReverb, noteFilter;
let eraseSound;
let lastEraseTime = 0;
let isErasing = false;
let ambientGain, noteGain;
let eraseGain;



let snowLayer;
let textLayer;
let snowflakes = [];
let typedText = "";
let wiggles = [];
let letterTimestamps = [];
let lastDrawTime = 0;
let midiAccess;

// Sliders
let sliderSpeed, sliderAmount, sliderFlakeSize;

// Handpose
let video;
let handPose;
let hands = [];
let connections;

let margin = 40;
let lineHeight = 60; // bigger line height for bigger text

function preload() {
handPose = ml5.handPose();
  
 samplePlayers = new Tone.Players({
    "C4": "notes/C2.wav",
    "C#4": "notes/D2-.wav",
    "D4": "notes/D2.wav",
    "D#4": "notes/E2-.wav",
    "E4": "notes/E2.wav",
    "F4": "notes/F2.wav",
    "F#4": "notes/G2-.wav",
    "G4": "notes/G2.wav",
    "G#4": "notes/A2-.wav",
    "A4": "notes/A2.wav",
    "A#4": "notes/B2-.wav",
    "B4": "notes/B2.wav",

    "C5": "notes/C3.wav",
    "C#5": "notes/C3+.wav",
    "D5": "notes/D3.wav",
    "D#5": "notes/D3+.wav",
    "E5": "notes/E3.wav",
    "F5": "notes/F3.wav",
    "F#5": "notes/F3+.wav",
    "G5": "notes/G3.wav",
    "G#5": "notes/G3+.wav",
    "A5": "notes/A3.wav",
    "A#5": "notes/A3+.wav",
    "B5": "notes/B3.wav",

    "C6": "notes/C4.wav",
    "Pad1":"notes/C4.wav"

  });
  
    ambientPlayer = new Tone.Player("assets/ambience_snow_fall1.wav", () => {
    ambientReady = true;
    console.log("Ambient sound loaded!");
  });
  eraseSound = new Tone.Player("assets/erase.wav").toDestination();

}



function setup() {
  createCanvas(800, 800);
  
  
  synth = new Tone.Synth().toDestination();
  console.log("samplePlayers ready?", samplePlayers !== undefined);


  video = createCapture(VIDEO);
  video.size(800, 600);
  video.hide();

  //hand detection
  handPose.detectStart(video, gotHands);
  connections = handPose.getConnections(); // (optional)

  // Snow Layer
  snowLayer = createGraphics(width, 600);
  snowLayer.noStroke();
  generateSnow();

  // Text Layer
  textLayer = createGraphics(width, 600);
  textLayer.pixelDensity(1);

  textFont('Comic Sans MS');
  textSize(48);

  // Snowflakes
  for (let i = 0; i < 150; i++) {
    snowflakes.push(new Snowflake());
  }

  // MIDI
  if (navigator.requestMIDIAccess) {
    navigator.requestMIDIAccess().then(onMIDISuccess, onMIDIFailure);
  } else {
    console.log("WebMIDI not supported");
  }
 //sliders
  sliderSpeed = createSlider(100, 2000, 500);
  sliderSpeed.position(20, 610);
  sliderSpeed.style('width', '150px');

  sliderAmount = createSlider(1000, 15000, 8000);
  sliderAmount.position(260, 610);
  sliderAmount.style('width', '150px');

  sliderFlakeSize = createSlider(1, 5, 2);
  sliderFlakeSize.position(460, 610);
  sliderFlakeSize.style('width', '150px');
  
  //NOTE
sliderNoteDelay = createSlider(0.05, 0.8, 0.25, 0.01);
sliderNoteDelay.position(20, 700);
sliderNoteDelay.style('width', '150px');

sliderNoteReverb = createSlider(0, 1, 0.3, 0.01);
sliderNoteReverb.position(260, 700);
sliderNoteReverb.style('width', '150px');

sliderNoteFilter = createSlider(200, 3000, 800, 1);
sliderNoteFilter.position(460, 700);
sliderNoteFilter.style('width', '150px');

   // effects
  filter = new Tone.Filter(800, "lowpass").toDestination();
  reverb = new Tone.Reverb({ decay: 4, wet: 0.3 }).connect(filter);
  delay = new Tone.FeedbackDelay("8n", 0.25).connect(reverb);


  ambientPlayer.disconnect();         
  ambientPlayer.connect(delay);        

Tone.loaded().then(() => {
  console.log("Tone.js fully loaded");

  ambientPlayer.loop = true;
  ambientPlayer.start();
  console.log("Ambient sound started!");

  // Resume audio context immediately on load (may still need gesture in some browsers)
  Tone.start();
  Tone.getContext().resume();
});


  
// volume control
ambientGain = new Tone.Gain(1.0).toDestination();
noteGain = new Tone.Gain(1.0).toDestination();


ambientPlayer.disconnect();
ambientPlayer.connect(delay);
delay.connect(reverb);
reverb.connect(filter);
filter.connect(ambientGain);


noteFilter = new Tone.Filter(800, "lowpass");
noteReverb = new Tone.Reverb({ decay: 3, wet: 0.3 }).connect(noteFilter);
noteDelay = new Tone.FeedbackDelay("8n", 0.25).connect(noteReverb);

samplePlayers.disconnect();
samplePlayers.connect(noteDelay);
noteFilter.connect(noteGain);
  
  eraseGain = new Tone.Gain(0.2).toDestination();
eraseSound.disconnect();
eraseSound.connect(eraseGain);
  

}




function draw() {
  background(0);

  noStroke();
  fill(30);
  textSize(18);

  // Regrow snow
  let regrowSpeed = sliderSpeed.value();
  let snowAmount = sliderAmount.value();
  let flakeSize = sliderFlakeSize.value();

  if (millis() - lastDrawTime > regrowSpeed) {
    growSnow(snowAmount, flakeSize);
    lastDrawTime = millis();
  }

  // Draw snow and text
  image(snowLayer, 0, 0);
  image(textLayer, 0, 0);


  for (let flake of snowflakes) {
    flake.update();
    flake.display();
  }

//ml5
 if (hands.length > 0) {
  let hand = hands[0];
  let indexTip = hand.keypoints[8];

  let x = map(video.width - indexTip.x, 0, video.width, 0, width);
  let y = map(indexTip.y, 0, video.height, 0, height);

  snowLayer.erase();
  snowLayer.ellipse(x, y, 45, 45);
  snowLayer.noErase();

  meltTextAt(x, y);

  if (!isErasing) {
    Tone.start();
    eraseSound.loop = true;
    eraseSound.start();
    isErasing = true;
  }
} else {
  if (isErasing) {
    eraseSound.stop();
    isErasing = false;
  }
}


// lables
noStroke();
fill(255);
textSize(14);


text("Snow Speed (" + sliderSpeed.value() + " ms)", 20, 640);
text("Snow Amount (" + sliderAmount.value() + " px)", 260, 640);
text("Flake Size (" + sliderFlakeSize.value() + " px)", 460, 640);


text("↳ Visual: How fast snow regrows", 20, 660);
text("↳ Delay Time", 20, 680);

text("↳ Visual: Snow refill density", 260, 660);
text("↳ Reverb Wetness", 260, 680);

text("↳ Visual: Size of falling flakes", 460, 660);
text("↳ Filter Cutoff", 460, 680);
  

text("Note Delay (" + sliderNoteDelay.value().toFixed(2) + " sec)", 20, 730);
text("Note Reverb (" + (sliderNoteReverb.value() * 100).toFixed(0) + "%)", 260, 730);
text("Note Filter (" + sliderNoteFilter.value().toFixed(0) + " Hz)", 460, 730);


text("↳ Delay time applied to notes", 20, 750);
text("↳ Reverb wetness of notes", 260, 750);
text("↳ Filter cutoff for note samples", 460, 750);



}

///
function meltTextAt(x, y) {
  textLayer.loadPixels();

  let meltStrength = 4;
  let brushSize = 20;

  for (let dx = -brushSize; dx <= brushSize; dx++) {
    for (let dy = -brushSize; dy <= brushSize; dy++) {
      let xx = floor(x + dx);
      let yy = floor(y + dy);
      if (xx >= 0 && xx < width && yy >= 0 && yy < height) {
        let index = (xx + yy * width) * 4;
        if (textLayer.pixels[index + 3] > 50) {
          let belowIndex = (xx + (yy + meltStrength) * width) * 4;
          
          textLayer.pixels[belowIndex + 0] = textLayer.pixels[index + 0];
          textLayer.pixels[belowIndex + 1] = textLayer.pixels[index + 1];
          textLayer.pixels[belowIndex + 2] = textLayer.pixels[index + 2];
          textLayer.pixels[belowIndex + 3] = textLayer.pixels[index + 3];

          textLayer.pixels[index + 3] = 0; // erase original
        }
      }
    }
  }

  textLayer.updatePixels();

}



function onMIDIMessage(message) {
  const [command, note, velocity] = message.data;

  // --- KNOBS: Control Change (CC) ---
  if (command === 176) {
    let mappedValue;
    switch (note) {
      case 74: // Knob 1 → Delay Time & Snow Speed
        mappedValue = map(velocity, 0, 127, 100, 2000);
        delay.delayTime.value = map(velocity, 0, 127, 0.05, 0.8);
        sliderSpeed.value(mappedValue);
        break;

      case 71: // Knob 2 → Reverb Wet & Snow Amount
        mappedValue = map(velocity, 0, 127, 1000, 15000);
        reverb.wet.value = map(velocity, 0, 127, 0, 1);
        sliderAmount.value(mappedValue);
        break;

      case 76: // Knob 3 → Filter Cutoff & Flake Size
        mappedValue = map(velocity, 0, 127, 1, 5);
        filter.frequency.value = map(velocity, 0, 127, 200, 3000);
        sliderFlakeSize.value(mappedValue);
        break;
        case 93: // Knob 4: Note Delay
  let noteDelayTime = map(velocity, 0, 127, 0.05, 0.8);
  noteDelay.delayTime.value = noteDelayTime;
  sliderNoteDelay.value(noteDelayTime);
  break;

case 18: // Knob 5: Note Reverb
  let noteRevWet = map(velocity, 0, 127, 0, 1);
  noteReverb.wet.value = noteRevWet;
  sliderNoteReverb.value(noteRevWet);
  break;

case 19: // Knob 6: Note Filter
  let noteFiltFreq = map(velocity, 0, 127, 200, 3000);
  noteFilter.frequency.value = noteFiltFreq;
  sliderNoteFilter.value(noteFiltFreq);
  break;

  case 82: // Fader 1 → Ambient sound volume
  ambientGain.gain.value = map(velocity, 0, 127, 0, 1);
  break;

case 83: // Fader 2 → Note volume
  noteGain.gain.value = map(velocity, 0, 127, 0, 1);
  break;




      default:
        console.log("Unknown CC knob:", note);
        console.log("Note Delay:", noteDelay.delayTime.value.toFixed(2));
console.log("Note Reverb Wet:", noteReverb.wet.value.toFixed(2));
console.log("Note Filter:", noteFilter.frequency.value.toFixed(0));

    }
    return; // Don’t trigger sound on knob turns
  }

  // --- KEYS: Note On ---
if (command === 144 && velocity > 0) {
  let name;
  
  // 
  if (note === 36) name = "Pad1";
  else if (note === 37) name = "Pad2";
  else if (note === 38) name = "Pad3";
  else if (note === 39) name = "Pad4";
  else name = midiNoteToName(note);
  
    const char = midiNoteToChar(note);

    if (char) {
      typedText += char;
      letterTimestamps.push(millis());
      wiggles.push({ x: random(-1.2, 1.2), y: random(-1.2, 1.2) });
      drawNewLetter(char);
    }

    if (samplePlayers && samplePlayers.player(name)) {
      Tone.start();
      samplePlayers.player(name).start();
    } else {
      console.log("No sample for", name);
    }
  }
    console.log("MIDI Note:", note);
  
  if (typedText.endsWith("LOVE")) {
  triggerLoveEffect();
}
}




function drawNewLetter(char) {
  let x = margin;
  let y = margin;

  textLayer.textFont('Comic Sans MS');
  textLayer.textSize(48);
  textLayer.noStroke();
  textLayer.fill(255);

  for (let i = 0; i < typedText.length - 1; i++) {
    let nextChar = typedText.charAt(i);
    let cWidth = textLayer.textWidth(nextChar);

    // Check before placing the next character
    if (x + cWidth + 12 > width - margin) {
      x = margin;
      y += lineHeight;

      if (y + lineHeight > textLayer.height - margin) {
        x = margin;
        y = margin;
      }
    }

    x += cWidth + 8;
  }

  // Check if the new char fits, else move to next line
  let newCharWidth = textLayer.textWidth(char);
  if (x + newCharWidth > width - margin) {
    x = margin;
    y += lineHeight;
    if (y + lineHeight > textLayer.height - margin) {
      y = margin;
    }
  }

  textLayer.text(char, x, y + 45);
}




function onMIDISuccess(midi) {
  midiAccess = midi;
  const inputs = midi.inputs.values();
  for (let input of inputs) {
    input.onmidimessage = onMIDIMessage;
  }
  console.log("MIDI ready!");
}

function onMIDIFailure() {
  console.log("Could not access MIDI devices.");
}

function midiNoteToChar(note) {
  const map = {
    60: 'T', 61: 'V', 62: 'N', 63: 'X',
    64: 'S', 65: 'R', 66: 'A', 67: 'H',
    68: 'E', 69: 'D', 70: 'U', 71: 'L',
    72: 'C', 73: 'I', 74: 'M', 75: 'O',
    76: 'F', 77: 'W', 78: 'J', 79: 'G',
    80: 'K', 81: 'Y', 82: 'Z', 83: 'P',
    84: 'B', 36:'Q',
  };
  return map[note] || '';
 

}

function growSnow(snowAmount, flakeSize) {
  snowLayer.noStroke();
  
  for (let i = 0; i < snowAmount; i++) {
    let x = random(width);
    let y = random(height);
    let n = noise(x * 0.02, y * 0.02) * 20;
    let brightness = 255 - n;
    snowLayer.fill(brightness + random(0, 30), 50);
    snowLayer.rect(x, y, 1, 1);
  }

  for (let i = 0; i < snowAmount / 5; i++) {
    let x = random(width);
    let y = random(height);
    let size = random(flakeSize * 0.5, flakeSize);
    snowLayer.fill(255, 80);
    snowLayer.ellipse(x, y, size, size);
  }
}

function generateSnow() {
  for (let x = 0; x < width; x++) {
    for (let y = 0; y < height; y++) {
      let n = noise(x * 0.02, y * 0.02) * 40;
      let brightness = 255 - n;
      snowLayer.fill(brightness + random(0, 10));
      snowLayer.rect(x, y, 1, 1);
    }
  }

  for (let i = 0; i < 5000; i++) {
    let x = random(width);
    let y = random(height);
    let size = random(0.5, 2);
    snowLayer.fill(255, 230);
    snowLayer.ellipse(x, y, size, size);
  }
}

class Snowflake {
  constructor() {
    this.x = random(width);
    this.y = random(-100, -10);
    this.size = random(1, 4);
    this.speed = random(0.5, 2);
  }

  update() {
    this.y += this.speed;
    if (this.y > height) {
      this.y = random(-100, -10);
      this.x = random(width);
    }
  }

  display() {
    noStroke();
    fill(255, 200);
    ellipse(this.x, this.y, this.size);
  }
}

function gotHands(results) {
  hands = results;
}



function midiNoteToName(midiNote) {
  const noteNames = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
  const note = noteNames[midiNote % 12];
  const octave = Math.floor(midiNote / 12) - 1;
  return note + octave;
}

function triggerLoveEffect() {
  console.log("LOVE detected!");

  // Heart animation
  for (let i = 0; i < 20; i++) {
    let x = random(width);
    let y = random(height / 2);
    let size = random(20, 40);
    setTimeout(() => {
      drawHeart(x, y, size);
    }, i * 100);
  }

function drawHeart(x, y, size) {
  push();
  fill(255, 100, 150, 200);
  noStroke();
  translate(x, y);
  beginShape();
  vertex(0, -size / 2);
  bezierVertex(size / 2, -size, size, 0, 0, size);
  bezierVertex(-size, 0, -size / 2, -size, 0, -size / 2);
  endShape(CLOSE);
  pop();
}

}