export const MAX_LOGS = 1000;

export class BrowserSession {
    constructor(id = "default") {
        this.id = id;
        this.activeContext = null;
        this.activeBrowser = null;
        this.isBooting = false;
        this.activePageIndex = 0;
        this.requestLogs = [];
        this.capturedConsoleLogs = [];
        this.globalExtraHeaders = {};
        this.scopeRegex = null;
        this.scopeBlockRequests = process.env.CRYPSIS_SCOPE_BLOCK_REQUESTS === "1";
        this.proxyOverride = null;
        this.captureMode = process.env.CRYPSIS_CAPTURE_MODE === "1";
        this.captureResponseBodies = process.env.CRYPSIS_CAPTURE_RESPONSE_BODIES === "1";
        this.requestIds = new WeakMap();
        this.setupPages = new WeakSet();
    }
}

export const defaultSession = new BrowserSession("default");

export function pushRequestLog(session, entry) {
    session.requestLogs.push(entry);
    if (session.requestLogs.length > MAX_LOGS) session.requestLogs.shift();
}
