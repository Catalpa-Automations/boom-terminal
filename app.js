const fmtUsd = (v) => (v == null ? "--" : `${v >= 0 ? "+" : "-"}$${Math.abs(v).toFixed(2)}`);
const fmtPct = (v) => (v == null ? "--" : `${(v * 100).toFixed(1)}%`);

function setSigned(el, val, text) {
  el.textContent = text;
  el.classList.remove("pos", "neg");
  if (val > 0) el.classList.add("pos");
  else if (val < 0) el.classList.add("neg");
}

function renderChart(curve) {
  const svg = document.getElementById("pnl-chart");
  if (!curve || curve.length < 2) {
    svg.innerHTML = `<text x="20" y="90" fill="#8b9bb4" font-size="12">Not enough trades for curve</text>`;
    return;
  }
  const w = 600, h = 180, pad = 16;
  const vals = curve.map((p) => p.v);
  const min = Math.min(0, ...vals), max = Math.max(0.01, ...vals);
  const span = max - min || 1;
  const x = (i) => pad + (i / (curve.length - 1)) * (w - pad * 2);
  const y = (v) => h - pad - ((v - min) / span) * (h - pad * 2);
  const pts = curve.map((p, i) => `${x(i).toFixed(1)},${y(p.v).toFixed(1)}`).join(" ");
  const zeroY = y(0).toFixed(1);
  const last = vals[vals.length - 1];
  const color = last >= 0 ? "#10b981" : "#ef4444";
  svg.innerHTML = `
    <line x1="${pad}" y1="${zeroY}" x2="${w - pad}" y2="${zeroY}" stroke="#263348" stroke-dasharray="4 4" />
    <polyline fill="none" stroke="${color}" stroke-width="2.2" points="${pts}" />
    <circle cx="${x(curve.length - 1).toFixed(1)}" cy="${y(last).toFixed(1)}" r="3.5" fill="${color}" />
  `;
}

function fillTable(id, rows, cols) {
  const tb = document.querySelector(`#${id} tbody`);
  if (!rows || !rows.length) {
    tb.innerHTML = `<tr><td colspan="${cols.length}" class="muted">No data</td></tr>`;
    return;
  }
  tb.innerHTML = rows.map((r) => `<tr>${cols.map((c) => c(r)).join("")}</tr>`).join("");
}

async function load() {
  try {
    const res = await fetch(`data/data.json?t=${Date.now()}`, { cache: "no-store" });
    const d = await res.json();
    const k = d.kpis || {};
    const a = d.account || {};

    document.getElementById("acct-label").textContent = a.label || "Exness Real";
    document.getElementById("last-run").textContent = `Last run: ${d.last_run_ts || d.generated_at} (${d.last_status || "READY"})`;
    const dot = document.getElementById("status-dot");
    dot.className = "dot " + (d.last_status === "HUMAN_NEEDED" || d.last_status === "HARD_STOP" ? "warn" : "ok");

    setSigned(document.getElementById("k-net"), k.net_pnl, fmtUsd(k.net_pnl));
    document.getElementById("k-wr").textContent = fmtPct(k.win_rate);
    document.getElementById("k-trades").textContent = `${k.trades ?? "--"} (${k.wins ?? 0}/${k.losses ?? 0})`;
    document.getElementById("k-pf").textContent = k.profit_factor ?? "--";
    setSigned(document.getElementById("k-7d"), k.pnl_7d, fmtUsd(k.pnl_7d));
    document.getElementById("k-dd").textContent = k.max_drawdown != null ? `$${k.max_drawdown.toFixed(2)}` : "--";
    document.getElementById("k-slots").textContent = a.slots || "--";
    const st = k.streak || {};
    document.getElementById("k-streak").textContent = st.type ? `${st.n}${st.type[0].toUpperCase()}` : "--";

    document.getElementById("bal-line").textContent = a.balance_visible && a.balance != null
      ? `Bal: $${a.balance.toFixed(2)} | Eq: $${a.equity.toFixed(2)} | Hard stop: $${a.hard_stop}`
      : `Balance hidden (public safe) | Hard stop: $${a.hard_stop}`;

    renderChart(d.curve);

    const dec = d.decision || {};
    document.getElementById("dec-age").textContent = dec.age_min != null ? `${dec.age_min}m ago` : "--";
    document.getElementById("thought-box").textContent = dec.thought || "No recent decide.py output.";
    const sent = dec.sentiment || {};
    document.getElementById("sentiment-pills").innerHTML = Object.entries(sent)
      .map(([key, val]) => `<span class="pill">${key}: ${val ?? "n/a"}</span>`)
      .join("");

    document.getElementById("gate-pill").textContent = a.gate_enabled ? "GATE: ON" : "GATE: OFF";
    document.getElementById("actions-list").innerHTML = (d.next_actions || []).map((x) => `<li>${x}</li>`).join("");

    document.getElementById("snap-ts").textContent = a.snapshot_ts ? `Snap: ${a.snapshot_ts}` : "";
    const posBox = document.getElementById("positions-box");
    if (a.positions && a.positions.length) {
      posBox.className = "table-wrap";
      posBox.innerHTML = `<table><thead><tr><th>SYM</th><th>SIDE</th><th>LOT</th><th>OPEN</th><th>SL</th><th>TP</th><th>P&amp;L</th></tr></thead><tbody>` +
        a.positions.map((p) => `<tr><td>${p.sym}</td><td>${p.side}</td><td>${p.volume}</td><td>${p.open}</td><td>${p.sl}</td><td>${p.tp}</td><td class="${p.profit >= 0 ? "pos" : "neg"}">${fmtUsd(p.profit)}</td></tr>`).join("") +
        `</tbody></table>`;
    } else {
      posBox.className = "empty";
      posBox.textContent = "No open positions";
    }

    document.getElementById("scan-utc").textContent = dec.utc || "";
    fillTable("cand-table", dec.candidates, [
      (r) => `<td>${r.sym}</td>`,
      (r) => `<td>${r.play}</td>`,
      (r) => `<td>${r.side}</td>`,
      (r) => `<td>${r.score}</td>`,
      (r) => `<td class="${r.decision === "TAKE" ? "pos" : "muted"}">${r.decision}</td>`,
      (r) => `<td class="muted">${r.reason || ""}</td>`,
    ]);

    fillTable("play-table", d.by_play, [
      (r) => `<td>${r.name}</td>`,
      (r) => `<td>${r.n}</td>`,
      (r) => `<td>${fmtPct(r.win_rate)}</td>`,
      (r) => `<td class="${r.avg_pnl >= 0 ? "pos" : "neg"}">${fmtUsd(r.avg_pnl)}</td>`,
      (r) => `<td>${r.adj >= 0 ? "+" : ""}${r.adj}</td>`,
    ]);

    fillTable("sym-table", d.by_sym, [
      (r) => `<td>${r.name}</td>`,
      (r) => `<td>${r.n}</td>`,
      (r) => `<td>${fmtPct(r.win_rate)}</td>`,
      (r) => `<td class="${r.avg_pnl >= 0 ? "pos" : "neg"}">${fmtUsd(r.avg_pnl)}</td>`,
      (r) => `<td>${r.adj >= 0 ? "+" : ""}${r.adj}</td>`,
    ]);

    fillTable("trades-table", d.recent_trades, [
      (r) => `<td class="muted">${r.ts || ""}</td>`,
      (r) => `<td>${r.sym}</td>`,
      (r) => `<td>${r.side}</td>`,
      (r) => `<td>${r.play}</td>`,
      (r) => `<td>${r.open}</td>`,
      (r) => `<td>${r.close}</td>`,
      (r) => `<td class="${r.pnl >= 0 ? "pos" : "neg"}">${fmtUsd(r.pnl)}</td>`,
    ]);

    const runsEl = document.getElementById("runs-list");
    runsEl.innerHTML = (d.runs && d.runs.length)
      ? d.runs.map((r) => `<div class="run-item"><b>${r.ts}</b> [${r.status}] ${r.events?.length ? r.events.join(" | ") : (r.log || []).slice(-1)[0] || ""}</div>`).join("")
      : `<div class="empty">No runs recorded yet.</div>`;

    document.getElementById("gen-at").textContent = `Generated: ${d.generated_at}`;
    document.getElementById("foot-note").textContent = d.notes || "";
  } catch (err) {
    document.getElementById("thought-box").textContent = `Failed to load data/data.json: ${err}`;
  }
}

document.getElementById("refresh-btn").addEventListener("click", load);
load();
setInterval(load, 60000);
