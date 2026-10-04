import fs from "fs";

const baseUrl = "https://corporate.bharatenglish.org";

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

async function relogin() {
  const url = `${baseUrl}/api/public/bet-exams/login`;
  console.log(`[POST] ${url}`);
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      username: "12520776@lpu.in",
      password: "12520776",
      appContext: "BET_CORPORATE"
    })
  });
  
  if (!res.ok) {
    console.error("Login failed:", res.status, await res.text());
    return;
  }
  
  const data = await res.json();
  const token = data.token || data.jwt || data.access_token || (data.data && data.data.token);
  const authHeader = res.headers.get("authorization") || (token ? (token.startsWith("Bearer ") ? token : `Bearer ${token}`) : null);
  
  console.log("Login successful! User ID:", data.user?.id || data.id || data.user_id);
  console.log("Token:", authHeader ? authHeader.slice(0, 40) + "..." : "No token found");
  
  if (authHeader) {
    let envText = "";
    if (fs.existsSync(".env")) {
      envText = fs.readFileSync(".env", "utf8");
    }
    
    if (envText.includes("TOKEN=")) {
      envText = envText.replace(/TOKEN=.*(\r?\n|$)/, `TOKEN=${authHeader}\n`);
    } else {
      envText += `\nTOKEN=${authHeader}\n`;
    }
    
    fs.writeFileSync(".env", envText);
    console.log("Updated .env with new TOKEN!");
  }
}

relogin().catch(console.error);
