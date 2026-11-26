#!/usr/bin/env node
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

// CLI flag parsing
const args = process.argv.slice(2);
for (const arg of args) {
    if (arg === '--headless') {
        process.env.CRYPSIS_HEADLESS = '1';
    } else if (arg.startsWith('--toolset=')) {
        process.env.CRYPSIS_TOOLSET = arg.split('=')[1];
    } else if (arg.startsWith('--workspace=')) {
        process.env.CRYPSIS_WORKSPACE = arg.split('=')[1];
    }
}

// Target modular src/index.js, or index.mjs if legacy
let entryFile = path.join(__dirname, 'src', 'index.js');
if (!fs.existsSync(entryFile)) {
    entryFile = path.join(__dirname, 'index.mjs');
}

console.error(`Launcher: Starting Crypsis MCP (toolset: ${process.env.CRYPSIS_TOOLSET || 'core'}, headless: ${process.env.CRYPSIS_HEADLESS || '0'})...`);

function startBridge() {
    const child = spawn('node', [entryFile, ...args], {
        stdio: ['inherit', 'pipe', 'inherit'],
        env: { ...process.env, REBROWSER_PATCHES_RUNTIME_FIX_MODE: "addBinding" }
    });

    child.stdout.on('data', (data) => {
        process.stdout.write(data);
    });

    child.on('exit', (code) => {
        console.error(`Launcher: Bridge child exited with code ${code}`);
        if (code === 42) {
            console.error("Launcher: Reloading Bridge child process...");
            startBridge();
        } else {
            process.exit(code ?? 0);
        }
    });
}

startBridge();
