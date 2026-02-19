import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireAuth, requireActiveSubscription } from '@/lib/auth/helpers';
import { generateCsv, generateZipBuffer, ExportRow } from '@/lib/export/generate';
import { CoiExtractedFields } from '@/lib/types/database';
import { STORAGE_BUCKET } from '@/lib/constants';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(request: Request) {
  const { context, error } = await requireAuth();
  if (error) return error;

  const subError = requireActiveSubscription(context);
  if (subError) return subError;

  const supabase = createServiceClient();

  // Optional date range for historical exports
  let fromDate: string | null = null;
  let toDate: string | null = null;
  try {
    const body = await request.json();
    fromDate = body.from ?? null;
    toDate = body.to ?? null;
  } catch {
    // No body or invalid JSON — use defaults (all data)
  }

  // Batch queries instead of N+1 per vendor
  const [vendorRes, complianceRes, docsRes] = await Promise.all([
    supabase
      .from('cw_vendors')
      .select('id, name, trade_type')
      .eq('org_id', context.orgId)
      .order('name'),
    supabase
      .from('cw_compliance_status')
      .select('vendor_id, status, reasons_json, next_expiry_date')
      .eq('org_id', context.orgId),
    supabase
      .from('cw_documents')
      .select('vendor_id, file_url, created_at, cw_coi_extractions(extracted_json)')
      .eq('org_id', context.orgId)
      .order('created_at', { ascending: false }),
  ]);

  if (vendorRes.error) {
    return NextResponse.json({ error: vendorRes.error.message }, { status: 500 });
  }

  const vendors = vendorRes.data ?? [];

  // Build lookup maps
  const complianceMap = new Map(
    (complianceRes.data ?? []).map((c) => [c.vendor_id, c])
  );

  // Latest document per vendor (first seen since sorted desc)
  const latestDocMap = new Map<string, {
    file_url: string;
    created_at: string;
    extraction: CoiExtractedFields | undefined;
  }>();
  for (const doc of docsRes.data ?? []) {
    if (!latestDocMap.has(doc.vendor_id)) {
      const extractions = doc.cw_coi_extractions as unknown as { extracted_json: CoiExtractedFields }[] | null;
      latestDocMap.set(doc.vendor_id, {
        file_url: doc.file_url,
        created_at: doc.created_at,
        extraction: extractions?.[0]?.extracted_json,
      });
    }
  }

  const rows: ExportRow[] = [];
  const pdfFiles: Array<{ name: string; buffer: Buffer }> = [];

  for (const vendor of vendors) {
    const compliance = complianceMap.get(vendor.id);
    const latestDoc = latestDocMap.get(vendor.id);
    const extraction = latestDoc?.extraction;

    rows.push({
      vendor_name: vendor.name,
      trade_type: vendor.trade_type,
      status: compliance?.status ?? 'red',
      next_expiry_date: compliance?.next_expiry_date ?? null,
      gl_each_occurrence: extraction?.general_liability_each_occurrence ?? null,
      gl_aggregate: extraction?.general_liability_aggregate ?? null,
      workers_comp: extraction?.workers_comp_present ?? false,
      additional_insured: extraction?.additional_insured_phrase_present ?? false,
      waiver_of_subrogation: extraction?.waiver_of_subrogation_phrase_present ?? false,
      missing_items: (compliance?.reasons_json as string[] || []).join('; '),
      last_upload_date: latestDoc?.created_at ?? null,
    });

    if (latestDoc?.file_url) {
      try {
        const { data: pdfBlob } = await supabase.storage
          .from(STORAGE_BUCKET)
          .download(latestDoc.file_url);

        if (pdfBlob) {
          const buffer = Buffer.from(await pdfBlob.arrayBuffer());
          const safeName = vendor.name.replace(/[^a-zA-Z0-9]/g, '_');
          pdfFiles.push({ name: `${safeName}_coi.pdf`, buffer });
        }
      } catch {
        // Skip PDFs that fail to download
      }
    }
  }

  const csvContent = generateCsv(rows);
  const zipBuffer = await generateZipBuffer(csvContent, pdfFiles);

  // Upload ZIP — scoped by org
  const timestamp = Date.now();
  const exportPath = `${context.orgId}/exports/audit_${timestamp}.zip`;

  const { error: uploadError } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(exportPath, zipBuffer, {
      contentType: 'application/zip',
      upsert: false,
    });

  if (uploadError) {
    return NextResponse.json(
      { error: `Export upload failed: ${uploadError.message}` },
      { status: 500 }
    );
  }

  const { data: signedUrl } = await supabase.storage
    .from(STORAGE_BUCKET)
    .createSignedUrl(exportPath, 3600);

  return NextResponse.json({
    download_url: signedUrl?.signedUrl ?? null,
    expires_in: '1 hour',
    vendor_count: rows.length,
    document_count: pdfFiles.length,
  });
}
