"use client";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import {
  ArrowDown,
  ArrowDownToLine,
  ArrowRight,
  ArrowUpRight,
  Bell,
  Building2,
  CalendarDays,
  Check,
  CheckCheck,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  Download,
  FileCheck2,
  FileSpreadsheet,
  FileText,
  FolderOpen,
  LayoutDashboard,
  Leaf,
  Mail,
  MessageCircle,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  Upload,
  Users,
  Wallet,
  X,
} from "lucide-react";
import {
  BRANCHES,
  DEFAULT_COMPANY,
  DEDUCTIONS,
  EARNINGS,
  NUMERIC_FIELDS,
  blankPayroll,
  currentMonth,
  demoPayroll,
  money,
  monthLabel,
  payrollKey,
  totals,
  validatePayroll,
  type Payroll,
  type Company,
  type NumericKey,
} from "@/lib/payroll";
import { downloadCsv, parsePayrollCsv } from "@/lib/csv";
import { downloadPdf, downloadZip, shareWhatsapp } from "@/lib/pdf";
import SlipPreview from "./slip-preview";
type View = "payroll" | "leaves" | "branches" | "settings";
type ImportData = { rows: Payroll[]; errors: string[]; filename: string };
const STORE = "kalsi-payroll-v1";
const initials = (name: string) =>
  name
    .split(" ")
    .map((s) => s[0])
    .slice(0, 2)
    .join("");
function Modal({
  title,
  description,
  onClose,
  children,
  wide = false,
}: {
  title: string;
  description?: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    d?.showModal();
    return () => d?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className={`modal ${wide ? "modal-wide" : ""}`}
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-heading">
        <div>
          <h2>{title}</h2>
          {description && <p>{description}</p>}
        </div>
        <button
          className="icon-button"
          aria-label="Close dialog"
          onClick={onClose}
        >
          <X size={20} />
        </button>
      </div>
      {children}
    </dialog>
  );
}
export default function Dashboard() {
  const [view, setView] = useState<View>("payroll"),
    [month, setMonth] = useState("2026-10"),
    [records, setRecords] = useState<Payroll[]>([]),
    [company, setCompany] = useState(DEFAULT_COMPANY),
    [loaded, setLoaded] = useState(false),
    [demo, setDemo] = useState(true);
  const [search, setSearch] = useState(""),
    [branch, setBranch] = useState("all"),
    [status, setStatus] = useState("all"),
    [leaveOnly, setLeaveOnly] = useState(false),
    [selected, setSelected] = useState<string[]>([]),
    [page, setPage] = useState(1);
  const [edit, setEdit] = useState<Payroll | null>(null),
    [preview, setPreview] = useState<Payroll | null>(null),
    [importOpen, setImportOpen] = useState(false),
    [importData, setImportData] = useState<ImportData | null>(null),
    [toast, setToast] = useState(""),
    [busy, setBusy] = useState(false),
    [help, setHelp] = useState(false),
    [clearOpen, setClearOpen] = useState(false),
    [deleteRow, setDeleteRow] = useState<Payroll | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const m = currentMonth();
    setMonth(m);
    try {
      const raw = localStorage.getItem(STORE);
      if (raw) {
        const data = JSON.parse(raw);
        if (
          !Array.isArray(data.records) ||
          typeof data.company?.name !== "string" ||
          typeof data.company?.address !== "string" ||
          typeof data.company?.cin !== "string" ||
          typeof data.company?.email !== "string" ||
          data.records.some((p: Payroll) => validatePayroll(p).length)
        )
          throw Error();
        setRecords(data.records);
        setCompany(data.company);
        setDemo(Boolean(data.demo));
      } else setRecords(demoPayroll(m));
    } catch {
      setRecords(demoPayroll(m));
      setToast("Saved data could not be read. Sample data has been loaded.");
    }
    setLoaded(true);
  }, []);
  useEffect(() => {
    if (loaded)
      try {
        localStorage.setItem(STORE, JSON.stringify({ records, company, demo }));
      } catch {
        setToast(
          "Browser storage is full or unavailable. Download a CSV backup before leaving.",
        );
      }
  }, [records, company, demo, loaded]);
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(""), 6500);
      return () => clearTimeout(timer);
    }
  }, [toast]);
  useEffect(() => {
    setPage(1);
    setSelected([]);
  }, [month, search, branch, status, leaveOnly, view]);
  const monthly = useMemo(
    () => records.filter((p) => p.month === month),
    [records, month],
  );
  const filtered = useMemo(
    () =>
      monthly.filter(
        (p) =>
          (branch === "all" || p.branch === branch) &&
          (status === "all" ||
            (status === "generated" ? p.generated : !p.generated)) &&
          (!leaveOnly || p.earnedLeaves > 0) &&
          `${p.name} ${p.employeeCode}`
            .toLowerCase()
            .includes(search.toLowerCase()),
      ),
    [monthly, branch, status, leaveOnly, search],
  );
  const total = monthly.reduce((s, p) => s + totals(p).net, 0),
    deducted = monthly.reduce((s, p) => s + totals(p).deductions, 0),
    generated = monthly.filter((p) => p.generated).length;
  const pageCount = Math.max(1, Math.ceil(filtered.length / 8)),
    shown = filtered.slice(
      (Math.min(page, pageCount) - 1) * 8,
      Math.min(page, pageCount) * 8,
    );
  const chosen = selected.length
    ? filtered.filter((p) => selected.includes(p.id))
    : filtered;
  const navigate = (v: View) => {
    setView(v);
    setBranch("all");
    setStatus("all");
    setSearch("");
    setLeaveOnly(false);
  };
  async function share(rows: Payroll[]) {
    if (!rows.length) return;
    setBusy(true);
    try {
      await shareWhatsapp(rows, company);
    } catch {
      setToast("WhatsApp share failed. Please try again.");
    } finally {
      setBusy(false);
    }
  }
  async function generate(rows: Payroll[], zip = false) {
    if (!rows.length) return;
    setBusy(true);
    try {
      if (zip) await downloadZip(rows, company, month);
      else await downloadPdf(rows[0], company);
      const ids = new Set(rows.map((p) => p.id));
      setRecords((prev) =>
        prev.map((p) => (ids.has(p.id) ? { ...p, generated: true } : p)),
      );
      setToast(
        `${rows.length} salary slip${rows.length > 1 ? "s" : ""} downloaded successfully.`,
      );
    } catch {
      setToast("Download failed. Please try again.");
    } finally {
      setBusy(false);
    }
  }
  function saveEmployee(p: Payroll) {
    const duplicate = records.find(
      (r) => payrollKey(r) === payrollKey(p) && r.id !== p.id,
    );
    if (duplicate)
      return "This employee already has a slip for this month. Edit the existing entry.";
    const saved = { ...p, id: p.id || crypto.randomUUID(), generated: false };
    setRecords((prev) =>
      p.id ? prev.map((r) => (r.id === p.id ? saved : r)) : [saved, ...prev],
    );
    setMonth(p.month);
    setEdit(null);
    setToast("Employee payroll saved. Your salary slip is ready to download.");
    return "";
  }
  async function readFile(file?: File) {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setImportData({
        rows: [],
        errors: ["File must be smaller than 5 MB."],
        filename: file.name,
      });
      return;
    }
    if (!file.name.toLowerCase().endsWith(".csv")) {
      setImportData({
        rows: [],
        errors: ["Please choose a .csv file."],
        filename: file.name,
      });
      return;
    }
    try {
      const result = parsePayrollCsv(await file.text(), month);
      setImportData({ ...result, filename: file.name });
    } catch (error) {
      console.error("CSV import failed", error);
      setImportData({
        rows: [],
        errors: ["This file could not be read. Please try the sample CSV."],
        filename: file.name,
      });
    }
  }
  function commitImport() {
    if (!importData || importData.errors.length) return;
    const sampleImport = importData.rows.every((p) =>
      p.email.toLowerCase().endsWith("@example.com"),
    );
    const incoming = new Map(
      importData.rows.map((p) => [
        payrollKey(p),
        { ...p, id: `${sampleImport ? "demo-" : ""}${crypto.randomUUID()}` },
      ]),
    );
    setRecords((prev) => [
      ...prev.filter(
        (p) =>
          !incoming.has(payrollKey(p)) && (!demo || !p.id.startsWith("demo-")),
      ),
      ...incoming.values(),
    ]);
    setDemo(sampleImport);
    setMonth(importData.rows[0].month);
    setImportOpen(false);
    setImportData(null);
    setToast(
      `${incoming.size} payroll entries imported. Existing employee/month matches were updated.`,
    );
  }
  const sample = () =>
    downloadCsv(demoPayroll(month).slice(0, 3), "salary-upload-sample.csv");
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            navigate("payroll");
          }}
        >
          <div className="brand-mark">
            K<span> /</span>
          </div>
          <div>
            KALSI<span>PEOPLE & PAYROLL</span>
          </div>
        </a>
        <div className="workspace-label">WORKSPACE</div>
        <nav>
          {(
            [
              {
                id: "payroll",
                label: "Payroll overview",
                icon: LayoutDashboard,
              },
              { id: "leaves", label: "Earned leaves", icon: Leaf },
              { id: "branches", label: "Branches", icon: Building2 },
            ] as const
          ).map((item) => (
            <button
              key={item.id}
              onClick={() => navigate(item.id)}
              className={view === item.id ? "nav-active" : ""}
            >
              <item.icon size={19} />
              <span>{item.label}</span>
              {item.id === "payroll" ? (
                <span className="nav-count">{monthly.length}</span>
              ) : item.id === "branches" ? (
                <span className="nav-count muted">16</span>
              ) : null}
            </button>
          ))}
        </nav>
        <div className="sidebar-divider" />
        <button
          className={`settings-nav ${view === "settings" ? "nav-active" : ""}`}
          onClick={() => navigate("settings")}
        >
          <Settings2 size={19} />
          Company settings
        </button>
        <div className="sidebar-bottom">
          <button className="help-button" onClick={() => setHelp(true)}>
            <CircleHelp size={18} />
            Help & getting started
            <ArrowUpRight size={15} />
          </button>
          <div className="profile">
            <div className="avatar profile-avatar">HR</div>
            <div>
              <b>HR workspace</b>
              <small>Payroll administrator</small>
            </div>
            <span className="online-dot" />
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            Workspace <ChevronRight size={14} />
            <strong>
              {view === "payroll"
                ? "Payroll overview"
                : view === "leaves"
                  ? "Earned leaves"
                  : view === "branches"
                    ? "Branches"
                    : "Company settings"}
            </strong>
          </div>
          <div className="topbar-right">
            <button
              className="icon-button"
              aria-label="Payroll help"
              onClick={() => setHelp(true)}
            >
              <CircleHelp size={19} />
            </button>
            <div className="mini-avatar">HR</div>
          </div>
        </header>
        <main>
          <div className="page-title">
            <div>
              <div className="eyebrow">PEOPLE OPERATIONS</div>
              <h1>
                {view === "payroll"
                  ? "A good month starts here."
                  : view === "leaves"
                    ? "A little time, accounted for."
                    : view === "branches"
                      ? "Every team. Every location."
                      : "Make it your workspace."}
              </h1>
              <p>
                {view === "payroll"
                  ? "Your people work hard. Make payday the easy part."
                  : view === "leaves"
                    ? "Track earned leave and leave income, employee by employee."
                    : view === "branches"
                      ? "One payroll workspace for all 16 branches."
                      : "Company details appear on every salary slip you generate."}
              </p>
            </div>
            {view !== "settings" && (
              <div className="month-picker">
                <CalendarDays size={17} />
                <label htmlFor="payroll-month" className="sr-only">
                  Payroll month
                </label>
                <input
                  id="payroll-month"
                  type="month"
                  min="2000-01"
                  max="2100-12"
                  value={month}
                  onChange={(e) => {
                    if (/^\d{4}-(0[1-9]|1[0-2])$/.test(e.target.value))
                      setMonth(e.target.value);
                  }}
                />
              </div>
            )}
          </div>
          {view === "payroll" && (
            <>
              <section className="hero-panel">
                <div className="hero-content">
                  <div className="hero-kicker">
                    <span /> {monthLabel(month).toUpperCase()} PAYROLL
                  </div>
                  <h2>
                    Less paperwork.
                    <br />
                    More peace of mind.
                  </h2>
                  <p>
                    Create one salary slip or take care of the whole team.
                    <br className="desktop-break" /> Everything you need, in one
                    place.
                  </p>
                  <div className="hero-actions">
                    <button
                      className="button hero-button"
                      onClick={() => setEdit(blankPayroll(month))}
                    >
                      <Plus size={17} />
                      Create salary slip
                    </button>
                    <button
                      className="hero-link"
                      onClick={() => {
                        setImportOpen(true);
                        setImportData(null);
                      }}
                    >
                      Upload CSV
                      <ArrowUpRight size={17} />
                    </button>
                  </div>
                </div>
                <div className="hero-art" aria-hidden="true">
                  <div className="art-orbit orbit-one" />
                  <div className="art-orbit orbit-two" />
                  <div className="art-dots" />
                  <div className="art-leaf leaf-one" />
                  <div className="art-leaf leaf-two" />
                  <div className="art-paper">
                    <div className="art-paper-top">
                      <span>K /</span>
                      <small>SALARY SLIP</small>
                    </div>
                    <div className="art-line wide" />
                    <div className="art-line" />
                    <div className="art-rule" />
                    <div className="art-pay">
                      <small>NET PAY</small>
                      <b>
                        ₹32,500<span>.00</span>
                      </b>
                    </div>
                    <div className="art-line wide" />
                    <div className="art-line" />
                    <div className="art-bottom">
                      <Check size={12} /> Ready for payday
                    </div>
                  </div>
                  <div className="art-check">
                    <Check size={24} />
                  </div>
                  <div className="art-tag">
                    <ShieldCheck size={15} />A little care, every payday.
                  </div>
                </div>
              </section>
              <section className="stats-grid">
                <Stat
                  label="Total employees"
                  value={String(monthly.length).padStart(2, "0")}
                  note={`${new Set(monthly.map((p) => p.branch)).size} active branches this month`}
                  icon={<Users size={19} />}
                  tint="sage"
                />
                <Stat
                  label="Net payroll"
                  value={money(total)}
                  note="Total take-home across your team"
                  icon={<Wallet size={19} />}
                  tint="sand"
                />
                <Stat
                  label="Total deductions"
                  value={money(deducted)}
                  note="PF, ESIC, advances & more"
                  icon={<ArrowDown size={19} />}
                  tint="peach"
                />
                <Stat
                  label="Slips generated"
                  value={`${String(generated).padStart(2, "0")} / ${String(monthly.length).padStart(2, "0")}`}
                  note={
                    generated === monthly.length && monthly.length
                      ? "All set. Payday is ready."
                      : `${monthly.length - generated} salary slips ready to generate`
                  }
                  icon={<FileCheck2 size={19} />}
                  tint="lavender"
                />
              </section>
            </>
          )}
          {(view === "payroll" || view === "leaves") && (
            <section className="table-panel">
              <div className="table-title">
                <div>
                  <h2>
                    {view === "leaves"
                      ? "Earned leave register"
                      : "Employee payroll"}
                    <span className="count-badge">{monthly.length}</span>
                  </h2>
                  <p>
                    {view === "leaves"
                      ? "Leave balances and payouts for the selected month."
                      : `Manage salary slips for ${monthLabel(month)}.`}
                  </p>
                </div>
                <div className="table-title-actions">
                  <button className="button button-light" onClick={sample}>
                    <Download size={15} />
                    <span>Sample CSV</span>
                  </button>
                  <button
                    className="button button-light"
                    onClick={() => {
                      setImportOpen(true);
                      setImportData(null);
                    }}
                  >
                    <Upload size={15} />
                    <span>Upload CSV</span>
                  </button>
                  <button
                    className="button button-light"
                    style={{ color: "#128c4b" }}
                    disabled={busy || !chosen.length}
                    onClick={() => share(chosen)}
                  >
                    <MessageCircle size={15} />
                    <span>
                      {selected.length
                        ? `WhatsApp ${chosen.length} slips`
                        : "Share all on WhatsApp"}
                    </span>
                  </button>
                  <button
                    className="button button-primary"
                    disabled={busy || !chosen.length}
                    onClick={() => generate(chosen, true)}
                  >
                    <ArrowDownToLine size={15} />
                    {busy
                      ? "Preparing…"
                      : selected.length
                        ? `Download ${chosen.length} slips`
                        : "Download all slips"}
                  </button>
                </div>
              </div>
              <div className="filterbar">
                <div className="search-input">
                  <Search size={17} />
                  <input
                    aria-label="Search employee name or code"
                    placeholder="Search employee name or code…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                  {search && (
                    <button
                      aria-label="Clear search"
                      onClick={() => setSearch("")}
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
                <div className="filter-select">
                  <Building2 size={15} />
                  <select
                    aria-label="Filter by branch"
                    value={branch}
                    onChange={(e) => setBranch(e.target.value)}
                  >
                    <option value="all">All branches</option>
                    {BRANCHES.map((b) => (
                      <option key={b}>{b}</option>
                    ))}
                  </select>
                  <ChevronDown size={13} />
                </div>
                {view === "payroll" ? (
                  <div className="filter-select">
                    <SlidersHorizontal size={15} />
                    <select
                      aria-label="Filter by slip status"
                      value={status}
                      onChange={(e) => setStatus(e.target.value)}
                    >
                      <option value="all">All statuses</option>
                      <option value="draft">Ready to generate</option>
                      <option value="generated">Generated</option>
                    </select>
                    <ChevronDown size={13} />
                  </div>
                ) : (
                  <label className="leave-toggle">
                    <input
                      type="checkbox"
                      checked={leaveOnly}
                      onChange={(e) => setLeaveOnly(e.target.checked)}
                    />
                    With earned leave only
                  </label>
                )}
                <span className="results-count">
                  {filtered.length} employees
                </span>
              </div>
              {demo && (
                <div className="demo-notice">
                  <Sparkles size={14} />
                  <span>
                    You’re viewing sample data. Add your employees or upload a
                    CSV to get started.
                  </span>
                  <button onClick={() => setClearOpen(true)}>
                    Clear sample data
                    <ArrowRight size={13} />
                  </button>
                </div>
              )}
              <div className="table-scroll">
                <table className="payroll-table">
                  <thead>
                    <tr>
                      <th className="checkbox-cell">
                        <input
                          type="checkbox"
                          aria-label="Select all filtered employees"
                          checked={
                            !!filtered.length &&
                            filtered.every((p) => selected.includes(p.id))
                          }
                          onChange={(e) =>
                            setSelected(
                              e.target.checked ? filtered.map((p) => p.id) : [],
                            )
                          }
                        />
                      </th>
                      <th>EMPLOYEE</th>
                      <th>BRANCH</th>
                      {view === "leaves" ? (
                        <>
                          <th className="align-right">PRESENT DAYS</th>
                          <th className="align-right">EARNED LEAVE</th>
                          <th className="align-right">LEAVE INCOME</th>
                        </>
                      ) : (
                        <>
                          <th className="align-right">GROSS PAY</th>
                          <th className="align-right">DEDUCTIONS</th>
                          <th className="align-right">NET PAY</th>
                        </>
                      )}
                      <th>STATUS</th>
                      <th className="align-right">ACTIONS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {shown.map((p, i) => (
                      <tr key={p.id}>
                        <td className="checkbox-cell">
                          <input
                            type="checkbox"
                            aria-label={`Select ${p.name}`}
                            checked={selected.includes(p.id)}
                            onChange={(e) =>
                              setSelected((prev) =>
                                e.target.checked
                                  ? [...prev, p.id]
                                  : prev.filter((id) => id !== p.id),
                              )
                            }
                          />
                        </td>
                        <td>
                          <div className="employee-cell">
                            <div className={`avatar avatar-${i % 5}`}>
                              {initials(p.name)}
                            </div>
                            <button
                              className="employee-name"
                              onClick={() => setPreview(p)}
                            >
                              <b>{p.name}</b>
                              <small>
                                {p.employeeCode} <span>·</span>{" "}
                                {p.designation || "Employee"}
                              </small>
                            </button>
                          </div>
                        </td>
                        <td>
                          <span className="branch-name">{p.branch}</span>
                        </td>
                        {view === "leaves" ? (
                          <>
                            <td className="align-right tabular">
                              {p.presentDays} days
                            </td>
                            <td className="align-right">
                              <span
                                className={`leave-days ${p.earnedLeaves > 0 ? "has-leaves" : ""}`}
                              >
                                {p.earnedLeaves} days
                              </span>
                            </td>
                            <td className="align-right net-amount">
                              {money(p.elIncome)}
                            </td>
                          </>
                        ) : (
                          <>
                            <td className="align-right tabular">
                              {money(totals(p).earnings)}
                            </td>
                            <td className="align-right tabular deduction-amount">
                              {money(totals(p).deductions)}
                            </td>
                            <td className="align-right net-amount">
                              {money(totals(p).net)}
                            </td>
                          </>
                        )}
                        <td>
                          <span
                            className={`status-pill ${p.generated ? "status-generated" : "status-ready"}`}
                          >
                            <i />
                            {p.generated ? "Generated" : "Ready"}
                          </span>
                        </td>
                        <td>
                          <div className="row-actions">
                            <button
                              title="Preview salary slip"
                              aria-label={`Preview ${p.employeeCode}`}
                              onClick={() => setPreview(p)}
                            >
                              <FileText size={16} />
                            </button>
                            <button
                              title="Edit payroll"
                              aria-label={`Edit ${p.employeeCode}`}
                              onClick={() => setEdit({ ...p })}
                            >
                              <Pencil size={15} />
                            </button>
                            <button
                              title="Download PDF"
                              disabled={busy}
                              aria-label={`Download ${p.employeeCode}`}
                              onClick={() => generate([p])}
                            >
                              <Download size={16} />
                            </button>
                            <button
                              title="Share on WhatsApp"
                              disabled={busy}
                              aria-label={`Share ${p.employeeCode} on WhatsApp`}
                              style={{ color: "#128c4b" }}
                              onClick={() => share([p])}
                            >
                              <MessageCircle size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {!filtered.length && (
                  <div className="empty-state">
                    <FolderOpen size={36} />
                    <h3>
                      {monthly.length
                        ? "No matching employees"
                        : "A fresh start for this month"}
                    </h3>
                    <p>
                      {monthly.length
                        ? "Try another branch, name or employee code."
                        : "Add an employee or upload your monthly payroll CSV."}
                    </p>
                    <button
                      className="button button-primary"
                      onClick={() =>
                        monthly.length
                          ? (setSearch(""),
                            setBranch("all"),
                            setStatus("all"),
                            setLeaveOnly(false))
                          : setEdit(blankPayroll(month))
                      }
                    >
                      {monthly.length ? "Clear filters" : "Add first employee"}
                    </button>
                  </div>
                )}
              </div>
              <div className="table-footer">
                <span>
                  {selected.length ? `${selected.length} selected · ` : ""}
                  Showing{" "}
                  {filtered.length
                    ? (Math.min(page, pageCount) - 1) * 8 + 1
                    : 0}
                  –{Math.min(Math.min(page, pageCount) * 8, filtered.length)} of{" "}
                  {filtered.length} employees
                </span>
                <div>
                  <span>
                    Page {Math.min(page, pageCount)} of {pageCount}
                  </span>
                  <button
                    className="icon-button"
                    aria-label="Previous page"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => p - 1)}
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <button
                    className="icon-button"
                    aria-label="Next page"
                    disabled={page >= pageCount}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            </section>
          )}
          {view === "branches" && (
            <section className="branch-grid">
              {BRANCHES.map((b, i) => {
                const people = monthly.filter((p) => p.branch === b);
                return (
                  <button
                    className="branch-card"
                    key={b}
                    onClick={() => {
                      navigate("payroll");
                      setBranch(b);
                    }}
                  >
                    <div className="branch-card-top">
                      <span className="branch-icon">
                        <Building2 size={22} />
                      </span>
                      <span>
                        {String(i + 1).padStart(2, "0")}
                        <ArrowUpRight size={17} />
                      </span>
                    </div>
                    <h3>{b}</h3>
                    <p>
                      {people.length} employees ·{" "}
                      {money(people.reduce((s, p) => s + totals(p).net, 0))}
                    </p>
                    <div className="branch-card-bottom">
                      View branch payroll
                      <ArrowRight size={16} />
                    </div>
                  </button>
                );
              })}
            </section>
          )}
          {view === "settings" && (
            <CompanySettings
              company={company}
              onSave={(c) => {
                setCompany(c);
                setToast("Company details updated.");
              }}
              onExport={() => downloadCsv(records, "payroll-backup.csv")}
              onClear={() => setClearOpen(true)}
            />
          )}
          {view === "payroll" && (
            <div className="bottom-cards">
              <div className="quick-tip">
                <div className="tip-icon">
                  <FileSpreadsheet size={23} />
                </div>
                <div>
                  <h3>A whole team, one upload.</h3>
                  <p>
                    Use our ready-made CSV template to get payroll done faster.
                  </p>
                </div>
                <button onClick={sample}>
                  Get the template
                  <ArrowUpRight size={16} />
                </button>
              </div>
              <div className="monthly-note">
                <div>
                  <Leaf size={22} />
                </div>
                <p>
                  A little less admin.
                  <br />
                  <b>A little more human.</b>
                </p>
                <span>✧</span>
              </div>
            </div>
          )}
          <footer className="page-footer">
            <span>
              © {new Date().getFullYear()} {company.name} <i />
              People & Payroll
            </span>
            <span>
              <ShieldCheck size={13} />
              Saved on this device
            </span>
          </footer>
        </main>
      </div>
      {toast && (
        <div className="toast" role="status">
          <CheckCheck size={19} />
          <span>{toast}</span>
          <button
            onClick={() => setToast("")}
            aria-label="Dismiss notification"
          >
            <X size={16} />
          </button>
        </div>
      )}
      {edit && (
        <EmployeeEditor
          value={edit}
          onClose={() => setEdit(null)}
          onSave={saveEmployee}
          onDelete={
            edit.id
              ? () => {
                  setDeleteRow(edit);
                }
              : undefined
          }
        />
      )}
      {preview && (
        <Modal
          title="Salary slip preview"
          description={`${preview.employeeCode} · ${monthLabel(preview.month)}`}
          wide
          onClose={() => setPreview(null)}
        >
          <div className="preview-toolbar">
            <span>
              <ShieldCheck size={15} />
              Ready to download
            </span>
            <div>
              <button
                className="button button-light"
                onClick={() => {
                  setEdit({ ...preview });
                  setPreview(null);
                }}
              >
                <Pencil size={15} />
                Edit
              </button>
              <button
                className="button button-light"
                disabled={!preview.email}
                onClick={() => {
                  window.location.href = `mailto:${encodeURIComponent(preview.email)}?subject=${encodeURIComponent(`Salary slip - ${monthLabel(preview.month)}`)}&body=${encodeURIComponent(`Dear ${preview.name},\n\nPlease find your salary slip for ${monthLabel(preview.month)} attached.\n\nRegards,\nHR Team\n${company.name}\n\n[Please attach the downloaded PDF before sending.]`)}`;
                }}
              >
                <Mail size={15} />
                Email draft
              </button>
              <button
                className="button button-primary"
                disabled={busy}
                onClick={() => generate([preview])}
              >
                <Download size={15} />
                {busy ? "Preparing…" : "Download PDF"}
              </button>
            </div>
          </div>
          <div className="preview-container">
            <SlipPreview p={preview} company={company} />
          </div>
          <p className="modal-footnote">
            Email draft opens your mail app. Download and attach the PDF
            manually, or share it on WhatsApp.
          </p>
        </Modal>
      )}
      {importOpen && (
        <Modal
          title="A whole team, one upload."
          description="Import your monthly payroll from a CSV file."
          onClose={() => {
            setImportOpen(false);
            setImportData(null);
          }}
        >
          <div className="import-body">
            <div className="import-steps">
              <span>1</span>
              <div>
                <b>Start with the right format</b>
                <p>
                  Download the sample, replace the demo rows, and keep the
                  headers.
                </p>
              </div>
              <button className="button button-light" onClick={sample}>
                <Download size={15} />
                Sample CSV
              </button>
            </div>
            <div
              className="dropzone"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                readFile(e.dataTransfer.files[0]);
              }}
            >
              <span>
                <Upload size={25} />
              </span>
              <h3>Drop your CSV file here</h3>
              <p>or choose a file from your device · up to 5 MB</p>
              <button
                className="button button-primary"
                onClick={() => fileRef.current?.click()}
              >
                Choose CSV file
              </button>
              <input
                ref={fileRef}
                type="file"
                accept=".csv,text/csv"
                className="sr-only"
                onChange={(e) => {
                  readFile(e.target.files?.[0]);
                  e.target.value = "";
                }}
              />
            </div>
            <div className="import-info">
              <CircleHelp size={16} />
              <p>
                Required: <b>employeeCode, name, branch, basic</b>. Month
                defaults to {monthLabel(month)} if omitted. Enter amounts as
                plain numbers. Existing employee code + month matches will be
                replaced. Sample rows are removed on your first import.
              </p>
            </div>
            {importData && (
              <div
                className={`import-result ${importData.errors.length ? "import-error" : ""}`}
              >
                <h4>{importData.filename}</h4>
                {importData.errors.length ? (
                  <>
                    <p>
                      {importData.errors.length} issue(s) found. Nothing has
                      been imported.
                    </p>
                    <ul>
                      {importData.errors.slice(0, 20).map((e, i) => (
                        <li key={i}>{e}</li>
                      ))}
                    </ul>
                    {importData.errors.length > 20 && (
                      <p>…and {importData.errors.length - 20} more issues.</p>
                    )}
                  </>
                ) : (
                  <>
                    <p>
                      <Check size={15} />
                      {importData.rows.length} valid employees ·{" "}
                      {new Set(importData.rows.map((p) => p.month)).size}{" "}
                      month(s)
                    </p>
                    <p>
                      {
                        importData.rows.filter((p) =>
                          records.some((r) => payrollKey(r) === payrollKey(p)),
                        ).length
                      }{" "}
                      existing entries will be replaced.
                    </p>
                    <div className="import-preview">
                      {importData.rows.slice(0, 5).map((p) => (
                        <div key={payrollKey(p)}>
                          <b>{p.name}</b>
                          <span>
                            {p.employeeCode} · {p.branch}
                          </span>
                          <b>{money(totals(p).net)}</b>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}
            <div className="modal-actions">
              <button
                className="button button-light"
                onClick={() => setImportOpen(false)}
              >
                Cancel
              </button>
              <button
                className="button button-primary"
                disabled={
                  !importData ||
                  !!importData.errors.length ||
                  !importData.rows.length
                }
                onClick={commitImport}
              >
                <Check size={16} />
                Import payroll
              </button>
            </div>
          </div>
        </Modal>
      )}
      {help && (
        <Modal
          title="A smoother payday starts here."
          onClose={() => setHelp(false)}
        >
          <div className="help-content">
            <p>
              <b>01 · Add your people</b>Create a salary slip manually, or
              download the sample CSV, fill it in, and upload your team in one
              go.
            </p>
            <p>
              <b>02 · Review the month</b>Choose a month, filter any of the 16
              branches, or search employee codes. Earned leaves has a dedicated
              register.
            </p>
            <p>
              <b>03 · Download & share</b>Preview a slip, download a PDF, or
              download selected / filtered slips as a ZIP. Email draft opens
              your mail app; attach the PDF yourself.
            </p>
            <p>
              <b>04 · Keep a backup</b>Company settings lets you export all
              payroll as CSV regularly.
            </p>
            <div className="help-note">
              All earnings, deductions, leave payouts and employer contributions
              are entered amounts. No tax, PF, ESIC or leave-rate rules are
              automatically applied.
            </div>
          </div>
        </Modal>
      )}
      {clearOpen && (
        <Modal
          title={demo ? "Clear sample data?" : "Clear payroll?"}
          onClose={() => setClearOpen(false)}
        >
          <div className="confirm-content">
            <p>
              {demo
                ? "This removes only the demo rows. Any employees you added will stay."
                : "This removes every payroll entry stored in this browser. Download a CSV backup first if you need these records."}
            </p>
            <div className="modal-actions">
              <button
                className="button button-light"
                onClick={() => setClearOpen(false)}
              >
                Cancel
              </button>
              <button
                className="button danger-button"
                onClick={() => {
                  setRecords((prev) =>
                    demo ? prev.filter((p) => !p.id.startsWith("demo-")) : [],
                  );
                  setDemo(false);
                  setClearOpen(false);
                  setToast("Payroll cleared.");
                }}
              >
                Clear {demo ? "sample data" : "payroll"}
              </button>
            </div>
          </div>
        </Modal>
      )}
      {deleteRow && (
        <Modal
          title="Delete this payroll entry?"
          onClose={() => setDeleteRow(null)}
        >
          <div className="confirm-content">
            <p>
              {deleteRow.name} · {deleteRow.employeeCode} ·{" "}
              {monthLabel(deleteRow.month)} will be removed from this browser.
            </p>
            <div className="modal-actions">
              <button
                className="button button-light"
                onClick={() => setDeleteRow(null)}
              >
                Cancel
              </button>
              <button
                className="button danger-button"
                onClick={() => {
                  setRecords((prev) =>
                    prev.filter((p) => p.id !== deleteRow.id),
                  );
                  setDeleteRow(null);
                  setEdit(null);
                  setToast("Payroll entry deleted.");
                }}
              >
                Delete entry
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
function Stat({
  label,
  value,
  note,
  icon,
  tint,
}: {
  label: string;
  value: string;
  note: string;
  icon: ReactNode;
  tint: string;
}) {
  return (
    <div className="stat-card">
      <div className="stat-top">
        <span>{label}</span>
        <div className={`stat-icon ${tint}`}>{icon}</div>
      </div>
      <strong>{value}</strong>
      <p>{note}</p>
    </div>
  );
}
function EmployeeEditor({
  value,
  onClose,
  onSave,
  onDelete,
}: {
  value: Payroll;
  onClose: () => void;
  onSave: (p: Payroll) => string;
  onDelete?: () => void;
}) {
  const [p, setP] = useState(value),
    [tab, setTab] = useState("Employee"),
    [errors, setErrors] = useState<string[]>([]);
  const change = (key: keyof Payroll, value: string | number) =>
    setP((prev) => ({ ...prev, [key]: value }));
  function submit(e: FormEvent) {
    e.preventDefault();
    const cleaned = {
      ...p,
      name: p.name.trim(),
      employeeCode: p.employeeCode.trim().toUpperCase(),
    };
    const es = validatePayroll(cleaned);
    if (es.length) {
      setErrors(es);
      return;
    }
    const error = onSave(cleaned);
    if (error) setErrors([error]);
  }
  const field = (
    key: keyof Payroll,
    label: string,
    type = "text",
    required = false,
  ) => (
    <label className="form-field" key={key}>
      <span>
        {label}
        {required && <em>*</em>}
      </span>
      <input
        value={String(p[key])}
        type={type}
        required={required}
        min={type === "number" ? 0 : undefined}
        maxLength={type === "text" ? 100 : undefined}
        step={type === "number" ? "0.01" : undefined}
        onChange={(e) =>
          change(
            key,
            type === "number"
              ? e.target.value === ""
                ? 0
                : Number(e.target.value)
              : e.target.value,
          )
        }
      />
    </label>
  );
  return (
    <Modal
      title={p.id ? "Edit employee payroll" : "Create a salary slip"}
      description="A few details now. A smooth payday later."
      wide
      onClose={onClose}
    >
      <form onSubmit={submit}>
        <div className="editor-tabs">
          {["Employee", "Earnings", "Deductions", "Attendance & PF"].map(
            (t) => (
              <button
                type="button"
                className={tab === t ? "active" : ""}
                key={t}
                onClick={() => setTab(t)}
              >
                {t}
              </button>
            ),
          )}
        </div>
        <div className="editor-body">
          {errors.length > 0 && (
            <div className="form-errors" role="alert">
              {errors.map((e) => (
                <p key={e}>{e}</p>
              ))}
            </div>
          )}
          {tab === "Employee" && (
            <>
              <h3>Let’s start with the essentials.</h3>
              <div className="form-grid">
                {field("name", "Employee name", "text", true)}
                {field("employeeCode", "Employee code", "text", true)}
                <label className="form-field">
                  <span>
                    Branch<em>*</em>
                  </span>
                  <select
                    value={p.branch}
                    onChange={(e) => change("branch", e.target.value)}
                  >
                    {BRANCHES.map((b) => (
                      <option key={b}>{b}</option>
                    ))}
                  </select>
                </label>
                {field("month", "Salary month", "month", true)}
                {field("designation", "Designation")}
                {field("department", "Department")}
                {field("email", "Employee email", "email")}
                {field("joiningDate", "Joining date", "date")}
                {field("bank", "Bank name")}
                {field("account", "Bank account / masked account")}
                {field("pan", "PAN")}
                {field("uan", "UAN")}
                {field("pfAccount", "PF account number")}
                {field("esiNumber", "ESI number")}
                {field("pran", "PRAN")}
                {field("taxRegime", "Tax regime")}
              </div>
            </>
          )}
          {(tab === "Earnings" || tab === "Deductions") && (
            <>
              <h3>
                {tab === "Earnings"
                  ? "Every part of their hard work."
                  : "Keep every deduction clear."}
              </h3>
              <p className="form-note">
                Enter actual amounts in INR. Values are used as entered, without
                automatic proration.
              </p>
              <div className="form-grid">
                {Object.entries(tab === "Earnings" ? EARNINGS : DEDUCTIONS).map(
                  ([k, v]) => field(k as NumericKey, v, "number"),
                )}
              </div>
            </>
          )}
          {tab === "Attendance & PF" && (
            <>
              <h3>The days and details that count.</h3>
              <p className="form-note">
                Earned leaves are days; earned leave income is entered
                separately in Earnings.
              </p>
              <div className="form-grid">
                {field("presentDays", "Present days", "number")}
                {field("earnedLeaves", "Earned leave days", "number")}
                {field(
                  "employerEpf",
                  "Employer EPF contribution (INR)",
                  "number",
                )}
                {field(
                  "employerEps",
                  "Employer EPS contribution (INR)",
                  "number",
                )}
              </div>
            </>
          )}
          <div className="editor-summary">
            <span>
              Earnings <b>{money(totals(p).earnings)}</b>
            </span>
            <span>
              Deductions <b>{money(totals(p).deductions)}</b>
            </span>
            <span>
              Net pay <strong>{money(totals(p).net)}</strong>
            </span>
          </div>
        </div>
        <div className="editor-footer">
          {onDelete ? (
            <button type="button" className="delete-link" onClick={onDelete}>
              <Trash2 size={15} />
              Delete entry
            </button>
          ) : (
            <span className="form-note">
              <Check size={14} />
              Saved automatically
            </span>
          )}
          <div>
            <button
              type="button"
              className="button button-light"
              onClick={onClose}
            >
              Cancel
            </button>
            <button type="submit" className="button button-primary">
              <Check size={16} />
              Save payroll
            </button>
          </div>
        </div>
      </form>
    </Modal>
  );
}
function CompanySettings({
  company,
  onSave,
  onExport,
  onClear,
}: {
  company: Company;
  onSave: (c: Company) => void;
  onExport: () => void;
  onClear: () => void;
}) {
  const [c, setC] = useState(company);
  return (
    <section className="settings-panel">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSave(c);
        }}
      >
        <div className="settings-heading">
          <Building2 size={23} />
          <div>
            <h2>Company details</h2>
            <p>The details that make your salary slips official.</p>
          </div>
        </div>
        <div className="form-grid">
          <label className="form-field">
            <span>Company name</span>
            <input
              maxLength={70}
              required
              value={c.name}
              onChange={(e) => setC({ ...c, name: e.target.value })}
            />
          </label>
          <label className="form-field">
            <span>CIN</span>
            <input
              maxLength={35}
              value={c.cin}
              onChange={(e) => setC({ ...c, cin: e.target.value })}
            />
          </label>
          <label className="form-field full">
            <span>Company address</span>
            <textarea
              maxLength={200}
              rows={3}
              required
              value={c.address}
              onChange={(e) => setC({ ...c, address: e.target.value })}
            />
          </label>
          <label className="form-field">
            <span>HR email</span>
            <input
              maxLength={70}
              type="email"
              value={c.email}
              onChange={(e) => setC({ ...c, email: e.target.value })}
            />
          </label>
        </div>
        <button className="button button-primary">
          <Check size={16} />
          Save company details
        </button>
      </form>
      <div className="storage-settings">
        <h3>Data & backups</h3>
        <p>
          Export payroll regularly as a backup. A CSV backup can be re-imported
          from Upload CSV.
        </p>
        <div>
          <button className="button button-light" onClick={onExport}>
            <Download size={16} />
            Export all payroll (CSV)
          </button>
          <button className="delete-link" onClick={onClear}>
            <Trash2 size={15} />
            Clear payroll data
          </button>
        </div>
      </div>
    </section>
  );
}
