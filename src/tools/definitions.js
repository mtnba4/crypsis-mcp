export const CORE_TOOLS = [
    {
        name: "crypsis_navigate",
        description: "Navigate to a URL with stealth headers and auto-wait",
        inputSchema: {
            type: "object",
            properties: {
                url: { type: "string", description: "Target URL or local file path" },
                wait_until: { type: "string", enum: ["load", "domcontentloaded", "networkidle", "commit"], description: "Wait condition" },
                timeout: { type: "number", description: "Navigation timeout in ms" }
            },
            required: ["url"]
        }
    },
    {
        name: "crypsis_get_state",
        description: "Get current page state (URL, title, readyState)",
        inputSchema: { type: "object", properties: {} }
    },
    {
        name: "crypsis_get_content",
        description: "Get page HTML content using resilient multi-tier fallback (Evaluate -> CDP -> Native)",
        inputSchema: { type: "object", properties: {} }
    },
    {
        name: "crypsis_get_dom",
        description: "Get structured DOM tree via CDP. Returns nodeId, nodeName, attributes, children. Supports shadow DOM piercing.",
        inputSchema: {
            type: "object",
            properties: {
                selector: { type: "string", description: "Optional CSS selector to target a specific element" },
                depth: { type: "number", description: "Tree depth to return (default 4, use -1 for full tree)" },
                pierce: { type: "boolean", description: "Pierce shadow DOM boundaries (default true)" }
            }
        }
    },
    {
        name: "crypsis_snapshot",
        description: "Get page accessibility snapshot for semantic text and structure extraction",
        inputSchema: { type: "object", properties: {} }
    },
    {
        name: "crypsis_search",
        description: "Search page content with surrounding context snippets (string or Regex)",
        inputSchema: {
            type: "object",
            properties: {
                query: { type: "string", description: "Search query or regex string" },
                isRegex: { type: "boolean", description: "Treat query as regex (default false)" },
                caseInsensitive: { type: "boolean", description: "Case-insensitive search (default true)" }
            },
            required: ["query"]
        }
    },
    {
        name: "crypsis_find_elements",
        description: "Find matching elements and their basic attributes",
        inputSchema: {
            type: "object",
            properties: { selector: { type: "string" } },
            required: ["selector"]
        }
    },
    {
        name: "crypsis_screenshot",
        description: "Take a viewport screenshot (saved safely to active workspace)",
        inputSchema: {
            type: "object",
            properties: { name: { type: "string", description: "Target filename or path (e.g. screenshot.png)" } },
            required: ["name"]
        }
    },
    {
        name: "crypsis_full_screenshot",
        description: "Take a full page screenshot",
        inputSchema: {
            type: "object",
            properties: { name: { type: "string", description: "Target filename or path (e.g. full.png)" } },
            required: ["name"]
        }
    },
    {
        name: "crypsis_save_html_document",
        description: "Save the current webpage HTML markup to a document file on disk",
        inputSchema: {
            type: "object",
            properties: { filepath: { type: "string", description: "Path or filename to save HTML markup to" } },
            required: ["filepath"]
        }
    },
    {
        name: "crypsis_pdf_save",
        description: "Save current page as a PDF file",
        inputSchema: {
            type: "object",
            properties: { path: { type: "string", description: "Path or filename for the PDF" } },
            required: ["path"]
        }
    },
    {
        name: "crypsis_click",
        description: "Click an element using humanized Bézier-curve mouse motion, micro-overshoot, and settle latency",
        inputSchema: {
            type: "object",
            properties: { selector: { type: "string", description: "Target CSS selector" } },
            required: ["selector"]
        }
    },
    {
        name: "crypsis_type",
        description: "Type text into an input with per-character human latency jitter and occasional realistic typos",
        inputSchema: {
            type: "object",
            properties: {
                selector: { type: "string", description: "Target CSS selector" },
                text: { type: "string", description: "Text string to type" }
            },
            required: ["selector", "text"]
        }
    },
    {
        name: "crypsis_get_inputs",
        description: "Get all interactive form fields on the page (IDs, names, types, labels, dropdown options)",
        inputSchema: { type: "object", properties: {} }
    },
    {
        name: "crypsis_set_inputs",
        description: "Batch fill multiple interactive form fields in a single stealthy interaction",
        inputSchema: {
            type: "object",
            properties: {
                values: {
                    type: "object",
                    description: "Key-value map of { selector: text_to_fill }",
                    additionalProperties: { type: "string" }
                }
            },
            required: ["values"]
        }
    },
    {
        name: "crypsis_select_option",
        description: "Select an option in a dropdown element",
        inputSchema: {
            type: "object",
            properties: {
                selector: { type: "string" },
                value: { type: "string" }
            },
            required: ["selector", "value"]
        }
    },
    {
        name: "crypsis_hover",
        description: "Hover over an element",
        inputSchema: {
            type: "object",
            properties: { selector: { type: "string" } },
            required: ["selector"]
        }
    },
    {
        name: "crypsis_press_key",
        description: "Press a keyboard key (e.g. 'Enter', 'Tab', 'Escape')",
        inputSchema: {
            type: "object",
            properties: { key: { type: "string" } },
            required: ["key"]
        }
    },
    {
        name: "crypsis_evaluate",
        description: "Evaluate custom JavaScript in the browser page context",
        inputSchema: {
            type: "object",
            properties: { script: { type: "string", description: "JavaScript expression to evaluate" } },
            required: ["script"]
        }
    },
    {
        name: "crypsis_wait_for_selector",
        description: "Wait for an element to appear in the DOM",
        inputSchema: {
            type: "object",
            properties: {
                selector: { type: "string" },
                timeout: { type: "number", description: "Timeout in ms" }
            },
            required: ["selector"]
        }
    },
    {
        name: "crypsis_wait_for_navigation",
        description: "Wait for page navigation to complete",
        inputSchema: {
            type: "object",
            properties: { timeout: { type: "number" } }
        }
    },
    {
        name: "crypsis_reload",
        description: "Reload the current page",
        inputSchema: { type: "object", properties: {} }
    },
    {
        name: "crypsis_go_back",
        description: "Navigate backward in browser history",
        inputSchema: { type: "object", properties: {} }
    },
    {
        name: "crypsis_go_forward",
        description: "Navigate forward in browser history",
        inputSchema: { type: "object", properties: {} }
    },
    {
        name: "crypsis_solve_captcha",
        description: "Automatically detect and solve interactive CAPTCHAs and Turnstiles (Cloudflare Turnstile, Google reCAPTCHA v2, hCaptcha) using humanized Bézier mouse curves and verification check-through.",
        inputSchema: {
            type: "object",
            properties: {
                timeout: { type: "number", description: "Optional verification timeout in milliseconds (default: 15000)" }
            }
        }
    },
    {
        name: "crypsis_xhr_get",
        description: "Inspect complete raw details of any captured XHR/Fetch request and response pair by requestId",
        inputSchema: {
            type: "object",
            properties: { requestId: { type: "string", description: "The ID of the captured request" } },
            required: ["requestId"]
        }
    },
    {
        name: "crypsis_xhr_edit_send",
        description: "Edit method, URL, headers, or body payload of any captured or new XHR/Fetch request and resend it in-browser",
        inputSchema: {
            type: "object",
            properties: {
                requestId: { type: "string", description: "Optional request ID to base edits upon" },
                url: { type: "string", description: "Target URL" },
                method: { type: "string", description: "HTTP method (GET, POST, etc.)" },
                headers: { type: "object", description: "Headers object" },
                body: { type: "string", description: "Payload string or JSON" },
                inBrowserContext: { type: "boolean", description: "Execute inside active page context to preserve credentials (default true)" }
            }
        }
    },
    {
        name: "crypsis_cookies_get",
        description: "Get all cookies from browser context",
        inputSchema: {
            type: "object",
            properties: { urls: { type: "array", items: { type: "string" } } }
        }
    },
    {
        name: "crypsis_cookies_set",
        description: "Set session cookies",
        inputSchema: {
            type: "object",
            properties: { cookies: { type: "array", items: { type: "object" } } },
            required: ["cookies"]
        }
    },
    {
        name: "crypsis_cookies_clear",
        description: "Clear all cookies",
        inputSchema: { type: "object", properties: {} }
    },
    {
        name: "crypsis_export_har",
        description: "Export captured traffic as a HAR 1.2 file",
        inputSchema: {
            type: "object",
            properties: { filename: { type: "string", description: "HAR filename to write" } },
            required: ["filename"]
        }
    }
];

export const ADVANCED_TOOLS = [
    {
        name: "crypsis_open_file",
        description: "Open a local file in the browser using file:// protocol",
        inputSchema: {
            type: "object",
            properties: { filepath: { type: "string" } },
            required: ["filepath"]
        }
    },
    {
        name: "crypsis_load_file",
        description: "Load or upload a local file into a target DOM input element or page context",
        inputSchema: {
            type: "object",
            properties: {
                filepath: { type: "string" },
                selector: { type: "string" }
            },
            required: ["filepath"]
        }
    },
    {
        name: "crypsis_debug_js",
        description: "Live debug website JavaScript files via CDP Debugger (list scripts, set/remove breakpoints, step, evaluate call frames, hot patch)",
        inputSchema: {
            type: "object",
            properties: {
                action: {
                    type: "string",
                    enum: ["list_scripts", "get_script_source", "set_breakpoint", "remove_breakpoint", "pause", "resume", "step_over", "step_into", "step_out", "evaluate_on_call_frame", "override_script", "hot_patch"]
                },
                scriptId: { type: "string" },
                url: { type: "string" },
                lineNumber: { type: "number" },
                columnNumber: { type: "number" },
                condition: { type: "string" },
                breakpointId: { type: "string" },
                callFrameId: { type: "string" },
                expression: { type: "string" },
                scriptSource: { type: "string" }
            },
            required: ["action"]
        }
    },
    {
        name: "crypsis_tab_list",
        description: "List all open browser tabs",
        inputSchema: { type: "object", properties: {} }
    },
    {
        name: "crypsis_new_tab",
        description: "Open a new browser tab",
        inputSchema: {
            type: "object",
            properties: { url: { type: "string" } }
        }
    },
    {
        name: "crypsis_switch_tab",
        description: "Switch to an existing tab by index",
        inputSchema: {
            type: "object",
            properties: { index: { type: "number" } },
            required: ["index"]
        }
    },
    {
        name: "crypsis_close_tab",
        description: "Close a tab by index",
        inputSchema: {
            type: "object",
            properties: { index: { type: "number" } }
        }
    },
    {
        name: "crypsis_resize",
        description: "Resize the browser viewport dimensions",
        inputSchema: {
            type: "object",
            properties: { width: { type: "number" }, height: { type: "number" } },
            required: ["width", "height"]
        }
    },
    {
        name: "crypsis_mouse_click_xy",
        description: "Move mouse and click at precise coordinates with humanized easing",
        inputSchema: {
            type: "object",
            properties: { x: { type: "number" }, y: { type: "number" } },
            required: ["x", "y"]
        }
    },
    {
        name: "crypsis_mouse_move_xy",
        description: "Move mouse cursor to coordinates with randomized easing steps",
        inputSchema: {
            type: "object",
            properties: { x: { type: "number" }, y: { type: "number" } },
            required: ["x", "y"]
        }
    },
    {
        name: "crypsis_drag",
        description: "Drag an element to a target element",
        inputSchema: {
            type: "object",
            properties: { source: { type: "string" }, target: { type: "string" } },
            required: ["source", "target"]
        }
    },
    {
        name: "crypsis_verify_element_visible",
        description: "Check if an element is visible in the viewport",
        inputSchema: {
            type: "object",
            properties: { selector: { type: "string" } },
            required: ["selector"]
        }
    },
    {
        name: "crypsis_file_upload",
        description: "Upload a file into an input[type='file'] element",
        inputSchema: {
            type: "object",
            properties: { selector: { type: "string" }, path: { type: "string" } },
            required: ["selector", "path"]
        }
    },
    {
        name: "crypsis_get_console_logs",
        description: "Get captured browser console messages",
        inputSchema: { type: "object", properties: {} }
    },
    {
        name: "crypsis_clear_console_logs",
        description: "Clear captured console logs",
        inputSchema: { type: "object", properties: {} }
    },
    {
        name: "crypsis_get_request_logs",
        description: "Get captured HTTP request/response logs",
        inputSchema: {
            type: "object",
            properties: { filter: { type: "string" }, limit: { type: "number" }, offset: { type: "number" } }
        }
    },
    {
        name: "crypsis_clear_request_logs",
        description: "Clear captured request logs",
        inputSchema: { type: "object", properties: {} }
    },
    {
        name: "crypsis_save_request_logs",
        description: "Save captured request logs to a file",
        inputSchema: {
            type: "object",
            properties: { filename: { type: "string" } },
            required: ["filename"]
        }
    },
    {
        name: "crypsis_set_headers",
        description: "Set global extra HTTP headers for all subsequent requests",
        inputSchema: {
            type: "object",
            properties: { headers: { type: "object", additionalProperties: { type: "string" } } },
            required: ["headers"]
        }
    },
    {
        name: "crypsis_set_scope",
        description: "Set regex scope for allowed navigations",
        inputSchema: {
            type: "object",
            properties: { regex: { type: "string" }, blockRequests: { type: "boolean" } }
        }
    },
    {
        name: "crypsis_network_replay",
        description: "Replay a logged request with optional header or body overrides",
        inputSchema: {
            type: "object",
            properties: {
                requestId: { type: "string" },
                overrides: { type: "object", properties: { method: { type: "string" }, headers: { type: "object" }, body: { type: "string" } } }
            },
            required: ["requestId"]
        }
    },
    {
        name: "crypsis_set_capture_mode",
        description: "Toggle capture mode and response body recording",
        inputSchema: {
            type: "object",
            properties: { enabled: { type: "boolean" }, includeResponseBodies: { type: "boolean" } },
            required: ["enabled"]
        }
    },
    {
        name: "crypsis_set_proxy",
        description: "Enable or disable proxy or set a custom proxy server. Requires browser restart to apply if active.",
        inputSchema: {
            type: "object",
            properties: {
                enabled: { type: "boolean", description: "Set to false to disable proxy (direct mode)." },
                server: { type: "string", description: "Proxy server URL, e.g. http://host:port or direct" }
            }
        }
    },
    {
        name: "crypsis_restart",
        description: "Restart the browser engine",
        inputSchema: { type: "object", properties: {} }
    },
    {
        name: "crypsis_get_layers",
        description: "Audit visual UI layers, modals, popups, and sticky headers",
        inputSchema: {
            type: "object",
            properties: { selector: { type: "string" }, onlyInteractive: { type: "boolean" } }
        }
    },
    {
        name: "crypsis_verify_layer_visibility",
        description: "Verify if elements are occluded by other visual layers",
        inputSchema: {
            type: "object",
            properties: { selector: { type: "string" } },
            required: ["selector"]
        }
    },
    {
        name: "crypsis_extension_install",
        description: "Install a browser extension from folder, zip, or crx",
        inputSchema: {
            type: "object",
            properties: { path: { type: "string" } },
            required: ["path"]
        }
    },
    {
        name: "crypsis_extension_uninstall",
        description: "Uninstall an extension",
        inputSchema: {
            type: "object",
            properties: { pathOrId: { type: "string" } },
            required: ["pathOrId"]
        }
    },
    {
        name: "crypsis_extension_list",
        description: "List installed and active extensions",
        inputSchema: { type: "object", properties: {} }
    }
];

export function getToolsList(toolset = process.env.CRYPSIS_TOOLSET || "core") {
    const mode = String(toolset).toLowerCase();
    if (mode === "all" || mode === "full" || mode === "debug") {
        return [...CORE_TOOLS, ...ADVANCED_TOOLS];
    }
    return CORE_TOOLS;
}
