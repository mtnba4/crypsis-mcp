import fs from "fs";
import path from "path";
import { exec } from "child_process";
import { pathToFileURL, fileURLToPath } from "url";
import { resolveAndPreparePath, cleanSelector } from "../utils/paths.js";
import { log } from "../utils/logger.js";
import { humanMouseMove, humanClickXY } from "../human.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, "../..");

const extractExtension = async (archivePath, destDir) => {
    if (!fs.existsSync(destDir)) {
        fs.mkdirSync(destDir, { recursive: true });
    }
    const escapedArchivePath = archivePath.replace(/'/g, "''");
    const escapedDestDir = destDir.replace(/'/g, "''");
    const command = `powershell -NoProfile -ExecutionPolicy Bypass -Command "Expand-Archive -Path '${escapedArchivePath}' -DestinationPath '${escapedDestDir}' -Force"`;
    return new Promise((resolve, reject) => {
        exec(command, (error, stdout, stderr) => {
            if (error) reject(new Error(stderr?.trim() || error.message));
            else resolve(destDir);
        });
    });
};

const getExtensionMetadata = (extPath) => {
    const manifestPath = path.join(extPath, "manifest.json");
    if (!fs.existsSync(manifestPath)) {
        throw new Error(`Invalid extension: manifest.json not found in ${extPath}`);
    }
    try {
        const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
        return {
            name: manifest.name || path.basename(extPath),
            version: manifest.version || "0.0.0",
            manifestVersion: manifest.manifest_version || 2
        };
    } catch (e) {
        throw new Error(`Failed to parse manifest.json: ${e.message}`);
    }
};

export function createAdvancedTools(session, page, ctx, browser) {
    return {
        openFile: async (filepath, options = {}) => {
            const resolved = resolveAndPreparePath(filepath);
            if (!fs.existsSync(resolved)) {
                throw new Error(`File not found at path: ${resolved}`);
            }
            const fileUrl = pathToFileURL(resolved).href;
            log(`[OPEN-FILE] Opening local file: ${filepath} -> ${fileUrl}`);
            await page.goto(fileUrl, { waitUntil: options.wait_until || 'domcontentloaded', timeout: options.timeout || 90000 });
            return { filepath: resolved, url: fileUrl };
        },

        loadFile: async (filepath, selector = null, options = {}) => {
            const resolved = resolveAndPreparePath(filepath);
            if (!fs.existsSync(resolved)) {
                throw new Error(`File not found at path: ${resolved}`);
            }
            if (selector) {
                const cleanS = cleanSelector(selector);
                await page.setInputFiles(cleanS, resolved);
                return { loaded: true, filepath: resolved, selector: cleanS };
            } else {
                const fileUrl = pathToFileURL(resolved).href;
                await page.goto(fileUrl, { waitUntil: options.wait_until || 'domcontentloaded', timeout: options.timeout || 90000 });
                return { loaded: true, filepath: resolved, url: fileUrl };
            }
        },

        debugJs: async (action, params = {}) => {
            let client = null;
            try {
                client = await ctx.newCDPSession(page);
            } catch (cdpErr) {
                if (action === "list_scripts") {
                    const scripts = await page.evaluate(() => {
                        return Array.from(document.querySelectorAll('script')).map((s, idx) => ({
                            index: idx,
                            src: s.src || '[inline]',
                            type: s.type || 'text/javascript',
                            async: s.async,
                            defer: s.defer,
                            contentLength: s.textContent ? s.textContent.length : 0
                        }));
                    });
                    return { action: "list_scripts", total: scripts.length, scripts, note: "Evaluated via DOM (CDP unavailable in Firefox/Camoufox)." };
                }
                return { error: `Action '${action}' requires Chromium CDP, which is unavailable in Camoufox/Firefox: ${cdpErr.message}` };
            }
            try {
                await client.send("Debugger.enable").catch(() => { });
                await client.send("Runtime.enable").catch(() => { });

                switch (action) {
                    case "list_scripts": {
                        const scripts = await page.evaluate(() => {
                            return Array.from(document.querySelectorAll('script')).map((s, idx) => ({
                                index: idx,
                                src: s.src || '[inline]',
                                type: s.type || 'text/javascript',
                                async: s.async,
                                defer: s.defer,
                                contentLength: s.textContent ? s.textContent.length : 0
                            }));
                        });
                        return { action: "list_scripts", total: scripts.length, scripts };
                    }
                    case "get_script_source": {
                        if (!params.scriptId) throw new Error("scriptId is required for get_script_source");
                        const { scriptSource } = await client.send("Debugger.getScriptSource", { scriptId: params.scriptId });
                        return { scriptId: params.scriptId, scriptSource };
                    }
                    case "set_breakpoint": {
                        if (params.scriptId && typeof params.lineNumber === 'number') {
                            const bp = await client.send("Debugger.setBreakpoint", {
                                location: { scriptId: params.scriptId, lineNumber: params.lineNumber, columnNumber: params.columnNumber || 0 },
                                condition: params.condition
                            });
                            return { action: "set_breakpoint", breakpointId: bp.breakpointId, actualLocation: bp.actualLocation };
                        } else if (params.url && typeof params.lineNumber === 'number') {
                            const bp = await client.send("Debugger.setBreakpointByUrl", {
                                url: params.url,
                                lineNumber: params.lineNumber,
                                columnNumber: params.columnNumber || 0,
                                condition: params.condition
                            });
                            return { action: "set_breakpoint", breakpointId: bp.breakpointId, locations: bp.locations };
                        } else {
                            throw new Error("url or scriptId and lineNumber are required for set_breakpoint");
                        }
                    }
                    case "remove_breakpoint": {
                        if (!params.breakpointId) throw new Error("breakpointId is required for remove_breakpoint");
                        await client.send("Debugger.removeBreakpoint", { breakpointId: params.breakpointId });
                        return { action: "remove_breakpoint", breakpointId: params.breakpointId, status: "removed" };
                    }
                    case "pause": {
                        await client.send("Debugger.pause");
                        return { action: "pause", status: "paused" };
                    }
                    case "resume": {
                        await client.send("Debugger.resume");
                        return { action: "resume", status: "resumed" };
                    }
                    case "step_over": {
                        await client.send("Debugger.stepOver");
                        return { action: "step_over", status: "stepped" };
                    }
                    case "step_into": {
                        await client.send("Debugger.stepInto");
                        return { action: "step_into", status: "stepped" };
                    }
                    case "step_out": {
                        await client.send("Debugger.stepOut");
                        return { action: "step_out", status: "stepped" };
                    }
                    case "evaluate_on_call_frame": {
                        if (!params.callFrameId || !params.expression) {
                            throw new Error("callFrameId and expression are required for evaluate_on_call_frame");
                        }
                        const result = await client.send("Debugger.evaluateOnCallFrame", {
                            callFrameId: params.callFrameId,
                            expression: params.expression,
                            returnByValue: true
                        });
                        return { action: "evaluate_on_call_frame", result: result.result };
                    }
                    case "override_script":
                    case "hot_patch": {
                        if (!params.scriptId || typeof params.scriptSource !== 'string') {
                            throw new Error("scriptId and scriptSource are required for override_script/hot_patch");
                        }
                        const res = await client.send("Debugger.setScriptSource", {
                            scriptId: params.scriptId,
                            scriptSource: params.scriptSource
                        });
                        return { action: "override_script", scriptId: params.scriptId, status: "updated", callFrames: res.callFrames, stackChanged: res.stackChanged };
                    }
                    default:
                        throw new Error(`Unknown debug_js action: ${action}`);
                }
            } finally {
                await client.detach().catch(() => { });
            }
        },

        tabList: async () => {
            const ps = ctx.pages();
            return await Promise.all(ps.map(async (p, i) => ({ index: i, url: p.url(), title: await p.title() })));
        },

        switchTab: async (idx) => {
            const ps = ctx.pages();
            if (!ps[idx]) throw new Error("Invalid tab index");
            await ps[idx].bringToFront();
            return ps[idx];
        },

        closeTab: async (idx) => {
            const ps = ctx.pages();
            if (!ps[idx]) throw new Error("Invalid tab index");
            await ps[idx].close();
        },

        newTab: async (url) => {
            const newP = await ctx.newPage();
            if (url) await newP.goto(url, { waitUntil: "domcontentloaded" });
            return newP;
        },

        resize: async (width, height) => {
            await page.setViewportSize({ width, height });
        },

        mouseClickXY: async (x, y) => {
            await humanClickXY(page, x, y);
        },

        mouseMoveXY: async (x, y) => {
            await humanMouseMove(page, x, y);
        },

        drag: async (source, target) => {
            await page.dragAndDrop(cleanSelector(source), cleanSelector(target));
        },

        verifyElementVisible: async (selector) => {
            return await page.isVisible(cleanSelector(selector));
        },

        fileUpload: async (selector, filePath) => {
            const resolved = Array.isArray(filePath)
                ? filePath.map(item => resolveAndPreparePath(item))
                : resolveAndPreparePath(filePath);
            await page.setInputFiles(cleanSelector(selector), resolved);
        },

        getConsoleLogs: async () => {
            return session.capturedConsoleLogs;
        },

        clearConsoleLogs: async () => {
            session.capturedConsoleLogs = [];
        },

        getLayers: async (opts = {}) => {
            return await page.evaluate((options) => {
                const targetSelector = options.selector || 'body';
                const container = document.querySelector(targetSelector) || document.body;
                const onlyInteractive = options.onlyInteractive !== false;

                const candidateSelector = onlyInteractive
                    ? 'button, input, a, select, textarea, [role], [onclick], [tabindex], dialog, [class*="modal"], [class*="overlay"], [class*="popup"], [class*="sticky"], [class*="fixed"], header, nav'
                    : '*';

                const rawElements = Array.from(container.querySelectorAll(candidateSelector));
                if (container !== document.body && !rawElements.includes(container)) {
                    rawElements.unshift(container);
                }

                const results = [];
                let occludedCount = 0;
                let activeModalPresent = false;

                for (let i = 0; i < Math.min(rawElements.length, 150); i++) {
                    const el = rawElements[i];
                    if (!el || el.nodeType !== 1) continue;

                    const style = window.getComputedStyle(el);
                    const rect = el.getBoundingClientRect();

                    const isVisibleCSS = style.display !== 'none' &&
                        style.visibility !== 'hidden' &&
                        parseFloat(style.opacity || '1') > 0 &&
                        el.getAttribute('aria-hidden') !== 'true' &&
                        !style.clipPath?.includes('100%');

                    const isInViewport = rect.width > 0 && rect.height > 0 &&
                        rect.top < window.innerHeight &&
                        rect.left < window.innerWidth &&
                        rect.bottom > 0 &&
                        rect.right > 0;

                    let isOccluded = false;
                    let occludedBy = null;

                    if (isVisibleCSS && isInViewport) {
                        const cx = Math.max(0, Math.min(window.innerWidth - 1, rect.left + rect.width / 2));
                        const cy = Math.max(0, Math.min(window.innerHeight - 1, rect.top + rect.height / 2));

                        const topEl = document.elementFromPoint(cx, cy);
                        if (topEl && topEl !== el && !el.contains(topEl) && !topEl.contains(el)) {
                            isOccluded = true;
                            occludedCount++;
                            const topId = topEl.id ? `#${topEl.id}` : '';
                            const topClass = topEl.className && typeof topEl.className === 'string' ? `.${topEl.className.trim().split(/\s+/).join('.')}` : '';
                            occludedBy = `${topEl.tagName.toLowerCase()}${topId}${topClass}`;
                        }
                    }

                    const zVal = style.zIndex;
                    const parsedZ = zVal !== 'auto' ? parseInt(zVal, 10) : 0;
                    const position = style.position;

                    let layerCategory = 'background-content';
                    const classAndRole = `${el.className || ''} ${el.getAttribute('role') || ''}`.toLowerCase();

                    if (el.tagName.toLowerCase() === 'dialog' || classAndRole.includes('modal') || classAndRole.includes('overlay') || classAndRole.includes('backdrop')) {
                        layerCategory = 'modal-overlay';
                        if (isVisibleCSS) activeModalPresent = true;
                    } else if (position === 'fixed' || position === 'sticky') {
                        layerCategory = 'sticky-header';
                    } else if (classAndRole.includes('popup') || classAndRole.includes('popover') || classAndRole.includes('dropdown')) {
                        layerCategory = 'floating-popup';
                    } else if (['button', 'input', 'a', 'select', 'textarea'].includes(el.tagName.toLowerCase()) || el.getAttribute('role') === 'button') {
                        layerCategory = 'interactive-element';
                    }

                    let selector = el.tagName.toLowerCase();
                    if (el.id) selector = `#${el.id}`;
                    else if (el.name) selector = `${el.tagName.toLowerCase()}[name="${el.name}"]`;
                    else if (el.className && typeof el.className === 'string') {
                        const firstClass = el.className.trim().split(/\s+/)[0];
                        if (firstClass) selector += `.${firstClass}`;
                    }

                    results.push({
                        selector,
                        tagName: el.tagName.toLowerCase(),
                        id: el.id || '',
                        text: (el.innerText || el.textContent || '').substring(0, 60).trim(),
                        layerCategory,
                        computedZIndex: parsedZ,
                        position,
                        isVisibleCSS,
                        isInViewport,
                        isOccluded,
                        occludedBy,
                        readyForInteraction: isVisibleCSS && isInViewport && !isOccluded,
                        bounds: { x: Math.round(rect.x), y: Math.round(rect.y), width: Math.round(rect.width), height: Math.round(rect.height) }
                    });
                }

                const layers = {};
                for (const item of results) {
                    if (!layers[item.layerCategory]) layers[item.layerCategory] = [];
                    layers[item.layerCategory].push(item);
                }

                return {
                    url: window.location.href,
                    activeModalPresent,
                    totalAudited: results.length,
                    occludedCount,
                    layers
                };
            }, opts);
        },

        verifyLayerVisibility: async (selectorString) => {
            const cleanS = cleanSelector(selectorString);
            return await page.evaluate((sel) => {
                const els = Array.from(document.querySelectorAll(sel));
                if (els.length === 0) {
                    return { selector: sel, exists: false, count: 0, message: "No matching elements found in DOM." };
                }

                const audited = els.map(el => {
                    const style = window.getComputedStyle(el);
                    const rect = el.getBoundingClientRect();

                    const isVisibleCSS = style.display !== 'none' &&
                        style.visibility !== 'hidden' &&
                        parseFloat(style.opacity || '1') > 0 &&
                        el.getAttribute('aria-hidden') !== 'true' &&
                        !style.clipPath?.includes('100%');

                    const isInViewport = rect.width > 0 && rect.height > 0 &&
                        rect.top < window.innerHeight &&
                        rect.left < window.innerWidth &&
                        rect.bottom > 0 &&
                        rect.right > 0;

                    let isOccluded = false;
                    let occludedBy = null;

                    if (isVisibleCSS && isInViewport) {
                        const cx = Math.max(0, Math.min(window.innerWidth - 1, rect.left + rect.width / 2));
                        const cy = Math.max(0, Math.min(window.innerHeight - 1, rect.top + rect.height / 2));

                        const topEl = document.elementFromPoint(cx, cy);
                        if (topEl && topEl !== el && !el.contains(topEl) && !topEl.contains(el)) {
                            isOccluded = true;
                            const topId = topEl.id ? `#${topEl.id}` : '';
                            const topClass = topEl.className && typeof topEl.className === 'string' ? `.${topEl.className.trim().split(/\s+/).join('.')}` : '';
                            occludedBy = `${topEl.tagName.toLowerCase()}${topId}${topClass}`;
                        }
                    }

                    const readyForInteraction = isVisibleCSS && isInViewport && !isOccluded;
                    let reason = "Element is fully visible and interactable.";
                    if (!isVisibleCSS) reason = `Element is hidden via CSS (display: ${style.display}, visibility: ${style.visibility}, opacity: ${style.opacity}).`;
                    else if (!isInViewport) reason = `Element is outside viewport or has zero dimensions (${rect.width}x${rect.height}).`;
                    else if (isOccluded) reason = `Element is occluded/overlapped by ${occludedBy}.`;

                    return {
                        tagName: el.tagName.toLowerCase(),
                        id: el.id || '',
                        text: (el.innerText || el.textContent || '').substring(0, 80).trim(),
                        isVisibleCSS,
                        isInViewport,
                        isOccluded,
                        occludedBy,
                        readyForInteraction,
                        reason,
                        zIndex: style.zIndex,
                        position: style.position,
                        bounds: { x: Math.round(rect.x), y: Math.round(rect.y), width: Math.round(rect.width), height: Math.round(rect.height) }
                    };
                });

                return {
                    selector: sel,
                    exists: true,
                    count: els.length,
                    elements: audited
                };
            }, cleanS);
        },

        extensionInstall: async (rawPath) => {
            const profilePath = process.env.CRYPSIS_PROFILE_DIR || path.join(ROOT_DIR, "camoufox_profile");
            if (!fs.existsSync(profilePath)) fs.mkdirSync(profilePath, { recursive: true });

            const extPath = resolveAndPreparePath(rawPath);
            if (!fs.existsSync(extPath)) {
                throw new Error(`Extension source path does not exist: ${extPath}`);
            }

            let targetPath = extPath;
            const extName = path.basename(extPath);

            if (extPath.endsWith(".zip") || extPath.endsWith(".crx")) {
                const destDir = path.join(profilePath, "extracted_extensions", extName.replace(/\.(zip|crx)$/i, ""));
                await extractExtension(extPath, destDir);
                targetPath = destDir;
            }

            const metadata = getExtensionMetadata(targetPath);
            const extensionsFile = path.join(profilePath, "installed_extensions.json");
            let installed = [];
            if (fs.existsSync(extensionsFile)) {
                try { installed = JSON.parse(fs.readFileSync(extensionsFile, "utf8")); } catch { }
            }

            const existingIdx = installed.findIndex(e => e.name === metadata.name);
            const extensionRecord = { ...metadata, path: targetPath, installedAt: new Date().toISOString() };
            if (existingIdx >= 0) installed[existingIdx] = extensionRecord;
            else installed.push(extensionRecord);

            fs.writeFileSync(extensionsFile, JSON.stringify(installed, null, 2), "utf8");
            return { success: true, extension: extensionRecord, restartRequired: true };
        },

        extensionUninstall: async (target) => {
            const profilePath = process.env.CRYPSIS_PROFILE_DIR || path.join(ROOT_DIR, "camoufox_profile");
            const extensionsFile = path.join(profilePath, "installed_extensions.json");
            if (!fs.existsSync(extensionsFile)) return { message: "No extensions are installed." };

            let installed = JSON.parse(fs.readFileSync(extensionsFile, "utf8"));
            const initialLen = installed.length;
            installed = installed.filter(e => e.path !== target && e.name !== target && e.id !== target);
            if (installed.length === initialLen) throw new Error(`Extension not found matching: ${target}`);

            fs.writeFileSync(extensionsFile, JSON.stringify(installed, null, 2), "utf8");
            return { success: true, message: `Extension uninstalled. Restart browser to apply.` };
        },

        extensionList: async () => {
            const profilePath = process.env.CRYPSIS_PROFILE_DIR || path.join(ROOT_DIR, "camoufox_profile");
            const extensionsFile = path.join(profilePath, "installed_extensions.json");
            let installed = [];
            if (fs.existsSync(extensionsFile)) {
                try { installed = JSON.parse(fs.readFileSync(extensionsFile, "utf8")); } catch { }
            }
            return { installed };
        }
    };
}
