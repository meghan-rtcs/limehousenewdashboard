// Variation A (standalone polished) — Tightened Classic
// Single-page Limehouse dashboard. Click any tile to drill down. Date filter scales numbers.
const VarA = (function() {
  const { useState, useEffect, useMemo } = React;
  const D = window.LIMEHOUSE_DATA;
  const DRILL = window.LIMEHOUSE_DRILLDOWNS;

  // ── Date-range scaling ────────────────────────────────────────────────────
  // Maps the range selector to (a) a multiplier for cumulative metrics like
  // "doors added", "renewals YTD", "apps submitted" — these grow with time —
  // and (b) the slice of monthly arrays the charts should display.
  const RANGES = {
    '7':   { months: 0.25, label: 'Last 7 days',   sliceTail: 1 },
    '30':  { months: 1,    label: 'Last 30 days',  sliceTail: 1 },
    '90':  { months: 3,    label: 'Last 90 days',  sliceTail: 3 },
    '180': { months: 6,    label: 'Last 6 months', sliceTail: 6 },
    '365': { months: 12,   label: 'Last 12 months',sliceTail: 12 },
    'ytd': { months: 4,    label: 'Year to date',  sliceTail: 4 },  // Apr 2026 → 4 months in
  };
  const cumulativeKeys = new Set([
    'doorsAdded','doorsLost','netDoors','ownersGained',
    'renewalsCount','appsSubmitted','moveins',
    'newProspects','showingsCompleted','totalCalls','totalTexts',
  ]);
  function scaleData(range) {
    const r = RANGES[range] || RANGES['365'];
    const factor = r.months / 12;
    const scale = (v) => Math.max(1, Math.round(v * factor));
    const scaled = JSON.parse(JSON.stringify(D));
    // Scale cumulative metrics — only on object-shaped sections, NOT arrays
    Object.keys(scaled).forEach(section => {
      const sec = scaled[section];
      if (!sec || typeof sec !== 'object' || Array.isArray(sec)) return;
      Object.keys(sec).forEach(key => {
        if (cumulativeKeys.has(key) && sec[key]?.value != null) {
          sec[key].value    = scale(sec[key].value);
          sec[key].prevYear = scale(sec[key].prevYear);
        }
      });
    });
    // Slice monthly arrays to the visible window
    const tail = r.sliceTail;
    scaled.rentCollectionByMonth = scaled.rentCollectionByMonth.slice(-Math.max(tail, 1));
    scaled.doorsMonthly          = scaled.doorsMonthly.slice(-Math.max(tail, 1));
    scaled.renewalsByMonth       = scaled.renewalsByMonth.slice(-Math.max(tail, 1));
    if (scaled.incomeMonthly)    scaled.incomeMonthly    = scaled.incomeMonthly.slice(-Math.max(tail, 1));
    if (scaled.occupancyTrend)   scaled.occupancyTrend   = scaled.occupancyTrend.slice(-Math.max(tail, 1));
    if (scaled.delinquentTrend)  scaled.delinquentTrend  = scaled.delinquentTrend.slice(-Math.max(tail, 1));
    Object.keys(scaled.spark).forEach(k => {
      scaled.spark[k] = scaled.spark[k].slice(-Math.max(tail, 2));
    });
    return { data: scaled, range: r };
  }

  // ── Header ────────────────────────────────────────────────────────────────
  function Header({ syncedAt, range, onRangeChange, mobile }) {
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
          <a href="#" style={{ fontSize: 12, color: '#6b7566', textDecoration: 'none', padding: '5px 9px', borderRadius: 6 }}>Logs</a>
          <a href="#" style={{ fontSize: 12, color: '#6b7566', textDecoration: 'none', padding: '5px 9px', borderRadius: 6 }}>Settings</a>
          <select value={range} onChange={(e) => onRangeChange(e.target.value)} style={{
            background: '#f4f5f3', border: '1px solid #e5e8e2',
            color: '#1c2119', padding: mobile ? '5px 24px 5px 9px' : '6px 26px 6px 11px',
            borderRadius: 7, fontSize: 12, fontFamily: "'Outfit', sans-serif",
            cursor: 'pointer', appearance: 'none', WebkitAppearance: 'none', outline: 'none',
            backgroundImage: "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 10 10'><path d='M2 4l3 3 3-3' stroke='%236b7566' stroke-width='1.2' fill='none' stroke-linecap='round'/></svg>\")",
            backgroundRepeat: 'no-repeat', backgroundPosition: 'right 8px center',
          }}>
            <option value="7">Last 7 days</option>
            <option value="30">Last 30 days</option>
            <option value="90">Last 90 days</option>
            <option value="180">Last 6 months</option>
            <option value="365">Last 12 months</option>
            <option value="ytd">Year to date</option>
          </select>
          <button onClick={async () => {
              if (syncing) return;
              setSyncing(true);
              try {
                await fetch('/api/sync', { method: 'POST' });
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

  // KPI tile — every tile is now drillable (cursor + hover)
  function KPI({ label, value, unit, delta, spark, sparkColor, source, onClick, big = false, mobile, showSource, accent }) {
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
            {typeof value === 'number' ? value.toLocaleString() : value}
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

  function Render({ tweaks }) {
    const [drillKey, setDrillKey] = useState(null);
    const [range, setRange] = useState(tweaks.range || '365');
    const mobile = tweaks.viewport === 'phone';
    const showSource = tweaks.sourcePills;
    const yoy = tweaks.yoyMode;
    const dgrid = (cols) => mobile ? 'repeat(2, 1fr)' : `repeat(${cols}, 1fr)`;

    // Recompute scaled data whenever the range changes
    const { data: SD, range: rangeMeta } = useMemo(() => scaleData(range), [range]);

    // Helper to assemble KPI props from data + drill key
    const k = (label, source, valueObj, unit, sparkKey, sparkColor, big, accent, drillId) => ({
      label, source, value: valueObj.value, unit: unit ?? valueObj.unit,
      delta: yoy ? fmt.delta(valueObj.value, valueObj.prevYear, valueObj.invertDelta) : null,
      spark: sparkKey ? SD.spark[sparkKey] : null,
      sparkColor, big, accent,
      onClick: drillId ? () => setDrillKey(drillId) : undefined,
    });

    const healthColors = { 'Healthy':'#3d8c1f','At-risk':'#d68910','Waitlist':'#7d3c98','On Hold':'#2471a3','Off-Market':'#aab5a3' };

    const drill = drillKey ? DRILL[drillKey] : null;

    return (
      <div style={{ background: '#f4f5f3', minHeight: '100%', fontFamily: "'Outfit', sans-serif" }}>
        <Header syncedAt={SD.meta.syncedAt} range={range} onRangeChange={setRange} mobile={mobile} />

        {/* Range banner — confirms what the user is looking at */}
        <div style={{
          background: '#fff', borderBottom: '1px solid #e5e8e2',
          padding: mobile ? '8px 14px' : '8px 26px',
          display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
          fontSize: 11.5, color: '#6b7566',
        }}>
          <span style={{ fontWeight: 600, color: '#1c2119', letterSpacing: '0.04em' }}>{rangeMeta.label.toUpperCase()}</span>
          <span style={{ color: '#cbd1c4' }}>·</span>
          <span>Showing data for the past <b style={{ color: '#1c2119' }}>{rangeMeta.months >= 1 ? Math.round(rangeMeta.months) + ' month' + (rangeMeta.months > 1 ? 's' : '') : '7 days'}</b></span>
          <span style={{ color: '#cbd1c4' }}>·</span>
          <span>Tap any tile for the full record list</span>
          {range !== '365' && (
            <button onClick={() => setRange('365')} style={{
              marginLeft: 'auto', background: 'transparent', border: '1px solid #e5e8e2',
              color: '#6b7566', fontSize: 10.5, padding: '3px 9px', borderRadius: 5,
              cursor: 'pointer', fontFamily: "'Outfit', sans-serif",
            }}>Reset to 12 months</button>
          )}
        </div>

        <div style={{ padding: mobile ? '12px 12px 28px' : '18px 26px 32px', maxWidth: 1480, margin: '0 auto' }}>

          {/* HERO */}
          <div style={{
            display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12,
            margin: '4px 0 12px', flexWrap: 'wrap',
          }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#9aa595' }}>Top of Mind</div>
              <div style={{ fontSize: mobile?16:18, color: '#1c2119', marginTop: 2, fontWeight: 500 }}>The four metrics you watch first</div>
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
              onClick={() => setDrillKey('netDoors')} />
          </div>

          {/* FINANCIALS */}
          <SectionHeader title="Financials" subtitle="Income, collection, delinquency" />
          <div style={{ display: 'grid', gridTemplateColumns: dgrid(4), gap: mobile ? 8 : 10, marginBottom: mobile ? 8 : 10 }}>
            <KPI {...k('Rent by 3rd', 'BD', SD.financials.rentCollectedBy3rd, '%', 'rentCollected3rd', '#3d8c1f', false, null, 'rentCollectedBy3rd')} mobile={mobile} showSource={showSource} />
            <KPI {...k('Rent by 10th', 'BD', SD.financials.rentCollectedBy10th, '%', 'rentCollected10th', '#3d8c1f', false, null, 'rentCollectedBy10th')} mobile={mobile} showSource={showSource} />
            <KPI {...k('Avg rent / door', 'BD', SD.financials.avgRentPerDoor, '$', 'avgRent', '#3d8c1f', false, null, 'avgRentPerDoor')} mobile={mobile} showSource={showSource} />
            <KPI {...k('Revenue / unit', 'BD', SD.financials.rpu, '$', 'rpu', '#3d8c1f', false, null, 'rpu')} mobile={mobile} showSource={showSource} />
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
              subtitle={`${fmt.money(SD.financials.delinquent.value)} across 7 leases`}
              onClick={() => setDrillKey('delinquent')}>
              <HBars
                rows={SD.agingBuckets.map(b => ({ label: b.label + ' days', value: b.amount, color: b.color }))}
                valueFmt={fmt.money}
                height={12}
              />
            </ChartCard>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: mobile ? '1fr' : '3fr 1fr 1fr', gap: mobile ? 8 : 10 }}>
            <ChartCard mobile={mobile}
              title="Gross & Net income — 12 months"
              subtitle="Monthly totals (thousands)"
              legend={
                <div style={{ display:'flex', gap:10, fontSize: 10, color:'#6b7566' }}>
                  <span style={{ display:'inline-flex',alignItems:'center',gap:4 }}><span style={{ width:8,height:8,background:'#3d8c1f',borderRadius:2 }} />Gross</span>
                  <span style={{ display:'inline-flex',alignItems:'center',gap:4 }}><span style={{ width:8,height:8,background:'#2471a3',borderRadius:2 }} />Net</span>
                </div>
              }
              onClick={() => setDrillKey('grossIncome')}>
              <LineChart
                data={SD.incomeMonthly}
                series={[
                  { key: 'gross', color: '#3d8c1f' },
                  { key: 'net',   color: '#2471a3' },
                ]}
                height={mobile ? 110 : 130}
                yFmt={(v) => '$' + v + 'k'}
              />
            </ChartCard>
            <KPI {...k('Gross income', 'BD', SD.financials.grossIncome, 'k', 'grossIncome', '#3d8c1f', false, null, 'grossIncome')} mobile={mobile} showSource={showSource} />
            <KPI {...k('Net income', 'BD', SD.financials.netIncome, 'k', 'netIncome', '#3d8c1f', false, null, 'netIncome')} mobile={mobile} showSource={showSource} />
          </div>

          {/* OCCUPANCY */}
          <SectionHeader title="Occupancy & Doors" />
          <div style={{ display: 'grid', gridTemplateColumns: dgrid(5), gap: mobile ? 8 : 10 }}>
            <KPI {...k('Total units', 'BD', { value: SD.occupancy.totalUnits, prevYear: 96 }, null, null, null, false, null, 'totalUnits')} mobile={mobile} showSource={showSource} />
            <KPI {...k('Vacant — not rented', 'BD', SD.occupancy.vacantNotRented, '', null, '#c0392b', false, 'red', 'vacantNotRented')} mobile={mobile} showSource={showSource} />
            <KPI {...k('Avg days vacant', 'BD', SD.occupancy.avgDaysVacant, null, null, null, false, null, 'avgDaysVacant')} mobile={mobile} showSource={showSource} />
            <KPI {...k('Doors added', 'BD', SD.occupancy.doorsAdded, '', 'doorsAdded', '#3d8c1f', false, null, 'doorsAdded')} mobile={mobile} showSource={showSource} />
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
            <ChartCard mobile={mobile} title="Property health" subtitle="Across all active units">
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
                <span style={{ color:'#9aa595' }}>Churn 7.1%</span>
              </div>
            </ChartCard>
            <ChartCard mobile={mobile} title="Owners" subtitle={`${SD.occupancy.ownersTotal.value} active · +${SD.occupancy.ownersGained.value} gained`} onClick={() => setDrillKey('ownersGained')}>
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
            <ChartCard mobile={mobile} title={`Renewals — ${rangeMeta.sliceTail} mo`} subtitle={`${SD.leasing.renewalsCount.value} total`} onClick={() => setDrillKey('renewalsCount')}>
              <MiniBars data={SD.renewalsByMonth} valueKey="count" height={mobile?40:46} color="#3d8c1f" />
            </ChartCard>
          </div>

          {/* MARKETING */}
          <SectionHeader title="Marketing & Showings" />
          <div style={{ display: 'grid', gridTemplateColumns: dgrid(4), gap: mobile ? 8 : 10 }}>
            <KPI {...k('Avg days on market', 'RE', SD.marketing.avgDaysOnMarket, '', 'daysOnMarket', '#2471a3', false, null, 'avgDaysOnMarket')} mobile={mobile} showSource={showSource} />
            <KPI {...k('Median DOM', 'RE', SD.marketing.medianDaysOnMarket, null, null, null, false, null, 'medianDaysOnMarket')} mobile={mobile} showSource={showSource} />
            <KPI {...k('Units on market', 'RE', SD.marketing.unitsOnMarket, null, null, null, false, null, 'unitsOnMarket')} mobile={mobile} showSource={showSource} />
            <KPI {...k('Completion rate', 'RE', SD.marketing.completionRate, '%', null, null, false, null, 'completionRate')} mobile={mobile} showSource={showSource} />
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

        {/* Single unified drill-down modal */}
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
          {drill && <DrillTable cols={drill.cols} rows={drill.rows} />}
        </Modal>
      </div>
    );
  }
  return Render;
})();

window.VarA = VarA;
