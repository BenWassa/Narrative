const fs = require('fs');
const path = require('path');

const assetsDir = path.join(__dirname, '..', 'docs', 'assets');

if (!fs.existsSync(assetsDir)) {
  process.exit(0);
}

const entries = fs.readdirSync(assetsDir);
const cleanPattern = /^(index|heic2any)-.*\.(js|css|map)$/;
entries.forEach(entry => {
  if (!cleanPattern.test(entry)) return;
  fs.unlinkSync(path.join(assetsDir, entry));
});
