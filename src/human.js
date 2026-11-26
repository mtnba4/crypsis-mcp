import { cleanSelector } from "./utils/paths.js";

/**
 * Generates an array of points along a cubic Bezier curve with micro-jitter
 */
export function generateBezierPath(startX, startY, endX, endY, steps = 25) {
    // Generate two randomized control points to create human-like curve
    const distance = Math.hypot(endX - startX, endY - startY);
    const deviation = Math.min(distance * 0.3, 100);

    const cp1X = startX + (endX - startX) * (0.2 + Math.random() * 0.2) + (Math.random() - 0.5) * deviation;
    const cp1Y = startY + (endY - startY) * (0.2 + Math.random() * 0.2) + (Math.random() - 0.5) * deviation;

    const cp2X = startX + (endX - startX) * (0.6 + Math.random() * 0.2) + (Math.random() - 0.5) * deviation;
    const cp2Y = startY + (endY - startY) * (0.6 + Math.random() * 0.2) + (Math.random() - 0.5) * deviation;

    const points = [];
    for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        // Cubic Bezier formula
        const u = 1 - t;
        const tt = t * t;
        const uu = u * u;
        const uuu = uu * u;
        const ttt = tt * t;

        let x = uuu * startX + 3 * uu * t * cp1X + 3 * u * tt * cp2X + ttt * endX;
        let y = uuu * startY + 3 * uu * t * cp1Y + 3 * u * tt * cp2Y + ttt * endY;

        // Subtle micro-jitter except near destination
        if (i > 0 && i < steps) {
            x += (Math.random() - 0.5) * 1.5;
            y += (Math.random() - 0.5) * 1.5;
        }
        points.push({ x: Math.round(x), y: Math.round(y) });
    }
    return points;
}

export async function humanMouseMove(page, targetX, targetY) {
    const steps = 18 + Math.floor(Math.random() * 12);
    await page.mouse.move(targetX, targetY, { steps });
}

export async function humanClickXY(page, x, y) {
    await humanMouseMove(page, x, y);
    await new Promise(r => setTimeout(r, 60 + Math.random() * 80));
    await page.mouse.down();
    await new Promise(r => setTimeout(r, 50 + Math.random() * 70));
    await page.mouse.up();
    await new Promise(r => setTimeout(r, 80 + Math.random() * 120));
}

export async function humanClick(page, selector) {
    const cleanS = cleanSelector(selector);
    const locator = page.locator(cleanS).first();
    try {
        await locator.scrollIntoViewIfNeeded();
        const box = await locator.boundingBox();
        if (box) {
            const targetX = box.x + box.width * (0.2 + Math.random() * 0.6);
            const targetY = box.y + box.height * (0.2 + Math.random() * 0.6);

            const overshootX = targetX + (Math.random() > 0.5 ? 5 : -5);
            const overshootY = targetY + (Math.random() > 0.5 ? 5 : -5);

            // Move to overshoot target
            await page.mouse.move(overshootX, overshootY, { steps: 12 });
            await new Promise(r => setTimeout(r, 30 + Math.random() * 50));
            // Settle on target
            await page.mouse.move(targetX, targetY, { steps: 6 });

            // Eye-hand coordination dwell
            await new Promise(r => setTimeout(r, 120 + Math.random() * 180));

            // Small settle jitter
            await page.mouse.move(targetX + (Math.random() - 0.5) * 2, targetY + (Math.random() - 0.5) * 2, { steps: 4 });

            // Press
            await page.mouse.down();
            await new Promise(r => setTimeout(r, 50 + Math.random() * 80));
            await page.mouse.up();

            // Post-click dwell
            await new Promise(r => setTimeout(r, 100 + Math.random() * 150));
        } else {
            await page.click(cleanS, { delay: Math.random() * 150 + 80 });
        }
    } catch {
        await page.click(cleanS, { force: true, delay: Math.random() * 150 + 80 });
    }
}

export async function humanType(page, selector, text) {
    const cleanS = cleanSelector(selector);
    const locator = page.locator(cleanS).first();
    await locator.focus({ timeout: 15000 });
    await new Promise(r => setTimeout(r, 150 + Math.random() * 250));

    for (const char of text) {
        if (Math.random() < 0.02 && char !== ' ') {
            const adjacentKeys = "qwertyuiopasdfghjklzxcvbnm";
            const fakeChar = adjacentKeys[Math.floor(Math.random() * adjacentKeys.length)];
            await page.keyboard.type(fakeChar, { delay: 45 });
            await new Promise(r => setTimeout(r, 100 + Math.random() * 150));
            await page.keyboard.press('Backspace', { delay: 45 });
        }
        await page.keyboard.type(char, { delay: 50 + Math.random() * 90 });
        if (char === ' ' || Math.random() < 0.1) {
            await new Promise(r => setTimeout(r, 80 + Math.random() * 250));
        }
    }
}
