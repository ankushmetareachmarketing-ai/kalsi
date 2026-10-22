import test from "node:test";
import assert from "node:assert/strict";
import {
  blankPayroll,
  totals,
  validatePayroll,
  amountWords,
  demoPayroll,
  payrollKey,
  BRANCHES,
} from "../lib/payroll.ts";
import { parsePayrollCsv, createCsv } from "../lib/csv.ts";
import { buildPdf } from "../lib/pdf.ts";
import { DEFAULT_COMPANY } from "../lib/payroll.ts";
test("reference amounts reconcile to 30,198 net including EL", () => {
  const p = {
    ...blankPayroll("2026-04"),
    name: "Test Employee",
    employeeCode: "TEST01",
    basic: 13280,
    hra: 13280,
    medical: 3320,
    conveyance: 3320,
    elIncome: 2213,
    meals: 3332,
    pf: 1800,
    professionalTax: 83,
  };
  assert.deepEqual(totals(p), {
    earnings: 35413,
    deductions: 5215,
    net: 30198,
    employer: 0,
  });
  assert.deepEqual(validatePayroll(p), []);
});
test("refunds increase earnings, all 8 deduction types reduce net, employer PF stays separate", () => {
  const p = {
    ...blankPayroll("2026-10"),
    basic: 10000,
    uniformRefund: 50,
    probationRefund: 100,
    uniform: 10,
    probation: 20,
    telephone: 30,
    pf: 40,
    esic: 50,
    meals: 60,
    advance: 70,
    professionalTax: 80,
    employerEpf: 550,
    employerEps: 1250,
  };
  assert.deepEqual(totals(p), {
    earnings: 10150,
    deductions: 360,
    net: 9790,
    employer: 1800,
  });
});
test("fractional rupees round to paise and words use the Indian system", () => {
  const p = { ...blankPayroll("2026-10"), basic: 0.1, hra: 0.2 };
  assert.equal(totals(p).net, 0.3);
  assert.equal(
    amountWords(30198),
    "INR Thirty Thousand One Hundred Ninety Eight Only",
  );
  assert.equal(amountWords(100000.5), "INR One Lakh and Fifty Paise Only");
  assert.equal(amountWords(9.999), "INR Ten Only");
});
test("invalid amounts, impossible attendance, negative net, month and branch are rejected", () => {
  const p = {
    ...blankPayroll("2026-02"),
    name: "X",
    employeeCode: "TEST",
    basic: 100,
    pf: 101,
    presentDays: 29,
    earnedLeaves: -1,
    esic: NaN,
    branch: "Unknown",
  };
  const es = validatePayroll(p);
  assert(es.some((e) => e.includes("exceed 28")));
  assert(
    validatePayroll({ ...p, esic: 0 }).some((e) => e.includes("Deductions")),
  );
  assert(es.some((e) => e.includes("esic")));
  assert(es.some((e) => e.includes("branch")));
  assert(es.some((e) => e.includes("earnedLeaves")));
  assert(
    validatePayroll({ ...p, month: "2026-13" }).some((e) =>
      e.includes("month"),
    ),
  );
});
test("sample CSV round-trips every payroll component with quoted commas", () => {
  const rows = demoPayroll("2026-10");
  rows[0].name = "Sample, Employee";
  const result = parsePayrollCsv(createCsv(rows), "2026-09");
  assert.deepEqual(result.errors, []);
  assert.equal(result.rows.length, 12);
  assert.equal(result.rows[0].name, "Sample, Employee");
  assert.equal(result.rows[0].month, "2026-10");
  assert.deepEqual(totals(result.rows[0]), totals(rows[0]));
  assert.equal(BRANCHES.length, 16);
});
test("minimal CSV uses selected month and rejects duplicate keys case-insensitively", () => {
  const result = parsePayrollCsv(
    "employeeCode,name,branch,basic\ntest,One,Head Office,100\nTEST,Two,Head Office,200",
    "2026-09",
  );
  assert.equal(result.rows[0].month, "2026-09");
  assert.equal(payrollKey(result.rows[0]), payrollKey(result.rows[1]));
  assert(result.errors.some((e) => e.includes("duplicate")));
});
test("CSV rejects missing columns, nonnumeric values, empty files and malformed quotes", () => {
  assert(
    parsePayrollCsv("name\nA", "2026-10").errors.some((e) =>
      e.includes("Missing required"),
    ),
  );
  assert(
    parsePayrollCsv(
      "employeeCode,name,branch,basic\nA,A,Head Office,wrong",
      "2026-10",
    ).errors.some((e) => e.includes("basic")),
  );
  assert(
    parsePayrollCsv("employeeCode,name,branch,basic\n", "2026-10").errors
      .length,
  );
  assert(
    parsePayrollCsv(
      'employeeCode,name,branch,basic\nA,"Unclosed,Head Office,100',
      "2026-10",
    ).errors.length,
  );
});
test("CSV export neutralizes formula injection in text fields", () => {
  const rows = demoPayroll("2026-10");
  rows[0].name = '=HYPERLINK("https://example.com")';
  assert(createCsv(rows).includes("'=HYPERLINK"));
});
test("CSV rejects sub-paise precision so line items always reconcile", () => {
  const result = parsePayrollCsv(
    "employeeCode,name,branch,basic,hra\nA,Employee,Head Office,0.004,0.004",
    "2026-10",
  );
  assert(result.errors.some((e) => e.includes("two decimal places")));
});
test("PDF keeps normal slips on one A4 page and continues long details safely", async () => {
  const p = demoPayroll("2026-10")[0];
  const regular = await buildPdf(p, DEFAULT_COMPANY);
  assert.equal(regular.getNumberOfPages(), 1);
  assert(regular.output().includes("45,917.00"));
  const long = {
    ...p,
    name: "M".repeat(100),
    bank: "M".repeat(100),
    account: "M".repeat(100),
    designation: "M".repeat(100),
    department: "M".repeat(100),
    taxRegime: "M".repeat(100),
    pfAccount: "M".repeat(100),
    pran: "M".repeat(100),
  };
  assert.equal((await buildPdf(long, DEFAULT_COMPANY)).getNumberOfPages(), 2);
});
