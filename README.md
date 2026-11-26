# Crypsis MCP (v1.0.0)

A high-performance Model Context Protocol (MCP) server engineered specifically for **stealth web automation** and **web scraping**.

Crypsis allows AI agents (in Claude Desktop, Cursor, Antigravity, Windsurf, etc.) to browse the web, interact with dynamic interfaces, capture structured data, and scrape protected content just like a human user.

> **💡 Powered by Camoufox (Anti-Detect Firefox)**  
> Crypsis uses **[Camoufox](https://camoufox.com/)** as the underlying browser engine. By utilizing Firefox patched at the C++ source code level, Camoufox eliminates automation flags (`navigator.webdriver`, fingerprint leaks, WebGL/Audio/Canvas anomalies) and includes built-in humanization, so you don't have to worry about anti-bot **firewalls** (Cloudflare Turnstile, DataDome, Akamai) or **captchas** (Google reCAPTCHA, hCaptcha).

---

## 🚀 Key Features

- **Built for Web Automation & Scraping**: Purpose-built toolset for DOM querying, searching, interactive form-filling, screenshotting, and data extraction.
- **Firewall & Captcha Resilience**: Native Camoufox integration plus an automated `crypsis_solve_captcha` solver ensures zero-detection scraping without getting trapped in captcha loops.
- **Humanized Interaction**: Smooth Bézier-curve mouse movement with micro-overshoot and randomized keystroke typing latency.
- **Streamlined Tool Surface**: Exposes a lean, high-impact core set (~31 tools) by default to save AI context tokens, with an optional full preset for advanced tools.
- **Flexible Headless Mode**: Headed by default for desktop stealth, with full headless support (`CRYPSIS_HEADLESS=1` or `--headless`) for Linux VPS, CI/CD, and Docker servers.
- **Layered Workspace Alignment**:
  - **Zero Host Pollution**: All outputs (screenshots, logs, PDFs, HARs, HTML files) are saved precisely in the active client workspace.
  - Automatically resolves save directories via: `CRYPSIS_WORKSPACE` ➔ `WORKSPACE_ROOT` ➔ `MIME_WORKSPACE` ➔ `process.cwd()`.
- **Traffic & Request Inspection**:
  - Built-in stealth network logging (HAR export, XHR/Fetch payload inspection and in-browser replaying) with zero external proxy dependencies.

---

## 🛠️ Installation

1. Clone this repository and install dependencies:
   ```bash
   npm install
   ```
2. On first run (or via `npx camoufox fetch`), Camoufox will automatically download its patched Firefox binary.

---

## 📖 Usage & MCP Configuration

### 1. Launch via MCP Host
Configure Crypsis in your MCP client settings (e.g. `claude_desktop_config.json`, Cursor, or Antigravity):

```json
{
  "mcpServers": {
    "crypsis": {
      "command": "node",
      "args": ["/path/to/crypsis-mcp/launcher.cjs"],
      "env": {
        "CRYPSIS_WORKSPACE": "/path/to/your/workspace",
        "CRYPSIS_TOOLSET": "core",
        "CRYPSIS_HEADLESS": "0"
      }
    }
  }
}
```

### 2. Manual Terminal Launch
You can also launch the bridge directly in stdio mode:
```bash
# Core scraping tools (default)
node launcher.cjs

# Headless mode for servers/Docker
node launcher.cjs --headless

# Full toolset (all advanced & reverse-engineering tools)
node launcher.cjs --toolset=all
```

---

## 🧰 Featured Web Automation & Scraping Tools

| Tool | Purpose |
| :--- | :--- |
| **`crypsis_navigate`** | Navigate to any web URL with stealth headers and auto-wait. |
| **`crypsis_solve_captcha`** | Automatically detect and solve Cloudflare Turnstile, Google reCAPTCHA v2, and hCaptcha. |
| **`crypsis_search`** | Search page text or Regex patterns with surrounding context snippets. |
| **`crypsis_get_inputs`** | Map all interactive form fields (`input`, `textarea`, `select`, dropdown options). |
| **`crypsis_set_inputs`** | Batch fill form fields with randomized human-like typing latency. |
| **`crypsis_get_dom`** | Extract deep structured DOM trees (automatically falls back to DOM serialization in Firefox/Camoufox). |
| **`crypsis_snapshot`** | Extract clean accessibility trees for fast semantic data extraction. |
| **`crypsis_save_html_document`** | Dump the fully rendered page HTML markup to disk. |
| **`crypsis_full_screenshot`** | High-fidelity full-page visual audits and page captures. |
| **`crypsis_xhr_get` / `xhr_edit_send`** | Inspect or replay background API/Fetch requests directly inside page context. |
| **`crypsis_get_state`** | Retrieve URL, Title, and `readyState` without visual overhead. |
| **`crypsis_cookies_get` / `cookies_set`** | Retrieve or restore browser session cookies. |
| **`crypsis_export_har`** | Export captured traffic as standard HAR 1.2 file. |

---

## ⚙️ Configuration Variables

| Variable | CLI Flag | Description | Default |
| :--- | :--- | :--- | :--- |
| `CRYPSIS_TOOLSET` | `--toolset=core\|all` | Tool density preset (`core` for lean scraping, `all` for full suite) | `core` |
| `CRYPSIS_HEADLESS` | `--headless` | Run in headless mode without a visible window | `0` |
| `CRYPSIS_WORKSPACE` | `--workspace=<path>` | Base directory where screenshots, logs, and exports are saved | Current directory |
| `CRYPSIS_PROFILE_DIR` | — | Custom directory for the persistent Camoufox browser profile | `./camoufox_profile` |
| `CRYPSIS_PROXY_SERVER` | — | Optional upstream proxy (e.g. `http://user:pass@host:port`) | `direct` |

---

## 🔒 Security & Performance

- **Source-Level Stealth**: Camoufox patches Firefox at the C++ level, avoiding detectable JS injection fingerprints.
- **Isolated User Profiles**: Stores runtime data and cookies internally, avoiding pollution of the host machine's default browser profile.
- **Output Sanitization**: Centralized response formatting prevents agent context crashes on oversized HTML pages (truncated safely at 100k characters).
- **Telemetry**: Real-time diagnostic logging maintained in `crypsis.log`.
