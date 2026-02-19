import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { createServiceClient } from '@/lib/supabase/server';
import { requireAuth, requireRole, requireActiveSubscription } from '@/lib/auth/helpers';
import { STORAGE_BUCKET, MAX_FILE_SIZE } from '@/lib/constants';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  const { context, error } = await requireAuth();
  if (error) return error;

  const subError = requireActiveSubscription(context);
  if (subError) return subError;

  const roleError = requireRole(context, ['owner', 'admin', 'member']);
  if (roleError) return roleError;

  const supabase = createServiceClient();

  const formData = await request.formData();
  const vendorId = formData.get('vendor_id') as string;
  const file = formData.get('file') as File;

  if (!vendorId || !file) {
    return NextResponse.json(
      { error: 'vendor_id and file are required' },
      { status: 400 }
    );
  }

  if (file.type !== 'application/pdf') {
    return NextResponse.json(
      { error: 'Only PDF files are accepted' },
      { status: 400 }
    );
  }

  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json(
      { error: 'File exceeds 4MB limit' },
      { status: 413 }
    );
  }

  // Verify vendor belongs to this org
  const { data: vendor } = await supabase
    .from('cw_vendors')
    .select('id')
    .eq('id', vendorId)
    .eq('org_id', context.orgId)
    .single();

  if (!vendor) {
    return NextResponse.json({ error: 'Vendor not found' }, { status: 404 });
  }

  // Read file buffer and compute checksum
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const checksum = createHash('sha256').update(buffer).digest('hex');

  // Check for duplicate within this org
  const { data: existing } = await supabase
    .from('cw_documents')
    .select('id')
    .eq('vendor_id', vendorId)
    .eq('checksum', checksum)
    .eq('org_id', context.orgId)
    .limit(1)
    .single();

  if (existing) {
    return NextResponse.json({
      document_id: existing.id,
      is_duplicate: true,
    });
  }

  // Upload to Supabase storage — scoped by org
  const timestamp = Date.now();
  const storagePath = `${context.orgId}/cois/${vendorId}/${timestamp}_${file.name}`;

  const { error: uploadError } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(storagePath, buffer, {
      contentType: 'application/pdf',
      upsert: false,
    });

  if (uploadError) {
    return NextResponse.json(
      { error: `Storage upload failed: ${uploadError.message}` },
      { status: 500 }
    );
  }

  // Insert document row
  const { data: doc, error: insertError } = await supabase
    .from('cw_documents')
    .insert({
      org_id: context.orgId,
      vendor_id: vendorId,
      file_url: storagePath,
      file_name: file.name,
      file_size: buffer.length,
      checksum,
      source: 'upload',
      uploaded_by: context.user.id,
    })
    .select('id')
    .single();

  if (insertError) {
    return NextResponse.json(
      { error: insertError.message },
      { status: 500 }
    );
  }

  return NextResponse.json({
    document_id: doc.id,
    file_url: storagePath,
    is_duplicate: false,
  });
}
