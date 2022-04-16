class Player {
  constructor(args) {
    let def = {
      position: new p5.Vector(int(width / 2), horizon - 2 * scaleSize),
      jumpVal: 20,
      vy: 3,
      ay: -1,
      speed: 4,
      imageSize: new p5.Vector(1, 2).mult(scaleSize),
      step: 0,
      count: 4,
      stepCount: 0,
    };
    Object.assign(def, args);
    Object.assign(this, def);
    this.setup();
  }
  setup() {
    const imgPosition = new p5.Vector(++this.step % this.count, 1).mult(scaleSize);
    this.image = art1.get(imgPosition.x, imgPosition.y, this.imageSize.x, this.imageSize.y);
  }
  draw() {
    if (start && ++this.stepCount % 10 === 0) this.setup();
    image(this.image, this.position.x, this.position.y);
  }
  move() {
    this.vy = min(this.jumpVal, this.vy - this.ay);
    this.position.add(0, this.vy);
    const isOnFloor = floorList.some((floor) => {
      return (
        floor.position.x < this.position.x + this.imageSize.x &&
        this.position.x < floor.endPosition() &&
        this.position.y + this.imageSize.y - ceil(this.vy) <= horizon &&
        this.position.y < height
      );
    });
    if (isOnFloor && this.position.y + this.imageSize.y + this.vy >= horizon) {
      // 維持地平線
      this.position.y = horizon - this.imageSize.y;
    } else if (this.position.y + this.imageSize.y >= height) {
      // 掉到地圖外
      setup();
    }
  }
  jump(vol) {
    // vol 0 ~ 100
    if (this.position.y + this.imageSize.y === horizon) {
      this.vy = -this.jumpVal * vol;
    }
  }
}

class Bar {
  constructor(args) {
    let def = {
      position: new p5.Vector(0, 0),
      h: 40,
      text: '',
      barValColor: 'red',
      barColor: 'gray',
      val: 0, // 0 ~ 100
    };
    Object.assign(def, args);
    Object.assign(this, def);
  }
  draw() {
    // text
    fill(0);
    textSize(32);
    textAlign(CENTER, CENTER);
    text(this.text, this.position.x, this.position.y);
    let textwidth = textWidth(this.text);

    const widthSize = width - textwidth - this.position.x * 2;
    // bar background
    stroke(0);
    fill(this.barColor);
    rect(this.position.x + textwidth, this.position.y - this.h / 2, widthSize, this.h);

    // bar val
    noStroke();
    fill(this.barValColor);
    rect(this.position.x + textwidth, this.position.y - this.h / 2, (widthSize * this.val) / 20, this.h);
  }
}

class Floor {
  constructor(x, width) {
    this.position = new p5.Vector(x, horizon);
    this.vx = -10;
    this.width = width;
    this.imageSize = new p5.Vector(1, 1).mult(scaleSize);
    this.imgPosition = new p5.Vector(0, 0).mult(scaleSize);
    this.setup();
  }
  setup() {
    this.image = art1.get(this.imgPosition.x, this.imgPosition.y, this.imageSize.x, this.imageSize.y);
  }
  draw() {
    for (let y = 0; y < 3; ++y) {
      for (let x = 0; x < this.width; ++x) {
        image(this.image, this.position.x + x * scaleSize, this.position.y + y * scaleSize);
      }
    }
  }
  update() {
    this.position.add(this.vx);
  }
  endPosition() {
    return this.position.x + this.width * scaleSize;
  }
  isOverFlow() {
    return this.endPosition() < 0;
  }
}

let start;
let volumeBar;
let frequencyBar;
let mic;
let fft; // 頻率
let distance;
let horizon;
let player;
let updateSetInterval;
const floorList = [];
const barList = [];
let art1;
let scaleSize = 32;

function preload() {
  art1 = loadImage('src/assets/art1.png');
}

function setup() {
  start = false;
  angleMode(DEGREES);
  distance = 0;
  createCanvas(int(windowWidth * 0.9), int(windowHeight * 0.9));
  horizon = height - scaleSize * 3;
  player = new Player();
  mic = new p5.AudioIn();
  mic.start();
  fft = new p5.FFT();
  fft.setInput(mic);
  floorList.splice(0, floorList.length);
  floorList.push(new Floor(0, int(windowWidth / scaleSize)));
  volumeBar = new Bar({
    position: new p5.Vector(40, 30),
    text: '音量',
  });
  frequencyBar = new Bar({
    position: new p5.Vector(40, 80),
    text: '頻率',
  });
  barList.push(volumeBar, frequencyBar);
  clearInterval(updateSetInterval);
  updateSetInterval = setInterval(update, 1000 / 60);
}

function update() {
  if (!start) {
    return;
  }
  // 檢測音量
  let vol = map(mic.getLevel(), 0, 0.1, 0, 20);
  volumeBar.val = vol;
  if (vol > 0.5) player.jump(vol);

  // 檢測音調
  const frequencyVal = fft.getCentroid();
  frequencyBar.val = map(frequencyVal, 0, 5000, 0, 20);
  const spectralCentroid = map(frequencyVal, 0, 5000, 1, 1.1);
  translate((width - width * spectralCentroid) / 2, height - height * spectralCentroid);
  scale(spectralCentroid);

  player.move();
  if (floorList[0].isOverFlow()) {
    floorList.shift();
  }
  if (floorList.length < 10) {
    const endPosititon = floorList[floorList.length - 1].endPosition();
    const gap = random(2, 5); // 地面間格 2 ~ n-1
    const floorWidth = int(random(3, 21)); // 地面寬度 3 ~ n-1
    floorList.push(new Floor(endPosititon + gap * scaleSize, floorWidth));
  }
  floorList.forEach((floor) => floor.update());
  ++distance;
}

function draw() {
  background('#5C94FC');

  // 音譜圖
  textAlign(LEFT);
  text(round(fft.getCentroid()) + 'hz', 10, 160);
  const spectrum = fft.analyze();
  for (let i = 0; i < spectrum.length; i++) {
    let x = map(log(i), 0, log(spectrum.length), 0, width);
    let h = map(spectrum[i], 0, 255, 0, height);
    let rectangle_width = (log(i + 1) - log(i)) * (width / log(spectrum.length));
    rect(x, horizon - 10, rectangle_width, -h);
  }

  // 繪製地板
  floorList.forEach((floor) => floor.draw());
  barList.forEach((bar) => bar.draw());
  // 繪製玩家
  player.draw();

  if (!start) {
    background('#80808090');
    text('Click to Paly', width / 2, height / 2);
    return;
  }
}

function mousePressed() {
  start = true;
  userStartAudio();
}
