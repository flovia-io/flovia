#!/usr/bin/env node

/**
 * flovia — Desktop app launcher
 *
 * When a user runs `npx flovia`, this script:
 * 1. Checks if the full app is already installed locally
 * 2. Downloads / bootstraps the Electron app
 * 3. Launches it
 */

const { spawn, execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');

const APP_NAME = 'flovia';
const REPO = 'flovia-io/flovia';

// ── Helpers ──────────────────────────────────────────────────────────────────

function getInstallDir() {
  const base = process.env.FLOVIA_INSTALL_DIR
    || path.join(os.homedir(), `.${APP_NAME}`);
  if (!fs.existsSync(base)) fs.mkdirSync(base, { recursive: true });
  return base;
}

function isInstalled(dir) {
  return fs.existsSync(path.join(dir, 'node_modules', 'electron'));
}

function log(msg) {
  console.log(`\x1b[36m[flovia]\x1b[0m ${msg}`);
}

function error(msg) {
  console.error(`\x1b[31m[flovia]\x1b[0m ${msg}`);
}

// ── Clone or update the app ──────────────────────────────────────────────────

function ensureApp(installDir) {
  const pkgPath = path.join(installDir, 'package.json');

  if (!fs.existsSync(pkgPath)) {
    log('Downloading flovia desktop app...');
    try {
      execSync(
        `git clone --depth 1 https://github.com/${REPO}.git "${installDir}"`,
        { stdio: 'inherit' }
      );
    } catch {
      // If git clone fails, try downloading the tarball
      error('git clone failed. Make sure git is installed, or download from https://flovia.io');
      process.exit(1);
    }
  } else {
    log('Updating flovia...');
    try {
      execSync('git pull --ff-only', { cwd: installDir, stdio: 'inherit' });
    } catch {
      // Not critical — run with existing version
      log('Could not update, running existing version.');
    }
  }
}

// ── Install dependencies ─────────────────────────────────────────────────────

function installDeps(installDir) {
  if (isInstalled(installDir)) {
    return;
  }

  const pkgPath = path.join(installDir, 'package.json');
  if (!fs.existsSync(pkgPath)) {
    error(`No package.json found in ${installDir}. The download may have failed.`);
    error('Try running again, or download manually from https://flovia.io');
    process.exit(1);
  }

  log('Installing dependencies (this may take a minute on first run)...');
  try {
    execSync('npm install', { cwd: installDir, stdio: 'inherit' });
  } catch (e) {
    error('Failed to install dependencies: ' + e.message);
    error('Try deleting ' + installDir + ' and running again.');
    process.exit(1);
  }
}

// ── Launch Electron ──────────────────────────────────────────────────────────

function launch(installDir) {
  log('Starting flovia...');

  // Build main process
  try {
    execSync('npm run build:main', { cwd: installDir, stdio: 'inherit' });
  } catch (e) {
    error('Build failed: ' + e.message);
    process.exit(1);
  }

  // Start Electron
  const electronBin = path.join(installDir, 'node_modules', '.bin', 'electron');
  const child = spawn(electronBin, [installDir], {
    cwd: installDir,
    stdio: 'inherit',
    detached: process.platform !== 'win32',
    env: { ...process.env, NODE_ENV: 'production' },
  });

  // Detach so the terminal can close
  child.unref();

  // Give Electron a moment to start, then exit the launcher
  setTimeout(() => {
    log('flovia is running. You can close this terminal.');
    process.exit(0);
  }, 2000);
}

// ── Main ─────────────────────────────────────────────────────────────────────

function main() {
  const args = process.argv.slice(2);

  // Detect headless / no-GUI environments
  if (!args.includes('--help') && !args.includes('-h') &&
      !args.includes('--install-dir') && !args.includes('--uninstall') &&
      !args.includes('--update')) {
    const isHeadless = !process.env.DISPLAY && !process.env.WAYLAND_DISPLAY && process.platform === 'linux';
    if (isHeadless) {
      log('No display detected. The desktop app requires a GUI environment.');
      log('For terminal usage, install the CLI instead:');
      log('  npx @flovia-io/cli ask "your question"');
      log('  npm i -g @flovia-io/cli');
      process.exit(1);
    }
  }

  // Pass-through to CLI mode if subcommands are given
  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
\x1b[1mflovia\x1b[0m — AI-powered developer workspace (flovia.io)

Usage:
  npx flovia              Launch the desktop app
  npx flovia --update     Update to the latest version
  npx flovia --uninstall  Remove the local installation
  npx flovia-cli          Use the CLI instead (lightweight, no Electron)

Options:
  --help, -h        Show this help
  --update          Force-update the app
  --uninstall       Remove ~/.flovia
  --install-dir     Show the installation directory
`);
    process.exit(0);
  }

  const installDir = getInstallDir();

  if (args.includes('--install-dir')) {
    console.log(installDir);
    process.exit(0);
  }

  if (args.includes('--uninstall')) {
    log(`Removing ${installDir}...`);
    fs.rmSync(installDir, { recursive: true, force: true });
    log('Done. flovia has been uninstalled.');
    process.exit(0);
  }

  if (args.includes('--update')) {
    ensureApp(installDir);
    installDeps(installDir);
    log('Updated to latest version.');
    process.exit(0);
  }

  ensureApp(installDir);
  installDeps(installDir);
  launch(installDir);
}

main();
