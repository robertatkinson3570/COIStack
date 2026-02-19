import archiver from 'archiver';
import { Readable } from 'stream';

export interface ExportRow {
  vendor_name: string;
  trade_type: string;
  status: string;
  next_expiry_date: string | null;
  gl_each_occurrence: number | null;
  gl_aggregate: number | null;
  workers_comp: boolean;
  additional_insured: boolean;
  waiver_of_subrogation: boolean;
  missing_items: string;
  last_upload_date: string | null;
}

export function generateCsv(rows: ExportRow[]): string {
  const headers = [
    'vendor_name',
    'trade_type',
    'status',
    'next_expiry_date',
    'gl_each_occurrence',
    'gl_aggregate',
    'workers_comp',
    'additional_insured',
    'waiver_of_subrogation',
    'missing_items',
    'last_upload_date',
  ];

  const csvLines = [headers.join(',')];

  function escapeCsv(value: string): string {
    // Escape double quotes by doubling them
    let escaped = value.replace(/"/g, '""');
    // Prevent CSV injection (formula injection in Excel)
    if (/^[=+\-@\t\r]/.test(escaped)) {
      escaped = `'${escaped}`;
    }
    return `"${escaped}"`;
  }

  for (const row of rows) {
    const values = [
      escapeCsv(row.vendor_name),
      row.trade_type,
      row.status,
      row.next_expiry_date || '',
      row.gl_each_occurrence?.toString() || '',
      row.gl_aggregate?.toString() || '',
      row.workers_comp.toString(),
      row.additional_insured.toString(),
      row.waiver_of_subrogation.toString(),
      escapeCsv(row.missing_items),
      row.last_upload_date || '',
    ];
    csvLines.push(values.join(','));
  }

  return csvLines.join('\n');
}

export async function generateZipBuffer(
  csvContent: string,
  pdfFiles: Array<{ name: string; buffer: Buffer }>
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const archive = archiver('zip', { zlib: { level: 9 } });
    const chunks: Buffer[] = [];

    archive.on('data', (chunk: Buffer) => chunks.push(chunk));
    archive.on('end', () => resolve(Buffer.concat(chunks)));
    archive.on('error', reject);

    // Add CSV
    archive.append(csvContent, { name: 'index.csv' });

    // Add PDFs
    for (const pdf of pdfFiles) {
      archive.append(pdf.buffer, { name: `coi/${pdf.name}` });
    }

    archive.finalize();
  });
}
