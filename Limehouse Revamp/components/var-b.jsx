// Variation B — Compact mobile-first rows
// List-style metric rows with inline sparkline + YoY delta. Hero strip up top.
const VarB = (function() {
  const { useState } = React;
  const D = window.LIMEHOUSE_DATA;

  function HeroCard({ label, value, unit, delta, source, sparkData, sparkColor, mobile, showSource, onClick }) {
    return (
      <div onClick={onClick} style={{
        background: '#fff', border: '1px solid #e5e8e2', borderRadius: 12,
        padding: mobile ? '14px 14px' : '16px 18px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
        cursor: onClick ? 'pointer' : 'default',
        position: 'relative', overflow: 'hidden',
        transition: 'border-color .15s, transform .15s',
      }}
      onMouseEnter={(e) => { if (onClick) e.currentTarget.style.borderColor = '#c8d6bf'; }}
      onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#e5e8e2'; }}
      >
        <div style={{ position:'absolute', left:0, top:0, bottom:0, width:3,
          background: source === 'BD' ? '#2471a3' : '#3d8c1f', opacity: 0.5 }} />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          <div style={{ fontSize: 10.5, fontWeight: 600, color: '#6b7566', letterSpacing: '0.04em' }}>{label}</div>
          <SourcePill source={source} show={showSource} />
        </div>
        <div style={{ display:'flex', alignItems:'flex-end', justifyContent:'space-between', gap: 10 }}>
          <div style={{
            fontSize: mobile ? 32 : 38, fontWeight: 300, color: '#1c2119',
            letterSpacing: '-1.5px', lineHeight: 1, fontVariantNumeric: 'tabular-nums',
          }}>
            {unit === '$' && <span style={{ fontSize: '0.55em', color: '#9aa595' }}>$</span>}
            {value}
            {unit && unit !== '$' && <span style={{ fontSize: '0.5em', color: '#9aa595', fontWeight: 400, marginLeft: 1 }}>{unit}</span>}
          </div>
          {sparkData && <Sparkline data={sparkData} color={sparkColor || '#3d8c1f'} width={mobile?60:80} height={26} />}
        </div>
        {delta && (
          <div style={{ marginTop: 6, display:'flex', alignItems:'center', gap: 6 }}>
            <DeltaPill delta={delta} size="sm" />
            <span style={{ fontSize: 10, color: '#9aa595' }}>YoY</span>
          </div>
        )}
      </div>
    );
  }

  // Compact row — for the bulk metrics
  function MetricRow({ label, value, unit, delta, source, sparkData, sparkColor, showSource, onClick }) {
    return (
      <div onClick={onClick} style={{
        display: 'grid',
        gridTemplateColumns: '1fr 70px auto auto',
        alignItems: 'center', gap: 10,
        padding: '11px 14px',
        borderBottom: '1px solid #eef0ec',
        cursor: onClick ? 'pointer' : 'default',
        transition: 'background .12s',
      }}
      onMouseEnter={(e) => { if (onClick) e.currentTarget.style.background = '#f9faf7'; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
          <SourcePill source={source} show={showSource} />
          <span style={{ fontSize: 12.5, color: '#1c2119', fontWeight: 500, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{label}</span>
        </div>
        <div>{sparkData && <Sparkline data={sparkData} color={sparkColor || '#3d8c1f'} width={60} height={18} fill={false} strokeWidth={1.3} />}</div>
        <div style={{
          fontSize: 17, fontWeight: 400, color: '#1c2119',
          letterSpacing: '-0.4px', fontVariantNumeric: 'tabular-nums',
          textAlign: 'right', minWidth: 60,
        }}>
          {unit === '$' && <span style={{ fontSize: '0.65em', color: '#9aa595' }}>$</span>}
          {typeof value === 'number' ? value.toLocaleString() : value}
          {unit && unit !== '$' && <span style={{ fontSize: '0.6em', color: '#9aa595', marginLeft: 1 }}>{unit}</span>}
        </div>
        <div style={{ minWidth: 56, textAlign: 'right' }}>{delta ? <DeltaPill delta={delta} size="sm" /> : null}</div>
      </div>
    );
  }

  function MetricGroup({ title, children }) {
    return (
      <div style={{ background: '#fff', border: '1px solid #e5e8e2', borderRadius: 12, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
        <div style={{
          padding: '10px 14px', fontSize: 10, fontWeight: 700,
          letterSpacing: '0.1em', textTransform: 'uppercase', color: '#6b7566',
          background: '#fafbf9', borderBottom: '1px solid #eef0ec',
        }}>{title}</div>
        <div>{children}</div>
      </div>
    );
  }

  function Render({ tweaks }) {
    const [modal, setModal] = useState(null);
    const mobile = tweaks.viewport === 'phone';
    const showSource = tweaks.sourcePills;
    const yoy = tweaks.yoyMode;

    const row = (label, source, valueObj, unit, sparkKey, sparkColor, onClick) => ({
      label, source, value: valueObj.value, unit: unit ?? valueObj.unit,
      delta: yoy ? fmt.delta(valueObj.value, valueObj.prevYear, valueObj.invertDelta) : null,
      sparkData: sparkKey ? D.spark[sparkKey] : null,
      sparkColor, showSource, onClick,
    });

    return (
      <div style={{ background: '#f4f5f3', minHeight: '100%', fontFamily: "'Outfit', sans-serif" }}>
        <DashHeader syncedAt={D.meta.syncedAt} range="365" onRangeChange={()=>{}} dense mobile={mobile} />

        <div style={{ padding: mobile ? '12px 12px 24px' : '18px 22px 28px' }}>

          {/* HERO STRIP — top 4 priorities */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: mobile ? '1fr 1fr' : 'repeat(4, 1fr)',
            gap: mobile ? 8 : 10, marginBottom: mobile ? 14 : 18,
          }}>
            <HeroCard label="Rent collected by 3rd"
              {...row('', 'BD', D.financials.rentCollectedBy3rd, '%', 'rentCollected3rd', '#3d8c1f', () => setModal('rent3rd'))}
              mobile={mobile} />
            <HeroCard label="Occupancy"
              {...row('', 'BD', D.occupancy.rate, '%', 'occupancy', '#3d8c1f')}
              mobile={mobile} />
            <HeroCard label="Renewal rate"
              {...row('', 'BD', D.leasing.renewalRate, '%', 'renewalRate', '#2471a3', () => setModal('renewals'))}
              mobile={mobile} />
            <HeroCard label="Net doors YTD"
              source="BD"
              value={'+' + D.occupancy.netDoors.value}
              delta={yoy ? fmt.delta(D.occupancy.netDoors.value, D.occupancy.netDoors.prevYear) : null}
              sparkData={D.spark.doorsAdded.map((a, i) => a - D.spark.doorsLost[i])}
              sparkColor="#3d8c1f"
              mobile={mobile} showSource={showSource}
              onClick={() => setModal('doors')} />
          </div>

          {/* TWO-COLUMN ON DESKTOP, STACK ON MOBILE */}
          <div style={{ display: 'grid', gridTemplateColumns: mobile ? '1fr' : '1fr 1fr', gap: mobile ? 12 : 14 }}>

            <MetricGroup title="Financials">
              <MetricRow {...row('Rent by 10th', 'BD', D.financials.rentCollectedBy10th, '%', 'rentCollected10th', '#3d8c1f', () => setModal('rent10th'))} />
              <MetricRow {...row('Avg rent / door', 'BD', D.financials.avgRentPerDoor, '$', 'avgRent', '#3d8c1f')} />
              <MetricRow {...row('Revenue per unit (RPU)', 'BD', D.financials.rpu, '$', 'rpu', '#3d8c1f')} />
              <MetricRow {...row('Gross income', 'BD', D.financials.grossIncome, 'k', 'grossIncome', '#3d8c1f')} />
              <MetricRow {...row('Net income', 'BD', D.financials.netIncome, 'k', 'netIncome', '#3d8c1f')} />
              <MetricRow {...row('Total delinquent', 'BD', D.financials.delinquent, '$', 'delinquent', '#c0392b', () => setModal('delinquent'))} />
            </MetricGroup>

            <MetricGroup title="Occupancy & Doors">
              <MetricRow {...row('Total units', 'BD', { value: D.occupancy.totalUnits, prevYear: 96 })} />
              <MetricRow {...row('Vacant — not rented', 'BD', D.occupancy.vacantNotRented, '', null, '#c0392b')} />
              <MetricRow {...row('Avg days vacant', 'BD', D.occupancy.avgDaysVacant)} />
              <MetricRow {...row('Doors added (YTD)', 'BD', D.occupancy.doorsAdded, '', 'doorsAdded', '#3d8c1f', () => setModal('doorsAdded'))} />
              <MetricRow {...row('Doors lost — churn', 'BD', D.occupancy.doorsLost, '', 'doorsLost', '#c0392b')} />
              <MetricRow {...row('Owners gained', 'BD', D.occupancy.ownersGained)} />
            </MetricGroup>

            <MetricGroup title="Leasing Pipeline">
              <MetricRow {...row('Renewals (YTD)', 'BD', D.leasing.renewalsCount, '', null, '#3d8c1f', () => setModal('renewals'))} />
              <MetricRow {...row('Fixed-term leases', 'BD', D.leasing.fixedLeases)} />
              <MetricRow {...row('Month-to-month', 'BD', D.leasing.mtmLeases)} />
              <MetricRow {...row('Apps submitted', 'BD', D.leasing.appsSubmitted)} />
              <MetricRow {...row('Move-ins', 'BD', D.leasing.moveins)} />
              <MetricRow {...row('Evictions pending', 'BD', D.leasing.evictionsPending, '', null, '#c0392b')} />
            </MetricGroup>

            <MetricGroup title="Marketing & Showings">
              <MetricRow {...row('Avg days on market', 'RE', D.marketing.avgDaysOnMarket, '', 'daysOnMarket', '#2471a3')} />
              <MetricRow {...row('Units on market', 'RE', D.marketing.unitsOnMarket)} />
              <MetricRow {...row('New prospects', 'RE', D.marketing.newProspects, '', 'prospects', '#2471a3')} />
              <MetricRow {...row('Showings completed', 'RE', D.marketing.showingsCompleted, '', 'showings', '#2471a3')} />
              <MetricRow {...row('Completion rate', 'RE', D.marketing.completionRate, '%')} />
              <MetricRow {...row('Outbound texts', 'RE', D.marketing.totalTexts)} />
            </MetricGroup>
          </div>

          {/* TREND CHARTS — full width pair */}
          <div style={{ display: 'grid', gridTemplateColumns: mobile ? '1fr' : '1fr 1fr', gap: mobile ? 12 : 14, marginTop: mobile ? 12 : 14 }}>
            <div style={{ background:'#fff', border:'1px solid #e5e8e2', borderRadius:12, padding: mobile?'14px':'16px', boxShadow:'0 1px 3px rgba(0,0,0,0.04)' }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom: 12 }}>
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing:'0.1em', textTransform:'uppercase', color:'#6b7566' }}>Rent collection — 12 mo</div>
                <div style={{ display:'flex', gap:10, fontSize: 10, color:'#6b7566' }}>
                  <span style={{ display:'inline-flex',alignItems:'center',gap:4 }}><span style={{ width:8,height:8,background:'#3d8c1f',borderRadius:2 }} />By 3rd</span>
                  <span style={{ display:'inline-flex',alignItems:'center',gap:4 }}><span style={{ width:8,height:8,background:'#a8c898',borderRadius:2 }} />By 10th</span>
                </div>
              </div>
              <DualBars data={D.rentCollectionByMonth} keys={['by3rd','by10th']} colors={['#3d8c1f','#a8c898']} height={mobile?80:90} yMax={100} />
            </div>
            <div style={{ background:'#fff', border:'1px solid #e5e8e2', borderRadius:12, padding: mobile?'14px':'16px', boxShadow:'0 1px 3px rgba(0,0,0,0.04)' }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom: 12 }}>
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing:'0.1em', textTransform:'uppercase', color:'#6b7566' }}>Doors added vs lost</div>
                <div style={{ fontSize: 11, color:'#3d8c1f', fontWeight: 600 }}>Net +16</div>
              </div>
              <DualBars data={D.doorsMonthly} keys={['added','lost']} colors={['#3d8c1f','#c0392b']} height={mobile?80:90} />
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
        <Modal open={modal === 'doors'} onClose={() => setModal(null)}
          title="Net doors — added vs lost" subtitle="Last 12 months">
          <DrillTable cols={['Property', 'Owner', 'Onboard date', 'Units']}
            rows={D.doorsAddedDetail.map(r => [r.property, r.owner, r.date, r.units])} />
        </Modal>
      </div>
    );
  }
  return Render;
})();

window.VarB = VarB;
