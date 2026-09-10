import { createServer } from "node:http";
import { createCanvas, joinSession } from "@github/copilot-sdk/extension";

const repository = "SHREYANK1783/workshop";
const servers = new Map();
let session;

function escapeHtml(value) {
    return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}

function summarize(body) {
    const text = String(body || "").replace(/[#*_`>\-\[\]]/g, "").replace(/\s+/g, " ").trim();
    return text.length > 220 ? `${text.slice(0, 217)}...` : text || "No description provided.";
}

function urgencyReason(issue, rank) {
    const age = Math.max(0, Date.now() - Date.parse(issue.updated_at));
    const recent = age < 7 * 24 * 60 * 60 * 1000;
    const signals = [
        "it is still open",
        recent ? "it was updated within the last week" : "it has recent repository activity",
        issue.labels.length ? `it carries the ${issue.labels[0].name} label` : "it has no triage label yet",
    ];
    return `Ranked #${rank} because ${signals.join(", ")}.`;
}

async function fetchIssues() {
    const response = await fetch(`https://api.github.com/repos/${repository}/issues?state=open&per_page=100`, {
        headers: { Accept: "application/vnd.github+json", "User-Agent": "kanban-triage-canvas" },
    });
    if (!response.ok) throw new Error(`GitHub returned ${response.status} while loading issues.`);
    const issues = await response.json();
    return issues.filter((issue) => !issue.pull_request).sort((a, b) => Date.parse(b.updated_at) - Date.parse(a.updated_at) || a.number - b.number);
}

function renderCard(issue, index, featured) {
    const reason = featured ? urgencyReason(issue, index + 1) : "Open issue retained below the immediate triage list.";
    return `<article class="card ${featured ? "featured" : ""}">
      <div class="card-top"><span class="issue-number">#${issue.number}</span><span class="state">OPEN</span></div>
      <h3>${escapeHtml(issue.title)}</h3>
      <p class="description">${escapeHtml(summarize(issue.body))}</p>
      ${featured ? `<p class="reason"><strong>Why now:</strong> ${escapeHtml(reason)}</p>` : ""}
      <div class="card-footer"><a href="${escapeHtml(issue.html_url)}" target="_blank" rel="noreferrer">View issue</a><button data-issue="${issue.number}" data-testid="add-issue-${issue.number}">Add to current context</button></div>
    </article>`;
}

function renderHtml(issues) {
    const featured = issues.slice(0, 3);
    const remainder = issues.slice(3);
    const content = issues.length
        ? `<section><h2>Needs attention now</h2><div class="board">${featured.map((issue, index) => renderCard(issue, index, true)).join("")}</div></section>${remainder.length ? `<section><h2>More open issues</h2><div class="board">${remainder.map((issue, index) => renderCard(issue, index, false)).join("")}</div></section>` : ""}`
        : `<div class="empty"><h2>No open issues</h2><p>The repository has no open issues to triage.</p></div>`;
    return `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Issue triage board</title>
<style>
:root{color-scheme:light dark;--bg:var(--background-color-default,#fff);--text:var(--text-color-default,#1f2328);--muted:var(--text-color-muted,#656d76);--border:var(--border-color-default,#d0d7de);--accent:var(--true-color-blue,#0969da)}
*{box-sizing:border-box}body{margin:0;padding:24px;background:var(--bg);color:var(--text);font:14px/1.5 var(--font-sans,system-ui,sans-serif)}header{display:flex;justify-content:space-between;gap:16px;align-items:end;margin-bottom:24px}h1,h2,h3,p{margin:0}h1{font-size:24px;line-height:1.2}h2{font-size:16px;margin-bottom:12px}.subtitle,.count,.description,.reason{color:var(--muted)}.count{white-space:nowrap}section{margin-bottom:28px}.board{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:12px}.card{display:flex;flex-direction:column;min-height:230px;padding:16px;border:1px solid var(--border);border-radius:10px;background:color-mix(in srgb,var(--bg) 94%,var(--text))}.card.featured{border-color:var(--accent);box-shadow:0 0 0 1px color-mix(in srgb,var(--accent) 25%,transparent)}.card-top,.card-footer{display:flex;align-items:center;justify-content:space-between;gap:12px}.issue-number{color:var(--accent);font-weight:600}.state{color:var(--muted);font-size:11px;letter-spacing:.08em}h3{margin:12px 0 8px;font-size:16px;line-height:1.3}.reason{margin-top:12px;font-size:13px}.card-footer{margin-top:auto;padding-top:16px}a{color:var(--accent)}button{border:0;border-radius:6px;padding:7px 10px;color:var(--color-white,#fff);background:var(--accent);cursor:pointer;font:inherit}button:hover{filter:brightness(1.1)}button:focus-visible,a:focus-visible{outline:2px solid var(--color-focus-outline,#0969da);outline-offset:2px}button:disabled{opacity:.6;cursor:wait}.empty{padding:24px;border:1px dashed var(--border);border-radius:10px;color:var(--muted)}
</style></head><body>
<header><div><h1>Issue triage board</h1><p class="subtitle">The three issues most likely to need attention right now.</p></div><span class="count">${issues.length} open issue${issues.length === 1 ? "" : "s"}</span></header>
${content}
<script>
document.querySelectorAll("button[data-issue]").forEach((button)=>button.addEventListener("click",async()=>{button.disabled=true;const original=button.textContent;button.textContent="Adding...";try{const response=await fetch("/add-context",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({number:Number(button.dataset.issue)})});if(!response.ok)throw new Error(await response.text());button.textContent="Added to context"}catch(error){button.disabled=false;button.textContent=original;window.alert(error.message||"Could not add the issue to context.")}}));
</script></body></html>`;
}

function sendJson(res, status, payload) {
    res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
    res.end(JSON.stringify(payload));
}

async function readJson(req) {
    let body = "";
    for await (const chunk of req) body += chunk;
    return JSON.parse(body);
}

async function startServer(issues) {
    const server = createServer(async (req, res) => {
        try {
            if (req.method === "POST" && req.url === "/add-context") {
                const input = await readJson(req);
                const issue = issues.find((candidate) => candidate.number === input.number);
                if (!issue) return sendJson(res, 404, { error: "Issue not found on this board." });
                await session.send({ prompt: `Please add GitHub issue #${issue.number} (${issue.title}) from ${repository} to the current working context so we can work on it next. Issue URL: ${issue.html_url}` });
                return sendJson(res, 200, { added: issue.number });
            }
            res.setHeader("Content-Type", "text/html; charset=utf-8");
            res.end(renderHtml(issues));
        } catch (error) {
            sendJson(res, 500, { error: error instanceof Error ? error.message : "Unable to process request." });
        }
    });
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    const port = typeof address === "object" && address ? address.port : 0;
    return { server, url: `http://127.0.0.1:${port}/` };
}

session = await joinSession({
    canvases: [
        createCanvas({
            id: "kanban-triage",
            displayName: "Issue triage board",
            description: "A Kanban board that highlights the three open repository issues most likely to need attention now.",
            actions: [
                {
                    name: "refresh_issues",
                    description: "Reload open issues and return the current triage count and top issue numbers.",
                    handler: async () => {
                        const issues = await fetchIssues();
                        return { openIssueCount: issues.length, topIssueNumbers: issues.slice(0, 3).map((issue) => issue.number) };
                    },
                },
            ],
            open: async (ctx) => {
                const issues = await fetchIssues();
                let entry = servers.get(ctx.instanceId);
                if (!entry) {
                    entry = await startServer(issues);
                    servers.set(ctx.instanceId, entry);
                }
                return { title: "Issue triage board", url: entry.url };
            },
            onClose: async (ctx) => {
                const entry = servers.get(ctx.instanceId);
                if (entry) {
                    servers.delete(ctx.instanceId);
                    await new Promise((resolve) => entry.server.close(() => resolve()));
                }
            },
        }),
    ],
});
