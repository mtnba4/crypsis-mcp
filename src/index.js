#!/usr/bin/env node
import { startServer } from "./server.js";
import { log } from "./utils/logger.js";

// Global uncaught handlers
process.on('uncaughtException', (err) => {
    log(`[CRITICAL-EXCEPTION] ${err.stack || err.message}`);
});

process.on('unhandledRejection', (reason) => {
    log(`[CRITICAL-REJECTION] ${reason?.stack || reason}`);
});

// Safely redirect accidental console.log/info to stderr to keep stdio JSON-RPC pipe clean
console.log = (...args) => console.error(...args);
console.info = (...args) => console.error(...args);

startServer().catch(err => {
    console.error(`Fatal server error:`, err);
    process.exit(1);
});
