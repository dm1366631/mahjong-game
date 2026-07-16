const fs = require('fs');
const zlib = require('zlib');
const path = require('path');

const WIDTH = 144;
const HEIGHT = 108;
const PADDING = 8;

const COLORS = {
  m: [210, 49, 49],    
  s: [31, 157, 63],    
  p: [37, 99, 214],    
  z: [51, 51, 51]      
};

const SUIT_NAMES = { m: '万', s: '条', p: '筒', z: '' };
const HONOR_NAMES = ['', '东', '南', '西', '北', '中', '发', '白'];

function crc32(data) {
  let crc = 0xFFFFFFFF;
  const table = [];
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) {
      c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[i] = c;
  }
  for (let i = 0; i < data.length; i++) {
    crc = table[(crc ^ data[i]) & 0xFF] ^ (crc >>> 8);
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

function createChunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const typeBuffer = Buffer.from(type);
  const crcData = Buffer.concat([typeBuffer, data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(crcData), 0);
  return Buffer.concat([length, typeBuffer, data, crc]);
}

function createPNG(width, height, pixels) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const raw = [];
  for (let y = 0; y < height; y++) {
    raw.push(0);
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      raw.push(pixels[idx]);
      raw.push(pixels[idx + 1]);
      raw.push(pixels[idx + 2]);
      raw.push(pixels[idx + 3]);
    }
  }

  const compressed = zlib.deflateSync(Buffer.from(raw));
  const ihdrChunk = createChunk('IHDR', ihdr);
  const idatChunk = createChunk('IDAT', compressed);
  const iendChunk = createChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]),
    ihdrChunk,
    idatChunk,
    iendChunk
  ]);
}

function drawCircle(pixels, cx, cy, r, color) {
  for (let y = cy - r; y <= cy + r; y++) {
    for (let x = cx - r; x <= cx + r; x++) {
      const dx = x - cx;
      const dy = y - cy;
      if (dx * dx + dy * dy <= r * r) {
        const idx = (y * WIDTH + x) * 4;
        if (idx >= 0 && idx < pixels.length) {
          pixels[idx] = color[0];
          pixels[idx + 1] = color[1];
          pixels[idx + 2] = color[2];
          pixels[idx + 3] = 255;
        }
      }
    }
  }
}

function drawRectangle(pixels, x1, y1, x2, y2, color) {
  for (let y = y1; y < y2; y++) {
    for (let x = x1; x < x2; x++) {
      const idx = (y * WIDTH + x) * 4;
      if (idx >= 0 && idx < pixels.length) {
        pixels[idx] = color[0];
        pixels[idx + 1] = color[1];
        pixels[idx + 2] = color[2];
        pixels[idx + 3] = 255;
      }
    }
  }
}

function drawLine(pixels, x1, y1, x2, y2, color) {
  const dx = Math.abs(x2 - x1);
  const dy = Math.abs(y2 - y1);
  const sx = x1 < x2 ? 1 : -1;
  const sy = y1 < y2 ? 1 : -1;
  let err = dx - dy;
  let x = x1, y = y1;
  while (true) {
    const idx = (y * WIDTH + x) * 4;
    if (idx >= 0 && idx < pixels.length) {
      pixels[idx] = color[0];
      pixels[idx + 1] = color[1];
      pixels[idx + 2] = color[2];
      pixels[idx + 3] = 255;
    }
    if (x === x2 && y === y2) break;
    const e2 = 2 * err;
    if (e2 > -dy) { err -= dy; x += sx; }
    if (e2 < dx) { err += dx; y += sy; }
  }
}

function drawBar(pixels, x, y, width, height, color) {
  drawRectangle(pixels, x, y, x + width, y + height, color);
}

function drawCharacter(pixels, x, y, char, color, size) {
  const font = {
    '1': [[0,0,1,0,0],[0,1,1,0,0],[0,0,1,0,0],[0,0,1,0,0],[0,0,1,0,0],[0,0,1,0,0],[0,1,1,1,0]],
    '2': [[0,1,1,1,0],[1,0,0,0,1],[0,0,0,0,1],[0,0,0,1,0],[0,0,1,0,0],[0,1,0,0,0],[1,1,1,1,1]],
    '3': [[1,1,1,1,1],[0,0,0,0,1],[0,0,1,1,0],[0,0,0,0,1],[0,0,0,0,1],[0,0,0,0,1],[0,1,1,1,0]],
    '4': [[0,0,0,1,0],[0,0,1,1,0],[0,1,0,1,0],[1,0,0,1,0],[1,1,1,1,1],[0,0,0,1,0],[0,0,0,1,0]],
    '5': [[1,1,1,1,1],[1,0,0,0,0],[1,1,1,1,0],[0,0,0,0,1],[0,0,0,0,1],[0,0,0,0,1],[1,1,1,1,0]],
    '6': [[0,0,1,1,0],[0,1,0,0,0],[1,0,0,0,0],[1,1,1,1,0],[1,0,0,0,1],[1,0,0,0,1],[0,1,1,1,0]],
    '7': [[1,1,1,1,1],[0,0,0,0,1],[0,0,0,1,0],[0,0,1,0,0],[0,0,1,0,0],[0,1,0,0,0],[0,1,0,0,0]],
    '8': [[0,1,1,1,0],[1,0,0,0,1],[0,1,1,1,0],[1,0,0,0,1],[0,0,0,0,1],[1,0,0,0,1],[0,1,1,1,0]],
    '9': [[0,1,1,1,0],[1,0,0,0,1],[1,0,0,0,1],[0,1,1,1,1],[0,0,0,0,1],[0,0,0,1,0],[0,1,1,0,0]],
    '东': [[0,1,0,0,1],[1,0,1,0,0],[1,1,1,1,1],[1,0,1,0,0],[1,0,0,0,1],[0,1,0,1,0],[0,0,1,0,0]],
    '南': [[1,0,0,0,0],[1,1,0,0,0],[1,0,1,0,0],[1,0,0,1,0],[1,1,1,1,1],[1,0,0,0,1],[1,0,0,0,1]],
    '西': [[0,0,0,1,0],[0,0,1,0,0],[0,1,0,0,0],[1,1,1,1,1],[0,1,0,0,0],[0,0,1,0,0],[0,0,0,1,0]],
    '北': [[0,0,0,1,1],[0,0,0,1,0],[0,0,1,0,0],[0,1,0,0,0],[1,1,1,1,1],[0,1,0,0,0],[0,0,0,0,0]],
    '中': [[0,0,1,0,0],[0,0,1,0,0],[0,0,1,0,0],[1,1,1,1,1],[0,0,1,0,0],[0,0,1,0,0],[0,0,1,0,0]],
    '发': [[0,1,1,1,0],[1,0,0,0,1],[0,0,1,0,0],[0,1,0,1,0],[1,0,0,0,1],[0,1,1,1,0],[0,0,0,0,0]],
    '白': [[0,1,1,1,0],[1,0,0,0,1],[1,0,0,0,1],[1,0,0,0,1],[1,0,0,0,1],[0,1,1,1,0],[0,0,0,0,0]],
    '万': [[0,0,1,1,0],[0,1,0,0,1],[1,0,0,0,0],[1,1,1,1,1],[1,0,0,0,1],[1,0,0,0,1],[0,1,1,1,0]],
    '条': [[0,0,0,1,0],[0,0,0,1,0],[1,1,1,1,1],[0,0,0,1,0],[0,0,0,1,0],[0,0,0,1,0],[1,1,1,1,1]],
    '筒': [[0,1,1,1,0],[1,0,0,0,1],[1,0,1,0,1],[1,0,0,0,1],[0,1,1,1,0],[0,0,0,0,0],[0,0,0,0,0]]
  };
  const bitmap = font[char];
  if (!bitmap) return;
  const pixelSize = Math.floor(size / 5);
  for (let row = 0; row < bitmap.length; row++) {
    for (let col = 0; col < bitmap[row].length; col++) {
      if (bitmap[row][col]) {
        drawRectangle(pixels,
          x + col * pixelSize,
          y + row * pixelSize,
          x + (col + 1) * pixelSize,
          y + (row + 1) * pixelSize,
          color
        );
      }
    }
  }
}

function generateTile(code) {
  const n = parseInt(code[0], 10);
  const s = code[1];
  const color = COLORS[s] || COLORS.z;
  const suitName = SUIT_NAMES[s];
  const honorName = HONOR_NAMES[n];
  
  const pixels = new Uint8Array(WIDTH * HEIGHT * 4).fill(255);
  
  drawRectangle(pixels, 0, 0, WIDTH, HEIGHT, [255, 255, 255]);
  
  const round = 8;
  for (let i = 0; i < round; i++) {
    for (let j = 0; j < round; j++) {
      if (i * i + j * j <= round * round) {
        const idx = (j * WIDTH + i) * 4;
        pixels[idx + 3] = 0;
        const idx2 = (j * WIDTH + (WIDTH - 1 - i)) * 4;
        pixels[idx2 + 3] = 0;
        const idx3 = ((HEIGHT - 1 - j) * WIDTH + i) * 4;
        pixels[idx3 + 3] = 0;
        const idx4 = ((HEIGHT - 1 - j) * WIDTH + (WIDTH - 1 - i)) * 4;
        pixels[idx4 + 3] = 0;
      }
    }
  }
  
  drawRectangle(pixels, 2, 2, WIDTH - 2, HEIGHT - 2, [240, 240, 245]);
  
  if (s === 'z') {
    drawCharacter(pixels, WIDTH / 2 - 15, HEIGHT / 2 - 18, honorName, color, 36);
    return createPNG(WIDTH, HEIGHT, pixels);
  }
  
  drawCharacter(pixels, PADDING + 2, PADDING + 2, n.toString(), color, 24);
  
  if (suitName) {
    drawCharacter(pixels, WIDTH - PADDING - 28, HEIGHT - PADDING - 24, suitName, color, 20);
  }
  
  const centerX = WIDTH / 2;
  const centerY = HEIGHT / 2;
  
  if (s === 'p') {
    const r = 12;
    drawCircle(pixels, centerX, centerY, r, color);
    drawCircle(pixels, centerX, centerY, 4, [255, 255, 255]);
    
    if (n > 1) {
      const angleStep = (Math.PI * 2) / n;
      for (let i = 0; i < n; i++) {
        const px = centerX + Math.cos(angleStep * i - Math.PI / 2) * 35;
        const py = centerY + Math.sin(angleStep * i - Math.PI / 2) * 25;
        drawCircle(pixels, px, py, 6, color);
      }
    }
  } else if (s === 's') {
    const barWidth = 6;
    const barHeight = 35;
    const spacing = 18;
    const startX = centerX - ((n - 1) * spacing) / 2;
    
    for (let i = 0; i < n; i++) {
      const bx = startX + i * spacing;
      const by = centerY - barHeight / 2;
      drawBar(pixels, bx - barWidth / 2, by, barWidth, barHeight, color);
      
      const dotY = by + barHeight / 2 - 3;
      drawCircle(pixels, bx, dotY, 3, color);
    }
  } else if (s === 'm') {
    const tileSize = 18;
    const cols = Math.min(n, 5);
    const rows = Math.ceil(n / 5);
    const startX = centerX - ((cols - 1) * (tileSize + 8)) / 2;
    const startY = centerY - ((rows - 1) * (tileSize + 8)) / 2;
    
    let count = 0;
    for (let row = 0; row < rows && count < n; row++) {
      for (let col = 0; col < cols && count < n; col++) {
        const tx = startX + col * (tileSize + 8);
        const ty = startY + row * (tileSize + 8);
        drawRectangle(pixels, tx - tileSize / 2, ty - tileSize / 2, tx + tileSize / 2, ty + tileSize / 2, color);
        
        const inner = 4;
        drawRectangle(pixels, tx - inner, ty - inner, tx + inner, ty + inner, [255, 255, 255]);
        count++;
      }
    }
  }
  
  return createPNG(WIDTH, HEIGHT, pixels);
}

const outputDir = path.join(__dirname, 'src', 'common', 'tiles');
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

const codes = [];
for (const s of ['m', 's', 'p']) {
  for (let n = 1; n <= 9; n++) codes.push(n + s);
}
for (let n = 1; n <= 7; n++) codes.push(n + 'z');

let count = 0;
for (const code of codes) {
  const png = generateTile(code);
  fs.writeFileSync(path.join(outputDir, code + '.png'), png);
  count++;
  if (count % 10 === 0) console.log(`Generated ${count}/34 tiles...`);
}

console.log(`Done! Generated ${count} tiles to ${outputDir}`);
