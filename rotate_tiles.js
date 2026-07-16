const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const srcDir = 'pic/new';
const destDir = 'src/common/tiles';

async function rotateAll() {
  const files = fs.readdirSync(srcDir).filter(f => f.endsWith('.png'));
  for (const file of files) {
    const srcPath = path.join(srcDir, file);
    const destPath = path.join(destDir, file);
    await sharp(srcPath)
      .rotate(90) // 顺时针旋转90度
      .toFile(destPath + '.tmp');
    fs.renameSync(destPath + '.tmp', destPath);
    console.log('Rotated:', file);
  }
  console.log('Done! Rotated', files.length, 'images.');
}

rotateAll().catch(err => console.error(err));
