import { useState } from "react";

interface Props {
  role: string;
  onLogout: () => void;
}

const ROLE_META: Record<string, { title: string; icon: string; color: string; bg: string; description: string }> = {
  registrar: { title: "Registrar", icon: "📋", color: "var(--navy)", bg: "var(--navy-light)", description: "Manage student requirements, final review, and enrollment form release." },
  osas: { title: "OSAS", icon: "🎓", color: "#7C3AED", bg: "#F5F3FF", description: "Office for Student Affairs and Services — review student eligibility." },
  guidance: { title: "Guidance Services", icon: "🧠", color: "var(--info)", bg: "var(--info-bg)", description: "Review student counseling documents and grant guidance clearance." },
  medical: { title: "Medical Services", icon: "🏥", color: "var(--danger)", bg: "var(--danger-bg)", description: "Review medical clearance documents. Documents are private and restricted." },
  cashier: { title: "Cashier", icon: "💳", color: "#B45309", bg: "#FEF9C3", description: "Verify and confirm ₱125.00 student insurance payments." },
  scholarship: { title: "Scholarship & FHE", icon: "🏆", color: "var(--success)", bg: "var(--success-bg)", description: "Administer scholarships and Free Higher Education eligibility assessment." },
  ict: { title: "ICT-MIS", icon: "🖥️", color: "#7C3AED", bg: "#F5F3FF", description: "Manage school ID processing and student number assignments." },
};

const SAMPLE_STUDENTS = [
  { id: "2026-00001", name: "Gian Seth Kadusale", type: "Freshman", program: "BS Computer Science", campus: "Talisay", status: "Pending", action: "Under Review", date: "Jan 8, 2026 · 9:14 AM" },
  { id: "2026-00002", name: "Shun Archer Moncillo", type: "Continuing", program: "BS Business Administration", campus: "Talisay", status: "Cleared", action: "Cleared", date: "Jan 7, 2026 · 2:30 PM" },
  { id: "2026-00003", name: "Marfel Judith", type: "Transferee", program: "BS Criminology", campus: "Binalbagan", status: "Returned", action: "Returned for Correction", date: "Jan 7, 2026 · 11:00 AM" },
  { id: "2026-00004", name: "Edrian Sayon", type: "Freshman", program: "Bachelor of Secondary Education", campus: "Alijis", status: "Submitted", action: "Submitted", date: "Jan 8, 2026 · 8:05 AM" },
];

const statusColors: Record<string, { bg: string; color: string }> = {
  "Cleared": { bg: "var(--success-bg)", color: "var(--success)" },
  "Under Review": { bg: "#EDE9FE", color: "#7C3AED" },
  "Submitted": { bg: "var(--blue-light)", color: "var(--blue)" },
  "Returned for Correction": { bg: "var(--danger-bg)", color: "var(--danger)" },
  "Not Started": { bg: "#F1F5F9", color: "#64748B" },
  "Pending": { bg: "var(--warning-bg)", color: "var(--warning)" },
  "Confirmed": { bg: "var(--success-bg)", color: "var(--success)" },
  "Ready for Payment": { bg: "#FEF9C3", color: "#B45309" },
  "Processing": { bg: "#F5F3FF", color: "#7C3AED" },
};

function StatusBadge({ status }: { status: string }) {
  const s = statusColors[status] ?? { bg: "#F1F5F9", color: "#64748B" };
  return <span className="badge" style={{ background: s.bg, color: s.color, fontSize: 11 }}>{status}</span>;
}

function SummaryCard({ icon, label, value, color, bg }: { icon: string; label: string; value: string | number; color: string; bg: string }) {
  return (
    <div className="card flex items-center gap-4 shadow-sm">
      <div className="w-12 h-12 rounded-xl flex items-center justify-center text-xl flex-shrink-0" style={{ background: bg }}>{icon}</div>
      <div>
        <div style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 500 }}>{label}</div>
        <div style={{ fontFamily: "'DM Sans', sans-serif", fontWeight: 700, fontSize: 22, color, marginTop: 1 }}>{value}</div>
      </div>
    </div>
  );
}

export default function StaffDashboard({ role, onLogout }: Props) {
  const meta = ROLE_META[role] ?? ROLE_META.registrar;
  const [search, setSearch] = useState("");
  const [campusFilter, setCampusFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [programFilter, setProgramFilter] = useState("");
  const [selectedStudent, setSelectedStudent] = useState<typeof SAMPLE_STUDENTS[0] | null>(null);
  const [studentStatuses, setStudentStatuses] = useState<Record<string, string>>({});
  const [remark, setRemark] = useState("");

  const filtered = SAMPLE_STUDENTS.filter(s => {
    const matchSearch = !search || s.name.toLowerCase().includes(search.toLowerCase()) || s.id.includes(search);
    const matchCampus = !campusFilter || s.campus === campusFilter;
    const matchType = !typeFilter || s.type === typeFilter;
    const matchStatus = !statusFilter || (studentStatuses[s.id] ?? s.action) === statusFilter;
    const matchProgram = !programFilter || s.program.includes(programFilter);
    return matchSearch && matchCampus && matchType && matchStatus && matchProgram;
  });

  const getStatus = (s: typeof SAMPLE_STUDENTS[0]) => studentStatuses[s.id] ?? s.action;

  const summaries = role === "cashier"
    ? [
        { icon: "💳", label: "Pending Payment", value: 3, color: "var(--warning)", bg: "var(--warning-bg)" },
        { icon: "✅", label: "Payment Confirmed", value: 2, color: "var(--success)", bg: "var(--success-bg)" },
        { icon: "📤", label: "Under Verification", value: 1, color: "var(--blue)", bg: "var(--blue-light)" },
        { icon: "🧾", label: "Receipts Issued", value: 2, color: "var(--navy)", bg: "var(--navy-light)" },
      ]
    : role === "scholarship"
    ? [
        { icon: "📚", label: "FHE Eligible", value: 180, color: "var(--success)", bg: "var(--success-bg)" },
        { icon: "📋", label: "Pending Assessment", value: 12, color: "var(--warning)", bg: "var(--warning-bg)" },
        { icon: "🏆", label: "Other Scholarships", value: 8, color: "#7C3AED", bg: "#F5F3FF" },
        { icon: "❌", label: "Not Eligible", value: 3, color: "var(--danger)", bg: "var(--danger-bg)" },
      ]
    : [
        { icon: "👥", label: "Total in Queue", value: SAMPLE_STUDENTS.length, color: "var(--navy)", bg: "var(--navy-light)" },
        { icon: "⏳", label: "Pending Review", value: SAMPLE_STUDENTS.filter(s => !["Cleared"].includes(studentStatuses[s.id] ?? s.action)).length, color: "var(--warning)", bg: "var(--warning-bg)" },
        { icon: "✅", label: "Cleared Today", value: SAMPLE_STUDENTS.filter(s => (studentStatuses[s.id] ?? s.action) === "Cleared").length, color: "var(--success)", bg: "var(--success-bg)" },
        { icon: "↩️", label: "Returned for Correction", value: SAMPLE_STUDENTS.filter(s => (studentStatuses[s.id] ?? s.action) === "Returned for Correction").length, color: "var(--danger)", bg: "var(--danger-bg)" },
      ];

  return (
    <div className="flex flex-col h-full" style={{ background: "var(--surface)" }}>
      {/* Staff Header */}
      <div className="flex-shrink-0 bg-white border-b px-6 py-3 flex items-center justify-between" style={{ borderColor: "var(--border)" }}>
        <div className="flex items-center gap-3">
          <button onClick={onLogout} className="btn-secondary flex items-center gap-2" style={{ padding: "7px 12px", fontSize: 13 }}>
            <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M17 16l4-4m0 0-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
            Logout
          </button>
          <div style={{ width: 1, height: 24, background: "var(--border)" }} />
          <div className="flex items-center gap-2">
            <span style={{ fontSize: 20 }}>{meta.icon}</span>
            <div>
              <div style={{ fontFamily: "'DM Sans', sans-serif", fontWeight: 700, fontSize: 15, color: "var(--text-primary)" }}>
                {meta.title} Dashboard
              </div>
              <div style={{ fontSize: 11, color: "var(--text-muted)" }}>AY 2026–2027 · 2nd Semester</div>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>Logged in as: <strong>Staff User</strong></div>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Main Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Description */}
          <div className="p-4 rounded-xl" style={{ background: meta.bg, border: `1px solid ${meta.color}33` }}>
            <div style={{ fontSize: 13, color: meta.color, fontWeight: 600 }}>{meta.description}</div>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-4 gap-4">
            {summaries.map((s, i) => <SummaryCard key={i} {...s} />)}
          </div>

          {/* Scholarship-specific section */}
          {role === "scholarship" && (
            <div className="card shadow-sm">
              <h3 style={{ fontFamily: "'DM Sans', sans-serif", fontWeight: 700, fontSize: 15, color: "var(--text-primary)", marginBottom: 14 }}>Free Higher Education / UniFAST Coverage</h3>
              <div className="p-4 rounded-xl mb-4" style={{ background: "var(--success-bg)", border: "1px solid var(--success)" }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "var(--success)" }}>Default tuition coverage: Government-Funded (UniFAST / RA 10931)</div>
                <p style={{ fontSize: 12, color: "var(--success)", marginTop: 4 }}>All eligible students are covered by Free Higher Education. Additional scholarships and financial assistance are assessed separately.</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                {[
                  { label: "CHED FHE Scholarship", n: 5, desc: "Additional merit scholarship under CHED" },
                  { label: "CHMSU Internal Scholarship", n: 2, desc: "University-administered scholarship" },
                  { label: "Local Government Grant", n: 1, desc: "LGU-sponsored student grant" },
                  { label: "Private Scholarship", n: 0, desc: "Externally sponsored scholarship" },
                ].map((item, i) => (
                  <div key={i} className="p-3 rounded-xl" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{item.label}</div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>{item.desc}</div>
                    <div style={{ fontSize: 18, fontWeight: 700, color: "var(--navy)", marginTop: 6 }}>{item.n} students</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Cashier-specific receipts */}
          {role === "cashier" && (
            <div className="card shadow-sm">
              <h3 style={{ fontFamily: "'DM Sans', sans-serif", fontWeight: 700, fontSize: 15, color: "var(--text-primary)", marginBottom: 14 }}>Insurance Payment Verification — ₱125.00</h3>
              <div className="space-y-2">
                {[
                  { id: "2026-00001", name: "Gian Seth Kadusale", status: "Payment Submitted", receipt: null, date: "Jan 8, 2026" },
                  { id: "2026-00002", name: "Shun Archer Moncillo", status: "Confirmed", receipt: "INS-2026-00001", date: "Jan 7, 2026" },
                  { id: "2026-00003", name: "Marfel Judith", status: "Confirmed", receipt: "INS-2026-00002", date: "Jan 7, 2026" },
                  { id: "2026-00004", name: "Edrian Sayon", status: "Payment Submitted", receipt: null, date: "Jan 8, 2026" },
                ].map((p, i) => (
                  <div key={i} className="flex items-center gap-3 p-3 rounded-xl" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
                    <div className="flex-1">
                      <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{p.name}</div>
                      <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{p.id} · {p.date}</div>
                    </div>
                    <StatusBadge status={p.status} />
                    {p.receipt && <span style={{ fontSize: 11, color: "var(--success)", fontWeight: 500 }}>Receipt: {p.receipt}</span>}
                    {!p.receipt && p.status === "Payment Submitted" && (
                      <button className="btn-primary" style={{ fontSize: 11, padding: "5px 12px" }}>Confirm & Issue Receipt</button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Filters */}
          <div className="card shadow-sm">
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-2 flex-1" style={{ minWidth: 200 }}>
                <svg width="15" height="15" fill="none" stroke="var(--text-muted)" strokeWidth="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" /></svg>
                <input className="form-input" placeholder="Search by name or ID…" value={search} onChange={e => setSearch(e.target.value)} style={{ flex: 1 }} />
              </div>
              <select className="form-select" style={{ width: 140 }} value={campusFilter} onChange={e => setCampusFilter(e.target.value)}>
                <option value="">All Campuses</option>
                <option>Talisay</option><option>Binalbagan</option><option>Fortune Towne</option><option>Alijis</option>
              </select>
              <select className="form-select" style={{ width: 140 }} value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
                <option value="">All Types</option>
                <option>Freshman</option><option>Transferee</option><option>Continuing</option><option>Returning</option>
              </select>
              <select className="form-select" style={{ width: 160 }} value={programFilter} onChange={e => setProgramFilter(e.target.value)}>
                <option value="">All Programs</option>
                <option value="Computer Science">Computer Science</option>
                <option value="Information Technology">Information Technology</option>
                <option value="Business Administration">Business Admin</option>
                <option value="Criminology">Criminology</option>
                <option value="Education">Education</option>
                <option value="Engineering">Engineering</option>
                <option value="Fisheries">Fisheries</option>
                <option value="Nursing">Nursing</option>
              </select>
              <select className="form-select" style={{ width: 170 }} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
                <option value="">All Statuses</option>
                <option>Not Started</option><option>Submitted</option><option>Under Review</option><option>Cleared</option><option>Returned for Correction</option>
              </select>
            </div>
          </div>

          {/* Student Queue Table */}
          <div className="card shadow-sm overflow-hidden" style={{ padding: 0 }}>
            <div className="px-5 py-4 border-b flex items-center justify-between" style={{ borderColor: "var(--border)" }}>
              <h3 style={{ fontFamily: "'DM Sans', sans-serif", fontWeight: 700, fontSize: 15, color: "var(--text-primary)" }}>Student Processing Queue</h3>
              <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{filtered.length} students</span>
            </div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "var(--surface-mid)" }}>
                    {["Student ID", "Full Name", "Type", "Program", "Campus", "Status", "Last Updated", "Actions"].map((h) => (
                      <th key={h} style={{ padding: "10px 16px", fontSize: 11, fontWeight: 600, color: "var(--text-muted)", textAlign: "left", whiteSpace: "nowrap", textTransform: "uppercase", letterSpacing: "0.04em" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((s, i) => {
                    const currentStatus = getStatus(s);
                    return (
                      <tr key={s.id}
                        style={{ borderTop: i > 0 ? "1px solid var(--border)" : "none", background: selectedStudent?.id === s.id ? "var(--blue-light)" : "transparent", cursor: "pointer", transition: "background 0.1s" }}
                        onClick={() => setSelectedStudent(s)}>
                        <td style={{ padding: "12px 16px", fontSize: 13, fontWeight: 600, color: "var(--navy)", whiteSpace: "nowrap" }}>{s.id}</td>
                        <td style={{ padding: "12px 16px", fontSize: 13, fontWeight: 500, color: "var(--text-primary)", whiteSpace: "nowrap" }}>{s.name}</td>
                        <td style={{ padding: "12px 16px" }}><span className="badge" style={{ background: "var(--navy-light)", color: "var(--navy)", fontSize: 11 }}>{s.type}</span></td>
                        <td style={{ padding: "12px 16px", fontSize: 12, color: "var(--text-secondary)", maxWidth: 180 }}>{s.program}</td>
                        <td style={{ padding: "12px 16px", fontSize: 12, color: "var(--text-secondary)" }}>{s.campus}</td>
                        <td style={{ padding: "12px 16px" }}><StatusBadge status={currentStatus} /></td>
                        <td style={{ padding: "12px 16px", fontSize: 11, color: "var(--text-muted)", whiteSpace: "nowrap" }}>{s.date}</td>
                        <td style={{ padding: "12px 16px" }}>
                          <button
                            className="btn-secondary"
                            style={{ fontSize: 11, padding: "5px 10px" }}
                            onClick={(e) => { e.stopPropagation(); setSelectedStudent(s); }}
                          >
                            Review
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                  {filtered.length === 0 && (
                    <tr><td colSpan={8} style={{ padding: "48px", textAlign: "center", color: "var(--text-muted)", fontSize: 14 }}>No students match the selected filters.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Detail Panel */}
        {selectedStudent && (
          <aside className="flex-shrink-0 w-80 overflow-y-auto bg-white border-l p-5" style={{ borderColor: "var(--border)" }}>
            <div className="flex items-center justify-between mb-4">
              <h3 style={{ fontFamily: "'DM Sans', sans-serif", fontWeight: 700, fontSize: 15, color: "var(--text-primary)" }}>Student Detail</h3>
              <button onClick={() => setSelectedStudent(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)" }}>
                <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M18 6L6 18M6 6l12 12" /></svg>
              </button>
            </div>

            <div className="space-y-4">
              {/* Profile */}
              <div className="p-4 rounded-xl text-center" style={{ background: "var(--surface)" }}>
                <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-3" style={{ background: "var(--navy-light)", fontSize: 22 }}>
                  {selectedStudent.name.charAt(0)}
                </div>
                <div style={{ fontFamily: "'DM Sans', sans-serif", fontWeight: 700, fontSize: 15, color: "var(--text-primary)" }}>{selectedStudent.name}</div>
                <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>{selectedStudent.id}</div>
                <div className="flex gap-2 justify-center mt-2 flex-wrap">
                  <span className="badge" style={{ background: "var(--navy-light)", color: "var(--navy)", fontSize: 11 }}>{selectedStudent.type}</span>
                  <span className="badge" style={{ background: "var(--surface-mid)", color: "var(--text-secondary)", fontSize: 11 }}>{selectedStudent.campus}</span>
                </div>
              </div>

              {/* Info */}
              <div className="space-y-2">
                {[
                  { label: "Program", value: selectedStudent.program },
                  { label: "Campus", value: selectedStudent.campus },
                  { label: "Last Updated", value: selectedStudent.date },
                ].map((f, i) => (
                  <div key={i}>
                    <div style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 500 }}>{f.label}</div>
                    <div style={{ fontSize: 13, color: "var(--text-primary)", marginTop: 1 }}>{f.value}</div>
                  </div>
                ))}
              </div>

              {/* Current Status */}
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)", marginBottom: 8 }}>Current Status</div>
                <StatusBadge status={getStatus(selectedStudent)} />
              </div>

              {/* Requirements Checklist */}
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)", marginBottom: 8 }}>Requirements Checklist</div>
                <div className="space-y-2">
                  {[
                    "Student Information Sheet",
                    selectedStudent.type === "Freshman" ? "SHS Report Card" : selectedStudent.type === "Transferee" ? "Transfer Credential" : "Clearance Form",
                    "ID Pictures (2×2)",
                    "Good Moral Certificate",
                  ].map((req, i) => (
                    <div key={i} className="flex items-center gap-2 p-2 rounded-lg" style={{ background: "var(--surface)" }}>
                      <input type="checkbox" defaultChecked={i < 2} style={{ accentColor: "var(--blue)" }} />
                      <span style={{ fontSize: 12, color: "var(--text-primary)" }}>{req}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Staff Remarks */}
              <div>
                <label className="form-label">Staff Remarks</label>
                <textarea
                  className="form-input"
                  rows={3}
                  placeholder="Add remarks, notes, or instructions…"
                  value={remark}
                  onChange={e => setRemark(e.target.value)}
                  style={{ resize: "none" }}
                />
              </div>

              {/* Actions */}
              <div className="space-y-2">
                <button
                  className="btn-primary w-full"
                  style={{ background: "var(--success)" }}
                  onClick={() => setStudentStatuses(p => ({ ...p, [selectedStudent.id]: "Cleared" }))}
                >
                  ✓ Approve / Clear
                </button>
                <button
                  className="btn-secondary w-full"
                  style={{ color: "var(--danger)", borderColor: "var(--danger)" }}
                  onClick={() => setStudentStatuses(p => ({ ...p, [selectedStudent.id]: "Returned for Correction" }))}
                >
                  ↩ Return for Correction
                </button>
              </div>

              {/* Activity History */}
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)", marginBottom: 8 }}>Activity History</div>
                <div className="space-y-2">
                  {[
                    { action: "Documents submitted", time: "Jan 8 · 9:14 AM", icon: "📤" },
                    { action: "Enrollment started", time: "Jan 8 · 8:50 AM", icon: "🚀" },
                    { action: "Account verified", time: "Jan 7 · 4:00 PM", icon: "✅" },
                  ].map((ev, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <span style={{ fontSize: 14, flexShrink: 0 }}>{ev.icon}</span>
                      <div>
                        <div style={{ fontSize: 12, color: "var(--text-primary)" }}>{ev.action}</div>
                        <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{ev.time}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}
