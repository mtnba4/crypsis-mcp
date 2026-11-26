import { humanClickXY } from "./human.js";
import { log } from "./utils/logger.js";

/**
 * Automatically inspects the page for interactive CAPTCHA / Turnstile challenges
 * (Cloudflare Turnstile, Google reCAPTCHA v2, hCaptcha) and attempts humanized click-through.
 */
export async function solveCaptcha(page, timeoutMs = 15000) {
    const startTime = Date.now();
    log(`[CAPTCHA-SOLVER] Scanning page for interactive captcha challenges...`);

    // Helper: wait small interval
    const sleep = (ms) => new Promise(r => setTimeout(r, ms));

    // 1. Check for Cloudflare Turnstile
    try {
        const turnstileFrames = page.frames().filter(f => {
            const url = f.url() || "";
            return url.includes("challenges.cloudflare.com") || url.includes("turnstile");
        });

        if (turnstileFrames.length > 0) {
            log(`[CAPTCHA-SOLVER] Detected ${turnstileFrames.length} Cloudflare Turnstile frame(s).`);
            for (const frame of turnstileFrames) {
                try {
                    // Try to find the checkbox element in the frame
                    const checkboxSelectors = [
                        'input[type="checkbox"]',
                        '#challenge-stage input',
                        'span.mark',
                        'div.ctp-checkbox-label',
                        'div[role="checkbox"]',
                        'body'
                    ];

                    let targetSelector = null;
                    for (const sel of checkboxSelectors) {
                        const count = await frame.locator(sel).count();
                        if (count > 0) {
                            targetSelector = sel;
                            break;
                        }
                    }

                    if (targetSelector) {
                        const frameElement = await frame.frameElement();
                        const frameBox = await frameElement.boundingBox();
                        if (frameBox) {
                            // Turnstile checkbox is typically near the left-center of the iframe widget
                            const clickX = frameBox.x + Math.min(30, frameBox.width * 0.15) + (Math.random() * 8);
                            const clickY = frameBox.y + (frameBox.height / 2) + (Math.random() * 4 - 2);

                            log(`[CAPTCHA-SOLVER] Clicking Cloudflare Turnstile at (${Math.round(clickX)}, ${Math.round(clickY)})...`);
                            await humanClickXY(page, clickX, clickY);

                            // Wait for verification to complete
                            const waitStart = Date.now();
                            while (Date.now() - waitStart < 8000) {
                                await sleep(500);
                                const isSuccess = await frame.locator('input[type="checkbox"][aria-checked="true"], .success, .cb-lb').count()
                                    .catch(() => 0);
                                const isDetached = await frameElement.isVisible().then(v => !v).catch(() => true);
                                if (isSuccess > 0 || isDetached) {
                                    return {
                                        solved: true,
                                        type: "cloudflare_turnstile",
                                        message: "Cloudflare Turnstile challenge verified successfully."
                                    };
                                }
                            }
                            return {
                                solved: true,
                                type: "cloudflare_turnstile",
                                message: "Clicked Cloudflare Turnstile checkbox. Verification submitted."
                            };
                        }
                    }
                } catch (e) {
                    log(`[CAPTCHA-SOLVER-WARN] Turnstile frame attempt error: ${e.message}`);
                }
            }
        }
    } catch (e) {
        log(`[CAPTCHA-SOLVER-ERR] Cloudflare check error: ${e.message}`);
    }

    // 2. Check for Google reCAPTCHA v2
    try {
        const recaptchaFrames = page.frames().filter(f => (f.url() || "").includes("google.com/recaptcha/api2/anchor"));
        if (recaptchaFrames.length > 0) {
            log(`[CAPTCHA-SOLVER] Detected Google reCAPTCHA anchor frame.`);
            const frame = recaptchaFrames[0];
            const checkbox = frame.locator('#recaptcha-anchor, .recaptcha-checkbox').first();
            if (await checkbox.count() > 0) {
                const frameElement = await frame.frameElement();
                const frameBox = await frameElement.boundingBox();
                const box = await checkbox.boundingBox();
                if (frameBox && box) {
                    const clickX = frameBox.x + box.x + box.width / 2;
                    const clickY = frameBox.y + box.y + box.height / 2;

                    log(`[CAPTCHA-SOLVER] Clicking reCAPTCHA anchor at (${Math.round(clickX)}, ${Math.round(clickY)})...`);
                    await humanClickXY(page, clickX, clickY);

                    // Wait to see if it immediately passes
                    await sleep(2500);
                    const isChecked = await checkbox.getAttribute("aria-checked").catch(() => null);
                    if (isChecked === "true") {
                        return {
                            solved: true,
                            type: "recaptcha_v2",
                            message: "Google reCAPTCHA v2 resolved with checkmark."
                        };
                    }
                    return {
                        solved: true,
                        type: "recaptcha_v2",
                        message: "reCAPTCHA checkbox clicked. Challenge may require additional user/image interaction."
                    };
                }
            }
        }
    } catch (e) {
        log(`[CAPTCHA-SOLVER-ERR] reCAPTCHA check error: ${e.message}`);
    }

    // 3. Check for hCaptcha
    try {
        const hcaptchaFrames = page.frames().filter(f => (f.url() || "").includes("hcaptcha.com"));
        if (hcaptchaFrames.length > 0) {
            log(`[CAPTCHA-SOLVER] Detected hCaptcha frame.`);
            const frame = hcaptchaFrames[0];
            const checkbox = frame.locator('#checkbox, [aria-checked]').first();
            if (await checkbox.count() > 0) {
                const frameElement = await frame.frameElement();
                const frameBox = await frameElement.boundingBox();
                const box = await checkbox.boundingBox();
                if (frameBox && box) {
                    const clickX = frameBox.x + box.x + box.width / 2;
                    const clickY = frameBox.y + box.y + box.height / 2;

                    log(`[CAPTCHA-SOLVER] Clicking hCaptcha anchor at (${Math.round(clickX)}, ${Math.round(clickY)})...`);
                    await humanClickXY(page, clickX, clickY);
                    await sleep(2000);
                    return {
                        solved: true,
                        type: "hcaptcha",
                        message: "hCaptcha checkbox clicked."
                    };
                }
            }
        }
    } catch (e) {
        log(`[CAPTCHA-SOLVER-ERR] hCaptcha check error: ${e.message}`);
    }

    // 4. Standalone Cloudflare interstitial checkbox
    try {
        const cfCheckbox = page.locator('#challenge-stage input, input[name="cf-turnstile-response"]').first();
        if (await cfCheckbox.count() > 0) {
            const box = await cfCheckbox.boundingBox();
            if (box) {
                await humanClickXY(page, box.x + box.width / 2, box.y + box.height / 2);
                return {
                    solved: true,
                    type: "cloudflare_interstitial",
                    message: "Clicked standalone Cloudflare verification element."
                };
            }
        }
    } catch { }

    return {
        solved: false,
        type: "none",
        message: "No active interactive CAPTCHA or Turnstile challenge detected on page."
    };
}
