// Mock data for Limehouse one-page dashboard
// Numbers are realistic for a small-to-mid PM company (~80-120 doors)
window.LIMEHOUSE_DATA = {
  meta: {
    syncedAt: '2026-04-28 09:14',
    rentEngineUnits: 24,
    buildiumUnits: 112,
    activeLeases: 104,
  },

  // Sparklines — 12 months of data (oldest -> newest)
  spark: {
    occupancy:        [88, 89, 91, 92, 93, 92, 91, 90, 92, 93, 92, 92.9],
    rentCollected3rd: [82, 84, 81, 86, 88, 85, 87, 89, 88, 90, 89, 91],
    rentCollected10th:[94, 95, 93, 96, 96, 95, 96, 97, 96, 97, 96, 97],
    doorsAdded:       [1, 2, 0, 3, 1, 2, 4, 2, 1, 3, 2, 3],
    doorsLost:        [1, 0, 2, 1, 1, 0, 1, 2, 1, 0, 1, 1],
    renewalRate:      [62, 65, 68, 64, 70, 71, 69, 72, 70, 71, 73, 74],
    avgRent:          [1820, 1830, 1845, 1850, 1860, 1865, 1875, 1880, 1885, 1895, 1905, 1920],
    rpu:              [1710, 1720, 1735, 1740, 1755, 1760, 1770, 1775, 1785, 1795, 1810, 1830],
    grossIncome:      [192, 194, 198, 201, 205, 207, 210, 212, 214, 217, 220, 223],
    netIncome:        [148, 149, 152, 154, 158, 160, 162, 164, 165, 168, 170, 173],
    daysOnMarket:     [38, 36, 35, 33, 32, 31, 30, 29, 28, 27, 26, 24],
    delinquent:       [12400, 11800, 13200, 12900, 11600, 10800, 11400, 12100, 11200, 10400, 9800, 9200],
    prospects:        [42, 51, 48, 67, 72, 88, 94, 102, 86, 73, 64, 58],
    showings:         [18, 22, 19, 28, 32, 38, 41, 44, 38, 31, 27, 24],
  },

  financials: {
    rentCollectedBy3rd:  { value: 91, prevYear: 87, unit: '%' },
    rentCollectedBy10th: { value: 97, prevYear: 95, unit: '%' },
    avgRentPerDoor:      { value: 1920, prevYear: 1820, unit: '$' },
    rpu:                 { value: 1830, prevYear: 1710, unit: '$' },
    grossIncome:         { value: 223, prevYear: 192, unit: '$k' },
    netIncome:           { value: 173, prevYear: 148, unit: '$k' },
    delinquent:          { value: 9200, prevYear: 12400, unit: '$', invertDelta: true },
    delinquentCount:     { value: 7, prevYear: 11, invertDelta: true },
  },

  occupancy: {
    rate:            { value: 92.9, prevYear: 91.0, unit: '%' },
    occupiedUnits:   104,
    totalUnits:      112,
    vacantNotRented: { value: 5, prevYear: 7, invertDelta: true },
    vacantRented:    { value: 3, prevYear: 2 },
    avgDaysVacant:   { value: 18, prevYear: 24, invertDelta: true },
    doorsAdded:      { value: 24, prevYear: 16 },     // YTD
    doorsLost:       { value: 8,  prevYear: 12, invertDelta: true },
    netDoors:        { value: 16, prevYear: 4 },
    ownersTotal:     { value: 47, prevYear: 41 },
    ownersGained:    { value: 6,  prevYear: 4 },
  },

  leasing: {
    renewalRate:     { value: 74, prevYear: 68, unit: '%' },
    renewalsCount:   { value: 38, prevYear: 31 },
    mtmLeases:       { value: 12, prevYear: 18, invertDelta: true },
    fixedLeases:     { value: 92, prevYear: 84 },
    appsSubmitted:   { value: 142, prevYear: 118 },
    moveins:         { value: 31, prevYear: 24 },
    appsPerMovein:   { value: 4.6, prevYear: 4.9 },
    evictionsPending:{ value: 1, prevYear: 2, invertDelta: true },
  },

  marketing: {
    unitsOnMarket:    { value: 8, prevYear: 12, invertDelta: true },
    avgDaysOnMarket:  { value: 24, prevYear: 31, invertDelta: true },
    medianDaysOnMarket:{value: 22, prevYear: 28, invertDelta: true },
    newProspects:     { value: 847, prevYear: 612 },
    showingsCompleted:{ value: 312, prevYear: 248 },
    totalCalls:       { value: 1284, prevYear: 1102 },
    totalTexts:       { value: 4621, prevYear: 3890 },
    completionRate:   { value: 71, prevYear: 64, unit: '%' },
  },

  // Bar-chart data
  rentCollectionByMonth: [
    { month: 'May',  by3rd: 88, by10th: 95 },
    { month: 'Jun',  by3rd: 85, by10th: 96 },
    { month: 'Jul',  by3rd: 87, by10th: 96 },
    { month: 'Aug',  by3rd: 89, by10th: 97 },
    { month: 'Sep',  by3rd: 88, by10th: 96 },
    { month: 'Oct',  by3rd: 90, by10th: 97 },
    { month: 'Nov',  by3rd: 89, by10th: 96 },
    { month: 'Dec',  by3rd: 87, by10th: 95 },
    { month: 'Jan',  by3rd: 86, by10th: 95 },
    { month: 'Feb',  by3rd: 89, by10th: 96 },
    { month: 'Mar',  by3rd: 90, by10th: 97 },
    { month: 'Apr',  by3rd: 91, by10th: 97 },
  ],

  doorsMonthly: [
    { month: 'May',  added: 2, lost: 1 },
    { month: 'Jun',  added: 1, lost: 0 },
    { month: 'Jul',  added: 3, lost: 2 },
    { month: 'Aug',  added: 1, lost: 1 },
    { month: 'Sep',  added: 2, lost: 1 },
    { month: 'Oct',  added: 4, lost: 0 },
    { month: 'Nov',  added: 2, lost: 1 },
    { month: 'Dec',  added: 1, lost: 2 },
    { month: 'Jan',  added: 3, lost: 1 },
    { month: 'Feb',  added: 2, lost: 0 },
    { month: 'Mar',  added: 3, lost: 1 },
    { month: 'Apr',  added: 0, lost: 1 },
  ],

  renewalsByMonth: [
    { month: 'May', count: 4 },
    { month: 'Jun', count: 3 },
    { month: 'Jul', count: 5 },
    { month: 'Aug', count: 2 },
    { month: 'Sep', count: 4 },
    { month: 'Oct', count: 3 },
    { month: 'Nov', count: 2 },
    { month: 'Dec', count: 3 },
    { month: 'Jan', count: 4 },
    { month: 'Feb', count: 3 },
    { month: 'Mar', count: 4 },
    { month: 'Apr', count: 1 },
  ],

  healthCounts: { 'Healthy': 78, 'At-risk': 14, 'Waitlist': 12, 'On Hold': 4, 'Off-Market': 4 },

  agingBuckets: [
    { label: '0–30', amount: 4200, color: '#d68910' },
    { label: '31–60', amount: 2400, color: '#3d8c1f' },
    { label: '61–90', amount: 1800, color: '#c0392b' },
    { label: '90+',   amount: 800,  color: '#8b1f15' },
  ],

  prospectsBySource: [
    { label: 'Zillow',          value: 342, color: '#3d8c1f' },
    { label: 'Apartments.com',  value: 198, color: '#2471a3' },
    { label: 'Trulia/Hotpads',  value: 142, color: '#7d3c98' },
    { label: 'Direct (web)',    value: 92,  color: '#d68910' },
    { label: 'Referrals',       value: 48,  color: '#1c2119' },
    { label: 'Other',           value: 25,  color: '#aab5a3' },
  ],

  marketingFunnel: [
    { label: 'Prospects (inquiries)',  value: 847 },
    { label: 'Showings scheduled',    value: 442 },
    { label: 'Showings completed',    value: 312 },
    { label: 'Applications submitted', value: 142 },
    { label: 'Move-ins',              value: 31 },
  ],

  delinquentTrend: [
    { month: 'May', amount: 12.4 },
    { month: 'Jun', amount: 11.8 },
    { month: 'Jul', amount: 13.2 },
    { month: 'Aug', amount: 12.9 },
    { month: 'Sep', amount: 11.6 },
    { month: 'Oct', amount: 10.8 },
    { month: 'Nov', amount: 11.4 },
    { month: 'Dec', amount: 12.1 },
    { month: 'Jan', amount: 11.2 },
    { month: 'Feb', amount: 10.4 },
    { month: 'Mar', amount: 9.8 },
    { month: 'Apr', amount: 9.2 },
  ],

  incomeMonthly: [
    { month: 'May', gross: 192, net: 148 },
    { month: 'Jun', gross: 194, net: 149 },
    { month: 'Jul', gross: 198, net: 152 },
    { month: 'Aug', gross: 201, net: 154 },
    { month: 'Sep', gross: 205, net: 158 },
    { month: 'Oct', gross: 207, net: 160 },
    { month: 'Nov', gross: 210, net: 162 },
    { month: 'Dec', gross: 212, net: 164 },
    { month: 'Jan', gross: 214, net: 165 },
    { month: 'Feb', gross: 217, net: 168 },
    { month: 'Mar', gross: 220, net: 170 },
    { month: 'Apr', gross: 223, net: 173 },
  ],

  occupancyTrend: [
    { month: 'May', rate: 88.0 },
    { month: 'Jun', rate: 89.0 },
    { month: 'Jul', rate: 91.0 },
    { month: 'Aug', rate: 92.0 },
    { month: 'Sep', rate: 93.0 },
    { month: 'Oct', rate: 92.0 },
    { month: 'Nov', rate: 91.0 },
    { month: 'Dec', rate: 90.0 },
    { month: 'Jan', rate: 92.0 },
    { month: 'Feb', rate: 93.0 },
    { month: 'Mar', rate: 92.0 },
    { month: 'Apr', rate: 92.9 },
  ],

  rentIncreaseDistribution: [
    { label: '0–1%',  value: 4 },
    { label: '1–2%',  value: 7 },
    { label: '2–3%',  value: 12 },
    { label: '3–4%',  value: 9 },
    { label: '4–5%',  value: 5 },
    { label: '5%+',   value: 1 },
  ],

  // Drill-down sample data
  rentCollectionDetail: [
    { unit: '12 Maple St #1', tenant: 'Alex Chen', rent: 1850, status: 'Paid by 3rd' },
    { unit: '12 Maple St #2', tenant: 'Brett Howe', rent: 1900, status: 'Paid by 3rd' },
    { unit: '47 Oak Ln',      tenant: 'Carla Reyes', rent: 2100, status: 'Paid by 10th' },
    { unit: '83 Birch Ct',    tenant: 'Diane Park', rent: 1750, status: 'Late' },
    { unit: '120 Elm Ave',    tenant: 'Evan Liu', rent: 1950, status: 'Paid by 3rd' },
    { unit: '256 Cedar Pl',   tenant: 'Faye Ortiz', rent: 1680, status: 'Paid by 3rd' },
    { unit: '301 Pine Rd',    tenant: 'Greg Walsh', rent: 2200, status: 'Paid by 10th' },
  ],

  doorsAddedDetail: [
    { property: '120 Elm Ave',     owner: 'Atlas Holdings',     date: '2026-03-12', units: 1 },
    { property: '256 Cedar Pl',    owner: 'Birchwood LLC',      date: '2026-03-04', units: 2 },
    { property: '47 Oak Ln',       owner: 'Cardinal Capital',   date: '2026-02-21', units: 1 },
    { property: '88 Walnut Way',   owner: 'Dover Properties',   date: '2026-02-08', units: 3 },
    { property: '301 Pine Rd',     owner: 'Evergreen Homes',    date: '2026-01-30', units: 1 },
  ],
};
