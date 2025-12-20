#!/usr/bin/env node
const { spawn } = require('child_process');

function start(cmd, args, opts) {
  const p = spawn(cmd, args, { stdio: 'inherit', shell: true, ...opts });
  p.on('exit', code => {
    console.log(`${cmd} ${args.join(' ')} exited with ${code}`);
  });
  return p;
}

console.log('Starting frontend...');

const frontend = start('npm', ['run', 'dev']);

// Immediately print the frontend URL so it's visible in mixed output
console.log('\nFrontend: http://localhost:5173\n');

// Forward signals
['SIGINT', 'SIGTERM', 'SIGHUP'].forEach(sig => {
  process.on(sig, () => {
    frontend.kill(sig);
    process.exit();
  });
});

// Keep the script running until both children exit
process.on('exit', () => {
  try {
    frontend.kill();
  } catch (e) {}
});
