const fs = require('fs');
const path = require('path');

const assetsDir = path.join(__dirname, '..', 'docs', 'assets');

if (!fs.existsSync(assetsDir)) {
  process.exit(0);
}

const entries = fs.readdirSync(assetsDir);
entries.forEach(entry => {
  if (!/^index-.*\.(js|css|map)$/.test(entry)) return;
  fs.unlinkSync(path.join(assetsDir, entry));
});
