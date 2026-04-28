// Drill-down detail data for every KPI tile.
// Each key matches the metric the user clicks; rows are the underlying records.

window.LIMEHOUSE_DRILLDOWNS = {

  // ── FINANCIALS ─────────────────────────────────────────────────────────────
  rentCollectedBy3rd: {
    title: 'Rent collected by the 3rd',
    cols: ['Unit', 'Tenant', 'Rent', 'Paid on', 'Days early/late'],
    rows: [
      ['12 Maple St #1',  'Alex Chen',     '$1,850', 'Apr 1',  '−2'],
      ['12 Maple St #2',  'Brett Howe',    '$1,900', 'Apr 1',  '−2'],
      ['47 Oak Ln #1',    'Carla Reyes',   '$2,100', 'Apr 2',  '−1'],
      ['47 Oak Ln #2',    'Devon Park',    '$2,050', 'Apr 1',  '−2'],
      ['83 Birch Ct',     'Diane Park',    '$1,750', 'Apr 8',  '+5'],
      ['120 Elm Ave',     'Evan Liu',      '$1,950', 'Apr 1',  '−2'],
      ['256 Cedar Pl #1', 'Faye Ortiz',    '$1,680', 'Apr 3',  '0'],
      ['256 Cedar Pl #2', 'Gabe Sosa',     '$1,720', 'Apr 1',  '−2'],
      ['301 Pine Rd',     'Greg Walsh',    '$2,200', 'Apr 9',  '+6'],
      ['88 Walnut Way #1','Hana Kim',      '$1,825', 'Apr 1',  '−2'],
      ['88 Walnut Way #2','Ivan Sokolov',  '$1,825', 'Apr 2',  '−1'],
      ['88 Walnut Way #3','Jenna Reilly',  '$1,825', 'Apr 1',  '−2'],
    ],
    summary: '91% of leases paid by the 3rd · 9% paid late this month',
  },

  rentCollectedBy10th: {
    title: 'Rent collected by the 10th',
    cols: ['Unit', 'Tenant', 'Rent', 'Paid on', 'Status'],
    rows: [
      ['83 Birch Ct',     'Diane Park',    '$1,750', 'Apr 8',  'Paid by 10th'],
      ['301 Pine Rd',     'Greg Walsh',    '$2,200', 'Apr 9',  'Paid by 10th'],
      ['410 Hickory Dr',  'Kara Singh',    '$1,890', 'Apr 7',  'Paid by 10th'],
      ['522 Sycamore',    'Liam Brody',    '$2,000', 'Apr 10', 'Paid by 10th'],
      ['12 Maple St #4',  'Mei Tanaka',    '$1,800', 'Apr 6',  'Paid by 10th'],
      ['—',               '—',             '—',      '—',      'Outstanding'],
      ['629 Aspen Ct',    'Nick Foster',   '$1,950', '—',      'Outstanding'],
      ['755 Willow Ln',   'Olivia Reyna',  '$2,150', '—',      'Outstanding'],
      ['883 Juniper',     'Pete Larson',   '$1,675', '—',      'Outstanding'],
    ],
    summary: '97% paid by the 10th · 3 leases outstanding ($5,775)',
  },

  avgRentPerDoor: {
    title: 'Average rent per door',
    cols: ['Property type', 'Doors', 'Avg rent', 'Range'],
    rows: [
      ['Single-family',     '34', '$2,180', '$1,800–$2,650'],
      ['Duplex',            '22', '$1,890', '$1,650–$2,150'],
      ['Townhome',          '28', '$1,975', '$1,750–$2,300'],
      ['Apartment / multi', '20', '$1,640', '$1,400–$1,900'],
      ['Condo',             '8',  '$2,050', '$1,850–$2,400'],
    ],
    summary: '$1,920 avg across 112 doors · up $100 YoY',
  },

  rpu: {
    title: 'Revenue per unit (12-mo trailing)',
    cols: ['Property', 'Doors', 'Annual rev', 'RPU'],
    rows: [
      ['Atlas Holdings portfolio',    '18', '$362k', '$1,675'],
      ['Birchwood LLC portfolio',     '14', '$298k', '$1,775'],
      ['Cardinal Capital portfolio',  '22', '$487k', '$1,845'],
      ['Dover Properties portfolio',  '16', '$352k', '$1,835'],
      ['Evergreen Homes portfolio',   '12', '$268k', '$1,860'],
      ['Other (35 owners)',           '30', '$682k', '$1,895'],
    ],
    summary: '$1,830 / unit / month · up $120 YoY',
  },

  grossIncome: {
    title: 'Gross income — last 12 months',
    cols: ['Month', 'Gross', 'Mgmt fees', 'Late fees', 'Other'],
    rows: [
      ['May 2025', '$192k', '$15.4k', '$420',   '$1,200'],
      ['Jun 2025', '$194k', '$15.5k', '$380',   '$890'],
      ['Jul 2025', '$198k', '$15.8k', '$510',   '$1,100'],
      ['Aug 2025', '$201k', '$16.1k', '$340',   '$760'],
      ['Sep 2025', '$205k', '$16.4k', '$290',   '$980'],
      ['Oct 2025', '$207k', '$16.6k', '$420',   '$1,250'],
      ['Nov 2025', '$210k', '$16.8k', '$510',   '$880'],
      ['Dec 2025', '$212k', '$17.0k', '$680',   '$1,420'],
      ['Jan 2026', '$214k', '$17.1k', '$720',   '$1,180'],
      ['Feb 2026', '$217k', '$17.4k', '$540',   '$960'],
      ['Mar 2026', '$220k', '$17.6k', '$380',   '$1,100'],
      ['Apr 2026', '$223k', '$17.8k', '$420',   '$1,240'],
    ],
    summary: '$2.49M trailing 12 mo · +16% YoY',
    chart: { kind: 'line', dataKey: 'incomeMonthly', series: [{ key: 'gross', color: '#3d8c1f' }, { key: 'net', color: '#2471a3' }], yFmt: (v) => '$' + v + 'k', title: 'Monthly gross & net ($k)' },
  },

  netIncome: {
    title: 'Net income — last 12 months',
    cols: ['Month', 'Gross', 'Op. exp.', 'Net'],
    rows: [
      ['May 2025', '$192k', '$44k', '$148k'],
      ['Jun 2025', '$194k', '$45k', '$149k'],
      ['Jul 2025', '$198k', '$46k', '$152k'],
      ['Aug 2025', '$201k', '$47k', '$154k'],
      ['Sep 2025', '$205k', '$47k', '$158k'],
      ['Oct 2025', '$207k', '$47k', '$160k'],
      ['Nov 2025', '$210k', '$48k', '$162k'],
      ['Dec 2025', '$212k', '$48k', '$164k'],
      ['Jan 2026', '$214k', '$49k', '$165k'],
      ['Feb 2026', '$217k', '$49k', '$168k'],
      ['Mar 2026', '$220k', '$50k', '$170k'],
      ['Apr 2026', '$223k', '$50k', '$173k'],
    ],
    summary: '$1.92M trailing 12 mo · 77.5% margin',
    chart: { kind: 'line', dataKey: 'incomeMonthly', series: [{ key: 'net', color: '#2471a3' }], yFmt: (v) => '$' + v + 'k', title: 'Monthly net ($k)' },
  },

  delinquent: {
    title: 'Delinquent balances',
    cols: ['Unit', 'Tenant', 'Amount', 'Days late', 'Status'],
    rows: [
      ['629 Aspen Ct',    'Nick Foster',   '$1,950', '12',  'Notice sent'],
      ['755 Willow Ln',   'Olivia Reyna',  '$2,150', '15',  'Notice sent'],
      ['883 Juniper',     'Pete Larson',   '$1,675', '15',  'Payment plan'],
      ['144 Sage Way',    'Quinn Rivera',  '$1,800', '32',  '3-day notice'],
      ['277 Cedar Pl #4', 'Rio Mendez',    '$1,720',  '47',  'Pre-eviction'],
      ['332 Oak Ln #2',   'Sasha Webb',    '$1,950', '64',  'Pre-eviction'],
      ['491 Pine Rd #3',  'Tom Bell',      '$2,955', '92',  'Eviction filed'],
    ],
    summary: '$9,200 across 7 leases · ↓ $3,200 vs last year',
    chart: { kind: 'line', dataKey: 'delinquentTrend', series: [{ key: 'amount', color: '#c0392b' }], yFmt: (v) => '$' + v + 'k', title: 'Trailing 12-mo delinquent balance ($k)' },
  },

  delinquentCount: {
    title: 'Delinquent leases',
    cols: ['Aging bucket', 'Leases', 'Amount'],
    rows: [
      ['0–30 days',  '4', '$4,200'],
      ['31–60 days', '1', '$2,400'],
      ['61–90 days', '1', '$1,800'],
      ['90+ days',   '1', '$800'],
    ],
    summary: '7 leases delinquent · 4 fewer than this time last year',
  },

  // ── OCCUPANCY ──────────────────────────────────────────────────────────────
  occupancy: {
    title: 'Occupancy overview',
    cols: ['Metric', 'Value'],
    rows: [
      ['Total units',            '112'],
      ['Occupied',               '104'],
      ['Occupancy rate',         '92.9%'],
      ['Vacant — not rented',    '5'],
      ['Vacant — rented (move-in pending)', '3'],
      ['Avg days vacant',        '18'],
      ['Year-ago occupancy',     '91.0%'],
      ['Trailing 12-mo low',     '88.0% (May 2025)'],
      ['Trailing 12-mo high',    '93.0% (Feb 2026)'],
    ],
    summary: '104 of 112 units occupied · ↑ 1.9pt YoY',
    chart: { kind: 'line', dataKey: 'occupancyTrend', series: [{ key: 'rate', color: '#3d8c1f' }], yFmt: (v) => v + '%', title: 'Trailing 12-mo occupancy' },
  },

  totalUnits: {
    title: 'All units (112)',
    cols: ['Property', 'Owner', 'Units', 'Occupied', 'Health'],
    rows: [
      ['12 Maple St',     'Atlas Holdings',     '4', '4', 'Healthy'],
      ['47 Oak Ln',       'Cardinal Capital',   '2', '2', 'Healthy'],
      ['83 Birch Ct',     'Birchwood LLC',      '1', '0', 'At-risk'],
      ['88 Walnut Way',   'Dover Properties',   '3', '3', 'Healthy'],
      ['120 Elm Ave',     'Atlas Holdings',     '1', '1', 'Healthy'],
      ['256 Cedar Pl',    'Birchwood LLC',      '4', '3', 'Healthy'],
      ['301 Pine Rd',     'Evergreen Homes',    '1', '0', 'At-risk'],
      ['410 Hickory Dr',  'Cardinal Capital',   '1', '1', 'Healthy'],
      ['522 Sycamore',    'Dover Properties',   '1', '1', 'Healthy'],
      ['629 Aspen Ct',    'Atlas Holdings',     '1', '1', 'At-risk'],
      ['755 Willow Ln',   'Cardinal Capital',   '1', '1', 'At-risk'],
      ['883 Juniper',     'Birchwood LLC',      '1', '1', 'At-risk'],
      ['…and 88 more',    '—',                  '—', '—', '—'],
    ],
    summary: '112 units across 47 owners',
  },

  vacantNotRented: {
    title: 'Vacant — not rented',
    cols: ['Unit', 'Vacant since', 'Days', 'Asking rent', 'Status'],
    rows: [
      ['12 Maple St #3',    'Mar 27', '32', '$1,850', 'Listed'],
      ['83 Birch Ct',       'Apr 4',  '24', '$1,750', 'Listed'],
      ['256 Cedar Pl #2',   'Apr 10', '18', '$1,720', 'Showing scheduled'],
      ['301 Pine Rd',       'Apr 14', '14', '$2,200', 'Application pending'],
      ['47 Oak Ln #1',      'Apr 20', '8',  '$2,100', 'Listed'],
    ],
    summary: '5 units vacant · avg 19 days · 2 fewer than last year',
  },

  vacantRented: {
    title: 'Vacant — rented (move-in pending)',
    cols: ['Unit', 'New tenant', 'Move-in date', 'Lease term'],
    rows: [
      ['144 Sage Way',     'Quinn Rivera', 'May 1',  '12 mo'],
      ['491 Pine Rd #3',   'Tom Bell',     'May 5',  '12 mo'],
      ['277 Cedar Pl #4',  'Rio Mendez',   'May 15', '12 mo'],
    ],
    summary: '3 units leased and awaiting move-in',
  },

  avgDaysVacant: {
    title: 'Average days vacant',
    cols: ['Property type', 'Vacancies (12mo)', 'Avg days'],
    rows: [
      ['Single-family',     '8',  '15'],
      ['Duplex',            '6',  '21'],
      ['Townhome',          '4',  '18'],
      ['Apartment / multi', '5',  '22'],
      ['Condo',             '2',  '12'],
    ],
    summary: '18 days average · ↓ 6 days YoY',
  },

  doorsAdded: {
    title: 'Doors added — last 12 months',
    cols: ['Property', 'Owner', 'Onboard date', 'Units', 'Source'],
    rows: [
      ['120 Elm Ave',      'Atlas Holdings',     '2026-03-12', '1', 'Referral'],
      ['256 Cedar Pl',     'Birchwood LLC',      '2026-03-04', '2', 'Inbound'],
      ['47 Oak Ln',        'Cardinal Capital',   '2026-02-21', '1', 'Outbound'],
      ['88 Walnut Way',    'Dover Properties',   '2026-02-08', '3', 'Referral'],
      ['301 Pine Rd',      'Evergreen Homes',    '2026-01-30', '1', 'Inbound'],
      ['410 Hickory Dr',   'Cardinal Capital',   '2026-01-12', '1', 'Outbound'],
      ['522 Sycamore',     'Dover Properties',   '2025-12-04', '1', 'Referral'],
      ['629 Aspen Ct',     'Atlas Holdings',     '2025-11-18', '1', 'Inbound'],
      ['755 Willow Ln',    'Cardinal Capital',   '2025-10-22', '1', 'Referral'],
      ['883 Juniper',      'Birchwood LLC',      '2025-10-05', '1', 'Inbound'],
      ['…and 13 more',     '—',                  '—',          '11','—'],
    ],
    summary: '+24 doors YTD across 18 new properties',
  },

  doorsLost: {
    title: 'Doors lost — last 12 months',
    cols: ['Property', 'Owner', 'Off-board date', 'Units', 'Reason'],
    rows: [
      ['18 Beech St',      'Former: Atlas',       '2026-03-22', '1', 'Owner sold'],
      ['72 Spruce Way',    'Former: Birchwood',   '2026-02-15', '2', 'Owner self-managing'],
      ['141 Holly Ct',     'Former: Cardinal',    '2026-01-08', '1', 'Owner sold'],
      ['218 Magnolia',     'Former: Dover',       '2025-12-12', '1', 'Switched PM'],
      ['305 Redwood',      'Former: Evergreen',   '2025-11-04', '1', 'Owner sold'],
      ['488 Tulip Ln',     'Former: Atlas',       '2025-09-19', '1', 'Owner self-managing'],
      ['612 Iris Pl',      'Former: Cardinal',    '2025-07-28', '1', 'Owner sold'],
    ],
    summary: '−8 doors YTD · 4 fewer than last year',
  },

  netDoors: {
    title: 'Net door change YTD',
    cols: ['Month', 'Added', 'Lost', 'Net'],
    rows: [
      ['May 2025', '2', '−1', '+1'],
      ['Jun 2025', '1', '0',  '+1'],
      ['Jul 2025', '3', '−2', '+1'],
      ['Aug 2025', '1', '−1', '0'],
      ['Sep 2025', '2', '−1', '+1'],
      ['Oct 2025', '4', '0',  '+4'],
      ['Nov 2025', '2', '−1', '+1'],
      ['Dec 2025', '1', '−2', '−1'],
      ['Jan 2026', '3', '−1', '+2'],
      ['Feb 2026', '2', '0',  '+2'],
      ['Mar 2026', '3', '−1', '+2'],
      ['Apr 2026', '0', '−1', '−1'],
    ],
    summary: 'Net +16 doors YTD · 12 more than last year',
    chart: { kind: 'dualbars', dataKey: 'doorsMonthly', keys: ['added', 'lost'], colors: ['#3d8c1f', '#c0392b'], title: 'Doors added vs lost (12 mo)' },
  },

  ownersTotal: {
    title: 'All owners (47)',
    cols: ['Owner', 'Doors', 'Tenure', 'Status'],
    rows: [
      ['Atlas Holdings',     '18', '4 yr', 'Active'],
      ['Cardinal Capital',   '22', '6 yr', 'Active'],
      ['Birchwood LLC',      '14', '3 yr', 'Active'],
      ['Dover Properties',   '16', '5 yr', 'Active'],
      ['Evergreen Homes',    '12', '2 yr', 'Active'],
      ['Foster Family Trust','4',  '7 yr', 'Active'],
      ['Greenleaf Realty',   '6',  '1 yr', 'Active'],
      ['Hawthorne Group',    '5',  '3 yr', 'Active'],
      ['Indigo Investments', '3',  '8 mo', 'Active'],
      ['…and 38 more',       '—',  '—',    '—'],
    ],
    summary: '47 active owners · 6 gained YTD',
  },

  ownersGained: {
    title: 'Owners gained — last 12 months',
    cols: ['Owner', 'Onboarded', 'Doors', 'Source'],
    rows: [
      ['Indigo Investments',  '2026-03-18', '3', 'Referral — Atlas'],
      ['Juniper Holdings',    '2026-02-04', '2', 'Inbound web'],
      ['Kaplan Realty',       '2026-01-22', '1', 'Outbound prospecting'],
      ['Lighthouse Trust',    '2025-12-09', '4', 'Referral — Cardinal'],
      ['Maple Hill Group',    '2025-11-12', '2', 'Inbound web'],
      ['Northstar Properties','2025-09-26', '5', 'Outbound prospecting'],
    ],
    summary: '+6 owners gained · 17 doors brought in',
  },

  // ── LEASING ────────────────────────────────────────────────────────────────
  renewalRate: {
    title: 'Renewal rate',
    cols: ['Cohort', 'Eligible', 'Renewed', 'Rate'],
    rows: [
      ['Q2 2025', '12', '8',  '67%'],
      ['Q3 2025', '14', '10', '71%'],
      ['Q4 2025', '11', '9',  '82%'],
      ['Q1 2026', '14', '11', '79%'],
    ],
    summary: '74% renewed · up from 68% a year ago',
  },

  renewalsCount: {
    title: 'Lease renewals — last 12 months',
    cols: ['Unit', 'Tenant', 'Renewed', 'New rent', 'Increase'],
    rows: [
      ['12 Maple St #1',  'Alex Chen',     '2026-04-01', '$1,850', '+3.2%'],
      ['47 Oak Ln #1',    'Carla Reyes',   '2026-03-12', '$2,100', '+4.1%'],
      ['120 Elm Ave',     'Evan Liu',      '2026-03-01', '$1,950', '+2.7%'],
      ['256 Cedar Pl #1', 'Faye Ortiz',    '2026-02-15', '$1,680', '+3.5%'],
      ['410 Hickory Dr',  'Kara Singh',    '2026-02-01', '$1,890', '+2.9%'],
      ['522 Sycamore',    'Liam Brody',    '2026-01-22', '$2,000', '+4.0%'],
      ['12 Maple St #4',  'Mei Tanaka',    '2026-01-04', '$1,800', '+3.0%'],
      ['88 Walnut Way #1','Hana Kim',      '2025-12-15', '$1,825', '+2.8%'],
      ['…and 30 more renewals', '—',       '—',          '—',      '—'],
    ],
    summary: '38 renewals · avg 3.3% rent increase',
    chart: { kind: 'minibars', dataKey: 'renewalsByMonth', valueKey: 'count', color: '#3d8c1f', title: 'Renewals by month' },
  },

  fixedLeases: {
    title: 'Fixed-term leases (92)',
    cols: ['Unit', 'Tenant', 'Term', 'Start', 'Ends'],
    rows: [
      ['12 Maple St #1',  'Alex Chen',     '12 mo', '2026-04-01', '2027-03-31'],
      ['12 Maple St #2',  'Brett Howe',    '12 mo', '2025-08-01', '2026-07-31'],
      ['47 Oak Ln #1',    'Carla Reyes',   '12 mo', '2026-03-12', '2027-03-11'],
      ['47 Oak Ln #2',    'Devon Park',    '24 mo', '2025-06-01', '2027-05-31'],
      ['120 Elm Ave',     'Evan Liu',      '12 mo', '2026-03-01', '2027-02-28'],
      ['256 Cedar Pl #1', 'Faye Ortiz',    '12 mo', '2026-02-15', '2027-02-14'],
      ['256 Cedar Pl #2', 'Gabe Sosa',     '12 mo', '2025-09-01', '2026-08-31'],
      ['410 Hickory Dr',  'Kara Singh',    '12 mo', '2026-02-01', '2027-01-31'],
      ['522 Sycamore',    'Liam Brody',    '12 mo', '2026-01-22', '2027-01-21'],
      ['88 Walnut Way #1','Hana Kim',      '12 mo', '2025-12-15', '2026-12-14'],
      ['88 Walnut Way #2','Ivan Sokolov',  '12 mo', '2025-11-01', '2026-10-31'],
      ['88 Walnut Way #3','Jenna Reilly',  '12 mo', '2025-10-15', '2026-10-14'],
      ['…and 80 more fixed-term leases', '—', '—', '—', '—'],
    ],
    summary: '92 fixed-term leases · 88% of all active leases',
  },

  mtmLeases: {
    title: 'Month-to-month leases (12)',
    cols: ['Unit', 'Tenant', 'On MTM since', 'Notes'],
    rows: [
      ['144 Sage Way',     'Older tenant — 5+ yrs',     '2024-08',  'Rolled from fixed'],
      ['277 Cedar Pl #4',  'Rio Mendez',                '2025-11',  'Renewal pending'],
      ['491 Pine Rd #3',   'Tom Bell',                  '2025-12',  'Owner considering sale'],
      ['629 Aspen Ct',     'Nick Foster',               '2026-01',  'Late on rent — see delinquent'],
      ['755 Willow Ln',    'Olivia Reyna',              '2026-02',  'Late on rent — see delinquent'],
      ['883 Juniper',      'Pete Larson',               '2025-10',  'Long-term, stable'],
      ['332 Oak Ln #2',    'Sasha Webb',                '2025-09',  'Pre-eviction'],
      ['…and 5 more',      '—',                         '—',        '—'],
    ],
    summary: '12 MTM leases · 6 fewer than last year (target was −4)',
  },

  appsSubmitted: {
    title: 'Applications submitted — last 12 months',
    cols: ['Unit', 'Applicant', 'Submitted', 'Decision', 'Outcome'],
    rows: [
      ['12 Maple St #3',   'Aaron Patel',     '2026-04-22', '2026-04-23', 'Approved'],
      ['83 Birch Ct',      'Beth Quan',       '2026-04-18', '2026-04-19', 'Pending'],
      ['256 Cedar Pl #2',  'Cody Russo',      '2026-04-12', '2026-04-14', 'Approved'],
      ['301 Pine Rd',      'Dana Yu',         '2026-04-08', '2026-04-09', 'Approved'],
      ['47 Oak Ln #1',     'Erin Smith',      '2026-04-03', '2026-04-04', 'Withdrawn'],
      ['144 Sage Way',     'Quinn Rivera',    '2026-03-28', '2026-03-29', 'Approved (move-in May 1)'],
      ['491 Pine Rd #3',   'Tom Bell',        '2026-03-21', '2026-03-22', 'Approved (move-in May 5)'],
      ['277 Cedar Pl #4',  'Rio Mendez',      '2026-03-14', '2026-03-15', 'Approved (move-in May 15)'],
      ['…and 134 more applications',          '—',          '—',          '—'],
    ],
    summary: '142 apps · 4.6 per move-in · 82% approval rate',
  },

  moveins: {
    title: 'Move-ins — last 12 months',
    cols: ['Unit', 'Tenant', 'Move-in', 'Rent', 'Term'],
    rows: [
      ['12 Maple St #4',  'Mei Tanaka',    '2026-01-04', '$1,800', '12 mo'],
      ['88 Walnut Way #1','Hana Kim',      '2025-12-15', '$1,825', '12 mo'],
      ['88 Walnut Way #2','Ivan Sokolov',  '2025-11-01', '$1,825', '12 mo'],
      ['88 Walnut Way #3','Jenna Reilly',  '2025-10-15', '$1,825', '12 mo'],
      ['410 Hickory Dr',  'Kara Singh',    '2026-02-01', '$1,890', '12 mo'],
      ['522 Sycamore',    'Liam Brody',    '2026-01-22', '$2,000', '12 mo'],
      ['629 Aspen Ct',    'Nick Foster',   '2026-01-15', '$1,950', 'MTM'],
      ['755 Willow Ln',   'Olivia Reyna',  '2026-02-08', '$2,150', 'MTM'],
      ['883 Juniper',     'Pete Larson',   '2025-10-04', '$1,675', 'MTM'],
      ['…and 22 more move-ins', '—',       '—',          '—',      '—'],
    ],
    summary: '31 move-ins · up 7 vs last year',
  },

  appsPerMovein: {
    title: 'Applications per move-in (efficiency)',
    cols: ['Quarter', 'Apps', 'Move-ins', 'Ratio'],
    rows: [
      ['Q2 2025', '32', '7',  '4.6'],
      ['Q3 2025', '38', '8',  '4.8'],
      ['Q4 2025', '34', '8',  '4.3'],
      ['Q1 2026', '38', '8',  '4.8'],
    ],
    summary: '4.6 apps per move-in · slightly better than 4.9 last year',
  },

  evictionsPending: {
    title: 'Evictions in progress',
    cols: ['Unit', 'Tenant', 'Filed', 'Stage', 'Balance'],
    rows: [
      ['491 Pine Rd #3', 'Former: Tom Bell', '2026-03-04', 'Court date scheduled', '$2,955'],
    ],
    summary: '1 eviction in progress · 1 fewer than last year',
  },

  // ── MARKETING ──────────────────────────────────────────────────────────────
  avgDaysOnMarket: {
    title: 'Avg days on market',
    cols: ['Quarter', 'Listings', 'Avg DOM', 'Median DOM'],
    rows: [
      ['Q2 2025', '11', '32', '30'],
      ['Q3 2025', '14', '28', '26'],
      ['Q4 2025', '9',  '21', '19'],
      ['Q1 2026', '12', '24', '22'],
    ],
    summary: '24 days on average · 7 days faster than a year ago',
  },

  medianDaysOnMarket: {
    title: 'Median days on market',
    cols: ['Quarter', 'Median DOM', 'Avg DOM'],
    rows: [
      ['Q2 2025', '30', '32'],
      ['Q3 2025', '26', '28'],
      ['Q4 2025', '19', '21'],
      ['Q1 2026', '22', '24'],
    ],
    summary: '22 days median · half of listings rent in under 3 weeks',
  },

  unitsOnMarket: {
    title: 'Units currently on market',
    cols: ['Unit', 'Listed since', 'Days', 'Asking', 'Showings'],
    rows: [
      ['12 Maple St #3',  '2026-03-27', '32', '$1,850', '4'],
      ['83 Birch Ct',     '2026-04-04', '24', '$1,750', '3'],
      ['256 Cedar Pl #2', '2026-04-10', '18', '$1,720', '5'],
      ['301 Pine Rd',     '2026-04-14', '14', '$2,200', '6'],
      ['47 Oak Ln #1',    '2026-04-20', '8',  '$2,100', '4'],
      ['144 Sage Way',    '2026-04-22', '6',  '$1,800', '2'],
      ['491 Pine Rd #3',  '2026-04-23', '5',  '$1,950', '3'],
      ['277 Cedar Pl #4', '2026-04-24', '4',  '$1,720', '1'],
    ],
    summary: '8 units listed · 4 fewer than this time last year',
  },

  completionRate: {
    title: 'Showing completion rate',
    cols: ['Quarter', 'Scheduled', 'Completed', 'Rate'],
    rows: [
      ['Q2 2025', '92',  '58',  '63%'],
      ['Q3 2025', '118', '78',  '66%'],
      ['Q4 2025', '108', '78',  '72%'],
      ['Q1 2026', '124', '98',  '79%'],
    ],
    summary: '71% completion · up from 64% last year',
  },

  newProspects: {
    title: 'New prospects — last 12 months',
    cols: ['Source', 'Prospects', '% of total', 'Showings'],
    rows: [
      ['Zillow',         '342', '40%', '128'],
      ['Apartments.com', '198', '23%', '72'],
      ['Trulia / Hotpads','142', '17%', '52'],
      ['Direct (website)', '92','11%',  '38'],
      ['Referrals',      '48',  '6%',  '18'],
      ['Other',          '25',  '3%',  '4'],
    ],
    summary: '847 new prospects · +38% YoY',
    chart: { kind: 'hbars', dataKey: 'prospectsBySource', title: 'Prospects by source' },
  },

  showingsCompleted: {
    title: 'Showings completed',
    cols: ['Quarter', 'Showings', 'Self-tour', 'Agent'],
    rows: [
      ['Q2 2025', '58',  '34', '24'],
      ['Q3 2025', '78',  '49', '29'],
      ['Q4 2025', '78',  '51', '27'],
      ['Q1 2026', '98',  '68', '30'],
    ],
    summary: '312 showings · 65% self-tour · +26% YoY',
  },

  totalCalls: {
    title: 'Inbound calls',
    cols: ['Month', 'Calls', 'Answered', 'Voicemail'],
    rows: [
      ['Nov 2025', '102', '88',  '14'],
      ['Dec 2025', '94',  '81',  '13'],
      ['Jan 2026', '118', '104', '14'],
      ['Feb 2026', '124', '109', '15'],
      ['Mar 2026', '132', '117', '15'],
      ['Apr 2026', '128', '115', '13'],
    ],
    summary: '1,284 inbound calls · 89% answered',
  },

  totalTexts: {
    title: 'Outbound text messages',
    cols: ['Type', 'Sent', '% of total'],
    rows: [
      ['Showing reminders',     '1,820', '39%'],
      ['Application follow-up', '1,142', '25%'],
      ['Maintenance updates',   '892',   '19%'],
      ['Rent reminders',        '512',   '11%'],
      ['Other',                 '255',   '6%'],
    ],
    summary: '4,621 texts · +19% YoY',
  },

};
