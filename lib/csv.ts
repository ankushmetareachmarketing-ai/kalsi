import Papa from "papaparse";
import {
  blankPayroll,
  NUMERIC_FIELDS,
  payrollKey,
  validatePayroll,
  type Payroll,
} from "./payroll.ts";
export const TEXT_FIELDS = [
  "employeeCode",
  "name",
  "email",
  "branch",
  "designation",
  "department",
  "month",
  "joiningDate",
  "bank",
  "account",
  "pan",
  "uan",
  "pfAccount",
  "esiNumber",
  "pran",
  "taxRegime",
] as const;
export const CSV_HEADERS = [...TEXT_FIELDS, ...NUMERIC_FIELDS];
export function parsePayrollCsv(
  text: string,
  month: string,
): { rows: Payroll[]; errors: string[] } {
  const parsed = Papa.parse<Record<string, string>>(
    text.replace(/^\uFEFF/, ""),
    {
      header: true,
      skipEmptyLines: "greedy",
      transformHeader: (h) => h.trim(),
    },
  );
  const errors = parsed.errors.map(
    (e) => `CSV row ${(e.row ?? 0) + 2}: ${e.message}`,
  );
  if (parsed.data.length > 2000)
    return {
      rows: [],
      errors: ["Please upload at most 2,000 employees at a time."],
    };
  if (!parsed.data.length) errors.push("The CSV has no employee rows.");
  for (const key of ["employeeCode", "name", "branch", "basic"])
    if (!parsed.meta.fields?.includes(key))
      errors.push(`Missing required column: ${key}`);
  const seen = new Set<string>();
  const rows = parsed.data.map((row, i) => {
    const p = blankPayroll(month);
    for (const k of TEXT_FIELDS) if (row[k]?.trim()) p[k] = row[k].trim();
    p.employeeCode = p.employeeCode.toUpperCase();
    for (const k of NUMERIC_FIELDS)
      if (row[k]?.trim()) p[k] = Number(row[k].trim());
    p.id = `import-${i}-${Date.now()}`;
    for (const e of validatePayroll(p)) errors.push(`Row ${i + 2}: ${e}`);
    const key = payrollKey(p);
    if (seen.has(key))
      errors.push(
        `Row ${i + 2}: duplicate employee code and month (${p.employeeCode}, ${p.month}).`,
      );
    seen.add(key);
    return p;
  });
  return { rows, errors };
}
export function createCsv(rows: Payroll[]) {
  return (
    "\uFEFF" +
    Papa.unparse(
      {
        fields: [...CSV_HEADERS],
        data: rows.map((p) => CSV_HEADERS.map((k) => p[k])),
      },
      { escapeFormulae: true },
    )
  );
}
export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
export function downloadCsv(rows: Payroll[], name: string) {
  downloadBlob(
    new Blob([createCsv(rows)], { type: "text/csv;charset=utf-8" }),
    name,
  );
}
