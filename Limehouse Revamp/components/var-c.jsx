// Variation C — Editorial / finance-app feel
// Bigger headline metrics get full chart treatment. Generous whitespace, type rhythm.
const VarC = (function() {
  const { useState } = React;
  const D = window.LIMEHOUSE_DATA;

  function Headline({ label, value, unit, delta, source, sparkData, sparkColor, mobile, showSource, onClick, sub }) {
    return (
      <div onClick={onClick} style={{
        background: '#fff', border: '1px solid #e5e8e2', borderRadius: 14,
        padding: mobile ? '16px 16px' : '22px 24px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
        cursor: onClick ? 'pointer' : 'default',
        transition: 'border-color .15s, transform .15s',
        display: 'flex', flexDirection: 'column', gap: 10,
      }}
      onMouseEnter={(e) => { if (onClick) e.currentTarget.style.borderColor = '#c8d6bf'; }}
      onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#e5e8e2'; }}
      >
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#6b7566', letterSpacing: '0.02em' }}>{label}</div>
          <SourcePill source={source} show={showSource} />
        </div>
        <div style={{
          fontSize: mobile ? 38 : 52, fontWeight: 300, color: '#1c2119',
          letterSpacing: '-2px', lineHeight: 0.95, fontVariantNumeric: 'tabular-nums',
        }}>
          {unit === '$' && <span style={{ fontSize: '0.5em', color: '#9aa595' }}>$</span>}
          {value}
          {unit && unit !== '$' && <span style={{ fontSize: '0.45em', color: '#9aa595', fontWeight: 400, marginLeft: 2 }}>{unit}</span>}
        </div>
        {sparkData && <Sparkline data={sparkData} color={sparkColor || '#3d8c1f'} width={mobile?320:360} height={mobile?32:40} strokeWidth={1.8} />}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap: 8 }}>
          {delta ? (
            <div style={{ display:'flex', alignItems:'center', gap: 6 }}>
              <DeltaPill delta={delta} size="md" />
              <span style={{ fontSize: 11, color: '#9aa595' }}>vs last yr</span>
            </div>
          ) : <span />}
          {sub && <div style={{ fontSize: 11, color: '#9aa595' }}>{sub}</div>}
        </div>
      </div>
    );
  }

  function Stat({ label, value, unit, delta, source, sparkData, sparkColor, mobile, showSource, onClick }) {
    return (
      <div onClick={onClick} style={{
        background: '#fff', border: '1px solid #e5e8e2', borderRadius: 10,
        padding: mobile ? '12px 13px' : '14px 16px',
        cursor: onClick ? 'pointer' : 'default',
        display: 'flex', flexDirection: 'column', gap: 6,
        transition: 'border-color .15s',
      }}
      onMouseEnter={(e) => { if (onClick) e.currentTarget.style.borderColor = '#c8d6bf'; }}
      onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#e5e8e2'; }}
      >
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap: 6 }}>
          <div style={{ fontSize: 10, fontWeight: 600, color: '#6b7566', letterSpacing: '0.03em', textTransform: 'uppercase' }}>{label}</div>
          <SourcePill source={source} show={showSource} />
        </div>
        <div style={{ display:'flex', alignItems:'baseline', justifyContent:'space-between', gap: 8 }}>
          <div style={{
            fontSize: mobile?22:26, fontWeight: 400, color: '#1c2119',
            letterSpacing: '-0.5px', lineHeight: 1, fontVariantNumeric: 'tabular-nums',
          }}>
            {unit === '$' && <span style={{ fontSize: '0.65em', color: '#9aa595' }}>$</span>}
            {typeof value === 'number' ? value.toLocaleString() : value}
            {unit && unit !== '$' && <span style={{ fontSize: '0.55em', color: '#9aa595', marginLeft: 1 }}>{unit}</span>}
          </div>
          {sparkData && <Sparkline data={sparkData} color={sparkColor || '#3d8c1f'} width={50} height={18} fill={false} />}
        </div>
        {delta && <DeltaPill delta={delta} size="sm" />}
      </div>
    );
  }

  function Render({ tweaks }) {
    const [modal, setModal] = useState(null);
    const mobile = tweaks.viewport === 'phone';
    const showSource = tweaks.sourcePills;
    const yoy = tweaks.yoyMode;

    const h = (label, source, valObj, unit, sparkKey, color, sub, onClick) => ({
      label, source, value: valObj.value, unit: unit ?? valObj.unit,
      delta: yoy ? fmt.delta(valObj.value, valObj.prevYear, valObj.invertDelta) : null,
      sparkData: sparkKey ? D.spark[sparkKey] : null,
      sparkColor: color, sub, mobile, showSource, onClick,
    });

    return (
      <div style={{ background: '#f8f8f5', minHeight: '100%', fontFamily: "'Outfit', sans-serif" }}>
        <DashHeader syncedAt={D.meta.syncedAt} range="365" onRangeChange={()=>{}} mobile={mobile} />

        {/* Editorial title bar */}
        <div style={{
          padding: mobile ? '18px 14px 10px' : '28px 32px 14px',
          display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 14, flexWrap: 'wrap',
        }}>
          <div>
            <div style={{ fontSize: 11, color: '#9aa595', letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: 600 }}>Portfolio Snapshot</div>
            <div style={{ fontSize: mobile?22:30, fontWeight: 400, color: '#1c2119', letterSpacing: '-0.5px', marginTop: 4 }}>April 2026</div>
          </div>
          <div style={{ fontSize: 12, color: '#6b7566', textAlign: mobile?'left':'right' }}>
            <div>{D.meta.buildiumUnits} units · {D.meta.activeLeases} active leases</div>
            <div style={{ color: '#9aa595', fontSize: 11, marginTop: 2 }}>YoY comparisons against same period 2025</div>
          </div>
        </div>

        <div style={{ padding: mobile ? '0 12px 24px' : '0 32px 32px' }}>

          {/* HEADLINE 3 */}
          <div style={{ display: 'grid', gridTemplateColumns: mobile ? '1fr' : 'repeat(3,1fr)', gap: mobile?10:14, marginBottom: mobile?12:18 }}>
            <Headline {...h('Rent collected by 3rd', 'BD', D.financials.rentCollectedBy3rd, '%', 'rentCollected3rd', '#3d8c1f', 'By 10th: 97%', () => setModal('rent3rd'))} />
            <Headline {...h('Occupancy', 'BD', D.occupancy.rate, '%', 'occupancy', '#3d8c1f', `${D.occupancy.occupiedUnits} / ${D.occupancy.totalUnits} units`)} />
            <Headline {...h('Renewal rate', 'BD', D.leasing.renewalRate, '%', 'renewalRate', '#2471a3', `${D.leasing.renewalsCount.value} renewals YTD`, () => setModal('renewals'))} />
          </div>

          {/* INCOME ROW — number + bar chart */}
          <SectionHeader title="Financials" />
          <div style={{ display:'grid', gridTemplateColumns: mobile?'1fr':'1.2fr 1fr 1fr', gap: mobile?10:14 }}>
            <div style={{ background:'#fff', border:'1px solid #e5e8e2', borderRadius:12, padding: mobile?'14px':'18px 20px' }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom: 10 }}>
                <div style={{ fontSize:10, fontWeight:700, letterSpacing:'0.1em', textTransform:'uppercase', color:'#6b7566' }}>Rent collection · 12 mo</div>
                <div style={{ display:'flex', gap:10, fontSize: 10, color:'#6b7566' }}>
                  <span style={{ display:'inline-flex',alignItems:'center',gap:4 }}><span style={{ width:8,height:8,background:'#3d8c1f',borderRadius:2 }} />By 3rd</span>
                  <span style={{ display:'inline-flex',alignItems:'center',gap:4 }}><span style={{ width:8,height:8,background:'#a8c898',borderRadius:2 }} />By 10th</span>
                </div>
              </div>
              <DualBars data={D.rentCollectionByMonth} keys={['by3rd','by10th']} colors={['#3d8c1f','#a8c898']} height={mobile?90:110} yMax={100} />
            </div>
            <Stat {...h('Avg rent / door', 'BD', D.financials.avgRentPerDoor, '$', 'avgRent', '#3d8c1f')} />
            <Stat {...h('RPU', 'BD', D.financials.rpu, '$', 'rpu', '#3d8c1f')} />
            <Stat {...h('Gross income', 'BD', D.financials.grossIncome, 'k', 'grossIncome', '#3d8c1f')} />
            <Stat {...h('Net income', 'BD', D.financials.netIncome, 'k', 'netIncome', '#3d8c1f')} />
            <Stat {...h('Total delinquent', 'BD', D.financials.delinquent, '$', 'delinquent', '#c0392b', undefined, () => setModal('delinquent'))} />
          </div>

          {/* OCCUPANCY ROW */}
          <SectionHeader title="Occupancy & Doors" />
          <div style={{ display: 'grid', gridTemplateColumns: mobile?'1fr':'1.2fr 1fr 1fr', gap: mobile?10:14 }}>
            <div style={{ background:'#fff', border:'1px solid #e5e8e2', borderRadius:12, padding: mobile?'14px':'18px 20px' }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom: 10 }}>
                <div style={{ fontSize:10, fontWeight:700, letterSpacing:'0.1em', textTransform:'uppercase', color:'#6b7566' }}>Doors added vs lost · 12 mo</div>
                <div style={{ fontSize: 11, color:'#3d8c1f', fontWeight: 600 }}>Net +16 YTD</div>
              </div>
              <DualBars data={D.doorsMonthly} keys={['added','lost']} colors={['#3d8c1f','#c0392b']} height={mobile?90:110} />
              <div style={{ display:'flex', justifyContent:'space-between', marginTop: 10, fontSize: 11, color: '#6b7566' }}>
                <span><span style={{ color:'#3d8c1f', fontWeight:600 }}>+24</span> added</span>
                <span><span style={{ color:'#c0392b', fontWeight:600 }}>−8</span> lost</span>
                <span style={{ color:'#9aa595' }}>Churn rate 7.1%</span>
              </div>
            </div>
            <Stat {...h('Doors added (YTD)', 'BD', D.occupancy.doorsAdded, '', 'doorsAdded', '#3d8c1f', undefined, () => setModal('doorsAdded'))} />
            <Stat {...h('Doors lost', 'BD', D.occupancy.doorsLost, '', 'doorsLost', '#c0392b')} />
            <Stat {...h('Vacant — not rented', 'BD', D.occupancy.vacantNotRented, '', null, '#c0392b')} />
            <Stat {...h('Avg days vacant', 'BD', D.occupancy.avgDaysVacant)} />
            <Stat {...h('Owners gained', 'BD', D.occupancy.ownersGained)} />
          </div>

          {/* LEASING + MARKETING side-by-side */}
          <div style={{ display: 'grid', gridTemplateColumns: mobile?'1fr':'1fr 1fr', gap: mobile?12:18, marginTop: 8 }}>
            <div>
              <SectionHeader title="Leasing Pipeline" />
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: mobile?8:10 }}>
                <Stat {...h('Renewals YTD', 'BD', D.leasing.renewalsCount, '', null, '#3d8c1f', undefined, () => setModal('renewals'))} />
                <Stat {...h('Apps submitted', 'BD', D.leasing.appsSubmitted)} />
                <Stat {...h('Move-ins', 'BD', D.leasing.moveins)} />
                <Stat {...h('Apps per move-in', 'BD', D.leasing.appsPerMovein)} />
                <Stat {...h('Fixed-term', 'BD', D.leasing.fixedLeases)} />
                <Stat {...h('Month-to-month', 'BD', D.leasing.mtmLeases)} />
              </div>
            </div>
            <div>
              <SectionHeader title="Marketing & Showings" />
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: mobile?8:10 }}>
                <Stat {...h('Days on market', 'RE', D.marketing.avgDaysOnMarket, '', 'daysOnMarket', '#2471a3')} />
                <Stat {...h('Median DOM', 'RE', D.marketing.medianDaysOnMarket)} />
                <Stat {...h('New prospects', 'RE', D.marketing.newProspects, '', 'prospects', '#2471a3')} />
                <Stat {...h('Showings done', 'RE', D.marketing.showingsCompleted, '', 'showings', '#2471a3')} />
                <Stat {...h('Completion %', 'RE', D.marketing.completionRate, '%')} />
                <Stat {...h('Outbound texts', 'RE', D.marketing.totalTexts)} />
              </div>
            </div>
          </div>
        </div>

        <Modal open={modal === 'rent3rd'} onClose={() => setModal(null)}
          title="Rent collected by 3rd of month"
          subtitle="91% on time vs 87% same period last year">
          <DrillTable cols={['Unit', 'Tenant', 'Rent', 'Status']}
            rows={D.rentCollectionDetail.map(r => [r.unit, r.tenant, fmt.money(r.rent), r.status])} />
        </Modal>
        <Modal open={modal === 'doorsAdded'} onClose={() => setModal(null)}
          title="Doors added — last 12 months"
          subtitle={`+${D.occupancy.doorsAdded.value} doors across ${D.doorsAddedDetail.length} new properties`}>
          <DrillTable cols={['Property', 'Owner', 'Onboard date', 'Units']}
            rows={D.doorsAddedDetail.map(r => [r.property, r.owner, r.date, r.units])} />
        </Modal>
      </div>
    );
  }
  return Render;
})();

window.VarC = VarC;
