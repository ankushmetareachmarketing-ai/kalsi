export const BRANCHES = [
  "Head Office",
  "SACK",
  "RICC",
  "Niyojan Bhawan",
  "Sardar Patel Bhawan",
  "Park & stadium",
  "Auditorium",
  "Bihar Museum",
  "Bapu Tower",
  "Simaliya",
  "Bihar Sadan",
  "Bhubaneswar",
  "Bengaluru",
  "Kaushal Bhawan",
  "WTC",
  "Construction",
] as const;
export const EARNINGS = {
  basic: "Basic pay",
  hra: "House rent allowance",
  medical: "Medical allowance",
  conveyance: "Conveyance allowance",
  otherEarnings: "Other earnings",
  elIncome: "Earned leave income",
  uniformRefund: "Uniform refund",
  probationRefund: "Probation refund",
};
export const DEDUCTIONS = {
  uniform: "Uniform deduction",
  probation: "Probation deduction",
  telephone: "Telephone deduction",
  pf: "Provident fund (PF)",
  esic: "ESIC",
  meals: "Meals / mess",
  advance: "Advance",
  professionalTax: "Professional tax",
};
export type NumericKey =
  | keyof typeof EARNINGS
  | keyof typeof DEDUCTIONS
  | "presentDays"
  | "earnedLeaves"
  | "employerEpf"
  | "employerEps";
export const NUMERIC_FIELDS = [
  "presentDays",
  "earnedLeaves",
  ...Object.keys(EARNINGS),
  ...Object.keys(DEDUCTIONS),
  "employerEpf",
  "employerEps",
] as readonly NumericKey[];
export type Payroll = {
  id: string;
  employeeCode: string;
  name: string;
  email: string;
  branch: string;
  designation: string;
  department: string;
  month: string;
  joiningDate: string;
  bank: string;
  account: string;
  pan: string;
  uan: string;
  pfAccount: string;
  esiNumber: string;
  pran: string;
  taxRegime: string;
  generated: boolean;
} & Record<NumericKey, number>;
export type Company = {
  name: string;
  address: string;
  cin: string;
  email: string;
};
export const DEFAULT_COMPANY: Company = {
  name: "Kalsi Buildcon Pvt Ltd",
  address:
    "Manikaran Tower, Kilburn Colony, Hinoo, Ranchi - 834001\nSwimming Pool, Airport Road, Patna, Bihar - 800014",
  cin: "U70101JH2000PTC009208",
  email: "kalsi.buildcon@gmail.com",
};
export const money = (n: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(n);
export const round = (n: number) =>
  Math.round((n + Number.EPSILON) * 100) / 100;
export function totals(p: Payroll) {
  const earnings = round(
    Object.keys(EARNINGS).reduce((s, k) => s + p[k as NumericKey], 0),
  );
  const deductions = round(
    Object.keys(DEDUCTIONS).reduce((s, k) => s + p[k as NumericKey], 0),
  );
  return {
    earnings,
    deductions,
    net: round(earnings - deductions),
    employer: round(p.employerEpf + p.employerEps),
  };
}
export function monthLabel(month: string) {
  return new Date(`${month}-01T12:00:00`).toLocaleDateString("en-IN", {
    month: "long",
    year: "numeric",
  });
}
export function currentMonth() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
  })
    .format(new Date())
    .replace(/^(\d{2})\/(\d{4})$/, "$2-$1");
}
export function blankPayroll(month: string): Payroll {
  return {
    id: "",
    employeeCode: "",
    name: "",
    email: "",
    branch: "Head Office",
    designation: "",
    department: "",
    month,
    joiningDate: "",
    bank: "",
    account: "",
    pan: "",
    uan: "",
    pfAccount: "",
    esiNumber: "",
    pran: "",
    taxRegime: "Regular tax regime",
    generated: false,
    ...Object.fromEntries(NUMERIC_FIELDS.map((k) => [k, 0])),
    presentDays: new Date(
      Number(month.slice(0, 4)),
      Number(month.slice(5, 7)),
      0,
    ).getDate(),
  } as Payroll;
}
export function validatePayroll(p: Payroll): string[] {
  const errors: string[] = [];
  if (!p.name.trim()) errors.push("Employee name is required.");
  if (!/^[A-Za-z0-9_-]{1,32}$/.test(p.employeeCode))
    errors.push(
      "Employee code must use 1–32 letters, numbers, hyphens or underscores.",
    );
  if (!BRANCHES.includes(p.branch as (typeof BRANCHES)[number]))
    errors.push("Choose a valid branch from the list.");
  if (
    !/^\d{4}-(0[1-9]|1[0-2])$/.test(p.month) ||
    Number(p.month.slice(0, 4)) < 2000 ||
    Number(p.month.slice(0, 4)) > 2100
  )
    errors.push("Salary month must be between 2000-01 and 2100-12.");
  if (p.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(p.email))
    errors.push("Enter a valid email address.");
  for (const k of [
    "name",
    "email",
    "designation",
    "department",
    "bank",
    "account",
    "pan",
    "uan",
    "pfAccount",
    "esiNumber",
    "pran",
    "taxRegime",
  ] as const)
    if (p[k].length > 100) errors.push(`${k} must be 100 characters or fewer.`);
  for (const k of NUMERIC_FIELDS) {
    if (!Number.isFinite(p[k]) || p[k] < 0 || p[k] > 100000000)
      errors.push(`${k} must be a non-negative number below 100,000,000.`);
    else if (Math.abs(p[k] * 100 - Math.round(p[k] * 100)) > 0.00001)
      errors.push(`${k} must have no more than two decimal places.`);
  }
  const days = new Date(
    Number(p.month.slice(0, 4)),
    Number(p.month.slice(5, 7)),
    0,
  ).getDate();
  if (p.presentDays > days)
    errors.push(`Present days cannot exceed ${days} for this month.`);
  if (p.earnedLeaves > 366)
    errors.push("Earned leaves cannot exceed 366 days.");
  if (
    p.joiningDate &&
    (!/^\d{4}-\d{2}-\d{2}$/.test(p.joiningDate) ||
      Number.isNaN(Date.parse(p.joiningDate)) ||
      new Date(p.joiningDate).toISOString().slice(0, 10) !== p.joiningDate)
  )
    errors.push("Enter a valid joining date (YYYY-MM-DD).");
  if (totals(p).net < 0)
    errors.push("Deductions cannot exceed total earnings.");
  return errors;
}
export function payrollKey(p: Payroll) {
  return `${p.employeeCode.toUpperCase()}::${p.month}`;
}
export function demoPayroll(month: string): Payroll[] {
  const people = [
    ["Aarav Sharma", "Head Office", "Project Manager", 48000],
    ["Priya Verma", "Bihar Museum", "Site Engineer", 38600],
    ["Rohan Kumar", "Construction", "Foreman", 33200],
    ["Ananya Singh", "Head Office", "HR Executive", 35000],
    ["Vikash Yadav", "SACK", "Supervisor", 28400],
    ["Neha Gupta", "Bapu Tower", "Architect", 42000],
    ["Amit Patel", "RICC", "Site Engineer", 36800],
    ["Pooja Kumari", "Bengaluru", "Accountant", 32500],
    ["Rahul Sinha", "Niyojan Bhawan", "Supervisor", 29500],
    ["Sneha Roy", "WTC", "Coordinator", 31000],
    ["Deepak Das", "Bhubaneswar", "Electrician", 24600],
    ["Kavita Mishra", "Auditorium", "Administrator", 30200],
  ];
  return people.map(([name, branch, designation, salary], i) => {
    const s = Number(salary);
    return {
      ...blankPayroll(month),
      id: `demo-${i}-${month}`,
      employeeCode: `KBC${String(i + 1).padStart(4, "0")}`,
      name: String(name),
      email: `employee${i + 1}@example.com`,
      branch: String(branch),
      designation: String(designation),
      department: i === 3 ? "Human resources" : "Operations",
      joiningDate: "2025-12-24",
      bank: "State Bank of India",
      account: `XXXX XXXX ${4201 + i}`,
      basic: round(s * 0.4),
      hra: round(s * 0.4),
      medical: round(s * 0.1),
      conveyance: round(s * 0.1),
      pf: 1800,
      professionalTax: 83,
      meals: i % 3 === 0 ? 1200 : 0,
      earnedLeaves: [2, 0, 3, 1, 0, 2][i % 6],
      elIncome: [2, 0, 3, 1, 0, 2][i % 6] * 500,
      employerEpf: 550,
      employerEps: 1250,
    };
  });
}
export function amountWords(n: number): string {
  const ones = [
    "",
    "One",
    "Two",
    "Three",
    "Four",
    "Five",
    "Six",
    "Seven",
    "Eight",
    "Nine",
    "Ten",
    "Eleven",
    "Twelve",
    "Thirteen",
    "Fourteen",
    "Fifteen",
    "Sixteen",
    "Seventeen",
    "Eighteen",
    "Nineteen",
  ];
  const tens = [
    "",
    "",
    "Twenty",
    "Thirty",
    "Forty",
    "Fifty",
    "Sixty",
    "Seventy",
    "Eighty",
    "Ninety",
  ];
  function words(x: number): string {
    if (x < 20) return ones[x];
    if (x < 100) return `${tens[Math.floor(x / 10)]} ${ones[x % 10]}`.trim();
    if (x < 1000)
      return `${ones[Math.floor(x / 100)]} Hundred ${words(x % 100)}`.trim();
    for (const [unit, label] of [
      [10000000, "Crore"],
      [100000, "Lakh"],
      [1000, "Thousand"],
    ] as const)
      if (x >= unit)
        return `${words(Math.floor(x / unit))} ${label} ${words(x % unit)}`.trim();
    return "";
  }
  const paiseTotal = Math.round(n * 100),
    rupees = Math.floor(paiseTotal / 100),
    paise = paiseTotal % 100;
  return `INR ${words(rupees) || "Zero"}${paise ? ` and ${words(paise)} Paise` : ""} Only`;
}
