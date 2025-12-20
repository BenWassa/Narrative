const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const pkgPath = path.join(root, 'package.json');
const readmePath = path.join(root, 'README.md');

const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
const version = pkg.version;

const readme = fs.readFileSync(readmePath, 'utf-8');
const updated = readme.replace(
  /https:\/\/img\.shields\.io\/badge\/version-[^ -]+-blue/g,
  `https://img.shields.io/badge/version-${version}-blue`,
);

if (updated !== readme) {
  fs.writeFileSync(readmePath, updated);
}
