/**
 * Heuristic PHI detector for free text. This is a safety net, NOT a guarantee of anonymisation:
 * it catches obvious identifiers (contact details, IDs, full dates, names after honorifics) so the
 * uploader can fix them, and it blocks them from being sent to external LLM providers.
 */
const PATTERNS: { label: string; re: RegExp }[] = [
  { label: "email address", re: /[\w.+-]+@[\w-]+\.[\w.-]+/ },
  { label: "phone number", re: /(?:\+\d{1,3}[\s-]?\d{6,12}|\b[6-9]\d{9}\b|\b0\d{2,4}[\s-]\d{6,8}\b)/ },
  { label: "Aadhaar-like number", re: /\b\d{4}\s?\d{4}\s?\d{4}\b/ },
  { label: "MRN / patient ID", re: /\b(?:mrn|uhid|ip\s*no|op\s*no|patient\s*id|reg(?:istration)?\s*no|accession)\b\s*[:#.-]?\s*[\w/-]{3,}/i },
  { label: "full date", re: /\b(?:\d{1,2}[/.-]\d{1,2}[/.-](?:19|20)?\d{2}|(?:19|20)\d{2}-\d{2}-\d{2})\b/ },
  { label: "date of birth", re: /\b(?:dob|d\.o\.b|date of birth|born on)\b/i },
  { label: "patient name", re: /\b(?:mr|mrs|ms|miss|smt|shri|master|baby)\.?\s+[A-Z][a-z]{2,}(?:\s+[A-Z][a-z]{2,})?/ },
  { label: "patient name", re: /\b(?:patient(?:'s)? name|name of (?:the )?patient)\b\s*[:\-]/i },
  { label: "street address", re: /\b\d{1,4}[,\s]+[A-Za-z ]{3,30}\b(?:road|street|nagar|colony|lane|sector)\b/i },
];

export function scanTextForPHI(...texts: (string | null | undefined)[]) {
  const hits = new Set<string>();
  for (const t of texts) {
    if (!t) continue;
    for (const { label, re } of PATTERNS) if (re.test(t)) hits.add(label);
  }
  return [...hits];
}
