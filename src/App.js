import React, { useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import "./App.css";
import aiIcon from "./assets/icons/ai-powered.png";
import customizableIcon from "./assets/icons/customizable.png";
import efficientIcon from "./assets/icons/efficient.png";
import consistentIcon from "./assets/icons/consistent.png";

/* ───────── helpers + constants ───────── */

const API_BASE = "http://localhost:8000";

function tryParseRequirements(raw) {
  // Accept object directly
  if (raw && typeof raw === "object") return raw;
  let s = String(raw ?? "").trim();
  if (s.startsWith("```")) {
    s = s.replace(/^```(?:json)?\s*/i, "").replace(/```$/i, "").trim();
  }
  try { return JSON.parse(s); } catch {}
  const first = s.indexOf("{");
  const last = s.lastIndexOf("}");
  if (first !== -1 && last !== -1 && last > first) {
    try { return JSON.parse(s.slice(first, last + 1)); } catch {}
  }
  return null;
}

const JSON_GUIDE = `
You are producing a requirements document as pure JSON.
Do NOT include Markdown, code fences, or any explanatory text.
Return ONLY a single JSON object with this schema:

{
  "title": string,
  "summary": string,
  "functional": [
    {
      "id": "FR001",
      "level": "MUST" | "SHOULD" | "COULD",
      "statement": string,
      "bullets": [string],
      "rationale": string,
      "standards": [string]
    }
  ],
  "nonFunctional": [string],
  "constraints": [string],
  "outOfScope": [string],
  "risks": [ { "risk": string, "mitigation": string } ],
  "openQuestions": [string],
  "useCases": [string]
}

Rules:
- Keep sentences concise.
- Prefer MUST/SHOULD appropriately.
- Ensure valid JSON (no trailing commas, no comments).
`;

const DEFAULT_MODEL = "models/gemini-2.5-flash";

/* ───────── Icons ───────── */
const Paperclip = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
    <path d="M21 7L10 18a5 5 0 1 1-7-7l11-11" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);
const Mic = ({ on, size = 22 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={on ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2">
    <rect x="9" y="2" width="6" height="12" rx="3" />
    <path d="M5 10a7 7 0 0 0 14 0M12 19v3" />
  </svg>
);

/* ───────── Constants ───────── */
const GREETINGS = new Set(["hi","hello","hey","hola","greetings","good morning","good afternoon","good evening"]);
const PROJECT_TYPES = ["Mechanical","Electrical","Civil","Software","Other"];
const STARTER_TEMPLATES = ["Inventory Tracker","Event Booking System","Recipe Planner","Fitness & Habit Coach","Travel Itinerary Builder"];

/* ───────── Utilities ───────── */
const escapeHtml = (s = "") => String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
const norm = (s="") => s.toLowerCase().replace(/\s+/g," ").trim();
const levelOf = (txt="") => {
  const t = txt.toUpperCase();
  if (t.includes("MUST")) return "MUST";
  if (t.includes("SHOULD")) return "SHOULD";
  if (t.includes("COULD")) return "COULD";
  return "SHOULD";
};
const byLevel = (items, pick=(x)=>x.level) => {
  const b = { MUST:[], SHOULD:[], COULD:[] };
  (items||[]).forEach(it => b[(pick(it)||"SHOULD").toUpperCase()]?.push(it));
  return b;
};
function downloadBlob(content, filename, mime) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}
function splitSentences(text="") {
  return text.replace(/\s+/g, " ").trim().split(/(?<=[.!?])\s+/).filter(Boolean);
}
function takeLines(text="", n=3) {
  const s = splitSentences(text);
  return s.slice(0, n).join(" ");
}

/* ---- NFR bucketing with MVP defaults ---- */
function bucketNFR(nonFunctional = []) {
  const mk = () => ({ MUST: [], SHOULD: [], COULD: [] });
  const b = {
    reliability: mk(),
    performance: mk(),
    maintainability: mk(),
    compliance: mk(),
    verification: mk(),
  };

  nonFunctional.forEach(n => {
    const lvl = levelOf(n);
    const t = n.toLowerCase();

    if (/(gdpr|ccpa|hipaa|pci|soc\s*2|iso\/?iec|iso\s*2700|wcag|accessibil|compliance|regulat)/.test(t)) {
      b.compliance[lvl].push(n);
    } else if (/(test|qa|u[a]?t|unit|integration|e2e|acceptance|verification|validation|ci\/?cd|pipeline)/.test(t)) {
      b.verification[lvl].push(n);
    } else if (/(performance|latency|throughput|response|load\s*time|scalab|concurren|benchmark)/.test(t)) {
      b.performance[lvl].push(n);
    } else if (/(reliab|uptime|availability|failover|redundan|recover|backup|disaster\s*recovery|fault[- ]toler|resilien)/.test(t)) {
      b.reliability[lvl].push(n);
    } else if (/(maintain|refactor|modular|document|readab|extensib|configurab|observab|monitorab|logging)/.test(t)) {
      b.maintainability[lvl].push(n);
    }
  });

  // Small defaults so the PDF/DOCX never looks empty
  const add = (k, lvl, text) => b[k][lvl].push(text);
  if (!b.reliability.MUST.length && !b.reliability.SHOULD.length)
    add("reliability","MUST","Reliability: Maintain 99.9% monthly uptime and daily automated backups with restore tests.");
  if (!b.performance.MUST.length && !b.performance.SHOULD.length)
    add("performance","SHOULD","Performance: p95 page load ≤ 3s for typical users under normal load.");
  if (!b.maintainability.MUST.length && !b.maintainability.SHOULD.length)
    add("maintainability","SHOULD","Maintainability: Modular code with basic docs and lint/tests enforced in CI.");
  if (!b.compliance.MUST.length && !b.compliance.SHOULD.length)
    add("compliance","SHOULD","Compliance: Core flows align with WCAG 2.1 AA accessibility guidelines.");
  if (!b.verification.MUST.length && !b.verification.SHOULD.length)
    add("verification","SHOULD","Verification: Automated unit tests for critical logic and smoke tests in CI.");

  return b;
}

/* ---- Build sections (MUST + SHOULD) ---- */
function deriveSections(data) {
  const d = data || {};
  const functionality = byLevel(d.functional || [], (x)=> (x.level || levelOf(x.statement)));
  const { reliability, performance, maintainability, compliance, verification } = bucketNFR(d.nonFunctional || []);
  const useCases = Array.isArray(d.useCases) && d.useCases.length
    ? d.useCases
    : (d.functional||[]).slice(0,5).map(r => {
        const s = (r.statement||"").replace(/^The system\s+(MUST|SHOULD|COULD)\s+/i,"");
        return s || r.statement || "";
      }).filter(Boolean);

  return {
    title: d.title || "Requirements",
    summary: d.summary || "",
    functionality, reliability, performance, maintainability, compliance, verification,
    useCases
  };
}

function pickTop4(functionality) {
  const must = functionality.MUST || [];
  const should = functionality.SHOULD || [];
  return [...must, ...should].slice(0, 4);
}

/* Avoid repeating the Top 4 */
function withoutSelected(funcGroups, selected = []) {
  const keys = new Set(
    selected.map(r => (r?.id ? `id:${r.id}` : `s:${norm(r?.statement||"")}`))
  );
  const keep = (r) => {
    if (typeof r === "string") return true;
    const k = r?.id ? `id:${r.id}` : `s:${norm(r?.statement||"")}`;
    return !keys.has(k);
  };
  return {
    MUST: (funcGroups.MUST || []).filter(keep),
    SHOULD: (funcGroups.SHOULD || []).filter(keep),
    COULD: (funcGroups.COULD || []).filter(keep),
  };
}

/* ---- Simple, Bullet Point PDF HTML ---- */
function htmlForPdf(d) {
  const S = deriveSections(d);
  const intro3 = takeLines(S.summary, 3);
  const summary4 = takeLines(S.summary, 4);
  const top4 = pickTop4(S.functionality);
  const funcMinusTop4 = withoutSelected(S.functionality, top4);

  const H1 = (t)=>`<h1>${escapeHtml(t)}</h1>`;
  const H2 = (t)=>`<h2>${escapeHtml(t)}</h2>`;
  const H3 = (t)=>`<h3>${escapeHtml(t)}</h3>`;

  const listByLevel = (title, groups) => {
    const must = groups?.MUST || [];
    const should = groups?.SHOULD || [];
    if (!must.length && !should.length) return "";

    let out = `${H2(title)}`;
    if (must.length) {
      out += `${H3("MUST")}<ul>` + must.map(x =>
        typeof x === "string"
          ? `<li>${escapeHtml(x)}</li>`
          : `<li><strong>${escapeHtml(x.statement||"")}</strong>${
              x.bullets?.length ? `<ul>${x.bullets.map(b=>`<li>${escapeHtml(b)}</li>`).join("")}</ul>` : ""
            }</li>`
      ).join("") + `</ul>`;
    }
    if (should.length) {
      out += `${H3("SHOULD")}<ul>` + should.map(x =>
        typeof x === "string"
          ? `<li>${escapeHtml(x)}</li>`
          : `<li><strong>${escapeHtml(x.statement||"")}</strong>${
              x.bullets?.length ? `<ul>${x.bullets.map(b=>`<li>${escapeHtml(b)}</li>`).join("")}</ul>` : ""
            }</li>`
      ).join("") + `</ul>`;
    }
    return out;
  };

  const css = `
    @page { margin: 28pt; }
    body { font-family: -apple-system, Segoe UI, Roboto, Arial, sans-serif; font-size: 11pt; color: #0f172a; line-height: 1.45; }
    h1 { font-size: 20pt; margin: 0 0 8pt; padding-bottom: 6pt; border-bottom: 1px solid #e5e7eb; }
    h2 { font-size: 14pt; margin: 14pt 0 6pt; }
    h3 { font-size: 11.5pt; margin: 8pt 0 4pt; color: #0b225b; }
    p  { margin: 6pt 0; }
    ul { margin: 0 0 6pt 16pt; padding: 0; }
    li { margin: 3pt 0; }
    strong { font-weight: 700; }
  `;

  return `<!doctype html>
<html><head><meta charset="utf-8"/><title>${escapeHtml(S.title)}</title><style>${css}</style></head>
<body>
  ${H1(S.title)}
  ${intro3 ? `<p>${escapeHtml(intro3)}</p>` : ""}

  ${top4.length ? `${H2("Key MUST/SHOULD (Top 4)")}
    <ul>${top4.map(r=>`<li><strong>${escapeHtml((r.level||"").toUpperCase())}</strong> — ${escapeHtml(r.statement||"")}</li>`).join("")}</ul>` : ""}

  ${listByLevel("Functional", funcMinusTop4)}
  ${listByLevel("Reliability", S.reliability)}
  ${listByLevel("Performance", S.performance)}
  ${listByLevel("Maintainability", S.maintainability)}
  ${listByLevel("Compliance", S.compliance)}
  ${listByLevel("Verification", S.verification)}

  ${S.useCases?.length ? `${H2("Use Cases")}<ul>${S.useCases.map(u=>`<li>${escapeHtml(u)}</li>`).join("")}</ul>` : ""}

  ${summary4 ? `${H2("Summary")}<p>${escapeHtml(summary4)}</p>` : ""}
</body></html>`;
}

/* ---- Markdown export ---- */
function mdFromJson(d) {
  const S = deriveSections(d);
  const intro3 = takeLines(S.summary, 3);
  const summary4 = takeLines(S.summary, 4);
  const top4 = pickTop4(S.functionality);
  const funcMinusTop4 = withoutSelected(S.functionality, top4);

  const lines = [];
  lines.push(`# ${S.title}`, "");
  if (intro3) lines.push(intro3, "");

  if (top4.length) {
    lines.push("## Key MUST/SHOULD (Top 4)");
    top4.forEach(r => lines.push(`- **${(r.level||"").toUpperCase()}** — ${r.statement||""}`));
    lines.push("");
  }

  const dumpLvl = (title, grp, structured=false) => {
    const must = grp?.MUST || [];
    const should = grp?.SHOULD || [];
    if (!must.length && !should.length) return;

    lines.push(`## ${title}`);
    if (must.length) {
      lines.push(`### MUST`);
      must.forEach(x=>{
        if (structured) {
          lines.push(`- **${x.statement||""}**`);
          x.bullets?.forEach(b=>lines.push(`  - ${b}`));
        } else {
          lines.push(`- ${x}`);
        }
      });
      lines.push("");
    }
    if (should.length) {
      lines.push(`### SHOULD`);
      should.forEach(x=>{
        if (structured) {
          lines.push(`- **${x.statement||""}**`);
          x.bullets?.forEach(b=>lines.push(`  - ${b}`));
        } else {
          lines.push(`- ${x}`);
        }
      });
      lines.push("");
    }
  };

  dumpLvl("Functional", funcMinusTop4, true);
  dumpLvl("Reliability", S.reliability);
  dumpLvl("Performance", S.performance);
  dumpLvl("Maintainability", S.maintainability);
  dumpLvl("Compliance", S.compliance);
  dumpLvl("Verification", S.verification);

  if (S.useCases?.length) {
    lines.push("## Use Cases");
    S.useCases.forEach(u=>lines.push(`- ${u}`));
    lines.push("");
  }
  if (summary4) { lines.push("## Summary", summary4); }
  return lines.join("\n");
}

/* ───────── Features ───────── */
function FeaturesSection() {
  return (
    <section className="features">
      <h2 className="features__title">Features</h2>
      <div className="feature-grid">
        <article className="feature-card">
          <div className="feature-card__icon"><img src={aiIcon} alt="AI-Powered"/></div>
          <h3 className="feature-card__heading">AI-Powered</h3>
          <p className="feature-card__text">Leverage advanced AI algorithms to generate requirements.</p>
        </article>
        <article className="feature-card">
          <div className="feature-card__icon"><img src={customizableIcon} alt="Customizable"/></div>
          <h3 className="feature-card__heading">Customizable</h3>
          <p className="feature-card__text">Tailor requirements to fit your specific project needs.</p>
        </article>
        <article className="feature-card">
          <div className="feature-card__icon"><img src={efficientIcon} alt="Efficient"/></div>
          <h3 className="feature-card__heading">Efficient</h3>
          <p className="feature-card__text">Save time and effort in requirement drafting.</p>
        </article>
        <article className="feature-card">
          <div className="feature-card__icon"><img src={consistentIcon} alt="Consistent"/></div>
          <h3 className="feature-card__heading">Consistent</h3>
          <p className="feature-card__text">Ensure all requirements are clear and well structured.</p>
        </article>
      </div>
    </section>
  );
}

/* ───────── MUST/SHOULD cards for the Top 4  ───────── */
function RequirementCard({ req }) {
  const level = (req.level || "MUST").toLowerCase();
  return (
    <div className="req-card">
      <div className={`req-pill req-${level}`}>{req.level || "MUST"}</div>
      <div className="req-content">
        <div className="req-title"><strong>{req.statement}</strong></div>
        {Array.isArray(req.bullets) && req.bullets.length > 0 && (
          <ul className="req-bullets">{req.bullets.map((b,i)=><li key={i}>{b}</li>)}</ul>
        )}
      </div>
    </div>
  );
}

function BulletedGroup({ title, groups }) {
  const must = groups?.MUST || [];
  const should = groups?.SHOULD || [];
  if (must.length === 0 && should.length === 0) return null;

  return (
    <>
      <h4 className="req-section">{title}</h4>

      {must.length > 0 && (
        <div style={{marginBottom: 8}}>
          <div style={{fontWeight: 800, color: "var(--night)", marginBottom: 4}}>MUST</div>
          <ul className="req-bullets">
            {must.map((item, idx) =>
              typeof item === "string" ? (
                <li key={`m-${idx}`}>{item}</li>
              ) : (
                <li key={item.id || item.statement}><strong>{item.statement}</strong>
                  {item.bullets?.length ? (
                    <ul className="req-bullets">
                      {item.bullets.map((b,i)=><li key={i}>{b}</li>)}
                    </ul>
                  ) : null}
                </li>
              )
            )}
          </ul>
        </div>
      )}

      {should.length > 0 && (
        <div style={{marginBottom: 8}}>
          <div style={{fontWeight: 800, color: "var(--night)", marginBottom: 4}}>SHOULD</div>
          <ul className="req-bullets">
            {should.map((item, idx) =>
              typeof item === "string" ? (
                <li key={`s-${idx}`}>{item}</li>
              ) : (
                <li key={item.id || item.statement}><strong>{item.statement}</strong>
                  {item.bullets?.length ? (
                    <ul className="req-bullets">
                      {item.bullets.map((b,i)=><li key={i}>{b}</li>)}
                    </ul>
                  ) : null}
                </li>
              )
            )}
          </ul>
        </div>
      )}
    </>
  );
}

/* ───────── Reusable per-section editor  ───────── */
function EditableSection({ title, groups, onSave }) {
  const [isEditing, setIsEditing] = useState(false);
  const initialText = Object.values(groups || {})
    .flat()
    .map(item => (typeof item === "string" ? item : (item.statement || "")))
    .filter(Boolean)
    .join("\n");

  const [text, setText] = useState(initialText);

  
  React.useEffect(() => {
    const t = Object.values(groups || {})
      .flat()
      .map(item => (typeof item === "string" ? item : (item.statement || "")))
      .filter(Boolean)
      .join("\n");
    setText(t);
  }, [groups]);

  return (
    <div className="editable-section" style={{ marginTop: 8 }}>
      {!isEditing ? (
        <>
          <BulletedGroup title={title} groups={groups} />
          <button
            className="download"
            type="button"
            onClick={() => setIsEditing(true)}
          >
            Edit {title}
          </button>
        </>
      ) : (
        <div className="editor" style={{ marginTop: 12 }}>
          <h4 className="req-section">Editing: {title}</h4>
          <textarea
            className="pd-textarea"
            rows={10}
            value={text}
            onChange={(e)=>setText(e.target.value)}
            placeholder={`One item per line…`}
          />
          <div style={{ display: "flex", gap: 10, marginTop: 10, flexWrap: "wrap" }}>
            <button
              className="download"
              type="button"
              onClick={() => { onSave(text.split("\n").map(s=>s.trim()).filter(Boolean)); setIsEditing(false); }}
            >
              Save Changes
            </button>
            <button className="download" type="button" onClick={()=>setIsEditing(false)}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ───────── On-screen view ───────── */
function RequirementsView({
  data,
  onPdf,
  onDocx,
  onMd,
  onEditFunctionalRest,
  onEditNfrCategory
}) {
  const S = deriveSections(data);
  const intro3 = takeLines(S.summary, 3);
  const summary4 = takeLines(S.summary, 4);
  const top4 = pickTop4(S.functionality);
  const funcMinusTop4 = withoutSelected(S.functionality, top4);

  return (
    <div className="req-view">
      <h3 className="outTitle">Generated Requirements</h3>

      <h2 style={{margin:"0 0 6px"}}>{S.title}</h2>
      {intro3 && <p className="req-summary">{intro3}</p>}

      <div style={{ display: "flex", gap: 12, margin: "6px 0 10px" }}>
        <button className="download" type="button" onClick={onPdf}>Export PDF</button>
        <button className="download" type="button" onClick={onDocx}>Export DOCX</button>
        <button className="download" type="button" onClick={onMd}>Export Markdown</button>
      </div>

      {top4.length ? (
        <>
          <h4 className="req-section">Key MUST/SHOULD (Top 4)</h4>
          <div className="req-grid">
            {top4.map((r, i) => <RequirementCard key={(r.id||r.statement||"")+i} req={r} />)}
          </div>
        </>
      ) : null}

      {/* Functional (editable excluding Top 4) */}
      <EditableSection
        title="Functional"
        groups={funcMinusTop4}
        onSave={onEditFunctionalRest}
      />

      {/* NFR sections (each with single edit button) */}
      <EditableSection
        title="Reliability"
        groups={S.reliability}
        onSave={(lines)=>onEditNfrCategory("reliability", lines)}
      />
      <EditableSection
        title="Performance"
        groups={S.performance}
        onSave={(lines)=>onEditNfrCategory("performance", lines)}
      />
      <EditableSection
        title="Maintainability"
        groups={S.maintainability}
        onSave={(lines)=>onEditNfrCategory("maintainability", lines)}
      />
      <EditableSection
        title="Compliance"
        groups={S.compliance}
        onSave={(lines)=>onEditNfrCategory("compliance", lines)}
      />
      <EditableSection
        title="Verification"
        groups={S.verification}
        onSave={(lines)=>onEditNfrCategory("verification", lines)}
      />

      {S.useCases?.length ? (
        <>
          <h4 className="req-section">Use Cases</h4>
          <ul className="req-bullets">
            {S.useCases.map((u,i)=><li key={i}>{u}</li>)}
          </ul>
        </>
      ) : null}

      {summary4 && (
        <>
          <h4 className="req-section">Summary</h4>
          <p className="req-summary">{summary4}</p>
        </>
      )}
    </div>
  );
}

/* ───────── App ───────── */
export default function App() {
  const [projType, setProjType] = useState(PROJECT_TYPES[0]);
  const [projDesc, setProjDesc] = useState("");
  const [ideaText, setIdeaText] = useState("");
  const [file, setFile] = useState(null);
  const [listening, setListening] = useState(false);
  const fileRef = useRef(null);
  const inputRef = useRef(null);

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [md, setMd] = useState("");
  const [reqJson, setReqJson] = useState(null);

  const startMic = () => {
    const SR = window.webkitSpeechRecognition || window.SpeechRecognition;
    if (!SR) { setErr("Speech recognition is not supported in this browser."); return; }
    setErr("");
    const rec = new SR(); rec.lang="en-US"; rec.interimResults=false; rec.maxAlternatives=1;
    rec.onstart=()=>setListening(true); rec.onend=()=>setListening(false);
    rec.onerror=(e)=>{ setListening(false); setErr(`Mic error: ${e.error||"unknown"}`); };
    rec.onresult=(e)=>{ const text=e.results?.[0]?.[0]?.transcript||""; setIdeaText(text); setTimeout(()=>inputRef.current?.focus(),50); };
    rec.start();
  };

  const buildIdea = () => {
    const lines = [];
    if (ideaText.trim()) lines.push(`Idea: ${ideaText.trim()}`);
    if (projType.trim()) lines.push(`Project Type: ${projType.trim()}`);
    if (projDesc.trim()) lines.push(`Description: ${projDesc.trim()}`);
    lines.push(JSON_GUIDE);
    return lines.join("\n\n");
  };

  const handleGenerate = async (e) => {
    e.preventDefault();
    const idea = buildIdea();

    if (!ideaText.trim() && !projDesc.trim()) { setErr("Tell me a bit about the project first 🙂"); return; }
    if (GREETINGS.has(ideaText.trim().toLowerCase())) { setMd("👋 Add a short description and I’ll draft a structured requirements doc."); setIdeaText(""); return; }

    setLoading(true); setErr(""); setMd(""); setReqJson(null);

    const form = new FormData();
    form.append("project_idea", idea);
    form.append("model_choice", DEFAULT_MODEL);
    form.append("sections", "Purpose, Functional Requirements, Non-Functional Requirements, Constraints, Out of Scope, Risks & Mitigations, Open Questions, Use Cases");
    if (file) form.append("file", file);

    try {
      const res = await fetch(`${API_BASE}/generate-requirements/`, { method: "POST", body: form });
      const data = await res.json();
      const raw = data?.requirements ?? "";
      const parsed = tryParseRequirements(raw);
      if (parsed && Array.isArray(parsed.functional)) { setReqJson(parsed); setMd(""); }
      else { setReqJson(null); setMd(typeof raw === "string" ? raw : JSON.stringify(raw, null, 2)); }
    } catch {
      setErr("Could not reach the backend. Is it running?");
    } finally {
      setLoading(false); setIdeaText("");
    }
  };

  /* ---- Exports (PDF, DOCX/MD) ---- */
  const handleExportMarkdown = () => {
    const content = reqJson ? mdFromJson(reqJson) : md || "# Requirements\n\n(No data)";
    downloadBlob(content, "requirements.md", "text/markdown;charset=utf-8");
  };

  const handleExportPDF = async () => {
    try {
      let html;
      if (reqJson) {
        html = htmlForPdf(reqJson);
      } else {
        html = `<html><body><pre style="white-space:pre-wrap;font-family:ui-monospace,Consolas,monospace">${escapeHtml(md || "")}</pre></body></html>`;
      }

      const res = await fetch(`${API_BASE}/export/pdf`, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: html,
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const nice = (reqJson?.title || "requirements").replace(/[^\w-]+/g, "_");
      a.href = url;
      a.download = `${nice}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setErr(`PDF export failed: ${e?.message || e}`);
    }
  };

  const handleExportDocx = async () => {
    try {
      const payload = reqJson
        ? { json: reqJson }                                   // structured JSON path
        : { markdown: md || "", title: "Requirements" };      // markdown fallback

      const res = await fetch(`${API_BASE}/export/docx`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const nice = (reqJson?.title || "requirements").replace(/[^\w-]+/g, "_");
      a.href = url;
      a.download = `${nice}.docx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setErr(`DOCX export failed: ${e?.message || e}`);
    }
  };

  const downloadTxt = () => {
    if (!md) return;
    downloadBlob(md, "requirements.txt", "text/plain;charset=utf-8");
  };

  /* ───── Handlers for per-section editing ───── */
  const handleEditFunctionalRest = (newLines) => {
    setReqJson(prev => {
      if (!prev) return prev;
      const grouped = byLevel(prev.functional || [], (x)=> (x.level || levelOf(x.statement)));
      const top4 = pickTop4(grouped);
      const updated = [...top4, ...newLines];
      return { ...prev, functional: updated };
    });
  };

  // one NFR category 
  const handleEditNfrCategory = (categoryKey, newLines) => {
    setReqJson(prev => {
      if (!prev) return prev;
      const current = prev.nonFunctional || [];
      const buckets = bucketNFR(current);

      const existingCategoryItems = [
        ...buckets[categoryKey].MUST,
        ...buckets[categoryKey].SHOULD,
        ...buckets[categoryKey].COULD
      ].map(String);

      const keep = current.filter(n => !new Set(existingCategoryItems).has(String(n)));
      const cleaned = (newLines || []).map(s => s.trim()).filter(Boolean);

      return { ...prev, nonFunctional: [...keep, ...cleaned] };
    });
  };

  return (
    <div className="shell">
      {/* HERO */}
      <section className="hero">
        <div className="brand">MaiSpec</div>
        <h1>AI-Assisted Project<br/>Requirement Generator</h1>
        <p className="hero-sub">Quickly generate detailed requirements for your projects with the power of AI.</p>
        <a href="#generator" className="cta">Get Started</a>
      </section>

      {/* FEATURES */}
      <FeaturesSection />

      {/* HOW IT WORKS */}
      <section className="card how">
        <h2>How It Works</h2>
        <div className="timeline"><div className="dot">1</div><div className="line"/><div className="dot">2</div><div className="line"/><div className="dot">3</div></div>
        <div className="steps">
          <div className="step"><div className="step-title">Input</div><div className="step-sub">Describe your idea, pick a type and add a short description.</div></div>
          <div className="step"><div className="step-title">Generate</div><div className="step-sub">AI creates a well-structured draft for you.</div></div>
          <div className="step"><div className="step-title">Review &amp; Export</div><div className="step-sub">Download as PDF/DOCX/Markdown and Iterate freely.</div></div>
        </div>
      </section>

      {/* GENERATOR */}
      <section id="generator" className="card generator pd">
        <h2>Project Details</h2>

        <form onSubmit={handleGenerate} className="pd-form">
          <div className={`bar ${loading ? "bar-disabled" : ""}`}>
            <button type="button" className="icon-btn" title="Attach file" onClick={()=>fileRef.current?.click()} disabled={loading}><Paperclip/></button>
            <input type="file" accept=".pdf,.docx,.pptx,.xlsx,.txt" ref={fileRef} onChange={(e)=>setFile(e.target.files[0])} style={{display:"none"}}/>

            <button type="button" className={`icon-btn ${listening?"on":""}`} title="Speak" onClick={startMic} disabled={loading}><Mic on={listening}/></button>

            <input
              ref={inputRef}
              className="bar-input"
              placeholder="Describe your main idea…"
              value={ideaText}
              onChange={(e)=>setIdeaText(e.target.value)}
              onKeyDown={(e)=>{ if (e.key==="Enter" && !e.shiftKey){ e.preventDefault(); handleGenerate(e);} }}
              disabled={loading}
            />

            <button type="submit" className="send" disabled={loading}>{loading ? <span className="spin"/> : "→"}</button>
          </div>

          {file && !loading && <div className="filechip">📎 {file.name}</div>}
          {loading && <div className="note">Generating requirements…</div>}
          {err && <div className="err">{err}</div>}

          <div className="pd-row">
            <div className="pd-col">
              <span className="pd-label">Project type</span>
              <div className="pd-seg">
                {PROJECT_TYPES.map((t)=>(
                  <button key={t} type="button" className={`pd-seg-btn ${projType===t?"is-active":""}`} onClick={()=>setProjType(t)}>{t}</button>
                ))}
              </div>
            </div>
          </div>

          <label className="pd-label" htmlFor="projDesc">Short description</label>
          <textarea
            id="projDesc"
            className="pd-textarea"
            rows={4}
            placeholder="What is it? Who is it for? Key goals?"
            value={projDesc}
            onChange={(e)=>setProjDesc(e.target.value)}
          />

          <div className="pd-suggest">
            <p className="pd-suggest-title">Not sure where to start? Try one of these:</p>
            <div className="pd-chips">
              {STARTER_TEMPLATES.map((s)=>(
                <button key={s} type="button" className="pd-chip" onClick={()=>{ setIdeaText(s); setTimeout(()=>inputRef.current?.focus(),0); }}>{s}</button>
              ))}
            </div>
          </div>
        </form>

        {reqJson ? (
          <RequirementsView
            data={reqJson}
            onPdf={handleExportPDF}
            onDocx={handleExportDocx}
            onMd={handleExportMarkdown}
            onEditFunctionalRest={handleEditFunctionalRest}
            onEditNfrCategory={handleEditNfrCategory}
          />
        ) : (
          md && (
            <>
              <h3 className="outTitle">Generated Requirements</h3>
              <div style={{ display: "flex", gap: 12, margin: "6px 0 10px" }}>
                <button className="download" type="button" onClick={handleExportPDF}>Export PDF</button>
                <button className="download" type="button" onClick={handleExportDocx}>Export DOCX</button>
                <button className="download" type="button" onClick={handleExportMarkdown}>Export Markdown</button>
              </div>
              <div className="out">
                <ReactMarkdown
                  children={md}
                  components={{
                    table: (p) => <table className="md-table" {...p} />,
                    th: (p) => <th className="md-th" {...p} />,
                    td: (p) => <td className="md-td" {...p} />,
                    li: (p) => <li className="md-li" {...p} />,
                  }}
                />
              </div>
              <button className="download" onClick={downloadTxt}>Download as TXT</button>
            </>
          )
        )}

        {/* Footer*/}
        <footer className="site-footer" aria-label="Site footer">
          <div className="foot-left">
            <div className="foot-logo">MaiSpec</div>
            <p className="foot-tag">Instant, export-ready requirements.</p>
          </div>

          <nav className="foot-links" aria-label="Footer links">
            <a href="#generator">Get started</a>
            <a href="mailto:garimamehra464@gmail.com">Contact</a>
          </nav>

          <div className="foot-right">
            <div>2025 MaiSpec</div>
          </div>
        </footer>
      </section>
    </div>
  );
}
