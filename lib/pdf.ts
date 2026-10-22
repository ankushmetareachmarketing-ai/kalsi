import {
  EARNINGS,
  DEDUCTIONS,
  amountWords,
  monthLabel,
  totals,
  type Payroll,
  type Company,
  type NumericKey,
} from "./payroll.ts";
import { downloadBlob } from "./csv.ts";
export function slipFilename(p: Payroll) {
  return `${p.employeeCode}_${p.month}_salary-slip.pdf`;
}
export async function buildPdf(p: Payroll, company: Company) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const green = [28, 63, 50] as const,
    gray = [105, 116, 110] as const;
  const text = (
    s: string,
    x: number,
    y: number,
    size = 10,
    bold = false,
    color: readonly number[] = [35, 43, 39],
  ) => {
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setFontSize(size);
    doc.setTextColor(color[0], color[1], color[2]);
    doc.text(s, x, y);
  };
  const line = (y: number) => {
    doc.setDrawColor(223, 229, 223);
    doc.line(17, y, 193, y);
  };
  const number = (n: number) =>
    new Intl.NumberFormat("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(n);
  const wrap = (s: string, width: number) =>
    doc.splitTextToSize(s || "-", width) as string[];
  const fittedText = (
    s: string,
    x: number,
    y: number,
    width: number,
    size: number,
    bold: boolean,
    color: readonly number[],
  ) => {
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setFontSize(size);
    text(
      s,
      x,
      y,
      Math.min(size, (size * width) / Math.max(doc.getTextWidth(s), 1)),
      bold,
      color,
    );
  };
  doc.setFillColor(...green);
  doc.rect(0, 0, 210, 4, "F");
  text("K /", 17, 24, 25, true, green);
  text("PEOPLE & PAYROLL", 17, 31, 7, false, gray);
  text("SALARY SLIP", 143, 22, 16, true, green);
  text(monthLabel(p.month), 143, 30, 10, false, gray);
  fittedText(company.name, 17, 47, 176, 15, true, green);
  doc.setFontSize(8);
  let y = 54;
  for (const row of wrap(company.address, 170)) {
    text(row, 17, y, 8, false, gray);
    y += 4;
  }
  fittedText(
    `CIN: ${company.cin || "-"}   |   ${company.email}`,
    17,
    y + 2,
    176,
    8,
    false,
    gray,
  );
  y += 10;
  line(y);
  const details = [
    ["EMPLOYEE", `${p.name} (${p.employeeCode})`, "BRANCH", p.branch],
    ["DESIGNATION", p.designation, "DEPARTMENT", p.department],
    ["DATE OF JOINING", p.joiningDate, "TAX REGIME", p.taxRegime],
    [
      "BANK",
      `${p.bank} ${p.account}`,
      "PAN / UAN",
      `${p.pan || "-"} / ${p.uan || "-"}`,
    ],
    [
      "ESI NUMBER",
      p.esiNumber,
      "PF ACCOUNT / PRAN",
      `${p.pfAccount || "-"} / ${p.pran || "-"}`,
    ],
  ];
  for (const [a, b, c, d] of details) {
    y += 6;
    text(a, 17, y, 7, false, gray);
    text(c, 110, y, 7, false, gray);
    y += 4;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    const left = wrap(b, 85),
      right = wrap(d, 80);
    left.forEach((s, i) => text(s, 17, y + i * 4, 9, true));
    right.forEach((s, i) => text(s, 110, y + i * 4, 9, true));
    y += Math.max(left.length, right.length) * 4 - 3;
  }
  y += 7;
  // Keep the salary table together when long employee details need more space.
  if (y > 141) {
    line(273);
    text("Salary details continue on the next page.", 17, 280, 8, false, gray);
    doc.addPage();
    doc.setFillColor(...green);
    doc.rect(0, 0, 210, 4, "F");
    text("SALARY SLIP", 17, 23, 16, true, green);
    fittedText(
      `${p.name} (${p.employeeCode}) | ${monthLabel(p.month)}`,
      17,
      32,
      176,
      10,
      false,
      gray,
    );
    y = 43;
  }
  doc.setFillColor(240, 245, 240);
  doc.roundedRect(17, y, 176, 15, 2, 2, "F");
  text(`PRESENT DAYS   ${p.presentDays}`, 23, y + 9, 9, true, green);
  text(`EARNED LEAVE   ${p.earnedLeaves} days`, 111, y + 9, 9, true, green);
  y += 23;
  text("EARNINGS", 17, y, 9, true, gray);
  text("AMOUNT (INR)", 69, y, 8, true, gray);
  text("DEDUCTIONS", 110, y, 9, true, gray);
  text("AMOUNT (INR)", 165, y, 8, true, gray);
  y += 4;
  line(y);
  const earnings = Object.entries(EARNINGS),
    deductions = Object.entries(DEDUCTIONS);
  for (let i = 0; i < Math.max(earnings.length, deductions.length); i++) {
    y += 5.5;
    const e = earnings[i],
      d = deductions[i];
    if (e) {
      text(e[1], 17, y, 8);
      doc.text(number(p[e[0] as NumericKey]), 98, y, { align: "right" });
    }
    if (d) {
      text(d[1], 110, y, 8);
      doc.text(number(p[d[0] as NumericKey]), 193, y, { align: "right" });
    }
  }
  y += 5;
  line(y);
  y += 8;
  const t = totals(p);
  text("Total earnings", 17, y, 9, true);
  doc.text(number(t.earnings), 98, y, { align: "right" });
  text("Total deductions", 110, y, 9, true);
  doc.text(number(t.deductions), 193, y, { align: "right" });
  y += 9;
  doc.setFillColor(...green);
  doc.roundedRect(17, y, 176, 22, 2, 2, "F");
  text("NET PAY", 23, y + 9, 8, true, [218, 231, 217]);
  text("Take-home salary", 23, y + 16, 8, false, [218, 231, 217]);
  doc.setFontSize(19);
  doc.setTextColor(255, 255, 255);
  doc.text(`Rs. ${number(t.net)}`, 187, y + 14, { align: "right" });
  y += 30;
  doc.setFontSize(8);
  for (const row of wrap(amountWords(t.net), 176)) {
    text(row, 17, y, 8, true, green);
    y += 4;
  }
  y += 6;
  fittedText(
    `Employer contribution: EPF Rs. ${number(p.employerEpf)}   |   EPS Rs. ${number(p.employerEps)}   |   Total Rs. ${number(t.employer)}`,
    17,
    y,
    176,
    8,
    false,
    gray,
  );
  line(273);
  text(
    "This is a computer generated salary slip. No signature is required.",
    17,
    280,
    8,
    false,
    gray,
  );
  text(`${p.employeeCode} / ${p.month}`, 17, 286, 7, false, gray);
  doc.setProperties({
    title: `Salary slip - ${p.employeeCode} - ${p.month}`,
    author: company.name,
  });
  return doc;
}
export async function downloadPdf(p: Payroll, company: Company) {
  const doc = await buildPdf(p, company);
  doc.save(slipFilename(p));
}
export async function downloadZip(
  rows: Payroll[],
  company: Company,
  month: string,
) {
  const { default: JSZip } = await import("jszip");
  const zip = new JSZip();
  for (const p of rows) {
    const doc = await buildPdf(p, company);
    zip.file(slipFilename(p), doc.output("arraybuffer"));
  }
  downloadBlob(
    await zip.generateAsync({ type: "blob" }),
    `salary-slips_${month}.zip`,
  );
}

// Shares slips on WhatsApp. Uses the native share sheet (with PDF files)
// where supported, otherwise opens WhatsApp with a text message.
export async function shareWhatsapp(rows: Payroll[], company: Company) {
  const label = rows.length === 1
    ? `Salary slip of ${rows[0].name} (${rows[0].employeeCode}) for ${rows[0].month}`
    : `${rows.length} salary slips for ${rows[0]?.month ?? ""}`;
  const text = `${label} - ${company.name}`;
  const files: File[] = [];
  for (const p of rows) {
    const doc = await buildPdf(p, company);
    files.push(
      new File([doc.output("blob")], slipFilename(p), {
        type: "application/pdf",
      }),
    );
  }
  if (navigator.canShare?.({ files })) {
    try {
      await navigator.share({ files, text });
      return;
    } catch (e) {
      if ((e as Error).name === "AbortError") return;
    }
  }
  window.open(
    `https://wa.me/?text=${encodeURIComponent(text)}`,
    "_blank",
    "noopener",
  );
}
