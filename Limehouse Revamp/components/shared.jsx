// Shared dashboard components — used by all 3 variations
const { useState, useEffect, useRef, useMemo } = React;

// ── Formatters ──────────────────────────────────────────────────────────────
const fmt = {
  num: (v) => (v ?? 0).toLocaleString(),
  pct: (v) => (v ?? 0) + '%',
  money: (v) => '$' + (v ?? 0).toLocaleString(),
  moneyK: (v) => '$' + (v ?? 0) + 'k',
  delta: (curr, prev, invert) => {
    if (prev == null || prev === 0) return null;
    const d = ((curr - prev) / prev) * 100;
    const sign = d > 0 ? '+' : '';
    const isPositive = invert ? d < 0 : d > 0;
    return { text: sign + d.toFixed(1) + '%', isPositive, raw: d };
  },
  signedNum: (curr, prev) => {
    const d = curr - prev;
    return (d >= 0 ? '+' : '') + d;
  },
};

// ── Sparkline (inline SVG, lightweight) ─────────────────────────────────────
function Sparkline({ data, color = '#3d8c1f', width = 80, height = 24, fill = true, strokeWidth = 1.5 }) {
  if (!data || data.length < 2) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const xStep = width / (data.length - 1);
  const pts = data.map((v, i) => [i * xStep, height - ((v - min) / range) * (height - 4) - 2]);
  const path = pts.map((p, i) => (i === 0 ? 'M' : 'L') + p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' ');
  const areaPath = path + ` L${width},${height} L0,${height} Z`;
  return (
    <svg width={width} height={height} style={{ display: 'block', overflow: 'visible' }}>
      {fill && <path d={areaPath} fill={color} fillOpacity="0.12" />}
      <path d={path} fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r="2.2" fill={color} />
    </svg>
  );
}

// ── YoY Delta Pill ──────────────────────────────────────────────────────────
function DeltaPill({ delta, size = 'md' }) {
  if (!delta) return null;
  const colors = delta.isPositive
    ? { bg: 'rgba(61,140,31,0.10)', fg: '#3d8c1f' }
    : { bg: 'rgba(192,57,43,0.10)', fg: '#c0392b' };
  const sizes = {
    sm: { fontSize: 10, padding: '1px 5px', radius: 4 },
    md: { fontSize: 11, padding: '2px 7px', radius: 5 },
    lg: { fontSize: 12, padding: '3px 9px', radius: 6 },
  };
  const s = sizes[size];
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 3,
      background: colors.bg, color: colors.fg,
      fontSize: s.fontSize, fontWeight: 600,
      padding: s.padding, borderRadius: s.radius,
      lineHeight: 1.3, whiteSpace: 'nowrap',
      fontVariantNumeric: 'tabular-nums',
    }}>
      <span style={{ fontSize: s.fontSize - 1 }}>{delta.isPositive ? '▲' : '▼'}</span>
      {delta.text}
    </span>
  );
}

// ── Source pill (RE / BD / ME) ──────────────────────────────────────────────
function SourcePill({ source, show = true }) {
  if (!show) return null;
  const map = {
    RE: { label: 'RE', title: 'RentEngine', color: '#3d8c1f', bg: 'rgba(61,140,31,0.08)' },
    BD: { label: 'BD', title: 'Buildium', color: '#2471a3', bg: 'rgba(36,113,163,0.08)' },
    ME: { label: 'ME', title: 'Meld', color: '#7d3c98', bg: 'rgba(125,60,152,0.08)' },
  };
  const m = map[source] || map.RE;
  return (
    <span title={m.title} style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      fontSize: 9, fontWeight: 700, letterSpacing: '0.04em',
      color: m.color, background: m.bg,
      padding: '1px 5px', borderRadius: 3,
      lineHeight: 1.3, fontFamily: "'Outfit', sans-serif",
    }}>{m.label}</span>
  );
}

// ── Section header ──────────────────────────────────────────────────────────
function SectionHeader({ title, subtitle, right }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'baseline', gap: 12,
      margin: '20px 0 12px', padding: '0 2px',
    }}>
      <div style={{
        fontSize: 10, fontWeight: 700, letterSpacing: '0.1em',
        textTransform: 'uppercase', color: '#1c2119',
      }}>{title}</div>
      {subtitle && (
        <div style={{ fontSize: 11, color: '#9aa595', fontWeight: 500 }}>{subtitle}</div>
      )}
      <div style={{ flex: 1, height: 1, background: '#e5e8e2' }} />
      {right}
    </div>
  );
}

// ── Modal (drill-down) ──────────────────────────────────────────────────────
function Modal({ open, onClose, title, subtitle, children }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200 }}>
      <div onClick={onClose} style={{
        position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.25)', backdropFilter: 'blur(2px)',
      }} />
      <div style={{
        position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
        width: 'min(720px, 94vw)', maxHeight: '82vh',
        background: '#fff', borderRadius: 14, boxShadow: '0 24px 64px rgba(0,0,0,0.18)',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }}>
        <div style={{
          padding: '18px 22px 14px', borderBottom: '1px solid #e5e8e2',
          display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16,
        }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 600, color: '#1c2119' }}>{title}</div>
            {subtitle && <div style={{ fontSize: 12, color: '#6b7566', marginTop: 2 }}>{subtitle}</div>}
          </div>
          <button onClick={onClose} style={{
            background: '#f4f5f3', border: '1px solid #e5e8e2', width: 28, height: 28,
            borderRadius: 7, cursor: 'pointer', fontSize: 13, color: '#6b7566',
          }}>✕</button>
        </div>
        <div style={{ overflowY: 'auto', flex: 1 }}>{children}</div>
      </div>
    </div>
  );
}

// ── Drill table ─────────────────────────────────────────────────────────────
function DrillTable({ cols, rows }) {
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
      <thead>
        <tr>
          {cols.map((c, i) => (
            <th key={i} style={{
              textAlign: 'left', padding: '10px 16px',
              fontSize: 10, fontWeight: 700, letterSpacing: '0.07em',
              textTransform: 'uppercase', color: '#9aa595',
              background: '#f9faf7', borderBottom: '1px solid #e5e8e2',
              position: 'sticky', top: 0,
            }}>{c}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, i) => (
          <tr key={i} style={{ background: i % 2 ? 'transparent' : '#fcfdfb' }}>
            {row.map((cell, ci) => (
              <td key={ci} style={{
                padding: '11px 16px',
                borderBottom: '1px solid #eef0ec',
                color: ci === 0 ? '#1c2119' : '#6b7566',
                fontWeight: ci === 0 ? 500 : 400,
                fontVariantNumeric: ci === 0 ? 'normal' : 'tabular-nums',
              }}>{cell}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// ── Mini bar chart (for income trends, etc.) ────────────────────────────────
function MiniBars({ data, color = '#3d8c1f', height = 60, valueKey = 'value', highlightLast = true }) {
  const values = data.map(d => d[valueKey]);
  const max = Math.max(...values, 1);
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height }}>
      {data.map((d, i) => {
        const h = (d[valueKey] / max) * height;
        const isLast = highlightLast && i === data.length - 1;
        return (
          <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
            <div style={{
              width: '100%', height: h, minHeight: 2,
              background: isLast ? color : color + '55',
              borderRadius: '3px 3px 0 0',
            }} />
          </div>
        );
      })}
    </div>
  );
}

// ── Dual-bar chart (added vs lost, by3rd vs by10th) ─────────────────────────
function DualBars({ data, keys, colors, height = 90, labels = true, yMax }) {
  const allValues = data.flatMap(d => keys.map(k => d[k]));
  const max = yMax ?? Math.max(...allValues, 1);
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height }}>
        {data.map((d, i) => (
          <div key={i} style={{ flex: 1, display: 'flex', alignItems: 'flex-end', gap: 1, height: '100%' }}>
            {keys.map((k, ki) => {
              const h = (d[k] / max) * height;
              return (
                <div key={ki} style={{
                  flex: 1, height: Math.max(h, 1.5), minHeight: 1.5,
                  background: colors[ki],
                  borderRadius: '2px 2px 0 0',
                }} />
              );
            })}
          </div>
        ))}
      </div>
      {labels && (
        <div style={{ display: 'flex', gap: 4, marginTop: 4, fontSize: 9, color: '#9aa595' }}>
          {data.map((d, i) => (
            <div key={i} style={{ flex: 1, textAlign: 'center' }}>{d.month?.[0]}</div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Donut for property health ───────────────────────────────────────────────
function Donut({ data, size = 100, thickness = 14, colors = {} }) {
  const total = Object.values(data).reduce((a, b) => a + b, 0) || 1;
  const r = (size - thickness) / 2;
  const cx = size / 2, cy = size / 2;
  const C = 2 * Math.PI * r;
  let acc = 0;
  const segs = Object.entries(data).map(([k, v]) => {
    const frac = v / total;
    const dash = frac * C;
    const offset = -acc * C;
    acc += frac;
    return { k, v, dash, offset, color: colors[k] || '#9aa595' };
  });
  return (
    <svg width={size} height={size} style={{ display: 'block' }}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#eef0ec" strokeWidth={thickness} />
      {segs.map((s, i) => (
        <circle key={i} cx={cx} cy={cy} r={r} fill="none"
          stroke={s.color} strokeWidth={thickness}
          strokeDasharray={`${s.dash} ${C - s.dash}`}
          strokeDashoffset={s.offset}
          transform={`rotate(-90 ${cx} ${cy})`}
        />
      ))}
    </svg>
  );
}

// ── Header (shared chrome) ──────────────────────────────────────────────────
function DashHeader({ syncedAt, range, onRangeChange, dense, mobile }) {
  return (
    <header style={{
      background: '#fff', borderBottom: '1px solid #e5e8e2',
      padding: mobile ? '10px 14px' : (dense ? '10px 22px' : '12px 28px'),
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      gap: mobile ? 8 : 16, flexWrap: 'wrap',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: mobile ? 8 : 14, flexShrink: 0 }}>
        <img src="assets/logo.png" alt="Limehouse" style={{
          height: mobile ? 24 : 30, width: 'auto', display: 'block',
          mixBlendMode: 'multiply',
        }} />
      </div>
      {!mobile && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, fontSize: 11, color: '#9aa595' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#3d8c1f' }} />
            Synced {syncedAt}
          </span>
        </div>
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 'auto' }}>
        <select value={range} onChange={(e) => onRangeChange(e.target.value)} style={{
          background: '#f4f5f3', border: '1px solid #e5e8e2',
          color: '#1c2119', padding: mobile ? '5px 22px 5px 8px' : '6px 26px 6px 10px',
          borderRadius: 7, fontSize: 12, fontFamily: "'Outfit', sans-serif",
          cursor: 'pointer', appearance: 'none', WebkitAppearance: 'none',
          backgroundImage: "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 10 10'><path d='M2 4l3 3 3-3' stroke='%236b7566' stroke-width='1.2' fill='none' stroke-linecap='round'/></svg>\")",
          backgroundRepeat: 'no-repeat', backgroundPosition: 'right 8px center',
        }}>
          <option value="30">Last 30 days</option>
          <option value="90">Last 90 days</option>
          <option value="365">Last year</option>
          <option value="ytd">Year to date</option>
        </select>
        <button style={{
          background: '#3d8c1f', color: 'white', border: 'none',
          padding: mobile ? '5px 10px' : '6px 14px', borderRadius: 7,
          fontSize: 12, fontWeight: 600, cursor: 'pointer',
          fontFamily: "'Outfit', sans-serif",
          display: 'flex', alignItems: 'center', gap: 5,
        }}>↻ {mobile ? '' : 'Sync'}</button>
      </div>
    </header>
  );
}

// ── Multi-line chart with axes (for trends) ────────────────────────────────
function LineChart({ data, series, height = 140, padding = { l: 32, r: 8, t: 8, b: 18 }, yFmt = (v) => v, showGrid = true }) {
  const W = 600;  // viewBox width; SVG scales to container
  const H = height;
  const labels = data.map(d => d.month || d.label || '');
  const allValues = data.flatMap(d => series.map(s => d[s.key]));
  const max = Math.max(...allValues);
  const min = Math.min(...allValues);
  const yMin = Math.floor(min * 0.95);
  const yMax = Math.ceil(max * 1.05);
  const range = yMax - yMin || 1;
  const innerW = W - padding.l - padding.r;
  const innerH = H - padding.t - padding.b;
  const xStep = innerW / Math.max(data.length - 1, 1);
  const yScale = (v) => padding.t + innerH - ((v - yMin) / range) * innerH;
  const xScale = (i) => padding.l + i * xStep;

  // Y-axis ticks (4 lines)
  const ticks = [0, 0.33, 0.66, 1].map(t => yMin + range * t);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ width: '100%', height: H, display: 'block', overflow: 'visible' }}>
      {showGrid && ticks.map((t, i) => (
        <g key={i}>
          <line x1={padding.l} y1={yScale(t)} x2={W - padding.r} y2={yScale(t)}
            stroke="#eef0ec" strokeWidth="1" strokeDasharray={i === 0 ? '0' : '2 3'} />
          <text x={padding.l - 4} y={yScale(t) + 3} fontSize="9" fill="#9aa595" textAnchor="end" fontFamily="'Outfit', sans-serif">{yFmt(Math.round(t))}</text>
        </g>
      ))}
      {labels.map((l, i) => (
        <text key={i} x={xScale(i)} y={H - 4} fontSize="9" fill="#9aa595" textAnchor="middle" fontFamily="'Outfit', sans-serif">{l[0]}</text>
      ))}
      {series.map((s, si) => {
        const pts = data.map((d, i) => [xScale(i), yScale(d[s.key])]);
        const path = pts.map((p, i) => (i === 0 ? 'M' : 'L') + p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' ');
        const area = path + ` L${pts[pts.length-1][0]},${H - padding.b} L${pts[0][0]},${H - padding.b} Z`;
        return (
          <g key={si}>
            {s.fill !== false && <path d={area} fill={s.color} fillOpacity="0.10" />}
            <path d={path} fill="none" stroke={s.color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            {pts.map((p, i) => (
              <circle key={i} cx={p[0]} cy={p[1]} r={i === pts.length - 1 ? 3 : 1.8} fill={s.color} />
            ))}
          </g>
        );
      })}
    </svg>
  );
}

// ── Horizontal bars (e.g. prospects by source, aging buckets) ──────────────
function HBars({ rows, color = '#3d8c1f', max, valueFmt = (v) => v, height = 14 }) {
  const m = max ?? Math.max(...rows.map(r => r.value), 1);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
      {rows.map((r, i) => {
        const w = (r.value / m) * 100;
        return (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11 }}>
            <div style={{ width: 100, color: '#1c2119', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }} title={r.label}>{r.label}</div>
            <div style={{ flex: 1, background: '#f4f5f3', borderRadius: 3, height, position: 'relative', overflow: 'hidden' }}>
              <div style={{
                width: w + '%', height: '100%',
                background: r.color || color,
                borderRadius: 3,
                transition: 'width .25s ease',
              }} />
            </div>
            <div style={{ width: 56, textAlign: 'right', color: '#6b7566', fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>{valueFmt(r.value)}</div>
          </div>
        );
      })}
    </div>
  );
}

// ── Funnel (showings funnel: prospects → showings → apps → move-ins) ───────
function Funnel({ steps, color = '#3d8c1f' }) {
  const max = Math.max(...steps.map(s => s.value));
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {steps.map((s, i) => {
        const w = (s.value / max) * 100;
        const conv = i > 0 ? ((s.value / steps[i - 1].value) * 100).toFixed(0) + '%' : null;
        return (
          <div key={i}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', fontSize: 11, marginBottom: 2 }}>
              <span style={{ color: '#1c2119', fontWeight: 500 }}>{s.label}</span>
              <span style={{ color: '#6b7566', fontVariantNumeric: 'tabular-nums' }}>
                <b style={{ color: '#1c2119' }}>{s.value.toLocaleString()}</b>
                {conv && <span style={{ marginLeft: 6, fontSize: 10, color: '#9aa595' }}>{conv} ↓</span>}
              </span>
            </div>
            <div style={{
              width: w + '%', minWidth: 24, height: 18,
              background: `linear-gradient(90deg, ${color}, ${color}cc)`,
              borderRadius: '3px 8px 8px 3px',
              opacity: 0.4 + (i / steps.length) * 0.6,
            }} />
          </div>
        );
      })}
    </div>
  );
}

// Export to global scope
Object.assign(window, {
  fmt, Sparkline, DeltaPill, SourcePill, SectionHeader,
  Modal, DrillTable, MiniBars, DualBars, Donut, DashHeader,
  LineChart, HBars, Funnel,
});
