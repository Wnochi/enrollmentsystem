import { ArrowRight, Check, CircleCheck, ClipboardCheck, CreditCard, FolderOpen, Headphones, MapPin, ScanLine, TriangleAlert } from "lucide-react";

interface Props {
  userType: "student" | "freshman";
  enrollmentStep: number;
  onContinue: () => void;
  onViewConfirmed?: () => void;
}

const steps = [
  { n: 1, label: "Forms & Academic Slips" },
  { n: 2, label: "Registrar Requirements" },
  { n: 3, label: "Assessment & Insurance" },
  { n: 4, label: "Student Support Offices" },
  { n: 5, label: "School ID Processing" },
  { n: 6, label: "Enrollment Form Release" },
];

const announcements = [
  { title: "Enrollment Period Open", body: "2nd Semester enrollment runs from Jan 6 to Jan 20, 2026. Complete all steps to secure your slot.", tag: "Notice", date: "Jan 6, 2026", color: "var(--blue)", bg: "var(--blue-light)" },
  { title: "Insurance Fee: ₱125.00", body: "All students must pay the mandatory student insurance fee at the Cashier's Office or designated collection point.", tag: "Fee", date: "Jan 6, 2026", color: "var(--warning)", bg: "var(--warning-bg)" },
  { title: "Medical Clearance Required", body: "Bring your chest X-ray (within last 6 months) and medical certificate to Medical Services.", tag: "Reminder", date: "Jan 4, 2026", color: "var(--success)", bg: "var(--success-bg)" },
];

const StatusBadge = ({ status }: { status: string }) => {
  const map: Record<string, { bg: string; color: string; dot: string }> = {
    "In Progress": { bg: "var(--blue-light)", color: "var(--blue)", dot: "var(--blue)" },
    "Pending": { bg: "#F1F5F9", color: "#64748B", dot: "#94A3B8" },
    "Completed": { bg: "var(--success-bg)", color: "var(--success)", dot: "var(--success)" },
    "Action Required": { bg: "var(--warning-bg)", color: "var(--warning)", dot: "var(--warning)" },
  };
  const s = map[status] ?? map["Pending"];
  return (
    <span className="badge" style={{ background: s.bg, color: s.color }}>
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: s.dot, display: "inline-block", flexShrink: 0 }} />
      {status}
    </span>
  );
};

export default function StudentDashboard({ userType, enrollmentStep, onContinue, onViewConfirmed }: Props) {
  const name = userType === "freshman" ? null : "Cyrus";
  const completedSteps = enrollmentStep - 1;

  const officeStatuses = [
    { office: "Registrar", status: enrollmentStep >= 3 ? "Cleared" : enrollmentStep === 2 ? "Under Review" : "Not Started" },
    { office: "OSAS", status: enrollmentStep >= 5 ? "Cleared" : enrollmentStep === 4 ? "Submitted" : "Not Started" },
    { office: "Guidance", status: enrollmentStep >= 5 ? "Cleared" : enrollmentStep === 4 ? "Submitted" : "Not Started" },
    { office: "Medical", status: enrollmentStep >= 5 ? "Cleared" : enrollmentStep === 4 ? "Action Required" : "Not Started" },
    { office: "Cashier", status: enrollmentStep >= 4 ? "Cleared" : enrollmentStep === 3 ? "Ready for Payment" : "Not Started" },
    { office: "ICT-MIS", status: enrollmentStep >= 6 ? "Processing" : "Not Started" },
  ];

  const officeColor: Record<string, { bg: string; color: string }> = {
    "Cleared": { bg: "var(--success-bg)", color: "var(--success)" },
    "Under Review": { bg: "var(--warning-bg)", color: "var(--warning)" },
    "Submitted": { bg: "var(--blue-light)", color: "var(--blue)" },
    "Action Required": { bg: "var(--danger-bg)", color: "var(--danger)" },
    "Ready for Payment": { bg: "#FEF9C3", color: "#B45309" },
    "Processing": { bg: "#F0FDF4", color: "#166534" },
    "Not Started": { bg: "#F1F5F9", color: "#64748B" },
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Greeting */}
      <div className="flex items-start justify-between">
        <div>
          <h1 style={{ fontFamily: "'DM Sans', sans-serif", fontWeight: 700, fontSize: 26, color: "var(--text-primary)", letterSpacing: "-0.02em" }}>
            Hello, {name ?? "Student"}
          </h1>
          <p style={{ color: "var(--text-secondary)", fontSize: 14, marginTop: 4 }}>
            {userType === "freshman" ? "Welcome! Start your freshman enrollment below." : "Welcome back. Continue your enrollment for this semester."}
          </p>
        </div>
        <button className="btn-primary flex items-center gap-2" onClick={onContinue}>
          <ArrowRight size={18} strokeWidth={2} aria-hidden="true" />
          Continue Enrollment
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: "Enrollment Status", value: enrollmentStep < 6 ? "In Progress" : "Completed", Icon: ClipboardCheck, color: "var(--blue)", bg: "var(--blue-light)" },
          { label: "Current Step", value: `Step ${enrollmentStep} of 6`, Icon: MapPin, color: "#7C3AED", bg: "#F5F3FF" },
          { label: "Steps Completed", value: `${completedSteps} / 6`, Icon: CircleCheck, color: "var(--success)", bg: "var(--success-bg)" },
          { label: "Pending Actions", value: enrollmentStep <= 3 ? "3 required" : "1 required", Icon: TriangleAlert, color: "var(--warning)", bg: "var(--warning-bg)" },
        ].map((card, i) => (
          <div key={i} className="card flex items-start gap-3 shadow-sm">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 text-lg" style={{ background: card.bg }}>
              <card.Icon size={21} strokeWidth={2} style={{ color: card.color }} aria-hidden="true" />
            </div>
            <div>
              <div style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 500 }}>{card.label}</div>
              <div style={{ fontSize: 17, fontWeight: 700, color: card.color, fontFamily: "'DM Sans', sans-serif", marginTop: 2 }}>{card.value}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Enrollment Progress */}
        <div className="col-span-2 space-y-4">
          <div className="card shadow-sm">
            <div className="flex items-center justify-between mb-5">
              <h3 style={{ fontFamily: "'DM Sans', sans-serif", fontWeight: 700, fontSize: 16, color: "var(--text-primary)" }}>Enrollment Progress</h3>
              <StatusBadge status={enrollmentStep < 6 ? "In Progress" : "Completed"} />
            </div>

            <div className="space-y-3">
              {steps.map((step) => {
                const done = step.n < enrollmentStep;
                const current = step.n === enrollmentStep;
                const upcoming = step.n > enrollmentStep;
                return (
                  <div key={step.n} className="flex items-center gap-3 p-3 rounded-xl" style={{ background: current ? "var(--blue-light)" : "var(--surface)", border: current ? "1px solid var(--blue-mid)" : "1px solid transparent" }}>
                    <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-bold" style={{ background: done ? "var(--success)" : current ? "var(--blue)" : "var(--border)", color: done || current ? "#fff" : "var(--text-muted)" }}>
                      {done ? <Check size={17} strokeWidth={2.5} aria-hidden="true" /> : step.n}
                    </div>
                    <div className="flex-1">
                      <div style={{ fontSize: 14, fontWeight: current ? 600 : 500, color: upcoming ? "var(--text-muted)" : "var(--text-primary)" }}>{step.label}</div>
                      {current && <div style={{ fontSize: 12, color: "var(--blue)", marginTop: 1 }}>Currently active — action required</div>}
                      {done && <div style={{ fontSize: 12, color: "var(--success)", marginTop: 1 }}>Completed</div>}
                    </div>
                    {done && <span className="badge" style={{ background: "var(--success-bg)", color: "var(--success)" }}>Done</span>}
                    {current && <span className="badge" style={{ background: "var(--blue-light)", color: "var(--blue)" }}>Current</span>}
                    {upcoming && <span className="badge" style={{ background: "#F1F5F9", color: "#94A3B8" }}>Upcoming</span>}
                  </div>
                );
              })}
            </div>

            <button className="btn-primary w-full mt-5" onClick={onContinue}>
              Continue — Step {enrollmentStep}: {steps[enrollmentStep - 1]?.label}
            </button>
          </div>

          {/* Office Clearances */}
          <div className="card shadow-sm">
            <h3 style={{ fontFamily: "'DM Sans', sans-serif", fontWeight: 700, fontSize: 16, color: "var(--text-primary)", marginBottom: 16 }}>Office Clearances</h3>
            <div className="grid grid-cols-3 gap-3">
              {officeStatuses.map((o, i) => {
                const c = officeColor[o.status] ?? { bg: "#F1F5F9", color: "#64748B" };
                return (
                  <div key={i} className="rounded-xl p-3 flex flex-col gap-2" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{o.office}</div>
                    <span className="badge" style={{ background: c.bg, color: c.color, fontSize: 11 }}>{o.status}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Column */}
        <div className="space-y-4">
          {/* Quick Actions */}
          <div className="card shadow-sm">
            <h3 style={{ fontFamily: "'DM Sans', sans-serif", fontWeight: 700, fontSize: 15, color: "var(--text-primary)", marginBottom: 14 }}>Quick Access</h3>
            <div className="space-y-2">
              {[
                { Icon: FolderOpen, label: "My Documents", sub: "Upload and manage files", color: "var(--navy)", bg: "var(--navy-light)" },
                { Icon: Headphones, label: "Student Support", sub: "OSAS, Guidance, Medical", color: "var(--navy)", bg: "var(--navy-light)" },
                { Icon: CreditCard, label: "Insurance Payment", sub: "₱125.00 due", color: "var(--blue)", bg: "var(--blue-light)" },
                { Icon: ScanLine, label: "School ID Status", sub: "ICT-MIS processing", color: "var(--navy)", bg: "var(--navy-light)" },
              ].map((a, i) => (
                <button key={i} className="w-full flex items-center gap-3 p-3 rounded-xl text-left" style={{ background: "var(--surface)", border: "1px solid var(--border)", cursor: "pointer" }}
                  onClick={onContinue}>
                  <span className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: a.bg }}>
                    <a.Icon size={20} strokeWidth={2} style={{ color: a.color }} aria-hidden="true" />
                  </span>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{a.label}</div>
                    <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{a.sub}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Announcements */}
          <div className="card shadow-sm">
            <h3 style={{ fontFamily: "'DM Sans', sans-serif", fontWeight: 700, fontSize: 15, color: "var(--text-primary)", marginBottom: 14 }}>Announcements</h3>
            <div className="space-y-3">
              {announcements.map((a, i) => (
                <div key={i} className="p-3 rounded-xl" style={{ background: a.bg, border: `1px solid ${a.color}22` }}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="badge" style={{ background: `${a.color}22`, color: a.color, fontSize: 10 }}>{a.tag}</span>
                    <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{a.date}</span>
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{a.title}</div>
                  <p style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 3, lineHeight: 1.5 }}>{a.body}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
