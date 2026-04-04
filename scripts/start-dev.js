#!/usr/bin/env node
const { spawn } = require('child_process');
const net = require('net');

const DEFAULT_PORT = 5173;

function start(cmd, args, opts) {
  const p = spawn(cmd, args, { stdio: 'inherit', shell: true, ...opts });
  p.on('exit', code => {
    console.log(`${cmd} ${args.join(' ')} exited with ${code}`);
  });
  return p;
}

function isPortAvailable(port) {
  return new Promise(resolve => {
    const server = net.createServer();

    server.once('error', () => resolve(false));
    server.once('listening', () => {
      server.close(() => resolve(true));
    });
    server.listen(port, '127.0.0.1');
  });
}

async function findAvailablePort(startPort) {
  let port = startPort;

  while (!(await isPortAvailable(port))) {
    port += 1;
  }

  return port;
}

async function main() {
  const port = await findAvailablePort(DEFAULT_PORT);

  console.log(`Starting frontend on port ${port}...`);

  const frontend = start('npm', ['run', 'dev', '--', '--port', String(port)]);

  console.log(`\nFrontend: http://localhost:${port}\n`);

  // Forward signals
  ['SIGINT', 'SIGTERM', 'SIGHUP'].forEach(sig => {
    process.on(sig, () => {
      frontend.kill(sig);
      process.exit();
    });
  });

  process.on('exit', () => {
    try {
      frontend.kill();
    } catch (e) {}
  });
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
