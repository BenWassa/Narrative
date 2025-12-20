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

// Check build-time version injection in vite.config.ts
function checkViteConfig() {
  const viteConfigPath = path.join(root, 'vite.config.ts');
  if (!fs.existsSync(viteConfigPath)) {
    console.warn('⚠️ vite.config.ts not found');
    return false;
  }

  const content = fs.readFileSync(viteConfigPath, 'utf-8');
  if (content.includes('__APP_VERSION__') && content.includes('pkg.version')) {
    console.log('✅ Vite config properly injects version at build time');
    return true;
  } else {
    console.warn('⚠️ Vite config may not be properly injecting version');
    return false;
  }
}

// Check versionManager implementation
function checkVersionManager() {
  const versionManagerPath = path.join(root, 'src/utils/versionManager.ts');
  if (!fs.existsSync(versionManagerPath)) {
    console.warn('⚠️ versionManager.ts not found');
    return false;
  }

  const content = fs.readFileSync(versionManagerPath, 'utf-8');
  if (content.includes('declare const __APP_VERSION__: string') &&
      content.includes('APP_VERSION = __APP_VERSION__')) {
    console.log('✅ versionManager properly uses build-time injected version');
    return true;
  } else {
    console.warn('⚠️ versionManager may not be properly configured for build-time injection');
    return false;
  }
}

// Check UI components use versionManager
function checkUIComponents() {
  const uiFiles = [
    'src/frontend/StartScreen.tsx',
    'src/frontend/PhotoOrganizer.tsx'
  ];

  let allGood = true;
  uiFiles.forEach(file => {
    const filePath = path.join(root, file);
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf-8');
      if (content.includes('versionManager.')) {
        console.log(`✅ ${file} properly uses versionManager`);
      } else {
        console.warn(`⚠️ ${file} may not be using versionManager for version display`);
        allGood = false;
      }
    }
  });
  return allGood;
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
      console.log(`ℹ️ No hardcoded version references in ${file} (expected with build-time injection)`);
    } else {
      console.log(`✅ Found ${count} version reference(s) in ${file}`);
    }
  }
});

// Check build-time injection setup
console.log('\n🔧 Checking build-time version injection setup...');
checkViteConfig();
checkVersionManager();
checkUIComponents();

console.log(`🎉 Version consistency check complete for v${version}`);
console.log('\n📋 Versioning Architecture:');
console.log('   • Build-time injection via Vite define option');
console.log('   • Centralized versionManager for consistent access');
console.log('   • UI components use versionManager.getDisplayVersion()');
console.log('   • No hardcoded version strings in source code');
