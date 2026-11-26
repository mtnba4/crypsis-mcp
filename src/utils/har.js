/**
 * Converts internal captured HTTP logs into standard HAR 1.2 format.
 */
export function toHar(logs) {
    const requests = new Map();
    const entries = [];
    for (const entry of logs) {
        if (entry.type === "request") {
            requests.set(entry.id, entry);
            continue;
        }
        if (entry.type !== "response") continue;
        const req = requests.get(entry.requestId);
        if (!req) continue;
        let url;
        try {
            url = new URL(req.url);
        } catch {
            continue;
        }
        entries.push({
            startedDateTime: req.timestamp,
            time: entry.timing?.responseEnd || 0,
            request: {
                method: req.method,
                url: req.url,
                httpVersion: "HTTP/2",
                headers: Object.entries(req.headers || {}).map(([name, value]) => ({ name, value })),
                queryString: Array.from(url.searchParams.entries()).map(([name, value]) => ({ name, value })),
                cookies: [],
                headersSize: -1,
                bodySize: req.postData ? Buffer.byteLength(req.postData) : 0,
                postData: req.postData ? { mimeType: req.headers?.["content-type"] || "", text: req.postData } : undefined
            },
            response: {
                status: entry.status,
                statusText: "",
                httpVersion: "HTTP/2",
                headers: Object.entries(entry.headers || {}).map(([name, value]) => ({ name, value })),
                cookies: [],
                content: {
                    size: entry.bodySample ? Buffer.byteLength(entry.bodySample) : 0,
                    mimeType: entry.headers?.["content-type"] || "",
                    text: entry.bodySample || undefined
                },
                redirectURL: entry.headers?.location || "",
                headersSize: -1,
                bodySize: -1
            },
            cache: {},
            timings: {
                blocked: -1,
                dns: entry.timing?.domainLookupEnd && entry.timing?.domainLookupStart ? entry.timing.domainLookupEnd - entry.timing.domainLookupStart : -1,
                connect: entry.timing?.connectEnd && entry.timing?.connectStart ? entry.timing.connectEnd - entry.timing.connectStart : -1,
                send: entry.timing?.requestEnd && entry.timing?.requestStart ? entry.timing.requestEnd - entry.timing.requestStart : -1,
                wait: entry.timing?.responseStart && entry.timing?.requestEnd ? entry.timing.responseStart - entry.timing.requestEnd : -1,
                receive: entry.timing?.responseEnd && entry.timing?.responseStart ? entry.timing.responseEnd - entry.timing.responseStart : -1,
                ssl: entry.timing?.secureConnectionStart && entry.timing?.connectEnd ? entry.timing.connectEnd - entry.timing.secureConnectionStart : -1
            }
        });
    }

    return {
        log: {
            version: "1.2",
            creator: { name: "Crypsis MCP", version: "1.0.0" },
            pages: [],
            entries
        }
    };
}

/**
 * Converts a captured request into raw HTTP/1.1 wire text representation.
 */
export function toRawHttpRequest(req) {
    const url = new URL(req.url);
    const pathWithQuery = `${url.pathname || "/"}${url.search || ""}`;
    const headers = { ...(req.headers || {}) };
    headers.host ||= url.host;
    const lines = [`${req.method} ${pathWithQuery} HTTP/1.1`];
    for (const [name, value] of Object.entries(headers)) lines.push(`${name}: ${value}`);
    lines.push("", req.postData || "");
    return lines.join("\r\n");
}
