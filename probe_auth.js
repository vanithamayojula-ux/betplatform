import https from "https";
import { URL } from "url";

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

function customFetch(urlStr, options = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(urlStr);
    const req = https.request(
      {
        hostname: u.hostname,
        port: u.port || 443,
        path: u.pathname + u.search,
        method: options.method || "GET",
        headers: options.headers || {},
        rejectUnauthorized: false,
        timeout: 15000,
      },
      (res) => {
        let body = "";
        res.on("data", (chunk) => (body += chunk));
        res.on("end", () =>
          resolve({
            ok: res.statusCode >= 200 && res.statusCode < 300,
            status: res.statusCode,
            headers: res.headers,
            text: async () => body,
          })
        );
      }
    );
    req.on("error", reject);
    req.on("timeout", () => {
      req.destroy();
      reject(new Error(`Timeout requesting ${urlStr}`));
    });
    if (options.body) req.write(options.body);
    req.end();
  });
}

async function run() {
  const res = await customFetch("https://corporate.bharatenglish.org/login");
  const html = await res.text();
  console.log("HTML len:", html.length);
  const scriptMatches = html.match(/src="([^"]+\.js)"/g) || [];
  console.log("Scripts:", scriptMatches);

  for (const s of scriptMatches) {
    const src = s.replace(/src="|"/g, "");
    const scriptUrl = src.startsWith("http") ? src : `https://corporate.bharatenglish.org${src.startsWith("/") ? "" : "/"}${src}`;
    console.log("Fetching script:", scriptUrl);
    const sRes = await customFetch(scriptUrl);
    const sTxt = await sRes.text();
    console.log("Script len:", sTxt.length);
    
    // search for login / auth / authenticate / token endpoints
    const authMatches = sTxt.match(/["'`][^"'`]*(?:login|auth|authenticate|signin)[^"'`]*["'`]/gi) || [];
    console.log("Auth matches in", scriptUrl, ":", authMatches.slice(0, 30));
  }
}

run();
