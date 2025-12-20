const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const pkgPath = path.join(root, 'package.json');
const readmePath = path.join(root, 'README.md');

const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
const version = pkg.version;

// Validate version format
function isValidSemver(version) {
  const semverRegex = /^\d+\.\d+\.\d+$/;
  return semverRegex.test(version);
}

console.log(`🔍 Checking version consistency for: ${version}`);

// Validate version format
if (!isValidSemver(version)) {
  console.error(`❌ Invalid version format: ${version}. Expected semver format (x.y.z)`);
  process.exit(1);
}

// Check if version is not a placeholder
if (version === '0.0.0') {
  console.warn(`⚠️ Version is set to placeholder: ${version}`);
}

// Update README badge
const readme = fs.readFileSync(readmePath, 'utf-8');
const updated = readme.replace(
  /https:\/\/img\.shields\.io\/badge\/version-[^ -]+-blue/g,
  `https://img.shields.io/badge/version-${version}-blue`,
);

if (updated !== readme) {
  console.log('📝 Updating README version badge...');
  fs.writeFileSync(readmePath, updated);
} else {
  console.log('✅ README version badge is already up to date');
}

// Check for version references in source code
function checkVersionInFile(filePath, expectedVersion) {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const versionRegex = new RegExp(expectedVersion.replace(/\./g, '\\.'), 'g');
    const matches = content.match(versionRegex);
    return matches ? matches.length : 0;
  } catch (error) {
    return 0;
  }
}

// Check if version appears in key files (this is a basic check)
const srcFiles = [
  'src/frontend/StartScreen.tsx',
  'src/frontend/PhotoOrganizer.tsx',
  'src/utils/versionManager.ts'
];

let allReferencesFound = true;
srcFiles.forEach(file => {
  const filePath = path.join(root, file);
  if (fs.existsSync(filePath)) {
    const count = checkVersionInFile(filePath, version);
    if (count === 0) {
      console.warn(`⚠️ No version references found in ${file} (this may be normal if using versionManager)`);
    } else {
      console.log(`✅ Found ${count} version reference(s) in ${file}`);
    }
  }
});

console.log(`🎉 Version consistency check complete for v${version}`);
