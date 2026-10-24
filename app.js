// Page logic: reads the form, calls loadAgent, renders. All data shown as text (no HTML injection).
import { loadAgent, resolveUri } from "./viewer.js";
import { REGISTRIES, EXPLORERS, KOGNAI_TEST_IDENTITY } from "./config.js";

const $ = (id) => document.getElementById(id);
const el = (tag, attrs = {}, ...kids) => {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) if (v != null) n.setAttribute(k, v);
  for (const k of kids.flat()) if (k != null) n.append(k instanceof Node ? k : String(k));
  return n;
};
const safeHref = (u) => { try { const x = new URL(resolveUri(u)); return x.protocol === "https:" || x.protocol === "http:" ? x.href : null; } catch { return null; } };
const link = (u, text) => { const h = safeHref(u); return h ? el("a", { href: h, rel: "noopener noreferrer", target: "_blank" }, text ?? u) : el("code", {}, text ?? u); };
const short = (a) => a.slice(0, 6) + "..." + a.slice(-4);

$("regs").textContent = Object.entries(REGISTRIES).map(([n, r]) => `${n} identity ${short(r.identity)}, reputation ${short(r.reputation)}`).join("; ");
if (KOGNAI_TEST_IDENTITY.agentId != null) $("kognai-test").href = `?network=${KOGNAI_TEST_IDENTITY.network}&agentId=${KOGNAI_TEST_IDENTITY.agentId}`;

for (const a of document.querySelectorAll("[data-theme]")) a.addEventListener("click", (e) => {
  e.preventDefault();
  const t = a.getAttribute("data-theme");
  if (t) document.documentElement.setAttribute("data-theme", t); else document.documentElement.removeAttribute("data-theme");
  try { localStorage.setItem("theme", t); } catch {}
});
try { const t = localStorage.getItem("theme"); if (t) document.documentElement.setAttribute("data-theme", t); } catch {}

function render(r, network) {
  const out = $("out");
  out.replaceChildren();
  const ex = EXPLORERS[network];
  if (r.status === "empty") { out.append(el("div", { class: "card state-empty" }, el("strong", {}, "No such agent. "), r.message)); return; }
  if (r.status === "error" && !r.owner) { out.append(el("div", { class: "card state-error" }, el("strong", {}, "Could not load this agent. "), r.error)); return; }
  if (r.status === "error") out.append(el("div", { class: "card state-error" }, el("strong", {}, "Partly loaded. "), r.error));
  const g = r.registration;
  const img = g?.image && safeHref(g.image) ? el("img", { src: safeHref(g.image), alt: "", loading: "lazy", referrerpolicy: "no-referrer" }) : null;
  if (img) img.addEventListener("error", () => img.remove());
  out.append(el("div", { class: "card agent" },
    img,
    el("div", {},
      el("h2", {}, g?.name || `Agent ${r.agentId}`),
      g?.description ? el("p", {}, g.description) : el("p", { class: "muted" }, r.tokenURI ? "No description." : "This agent has no registration file (empty tokenURI)."),
      el("dl", {},
        el("dt", {}, "Agent id"), el("dd", {}, `${r.agentId} on ${network}`),
        el("dt", {}, "Owner"), el("dd", {}, el("a", { href: `${ex}/address/${r.owner}`, rel: "noopener", target: "_blank" }, el("code", {}, r.owner))),
        el("dt", {}, "tokenURI"), el("dd", {}, r.tokenURI ? (r.tokenURI.startsWith("data:") ? el("code", {}, r.tokenURI.slice(0, 48) + "... (inline data)") : link(r.tokenURI)) : el("span", { class: "muted" }, "empty")),
        g ? [el("dt", {}, "Active"), el("dd", {}, g.active == null ? "not stated" : g.active ? "yes" : "no"),
             el("dt", {}, "x402"), el("dd", {}, g.x402Support == null ? "not stated" : g.x402Support ? "supported" : "no")] : null,
      ))));
  if (g) {
    out.append(el("div", { class: "card" }, el("h3", {}, "Endpoints"),
      g.endpoints.length ? el("ul", {}, g.endpoints.map((e) => el("li", {}, el("span", { class: "badge" }, e.name), link(e.endpoint), e.version ? el("span", { class: "muted" }, ` v${e.version}`) : null))) : el("p", { class: "muted" }, "No endpoints listed."),
      el("h3", {}, "Supported trust"),
      g.supportedTrust.length ? el("p", {}, g.supportedTrust.map((t) => el("span", { class: "badge" }, t))) : el("p", { class: "muted" }, "None declared: this agent uses ERC-8004 for discovery only.")));
  }
  const f = r.feedback;
  if (f) {
    out.append(el("div", { class: "card" }, el("h3", {}, "Reputation"),
      f.count ? [
        el("div", { class: "row" }, el("div", {}, el("div", { class: "big" }, String(f.count)), el("div", { class: "muted" }, "feedback entries")), el("div", {}, el("div", { class: "big" }, String(f.average)), el("div", { class: "muted" }, "average score"))),
        el("h4", {}, `Latest ${f.items.length}`),
        el("table", {}, el("thead", {}, el("tr", {}, el("th", {}, "Client"), el("th", {}, "Score"), el("th", {}, "Tags"))),
          el("tbody", {}, f.items.map((i) => el("tr", {}, el("td", {}, el("a", { href: `${ex}/address/${i.client}`, target: "_blank", rel: "noopener" }, el("code", {}, short(i.client)))), el("td", {}, String(i.score)), el("td", {}, i.tags.map((t) => el("span", { class: "badge" }, t)))))))
      ] : el("p", { class: "muted" }, "No feedback yet for this agent.")));
  }
}

async function show(agentId, network, rpc) {
  $("out").replaceChildren(el("p", { class: "muted" }, "Loading..."));
  const r = await loadAgent({ agentId, network, rpc: rpc || undefined });
  render(r, network);
}

$("f").addEventListener("submit", (e) => {
  e.preventDefault();
  const agentId = $("agentId").value.trim(), network = $("network").value, rpc = $("rpc").value.trim();
  history.replaceState(null, "", `?network=${network}&agentId=${encodeURIComponent(agentId)}`);
  show(agentId, network, rpc);
});

const q = new URLSearchParams(location.search);
if (q.get("network") && REGISTRIES[q.get("network")]) $("network").value = q.get("network");
if (q.get("agentId")) $("agentId").value = q.get("agentId");
show($("agentId").value, $("network").value);
