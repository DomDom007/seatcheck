// Seatcheck: import seat lists from your software tools and find paid seats nobody has used lately.
import { useMemo, useState } from "react";
import { csvObjects, num, toCsv } from "./lib/csv";
import { moneyFmt } from "./lib/money";
import { download, useStored } from "./lib/store";
import { CurrencySelect, ImportBox, Section, Stat, Stats } from "./ui/kit";

const T = "seatcheck";
type Seat = { tool: string; user: string; last: string; cost: number; reclaimed?: boolean };
const d = (days: number) => new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
const SAMPLE: Seat[] = [
  ...["amira", "walid", "ines", "karim", "salma", "hedi", "olfa", "aziz"].map((u, i) => ({ tool: "Figma", user: `${u}@acme.tn`, last: d([2, 5, 90, 1, 140, 3, 61, 200][i]), cost: 15 })),
  ...["amira", "walid", "ines", "karim", "salma", "hedi"].map((u, i) => ({ tool: "Notion", user: `${u}@acme.tn`, last: d([1, 1, 2, 75, 4, 0][i]), cost: 10 })),
  ...["walid", "ines", "karim", "olfa"].map((u, i) => ({ tool: "GitHub Copilot", user: `${u}@acme.tn`, last: d([0, 3, 120, 95][i]), cost: 19 })),
  ...["hedi", "olfa", "aziz"].map((u, i) => ({ tool: "Zoom Pro", user: `${u}@acme.tn`, last: d([7, 40, 180][i]), cost: 14 })),
];

export default function Seatcheck() {
  const [seats, setSeats] = useStored<Seat[]>(T, "seats", SAMPLE);
  const [days, setDays] = useStored(T, "days", 60);
  const [cur, setCur] = useStored(T, "cur", "USD");
  const [imp, setImp] = useState({ tool: "", cost: "" });
  const money = moneyFmt(cur);
  const age = (s: Seat) => s.last ? Math.floor((Date.now() - new Date(s.last).getTime()) / 86400000) : 9999;
  const idle = seats.filter(s => age(s) >= days && !s.reclaimed);
  const monthly = seats.filter(s => !s.reclaimed).reduce((a, s) => a + s.cost, 0);
  const waste = idle.reduce((a, s) => a + s.cost, 0);
  const saved = seats.filter(s => s.reclaimed).reduce((a, s) => a + s.cost, 0);
  const tools = useMemo(() => [...new Set(seats.map(s => s.tool))].map(t => {
    const list = seats.filter(s => s.tool === t && !s.reclaimed);
    return { t, total: list.length, idle: list.filter(s => age(s) >= days).length, cost: list.reduce((a, s) => a + s.cost, 0), waste: list.filter(s => age(s) >= days).reduce((a, s) => a + s.cost, 0) };
  }).sort((a, b) => b.waste - a.waste), [seats, days]);
  const key = (s: Seat) => s.tool + "|" + s.user;

  const importCsv = (text: string) => {
    const rows = csvObjects(text).map(r => ({
      tool: r.tool || r.app || r.product || imp.tool || "Unknown tool",
      user: r.user || r.email || r.name || "",
      last: (r["last active"] || r.last_active || r.last || r["last login"] || r.lastlogin || r["last seen"] || "").slice(0, 10),
      cost: num(r.cost || r.price || r["cost per seat"]) || num(imp.cost),
    })).filter(r => r.user);
    setSeats([...seats.filter(s => !rows.some(r => r.tool === s.tool && r.user === s.user)), ...rows]);
  };

  return (
    <div className="stack">
      <Section title="Software seats" aside={<CurrencySelect id="sc-cur" value={cur} onChange={setCur} />}>
        <Stats><Stat value={seats.filter(s => !s.reclaimed).length} label="Paid seats" /><Stat value={money(monthly)} label="Per month" /><Stat value={idle.length} label={`Idle ${days}+ days`} tone={idle.length ? "bad" : "good"} /><Stat value={money(waste * 12)} label="Wasted per year" tone="bad" /><Stat value={money(saved * 12)} label="Saved per year" tone="good" /></Stats>
        <div className="row" style={{ marginTop: 14, alignItems: "center" }}>
          <label className="field" style={{ flex: "0 0 200px" }}><span>Count a seat as idle after</span><select id="sc-days" className="input" value={days} onChange={e => setDays(+e.target.value)}>{[30, 45, 60, 90, 120].map(n => <option key={n} value={n}>{n} days</option>)}</select></label>
        </div>
      </Section>

      <Section title="By tool">
        <div className="table-wrap"><table className="t"><thead><tr><th>Tool</th><th className="r">Seats</th><th className="r">Idle</th><th className="r">Monthly cost</th><th className="r">Monthly waste</th><th /></tr></thead>
          <tbody>{tools.map(t => <tr key={t.t}><td>{t.t}</td><td className="r">{t.total}</td><td className="r">{t.idle}</td><td className="r">{money(t.cost)}</td><td className="r" style={{ color: t.waste ? "var(--bad)" : undefined }}>{money(t.waste)}</td>
            <td><div className="sc-bar"><span style={{ width: `${t.total ? (t.idle / t.total) * 100 : 0}%` }} /></div></td></tr>)}</tbody></table></div>
      </Section>

      <Section title="Seats to reclaim" aside={<button className="btn small" disabled={!idle.length} onClick={() => download("seats-to-reclaim.csv", toCsv([["Tool", "User", "Last active", "Days idle", "Monthly cost"], ...idle.map(s => [s.tool, s.user, s.last, age(s), s.cost])]), "text/csv")}>Export list</button>}>
        {idle.length === 0 ? <p className="empty-note">No idle seats. Nice.</p> : (
          <div className="table-wrap"><table className="t"><thead><tr><th>Tool</th><th>User</th><th>Last active</th><th className="r">Days idle</th><th className="r">Cost</th><th /></tr></thead>
            <tbody>{idle.sort((a, b) => age(b) - age(a)).map(s => <tr key={key(s)}><td>{s.tool}</td><td>{s.user}</td><td className="num">{s.last || "never"}</td><td className="r">{age(s) === 9999 ? "never" : age(s)}</td><td className="r">{money(s.cost)}</td>
              <td className="r"><button className="btn small" onClick={() => setSeats(seats.map(x => key(x) === key(s) ? { ...x, reclaimed: true } : x))}>Mark reclaimed</button></td></tr>)}</tbody></table></div>
        )}
      </Section>

      <Section title="Import a seat list">
        <p className="note" style={{ marginBottom: 10 }}>Most tools export members from their admin page. You need a user column and a last-active date. Cost can be set here if the export does not include it.</p>
        <div className="row" style={{ marginBottom: 10 }}>
          <label className="field"><span>Tool name (if not in the file)</span><input id="sc-tool" className="input" value={imp.tool} onChange={e => setImp({ ...imp, tool: e.target.value })} /></label>
          <label className="field"><span>Cost per seat (if not in the file)</span><input id="sc-cost" className="input num" value={imp.cost} onChange={e => setImp({ ...imp, cost: e.target.value })} /></label>
        </div>
        <ImportBox label="CSV with user, last active and optionally tool and cost" rows={4} placeholder={"email,last active\nsara@acme.tn,2026-06-02"} onText={importCsv} />
        <button className="btn ghost small danger" style={{ marginTop: 10 }} onClick={() => setSeats([])}>Clear all seats</button>
      </Section>
      <style>{`.sc-bar{width:120px;height:8px;background:var(--sunk);border-radius:4px;overflow:hidden}.sc-bar span{display:block;height:100%;background:var(--bad)}`}</style>
    </div>
  );
}
