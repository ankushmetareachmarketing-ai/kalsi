import {
  EARNINGS,
  DEDUCTIONS,
  totals,
  money,
  monthLabel,
  amountWords,
  type Payroll,
  type Company,
  type NumericKey,
} from "@/lib/payroll";
export default function SlipPreview({
  p,
  company,
}: {
  p: Payroll;
  company: Company;
}) {
  const t = totals(p);
  return (
    <article className="salary-paper">
      <div className="slip-top">
        <div>
          <div className="slip-brand">
            K<span> /</span>
          </div>
          <small>PEOPLE & PAYROLL</small>
        </div>
        <div className="text-right">
          <div className="eyebrow">MONTHLY PAY STATEMENT</div>
          <h2>Salary slip</h2>
          <p>{monthLabel(p.month)}</p>
        </div>
      </div>
      <div className="slip-company">
        <h3>{company.name}</h3>
        <p className="whitespace-pre-line">{company.address}</p>
        <p>
          CIN: {company.cin || "—"} · {company.email}
        </p>
      </div>
      <div className="slip-employee">
        <div>
          <small>EMPLOYEE</small>
          <h3>{p.name}</h3>
          <p>
            {p.employeeCode} · {p.designation || "Employee"}
          </p>
        </div>
        <span className="pill">{p.branch}</span>
      </div>
      <div className="slip-details">
        {[
          ["Department", p.department],
          ["Date of joining", p.joiningDate],
          ["Bank", p.bank],
          ["Account", p.account],
          ["PAN", p.pan],
          ["UAN", p.uan],
          ["PF account", p.pfAccount],
          ["ESI number", p.esiNumber],
          ["PRAN", p.pran],
          ["Tax regime", p.taxRegime],
        ].map(([k, v]) => (
          <div key={k}>
            <small>{k}</small>
            <span>{v || "—"}</span>
          </div>
        ))}
      </div>
      <div className="attendance-strip">
        <span>
          Present <b>{p.presentDays} days</b>
        </span>
        <span>
          Earned leave <b>{p.earnedLeaves} days</b>
        </span>
      </div>
      <div className="slip-amounts">
        {[
          ["Earnings", EARNINGS, t.earnings],
          ["Deductions", DEDUCTIONS, t.deductions],
        ].map(([label, fields, total]) => (
          <div key={String(label)}>
            <div className="slip-table-head">
              <b>{String(label)}</b>
              <small>AMOUNT</small>
            </div>
            {Object.entries(fields as Record<string, string>).map(([k, v]) => (
              <div className="slip-row" key={k}>
                <span>{v}</span>
                <b>{money(p[k as NumericKey])}</b>
              </div>
            ))}
            <div className="slip-total">
              <b>Total {String(label).toLowerCase()}</b>
              <b>{money(total as number)}</b>
            </div>
          </div>
        ))}
      </div>
      <div className="net-band">
        <div>
          <small>NET PAY</small>
          <p>Your take-home salary</p>
        </div>
        <strong>{money(t.net)}</strong>
      </div>
      <p className="in-words">{amountWords(t.net)}</p>
      <div className="employer-line">
        <b>Employer contributions</b>
        <span>
          EPF {money(p.employerEpf)} · EPS {money(p.employerEps)} · Total{" "}
          {money(t.employer)}
        </span>
      </div>
      <footer>
        This is a computer generated salary slip. No signature is required.
      </footer>
    </article>
  );
}
