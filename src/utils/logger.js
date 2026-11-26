import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, "../..");
const LOG_FILE = path.join(ROOT_DIR, "crypsis.log");

export const MAX_OUTPUT_CHARS = Number(process.env.CRYPSIS_MAX_OUTPUT_CHARS || 100000);
export const MAX_CAPTURE_BODY_CHARS = Number(process.env.CRYPSIS_MAX_CAPTURE_BODY_CHARS || 20000);

export const log = (msg) => {
    try {
        const s = `[${new Date().toISOString()}] ${msg}\n`;
        fs.appendFileSync(LOG_FILE, s);
    } catch { }
};

export const truncateCapture = (value, limit = MAX_CAPTURE_BODY_CHARS) => {
    if (value === null || value === undefined) return value;
    const text = String(value);
    return text.length > limit ? text.substring(0, limit) + "\n[TRUNCATED]" : text;
};

export const formatResponse = (data, isError = false) => {
    let text = "";
    if (data === undefined || data === null) {
        text = "Done.";
    } else if (typeof data === "object") {
        if (data.error) {
            isError = true;
            text = typeof data.error === "string" ? data.error : JSON.stringify(data.error, null, 2);
        } else {
            text = JSON.stringify(data, null, 2);
        }
    } else {
        text = String(data);
    }

    if (text.length > MAX_OUTPUT_CHARS) {
        text = text.substring(0, MAX_OUTPUT_CHARS) + "\n\n[TRUNCATED: Output too large for safety]";
    }
    return { content: [{ type: "text", text }], isError };
};
