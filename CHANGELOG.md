# Changelog

## [1.0.0] - 2026-11-26

### Added
- **Camoufox Engine**: Powered by Camoufox (anti-detect Firefox with C++ source-level stealth patches) for bypassing anti-bot firewalls and CAPTCHAs.
- **Streamlined Toolset (`CRYPSIS_TOOLSET`)**: Lean `core` preset (31 essential web automation & scraping tools) by default, plus `all` preset (60 tools) for advanced inspection and extension management.
- **Automated Captcha Solver (`crypsis_solve_captcha`)**: Detects Cloudflare Turnstile, Google reCAPTCHA v2, and hCaptcha iframes and performs humanized Bézier click-through.
- **Flexible Headless Mode**: Supports `CRYPSIS_HEADLESS=1` and `--headless` CLI flag for server/Docker deployments.
- **Cross-Platform PDF & ARIA Fallbacks**:
  - `crypsis_snapshot` falls back to `locator('body').ariaSnapshot()` on `playwright-core@1.59.1`.
  - `crypsis_pdf_save` falls back to pure-JS PDF 1.4 JPEG-XObject generation when `page.pdf()` is unsupported.
  - `crypsis_get_dom` falls back to DOM serialization when Chromium CDP is unavailable.
- **Resilient Form & File Handling**:
  - `crypsis_set_inputs` normalizes both object maps (`values`) and arrays (`inputs`), handling `<select>` and checkbox/radio inputs properly.
  - `crypsis_file_upload` resolves relative paths against the active workspace.
- **Hot-Reload Launcher**: `launcher.cjs` supports CLI flags (`--headless`, `--toolset=`, `--workspace=`) and automatic child reload on exit code `42`.
