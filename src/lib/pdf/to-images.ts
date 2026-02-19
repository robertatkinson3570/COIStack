/**
 * Convert a PDF buffer to an array of base64-encoded PNG images.
 * Uses pdf-to-img (pure JS, no native deps) for Vercel compatibility.
 */
export async function pdfToBase64Images(pdfBuffer: Buffer): Promise<string[]> {
  // Dynamic import because pdf-to-img is ESM-only
  const { pdf } = await import('pdf-to-img');

  const images: string[] = [];
  const document = await pdf(pdfBuffer, { scale: 2.0 });

  for await (const page of document) {
    // page is a Buffer containing PNG data
    const base64 = Buffer.from(page).toString('base64');
    images.push(base64);
  }

  return images;
}
