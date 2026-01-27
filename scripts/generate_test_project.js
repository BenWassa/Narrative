// Generate 1000+ dummy photos for performance testing.
const fs = require('fs');
const path = require('path');

const OUTPUT_DIR = path.resolve(__dirname, '../test-projects/large-project');
const PHOTO_COUNT = 1000;

// Simple 1x1 pixel JPEG.
const JPEG_DATA = Buffer.from([
  0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01,
  0x00, 0x01, 0x00, 0x00, 0xff, 0xd9,
]);

fs.mkdirSync(OUTPUT_DIR, { recursive: true });

for (let i = 1; i <= PHOTO_COUNT; i += 1) {
  const day = Math.floor((i - 1) / 100) + 1;
  const dayFolder = path.join(
    OUTPUT_DIR,
    `01_DAYS/Day ${String(day).padStart(2, '0')}`,
  );
  fs.mkdirSync(dayFolder, { recursive: true });

  const filename = `IMG_${String(i).padStart(4, '0')}.jpg`;
  fs.writeFileSync(path.join(dayFolder, filename), JPEG_DATA);
}

// eslint-disable-next-line no-console
console.log(`Generated ${PHOTO_COUNT} test photos in ${OUTPUT_DIR}`);

