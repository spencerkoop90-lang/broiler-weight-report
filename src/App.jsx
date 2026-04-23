import { useState, useMemo, useCallback } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Cell, ComposedChart } from "recharts";

const ROSS = {0:44,1:62,2:81,3:102,4:125,5:151,6:181,7:213,8:249,9:288,10:330,11:376,12:425,13:477,14:533,15:592,16:655,17:720,18:789,19:860,20:935,21:1012,22:1092,23:1174,24:1258,25:1345,26:1434,27:1524,28:1616,29:1710,30:1805,31:1901,32:1999,33:2097,34:2196,35:2296,36:2396,37:2496,38:2597,39:2697,40:2798,41:2898,42:2998,43:3097,44:3197,45:3295,46:3393,47:3490,48:3586,49:3681,50:3776,51:3869,52:3961,53:4052,54:4142,55:4230,56:4318};

function getRoss(day) {
  if (ROSS[day] !== undefined) return ROSS[day];
  const days = Object.keys(ROSS).map(Number).sort((a, b) => a - b);
  if (day < 0 || day > 56) return null;
  for (let i = 0; i < days.length - 1; i++) {
    if (day >= days[i] && day <= days[i + 1]) {
      const f = (day - days[i]) / (days[i + 1] - days[i]);
      return Math.round(ROSS[days[i]] + f * (ROSS[days[i + 1]] - ROSS[days[i]]));
    }
  }
  return null;
}

function parseCSV(text) {
  const clean = text.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const lines = clean.split("\n").filter((l) => l.trim());
  const meta = { count: 0, cv: 0, average: 0, uniformity: 0, stdev: 0 };
  const weights = [];
  let wCol = -1;
  for (const line of lines) {
    const raw = line.split("\t").map((c) => c.trim());
    const cols = raw.map((c) => c.replace(/^"|"$/g, "").replace(/,/g, ""));
    if (raw[0] === "File:" || raw[0].endsWith("File:")) {
      for (let i = 0; i < cols.length - 1; i++) {
        if (raw[i].trim().startsWith("Count")) { const v = parseFloat(cols[i + 1]); if (!isNaN(v)) meta.count = v; }
        if (raw[i].trim().startsWith("CV")) { const v = parseFloat(cols[i + 1]); if (!isNaN(v)) meta.cv = v; }
      }
    } else if (raw[0] === "Scale:") {
      for (let i = 0; i < cols.length - 1; i++) {
        if (raw[i].trim().startsWith("Average")) { const v = parseFloat(cols[i + 1]); if (!isNaN(v)) meta.average = v; }
        if (raw[i].trim().startsWith("Uniformity")) { const v = parseFloat(cols[i + 1]); if (!isNaN(v)) meta.uniformity = v; }
      }
    } else if (raw[0] === "Note:") {
      for (let i = 0; i < cols.length - 1; i++) {
        if (raw[i].trim().startsWith("St. deviation")) { const v = parseFloat(cols[i + 1]); if (!isNaN(v)) meta.stdev = v; }
      }
    } else if (raw[0] === "File" && raw.some((c) => c.trim().startsWith("Weight"))) {
      wCol = raw.findIndex((c) => c.trim().startsWith("Weight"));
    } else {
      const tryC = wCol >= 0 ? [wCol] : [2, 3];
      for (const ci of tryC) {
        if (cols[ci]) { const w = parseFloat(cols[ci]); if (!isNaN(w) && w > 50 && w < 15000) { weights.push(w); break; } }
      }
    }
  }
  if (weights.length > 0) {
    const avg = weights.reduce((a, b) => a + b, 0) / weights.length;
    const sd = Math.sqrt(weights.reduce((a, w) => a + Math.pow(w - avg, 2), 0) / (weights.length - 1));
    if (!meta.count) meta.count = weights.length;
    if (!meta.average) meta.average = Math.round(avg * 100) / 100;
    if (!meta.stdev) meta.stdev = Math.round(sd);
    if (!meta.cv) meta.cv = Math.round((sd / avg) * 1000) / 10;
    if (!meta.uniformity) { const inB = weights.filter((w) => w >= avg * 0.9 && w <= avg * 1.1).length; meta.uniformity = Math.round((inB / weights.length) * 1000) / 10; }
  }
  return { meta, weights };
}

function histogram(w, bin) { if (!w.length) return []; bin = bin || 100; const mn = Math.floor(Math.min(...w) / bin) * bin; const mx = Math.ceil(Math.max(...w) / bin) * bin; const bins = []; for (let e = mn; e < mx; e += bin) { const c = w.filter((v) => v >= e && v < e + bin).length; bins.push({ range: String(e), label: e + "\u2013" + (e + bin), mid: e + bin / 2, count: c, pct: Math.round((c / w.length) * 1000) / 10 }); } return bins; }
function pctiles(w) { const s = [...w].sort((a, b) => a - b); const pc = (p) => { const i = (p / 100) * (s.length - 1); const lo = Math.floor(i); const hi = Math.ceil(i); return lo === hi ? s[lo] : Math.round(s[lo] + (i - lo) * (s[hi] - s[lo])); }; return { p5: pc(5), p10: pc(10), p25: pc(25), p50: pc(50), p75: pc(75), p90: pc(90), p95: pc(95), min: s[0], max: s[s.length - 1] }; }
function calcAge(pd, wd) { return Math.round((new Date(wd + "T00:00:00") - new Date(pd + "T00:00:00")) / 86400000); }

/* Barn data is loaded via file upload at runtime */

const C = { bg:"#fff",sf:"#F6F7F5",sb:"#E4E6E1",tx:"#1A1D17",tm:"#6B7064",tf:"#9DA394",tu:"#BCC2B6",gn:"#2E7D32",gl:"#4CAF50",gb:"rgba(46,125,50,0.08)",gbd:"rgba(46,125,50,0.2)",or:"#C4501A",ob:"rgba(196,80,26,0.08)",obd:"rgba(196,80,26,0.2)",gr:"rgba(0,0,0,0.06)" };
const M = "'JetBrains Mono',monospace";
const S = "'Source Sans 3','Source Sans Pro',sans-serif";

const KPI = ({ label, value, unit, sub, color, sm }) => (
  <div style={{ background: C.sf, border: "1px solid " + C.sb, borderRadius: 8, padding: sm ? "8px 12px" : "12px 16px", minWidth: sm ? 90 : 120, flex: 1 }}>
    <div style={{ fontSize: sm ? 8 : 10, textTransform: "uppercase", letterSpacing: "0.1em", color: C.tf, fontFamily: M, marginBottom: sm ? 2 : 4 }}>{label}</div>
    <div style={{ fontSize: sm ? 18 : 26, fontWeight: 700, color: color || C.tx, fontFamily: S, lineHeight: 1.1 }}>{value}<span style={{ fontSize: sm ? 9 : 12, fontWeight: 400, color: C.tf, marginLeft: 3 }}>{unit}</span></div>
    {sub && <div style={{ fontSize: sm ? 8 : 10, color: C.tm, marginTop: sm ? 1 : 3, fontFamily: M }}>{sub}</div>}
  </div>
);

function BarnReport({ barn, pm }) {
  const { meta, weights, flockId, barnName, age } = barn;
  const hist = useMemo(() => histogram(weights), [weights]);
  const pcs = useMemo(() => weights.length > 0 ? pctiles(weights) : null, [weights]);
  const aviDay = age - 1;
  const ross = useMemo(() => getRoss(aviDay), [aviDay]);
  const rv = ross ? Math.round(((meta.average - ross) / ross) * 1000) / 10 : null;
  const rc = rv === null ? C.tm : rv >= 0 ? C.gn : C.or;
  const dots = useMemo(() => weights.map((w, i) => ({ n: i + 1, w: w })), [weights]);
  const sm = pm;
  const ch = sm ? 165 : 220;
  const px = sm ? 20 : 28;

  return (
    <div style={{ borderBottom: "2px solid " + C.sb, paddingBottom: sm ? 10 : 18, marginBottom: sm ? 10 : 18 }}>
      <div style={{ padding: sm ? "10px 20px 6px" : "14px 28px 10px" }}>
        <h2 style={{ margin: 0, fontSize: sm ? 14 : 17, fontWeight: 700 }}>{barnName}</h2>
        <div style={{ fontSize: sm ? 9 : 11, color: C.tm, fontFamily: M, marginTop: 2 }}>{flockId} · Day {age} (Aviagen d{aviDay}) · n={meta.count}</div>
      </div>
      <div style={{ padding: "0 " + px + "px", display: "flex", gap: sm ? 4 : 8, flexWrap: "wrap", marginBottom: sm ? 6 : 10 }}>
        <KPI sm={sm} label="Average" value={meta.average.toLocaleString()} unit="g" />
        <KPI sm={sm} label="CV" value={meta.cv} unit="%" sub={meta.cv <= 10 ? "Excellent" : meta.cv <= 13 ? "Good" : meta.cv <= 16 ? "Fair" : "High"} color={meta.cv <= 10 ? C.gn : meta.cv <= 13 ? C.gl : meta.cv <= 16 ? "#B8860B" : C.or} />
        <KPI sm={sm} label="Uniformity" value={meta.uniformity} unit="%" sub="scale reported" color={meta.uniformity >= 80 ? C.gn : meta.uniformity >= 70 ? "#B8860B" : C.or} />
        <KPI sm={sm} label="Std Dev" value={meta.stdev} unit="g" />
        {ross && <KPI sm={sm} label="vs Ross" value={(rv >= 0 ? "+" : "") + rv} unit="%" sub={"Target: " + ross.toLocaleString() + "g"} color={rc} />}
      </div>
      <div style={{ padding: "0 " + px + "px", marginBottom: sm ? 6 : 12 }}>
        <h3 style={{ margin: "0 0 4px", fontSize: sm ? 11 : 13, fontWeight: 600 }}>Weight Distribution</h3>
        <div style={{ background: C.sf, borderRadius: 8, border: "1px solid " + C.sb, padding: (sm ? 6 : 10) + "px " + (sm ? 4 : 8) + "px 2px" }}>
          <ResponsiveContainer width="100%" height={ch}>
            <BarChart data={hist} barCategoryGap="12%">
              <CartesianGrid strokeDasharray="3 3" stroke={C.gr} vertical={false} />
              <XAxis dataKey="range" tick={{ fontSize: 8, fill: C.tf, fontFamily: M }} axisLine={{ stroke: C.sb }} tickLine={false} tickFormatter={(v) => parseInt(v) / 1000 + "k"} />
              <YAxis tick={{ fontSize: 8, fill: C.tf, fontFamily: M }} axisLine={false} tickLine={false} />
              {ross && <ReferenceLine x={String(Math.floor(ross / 100) * 100)} stroke="#C4501A" strokeWidth={2.5} strokeDasharray="8 4" label={{ value: "Ross 308: " + ross.toLocaleString() + "g", position: "top", style: { fontSize: sm ? 8 : 10, fill: "#C4501A", fontFamily: M, fontWeight: 700 } }} />}
              <ReferenceLine x={String(Math.floor(meta.average / 100) * 100)} stroke="#2563EB" strokeWidth={2.5} label={{ value: "Avg: " + meta.average.toLocaleString() + "g", position: "top", style: { fontSize: sm ? 8 : 10, fill: "#2563EB", fontFamily: M, fontWeight: 700 } }} />
              <Bar dataKey="count" radius={[3, 3, 0, 0]}>
                {hist.map((e, i) => { const d = Math.abs(e.mid - meta.average) / (meta.stdev || 1); return <Cell key={i} fill={"rgba(72,130,70," + Math.max(0.25, 1 - d * 0.18) + ")"} />; })}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <div style={{ display: "flex", justifyContent: "center", gap: sm ? 14 : 20, paddingTop: 4, paddingBottom: 2 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: sm ? 8 : 10, fontFamily: M, color: C.tm }}>
              <div style={{ width: 18, height: 2.5, background: "#2563EB", borderRadius: 1 }} /> <span style={{ color: "#2563EB", fontWeight: 600 }}>Flock Average: {meta.average.toLocaleString()}g</span>
            </div>
            {ross && <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: sm ? 8 : 10, fontFamily: M, color: C.tm }}>
              <div style={{ width: 18, height: 0, borderTop: "2.5px dashed #C4501A" }} /> <span style={{ color: "#C4501A", fontWeight: 600 }}>Ross 308 Target: {ross.toLocaleString()}g</span>
            </div>}
          </div>
        </div>
      </div>
      {pcs && (
        <div style={{ padding: "0 " + px + "px", marginBottom: sm ? 6 : 12 }}>
          <h3 style={{ margin: "0 0 5px", fontSize: sm ? 11 : 13, fontWeight: 600 }}>Spread & Percentiles</h3>
          <div style={{ background: C.sf, borderRadius: 8, border: "1px solid " + C.sb, padding: sm ? "14px 12px 10px" : "20px 18px 14px" }}>
            <div style={{ position: "relative", height: sm ? 45 : 55, marginBottom: sm ? 12 : 16 }}>
              {(function () {
                var mn = pcs.min, mx = pcs.max, rng = mx - mn || 1;
                var pos = function (v) { return ((v - mn) / rng) * 100; };
                var lh = sm ? 22 : 28;
                return (
                  <>
                    <div style={{ position: "absolute", top: lh / 2 + 2, left: pos(pcs.p5) + "%", right: (100 - pos(pcs.p95)) + "%", height: 1, background: C.sb }} />
                    <div style={{ position: "absolute", top: 2, left: pos(pcs.p25) + "%", width: (pos(pcs.p75) - pos(pcs.p25)) + "%", height: lh, background: C.gb, border: "1px solid " + C.gbd, borderRadius: 4 }} />
                    <div style={{ position: "absolute", top: 0, left: pos(pcs.p50) + "%", width: 2.5, height: lh + 4, background: C.gn, borderRadius: 2 }} />
                    <div style={{ position: "absolute", top: lh / 2 - 4, left: pos(meta.average) + "%", width: sm ? 10 : 12, height: sm ? 10 : 12, background: C.tx, borderRadius: "50%", transform: "translate(-5px,0)", border: "2px solid #fff", boxShadow: "0 1px 3px rgba(0,0,0,0.15)" }} />
                    {ross && ross >= mn && ross <= mx && (
                      <div style={{ position: "absolute", top: -2, left: pos(ross) + "%", transform: "translateX(-5px)" }}>
                        <div style={{ width: 0, height: 0, borderLeft: "5px solid transparent", borderRight: "5px solid transparent", borderTop: "8px solid " + C.or }} />
                      </div>
                    )}
                    {[[pcs.p5, "P5", C.tu], [pcs.p25, "P25", C.tf], [pcs.p50, "Med", C.gn], [pcs.p75, "P75", C.tf], [pcs.p95, "P95", C.tu]].map(function (arr) {
                      return <div key={arr[1]} style={{ position: "absolute", top: lh + 8, left: pos(arr[0]) + "%", transform: "translateX(-50%)", fontSize: sm ? 7 : 8, color: arr[2], fontFamily: M, whiteSpace: "nowrap", fontWeight: arr[1] === "Med" ? 600 : 400 }}>{arr[1]}: {arr[0].toLocaleString()}</div>;
                    })}
                  </>
                );
              })()}
            </div>
            <div style={{ display: "flex", gap: sm ? 12 : 16, justifyContent: "center", flexWrap: "wrap" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: sm ? 8 : 9, color: C.tm, fontFamily: M }}><div style={{ width: 8, height: 8, background: C.tx, borderRadius: "50%", border: "1.5px solid #fff", boxShadow: "0 0 0 1px rgba(0,0,0,0.1)" }} /> Mean</div>
              <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: sm ? 8 : 9, color: C.tm, fontFamily: M }}><div style={{ width: 2, height: 10, background: C.gn, borderRadius: 1 }} /> Median</div>
              <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: sm ? 8 : 9, color: C.tm, fontFamily: M }}><div style={{ width: 14, height: 8, background: C.gb, border: "1px solid " + C.gbd, borderRadius: 2 }} /> IQR</div>
              {ross && <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: sm ? 8 : 9, color: C.tm, fontFamily: M }}><div style={{ width: 0, height: 0, borderLeft: "4px solid transparent", borderRight: "4px solid transparent", borderTop: "6px solid " + C.or }} /> Ross 308</div>}
            </div>
          </div>
        </div>
      )}
      <div style={{ padding: "0 " + px + "px", marginBottom: sm ? 6 : 10 }}>
        <h3 style={{ margin: "0 0 4px", fontSize: sm ? 11 : 13, fontWeight: 600 }}>Individual Bird Weights</h3>
        <div style={{ background: C.sf, borderRadius: 8, border: "1px solid " + C.sb, padding: (sm ? 4 : 8) + "px " + (sm ? 4 : 8) + "px 2px" }}>
          <ResponsiveContainer width="100%" height={sm ? 120 : 160}>
            <ComposedChart data={dots}>
              <CartesianGrid strokeDasharray="3 3" stroke={C.gr} vertical={false} />
              <XAxis dataKey="n" tick={{ fontSize: 8, fill: C.tf, fontFamily: M }} axisLine={{ stroke: C.sb }} tickLine={false} />
              <YAxis tick={{ fontSize: 8, fill: C.tf, fontFamily: M }} axisLine={false} tickLine={false} domain={["dataMin-100", "dataMax+100"]} tickFormatter={(v) => (v / 1000).toFixed(1) + "k"} />
              <ReferenceLine y={meta.average} stroke={C.tf} strokeDasharray="4 4" strokeWidth={1} />
              {ross && <ReferenceLine y={ross} stroke={C.or} strokeDasharray="6 3" strokeWidth={1} />}
              <Bar dataKey="w" radius={[2, 2, 0, 0]} maxBarSize={sm ? 3 : 5}>
                {dots.map((e, i) => { const ok = e.w >= meta.average * 0.9 && e.w <= meta.average * 1.1; return <Cell key={i} fill={ok ? "rgba(72,130,70,0.65)" : "rgba(196,80,26,0.55)"} />; })}
              </Bar>
            </ComposedChart>
          </ResponsiveContainer>
          <div style={{ textAlign: "center", fontSize: 8, color: C.tf, fontFamily: M }}><span style={{ color: C.gn }}>Green</span> = ±10% of mean · <span style={{ color: C.or }}>Orange</span> = outside</div>
        </div>
      </div>
      {pcs && (
        <div style={{ padding: "0 " + px + "px" }}>
          <h3 style={{ margin: "0 0 4px", fontSize: sm ? 11 : 13, fontWeight: 600 }}>Tail Analysis</h3>
          <div style={{ display: "flex", gap: sm ? 4 : 8, flexWrap: "wrap" }}>
            {[{ t: "Light Birds", th: "<P10: " + pcs.p10.toLocaleString() + "g", b: weights.filter((w) => w <= pcs.p10).sort((a, b) => a - b), bg: C.ob, bd: C.obd, c: C.or },
              { t: "Heavy Birds", th: ">P90: " + pcs.p90.toLocaleString() + "g", b: weights.filter((w) => w >= pcs.p90).sort((a, b) => b - a), bg: C.gb, bd: C.gbd, c: C.gn }
            ].map((x) => (
              <div key={x.t} style={{ flex: 1, minWidth: 140, background: C.sf, borderRadius: 8, border: "1px solid " + C.sb, padding: sm ? "6px 8px" : "8px 12px" }}>
                <div style={{ fontSize: sm ? 7.5 : 9, textTransform: "uppercase", letterSpacing: "0.08em", color: C.tf, fontFamily: M, marginBottom: 4 }}>{x.t} ({x.th})</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 2 }}>
                  {x.b.map((w, i) => (<span key={i} style={{ background: x.bg, border: "1px solid " + x.bd, borderRadius: 3, padding: "1px 4px", fontSize: sm ? 8 : 9, fontFamily: M, color: x.c }}>{w.toLocaleString()}</span>))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function App() {
  const [farmName, setFarmName] = useState("");
  const [weighDate, setWeighDate] = useState(new Date().toISOString().split('T')[0]);
  const [printMode, setPM] = useState(false);
  const [barns, setBarns] = useState([]);
  const [nxId, setNxId] = useState(1);
  const [showAdd, setShowAdd] = useState(true);
  const [nf, setNf] = useState("");
  const [nb, setNb] = useState("");
  const [np, setNp] = useState("");
  const [nr, setNr] = useState("");

  const addBarn = useCallback(() => {
    if (!nr.trim() || !np) return;
    const parsed = parseCSV(nr);
    setBarns((p) => [...p, { id: nxId, flockId: nf || "F" + nxId, barnName: nb || "Barn " + nxId, placementDate: np, parsed: parsed }]);
    setNxId((n) => n + 1); setNf(""); setNb(""); setNp(""); setNr(""); setShowAdd(false);
  }, [nf, nb, np, nr, nxId]);

  const removeBarn = useCallback((id) => setBarns((p) => p.filter((b) => b.id !== id)), []);

  const handleFile = useCallback((e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function (ev) {
      try {
        const u = new Uint8Array(ev.target.result);
        let t = new TextDecoder("utf-16le").decode(u);
        if (t.indexOf("File") < 0 && t.indexOf("Weight") < 0) t = new TextDecoder("utf-8").decode(u);
        setNr(t);
      } catch (err) { setNr(new TextDecoder("utf-8").decode(ev.target.result)); }
    };
    reader.readAsArrayBuffer(file);
  }, []);

  const ins = { background: "#fff", border: "1px solid " + C.sb, borderRadius: 6, padding: "8px 12px", color: C.tx, fontSize: 13, fontFamily: M, width: "100%", boxSizing: "border-box", outline: "none" };
  const btn = function (a) { return { background: a ? C.tx : C.sf, color: a ? "#fff" : C.tx, border: "1px solid " + (a ? "transparent" : C.sb), borderRadius: 6, padding: "8px 16px", fontSize: 12, fontFamily: M, cursor: "pointer" }; };

  const enriched = barns.map(function (b) { return { ...b, meta: b.parsed.meta, weights: b.parsed.weights, age: calcAge(b.placementDate, weighDate) }; });

  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.tx, fontFamily: S }}>

      {printMode && (
        <div className="no-print" style={{ background: "#FFF8E1", borderBottom: "2px solid #FFD54F", padding: "10px 28px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 13, fontFamily: M, color: "#5D4037" }}>Print mode active — close print dialog and click Exit when done</span>
          <button onClick={function () { setPM(false); }} style={{ ...btn(true), background: "#5D4037", fontSize: 11, padding: "6px 14px" }}>EXIT</button>
        </div>
      )}

      <div style={{ padding: printMode ? "14px 20px 8px" : "20px 28px 12px", borderBottom: "1px solid " + C.sb, display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 10 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: printMode ? 16 : 20, fontWeight: 700 }}>{farmName ? farmName + " \u2014 " : ""}Flock Weigh Report</h1>
          <div style={{ fontSize: 11, color: C.tm, fontFamily: M, marginTop: 3 }}>
            {new Date(weighDate + "T00:00:00").toLocaleDateString("en-CA", { year: "numeric", month: "short", day: "numeric" })} · {barns.length} barn{barns.length !== 1 ? "s" : ""} · Ross 308 (Aviagen 2022)
          </div>
        </div>
        {!printMode && (
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={function () { setPM(true); setTimeout(function() { window.print(); }, 500); }} style={btn(true)}>PRINT</button>
            <button onClick={function () { setShowAdd(!showAdd); }} style={btn(false)}>{showAdd ? "CANCEL" : "+ ADD BARN"}</button>
          </div>
        )}
      </div>

      {!printMode && (
        <div style={{ padding: "8px 28px", display: "flex", gap: 12, flexWrap: "wrap", borderBottom: "1px solid " + C.sb, background: C.sf }}>
          <div style={{ flex: "1 1 200px" }}><label style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: "0.08em", color: C.tf, display: "block", marginBottom: 3, fontFamily: M }}>Farm Name</label><input value={farmName} onChange={function (e) { setFarmName(e.target.value); }} style={ins} /></div>
          <div style={{ flex: "0 0 160px" }}><label style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: "0.08em", color: C.tf, display: "block", marginBottom: 3, fontFamily: M }}>Weigh Date</label><input type="date" value={weighDate} onChange={function (e) { setWeighDate(e.target.value); }} style={ins} /></div>
        </div>
      )}

      {!printMode && barns.length > 0 && (
        <div style={{ padding: "8px 28px", display: "flex", gap: 6, flexWrap: "wrap", borderBottom: "1px solid " + C.sb }}>
          {enriched.map(function (b) { return (
            <div key={b.id} style={{ display: "flex", alignItems: "center", gap: 6, background: C.sf, border: "1px solid " + C.sb, borderRadius: 6, padding: "4px 10px" }}>
              <span style={{ fontSize: 11, fontFamily: M }}>{b.flockId} · {b.barnName} · Day {b.age}</span>
              <button onClick={function () { removeBarn(b.id); }} style={{ background: "none", border: "none", color: C.or, cursor: "pointer", fontSize: 14, lineHeight: 1, padding: 0 }}>\u00d7</button>
            </div>
          ); })}
        </div>
      )}

      {!printMode && showAdd && (
        <div style={{ padding: "12px 28px", borderBottom: "1px solid " + C.sb, background: "#FAFAF8" }}>
          <div style={{ display: "flex", gap: 10, marginBottom: 10, flexWrap: "wrap" }}>
            <div style={{ flex: "1 1 100px" }}><label style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: "0.08em", color: C.tf, display: "block", marginBottom: 3, fontFamily: M }}>Flock ID</label><input value={nf} onChange={function (e) { setNf(e.target.value); }} placeholder="A202" style={ins} /></div>
            <div style={{ flex: "1 1 140px" }}><label style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: "0.08em", color: C.tf, display: "block", marginBottom: 3, fontFamily: M }}>Barn Name</label><input value={nb} onChange={function (e) { setNb(e.target.value); }} placeholder="Barn 12" style={ins} /></div>
            <div style={{ flex: "0 0 160px" }}><label style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: "0.08em", color: C.tf, display: "block", marginBottom: 3, fontFamily: M }}>Placement Date</label><input type="date" value={np} onChange={function (e) { setNp(e.target.value); }} style={ins} /></div>
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "flex-end", flexWrap: "wrap" }}>
            <div style={{ flex: "1 1 300px" }}><label style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: "0.08em", color: C.tf, display: "block", marginBottom: 3, fontFamily: M }}>Paste Scale Data</label><textarea value={nr} onChange={function (e) { setNr(e.target.value); }} rows={4} placeholder="Paste CSV export here..." style={{ ...ins, fontSize: 10, resize: "vertical", lineHeight: 1.4 }} /></div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6, paddingBottom: 4 }}>
              <label style={{ display: "inline-block", background: C.gb, border: "1px solid " + C.gbd, borderRadius: 6, padding: "7px 12px", fontSize: 10, fontFamily: M, color: C.gn, cursor: "pointer", textAlign: "center" }}>UPLOAD CSV<input type="file" accept=".csv,.tsv,.txt" onChange={handleFile} style={{ display: "none" }} /></label>
              <button onClick={addBarn} disabled={!nr.trim() || !np} style={{ ...btn(true), opacity: !nr.trim() || !np ? 0.4 : 1 }}>ADD</button>
            </div>
          </div>
        </div>
      )}

      <div style={{ padding: printMode ? "4px 0" : "8px 0" }}>
        {enriched.map(function (b) { return <BarnReport key={b.id} barn={b} pm={printMode} />; })}
      </div>

      {barns.length === 0 && <div className="no-print" style={{ padding: "60px 28px", textAlign: "center", color: C.tf, fontFamily: M, fontSize: 13 }}>Enter your farm name and weigh date above, then add barns with scale CSV data.</div>}

      <div style={{ padding: "8px 28px", borderTop: "1px solid " + C.sb, fontSize: 9, color: C.tu, fontFamily: M, display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
        <span>Ross 308: Aviagen 2022 (as-hatched) · Day 1 = placement</span>
        <span>Uniformity as reported by scale · Bird chart ±10% of mean</span>
      </div>
    </div>
  );
}
