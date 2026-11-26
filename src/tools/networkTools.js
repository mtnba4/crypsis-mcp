import fs from "fs";
import { resolveAndPreparePath } from "../utils/paths.js";
import { toHar } from "../utils/har.js";
import { log } from "../utils/logger.js";

export function createNetworkTools(session, page, ctx) {
    return {
        xhrGet: async (requestId) => {
            const reqLog = session.requestLogs.find(l => l.id === requestId && l.type === 'request');
            if (!reqLog) {
                throw new Error(`Request ID not found in logs: ${requestId}`);
            }
            const resLog = session.requestLogs.find(l => l.requestId === requestId && l.type === 'response') || null;
            return {
                id: requestId,
                request: {
                    url: reqLog.url,
                    method: reqLog.method,
                    headers: reqLog.headers,
                    body: reqLog.postData || null,
                    timestamp: reqLog.timestamp
                },
                response: resLog ? {
                    status: resLog.status,
                    headers: resLog.headers,
                    bodySample: resLog.bodySample || null,
                    timing: resLog.timing || null
                } : null
            };
        },

        xhrEditSend: async (options = {}) => {
            let targetUrl = options.url;
            let method = options.method || 'GET';
            let headers = options.headers || {};
            let body = options.body !== undefined ? options.body : null;

            if (options.requestId) {
                const reqLog = session.requestLogs.find(l => l.id === options.requestId && l.type === 'request');
                if (reqLog) {
                    if (!targetUrl) targetUrl = reqLog.url;
                    if (!options.method) method = reqLog.method;
                    headers = { ...reqLog.headers, ...headers };
                    if (body === null && reqLog.postData) body = reqLog.postData;
                }
            }

            if (!targetUrl) {
                throw new Error("Target URL is required for xhrEditSend (provide 'url' or a valid 'requestId').");
            }

            const inBrowserContext = options.inBrowserContext !== false;
            log(`[XHR] Sending ${method} ${targetUrl} (inBrowserContext: ${inBrowserContext})...`);

            if (inBrowserContext) {
                return await page.evaluate(async ({ url, method, headers, body }) => {
                    try {
                        const opts = {
                            method,
                            headers: headers || {},
                            credentials: 'include'
                        };
                        if (body && !['GET', 'HEAD'].includes(method.toUpperCase())) {
                            opts.body = typeof body === 'object' ? JSON.stringify(body) : body;
                        }
                        const response = await window.fetch(url, opts);
                        const resText = await response.text();
                        const resHeaders = {};
                        response.headers.forEach((val, key) => { resHeaders[key] = val; });
                        return {
                            ok: response.ok,
                            status: response.status,
                            statusText: response.statusText,
                            url: response.url,
                            headers: resHeaders,
                            body: resText
                        };
                    } catch (e) {
                        return { error: `In-browser fetch error: ${e.message}` };
                    }
                }, { url: targetUrl, method, headers, body });
            } else {
                const response = await page.request.fetch(targetUrl, {
                    method,
                    headers,
                    data: body,
                    timeout: options.timeout || 30000
                });
                return {
                    status: response.status(),
                    statusText: response.statusText(),
                    headers: response.headers(),
                    body: await response.text()
                };
            }
        },

        getCookies: async (urls) => {
            return await ctx.cookies(urls);
        },

        setCookies: async (cookies) => {
            const sanitized = cookies.map(c => {
                const s = { ...c };
                if (s.sameSite !== undefined && !['Strict', 'Lax', 'None'].includes(s.sameSite)) {
                    delete s.sameSite;
                }
                return s;
            });
            await ctx.addCookies(sanitized);
        },

        clearCookies: async () => {
            await ctx.clearCookies();
        },

        getRequestLogs: async () => {
            return session.requestLogs;
        },

        clearRequestLogs: async () => {
            session.requestLogs = [];
        },

        saveRequestLogs: async (filename) => {
            const p = resolveAndPreparePath(filename);
            fs.writeFileSync(p, JSON.stringify(session.requestLogs, null, 2));
            return p;
        },

        exportHar: async (filename) => {
            const p = resolveAndPreparePath(filename);
            fs.writeFileSync(p, JSON.stringify(toHar(session.requestLogs), null, 2));
            return p;
        },

        setCaptureMode: async (enabled, includeResponseBodies = session.captureResponseBodies) => {
            session.captureMode = !!enabled;
            session.captureResponseBodies = !!includeResponseBodies;
            return {
                captureMode: session.captureMode,
                captureResponseBodies: session.captureResponseBodies,
                restartRequiredForServiceWorkers: !!session.activeBrowser
            };
        },

        setHeaders: async (headers) => {
            session.globalExtraHeaders = headers;
            await ctx.setExtraHTTPHeaders(headers);
        },

        setScopeOptions: async (regex, blockRequests = session.scopeBlockRequests) => {
            session.scopeRegex = regex ? new RegExp(regex, 'i') : null;
            session.scopeBlockRequests = !!blockRequests;
        },

        networkReplay: async (requestId, overrides = {}) => {
            const req = session.requestLogs.find(l => l.id === requestId && l.type === 'request');
            if (!req) throw new Error("Request ID not found in logs");

            const response = await page.request.fetch(req.url, {
                method: overrides.method || req.method,
                headers: { ...req.headers, ...overrides.headers },
                data: overrides.body || req.postData,
                timeout: 30000
            });

            return {
                status: response.status(),
                headers: response.headers(),
                body: (await response.text()).substring(0, 5000)
            };
        }
    };
}
