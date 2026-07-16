const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const srcDir = 'src/common/tiles/placeholder';

async function rotateAll() {
  const files = fs.readdirSync(srcDir).filter(f => f.endsWith('.png'));
  for (const file of files) {
    const srcPath = path.join(srcDir, file);
    const tmpPath = srcPath + '.tmp';
    await sharp(srcPath)
      .rotate(90)
      .toFile(tmpPath);
    fs.renameSync(tmpPath, srcPath);
    console.log('Rotated placeholder:', file);
  }
  console.log('Done! Rotated', files.length, 'placeholder images.');
}

rotateAll().catch(err => console.error(err));
