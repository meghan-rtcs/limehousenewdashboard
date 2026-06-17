  // ── Team Performance View ────────────────────────────────────────────
  // Paste this BEFORE the CeoView function in var-a.jsx.
  // It REPLACES the LeadSimpleView, LsRoleCard, and all LS_* constants.

  const TEAM = window.LIMEHOUSE_TEAM;

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

  function TeamKpiRow({ kpi, slot, mobile }) {
    const tier = TIER_COLORS[kpi.tier] || TIER_COLORS.gray;
    const actualColor = kpi.tier === 'green' ? '#639922'
                      : kpi.tier === 'amber' ? '#BA7517'
                      : kpi.tier === 'coral' ? '#D85A30'
                      : kpi.tier === 'red'   ? '#E24B4A'
                      : '#9aa595';

    return (
      <div style={{
        display: 'grid',
        gridTemplateColumns: mobile ? '1fr 60px 60px' : 'minmax(0,2.5fr) 80px 80px 100px 80px',
        gap: 1, background: 'transparent',
      }}>
        {/* KPI name + sources */}
        <div style={{ padding: '10px 12px' }}>
          <div style={{ fontSize: 12, fontWeight: 500, color: '#1c2119', lineHeight: 1.3 }}>{kpi.name}</div>
          <div style={{ display: 'flex', gap: 4, marginTop: 3, flexWrap: 'wrap' }}>
            {(kpi.sources || []).map(s => {
              const st = SRC_BADGE[s] || SRC_BADGE.Buildium;
              return <span key={s} style={{ background: st.bg, color: st.fg, fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 3, letterSpacing: '0.03em' }}>{s === 'RentEngine' ? 'RE' : s === 'LeadSimple' ? 'LS' : s === 'Buildium' ? 'BD' : s}</span>;
            })}
          </div>
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

  function TeamRolePanel({ role, mobile }) {
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
              <TeamKpiRow kpi={kpi} slot={bonus.slots[i]} mobile={mobile} />
            </div>
          ))}
        </div>

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
          display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 10,
          fontSize: 10, color: '#6b7566',
        }}>
          {[
            { tier: 'green', text: `Best (3) = met target \u2192 $${bonus.slotValue}` },
            { tier: 'amber', text: `Better (2) = within 10% \u2192 $${Math.round(bonus.slotValue * 2/3)}` },
            { tier: 'coral', text: `Good (1) = within 20% \u2192 $${Math.round(bonus.slotValue / 3)}` },
            { tier: 'red',   text: 'Red (0) = missed >20% \u2192 $0' },
          ].map(l => (
            <span key={l.tier} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: TIER_COLORS[l.tier].fg }} />
              {l.text}
            </span>
          ))}
        </div>
      </div>
    );
  }

  function TeamPerformanceView({ mobile, setDrillKey }) {
    const [selectedRole, setSelectedRole] = useState(TEAM?.roles?.[0]?.id || 'pm');
    const data = TEAM;

    if (!data || !data.roles) {
      return (
        <div style={{
          minHeight: 300, display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#9aa595', fontSize: 13, fontStyle: 'italic',
        }}>
          Team performance data not yet loaded. Run a sync to populate.
        </div>
      );
    }

    const role = data.roles.find(r => r.id === selectedRole) || data.roles[0];

    return (
      <div style={{ padding: mobile ? '12px 12px 28px' : '18px 26px 32px', maxWidth: 1480, margin: '0 auto' }}>

        {/* Header */}
        <div style={{
          fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase',
          color: '#9aa595', margin: '4px 0 14px',
        }}>
          Team performance \u00b7 {data.quarterLabel} \u00b7 as of {data.asOf}
        </div>

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
                {!r.placeholder && r.bonus && r.kpiResults?.length > 0 && (
                  <span style={{
                    marginLeft: 6, fontSize: 10, opacity: 0.8,
                  }}>
                    ${r.bonus.total}
                  </span>
                )}
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

        {/* Role panel */}
        <TeamRolePanel role={role} mobile={mobile} />

        {/* Footer */}
        <div style={{
          marginTop: 28, paddingTop: 16, borderTop: '1px solid #e5e8e2',
          fontSize: 10, color: '#9aa595', textAlign: 'center',
        }}>
          Limehouse PM \u00b7 Team Performance \u00b7 {data.quarterLabel}
        </div>
      </div>
    );
  }
