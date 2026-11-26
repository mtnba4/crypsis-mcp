import fs from "fs";
import path from "path";
import net from "net";
import { fileURLToPath } from "url";
import { Camoufox } from "camoufox";
import { log, truncateCapture } from "./utils/logger.js";
import { pushRequestLog } from "./session.js";
import { createCoreTools } from "./tools/coreTools.js";
import { createNetworkTools } from "./tools/networkTools.js";
import { createAdvancedTools } from "./tools/advancedTools.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, "..");

export const parseProxyServer = (server) => {
    if (!server || /^(direct|none|off)$/i.test(server)) return null;
    const normalized = /^[a-z]+:\/\//i.test(server) ? server : `http://${server}`;
    const parsed = new URL(normalized);
    return {
        server: normalized,
        host: parsed.hostname,
        port: Number(parsed.port || (parsed.protocol === "https:" ? 443 : 80)),
    };
};

export const getProxyConfig = (session = null) => {
    const server = session?.proxyOverride ?? process.env.CRYPSIS_PROXY_SERVER ?? "direct";
    const parsed = parseProxyServer(server);
    if (!parsed) return null;

    const config = { server: parsed.server };
    if (process.env.CRYPSIS_PROXY_BYPASS) config.bypass = process.env.CRYPSIS_PROXY_BYPASS;
    if (process.env.CRYPSIS_PROXY_USERNAME) config.username = process.env.CRYPSIS_PROXY_USERNAME;
    if (process.env.CRYPSIS_PROXY_PASSWORD) config.password = process.env.CRYPSIS_PROXY_PASSWORD;
    return config;
};

export const checkProxyListener = async (server = getProxyConfig()?.server, timeout = 1500) => {
    const parsed = parseProxyServer(server);
    if (!parsed) return { enabled: false, ok: true, message: "Proxy disabled." };

    return await new Promise((resolve) => {
        const socket = net.createConnection({ host: parsed.host, port: parsed.port });
        const timer = setTimeout(() => {
            socket.destroy();
            resolve({ enabled: true, ok: false, server: parsed.server, host: parsed.host, port: parsed.port, message: `Proxy listener timed out at ${parsed.host}:${parsed.port}.` });
        }, timeout);

        socket.once("connect", () => {
            clearTimeout(timer);
            socket.end();
            resolve({ enabled: true, ok: true, server: parsed.server, host: parsed.host, port: parsed.port, message: `Proxy listener is reachable at ${parsed.host}:${parsed.port}.` });
        });
        socket.once("error", (error) => {
            clearTimeout(timer);
            resolve({ enabled: true, ok: false, server: parsed.server, host: parsed.host, port: parsed.port, message: `Proxy listener is not reachable at ${parsed.host}:${parsed.port}: ${error.message}` });
        });
    });
};

export async function getEngine(session) {
    if (session.activeContext) {
        try {
            const pages = session.activeContext.pages();
            const page = pages[session.activePageIndex] || pages[0];
            if (!page) throw new Error("No pages in context");
            return buildEngine(session, page, session.activeContext, session.activeBrowser);
        } catch {
            session.activeContext = null;
            session.activeBrowser = null;
        }
    }

    if (session.isBooting) {
        while (session.isBooting) await new Promise(r => setTimeout(r, 400));
        return getEngine(session);
    }

    session.isBooting = true;
    try {
        const isHeadless = process.env.CRYPSIS_HEADLESS === "1" || process.env.CRYPSIS_HEADLESS === "true";
        log(`[BROWSER] Launching Camoufox Engine (headless: ${isHeadless})...`);

        let proxyConfig = getProxyConfig(session);
        const proxyStatus = await checkProxyListener(proxyConfig?.server);
        if (proxyConfig && process.env.CRYPSIS_PROXY_PREFLIGHT !== "0" && !proxyStatus.ok) {
            log(`[BROWSER] Proxy unreachable (${proxyStatus.message}) - using direct connection.`);
            proxyConfig = null;
        }

        const profilePath = process.env.CRYPSIS_PROFILE_DIR || path.join(ROOT_DIR, "camoufox_profile");
        if (!fs.existsSync(profilePath)) fs.mkdirSync(profilePath, { recursive: true });

        const extensionsFile = path.join(profilePath, "installed_extensions.json");
        let installedExtensions = [];
        if (fs.existsSync(extensionsFile)) {
            try {
                installedExtensions = JSON.parse(fs.readFileSync(extensionsFile, "utf8"));
            } catch { }
        }

        const addonsToLoad = [];
        const defaultExt = process.env.CRYPSIS_DEFAULT_EXTENSION || "";
        if (defaultExt && fs.existsSync(defaultExt)) {
            addonsToLoad.push(defaultExt);
        }
        for (const ext of installedExtensions) {
            if (fs.existsSync(ext.path)) addonsToLoad.push(ext.path);
        }

        const launchConfig = {
            persistent_context: true,
            user_data_dir: profilePath,
            headless: isHeadless,
            humanize: true,
            locale: "en-US",
            disable_coop: true,
            window: [1920, 1080],
            i_know_what_im_doing: true
        };
        if (addonsToLoad.length > 0) launchConfig.addons = addonsToLoad;
        if (proxyConfig) {
            launchConfig.proxy = proxyConfig;
            launchConfig.geoip = true;
        }

        session.activeContext = await Camoufox(launchConfig);
        session.activeBrowser = session.activeContext.browser();
        if (session.activeBrowser) {
            session.activeBrowser.on("disconnected", () => {
                log(`[BROWSER] Process disconnected.`);
                session.activeBrowser = null;
                session.activeContext = null;
            });
        } else {
            session.activeContext.on("close", () => {
                log(`[BROWSER] Context closed.`);
                session.activeBrowser = null;
                session.activeContext = null;
            });
        }

        const setupPage = async (p) => {
            if (session.setupPages.has(p)) return;
            session.setupPages.add(p);

            try {
                if (session.scopeRegex) {
                    await p.route("**/*", async (route) => {
                        const req = route.request();
                        const url = req.url();
                        if (session.scopeRegex && /^https?:\/\//i.test(url) && !session.scopeRegex.test(url)) {
                            if (session.scopeBlockRequests) return route.abort("blockedbyclient");
                        }
                        return route.continue();
                    }).catch(() => { });
                }

                p.on('console', msg => {
                    const text = msg.text();
                    const type = msg.type().toUpperCase();
                    session.capturedConsoleLogs.push({ timestamp: new Date().toISOString(), type, text });
                    if (session.capturedConsoleLogs.length > 500) session.capturedConsoleLogs.shift();
                });

                p.on('request', req => {
                    const id = `${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 8)}`;
                    session.requestIds.set(req, id);
                    const logEntry = {
                        id,
                        timestamp: new Date().toISOString(),
                        type: 'request',
                        method: req.method(),
                        url: req.url(),
                        headers: req.headers(),
                        resourceType: req.resourceType(),
                        postData: truncateCapture(req.postData())
                    };
                    pushRequestLog(session, logEntry);
                });

                p.on('response', async res => {
                    const req = res.request();
                    const headers = res.headers();
                    let bodySample = null;
                    if (session.captureResponseBodies && /json|text|xml|html|javascript/i.test(headers["content-type"] || "")) {
                        bodySample = await res.text().then(text => truncateCapture(text)).catch(() => null);
                    }
                    const logEntry = {
                        requestId: session.requestIds.get(req) || null,
                        timestamp: new Date().toISOString(),
                        type: 'response',
                        url: res.url(),
                        status: res.status(),
                        headers,
                        timing: req.timing(),
                        bodySample
                    };
                    pushRequestLog(session, logEntry);
                });
            } catch { }
        };

        session.activeContext.on('page', setupPage);
        await new Promise(r => setTimeout(r, 1200));

        let pages = session.activeContext.pages();
        let page = pages.length > 0 ? pages[0] : await session.activeContext.newPage();
        await setupPage(page);

        return buildEngine(session, page, session.activeContext, session.activeBrowser);
    } finally {
        session.isBooting = false;
    }
}

function buildEngine(session, page, ctx, browser) {
    const core = createCoreTools(session, page, ctx, browser);
    const network = createNetworkTools(session, page, ctx);
    const advanced = createAdvancedTools(session, page, ctx, browser);

    return {
        ...core,
        ...network,
        ...advanced,
        page: () => page,
        context: () => ctx,
        browser: () => browser,
        close: async () => {
            if (browser) await browser.close();
            session.activeBrowser = null;
            session.activeContext = null;
        }
    };
}
