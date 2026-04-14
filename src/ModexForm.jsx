import { useState, useEffect, useCallback } from "react";

const TEAM = ["Aditya", "Roshail", "Raunaq"];
const COMPANY_TYPES = [
  { id: "customer", label: "Potential Customer" },
  { id: "peer", label: "Peer Startup" },
  { id: "large_robotics", label: "Large Robotics / Automation" },
  { id: "si", label: "Systems Integrator" },
  { id: "investor_other", label: "Investor / Other" },
];
const TYPE_LABEL = { customer: "Potential Customer", peer: "Peer Startup", large_robotics: "Large Robotics / Automation", si: "Systems Integrator", investor_other: "Investor / Other" };
const TYPE_LABEL_SHORT = { customer: "Customer", peer: "Peer", large_robotics: "Robotics/Auto", si: "SI", investor_other: "Investor/Other" };
const INDUSTRIES = ["Food / Bakery", "Diagnostics / Pharma", "CPG / Cosmetics", "Logistics / 3PL", "Other"];
const AUTOMATION_LEVELS = ["Mostly Manual", "Partially Automated", "Mostly Automated"];
const PRIORITIES = [
  { id: "hot", label: "🔥 Hot", color: "#dc2626" },
  { id: "warm", label: "☀️ Warm", color: "#f59e0b" },
  { id: "not_fit", label: "❄️ Not a Fit", color: "#6b7280" },
];
const STORAGE_KEY = "modex-2026-entries";
const SHEETS_URL = "https://script.google.com/macros/s/AKfycbwQGD8yZytCL5_3CBhYYiYX6fzrUmZanJhQKo3XH6cUPLi_eguM1UF_TOFxHAFzqtyGuw/exec";
const SHEET_ID = "1k8gjd1UHVCfVc4rEskpJJC5Z7VPl-6NxNtrNgFBto1Q";
const SHEET_CSV_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=Sheet1`;

// Parse CSV from Google Sheets into entry objects
function parseSheetCSV(csv) {
  const lines = csv.trim().split("\n");
  if (lines.length < 2) return [];
  // Skip header row
  return lines.slice(1).map((line, idx) => {
    // Handle quoted CSV fields properly
    const cols = [];
    let cur = "", inQ = false;
    for (let i = 0; i < line.length; i++) {
      if (line[i] === '"' && !inQ) { inQ = true; continue; }
      if (line[i] === '"' && inQ && line[i+1] === '"') { cur += '"'; i++; continue; }
      if (line[i] === '"' && inQ) { inQ = false; continue; }
      if (line[i] === ',' && !inQ) { cols.push(cur); cur = ""; continue; }
      cur += line[i];
    }
    cols.push(cur);
    // Map columns: Timestamp,Recorder,Company,Contact,Title,Type,Industry,Automation Level,Pain Point,Top Manual Tasks,Building (Peer),Collab Angle,Other Notes,Priority,Follow-up Notes
    const typeRaw = (cols[5] || "").trim();
    return {
      id: `sheet-${idx}-${cols[0]}`,
      timestamp: cols[0] || "",
      recorder: cols[1] || "",
      companyName: cols[2] || "",
      contactName: cols[3] || "",
      contactTitle: cols[4] || "",
      companyType: typeRaw,
      industry: cols[6] || "",
      automationLevel: cols[7] || "",
      painPoint: cols[8] || "",
      topTasks: cols[9] || "",
      peerBuilding: cols[10] || "",
      collabAngle: cols[11] || "",
      otherNotes: cols[12] || "",
      priority: cols[13] || "",
      notes: cols[14] || "",
    };
  }).filter(e => e.companyName);
}

const BLANK_FORM = {
  recorder: "", companyName: "", contactName: "", contactTitle: "",
  companyType: "", industry: "", automationLevel: "", painPoint: "",
  topTasks: "", peerBuilding: "", collabAngle: "", otherNotes: "",
  priority: "", notes: "",
};

export default function ModexForm() {
  // localEntries = entries saved on this device (for list/detail view)
  const [localEntries, setLocalEntries] = useState([]);
  // sheetEntries = live data from Google Sheets (for stats/leaderboard)
  const [sheetEntries, setSheetEntries] = useState([]);
  const [sheetLoading, setSheetLoading] = useState(true);
  const [sheetError, setSheetError] = useState(false);
  const [view, setView] = useState("form");
  const [detailIdx, setDetailIdx] = useState(null);
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState(0);
  const [form, setForm] = useState({ ...BLANK_FORM });
  const [syncStatus, setSyncStatus] = useState(null);

  // Load local entries from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) setLocalEntries(JSON.parse(stored));
    } catch {}
    setLoading(false);
  }, []);

  // Fetch live data from Google Sheets
  const fetchSheetData = useCallback(async () => {
    setSheetLoading(true);
    setSheetError(false);
    try {
      const res = await fetch(SHEET_CSV_URL);
      if (!res.ok) throw new Error("fetch failed");
      const text = await res.text();
      setSheetEntries(parseSheetCSV(text));
    } catch {
      setSheetError(true);
    }
    setSheetLoading(false);
  }, []);

  useEffect(() => {
    fetchSheetData();
    // Auto-refresh every 60 seconds
    const interval = setInterval(fetchSheetData, 60000);
    return () => clearInterval(interval);
  }, [fetchSheetData]);

  const saveLocalEntries = (newEntries) => {
    setLocalEntries(newEntries);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(newEntries)); }
    catch (e) { console.error("Save failed:", e); }
  };

  const pushToSheets = async (entry) => {
    setSyncStatus("syncing");
    try {
      const params = new URLSearchParams({ data: JSON.stringify(entry) });
      // Use no-cors fetch instead of window.open — works on Android Chrome without popup blocking
      await fetch(`${SHEETS_URL}?${params.toString()}`, { method: "GET", mode: "no-cors" });
      setSyncStatus("ok");
      // Refresh sheet data after a short delay to pick up new entry
      setTimeout(fetchSheetData, 4000);
    } catch {
      setSyncStatus("fail");
    }
    setTimeout(() => setSyncStatus(null), 5000);
  };

  const resetForm = () => { setForm({ ...BLANK_FORM }); setStep(0); };

  const handleSubmit = async () => {
    const entry = {
      ...form,
      companyName: form.companyName.trim(),
      contactName: form.contactName.trim(),
      contactTitle: form.contactTitle.trim(),
      painPoint: form.painPoint.trim(),
      topTasks: form.topTasks.trim(),
      peerBuilding: form.peerBuilding.trim(),
      collabAngle: form.collabAngle.trim(),
      otherNotes: form.otherNotes.trim(),
      notes: form.notes.trim(),
      timestamp: new Date().toISOString(),
      id: Date.now().toString(),
    };
    saveLocalEntries([entry, ...localEntries]);
    await pushToSheets(entry);
    resetForm();
    setView("list");
  };

  const handleDelete = (id) => {
    saveLocalEntries(localEntries.filter(e => e.id !== id));
    setDetailIdx(null);
    setView("list");
  };

  const isCustomer = form.companyType === "customer";
  const totalSteps = isCustomer ? 5 : 4;
  const finalStep = 4;

  const canAdvance = () => {
    if (step === 0) return !!form.recorder;
    if (step === 1) return !!form.companyName.trim();
    if (step === 2) return !!form.companyType;
    if (step === 3 && isCustomer) return !!form.industry;
    return true;
  };

  const c = {
    bg: "#0a0a0a", card: "#141414", cardBorder: "#222", accent: "#e5ff00",
    text: "#e5e5e5", textMuted: "#888", textDark: "#0a0a0a",
    inputBg: "#1a1a1a", inputBorder: "#333", danger: "#ef4444",
  };

  const s = {
    container: { fontFamily: "'DM Sans','SF Pro Display',-apple-system,sans-serif", background: c.bg, color: c.text, minHeight: "100vh", maxWidth: 480, margin: "0 auto", padding: "0 16px 32px" },
    header: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 0 8px", borderBottom: `1px solid ${c.cardBorder}`, marginBottom: 20 },
    logo: { fontSize: 15, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: c.accent },
    headerBtn: (active) => ({ background: "none", border: `1px solid ${active ? c.accent + "66" : c.cardBorder}`, color: active ? c.accent : c.textMuted, fontSize: 13, padding: "6px 12px", borderRadius: 6, cursor: "pointer" }),
    stepLabel: { fontSize: 12, color: c.textMuted, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 6 },
    question: { fontSize: 22, fontWeight: 600, lineHeight: 1.3, marginBottom: 20 },
    optionBtn: (sel) => ({ display: "block", width: "100%", padding: "14px 16px", marginBottom: 10, background: sel ? c.accent : c.card, color: sel ? c.textDark : c.text, border: `1px solid ${sel ? c.accent : c.cardBorder}`, borderRadius: 10, fontSize: 15, fontWeight: sel ? 600 : 400, cursor: "pointer", textAlign: "left" }),
    input: { width: "100%", padding: "14px", background: c.inputBg, border: `1px solid ${c.inputBorder}`, borderRadius: 10, color: c.text, fontSize: 15, outline: "none", marginBottom: 12, boxSizing: "border-box" },
    textarea: { width: "100%", padding: "14px", background: c.inputBg, border: `1px solid ${c.inputBorder}`, borderRadius: 10, color: c.text, fontSize: 15, outline: "none", minHeight: 80, resize: "vertical", fontFamily: "inherit", boxSizing: "border-box", marginBottom: 12 },
    navRow: { display: "flex", gap: 10, marginTop: 24 },
    nextBtn: (ok) => ({ flex: 1, padding: "14px", background: ok ? c.accent : c.inputBg, color: ok ? c.textDark : c.textMuted, border: "none", borderRadius: 10, fontSize: 15, fontWeight: 600, cursor: ok ? "pointer" : "default", opacity: ok ? 1 : 0.5 }),
    backBtn: { padding: "14px 20px", background: c.card, color: c.textMuted, border: `1px solid ${c.cardBorder}`, borderRadius: 10, fontSize: 15, cursor: "pointer" },
    progressBar: { display: "flex", gap: 4, marginBottom: 24 },
    progressDot: (active) => ({ flex: 1, height: 3, borderRadius: 2, background: active ? c.accent : c.cardBorder }),
    entryCard: { background: c.card, border: `1px solid ${c.cardBorder}`, borderRadius: 12, padding: "14px 16px", marginBottom: 10, cursor: "pointer" },
    badge: (bg) => ({ display: "inline-block", padding: "3px 8px", borderRadius: 4, fontSize: 11, fontWeight: 600, background: bg || c.cardBorder, color: "#fff", marginRight: 6 }),
    fieldLabel: { fontSize: 11, color: c.textMuted, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4, marginTop: 14 },
  };

  const chipStyle = (sel) => ({ ...s.optionBtn(sel), width: "auto", display: "inline-block", padding: "10px 14px", fontSize: 13 });
  const priorityColor = { hot: "#dc2626", warm: "#f59e0b", not_fit: "#6b7280" };

  const Progress = () => (
    <div style={s.progressBar}>
      {Array.from({ length: totalSteps }).map((_, i) => (
        <div key={i} style={s.progressDot(i <= step)} />
      ))}
    </div>
  );

  const nav = (onNext, nextLabel = "Next") => (
    <div style={s.navRow}>
      {step > 0 && <button style={s.backBtn} onClick={() => setStep(st => st - 1)}>←</button>}
      <button style={s.nextBtn(canAdvance())} onClick={() => canAdvance() && onNext()}>{nextLabel}</button>
    </div>
  );

  const renderStep = () => {
    if (step === 0) return (
      <>
        <div style={s.stepLabel}>Step 1 of {totalSteps}</div>
        <div style={s.question}>Who had this conversation?</div>
        {TEAM.map(name => (
          <button key={name} style={s.optionBtn(form.recorder === name)} onClick={() => setForm(f => ({ ...f, recorder: name }))}>{name}</button>
        ))}
        {nav(() => setStep(1))}
      </>
    );
    if (step === 1) return (
      <>
        <div style={s.stepLabel}>Step 2 of {totalSteps}</div>
        <div style={s.question}>Who'd you talk to?</div>
        <input style={s.input} placeholder="Company name" value={form.companyName} onChange={e => setForm(f => ({ ...f, companyName: e.target.value }))} />
        <input style={s.input} placeholder="Contact name (optional)" value={form.contactName} onChange={e => setForm(f => ({ ...f, contactName: e.target.value }))} />
        <input style={s.input} placeholder="Title / role (optional)" value={form.contactTitle} onChange={e => setForm(f => ({ ...f, contactTitle: e.target.value }))} />
        {nav(() => setStep(2))}
      </>
    );
    if (step === 2) return (
      <>
        <div style={s.stepLabel}>Step 3 of {totalSteps}</div>
        <div style={s.question}>What type of company?</div>
        {COMPANY_TYPES.map(t => (
          <button key={t.id} style={s.optionBtn(form.companyType === t.id)} onClick={() => setForm(f => ({ ...f, companyType: t.id }))}>{t.label}</button>
        ))}
        {nav(() => setStep(3))}
      </>
    );
    if (step === 3 && isCustomer) return (
      <>
        <div style={s.stepLabel}>Step 4 of {totalSteps}</div>
        <div style={s.question}>Customer details</div>
        <div style={s.fieldLabel}>Industry</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
          {INDUSTRIES.map(ind => (
            <button key={ind} style={chipStyle(form.industry === ind || (ind === "Other" && form.industry !== "" && !INDUSTRIES.slice(0,-1).includes(form.industry)))} onClick={() => setForm(f => ({ ...f, industry: ind === "Other" ? "Other" : ind }))}>{ind}</button>
          ))}
        </div>
        {(form.industry === "Other" || (form.industry !== "" && !INDUSTRIES.slice(0,-1).includes(form.industry))) && (
          <input style={{ ...s.input, marginBottom: 16 }} placeholder="Describe the industry…" value={form.industry === "Other" ? "" : form.industry} onChange={e => setForm(f => ({ ...f, industry: e.target.value || "Other" }))} />
        )}
        <div style={s.fieldLabel}>Automation Level</div>
        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          {AUTOMATION_LEVELS.map(lvl => (
            <button key={lvl} style={{ ...chipStyle(form.automationLevel === lvl), flex: 1, textAlign: "center", padding: "10px 8px" }} onClick={() => setForm(f => ({ ...f, automationLevel: lvl }))}>{lvl}</button>
          ))}
        </div>
        <div style={s.fieldLabel}>Biggest pain point</div>
        <input style={s.input} placeholder="e.g. 30% breakage on vial kitting line" value={form.painPoint} onChange={e => setForm(f => ({ ...f, painPoint: e.target.value }))} />
        <div style={s.fieldLabel}>Top 3 manual tasks they'd automate</div>
        <textarea style={s.textarea} placeholder={"1. \n2. \n3. "} value={form.topTasks} onChange={e => setForm(f => ({ ...f, topTasks: e.target.value }))} />
        {nav(() => setStep(4))}
      </>
    );
    if (step === 3 && form.companyType === "peer") return (
      <>
        <div style={s.stepLabel}>Step 4 of {totalSteps}</div>
        <div style={s.question}>What are they building?</div>
        <textarea style={s.textarea} placeholder="Product / tech / focus area" value={form.peerBuilding} onChange={e => setForm(f => ({ ...f, peerBuilding: e.target.value }))} />
        <div style={s.fieldLabel}>Collaboration / partnership angle?</div>
        <textarea style={s.textarea} placeholder="Any overlap, integration potential, shared customers..." value={form.collabAngle} onChange={e => setForm(f => ({ ...f, collabAngle: e.target.value }))} />
        {nav(() => setStep(finalStep))}
      </>
    );
    if (step === 3 && !isCustomer && form.companyType !== "peer") return (
      <>
        <div style={s.stepLabel}>Step 4 of {totalSteps}</div>
        <div style={s.question}>Quick notes</div>
        <textarea style={{ ...s.textarea, minHeight: 120 }} placeholder="What's relevant about this conversation?" value={form.otherNotes} onChange={e => setForm(f => ({ ...f, otherNotes: e.target.value }))} />
        {nav(() => setStep(finalStep))}
      </>
    );
    return (
      <>
        <div style={s.stepLabel}>Step {totalSteps} of {totalSteps}</div>
        <div style={s.question}>Follow-up priority</div>
        <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
          {PRIORITIES.map(p => (
            <button key={p.id} style={{ flex: 1, padding: "14px 8px", background: form.priority === p.id ? p.color : c.card, color: form.priority === p.id ? "#fff" : c.textMuted, border: `1px solid ${form.priority === p.id ? p.color : c.cardBorder}`, borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: "pointer", textAlign: "center" }} onClick={() => setForm(f => ({ ...f, priority: p.id }))}>{p.label}</button>
          ))}
        </div>
        <div style={s.fieldLabel}>Anything else?</div>
        <textarea style={s.textarea} placeholder="Follow-up action, who to intro, timing..." value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
        <div style={s.navRow}>
          <button style={s.backBtn} onClick={() => setStep(st => st - 1)}>←</button>
          <button style={s.nextBtn(!!form.priority)} onClick={() => form.priority && handleSubmit()}>Save Entry ✓</button>
        </div>
      </>
    );
  };

  const SyncBanner = () => {
    if (!syncStatus) return null;
    const cfg = {
      ok:   { bg: "#052e16", border: "#166534", color: "#4ade80", text: "✓ Synced to Google Sheets" },
      fail: { bg: "#2d0a0a", border: "#7f1d1d", color: "#f87171", text: "⚠ Sheets sync failed — entry saved locally" },
    }[syncStatus];
    return (
      <div style={{ position: "sticky", top: 0, zIndex: 10, background: cfg.bg, border: `1px solid ${cfg.border}`, borderRadius: 8, padding: "10px 14px", marginBottom: 16, fontSize: 13, color: cfg.color }}>
        {cfg.text}
      </div>
    );
  };

  const ListView = () => (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div style={{ fontSize: 13, color: c.textMuted }}>{sheetEntries.length} conversation{sheetEntries.length !== 1 ? "s" : ""} · live from Google Sheets</div>
        <button onClick={fetchSheetData} style={{ background: "none", border: `1px solid ${c.cardBorder}`, color: c.textMuted, borderRadius: 6, padding: "5px 10px", fontSize: 12, cursor: "pointer" }}>
          {sheetLoading ? "⏳" : "↻ Refresh"}
        </button>
      </div>
      {sheetLoading && sheetEntries.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px 20px", color: c.textMuted }}>Loading from Google Sheets…</div>
      ) : sheetError && sheetEntries.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px 20px", color: c.textMuted }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>⚠️</div>
          <div>Couldn't load from Google Sheets.</div>
          <button onClick={fetchSheetData} style={{ marginTop: 16, ...s.backBtn, fontSize: 13 }}>Try again</button>
        </div>
      ) : sheetEntries.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px 20px", color: c.textMuted }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📋</div>
          <div>No entries yet. Go talk to people!</div>
        </div>
      ) : (
        <>
          {sheetEntries.map((e, i) => (
            <div key={e.id} style={s.entryCard} onClick={() => { setDetailIdx(i); setView("detail"); }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 4 }}>{e.companyName}</div>
                  <div style={{ fontSize: 13, color: c.textMuted }}>{e.contactName}{e.contactTitle && ` · ${e.contactTitle}`}</div>
                </div>
                <span style={s.badge(priorityColor[e.priority])}>{e.priority === "hot" ? "HOT" : e.priority === "warm" ? "WARM" : "PASS"}</span>
              </div>
              <div style={{ marginTop: 8, display: "flex", gap: 6, flexWrap: "wrap" }}>
                <span style={s.badge(c.cardBorder)}>{TYPE_LABEL_SHORT[e.companyType] || e.companyType}</span>
                {e.industry && <span style={s.badge(c.cardBorder)}>{e.industry}</span>}
                <span style={{ fontSize: 11, color: c.textMuted, alignSelf: "center" }}>by {e.recorder}</span>
              </div>
            </div>
          ))}
          <button style={{ ...s.backBtn, width: "100%", textAlign: "center", marginTop: 16, fontSize: 13 }} onClick={() => {
            const csv = entriesToCSV(sheetEntries);
            const blob = new Blob([csv], { type: "text/csv" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url; a.download = "modex_2026_conversations.csv"; a.click();
            URL.revokeObjectURL(url);
          }}>Export as CSV ↓</button>
        </>
      )}
    </>
  );

  // STATS VIEW — powered entirely by live Google Sheets data
  const StatsView = () => {
    const typeColors = { customer: "#e5ff00", peer: "#6366f1", large_robotics: "#06b6d4", si: "#f59e0b", investor_other: "#a855f7" };
    const medals = ["🥇", "🥈", "🥉"];
    const entries = sheetEntries;

    const personStats = TEAM.map(name => {
      const mine = entries.filter(e => e.recorder === name);
      const byType = {};
      COMPANY_TYPES.forEach(t => { const ct = mine.filter(e => e.companyType === t.id).length; if (ct > 0) byType[t.id] = ct; });
      return { name, total: mine.length, byType, hotCount: mine.filter(e => e.priority === "hot").length };
    }).sort((a, b) => b.total - a.total);
    const maxTotal = Math.max(...personStats.map(p => p.total), 1);
    const overallByType = {};
    COMPANY_TYPES.forEach(t => { const ct = entries.filter(e => e.companyType === t.id).length; if (ct > 0) overallByType[t.id] = ct; });

    return (
      <>
        <div style={{ marginBottom: 24, display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <div style={s.question}>Leaderboard</div>
            <div style={{ fontSize: 13, color: c.textMuted }}>
              {sheetLoading ? "Refreshing…" : sheetError ? "⚠ Couldn't load sheet data" : `${entries.length} total · live from Google Sheets`}
            </div>
          </div>
          <button onClick={fetchSheetData} style={{ background: "none", border: `1px solid ${c.cardBorder}`, color: c.textMuted, borderRadius: 6, padding: "6px 10px", fontSize: 12, cursor: "pointer" }}>
            {sheetLoading ? "⏳" : "↻ Refresh"}
          </button>
        </div>

        {sheetLoading && entries.length === 0 ? (
          <div style={{ textAlign: "center", padding: "60px 20px", color: c.textMuted }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>⏳</div>
            <div>Loading live data…</div>
          </div>
        ) : sheetError && entries.length === 0 ? (
          <div style={{ textAlign: "center", padding: "60px 20px", color: c.textMuted }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>⚠️</div>
            <div>Couldn't reach Google Sheets.<br/>Make sure the sheet is publicly accessible.</div>
            <button onClick={fetchSheetData} style={{ marginTop: 16, ...s.backBtn, fontSize: 13 }}>Try again</button>
          </div>
        ) : (
          <>
            {personStats.map((p, i) => (
              <div key={p.name} style={{ background: c.card, border: `1px solid ${i === 0 && p.total > 0 ? c.accent + "66" : c.cardBorder}`, borderRadius: 12, padding: 16, marginBottom: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 20 }}>{p.total > 0 ? (medals[i] || "") : ""}</span>
                    <span style={{ fontSize: 17, fontWeight: 600 }}>{p.name}</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    {p.hotCount > 0 && <span style={{ fontSize: 13, color: "#dc2626", fontWeight: 600 }}>🔥 {p.hotCount}</span>}
                    <span style={{ fontSize: 24, fontWeight: 700, color: p.total > 0 ? c.accent : c.textMuted }}>{p.total}</span>
                  </div>
                </div>
                <div style={{ height: 6, background: c.inputBg, borderRadius: 3, overflow: "hidden", marginBottom: p.total > 0 ? 12 : 0 }}>
                  <div style={{ height: "100%", width: `${(p.total / maxTotal) * 100}%`, background: i === 0 ? c.accent : c.textMuted, borderRadius: 3 }} />
                </div>
                {p.total > 0 && (
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {Object.entries(p.byType).map(([tid, count]) => (
                      <span key={tid} style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "4px 8px", borderRadius: 5, fontSize: 11, fontWeight: 500, background: typeColors[tid] + "22", color: typeColors[tid], border: `1px solid ${typeColors[tid]}33` }}>
                        {TYPE_LABEL_SHORT[tid]} <span style={{ fontWeight: 700 }}>{count}</span>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
            <div style={{ background: c.card, border: `1px solid ${c.cardBorder}`, borderRadius: 12, padding: 16, marginTop: 20 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: c.textMuted, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 14 }}>By Company Type</div>
              {Object.entries(overallByType).sort((a, b) => b[1] - a[1]).map(([tid, count]) => (
                <div key={tid} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ width: 10, height: 10, borderRadius: 3, background: typeColors[tid] }} />
                    <span style={{ fontSize: 14 }}>{TYPE_LABEL_SHORT[tid]}</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ height: 4, width: Math.max(20, (count / entries.length) * 120), background: typeColors[tid], borderRadius: 2 }} />
                    <span style={{ fontSize: 14, fontWeight: 600, minWidth: 20, textAlign: "right" }}>{count}</span>
                  </div>
                </div>
              ))}
            </div>
            {entries.some(e => e.priority === "hot") && (
              <div style={{ background: "#dc262615", border: "1px solid #dc262633", borderRadius: 12, padding: 16, marginTop: 12 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#dc2626", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>🔥 Hot Leads</div>
                {entries.filter(e => e.priority === "hot").map((e, i) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0", borderBottom: "1px solid #dc262620" }}>
                    <div>
                      <span style={{ fontSize: 14, fontWeight: 500 }}>{e.companyName}</span>
                      <span style={{ fontSize: 12, color: c.textMuted, marginLeft: 8 }}>{TYPE_LABEL_SHORT[e.companyType]}</span>
                    </div>
                    <span style={{ fontSize: 12, color: c.textMuted }}>{e.recorder}</span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </>
    );
  };

  const DetailView = () => {
    if (detailIdx === null || !sheetEntries[detailIdx]) return null;
    const e = sheetEntries[detailIdx];
    const timeStr = new Date(e.timestamp).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
    return (
      <>
        <button style={{ ...s.backBtn, marginBottom: 20, fontSize: 13 }} onClick={() => setView("list")}>← Back</button>
        <div style={{ fontSize: 22, fontWeight: 600, marginBottom: 4 }}>{e.companyName}</div>
        <div style={{ fontSize: 14, color: c.textMuted, marginBottom: 16 }}>{e.contactName}{e.contactTitle && ` · ${e.contactTitle}`} · {timeStr} · by {e.recorder}</div>
        <div style={{ display: "flex", gap: 6, marginBottom: 20, flexWrap: "wrap" }}>
          <span style={s.badge(priorityColor[e.priority])}>{e.priority === "hot" ? "HOT" : e.priority === "warm" ? "WARM" : "PASS"}</span>
          <span style={s.badge(c.cardBorder)}>{TYPE_LABEL[e.companyType]}</span>
          {e.industry && <span style={s.badge(c.cardBorder)}>{e.industry}</span>}
          {e.automationLevel && <span style={s.badge(c.cardBorder)}>{e.automationLevel}</span>}
        </div>
        {e.companyType === "customer" && <>
          {e.painPoint && <><div style={s.fieldLabel}>Pain Point</div><div style={{ fontSize: 14, lineHeight: 1.5, marginBottom: 8 }}>{e.painPoint}</div></>}
          {e.topTasks && <><div style={s.fieldLabel}>Top Manual Tasks to Automate</div><div style={{ fontSize: 14, lineHeight: 1.5, whiteSpace: "pre-wrap", marginBottom: 8 }}>{e.topTasks}</div></>}
        </>}
        {e.companyType === "peer" && <>
          {e.peerBuilding && <><div style={s.fieldLabel}>What They're Building</div><div style={{ fontSize: 14, lineHeight: 1.5, marginBottom: 8 }}>{e.peerBuilding}</div></>}
          {e.collabAngle && <><div style={s.fieldLabel}>Collaboration Angle</div><div style={{ fontSize: 14, lineHeight: 1.5, marginBottom: 8 }}>{e.collabAngle}</div></>}
        </>}
        {!["customer", "peer"].includes(e.companyType) && e.otherNotes && <>
          <div style={s.fieldLabel}>Notes</div>
          <div style={{ fontSize: 14, lineHeight: 1.5, marginBottom: 8 }}>{e.otherNotes}</div>
        </>}
        {e.notes && <><div style={s.fieldLabel}>Follow-up Notes</div><div style={{ fontSize: 14, lineHeight: 1.5 }}>{e.notes}</div></>}
        <button style={{ ...s.backBtn, width: "100%", textAlign: "center", marginTop: 24, color: c.danger, borderColor: c.danger + "44", fontSize: 13 }}
          onClick={() => { if (window.confirm("Delete this entry?")) handleDelete(e.id); }}>
          Delete Entry
        </button>
      </>
    );
  };

  if (loading) return (
    <div style={{ ...s.container, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ color: c.textMuted }}>Loading…</div>
    </div>
  );

  return (
    <div style={s.container}>
      <div style={s.header}>
        <div style={s.logo}>Index · MODEX '26</div>
        <div style={{ display: "flex", gap: 8 }}>
          <button style={s.headerBtn(view === "stats")} onClick={() => setView("stats")}>🏆</button>
          {view === "form" ? (
            <button style={s.headerBtn(false)} onClick={() => setView("list")}>{localEntries.length > 0 ? `${localEntries.length} saved` : "View all"}</button>
          ) : (
            <>
              <button style={s.headerBtn(view === "list")} onClick={() => setView("list")}>List</button>
              <button style={s.headerBtn(false)} onClick={() => { resetForm(); setView("form"); }}>+ New</button>
            </>
          )}
        </div>
      </div>

      <SyncBanner />

      {view === "form" && (<><Progress />{renderStep()}</>)}
      {view === "list" && <ListView />}
      {view === "stats" && <StatsView />}
      {view === "detail" && <DetailView />}
    </div>
  );
}

function entriesToCSV(entries) {
  const headers = ["Timestamp","Recorder","Company","Contact","Title","Type","Industry","Automation Level","Pain Point","Top Manual Tasks","Building (Peer)","Collab Angle","Other Notes","Priority","Follow-up Notes"];
  const esc = v => `"${(v || "").replace(/"/g, '""')}"`;
  const rows = entries.map(e => [
    e.timestamp, e.recorder, e.companyName, e.contactName, e.contactTitle,
    TYPE_LABEL[e.companyType] || e.companyType,
    e.industry, e.automationLevel, e.painPoint, e.topTasks,
    e.peerBuilding, e.collabAngle, e.otherNotes, e.priority, e.notes
  ].map(esc).join(","));
  return [headers.join(","), ...rows].join("\n");
}
