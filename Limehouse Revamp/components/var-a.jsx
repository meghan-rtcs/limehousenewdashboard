// Variation A (standalone polished) — Tightened Classic
// Single-page Limehouse dashboard. Click any tile to drill down. Date filter scales numbers.
const VarA = (function() {
  const { useState, useEffect, useMemo } = React;
  const D = window.LIMEHOUSE_DATA;
  const DRILL = window.LIMEHOUSE_DRILLDOWNS;
  const LS_KPIS = window.LIMEHOUSE_LS_KPIS;
  const LS_SUMMARY = window.LIMEHOUSE_LS_SUMMARY;
  const TEAM = window.LIMEHOUSE_TEAM;

  // ── Reporting periods ──────────────────────────────────────────────────────
  // The range selector now picks a server-side reporting window. Changing it
  // re-fetches /api/dashboard?period=<key>, which recomputes the flow metrics
  // (income, move-ins, prospects, showings, rent-processing, reconciliation …)
  // for that exact date window. There is NO client-side proportional scaling —
  // every number comes straight from the server for the chosen period.
  const RANGES = {
    currentMonth:   { label: 'This month' },
    lastMonth:      { label: 'Last month' },
    currentQuarter: { label: 'This quarter' },
    lastQuarter:    { label: 'Last quarter' },
    currentYear:    { label: 'This year' },
    lastYear:       { label: 'Last year' },
  };
  const DEFAULT_RANGE = 'currentMonth';

  // ── Logs panel (slide-in from right) ─────────────────────────────────────
  function LogsPanel({ open, onClose }) {
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
      if (!open) return;
      setLoading(true);
      setError(null);
      fetch('/api/sync-log')
        .then(r => r.json())
        .then(data => { setLogs(Array.isArray(data) ? data : []); setLoading(false); })
        .catch(() => { setError('Failed to load sync history.'); setLoading(false); });
    }, [open]);

    if (!open) return null;

    const fmtTime = (ts) => {
      if (!ts) return '—';
      try {
        return new Date(ts).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true });
      } catch (e) { return ts; }
    };

    const statusColor = (s) => s === 'error' ? '#c0392b' : s === 'running' ? '#d68910' : '#3d8c1f';
    const statusBg    = (s) => s === 'error' ? '#f6dad6' : s === 'running' ? '#fbeed1' : '#e8f0e0';

    return (
      <div style={{
        position: 'fixed', inset: 0, background: 'rgba(28,33,25,0.45)',
        zIndex: 200, display: 'flex', alignItems: 'flex-start', justifyContent: 'flex-end',
      }} onClick={onClose}>
        <div style={{
          background: '#fff', width: 420, maxWidth: '100vw', height: '100vh',
          overflowY: 'auto', boxShadow: '-4px 0 24px rgba(0,0,0,0.10)',
          display: 'flex', flexDirection: 'column',
        }} onClick={e => e.stopPropagation()}>
          <div style={{
            padding: '18px 20px 14px', borderBottom: '1px solid #e5e8e2',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <div>
              <div style={{ fontSize: 15, fontWeight: 600, color: '#1c2119' }}>Sync History</div>
              <div style={{ fontSize: 11, color: '#9aa595', marginTop: 2 }}>Last 20 sync events</div>
            </div>
            <button onClick={onClose} style={{
              background: 'none', border: 'none', cursor: 'pointer',
              fontSize: 20, color: '#9aa595', lineHeight: 1, padding: 4,
            }}>×</button>
          </div>
          <div style={{ flex: 1, padding: '4px 0' }}>
            {loading && (
              <div style={{ padding: '32px 20px', textAlign: 'center', color: '#9aa595', fontSize: 12, fontStyle: 'italic' }}>Loading…</div>
            )}
            {error && (
              <div style={{ padding: '20px', color: '#c0392b', fontSize: 12 }}>{error}</div>
            )}
            {!loading && !error && logs.length === 0 && (
              <div style={{ padding: '32px 20px', textAlign: 'center', color: '#9aa595', fontSize: 12, fontStyle: 'italic' }}>No sync history yet.</div>
            )}
            {!loading && logs.map((log, i) => (
              <div key={log.id} style={{
                padding: '12px 20px',
                borderBottom: i < logs.length - 1 ? '1px solid #f3f4f0' : 'none',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 4 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                    <span style={{ width: 7, height: 7, borderRadius: '50%', background: statusColor(log.status), flexShrink: 0 }} />
                    <span style={{ fontSize: 12, fontWeight: 600, color: '#1c2119' }}>{log.sync_type || 'full'}</span>
                    <span style={{
                      fontSize: 10, fontWeight: 600, color: statusColor(log.status),
                      background: statusBg(log.status), padding: '1px 6px', borderRadius: 4,
                    }}>{log.status}</span>
                  </div>
                  {log.records_synced > 0 && (
                    <span style={{ fontSize: 11, color: '#6b7566', flexShrink: 0 }}>{log.records_synced.toLocaleString()} records</span>
                  )}
                </div>
                <div style={{ fontSize: 11, color: '#9aa595', paddingLeft: 14 }}>
                  {fmtTime(log.started_at)}
                  {log.completed_at && log.started_at && (
                    <span style={{ marginLeft: 6, color: '#cbd1c4' }}>
                      · {Math.round((new Date(log.completed_at) - new Date(log.started_at)) / 1000)}s
                    </span>
                  )}
                </div>
                {log.error_message && (
                  <div style={{ marginTop: 5, fontSize: 11, color: '#c0392b', paddingLeft: 14, fontStyle: 'italic' }}>{log.error_message}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ── Header ────────────────────────────────────────────────────────────────
  function Header({ syncedAt, range, onRangeChange, mobile, onLogsOpen }) {
    const [syncing, setSyncing] = useState(false);
    return (
      <header style={{
        background: '#fff', borderBottom: '1px solid #e5e8e2',
        padding: mobile ? '10px 14px' : '0 26px',
        display: 'flex', alignItems: 'center', gap: mobile ? 8 : 16,
        height: mobile ? 'auto' : 58, position: 'sticky', top: 0, zIndex: 50,
        boxShadow: '0 1px 3px rgba(0,0,0,0.04)', flexWrap: 'wrap',
      }}>
        <img src="assets/logo.png" alt="Limehouse" style={{
          height: mobile ? 22 : 28, width: 'auto', display: 'block', mixBlendMode: 'multiply',
        }} />
        {!mobile && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 16, fontSize: 11, color: '#6b7566' }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#3d8c1f' }} />
            <span>Synced {syncedAt}</span>
            <span style={{ color: '#cbd1c4' }}>·</span>
            <span>{D.meta.buildiumUnits} units · {D.meta.activeLeases} leases</span>
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 'auto' }}>
          <button onClick={onLogsOpen} style={{ fontSize: 12, color: '#6b7566', background: 'none', border: 'none', padding: '5px 9px', borderRadius: 6, cursor: 'pointer', fontFamily: 'inherit' }}>Logs</button>
          <select value={range} onChange={(e) => onRangeChange(e.target.value)} style={{
            background: '#f4f5f3', border: '1px solid #e5e8e2',
            color: '#1c2119', padding: mobile ? '5px 24px 5px 9px' : '6px 26px 6px 11px',
            borderRadius: 7, fontSize: 12, fontFamily: "'Outfit', sans-serif",
            cursor: 'pointer', appearance: 'none', WebkitAppearance: 'none', outline: 'none',
            backgroundImage: "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 10 10'><path d='M2 4l3 3 3-3' stroke='%236b7566' stroke-width='1.2' fill='none' stroke-linecap='round'/></svg>\")",
            backgroundRepeat: 'no-repeat', backgroundPosition: 'right 8px center',
          }}>
            <option value="currentMonth">This month</option>
            <option value="lastMonth">Last month</option>
            <option value="currentQuarter">This quarter</option>
            <option value="lastQuarter">Last quarter</option>
            <option value="currentYear">This year</option>
            <option value="lastYear">Last year</option>
          </select>
          <button onClick={async () => {
              if (syncing) return;
              setSyncing(true);
              try {
                await fetch('/api/sync', { method: 'POST', headers: { 'X-Requested-With': 'LimehouseDashboard' } });
              } catch (e) { /* ignore */ }
              window.location.reload();
            }}
            disabled={syncing}
            style={{
              background: '#3d8c1f', color: 'white', border: 'none',
              padding: mobile ? '5px 12px' : '6px 14px', borderRadius: 7,
              fontSize: 12, fontWeight: 600, cursor: syncing ? 'wait' : 'pointer',
              fontFamily: "'Outfit', sans-serif",
              display: 'flex', alignItems: 'center', gap: 6,
              opacity: syncing ? 0.7 : 1,
            }}>
            <span style={{ display: 'inline-block', transform: syncing ? 'rotate(360deg)' : 'none', transition: 'transform 1.4s linear' }}>↻</span>
            {syncing ? 'Syncing…' : (mobile ? 'Sync' : 'Sync now')}
          </button>
        </div>
      </header>
    );
  }

  // Small green LIVE badge — shown next to source pill when the metric is
  // backed by real, fresh API data (vs a placeholder waiting on a data source).
  function LiveBadge() {
    return (
      <span title="Backed by live API data" style={{
        display: 'inline-flex', alignItems: 'center', gap: 3,
        fontSize: 8.5, fontWeight: 700, letterSpacing: '0.05em',
        color: '#2f7d1a', background: 'rgba(61,140,31,0.10)',
        padding: '1px 5px', borderRadius: 3, lineHeight: 1.3,
      }}>
        <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#3d8c1f', display: 'inline-block' }} />
        LIVE
      </span>
    );
  }

  // KPI tile — every tile is now drillable (cursor + hover)
  function KPI({ label, value, unit, delta, spark, sparkColor, source, onClick, big = false, mobile, showSource, accent, live, decimals }) {
    const accentColor = accent === 'red' ? '#c0392b' : (accent === 'green' ? '#3d8c1f' : (accent === 'blue' ? '#2471a3' : '#1c2119'));
    return (
      <div onClick={onClick} style={{
        background: '#fff', border: '1px solid #e5e8e2', borderRadius: 10,
        padding: mobile ? '12px 13px' : (big ? '15px 17px' : '13px 15px'),
        boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
        cursor: onClick ? 'pointer' : 'default',
        transition: 'border-color .15s, transform .15s, box-shadow .15s',
        display: 'flex', flexDirection: 'column', gap: 6,
        position: 'relative', overflow: 'hidden',
      }}
      onMouseEnter={(e) => { if (onClick) { e.currentTarget.style.borderColor = '#c8d6bf'; e.currentTarget.style.boxShadow = '0 3px 10px rgba(61,140,31,0.08)'; }}}
      onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#e5e8e2'; e.currentTarget.style.boxShadow = '0 1px 2px rgba(0,0,0,0.03)'; }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
          <div style={{
            fontSize: 9.5, fontWeight: 700, letterSpacing: '0.07em',
            textTransform: 'uppercase', color: '#9aa595', lineHeight: 1.3,
          }}>{label}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            {live && <LiveBadge />}
            <SourcePill source={source} show={showSource} />
            {onClick && <span style={{ fontSize: 11, color: '#cbd1c4', lineHeight: 1 }}>›</span>}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 8 }}>
          <div style={{
            fontSize: big ? (mobile ? 30 : 36) : (mobile ? 24 : 28),
            fontWeight: 300, color: accentColor,
            letterSpacing: '-1.2px', lineHeight: 1,
            fontVariantNumeric: 'tabular-nums',
          }}>
            {unit === '$' && <span style={{ fontSize: '0.55em', color: '#9aa595', fontWeight: 400 }}>$</span>}
            {typeof value === 'number' ? value.toLocaleString('en-US', decimals != null ? { minimumFractionDigits: decimals, maximumFractionDigits: decimals } : undefined) : value}
            {unit && unit !== '$' && <span style={{ fontSize: '0.55em', color: '#9aa595', fontWeight: 400, marginLeft: 1 }}>{unit}</span>}
          </div>
          {spark && <Sparkline data={spark} color={sparkColor || '#3d8c1f'} width={mobile ? 50 : 60} height={20} />}
        </div>
        {delta && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <DeltaPill delta={delta} size="sm" />
            <span style={{ fontSize: 10, color: '#9aa595' }}>vs last yr</span>
          </div>
        )}
      </div>
    );
  }

  function ChartCard({ title, subtitle, legend, children, mobile, onClick }) {
    return (
      <div onClick={onClick} style={{
        background:'#fff', border:'1px solid #e5e8e2', borderRadius:10,
        padding: mobile ? '12px 13px' : '14px 16px',
        boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
        cursor: onClick ? 'pointer' : 'default',
      }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom: 10, gap: 8 }}>
          <div>
            <div style={{ fontSize: 9.5, fontWeight: 700, letterSpacing:'0.07em', textTransform:'uppercase', color:'#9aa595' }}>{title}</div>
            {subtitle && <div style={{ fontSize: 11, color: '#6b7566', marginTop: 3 }}>{subtitle}</div>}
          </div>
          {legend}
        </div>
        {children}
      </div>
    );
  }

  // Shared YoY-chart block — renders one "X by year" line chart + matching KPI tile.
  // Used by the CEO view for Gross / Net / RPU income rows.
  function YoYIncomeRows({ mobile, SD, showSource, setDrillKey, k }) {
    const monthLabels = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const palette = ['#d6dbd1','#c2cbbb','#aebaa3','#9aa88c','#869676','#728560','#5e7449','#456020','#3d8c1f'];
    const buildYoY = (byYear) => {
      const currentColor = '#2471a3';
      const yrs = Object.keys(byYear || {}).map(Number).sort((a, b) => a - b);
      const curY = yrs[yrs.length - 1];
      const data = monthLabels.map((label, i) => {
        const row = { month: label };
        for (const y of yrs) {
          const v = byYear?.[y]?.[i + 1];
          if (v != null) row[String(y)] = v;
        }
        return row;
      });
      const series = yrs.map((y, idx) => {
        const isCurrent = y === curY;
        const colorIdx = Math.round((idx / Math.max(yrs.length - 1, 1)) * (palette.length - 1));
        return {
          key: String(y),
          color: isCurrent ? currentColor : palette[colorIdx],
          width: isCurrent ? 2.2 : 1.2,
          opacity: isCurrent ? 1 : 0.85,
          dots: isCurrent,
        };
      });
      return { data, series, yrs, curY };
    };
    const moneyAxis = (v) => '$' + (Math.abs(v) >= 1000 ? Math.round(v / 1000) + 'k' : v);
    const renderRow = (title, byYear, kpiValueObj, kpiLabel, drillId) => {
      const { data, series, yrs, curY } = buildYoY(byYear);
      return (
        <div style={{ display: 'grid', gridTemplateColumns: mobile ? '1fr' : '3fr 1fr', gap: mobile ? 8 : 10, marginBottom: mobile ? 8 : 10 }}>
          <ChartCard mobile={mobile}
            title={title}
            subtitle={yrs.length ? `Same month, year over year · ${yrs[0]}–${curY}` : 'Same month, year over year'}
            legend={
              <div style={{ display:'flex', gap:8, fontSize: 10, color:'#6b7566', flexWrap:'wrap', justifyContent:'flex-end' }}>
                {series.map(s => (
                  <span key={s.key} style={{ display:'inline-flex',alignItems:'center',gap:4 }}>
                    <span style={{ width:8,height:8,background:s.color,borderRadius:2,opacity:s.opacity }} />{s.key}
                  </span>
                ))}
              </div>
            }
            onClick={() => setDrillKey(drillId)}>
            <LineChart data={data} series={series} height={mobile ? 130 : 150} yFmt={moneyAxis} />
          </ChartCard>
          <div style={{ display: 'grid', gridTemplateRows: '1fr', minHeight: 0 }}>
            <KPI {...k(kpiLabel, 'BD', kpiValueObj, '$', drillId, '#3d8c1f', false, null, drillId)} mobile={mobile} showSource={showSource} />
          </div>
        </div>
      );
    };
    return (
      <>
        {renderRow('Gross income — by year',     SD.grossByYear, SD.financials.grossIncome, 'Gross income — YTD',  'grossIncome')}
        {renderRow('Net income — by year',       SD.netByYear,   SD.financials.netIncome,   'Net income — YTD',    'netIncome')}
        {renderRow('Revenue per unit — by year', SD.rpuByYear,   SD.financials.rpu,         'RPU — last month',    'rpu')}
      </>
    );
  }

  // ── Performance by Role (CEO view) ───────────────────────────────────
  function ragForKpi(kpi) {
    if (kpi.value == null) return 'gray';
    if (kpi.direction === 'lte') {
      if (kpi.value <= kpi.target) return 'green';
      if (kpi.value <= kpi.target * 1.1) return 'amber';
      return 'red';
    }
    if (kpi.value >= kpi.target) return 'green';
    if (kpi.value >= kpi.target * 0.9) return 'amber';
    return 'red';
  }
  function roleStatus(role) {
    if (!role.kpis || !role.kpis.length) return 'none';
    const statuses = role.kpis.map(ragForKpi);
    if (statuses.includes('red')) return 'red';
    if (statuses.includes('amber')) return 'amber';
    if (statuses.every(s => s === 'gray')) return 'gray';
    return 'green';
  }
  const RAG_COLOR = { green:'#3d8c1f', amber:'#d68910', red:'#c0392b', gray:'#aab5a3', none:'#aab5a3' };
  const RAG_BG    = { green:'#e8f0e0', amber:'#fbeed1', red:'#f6dad6', gray:'#eef0eb', none:'#eef0eb' };
  const RAG_LABEL = { green:'On track', amber:'At risk', red:'Off track', gray:'No data', none:'—' };
  const SOURCE_STYLE = {
    BD: { bg:'#e8e0d4', fg:'#6b5b3e' },
    RE: { bg:'#dbeafe', fg:'#1e40af' },
  };
  // These KPIs are structural (always "as of today") rather than scoped to
  // whichever period is selected up top — flagged so that doesn't read as a
  // broken filter. Keep in sync with the comment above roleKpis in
  // server/lib/aggregator.js.
  const ROLE_KPI_WINDOW_NOTE = {
    'Portfolio Occupancy Rate': 'as of today',
    'Delinquency Rate': 'as of today',
    'Vendor Compliance': 'as of today',
    '1099 Compliance': 'as of today',
  };
  function fmtKpiValue(kpi) {
    if (kpi.value == null) return { num:'—', suffix:'' };
    const v = kpi.value;
    if (kpi.format === 'pct') return { num:String(v), suffix:'%' };
    if (kpi.format === 'days') return { num:String(v), suffix:'d' };
    if (kpi.format === 'hours') return { num:String(v), suffix:'h' };
    return { num:String(v), suffix:'' };
  }
  function fmtTarget(kpi) {
    if (kpi.targetLabel) return kpi.targetLabel;
    const prefix = kpi.direction === 'lte' ? '≤' : '≥';
    if (kpi.format === 'pct') return `${prefix}${kpi.target}%`;
    if (kpi.format === 'days') return `${prefix}${kpi.target}d`;
    if (kpi.format === 'hours') return `${prefix}${kpi.target}h`;
    return `${prefix}${kpi.target}`;
  }

  function RoleSummaryBar({ roles, mobile }) {
    return (
      <div style={{ background:'#fff', border:'1px solid #e5e8e2', borderRadius:8, display:'grid', gridTemplateColumns: mobile ? `repeat(${Math.min(roles.length, 3)}, 1fr)` : `repeat(${roles.length}, 1fr)`, overflow:'hidden', marginBottom: mobile ? 10 : 12 }}>
        {roles.map((r, i) => {
          const status = roleStatus(r);
          const onTarget = r.kpis.filter(k2 => ragForKpi(k2) === 'green').length;
          const total = r.kpis.length;
          const score = total === 0 ? '—' : `${onTarget}/${total} on tgt`;
          return (
            <div key={r.abbrev} style={{ padding:'12px 14px', borderLeft: i === 0 ? 'none' : '1px solid #e5e8e2' }}>
              <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:4 }}>
                <span style={{ width:8, height:8, borderRadius:'50%', background: RAG_COLOR[status] }} />
                <span style={{ fontSize:10, fontWeight:700, color:'#9aa595', letterSpacing:'0.08em' }}>{r.abbrev}</span>
              </div>
              <div style={{ fontSize:12, fontWeight:600, color:'#1c2119', marginBottom:2, lineHeight:1.2 }}>{r.name}</div>
              <div style={{ fontSize:10, color:'#6b7566' }}>{score}</div>
            </div>
          );
        })}
      </div>
    );
  }

  function RoleCard({ role, mobile, setDrillKey }) {
    const status = roleStatus(role);
    const onTarget = role.kpis.filter(k2 => ragForKpi(k2) === 'green').length;
    const atRisk = role.kpis.filter(k2 => ragForKpi(k2) === 'amber').length;
    const offTrack = role.kpis.filter(k2 => ragForKpi(k2) === 'red').length;
    const total = role.kpis.length;
    return (
      <div style={{ background:'#fff', border:'1px solid #e5e8e2', borderRadius:8, padding: mobile ? 12 : 16, display:'flex', flexDirection:'column' }}>
        <div style={{ display:'flex', alignItems:'flex-start', gap:10, marginBottom:10 }}>
          <div style={{ width:38, height:38, borderRadius:'50%', border:`2.5px solid ${RAG_COLOR[status]}`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:700, color:'#1c2119', flexShrink:0 }}>
            {total === 0 ? '—' : `${onTarget}/${total}`}
          </div>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ fontSize:13, fontWeight:600, color:'#1c2119', lineHeight:1.2 }}>{role.name}</div>
            <div style={{ fontSize:10, color:'#6b7566', marginTop:3, display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
              <span>· {role.people} {role.people === 1 ? 'person' : 'people'}</span>
              {onTarget > 0 && <span style={{ display:'inline-flex', alignItems:'center', gap:3 }}><span style={{ width:6, height:6, borderRadius:'50%', background:RAG_COLOR.green }} />{onTarget} on track</span>}
              {atRisk > 0 && <span style={{ display:'inline-flex', alignItems:'center', gap:3 }}><span style={{ width:6, height:6, borderRadius:'50%', background:RAG_COLOR.amber }} />{atRisk} at risk</span>}
              {offTrack > 0 && <span style={{ display:'inline-flex', alignItems:'center', gap:3 }}><span style={{ width:6, height:6, borderRadius:'50%', background:RAG_COLOR.red }} />{offTrack} off track</span>}
            </div>
          </div>
          <span style={{ background: RAG_BG[status], color: RAG_COLOR[status], fontSize:10, fontWeight:600, padding:'3px 9px', borderRadius:10, whiteSpace:'nowrap' }}>{RAG_LABEL[status]}</span>
        </div>
        {total === 0 ? (
          <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', minHeight:80, color:'#9aa595', fontSize:11, fontStyle:'italic', textAlign:'center', padding:'12px 4px' }}>
            No Buildium / RentEngine KPIs for this role
          </div>
        ) : (
          <div>
            {role.kpis.map((kpi, i) => {
              const rag = ragForKpi(kpi);
              const color = RAG_COLOR[rag];
              const v = fmtKpiValue(kpi);
              const src = SOURCE_STYLE[kpi.source] || SOURCE_STYLE.BD;
              const clickable = !!(kpi.drillKey && setDrillKey);
              return (
                <div key={i}
                  onClick={clickable ? () => setDrillKey(kpi.drillKey) : undefined}
                  title={clickable ? 'View data behind this metric' : undefined}
                  style={{ display:'flex', alignItems:'center', gap:10, padding:'9px 6px', margin:'0 -6px', borderTop: i === 0 ? '1px solid #eef0eb' : '1px solid #f3f4f0', cursor: clickable ? 'pointer' : 'default', borderRadius:4, transition:'background 0.12s' }}
                  onMouseEnter={clickable ? (e) => { e.currentTarget.style.background = '#f4f6f1'; } : undefined}
                  onMouseLeave={clickable ? (e) => { e.currentTarget.style.background = 'transparent'; } : undefined}>
                  <span style={{ width:10, height:10, borderRadius:'50%', background: color, flexShrink:0 }} />
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:6, flexWrap:'wrap' }}>
                      <span style={{ fontSize:12, fontWeight:500, color:'#1c2119' }}>{kpi.name}</span>
                      <span style={{ background:src.bg, color:src.fg, fontSize:9, fontWeight:700, padding:'1px 6px', borderRadius:3, letterSpacing:'0.04em' }}>{kpi.source}</span>
                      {ROLE_KPI_WINDOW_NOTE[kpi.name] && (
                        <span title="This value doesn't change when you switch periods — it's not scoped to a specific date range."
                          style={{ background:'#eef0eb', color:'#6b7566', fontSize:9, fontWeight:600, padding:'1px 6px', borderRadius:3, letterSpacing:'0.02em', fontStyle:'italic' }}>
                          {ROLE_KPI_WINDOW_NOTE[kpi.name]}
                        </span>
                      )}
                    </div>
                  </div>
                  <div style={{ textAlign:'right', flexShrink:0 }}>
                    <div style={{ fontSize:8, fontWeight:700, color:'#9aa595', letterSpacing:'0.1em', textTransform:'uppercase' }}>Target</div>
                    <div style={{ fontSize:10, color:'#6b7566', marginTop:1 }}>{fmtTarget(kpi)}</div>
                  </div>
                  <div style={{ textAlign:'right', flexShrink:0, minWidth:54 }}>
                    <span style={{ fontSize:18, fontWeight:700, color }}>{v.num}</span>
                    {v.suffix && <span style={{ fontSize:11, fontWeight:600, color, marginLeft:1 }}>{v.suffix}</span>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  function PerformanceByRole({ SD, mobile, setDrillKey }) {
    const data = SD && SD.roleKpis;
    if (!data || !data.roles) return null;
    return (
      <div style={{ marginTop: mobile ? 18 : 26 }}>
        <RoleSummaryBar roles={data.roles} mobile={mobile} />
        <div style={{ display:'grid', gridTemplateColumns: mobile ? '1fr' : '1fr 1fr', gap: mobile ? 10 : 12 }}>
          {data.roles.map(r => <RoleCard key={r.abbrev} role={r} mobile={mobile} setDrillKey={setDrillKey} />)}
        </div>
      </div>
    );
  }

  // ── Team Performance View ────────────────────────────────────────────
  // Paste this BEFORE the CeoView function in var-a.jsx.
  // It REPLACES the LeadSimpleView, LsRoleCard, and all LS_* constants.


  const TIER_COLORS = {
    green:  { bg: '#EAF3DE', fg: '#3B6D11', label: 'Best' },
    amber:  { bg: '#FAEEDA', fg: '#854F0B', label: 'Better' },
    coral:  { bg: '#FAECE7', fg: '#993C1D', label: 'Good' },
    red:    { bg: '#FCEBEB', fg: '#A32D2D', label: 'Red' },
    gray:   { bg: '#eef0eb', fg: '#6b7566', label: 'No data' },
  };

  const SRC_BADGE = {
    Buildium:    { bg: '#e8e0d4', fg: '#6b5b3e' },
    RentEngine:  { bg: '#dbeafe', fg: '#1e40af' },
    LeadSimple:  { bg: '#e0e8f0', fg: '#2c5282' },
    SharePoint:  { bg: '#ede9fe', fg: '#5b3e8a' },
  };

  // KPIs whose value is structural (always "as of today", no historical
  // source to backdate) or a long rolling window (trailing 12 months) rather
  // than scoped to the selected quarter — these will read identically no
  // matter which Q1–Q4 button is clicked, by design. Occupancy/delinquency
  // are NOT in this list: they're backdated to the quarter's end date via
  // daily_snapshots (see teamPerfAsOfWindow in server/lib/aggregator.js).
  // Keep this in sync with server/lib/team-aggregator.js's extractValues().
  const KPI_WINDOW_NOTE = {
    daysOnMarket: 'as of today',
    renewalRate: 'trailing 12 mo',
    vendorCompliancePct: 'as of today',
    vendor1099Pct: 'as of today',
  };

  function fmtActual(kpi) {
    if (kpi.actual == null) return '—';
    if (kpi.format === 'pct') return `${kpi.actual}%`;
    if (kpi.format === 'days') return `${kpi.actual}d`;
    if (kpi.format === 'hours') return `${kpi.actual}h`;
    return String(kpi.actual);
  }

  function fmtTarget2(kpi) {
    const p = kpi.direction === 'lte' ? '\u2264' : '\u2265';
    if (kpi.format === 'pct') return `${p}${kpi.target}%`;
    if (kpi.format === 'days') return `${p}${kpi.target}d`;
    if (kpi.format === 'hours') return `${p}${kpi.target}h`;
    return `${p}${kpi.target}`;
  }

  function TeamKpiRow({ kpi, slot, mobile, setDrillKey, kpiTrend, quarters }) {
    const [hover, setHover] = useState(false);
    const tier = TIER_COLORS[kpi.tier] || TIER_COLORS.gray;
    const actualColor = kpi.tier === 'green' ? '#639922'
                      : kpi.tier === 'amber' ? '#BA7517'
                      : kpi.tier === 'coral' ? '#D85A30'
                      : kpi.tier === 'red'   ? '#E24B4A'
                      : '#9aa595';
    const clickable = !!(kpi.drillKey && setDrillKey);

    return (
      <div
        onClick={clickable ? () => setDrillKey(kpi.drillKey) : undefined}
        onMouseEnter={clickable ? () => setHover(true) : undefined}
        onMouseLeave={clickable ? () => setHover(false) : undefined}
        title={clickable ? 'View the exact records behind this KPI' : undefined}
        style={{
          display: 'grid',
          gridTemplateColumns: mobile ? '1fr 60px 60px' : 'minmax(0,2.5fr) 80px 80px 100px 80px',
          gap: 1, background: clickable && hover ? '#f6f7f4' : 'transparent',
          cursor: clickable ? 'pointer' : 'default',
          transition: 'background 0.12s',
        }}>
        {/* KPI name + sources */}
        <div style={{ padding: '10px 12px' }}>
          <div style={{ fontSize: 12, fontWeight: 500, color: clickable && hover ? '#2E4057' : '#1c2119', lineHeight: 1.3 }}>
            {kpi.name}
            {clickable && <span style={{ marginLeft: 5, fontSize: 11, color: '#9aa595', fontWeight: 600 }}>{'\u203a'}</span>}
          </div>
          <div style={{ display: 'flex', gap: 4, marginTop: 3, flexWrap: 'wrap' }}>
            {(kpi.sources || []).map(s => {
              const st = SRC_BADGE[s] || SRC_BADGE.Buildium;
              return <span key={s} style={{ background: st.bg, color: st.fg, fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 3, letterSpacing: '0.03em' }}>{s === 'RentEngine' ? 'RE' : s === 'LeadSimple' ? 'LS' : s === 'Buildium' ? 'BD' : s}</span>;
            })}
            {KPI_WINDOW_NOTE[kpi.dataKey] && (
              <span title="This value doesn't change when you switch quarters — it's not scoped to a specific period."
                style={{ background: '#eef0eb', color: '#6b7566', fontSize: 9, fontWeight: 600, padding: '1px 5px', borderRadius: 3, letterSpacing: '0.02em', fontStyle: 'italic' }}>
                {KPI_WINDOW_NOTE[kpi.dataKey]}
              </span>
            )}
          </div>
          {/* Per-KPI quarter trend dots (shown once 2+ quarters exist) */}
          {kpiTrend && quarters && quarters.length >= 2 && (
            <div style={{ display: 'flex', gap: 3, marginTop: 6, alignItems: 'center' }}>
              {quarters.map((q, i) => {
                const t = kpiTrend.tiers?.[i];
                const c = t ? (TIER_COLORS[t]?.fg || '#cbd1c4') : '#e5e8e2';
                return <span key={q} title={`${q}: ${t || 'no data'}`} style={{ width: 6, height: 6, borderRadius: '50%', background: c }} />;
              })}
            </div>
          )}
        </div>

        {/* Target (hidden on mobile - combined with actual) */}
        {!mobile && (
          <div style={{ padding: '10px 8px', textAlign: 'center', fontSize: 12, color: '#6b7566', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {fmtTarget2(kpi)}
          </div>
        )}

        {/* Actual */}
        <div style={{ padding: '10px 8px', textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ fontSize: mobile ? 14 : 15, fontWeight: 600, color: actualColor }}>{fmtActual(kpi)}</span>
        </div>

        {/* Score badge (hidden on mobile) */}
        {!mobile && (
          <div style={{ padding: '10px 8px', textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{
              background: tier.bg, color: tier.fg,
              fontSize: 10, fontWeight: 500, padding: '3px 10px',
              borderRadius: 6, whiteSpace: 'nowrap',
            }}>
              {tier.label}{kpi.score != null ? ` \u00b7 ${kpi.score}` : ''}
            </span>
          </div>
        )}

        {/* Payout */}
        <div style={{ padding: '10px 8px', textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ fontSize: mobile ? 12 : 13, fontWeight: 600, color: '#1c2119' }}>
            {slot?.payout != null ? `$${slot.payout}` : '—'}
          </span>
        </div>
      </div>
    );
  }

  // Renders a visibility-only metric: name + actual value + "info" badge, no
  // target/score/payout columns since it isn't part of the bonus calculation.
  function InfoMetricRow({ kpi, mobile, setDrillKey }) {
    const [hover, setHover] = useState(false);
    const clickable = !!(kpi.drillKey && setDrillKey);
    return (
      <div
        onClick={clickable ? () => setDrillKey(kpi.drillKey) : undefined}
        onMouseEnter={clickable ? () => setHover(true) : undefined}
        onMouseLeave={clickable ? () => setHover(false) : undefined}
        title={clickable ? 'View the exact records behind this metric' : undefined}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          gap: 10, padding: '10px 12px', background: clickable && hover ? '#f6f7f4' : 'transparent',
          cursor: clickable ? 'pointer' : 'default', transition: 'background 0.12s',
        }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 500, color: clickable && hover ? '#2E4057' : '#1c2119', lineHeight: 1.3 }}>
            {kpi.name}
            {clickable && <span style={{ marginLeft: 5, fontSize: 11, color: '#9aa595', fontWeight: 600 }}>{'›'}</span>}
            <span style={{ marginLeft: 6, background: '#eef1ea', color: '#6b7566', fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 3, letterSpacing: '0.03em', textTransform: 'uppercase' }}>Info only</span>
          </div>
          <div style={{ fontSize: 11, color: '#9aa595', marginTop: 3 }}>{kpi.definition}</div>
        </div>
        <div style={{ fontSize: mobile ? 14 : 15, fontWeight: 600, color: '#6b7566', whiteSpace: 'nowrap' }}>
          {fmtActual(kpi)}
        </div>
      </div>
    );
  }

  function TeamTrendCard({ roleTrend, quarters, mobile }) {
    if (!roleTrend || !quarters || !quarters.length) return null;
    const scorePct = roleTrend.scorePct || [];
    const bonusTotal = roleTrend.bonusTotal || [];
    const shortQ = (q) => { const parts = String(q).split(' '); return parts.length === 2 ? `${parts[0]} \u2019${parts[1].slice(2)}` : q; };
    const single = quarters.length < 2;
    return (
      <div style={{
        background: '#fff', border: '1px solid #e5e8e2', borderRadius: 8,
        padding: mobile ? 12 : 16, marginBottom: 10,
      }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#9aa595', marginBottom: 14 }}>
          Quarterly trend
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: mobile ? 8 : 16, overflowX: 'auto', paddingBottom: 2 }}>
          {quarters.map((q, i) => {
            const pct = scorePct[i];
            const h = pct != null ? Math.max(4, Math.round((pct / 100) * 88)) : 0;
            const color = pct == null ? '#e5e8e2' : pct >= 80 ? '#3d8c1f' : pct >= 50 ? '#d68910' : '#c0392b';
            return (
              <div key={q} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, flex: '0 0 auto', minWidth: mobile ? 46 : 58 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: pct != null ? '#1c2119' : '#cbd1c4' }}>{pct != null ? `${pct}%` : '\u2014'}</div>
                <div style={{ width: mobile ? 28 : 36, height: 88, background: '#f3f4f0', borderRadius: 4, display: 'flex', alignItems: 'flex-end', overflow: 'hidden' }}>
                  <div style={{ width: '100%', height: h, background: color, borderRadius: 4, transition: 'height .3s' }} />
                </div>
                <div style={{ fontSize: 10, color: '#6b7566', fontWeight: 600 }}>{shortQ(q)}</div>
                <div style={{ fontSize: 10, color: '#9aa595' }}>${(bonusTotal[i] || 0).toLocaleString()}</div>
              </div>
            );
          })}
        </div>
        {single && (
          <div style={{ fontSize: 10.5, color: '#9aa595', marginTop: 12, fontStyle: 'italic' }}>
            Trend builds as each quarter is captured \u2014 next quarter will appear here so you can compare progress over time.
          </div>
        )}
      </div>
    );
  }

  function TeamRolePanel({ role, mobile, setDrillKey, roleTrend, quarters }) {
    const bonus = role.bonus;
    const hasKpis = role.kpiResults && role.kpiResults.length > 0;
    const isPlaceholder = role.placeholder || (!hasKpis && role.maxBonus === 0);

    if (isPlaceholder) {
      return (
        <div style={{
          background: '#fff', border: '1px solid #e5e8e2', borderRadius: 8,
          padding: 20, textAlign: 'center', color: '#9aa595', fontSize: 12,
          fontStyle: 'italic',
        }}>
          {role.placeholderNote || 'No KPIs configured for this role yet.'}
        </div>
      );
    }

    return (
      <div>
        {/* Accountability KPIs table */}
        <div style={{
          background: '#fff', border: '1px solid #e5e8e2', borderRadius: 8,
          overflow: 'hidden',
        }}>
          {/* Header row */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: mobile ? '1fr 60px 60px' : 'minmax(0,2.5fr) 80px 80px 100px 80px',
            background: '#f6f7f4', borderBottom: '1px solid #e5e8e2',
          }}>
            <div style={{ padding: '8px 12px', fontSize: 10, fontWeight: 700, color: '#9aa595', letterSpacing: '0.08em', textTransform: 'uppercase' }}>KPI</div>
            {!mobile && <div style={{ padding: '8px 8px', fontSize: 10, fontWeight: 700, color: '#9aa595', letterSpacing: '0.08em', textTransform: 'uppercase', textAlign: 'center' }}>Target</div>}
            <div style={{ padding: '8px 8px', fontSize: 10, fontWeight: 700, color: '#9aa595', letterSpacing: '0.08em', textTransform: 'uppercase', textAlign: 'center' }}>Actual</div>
            {!mobile && <div style={{ padding: '8px 8px', fontSize: 10, fontWeight: 700, color: '#9aa595', letterSpacing: '0.08em', textTransform: 'uppercase', textAlign: 'center' }}>Score</div>}
            <div style={{ padding: '8px 8px', fontSize: 10, fontWeight: 700, color: '#9aa595', letterSpacing: '0.08em', textTransform: 'uppercase', textAlign: 'center' }}>Payout</div>
          </div>

          {/* KPI rows */}
          {role.kpiResults.map((kpi, i) => (
            <div key={kpi.id} style={{ borderBottom: i < role.kpiResults.length - 1 ? '1px solid #f3f4f0' : 'none' }}>
              <TeamKpiRow kpi={kpi} slot={bonus.slots[i]} mobile={mobile} setDrillKey={setDrillKey} kpiTrend={roleTrend?.kpis?.[kpi.id]} quarters={quarters} />
            </div>
          ))}
        </div>

        {/* Visibility-only metrics — not scored, not part of the bonus calc above */}
        {role.infoResults && role.infoResults.length > 0 && (
          <div style={{
            background: '#fff', border: '1px solid #e5e8e2', borderRadius: 8,
            marginTop: 8, overflow: 'hidden',
          }}>
            {role.infoResults.map((kpi, i) => (
              <div key={kpi.id} style={{ borderBottom: i < role.infoResults.length - 1 ? '1px solid #f3f4f0' : 'none' }}>
                <InfoMetricRow kpi={kpi} mobile={mobile} setDrillKey={setDrillKey} />
              </div>
            ))}
          </div>
        )}

        {/* Bonus calculator bar */}
        <div style={{
          background: '#f6f7f4', border: '1px solid #e5e8e2', borderRadius: 8,
          padding: mobile ? '12px 14px' : '14px 20px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          flexWrap: 'wrap', gap: 10, marginTop: 8,
        }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#6b7566', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Quarterly bonus estimate
            </div>
            <div style={{ fontSize: 11, color: '#9aa595', marginTop: 3 }}>
              Score: {role.totalScore}/{role.maxScore}
              {role.scorePct != null ? ` (${role.scorePct}%)` : ''}
              {' \u00b7 '}
              {role.kpiResults.length} KPIs \u00d7 ${bonus.slotValue} max each
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{
              fontSize: mobile ? 24 : 28, fontWeight: 300, letterSpacing: '-1px',
              color: bonus.total > 0 ? '#1c2119' : '#9aa595',
            }}>
              ${bonus.total.toLocaleString()}
            </div>
            <div style={{ fontSize: 10, color: '#9aa595' }}>of ${bonus.max.toLocaleString()} max</div>
          </div>
        </div>

        {/* Score legend */}
        <div style={{
          display: 'flex', gap: 16, flexWrap: 'wrap', marginTop: 12,
          fontSize: 12, color: '#6b7566',
        }}>
          {[
            { tier: 'green', text: `Best (3) = met target \u2192 $${bonus.slotValue}` },
            { tier: 'amber', text: `Better (2) = within 10% \u2192 $${Math.round(bonus.slotValue * 2/3)}` },
            { tier: 'coral', text: `Good (1) = within 20% \u2192 $${Math.round(bonus.slotValue / 3)}` },
            { tier: 'red',   text: 'Red (0) = missed >20% \u2192 $0' },
          ].map(l => (
            <span key={l.tier} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 9, height: 9, borderRadius: '50%', background: TIER_COLORS[l.tier].fg }} />
              {l.text}
            </span>
          ))}
        </div>
      </div>
    );
  }

  const TEAM_QUARTERS = ['q1', 'q2', 'q3', 'q4'];

  function TeamPerformanceView({ mobile, setDrillKey }) {
    const [selectedRole, setSelectedRole] = useState(TEAM?.roles?.[0]?.id || 'pm');
    const [pw, setPw] = useState('');
    const [unlocked, setUnlocked] = useState(() => sessionStorage.getItem('limehouse_ceo') === '1');
    const [err, setErr] = useState(false);

    // Team Performance has its OWN period selector (Q1–Q4 of the current
    // year), completely independent of the main dashboard's This Month/Last
    // Month/etc. filter — these are bonus/accountability KPIs evaluated per
    // quarter, not a live in-progress view. Defaults to whichever quarter
    // "today" falls in.
    const [teamRange, setTeamRange] = useState(() => {
      const saved = sessionStorage.getItem('limehouse_team_range');
      if (saved && TEAM_QUARTERS.includes(saved)) return saved;
      return 'q' + (Math.floor(new Date().getMonth() / 3) + 1);
    });
    const [teamData, setTeamData] = useState(TEAM);
    const [teamLoading, setTeamLoading] = useState(false);

    useEffect(() => { sessionStorage.setItem('limehouse_team_range', teamRange); }, [teamRange]);

    useEffect(() => {
      let cancelled = false;
      setTeamLoading(true);
      fetch('/api/dashboard?period=' + encodeURIComponent(teamRange), { cache: 'no-store' })
        .then(r => r.json())
        .then(j => {
          if (cancelled || !j || !j.dashboard) return;
          setTeamData(j.dashboard.teamPerformance);
        })
        .catch(() => { /* keep showing the previous quarter's data on error */ })
        .finally(() => { if (!cancelled) setTeamLoading(false); });
      return () => { cancelled = true; };
    }, [teamRange]);

    const data = teamData;

    if (!unlocked) {
      return (
        <div style={{ minHeight: 480, display:'flex', alignItems:'center', justifyContent:'center' }}>
          <form onSubmit={(e) => { e.preventDefault(); if (pw === 'LimehouseRTCS') { sessionStorage.setItem('limehouse_ceo','1'); setUnlocked(true); } else { setErr(true); } }}
            style={{ background:'#fff', border:'1px solid #e5e8e2', borderRadius:8, padding:'28px 32px', width: mobile?280:340, boxShadow:'0 4px 18px rgba(0,0,0,0.04)' }}>
            <div style={{ fontSize:11, fontWeight:700, letterSpacing:'0.12em', textTransform:'uppercase', color:'#9aa595', marginBottom:6 }}>Team Performance</div>
            <div style={{ fontSize:15, color:'#1c2119', marginBottom:18, fontWeight:500 }}>Enter password to continue</div>
            <input type="password" value={pw} onChange={(e) => { setPw(e.target.value); setErr(false); }}
              autoFocus placeholder="Password"
              style={{ width:'100%', padding:'10px 12px', fontSize:13, border: err ? '1px solid #c0392b' : '1px solid #cbd1c4', borderRadius:6, fontFamily:'inherit', boxSizing:'border-box', outline:'none' }} />
            {err && <div style={{ color:'#c0392b', fontSize:11, marginTop:6 }}>Incorrect password.</div>}
            <button type="submit" style={{ marginTop:14, width:'100%', padding:'10px 12px', background:'#1c2119', color:'#fff', border:'none', borderRadius:6, fontSize:13, fontWeight:500, cursor:'pointer', fontFamily:'inherit' }}>Unlock</button>
          </form>
        </div>
      );
    }

    // Q1–Q4 selector — own to this tab, independent of the main dashboard filter.
    const quarterSelector = (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: mobile ? 12 : 16 }}>
        <div style={{ display: 'flex', gap: 4 }}>
          {TEAM_QUARTERS.map(q => {
            const active = q === teamRange;
            return (
              <button key={q} onClick={() => setTeamRange(q)} style={{
                background: active ? '#1c2119' : '#f6f7f4',
                color: active ? '#fff' : '#6b7566',
                border: active ? 'none' : '1px solid #e5e8e2',
                fontSize: 11, fontWeight: active ? 600 : 500,
                padding: '6px 13px', borderRadius: 6, cursor: 'pointer',
                fontFamily: 'inherit', letterSpacing: '0.03em', textTransform: 'uppercase',
              }}>
                {q.toUpperCase()}
              </button>
            );
          })}
        </div>
        {teamLoading && <span style={{ color: '#9aa595', fontStyle: 'italic', fontSize: 11.5 }}>updating…</span>}
      </div>
    );

    if (!data || !data.roles) {
      return (
        <div style={{ padding: mobile ? '12px 12px 28px' : '18px 26px 32px', maxWidth: 1480, margin: '0 auto' }}>
          {quarterSelector}
          <div style={{
            minHeight: 300, display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#9aa595', fontSize: 13, fontStyle: 'italic',
          }}>
            Team performance data not yet loaded. Run a sync to populate.
          </div>
        </div>
      );
    }

    const role = data.roles.find(r => r.id === selectedRole) || data.roles[0];

    return (
      <div style={{
        padding: mobile ? '12px 12px 28px' : '18px 26px 32px', maxWidth: 1480, margin: '0 auto',
        opacity: teamLoading ? 0.6 : 1, transition: 'opacity 0.15s',
      }}>

        {quarterSelector}

        {/* Header */}
        <div style={{
          fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase',
          color: '#9aa595', margin: '4px 0 14px',
        }}>
          {data.quarterLabel} · as of {data.asOf}
        </div>

        {/* In-progress quarter notice — the selected quarter hasn't ended yet,
            so its numbers are still accumulating and aren't final. */}
        {data.inProgress && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            background: '#fdf6e3', border: '1px solid #f0e0a8', borderRadius: 6,
            padding: '9px 14px', marginBottom: mobile ? 12 : 16,
            fontSize: 12.5, color: '#7a6420',
          }}>
            <span style={{ fontWeight: 700 }}>In progress</span>
            <span>
              {data.quarterEnd
                ? `${data.quarterLabel} ends ${new Date(data.quarterEnd).toLocaleDateString('en-US', { timeZone: 'UTC', month: 'long', day: 'numeric', year: 'numeric' })} — data is still accumulating.`
                : 'This quarter has not ended yet — data is still accumulating.'}
            </span>
          </div>
        )}

        {/* Role selector */}
        <div style={{
          display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: mobile ? 12 : 16,
        }}>
          {data.roles.map(r => {
            const active = r.id === role.id;
            const hasData = r.kpiResults?.some(k => k.actual != null);
            return (
              <button key={r.id} onClick={() => setSelectedRole(r.id)} style={{
                background: active ? '#2E4057' : '#f6f7f4',
                color: active ? '#fff' : '#6b7566',
                border: active ? 'none' : '1px solid #e5e8e2',
                fontSize: 11, fontWeight: active ? 600 : 500,
                padding: '7px 14px', borderRadius: 6, cursor: 'pointer',
                fontFamily: 'inherit', letterSpacing: '0.02em',
                opacity: r.placeholder ? 0.5 : 1,
              }}>
                {r.name}
              </button>
            );
          })}
        </div>

        {/* Role header card */}
        <div style={{
          background: '#fff', border: '1px solid #e5e8e2', borderRadius: 8,
          padding: mobile ? 12 : 16, marginBottom: 10,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          flexWrap: 'wrap', gap: 10,
        }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 600, color: '#1c2119' }}>{role.name}</div>
            <div style={{ fontSize: 11, color: '#9aa595', marginTop: 2 }}>
              {role.placeholder
                ? (role.placeholderNote || 'No KPIs configured')
                : `${role.kpiResults?.length || 0} accountability KPIs \u00b7 $${role.maxBonus} max quarterly bonus`
              }
            </div>
          </div>
          {!role.placeholder && role.scorePct != null && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10,
            }}>
              {/* Score ring */}
              <div style={{
                width: 48, height: 48, borderRadius: '50%',
                border: `3px solid ${role.scorePct >= 80 ? '#3d8c1f' : role.scorePct >= 50 ? '#d68910' : '#c0392b'}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 14, fontWeight: 600, color: '#1c2119',
              }}>
                {role.scorePct}%
              </div>
            </div>
          )}
        </div>

        {/* Quarterly trend */}
        {!role.placeholder && <TeamTrendCard roleTrend={data.trend?.roles?.[role.id]} quarters={data.trend?.quarters} mobile={mobile} />}

        {/* Role panel */}
        <TeamRolePanel role={role} mobile={mobile} setDrillKey={setDrillKey} roleTrend={data.trend?.roles?.[role.id]} quarters={data.trend?.quarters} />

        {/* Footer */}
        <div style={{
          marginTop: 28, paddingTop: 16, borderTop: '1px solid #e5e8e2',
          fontSize: 10, color: '#9aa595', textAlign: 'center',
        }}>
          Limehouse PM · Team Performance · {data.quarterLabel}
        </div>
      </div>
    );
  }


  function CeoView({ mobile, SD, showSource, setDrillKey, k }) {
    const [pw, setPw] = useState('');
    const [unlocked, setUnlocked] = useState(() => sessionStorage.getItem('limehouse_ceo') === '1');
    const [err, setErr] = useState(false);
    if (!unlocked) {
      return (
        <div style={{ minHeight: 480, display:'flex', alignItems:'center', justifyContent:'center' }}>
          <form onSubmit={(e) => { e.preventDefault(); if (pw === 'LimehouseRTCS') { sessionStorage.setItem('limehouse_ceo','1'); setUnlocked(true); } else { setErr(true); } }}
            style={{ background:'#fff', border:'1px solid #e5e8e2', borderRadius:8, padding:'28px 32px', width: mobile?280:340, boxShadow:'0 4px 18px rgba(0,0,0,0.04)' }}>
            <div style={{ fontSize:11, fontWeight:700, letterSpacing:'0.12em', textTransform:'uppercase', color:'#9aa595', marginBottom:6 }}>CEO View</div>
            <div style={{ fontSize:15, color:'#1c2119', marginBottom:18, fontWeight:500 }}>Enter password to continue</div>
            <input type="password" value={pw} onChange={(e) => { setPw(e.target.value); setErr(false); }}
              autoFocus placeholder="Password"
              style={{ width:'100%', padding:'10px 12px', fontSize:13, border: err ? '1px solid #c0392b' : '1px solid #cbd1c4', borderRadius:6, fontFamily:'inherit', boxSizing:'border-box', outline:'none' }} />
            {err && <div style={{ color:'#c0392b', fontSize:11, marginTop:6 }}>Incorrect password.</div>}
            <button type="submit" style={{ marginTop:14, width:'100%', padding:'10px 12px', background:'#1c2119', color:'#fff', border:'none', borderRadius:6, fontSize:13, fontWeight:500, cursor:'pointer', fontFamily:'inherit' }}>Unlock</button>
          </form>
        </div>
      );
    }
    return (
      <div style={{ padding: mobile ? '12px 12px 28px' : '18px 26px 32px', maxWidth: 1480, margin: '0 auto' }}>
        <div style={{ display:'flex', alignItems:'baseline', justifyContent:'space-between', gap:12, margin:'4px 0 12px', flexWrap:'wrap' }}>
          <div style={{ fontSize:11, fontWeight:700, letterSpacing:'0.12em', textTransform:'uppercase', color:'#9aa595' }}>CEO View · Financial Performance</div>
        </div>
        <YoYIncomeRows mobile={mobile} SD={SD} showSource={showSource} setDrillKey={setDrillKey} k={k} />
        <PerformanceByRole SD={SD} mobile={mobile} setDrillKey={setDrillKey} />
      </div>
    );
  }

  function Render({ tweaks }) {
    const [drillKey, setDrillKey] = useState(null);
    const [logsOpen, setLogsOpen] = useState(false);
    // Persist the active tab + reporting period across reloads so a refresh (or
    // the post-sync auto-reload) keeps the user where they were.
    const [tab, setTab] = useState(() => {
      const saved = sessionStorage.getItem('limehouse_tab');
      return ['dashboard', 'team', 'ceo'].includes(saved) ? saved : 'dashboard';
    });
    const [range, setRange] = useState(() => {
      const saved = sessionStorage.getItem('limehouse_range');
      if (saved && RANGES[saved]) return saved;
      return RANGES[tweaks.range] ? tweaks.range : DEFAULT_RANGE;
    });
    const mobile = tweaks.viewport === 'phone';
    const showSource = tweaks.sourcePills;
    const yoy = tweaks.yoyMode;
    const dgrid = (cols) => mobile ? 'repeat(2, 1fr)' : `repeat(${cols}, 1fr)`;

    useEffect(() => { sessionStorage.setItem('limehouse_tab', tab); }, [tab]);
    useEffect(() => { sessionStorage.setItem('limehouse_range', range); }, [range]);

    // Per-period payload. The page boots with the default-period data already in
    // window.LIMEHOUSE_DATA; switching periods re-fetches the server window.
    const [payload, setPayload] = useState(() => ({
      data: D,
      drill: DRILL,
      period: (D.meta && D.meta.window && D.meta.window.key) || DEFAULT_RANGE,
    }));
    const [loading, setLoading] = useState(false);

    useEffect(() => {
      if (range === payload.period) return;
      let cancelled = false;
      setLoading(true);
      fetch('/api/dashboard?period=' + encodeURIComponent(range), { cache: 'no-store' })
        .then(r => r.json())
        .then(j => {
          if (cancelled || !j || !j.dashboard) return;
          setPayload({ data: j.dashboard, drill: j.drilldowns || DRILL, period: range });
        })
        .catch(() => { /* keep showing the previous period on error */ })
        .finally(() => { if (!cancelled) setLoading(false); });
      return () => { cancelled = true; };
    }, [range]);

    const SD = payload.data;
    const DRILLD = payload.drill;
    const win = (SD.meta && SD.meta.window) || { label: RANGES[range].label, start: '', end: '' };
    // While a new period's fetch is in flight, payload.data is still the OLD
    // period's data — show the generic range label (known instantly from the
    // click) instead of the stale server-computed window label, which would
    // otherwise freeze on the previous period until the fetch resolves.
    const periodLabel = range === payload.period ? (win.label || RANGES[range].label) : RANGES[range].label;

    // Set of drill keys backed by real, live API data (windowed flow metrics are
    // real server-computed numbers, so they qualify too).
    const liveSet = useMemo(
      () => new Set(SD.meta?.liveMetrics || []),
      [SD]
    );

    // Helper to assemble KPI props from data + drill key
    const k = (label, source, valueObj, unit, sparkKey, sparkColor, big, accent, drillId) => ({
      label, source, value: valueObj.value, unit: unit ?? valueObj.unit,
      delta: yoy ? fmt.delta(valueObj.value, valueObj.prevYear, valueObj.invertDelta) : null,
      spark: sparkKey ? SD.spark[sparkKey] : null,
      sparkColor, big, accent,
      onClick: drillId ? () => setDrillKey(drillId) : undefined,
      live: drillId ? liveSet.has(drillId) : false,
      decimals: valueObj.decimals,
    });

    const healthColors = { 'Healthy':'#3d8c1f','At-risk':'#d68910','Waitlist':'#7d3c98','On Hold':'#2471a3','Off-Market':'#aab5a3' };

    const drill = drillKey ? DRILLD[drillKey] : null;

    return (
      <div style={{ background: '#f4f5f3', minHeight: '100%', fontFamily: "'Outfit', sans-serif" }}>
        <Header syncedAt={SD.meta.syncedAt} range={range} onRangeChange={setRange} mobile={mobile} onLogsOpen={() => setLogsOpen(true)} />

        {/* Tab nav */}
        <div style={{
          background: '#fff', borderBottom: '1px solid #e5e8e2',
          padding: mobile ? '0 14px' : '0 26px',
          display: 'flex', alignItems: 'stretch', gap: 0,
        }}>
          {[{id:'dashboard',label:'Dashboard'},{id:'team',label:'Team Performance'},{id:'ceo',label:'CEO View'}].map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              background:'transparent', border:'none', borderBottom: tab===t.id ? '2px solid #1c2119' : '2px solid transparent',
              padding: mobile ? '10px 14px' : '12px 18px', fontSize: 12, fontWeight: tab===t.id ? 600 : 500,
              color: tab===t.id ? '#1c2119' : '#6b7566', cursor:'pointer', fontFamily:'inherit', letterSpacing:'0.02em',
            }}>{t.label}</button>
          ))}
        </div>

        {tab === 'ceo' ? <CeoView mobile={mobile} SD={SD} showSource={showSource} setDrillKey={setDrillKey} k={k} />
         : tab === 'team' ? <TeamPerformanceView mobile={mobile} setDrillKey={setDrillKey} />
         : (<>

        {/* Range banner — confirms what the user is looking at */}
        <div style={{
          background: '#fff', borderBottom: '1px solid #e5e8e2',
          padding: mobile ? '8px 14px' : '8px 26px',
          display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
          fontSize: 11.5, color: '#6b7566',
        }}>
          <span style={{ fontWeight: 600, color: '#1c2119', letterSpacing: '0.04em' }}>{periodLabel.toUpperCase()}</span>
          {loading && <span style={{ color: '#9aa595', fontStyle: 'italic' }}>updating…</span>}
          <span style={{ color: '#cbd1c4' }}>·</span>
          <span>Flow metrics for this period; <b style={{ color: '#1c2119' }}>structural metrics shown as of today{SD.meta?.asOf ? ` (${SD.meta.asOf})` : ''}</b></span>
          <span style={{ color: '#cbd1c4' }}>·</span>
          <span>Tap any tile for the full record list</span>
          {range !== DEFAULT_RANGE && (
            <button onClick={() => setRange(DEFAULT_RANGE)} style={{
              marginLeft: 'auto', background: 'transparent', border: '1px solid #e5e8e2',
              color: '#6b7566', fontSize: 10.5, padding: '3px 9px', borderRadius: 5,
              cursor: 'pointer', fontFamily: "'Outfit', sans-serif",
            }}>Reset to Current Month</button>
          )}
        </div>

        <div style={{
          padding: mobile ? '12px 12px 28px' : '18px 26px 32px', maxWidth: 1480, margin: '0 auto',
          opacity: loading ? 0.5 : 1, transition: 'opacity 0.15s', pointerEvents: loading ? 'none' : 'auto',
        }}>

          {/* HERO */}
          <div style={{
            display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12,
            margin: '4px 0 12px', flexWrap: 'wrap',
          }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#9aa595' }}>Top of Mind</div>
            </div>
            {yoy && <div style={{ fontSize: 11, color: '#9aa595' }}>YoY shown vs same period a year ago</div>}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: dgrid(4), gap: mobile ? 8 : 10 }}>
            <KPI {...k('Total delinquent', 'BD', SD.financials.delinquent, '$', 'delinquent', '#c0392b', true, 'red', 'delinquent')} mobile={mobile} showSource={showSource} />
            <KPI {...k('Occupancy', 'BD', SD.occupancy.rate, '%', 'occupancy', '#3d8c1f', true, null, 'occupancy')} mobile={mobile} showSource={showSource} />
            <KPI {...k('Renewal rate', 'BD', SD.leasing.renewalRate, '%', 'renewalRate', '#2471a3', true, 'blue', 'renewalRate')} mobile={mobile} showSource={showSource} />
            <KPI label="Net doors" source="BD" value={'+' + SD.occupancy.netDoors.value}
              delta={yoy ? fmt.delta(SD.occupancy.netDoors.value, SD.occupancy.netDoors.prevYear) : null}
              spark={SD.spark.doorsAdded.map((a, i) => a - SD.spark.doorsLost[i])}
              sparkColor="#3d8c1f"
              big mobile={mobile} showSource={showSource} accent="green"
              live={liveSet.has('netDoors')}
              onClick={() => setDrillKey('netDoors')} />
          </div>

          {/* FINANCIALS */}
          <SectionHeader title="Financials" subtitle="Income, collection, delinquency" />
          <div style={{ display: 'grid', gridTemplateColumns: dgrid(3), gap: mobile ? 8 : 10, marginBottom: mobile ? 8 : 10 }}>
            <KPI {...k('Rent by 3rd', 'BD', SD.financials.rentCollectedBy3rd, '%', 'rentCollected3rd', '#3d8c1f', false, null, 'rentCollectedBy3rd')} mobile={mobile} showSource={showSource} />
            <KPI {...k('Rent by 10th', 'BD', SD.financials.rentCollectedBy10th, '%', 'rentCollected10th', '#3d8c1f', false, null, 'rentCollectedBy10th')} mobile={mobile} showSource={showSource} />
            <KPI {...k('Avg rent / lease', 'BD', SD.financials.avgRentPerDoor, '$', 'avgRent', '#3d8c1f', false, null, 'avgRentPerDoor')} mobile={mobile} showSource={showSource} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: dgrid(2), gap: mobile ? 8 : 10, marginBottom: mobile ? 8 : 10 }}>
            <KPI {...k('Avg SD withheld', 'BD', SD.financials.avgSdWithheld, '$', null, null, false, null, 'avgSdWithheld')} mobile={mobile} showSource={showSource} />
            <KPI {...k('Avg SD withheld %', 'BD', SD.financials.avgSdWithheldPct, '%', null, null, false, null, 'avgSdWithheldPct')} mobile={mobile} showSource={showSource} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: mobile ? '1fr' : '2fr 1fr', gap: mobile ? 8 : 10, marginBottom: mobile ? 8 : 10 }}>
            <ChartCard mobile={mobile}
              title="Rent collection — 12 months"
              subtitle="% of leases paid by the 3rd vs 10th of month"
              legend={
                <div style={{ display:'flex', gap:10, fontSize: 10, color:'#6b7566' }}>
                  <span style={{ display:'inline-flex',alignItems:'center',gap:4 }}><span style={{ width:8,height:8,background:'#3d8c1f',borderRadius:2 }} />By 3rd</span>
                  <span style={{ display:'inline-flex',alignItems:'center',gap:4 }}><span style={{ width:8,height:8,background:'#a8c898',borderRadius:2 }} />By 10th</span>
                </div>
              }>
              <DualBars data={SD.rentCollectionByMonth} keys={['by3rd','by10th']} colors={['#3d8c1f','#a8c898']} height={mobile?70:80} yMax={100} />
            </ChartCard>
            <ChartCard mobile={mobile}
              title="Delinquency aging"
              subtitle={`${fmt.money(SD.financials.delinquent.value)} across ${SD.financials.delinquentCount.value} leases`}
              onClick={() => setDrillKey('delinquent')}>
              <HBars
                rows={SD.agingBuckets.map(b => ({ label: b.label + ' days', value: b.amount, color: b.color }))}
                valueFmt={fmt.money}
                height={12}
              />
            </ChartCard>
          </div>

          {/* OCCUPANCY */}
          <SectionHeader title="Occupancy & Doors" />
          <div style={{ display: 'grid', gridTemplateColumns: dgrid(5), gap: mobile ? 8 : 10 }}>
            <KPI {...k('Total units', 'BD', { value: SD.occupancy.totalUnits, prevYear: 96 }, null, null, null, false, null, 'totalUnits')} mobile={mobile} showSource={showSource} />
            <KPI {...k('Vacant — not rented', 'BD', SD.occupancy.vacantNotRented, '', null, '#c0392b', false, 'red', 'vacantNotRented')} mobile={mobile} showSource={showSource} />
            <KPI {...k('Avg days vacant', 'BD', SD.occupancy.avgDaysVacant, null, null, null, false, null, 'avgDaysVacant')} mobile={mobile} showSource={showSource} />
            <KPI {...k('Doors added ⏳', 'BD', SD.occupancy.doorsAdded, '', 'doorsAdded', '#9aa595', false, null, 'doorsAdded')} mobile={mobile} showSource={showSource} />
            <KPI {...k('Doors lost (churn)', 'BD', SD.occupancy.doorsLost, '', 'doorsLost', '#c0392b', false, 'red', 'doorsLost')} mobile={mobile} showSource={showSource} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: mobile ? '1fr' : '2fr 1fr', gap: mobile ? 8 : 10, marginTop: mobile ? 8 : 10 }}>
            <ChartCard mobile={mobile}
              title="Occupancy rate — 12 months"
              subtitle="Trailing monthly occupancy"
              onClick={() => setDrillKey('occupancy')}>
              <LineChart
                data={SD.occupancyTrend}
                series={[{ key: 'rate', color: '#3d8c1f' }]}
                height={mobile ? 100 : 120}
                yFmt={(v) => v + '%'}
              />
            </ChartCard>
            <ChartCard mobile={mobile} title="Property health" subtitle="Healthy = occupied · At-risk = delinquent · Off-Market = vacant">
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <Donut data={SD.healthCounts} size={mobile?80:96} thickness={mobile?12:14} colors={healthColors} />
                <div style={{ flex:1 }}>
                  {Object.entries(SD.healthCounts).map(([key, v]) => (
                    <div key={key} style={{ display:'flex', alignItems:'center', gap: 6, fontSize: 11, padding: '2px 0' }}>
                      <span style={{ width:8, height:8, borderRadius:2, background: healthColors[key] }} />
                      <span style={{ flex: 1, color: '#1c2119' }}>{key}</span>
                      <span style={{ color: '#6b7566', fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>{v}</span>
                    </div>
                  ))}
                </div>
              </div>
            </ChartCard>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: mobile ? '1fr' : '1fr 1fr', gap: mobile ? 8 : 10, marginTop: mobile ? 8 : 10 }}>
            <ChartCard mobile={mobile}
              title="Doors added vs lost — 12 months"
              legend={<div style={{ fontSize: 11, color:'#3d8c1f', fontWeight: 600 }}>Net +{SD.occupancy.netDoors.value}</div>}>
              <DualBars data={SD.doorsMonthly} keys={['added','lost']} colors={['#3d8c1f','#c0392b']} height={mobile?70:80} />
              <div style={{ display:'flex', justifyContent:'space-between', marginTop: 10, fontSize: 11, color: '#6b7566' }}>
                <span><span style={{ color:'#3d8c1f', fontWeight:600 }}>+{SD.occupancy.doorsAdded.value}</span> added</span>
                <span><span style={{ color:'#c0392b', fontWeight:600 }}>−{SD.occupancy.doorsLost.value}</span> lost</span>
                <span style={{ color:'#9aa595' }}>Churn {SD.occupancy.totalUnits ? ((SD.occupancy.doorsLost.value / SD.occupancy.totalUnits) * 100).toFixed(1) : '0.0'}%</span>
              </div>
            </ChartCard>
            <ChartCard mobile={mobile} title="Owners" subtitle={`${SD.occupancy.ownersTotal.value} active · +${SD.occupancy.ownersGained.value} gained`} onClick={() => setDrillKey('ownersTotal')}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div style={{ borderRight: '1px solid #eef0ec', paddingRight: 10 }}>
                  <div style={{ fontSize: 9.5, color: '#9aa595', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700 }}>Total</div>
                  <div style={{ fontSize: mobile ? 26 : 30, fontWeight: 300, color: '#1c2119', letterSpacing: '-1px', lineHeight: 1, marginTop: 4, fontVariantNumeric: 'tabular-nums' }}>{SD.occupancy.ownersTotal.value}</div>
                  {yoy && <div style={{ marginTop: 6 }}><DeltaPill delta={fmt.delta(SD.occupancy.ownersTotal.value, SD.occupancy.ownersTotal.prevYear)} size="sm" /></div>}
                </div>
                <div>
                  <div style={{ fontSize: 9.5, color: '#9aa595', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700 }}>Gained</div>
                  <div style={{ fontSize: mobile ? 26 : 30, fontWeight: 300, color: '#3d8c1f', letterSpacing: '-1px', lineHeight: 1, marginTop: 4, fontVariantNumeric: 'tabular-nums' }}>+{SD.occupancy.ownersGained.value}</div>
                  {yoy && <div style={{ marginTop: 6 }}><DeltaPill delta={fmt.delta(SD.occupancy.ownersGained.value, SD.occupancy.ownersGained.prevYear)} size="sm" /></div>}
                </div>
              </div>
            </ChartCard>
          </div>

          {/* LEASING */}
          <SectionHeader title="Leasing Pipeline" />
          <div style={{ display: 'grid', gridTemplateColumns: dgrid(4), gap: mobile ? 8 : 10 }}>
            <KPI {...k('Renewals', 'BD', SD.leasing.renewalsCount, null, null, null, false, null, 'renewalsCount')} mobile={mobile} showSource={showSource} />
            <KPI {...k('Fixed-term leases', 'BD', SD.leasing.fixedLeases, null, null, null, false, null, 'fixedLeases')} mobile={mobile} showSource={showSource} />
            <KPI {...k('Month-to-month', 'BD', SD.leasing.mtmLeases, null, null, null, false, null, 'mtmLeases')} mobile={mobile} showSource={showSource} />
            <KPI {...k('Apps submitted', 'BD', SD.leasing.appsSubmitted, null, null, null, false, null, 'appsSubmitted')} mobile={mobile} showSource={showSource} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: dgrid(4), gap: mobile ? 8 : 10, marginTop: mobile ? 8 : 10 }}>
            <KPI {...k('Move-ins', 'BD', SD.leasing.moveins, null, null, null, false, null, 'moveins')} mobile={mobile} showSource={showSource} />
            <KPI {...k('Apps per move-in', 'BD', SD.leasing.appsPerMovein, null, null, null, false, null, 'appsPerMovein')} mobile={mobile} showSource={showSource} />
            <KPI {...k('Evictions pending', 'BD', SD.leasing.evictionsPending, '', null, '#c0392b', false, 'red', 'evictionsPending')} mobile={mobile} showSource={showSource} />
            <ChartCard mobile={mobile} title={`Renewals — trailing 12 mo`} subtitle={`${SD.leasing.renewalsCount.value} total`} onClick={() => setDrillKey('renewalsCount')}>
              <MiniBars data={SD.renewalsByMonth} valueKey="count" height={mobile?40:46} color="#3d8c1f" />
            </ChartCard>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: dgrid(4), gap: mobile ? 8 : 10, marginTop: mobile ? 8 : 10 }}>
            <KPI {...k('Avg tenancy', 'BD', SD.leasing.avgTenancyMonths, 'mo', null, null, false, null, 'avgTenancyMonths')} mobile={mobile} showSource={showSource} />
          </div>

          {/* MARKETING */}
          <SectionHeader title="Marketing & Showings" />
          <div style={{ display: 'grid', gridTemplateColumns: dgrid(3), gap: mobile ? 8 : 10 }}>
            <KPI {...k('Avg days on market', 'RE', SD.marketing.avgDaysOnMarket, '', 'daysOnMarket', '#2471a3', false, null, 'avgDaysOnMarket')} mobile={mobile} showSource={showSource} />
            <KPI {...k('Median DOM', 'RE', SD.marketing.medianDaysOnMarket, null, null, null, false, null, 'medianDaysOnMarket')} mobile={mobile} showSource={showSource} />
            <KPI {...k('Units on market', 'RE', SD.marketing.unitsOnMarket, null, null, null, false, null, 'unitsOnMarket')} mobile={mobile} showSource={showSource} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: dgrid(2), gap: mobile ? 8 : 10, marginTop: mobile ? 8 : 10 }}>
            <KPI {...k('Showing Completion — Accompanied', 'RE', SD.marketing.completionRateAccompanied, '%', null, '#3d8c1f', false, null, 'completionRateAccompanied')} mobile={mobile} showSource={showSource} />
            <KPI {...k('Showing Completion — Self-Guided', 'RE', SD.marketing.completionRateSelfGuided, '%', null, '#2471a3', false, null, 'completionRateSelfGuided')} mobile={mobile} showSource={showSource} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: mobile ? '1fr' : '1fr 1fr', gap: mobile ? 8 : 10, marginTop: mobile ? 8 : 10 }}>
            <ChartCard mobile={mobile}
              title="Leasing funnel — last 12 months"
              subtitle="Prospect to move-in conversion"
              onClick={() => setDrillKey('newProspects')}>
              <Funnel steps={SD.marketingFunnel} color="#2471a3" />
            </ChartCard>
            <ChartCard mobile={mobile}
              title="New prospects by source"
              subtitle={`${SD.marketing.newProspects.value} prospects this period`}
              onClick={() => setDrillKey('newProspects')}>
              <HBars rows={SD.prospectsBySource} height={11} />
            </ChartCard>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: dgrid(4), gap: mobile ? 8 : 10, marginTop: mobile ? 8 : 10 }}>
            <KPI {...k('New prospects', 'RE', SD.marketing.newProspects, '', 'prospects', '#2471a3', false, null, 'newProspects')} mobile={mobile} showSource={showSource} />
            <KPI {...k('Showings completed', 'RE', SD.marketing.showingsCompleted, '', 'showings', '#2471a3', false, null, 'showingsCompleted')} mobile={mobile} showSource={showSource} />
            <KPI {...k('Total calls', 'RE', SD.marketing.totalCalls, null, null, null, false, null, 'totalCalls')} mobile={mobile} showSource={showSource} />
            <KPI {...k('Outbound texts', 'RE', SD.marketing.totalTexts, null, null, null, false, null, 'totalTexts')} mobile={mobile} showSource={showSource} />
          </div>

          <div style={{ marginTop: 28, paddingTop: 16, borderTop: '1px solid #e5e8e2', fontSize: 10, color: '#9aa595', textAlign: 'center' }}>
            Limehouse PM · Combined RentEngine + Buildium dashboard · YoY = same period last year
          </div>
        </div>
        </>)}

        <LogsPanel open={logsOpen} onClose={() => setLogsOpen(false)} />

        {/* Single unified drill-down modal — shared across all tabs */}
        <Modal open={!!drill} onClose={() => setDrillKey(null)}
          title={drill?.title}
          subtitle={drill?.summary}>
          {drill?.chart && (
            <div style={{ padding: '14px 22px 4px', borderBottom: '1px solid #eef0ec' }}>
              <div style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: '#9aa595', marginBottom: 8 }}>
                {drill.chart.title}
              </div>
              {drill.chart.kind === 'line' && (
                <LineChart data={SD[drill.chart.dataKey]} series={drill.chart.series} height={120} yFmt={drill.chart.yFmt} />
              )}
              {drill.chart.kind === 'dualbars' && (
                <DualBars data={SD[drill.chart.dataKey]} keys={drill.chart.keys} colors={drill.chart.colors} height={70} />
              )}
              {drill.chart.kind === 'minibars' && (
                <MiniBars data={SD[drill.chart.dataKey]} valueKey={drill.chart.valueKey} color={drill.chart.color} height={50} />
              )}
              {drill.chart.kind === 'hbars' && (
                <HBars rows={SD[drill.chart.dataKey]} height={11} />
              )}
            </div>
          )}
          {drill?.note && (
            <div style={{
              margin: '14px 22px 0', padding: '10px 12px',
              background: '#fff8e6', border: '1px solid #f0d68c', borderRadius: 7,
              fontSize: 12, color: '#6b5a1a', lineHeight: 1.45,
            }}>
              <span style={{ fontWeight: 700, marginRight: 6 }}>Note:</span>{drill.note}
            </div>
          )}
          {drill && <DrillTable cols={drill.cols} rows={drill.rows} />}
        </Modal>
      </div>
    );
  }
  return Render;
})();

window.VarA = VarA;
