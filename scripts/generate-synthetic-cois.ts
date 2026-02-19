/**
 * Generate 18 synthetic ACORD-style Certificate of Insurance PDFs.
 * Run with: npx tsx scripts/generate-synthetic-cois.ts
 */
import { jsPDF } from 'jspdf';
import * as fs from 'fs';
import * as path from 'path';

interface CoiData {
  filename: string;
  certificateNumber: string;
  insurer: string;
  namedInsured: string;
  effectiveDate: string;
  expirationDate: string | null;
  glEachOccurrence: number | null;
  glAggregate: number | null;
  workersComp: boolean;
  additionalInsured: boolean;
  waiverOfSubrogation: boolean;
  notes: string;
}

const testCases: CoiData[] = [
  {
    filename: '01_compliant_gc',
    certificateNumber: 'CERT-2026-001',
    insurer: 'Zurich Insurance',
    namedInsured: 'Acme Construction LLC',
    effectiveDate: '2025-08-15',
    expirationDate: '2026-08-15',
    glEachOccurrence: 1_000_000,
    glAggregate: 2_000_000,
    workersComp: true,
    additionalInsured: true,
    waiverOfSubrogation: true,
    notes: 'Fully compliant GC',
  },
  {
    filename: '02_compliant_hvac',
    certificateNumber: 'CERT-2026-002',
    insurer: 'The Hartford',
    namedInsured: 'CoolAir HVAC Services',
    effectiveDate: '2025-09-01',
    expirationDate: '2026-09-01',
    glEachOccurrence: 1_000_000,
    glAggregate: 2_000_000,
    workersComp: true,
    additionalInsured: true,
    waiverOfSubrogation: true,
    notes: 'Fully compliant HVAC',
  },
  {
    filename: '03_compliant_cleaning',
    certificateNumber: 'CERT-2026-003',
    insurer: 'Travelers Insurance',
    namedInsured: 'SparkClean Janitorial',
    effectiveDate: '2025-07-20',
    expirationDate: '2026-07-20',
    glEachOccurrence: 1_000_000,
    glAggregate: 2_000_000,
    workersComp: true,
    additionalInsured: false,
    waiverOfSubrogation: false,
    notes: 'Compliant cleaning vendor',
  },
  {
    filename: '04_low_gl_limits',
    certificateNumber: 'CERT-2026-004',
    insurer: 'Liberty Mutual',
    namedInsured: 'BuildRight Inc',
    effectiveDate: '2025-06-01',
    expirationDate: '2026-06-01',
    glEachOccurrence: 500_000,
    glAggregate: 1_000_000,
    workersComp: true,
    additionalInsured: true,
    waiverOfSubrogation: true,
    notes: 'GL limits below minimum',
  },
  {
    filename: '05_missing_wc',
    certificateNumber: 'CERT-2026-005',
    insurer: 'CNA Insurance',
    namedInsured: 'Metro General Contractors',
    effectiveDate: '2025-10-01',
    expirationDate: '2026-10-01',
    glEachOccurrence: 1_000_000,
    glAggregate: 2_000_000,
    workersComp: false,
    additionalInsured: true,
    waiverOfSubrogation: true,
    notes: 'Missing workers compensation',
  },
  {
    filename: '06_missing_additional_insured',
    certificateNumber: 'CERT-2026-006',
    insurer: 'Nationwide',
    namedInsured: 'ProTemp Mechanical',
    effectiveDate: '2025-05-15',
    expirationDate: '2026-05-15',
    glEachOccurrence: 1_000_000,
    glAggregate: 2_000_000,
    workersComp: true,
    additionalInsured: false,
    waiverOfSubrogation: true,
    notes: 'Missing additional insured',
  },
  {
    filename: '07_missing_waiver',
    certificateNumber: 'CERT-2026-007',
    insurer: 'Chubb',
    namedInsured: 'Apex Plumbing & Electric',
    effectiveDate: '2025-04-20',
    expirationDate: '2026-04-20',
    glEachOccurrence: 1_000_000,
    glAggregate: 2_000_000,
    workersComp: true,
    additionalInsured: true,
    waiverOfSubrogation: false,
    notes: 'Missing waiver of subrogation',
  },
  {
    filename: '08_expired_30d',
    certificateNumber: 'CERT-2025-008',
    insurer: 'AIG',
    namedInsured: 'AllTrade Maintenance',
    effectiveDate: '2025-01-18',
    expirationDate: '2026-01-18',
    glEachOccurrence: 1_000_000,
    glAggregate: 2_000_000,
    workersComp: true,
    additionalInsured: true,
    waiverOfSubrogation: true,
    notes: 'Expired ~30 days ago',
  },
  {
    filename: '09_expires_tomorrow',
    certificateNumber: 'CERT-2026-009',
    insurer: 'Berkshire Hathaway',
    namedInsured: 'GreenEdge Landscaping',
    effectiveDate: '2025-02-19',
    expirationDate: '2026-02-19',
    glEachOccurrence: 1_000_000,
    glAggregate: 2_000_000,
    workersComp: true,
    additionalInsured: false,
    waiverOfSubrogation: false,
    notes: 'Expires tomorrow',
  },
  {
    filename: '10_expires_7d',
    certificateNumber: 'CERT-2026-010',
    insurer: 'Allianz',
    namedInsured: 'PrimeShine Services',
    effectiveDate: '2025-02-25',
    expirationDate: '2026-02-25',
    glEachOccurrence: 1_000_000,
    glAggregate: 2_000_000,
    workersComp: true,
    additionalInsured: false,
    waiverOfSubrogation: false,
    notes: 'Expires in ~7 days',
  },
  {
    filename: '11_expires_14d',
    certificateNumber: 'CERT-2026-011',
    insurer: 'Markel Insurance',
    namedInsured: 'Acme Construction LLC',
    effectiveDate: '2025-03-04',
    expirationDate: '2026-03-04',
    glEachOccurrence: 2_000_000,
    glAggregate: 4_000_000,
    workersComp: true,
    additionalInsured: true,
    waiverOfSubrogation: true,
    notes: 'Expires in ~14 days, high limits',
  },
  {
    filename: '12_expires_30d',
    certificateNumber: 'CERT-2026-012',
    insurer: 'Progressive',
    namedInsured: 'BuildRight Inc',
    effectiveDate: '2025-03-20',
    expirationDate: '2026-03-20',
    glEachOccurrence: 1_000_000,
    glAggregate: 2_000_000,
    workersComp: true,
    additionalInsured: true,
    waiverOfSubrogation: true,
    notes: 'Expires in ~30 days',
  },
  {
    filename: '13_missing_expiry',
    certificateNumber: 'CERT-2026-013',
    insurer: 'State Farm',
    namedInsured: 'Metro General Contractors',
    effectiveDate: '2025-06-01',
    expirationDate: null,
    glEachOccurrence: 1_000_000,
    glAggregate: 2_000_000,
    workersComp: true,
    additionalInsured: true,
    waiverOfSubrogation: true,
    notes: 'Missing expiration date entirely',
  },
  {
    filename: '14_low_confidence',
    certificateNumber: 'CERT-2026-014',
    insurer: 'Hanover Insurance',
    namedInsured: 'CoolAir HVAC Services',
    effectiveDate: '2025-06-01',
    expirationDate: '2026-06-01',
    glEachOccurrence: 1_000_000,
    glAggregate: 2_000_000,
    workersComp: true,
    additionalInsured: true,
    waiverOfSubrogation: true,
    notes: 'Simulated blurry/low quality scan',
  },
  {
    filename: '15_multi_policy',
    certificateNumber: 'CERT-2026-015',
    insurer: 'Intact Insurance',
    namedInsured: 'ProTemp Mechanical',
    effectiveDate: '2025-08-01',
    expirationDate: '2026-08-01',
    glEachOccurrence: 1_000_000,
    glAggregate: 2_000_000,
    workersComp: true,
    additionalInsured: true,
    waiverOfSubrogation: true,
    notes: 'Multiple policies on one cert (auto included)',
  },
  {
    filename: '16_regression_lower_limits',
    certificateNumber: 'CERT-2026-016',
    insurer: 'Zurich Insurance',
    namedInsured: 'Acme Construction LLC',
    effectiveDate: '2025-08-15',
    expirationDate: '2026-08-15',
    glEachOccurrence: 500_000,
    glAggregate: 1_000_000,
    workersComp: true,
    additionalInsured: true,
    waiverOfSubrogation: true,
    notes: 'Regression: lower GL limits than previous cert',
  },
  {
    filename: '17_all_missing',
    certificateNumber: 'CERT-2026-017',
    insurer: 'ACME Insurance Co',
    namedInsured: 'AllTrade Maintenance',
    effectiveDate: '',
    expirationDate: null,
    glEachOccurrence: null,
    glAggregate: null,
    workersComp: false,
    additionalInsured: false,
    waiverOfSubrogation: false,
    notes: 'Nearly all fields missing',
  },
  {
    filename: '18_high_limits',
    certificateNumber: 'CERT-2027-018',
    insurer: "Lloyd's of London",
    namedInsured: 'BuildRight Inc',
    effectiveDate: '2026-01-01',
    expirationDate: '2027-01-01',
    glEachOccurrence: 5_000_000,
    glAggregate: 10_000_000,
    workersComp: true,
    additionalInsured: true,
    waiverOfSubrogation: true,
    notes: 'Very high limits, long expiry',
  },
];

function formatCurrency(amount: number | null): string {
  if (amount === null) return '';
  return '$' + amount.toLocaleString('en-US');
}

function generateCoiPdf(data: CoiData): Buffer {
  const doc = new jsPDF({ format: 'letter' });
  const w = doc.internal.pageSize.getWidth();
  let y = 15;

  // Simulate low quality for test case 14
  const isLowQuality = data.filename.includes('14_low');

  // Title bar
  doc.setFillColor(0, 51, 102);
  doc.rect(10, y, w - 20, 12, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('ACORD', 15, y + 8);
  doc.setFontSize(9);
  doc.text('CERTIFICATE OF LIABILITY INSURANCE', w / 2, y + 5, { align: 'center' });
  doc.setFontSize(7);
  doc.text(`DATE (MM/DD/YYYY): ${new Date().toLocaleDateString('en-US')}`, w - 15, y + 5, { align: 'right' });
  y += 18;

  doc.setTextColor(0, 0, 0);

  // Certificate number
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text(`Certificate Number: ${data.certificateNumber}`, 15, y);
  y += 8;

  // Producer / Insurer box
  doc.setDrawColor(0);
  doc.rect(10, y, (w - 20) / 2 - 2, 35);
  doc.rect(10 + (w - 20) / 2 + 2, y, (w - 20) / 2 - 2, 35);

  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.text('PRODUCER', 15, y + 5);
  doc.setFont('helvetica', 'normal');
  doc.text('Insurance Broker Associates', 15, y + 10);
  doc.text('123 Main Street, Suite 400', 15, y + 14);
  doc.text('New York, NY 10001', 15, y + 18);
  doc.text('Phone: (212) 555-0100', 15, y + 22);

  const insurerX = 10 + (w - 20) / 2 + 7;
  doc.setFont('helvetica', 'bold');
  doc.text('INSURER(S) AFFORDING COVERAGE', insurerX, y + 5);
  doc.setFont('helvetica', 'normal');
  doc.text(`INSURER A: ${data.insurer}`, insurerX, y + 12);
  if (data.filename.includes('15_multi')) {
    doc.text('INSURER B: Auto-Owners Insurance', insurerX, y + 17);
    doc.text('INSURER C: Employer Holdings Corp', insurerX, y + 22);
  }
  y += 40;

  // Insured box
  doc.rect(10, y, w - 20, 25);
  doc.setFont('helvetica', 'bold');
  doc.text('INSURED', 15, y + 5);
  doc.setFont('helvetica', 'normal');

  if (isLowQuality) {
    // Simulate blurry by using lighter color
    doc.setTextColor(180, 180, 180);
    doc.text(data.namedInsured, 15, y + 11);
    doc.text('456 Industrial Blvd', 15, y + 15);
    doc.text('Chicago, IL 60601', 15, y + 19);
    doc.setTextColor(0, 0, 0);
  } else {
    doc.text(data.namedInsured, 15, y + 11);
    doc.text('456 Industrial Blvd', 15, y + 15);
    doc.text('Chicago, IL 60601', 15, y + 19);
  }
  y += 30;

  // Coverage section header
  doc.setFillColor(220, 220, 220);
  doc.rect(10, y, w - 20, 8, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.text('COVERAGES', 15, y + 5);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6);
  doc.text(
    'THIS IS TO CERTIFY THAT THE POLICIES OF INSURANCE LISTED BELOW HAVE BEEN ISSUED TO THE INSURED NAMED ABOVE.',
    15,
    y + 12
  );
  y += 16;

  // Coverage table header
  doc.setFillColor(240, 240, 240);
  doc.rect(10, y, w - 20, 7, 'F');
  doc.setFontSize(6);
  doc.setFont('helvetica', 'bold');
  doc.text('TYPE OF INSURANCE', 15, y + 5);
  doc.text('POLICY NUMBER', 80, y + 5);
  doc.text('POLICY EFF', 115, y + 5);
  doc.text('POLICY EXP', 140, y + 5);
  doc.text('LIMITS', 170, y + 5);
  y += 9;

  // General Liability row
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.text('COMMERCIAL GENERAL LIABILITY', 15, y + 4);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6);

  const policyNum = `GL-${data.certificateNumber.slice(-3)}-${Math.floor(Math.random() * 900000 + 100000)}`;
  doc.text(policyNum, 80, y + 4);
  doc.text(data.effectiveDate || '', 115, y + 4);

  if (data.expirationDate) {
    if (isLowQuality) {
      doc.setTextColor(170, 170, 170);
    }
    doc.text(data.expirationDate, 140, y + 4);
    doc.setTextColor(0, 0, 0);
  }

  // Limits column
  let limY = y;
  if (data.glEachOccurrence !== null) {
    doc.text(`EACH OCCURRENCE: ${formatCurrency(data.glEachOccurrence)}`, 170, limY + 4);
    limY += 5;
  }
  if (data.glAggregate !== null) {
    doc.text(`GENERAL AGGREGATE: ${formatCurrency(data.glAggregate)}`, 170, limY + 4);
    limY += 5;
  }
  doc.text('PRODUCTS-COMP/OP AGG: $2,000,000', 170, limY + 4);

  y += 20;
  doc.setDrawColor(200);
  doc.line(10, y, w - 10, y);
  y += 3;

  // Auto liability (for multi-policy test)
  if (data.filename.includes('15_multi')) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.text('AUTOMOBILE LIABILITY', 15, y + 4);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6);
    doc.text(`AUTO-${Math.floor(Math.random() * 900000 + 100000)}`, 80, y + 4);
    doc.text(data.effectiveDate, 115, y + 4);
    doc.text(data.expirationDate || '', 140, y + 4);
    doc.text('COMBINED SINGLE LIMIT: $1,000,000', 170, y + 4);
    y += 12;
    doc.line(10, y, w - 10, y);
    y += 3;
  }

  // Workers Compensation
  if (data.workersComp) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.text('WORKERS COMPENSATION', 15, y + 4);
    doc.text('AND EMPLOYERS LIABILITY', 15, y + 9);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6);
    doc.text(`WC-${Math.floor(Math.random() * 900000 + 100000)}`, 80, y + 4);
    doc.text(data.effectiveDate || '', 115, y + 4);
    doc.text(data.expirationDate || '', 140, y + 4);
    doc.text('WC STATUTORY LIMITS', 170, y + 4);
    doc.text('E.L. EACH ACCIDENT: $1,000,000', 170, y + 9);
    doc.text('E.L. DISEASE - EA EMPLOYEE: $1,000,000', 170, y + 14);
    y += 20;
  } else {
    y += 5;
  }

  doc.line(10, y, w - 10, y);
  y += 8;

  // Description of Operations
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.text('DESCRIPTION OF OPERATIONS / LOCATIONS / VEHICLES', 15, y);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6);
  y += 6;

  const descLines: string[] = [];
  if (data.additionalInsured) {
    descLines.push(
      'Certificate Holder is included as Additional Insured with respect to General Liability'
    );
    descLines.push('as required by written contract or agreement.');
  }
  if (data.waiverOfSubrogation) {
    descLines.push(
      'Waiver of Subrogation applies in favor of the Certificate Holder where required by'
    );
    descLines.push('written contract or agreement.');
  }
  if (descLines.length === 0) {
    descLines.push('General operations as per policy.');
  }

  for (const line of descLines) {
    doc.text(line, 15, y);
    y += 4;
  }

  y += 8;

  // Certificate Holder box
  doc.rect(10, y, w - 20, 25);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.text('CERTIFICATE HOLDER', 15, y + 5);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6);
  doc.text('COIStack Property Management', 15, y + 11);
  doc.text('789 Corporate Drive, Suite 200', 15, y + 15);
  doc.text('Dallas, TX 75201', 15, y + 19);

  // Authorized signature area
  const sigX = 10 + (w - 20) / 2 + 5;
  doc.text('AUTHORIZED REPRESENTATIVE', sigX, y + 5);
  doc.line(sigX, y + 18, w - 15, y + 18);
  doc.setFontSize(5);
  doc.text('Signature', sigX + 20, y + 22);

  // Footer
  y = doc.internal.pageSize.getHeight() - 10;
  doc.setFontSize(5);
  doc.setTextColor(128, 128, 128);
  doc.text(`ACORD 25 (2016/03) | ${data.notes}`, 15, y);

  // Return as buffer
  const arrayBuffer = doc.output('arraybuffer');
  return Buffer.from(arrayBuffer);
}

// Main
const outDir = path.join(__dirname, '..', 'test-cois');
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

console.log(`Generating ${testCases.length} synthetic COI PDFs...`);

for (const tc of testCases) {
  const buffer = generateCoiPdf(tc);
  const filePath = path.join(outDir, `${tc.filename}.pdf`);
  fs.writeFileSync(filePath, buffer);
  console.log(`  Created: ${tc.filename}.pdf`);
}

console.log(`\nDone! PDFs saved to: ${outDir}`);
