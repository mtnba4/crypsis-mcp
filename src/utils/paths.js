import fs from "fs";
import path from "path";

/**
 * Resolves a target path relative to configured workspace environment variables,
 * ensuring target directory exists.
 */
export function resolveAndPreparePath(inputPath, defaultExt = "") {
    if (!inputPath) {
        throw new Error("Path/filename is required.");
    }
    const root = process.env.CRYPSIS_WORKSPACE ||
        process.env.WORKSPACE_ROOT ||
        process.env.MIME_WORKSPACE ||
        process.cwd();
    let resolved = path.isAbsolute(inputPath)
        ? inputPath
        : path.resolve(root, inputPath);
    if (defaultExt && !path.extname(resolved)) {
        resolved += defaultExt;
    }
    const targetDir = path.dirname(resolved);
    if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
    }
    return resolved;
}

/**
 * Strips surrounding quotes or JSON escaped strings from a selector string.
 */
export function cleanSelector(sel) {
    if (typeof sel !== 'string') return sel;
    let s = sel.trim();
    while ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
        if (s.startsWith('"')) {
            try {
                const parsed = JSON.parse(s);
                if (typeof parsed === 'string' && parsed !== s) {
                    s = parsed.trim();
                    continue;
                }
            } catch { }
            s = s.slice(1, -1).trim();
        } else {
            s = s.slice(1, -1).trim();
        }
    }
    return s;
}
