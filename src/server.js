import net from "net";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { defaultSession } from "./session.js";
import { getEngine, getProxyConfig, checkProxyListener } from "./browser.js";
import { getToolsList } from "./tools/definitions.js";
import { log, formatResponse } from "./utils/logger.js";

export function createServer() {
    const server = new Server(
        { name: "crypsis-mcp", version: "1.0.0" },
        { capabilities: { tools: {} } }
    );

    server.setRequestHandler(ListToolsRequestSchema, async () => {
        const tools = getToolsList(process.env.CRYPSIS_TOOLSET || "core");
        return { tools };
    });

    server.setRequestHandler(CallToolRequestSchema, async (req) => {
        const { name, arguments: args = {} } = req.params;
        log(`[CALL] ${name}`);

        try {
            // Direct proxy & restart management
            if (name === "crypsis_set_proxy") {
                let srv = args.server;
                if (args.enabled === false) srv = "direct";
                else if (!srv) srv = "direct";

                defaultSession.proxyOverride = srv;
                const status = await checkProxyListener(srv);
                return formatResponse({
                    enabled: !/^(direct|none|off)$/i.test(srv),
                    proxy: getProxyConfig(defaultSession) || "DIRECT",
                    status,
                    restartRequired: !!defaultSession.activeBrowser
                }, !status.ok && !/^(direct|none|off)$/i.test(srv));
            }

            if (name === "crypsis_restart") {
                if (defaultSession.activeBrowser) await defaultSession.activeBrowser.close().catch(() => { });
                else if (defaultSession.activeContext) await defaultSession.activeContext.close().catch(() => { });
                defaultSession.activeBrowser = null;
                defaultSession.activeContext = null;
                log(`[SERVER] Browser internals reset. Exiting with code 42 for launcher reload.`);
                setTimeout(() => process.exit(42), 150);
                return formatResponse("Browser restarted and server process reloading.");
            }

            const engine = await getEngine(defaultSession);

            switch (name) {
                // Core Navigation & State
                case "crypsis_navigate":
                case "browser_navigate": {
                    const navRes = await engine.navigate(args.url, args);
                    return formatResponse(navRes ? `Navigation issue: ${navRes}` : "Navigated.", !!navRes);
                }
                case "crypsis_get_state":
                    return formatResponse(await engine.getState());
                case "crypsis_reload":
                    await engine.reload();
                    return formatResponse("Reloaded.");
                case "crypsis_go_back":
                    await engine.goBack();
                    return formatResponse("Navigated back.");
                case "crypsis_go_forward":
                    await engine.goForward();
                    return formatResponse("Navigated forward.");
                case "crypsis_wait_for_navigation":
                    await engine.waitForNavigation(args.timeout);
                    return formatResponse("Navigation complete.");
                case "crypsis_wait_for_selector":
                    await engine.waitForSelector(args.selector, args.timeout);
                    return formatResponse("Element found.");

                // Scraping & Data Extraction
                case "crypsis_get_content":
                case "browser_get_content":
                    return formatResponse(await engine.getContent());
                case "crypsis_get_dom":
                    return formatResponse(await engine.getDom(args));
                case "crypsis_snapshot":
                    return formatResponse(await engine.snapshot());
                case "crypsis_search":
                case "browser_search":
                    return formatResponse(await engine.search(args.query, args.isRegex, args.caseInsensitive));
                case "crypsis_find_elements":
                    return formatResponse(await engine.findElements(args.selector));
                case "crypsis_screenshot":
                case "browser_take_screenshot":
                    return formatResponse("Screenshot saved to: " + (await engine.screenshot(args.name)));
                case "crypsis_full_screenshot":
                    return formatResponse("Full screenshot saved to: " + (await engine.fullScreenshot(args.name)));
                case "crypsis_save_html_document":
                    return formatResponse("HTML document saved to: " + (await engine.saveHtmlDocument(args.filepath)));
                case "crypsis_pdf_save":
                    return formatResponse("PDF saved to: " + (await engine.savePdf(args.path)));

                // Humanized Interactions
                case "crypsis_click":
                case "browser_click":
                    await engine.click(args.selector);
                    return formatResponse("Clicked.");
                case "crypsis_type":
                case "browser_fill_form":
                    await engine.type(args.selector, args.text);
                    return formatResponse("Typed.");
                case "crypsis_get_inputs":
                case "browser_get_inputs":
                    return formatResponse(await engine.getInputs());
                case "crypsis_set_inputs":
                case "browser_set_inputs":
                    return formatResponse(await engine.setInputs(args.values ?? args.inputs));
                case "crypsis_select_option":
                    return formatResponse(await engine.selectOption(args.selector, args.value));
                case "crypsis_hover":
                    await engine.hover(args.selector);
                    return formatResponse("Hovered.");
                case "crypsis_press_key":
                    await engine.pressKey(args.key);
                    return formatResponse(`Pressed key: ${args.key}`);
                case "crypsis_evaluate":
                    return formatResponse(await engine.evaluate(args.script));

                // Captcha Solver
                case "crypsis_solve_captcha":
                    return formatResponse(await engine.solveCaptcha(args.timeout));

                // Network & Session
                case "crypsis_xhr_get":
                    return formatResponse(await engine.xhrGet(args.requestId));
                case "crypsis_xhr_edit_send":
                    return formatResponse(await engine.xhrEditSend(args));
                case "crypsis_cookies_get":
                    return formatResponse(await engine.getCookies(args.urls));
                case "crypsis_cookies_set":
                    await engine.setCookies(args.cookies);
                    return formatResponse("Cookies set.");
                case "crypsis_cookies_clear":
                    await engine.clearCookies();
                    return formatResponse("Cookies cleared.");
                case "crypsis_export_har":
                    return formatResponse("HAR exported to: " + (await engine.exportHar(args.filename)));
                case "crypsis_get_request_logs": {
                    let logs = await engine.getRequestLogs();
                    if (args.filter) {
                        const r = new RegExp(args.filter, 'i');
                        logs = logs.filter(l => r.test(l.url));
                    }
                    const offset = args.offset || 0;
                    const limit = args.limit || 50;
                    return formatResponse({ total: logs.length, returned: logs.slice(offset, offset + limit).length, logs: logs.slice(offset, offset + limit) });
                }
                case "crypsis_clear_request_logs":
                    await engine.clearRequestLogs();
                    return formatResponse("Logs cleared.");
                case "crypsis_save_request_logs":
                    return formatResponse("Saved logs to: " + (await engine.saveRequestLogs(args.filename)));
                case "crypsis_set_headers":
                    await engine.setHeaders(args.headers);
                    return formatResponse("Headers updated.");
                case "crypsis_set_scope":
                    await engine.setScopeOptions(args.regex, args.blockRequests);
                    return formatResponse("Scope set.");
                case "crypsis_network_replay":
                    return formatResponse(await engine.networkReplay(args.requestId, args.overrides));
                case "crypsis_set_capture_mode":
                    return formatResponse(await engine.setCaptureMode(args.enabled, args.includeResponseBodies));

                // Advanced & Reverse Engineering
                case "crypsis_open_file":
                    return formatResponse(await engine.openFile(args.filepath));
                case "crypsis_load_file":
                    return formatResponse(await engine.loadFile(args.filepath, args.selector));
                case "crypsis_debug_js":
                    return formatResponse(await engine.debugJs(args.action, args));
                case "crypsis_tab_list":
                    return formatResponse(await engine.tabList());
                case "crypsis_new_tab":
                    await engine.newTab(args.url);
                    return formatResponse("Opened tab.");
                case "crypsis_switch_tab":
                    await engine.switchTab(args.index);
                    return formatResponse("Switched tab.");
                case "crypsis_close_tab":
                    await engine.closeTab(args.index);
                    return formatResponse("Closed tab.");
                case "crypsis_resize":
                    await engine.resize(args.width, args.height);
                    return formatResponse("Resized.");
                case "crypsis_mouse_click_xy":
                    await engine.mouseClickXY(args.x, args.y);
                    return formatResponse("Clicked XY.");
                case "crypsis_mouse_move_xy":
                    await engine.mouseMoveXY(args.x, args.y);
                    return formatResponse("Moved XY.");
                case "crypsis_drag":
                    await engine.drag(args.source, args.target);
                    return formatResponse("Dragged element.");
                case "crypsis_verify_element_visible":
                    return formatResponse((await engine.verifyElementVisible(args.selector)) ? "Visible" : "Not Visible");
                case "crypsis_file_upload":
                    await engine.fileUpload(args.selector, args.path);
                    return formatResponse("File uploaded.");
                case "crypsis_get_console_logs": {
                    const logs = await engine.getConsoleLogs();
                    return formatResponse({ total: logs.length, logs });
                }
                case "crypsis_clear_console_logs":
                    await engine.clearConsoleLogs();
                    return formatResponse("Console logs cleared.");
                case "crypsis_get_layers":
                    return formatResponse(await engine.getLayers(args));
                case "crypsis_verify_layer_visibility":
                    return formatResponse(await engine.verifyLayerVisibility(args.selector));
                case "crypsis_extension_install":
                    return formatResponse(await engine.extensionInstall(args.path));
                case "crypsis_extension_uninstall":
                    return formatResponse(await engine.extensionUninstall(args.pathOrId));
                case "crypsis_extension_list":
                case "crypsis_extension_list_installed":
                    return formatResponse(await engine.extensionList());

                default:
                    throw new Error(`Tool ${name} not recognized.`);
            }
        } catch (err) {
            log(`[ERROR] ${name}: ${err.message}`);
            return formatResponse({ error: err.message }, true);
        }
    });

    return server;
}

export async function startServer() {
    const server = createServer();
    const TCP_PORT = process.env.CRYPSIS_TCP_PORT ? parseInt(process.env.CRYPSIS_TCP_PORT, 10) : null;

    if (TCP_PORT) {
        const tcpServer = net.createServer((socket) => {
            log(`[TCP] Client connected on port ${TCP_PORT}`);
            const transport = {
                start: async () => {
                    let buffer = "";
                    socket.on('data', (chunk) => {
                        buffer += chunk.toString();
                        const lines = buffer.split('\n');
                        buffer = lines.pop();
                        for (const line of lines) {
                            if (line.trim()) {
                                try {
                                    const parsed = JSON.parse(line);
                                    if (transport.onmessage) transport.onmessage(parsed);
                                } catch (e) {
                                    log(`[TCP] Parse error: ${e.message}`);
                                }
                            }
                        }
                    });
                    socket.on('close', () => transport.onclose?.());
                    socket.on('error', (err) => transport.onerror?.(err));
                },
                onclose: undefined,
                onerror: undefined,
                onmessage: undefined,
                send: async (msg) => {
                    socket.write(JSON.stringify(msg) + '\n');
                },
                close: async () => socket.destroy()
            };
            server.connect(transport).catch(err => log(`[TCP] Connect error: ${err.message}`));
        });
        tcpServer.listen(TCP_PORT, '127.0.0.1', () => {
            log(`[TCP] Bridge listening on 127.0.0.1:${TCP_PORT}`);
        });
    } else {
        const transport = new StdioServerTransport();
        await server.connect(transport);
        const count = getToolsList(process.env.CRYPSIS_TOOLSET || "core").length;
        log(`READY WITH ${count} TOOLS (${(process.env.CRYPSIS_TOOLSET || "core").toUpperCase()} MODE - STDIO).`);
    }
}
