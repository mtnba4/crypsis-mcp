import fs from "fs";
import { pathToFileURL } from "url";
import { resolveAndPreparePath, cleanSelector } from "../utils/paths.js";
import { log } from "../utils/logger.js";
import { humanClick, humanType } from "../human.js";
import { solveCaptcha } from "../captcha.js";

export function createCoreTools(session, page, ctx, browser) {
    return {
        navigate: async (u, o = {}) => {
            let targetUrl = u;
            if (targetUrl && !/^[a-z0-9+-.]+:/i.test(targetUrl)) {
                try {
                    const resolved = resolveAndPreparePath(targetUrl);
                    if (fs.existsSync(resolved)) {
                        targetUrl = pathToFileURL(resolved).href;
                    }
                } catch { }
            }
            if (session.scopeRegex && !session.scopeRegex.test(targetUrl)) {
                log(`[SCOPE] BLOCKED: ${targetUrl} is out of scope.`);
                return "Blocked: URL is out of scope.";
            }
            log(`[NAV] Navigating to ${targetUrl}...`);
            await page.goto(targetUrl, {
                waitUntil: o.wait_until || 'domcontentloaded',
                timeout: o.timeout || 90000
            }).catch(e => log(`[NAV-ERR] ${e.message}`));
            return "";
        },

        getContent: async () => {
            return new Promise(async (resolve) => {
                let completed = false;
                const finish = (result, msg) => {
                    if (completed) return;
                    completed = true;
                    if (msg) log(msg);
                    resolve(result);
                };

                // Tier 1: JS Evaluate (5s)
                const t1Timeout = setTimeout(() => {
                    // Tier 2: CDP (5s)
                    const t2Timeout = setTimeout(() => {
                        // Tier 3: Native (10s)
                        const t3Timeout = setTimeout(() => {
                            finish("Error: All content extraction tiers timed out.", `[CONTENT-ERR] Tier 3 Timeout.`);
                        }, 10000);

                        page.content().then(res => {
                            clearTimeout(t3Timeout);
                            finish(res, `[CONTENT] Tier 3 (Native) Success.`);
                        }).catch(err => {
                            clearTimeout(t3Timeout);
                            finish(`Error: Native failed: ${err.message}`, `[CONTENT-ERR] Tier 3 Failed.`);
                        });
                    }, 5000);

                    (async () => {
                        try {
                            const client = await ctx.newCDPSession(page);
                            try {
                                const { root } = await client.send('DOM.getDocument', { depth: -1 });
                                const { outerHTML } = await client.send('DOM.getOuterHTML', { nodeId: root.nodeId });
                                clearTimeout(t2Timeout);
                                finish(outerHTML, `[CONTENT] Tier 2 (CDP) Success.`);
                            } finally {
                                await client.detach().catch(() => { });
                            }
                        } catch (err) {
                            clearTimeout(t2Timeout);
                        }
                    })();
                }, 5000);

                page.evaluate(() => {
                    const html = document.documentElement.outerHTML;
                    const doctype = document.doctype ? new XMLSerializer().serializeToString(document.doctype) : "";
                    return doctype + "\n" + html;
                }).then(res => {
                    clearTimeout(t1Timeout);
                    finish(res, `[CONTENT] Tier 1 (Evaluate) Success.`);
                }).catch(err => {
                    log(`[CONTENT-ERR] Tier 1 Error: ${err.message}`);
                });
            });
        },

        screenshot: async (name) => {
            const p = resolveAndPreparePath(name, ".png");
            try {
                await page.screenshot({ path: p, fullPage: false, timeout: 15000, animations: 'disabled' });
            } catch (e) {
                log(`[SCREENSHOT] Playwright screenshot failed (${e.message}), trying CDP fallback...`);
                let client = null;
                try {
                    client = await ctx.newCDPSession(page);
                    const { data } = await client.send('Page.captureScreenshot', { format: 'png' });
                    fs.writeFileSync(p, Buffer.from(data, 'base64'));
                } catch {
                    throw e;
                } finally {
                    if (client) await client.detach().catch(() => { });
                }
            }
            return p;
        },

        fullScreenshot: async (name) => {
            const p = resolveAndPreparePath(name, ".png");
            await page.screenshot({ path: p, fullPage: true, timeout: 60000, animations: 'disabled' });
            return p;
        },

        click: async (selector) => {
            await humanClick(page, selector);
        },

        type: async (selector, text) => {
            await humanType(page, selector, text);
        },

        evaluate: async (script) => {
            const res = await page.evaluate(script);
            return res !== undefined ? res : "undefined";
        },

        waitForSelector: async (selector, timeout) => {
            return await page.waitForSelector(cleanSelector(selector), { timeout: timeout || 30000 });
        },

        pressKey: async (key) => {
            await page.keyboard.press(key);
        },

        goBack: async () => {
            await page.goBack();
        },

        goForward: async () => {
            await page.goForward();
        },

        getUrl: async () => {
            return page.url();
        },

        getTitle: async () => {
            return await page.title();
        },

        getOrigin: async () => {
            return await page.evaluate(() => window.location.origin);
        },

        hover: async (selector) => {
            await page.hover(cleanSelector(selector));
        },

        selectOption: async (selector, value) => {
            const cleanS = cleanSelector(selector);
            return await page.selectOption(cleanS, value);
        },

        snapshot: async () => {
            if (page.accessibility && typeof page.accessibility.snapshot === 'function') {
                return await page.accessibility.snapshot();
            }
            const ariaSnapshot = await page.locator('body').ariaSnapshot().catch(() => null);
            if (ariaSnapshot) return { ariaSnapshot };
            return { error: "Accessibility API not available" };
        },

        savePdf: async (filePath) => {
            const resolved = resolveAndPreparePath(filePath, ".pdf");
            try {
                await page.pdf({ path: resolved });
                return resolved;
            } catch {
                // Firefox/Camoufox & headed Chromium do not support native page.pdf(); wrap full-page JPEG in PDF 1.4
                const jpegBuf = await page.screenshot({ type: 'jpeg', quality: 88, fullPage: true });
                const dims = await page.evaluate(() => ({
                    w: Math.max(1, document.documentElement.scrollWidth || window.innerWidth || 1280),
                    h: Math.max(1, document.documentElement.scrollHeight || window.innerHeight || 720)
                }));
                const ptW = Math.round(dims.w * 0.75);
                const ptH = Math.round(dims.h * 0.75);
                let imgW = dims.w, imgH = dims.h;
                for (let i = 0; i < jpegBuf.length - 9; i++) {
                    if (jpegBuf[i] === 0xFF && (jpegBuf[i + 1] === 0xC0 || jpegBuf[i + 1] === 0xC2)) {
                        imgH = jpegBuf.readUInt16BE(i + 5);
                        imgW = jpegBuf.readUInt16BE(i + 7);
                        break;
                    }
                }
                const contentStream = `q ${ptW} 0 0 ${ptH} 0 0 cm /Im0 Do Q`;
                const objs = [
                    `1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n`,
                    `2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n`,
                    `3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${ptW} ${ptH}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>\nendobj\n`,
                    null,
                    `5 0 obj\n<< /Length ${contentStream.length} >>\nstream\n${contentStream}\nendstream\nendobj\n`
                ];
                const chunks = [Buffer.from('%PDF-1.4\n', 'ascii')];
                const offsets = [0];
                let pos = chunks[0].length;
                for (let idx = 0; idx < 5; idx++) {
                    offsets.push(pos);
                    if (idx === 3) {
                        const head = Buffer.from(`4 0 obj\n<< /Type /XObject /Subtype /Image /Width ${imgW} /Height ${imgH} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpegBuf.length} >>\nstream\n`, 'ascii');
                        const tail = Buffer.from(`\nendstream\nendobj\n`, 'ascii');
                        chunks.push(head, jpegBuf, tail);
                        pos += head.length + jpegBuf.length + tail.length;
                    } else {
                        const b = Buffer.from(objs[idx], 'ascii');
                        chunks.push(b);
                        pos += b.length;
                    }
                }
                const xrefPos = pos;
                let xref = `xref\n0 6\n0000000000 65535 f \n`;
                for (let i = 1; i <= 5; i++) xref += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
                xref += `trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xrefPos}\n%%EOF\n`;
                chunks.push(Buffer.from(xref, 'ascii'));
                fs.writeFileSync(resolved, Buffer.concat(chunks));
                return resolved;
            }
        },

        findElements: async (selector) => {
            const locs = page.locator(cleanSelector(selector));
            const count = await locs.count();
            const res = [];
            for (let i = 0; i < Math.min(count, 50); i++) {
                res.push(await locs.nth(i).evaluate(el => ({
                    tagName: el.tagName.toLowerCase(),
                    text: el.innerText || el.textContent || "",
                    href: el.href || "",
                    value: el.value || "",
                    id: el.id || ""
                })));
            }
            return res;
        },

        reload: async () => {
            await page.reload({ waitUntil: "domcontentloaded" });
        },

        waitForNavigation: async (timeout) => {
            await page.waitForNavigation({ timeout: timeout || 30000 });
        },

        getDom: async (opts = {}) => {
            const depth = opts.depth != null ? opts.depth : 4;
            const pierce = opts.pierce !== false;
            try {
                const client = await ctx.newCDPSession(page);
                try {
                    if (opts.selector) {
                        const cleanS = cleanSelector(opts.selector);
                        const { root } = await client.send('DOM.getDocument', { depth: 0 });
                        const { nodeId } = await client.send('DOM.querySelector', { nodeId: root.nodeId, selector: cleanS });
                        if (!nodeId) return { error: `No element found for selector: ${cleanS}` };
                        const { node } = await client.send('DOM.describeNode', { nodeId, depth, pierce });
                        return node;
                    }
                    const { root } = await client.send('DOM.getDocument', { depth, pierce });
                    return root;
                } finally {
                    await client.detach().catch(() => { });
                }
            } catch {
                // Fallback for Firefox/Camoufox where CDP DOM domain is unavailable
                const cleanS = opts.selector ? cleanSelector(opts.selector) : null;
                return await page.evaluate(({ selector, maxDepth }) => {
                    const serialize = (el, d) => {
                        if (!el) return null;
                        if (el.nodeType === 3) {
                            const t = el.textContent.trim();
                            return t ? { nodeType: 3, nodeValue: t.slice(0, 200) } : null;
                        }
                        if (el.nodeType !== 1 && el.nodeType !== 9) return null;
                        const obj = {
                            nodeName: el.nodeName,
                            attributes: el.attributes ? Array.from(el.attributes).flatMap(a => [a.name, a.value]) : undefined
                        };
                        if (d < maxDepth && el.childNodes && el.childNodes.length > 0) {
                            const children = [];
                            for (const c of el.childNodes) {
                                const sc = serialize(c, d + 1);
                                if (sc) children.push(sc);
                            }
                            if (children.length > 0) obj.children = children;
                        }
                        return obj;
                    };
                    const root = selector ? document.querySelector(selector) : document.documentElement;
                    if (!root) return { error: `No element found for selector: ${selector}` };
                    return serialize(root, 0);
                }, { selector: cleanS, maxDepth: depth });
            }
        },

        saveHtmlDocument: async (filepath) => {
            const p = resolveAndPreparePath(filepath);
            const html = await page.content();
            fs.writeFileSync(p, html, 'utf8');
            return p;
        },

        getState: async () => {
            return {
                url: page.url(),
                title: await page.title(),
                readyState: await page.evaluate(() => document.readyState)
            };
        },

        getInputs: async () => {
            return await page.evaluate(() => {
                const inputs = Array.from(document.querySelectorAll('input, textarea, select'));
                return inputs.map(el => {
                    const id = el.id || '';
                    const name = el.name || '';
                    const type = el.type || el.tagName.toLowerCase();
                    const placeholder = el.getAttribute('placeholder') || '';
                    let labelText = '';
                    if (id) {
                        const label = document.querySelector(`label[for="${id}"]`);
                        if (label) labelText = label.innerText.trim();
                    }
                    if (!labelText) {
                        const parentLabel = el.closest('label');
                        if (parentLabel) labelText = parentLabel.innerText.trim();
                    }
                    let selector = '';
                    if (id) selector = `#${id}`;
                    else if (name) selector = `${el.tagName.toLowerCase()}[name="${name}"]`;
                    else {
                        selector = el.tagName.toLowerCase();
                        if (placeholder) selector += `[placeholder="${placeholder}"]`;
                    }
                    let options;
                    if (el.tagName.toLowerCase() === 'select') {
                        options = Array.from(el.options).map(o => ({ value: o.value, text: o.innerText.trim() }));
                    }
                    return { selector, type, name, placeholder, label: labelText, value: el.value || '', options };
                }).filter(item => !['hidden', 'submit', 'button', 'reset', 'image'].includes(item.type));
            });
        },

        setInputs: async (values) => {
            const entries = Array.isArray(values)
                ? values.filter(v => v && v.selector).map(v => [v.selector, v.value])
                : Object.entries(values || {});
            const results = [];
            for (const [selector, value] of entries) {
                const cleanS = cleanSelector(selector);
                try {
                    const locator = page.locator(cleanS).first();
                    const tagType = await locator.evaluate(el => ({
                        tag: el.tagName.toLowerCase(),
                        type: (el.getAttribute('type') || '').toLowerCase()
                    })).catch(() => ({ tag: 'input', type: 'text' }));

                    if (tagType.tag === 'select') {
                        await locator.selectOption(String(value));
                    } else if (tagType.tag === 'input' && (tagType.type === 'checkbox' || tagType.type === 'radio')) {
                        await locator.setChecked(Boolean(value));
                    } else {
                        await locator.focus({ timeout: 15000 });
                        await new Promise(r => setTimeout(r, 100 + Math.random() * 200));
                        await locator.fill('');
                        for (const char of String(value)) {
                            await page.keyboard.type(char, { delay: 40 + Math.random() * 100 });
                            if (char === ' ' || Math.random() < 0.1) {
                                await new Promise(r => setTimeout(r, 50 + Math.random() * 150));
                            }
                        }
                    }
                    results.push({ selector: cleanS, status: 'filled' });
                } catch (e) {
                    results.push({ selector: cleanS, status: 'error', message: e.message });
                }
            }
            return results;
        },

        search: async (query, isRegex = false, caseInsensitive = true) => {
            return await page.evaluate(({ query, isRegex, caseInsensitive }) => {
                const text = document.body.innerText;
                let regex;
                try {
                    if (isRegex) {
                        regex = new RegExp(query, caseInsensitive ? 'gi' : 'g');
                    } else {
                        const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                        regex = new RegExp(escaped, caseInsensitive ? 'gi' : 'g');
                    }
                } catch (e) {
                    return { error: `Invalid regex: ${e.message}` };
                }

                const matches = [];
                let match;
                while ((match = regex.exec(text)) !== null) {
                    const start = Math.max(0, match.index - 40);
                    const end = Math.min(text.length, match.index + match[0].length + 40);
                    matches.push({
                        index: match.index,
                        match: match[0],
                        context: `...${text.substring(start, end).trim()}...`
                    });
                    if (matches.length >= 50) break;
                }
                return matches;
            }, { query, isRegex, caseInsensitive });
        },

        solveCaptcha: async (timeout) => {
            return await solveCaptcha(page, timeout || 15000);
        }
    };
}
