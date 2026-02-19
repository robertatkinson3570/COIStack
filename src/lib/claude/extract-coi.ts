import OpenAI from 'openai';
import { CoiExtractedFields } from '@/lib/types/database';

const EXTRACTION_PROMPT = `You are an expert insurance document analyst.
Analyze this Certificate of Insurance (COI) image and extract the following fields.
Return ONLY valid JSON matching this exact schema — no markdown fences, no explanation:

{
  "policy_expiration_date": "YYYY-MM-DD or null if not found",
  "general_liability_each_occurrence": <number or null>,
  "general_liability_aggregate": <number or null>,
  "workers_comp_present": <boolean>,
  "additional_insured_phrase_present": <boolean>,
  "waiver_of_subrogation_phrase_present": <boolean>,
  "auto_liability_combined_single_limit": <number or null>,
  "umbrella_each_occurrence": <number or null>,
  "umbrella_aggregate": <number or null>,
  "professional_liability_each_occurrence": <number or null>,
  "cyber_liability_each_occurrence": <number or null>,
  "property_insurance_present": <boolean>,
  "insurer_name": "<string or null>",
  "policy_number": "<string or null>",
  "named_insured": "<string or null>",
  "policy_effective_date": "YYYY-MM-DD or null",
  "confidence_score": <0.0 to 1.0>,
  "raw_text_notes": "<any observations about document quality or unusual content>"
}

Rules:
- For dollar amounts, return the numeric value without currency symbols (e.g., 1000000 not "$1,000,000")
- confidence_score should reflect how certain you are about the extracted values overall
- Set confidence_score below 0.7 if any key fields are unclear or partially obscured
- workers_comp_present is true if you see any Workers Compensation / Employers Liability section with limits
- additional_insured_phrase_present is true if you see language like "additional insured" in the certificate holder or description section
- waiver_of_subrogation_phrase_present is true if you see "waiver of subrogation" mentioned
- auto_liability_combined_single_limit: the Combined Single Limit from the Automobile Liability section (or null if not present)
- umbrella_each_occurrence: the Each Occurrence limit from the Umbrella/Excess Liability section (or null if absent)
- umbrella_aggregate: the Aggregate limit from the Umbrella/Excess Liability section (or null if absent)
- professional_liability_each_occurrence: the Per Claim/Occurrence limit from Professional Liability / E&O section (or null if absent)
- cyber_liability_each_occurrence: the Per Occurrence limit from Cyber Liability / Technology E&O section (or null if absent)
- property_insurance_present: true if you see any Property Insurance / Inland Marine section with limits
- If a field is completely absent from the document, use null for strings/numbers and false for booleans`;

function parseLLMJson(text: string): unknown {
  let cleaned = text.trim();
  // Strip markdown code fences if present
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
  }
  return JSON.parse(cleaned);
}

export async function extractCoi(
  client: OpenAI,
  base64Images: string[]
): Promise<CoiExtractedFields> {
  const imageContent: OpenAI.Chat.Completions.ChatCompletionContentPart[] = base64Images.map((img) => ({
    type: 'image_url' as const,
    image_url: {
      url: `data:image/png;base64,${img}`,
      detail: 'high' as const,
    },
  }));

  const response = await client.chat.completions.create({
    model: 'gpt-4o',
    max_tokens: 1024,
    messages: [
      {
        role: 'user',
        content: [
          ...imageContent,
          { type: 'text', text: EXTRACTION_PROMPT },
        ],
      },
    ],
  });

  const text = response.choices[0]?.message?.content;
  if (!text) {
    throw new Error('No text response from OpenAI');
  }

  const extracted = parseLLMJson(text) as CoiExtractedFields;

  // Validate required field
  if (typeof extracted.confidence_score !== 'number') {
    extracted.confidence_score = 0.5;
  }

  return extracted;
}
