interface Props {
  onGoHome: () => void;
}

const subjects = [
  { code: "CS 101", desc: "Introduction to Computing", units: 3, days: "MWF", time: "7:30–8:30 AM", room: "CCS-101" },
  { code: "CS 102", desc: "Programming Fundamentals", units: 3, days: "TTh", time: "9:00–10:30 AM", room: "CCS-Lab 1" },
  { code: "MATH 101", desc: "Mathematics in the Modern World", units: 3, days: "MWF", time: "10:30–11:30 AM", room: "AS-201" },
  { code: "ENG 101", desc: "Purposive Communication", units: 3, days: "TTh", time: "1:00–2:30 PM", room: "AS-102" },
  { code: "PE 1", desc: "Physical Education 1", units: 2, days: "MW", time: "3:00–4:00 PM", room: "Gym" },
  { code: "NSTP 1", desc: "National Service Training Program 1", units: 3, days: "Sat", time: "7:00–10:00 AM", room: "Multi-Purpose Hall" },
];

export default function EnrollmentConfirmed({ onGoHome }: Props) {
  const totalUnits = subjects.reduce((s, c) => s + c.units, 0);

  return (
    <div className="min-h-full" style={{ background: "var(--surface)" }}>
      <div className="p-8 max-w-4xl mx-auto">
        {/* Hero confirmation banner */}
        <div className="rounded-2xl p-8 text-center mb-6" style={{ background: "linear-gradient(135deg, var(--navy) 0%, #234872 60%, #2563EB 100%)" }}>
          <div style={{ fontSize: 52, marginBottom: 12 }}>🎉</div>
          <h1 style={{ fontFamily: "'DM Sans', sans-serif", fontWeight: 700, fontSize: 32, color: "#fff", letterSpacing: "-0.02em" }}>
            Enrollment Confirmed!
          </h1>
          <p style={{ color: "#93C5FD", fontSize: 15, marginTop: 8 }}>
            Your enrollment for AY 2026–2027, 2nd Semester has been officially confirmed by the Registrar.
          </p>
          <div className="flex items-center justify-center gap-3 mt-6">
            <button
              className="btn-secondary flex items-center gap-2"
              style={{ background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.25)", color: "#fff" }}
            >
              <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M17 17H17.01M17 3H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V5a2 2 0 00-2-2z" />
              </svg>
              Print Enrollment Form
            </button>
            <button className="btn-primary flex items-center gap-2" style={{ background: "#2563EB" }}>
              <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Download as PDF
            </button>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-5 mb-5">
          {/* Student Info */}
          <div className="col-span-2 card shadow-sm">
            <h3 style={{ fontFamily: "'DM Sans', sans-serif", fontWeight: 700, fontSize: 16, color: "var(--text-primary)", marginBottom: 16 }}>
              Enrollment Details
            </h3>
            <div className="grid grid-cols-3 gap-4">
              {[
                { label: "Official Student Number", value: "2026-0001", highlight: true },
                { label: "Full Name", value: "Cyrus — (complete after Step 1)" },
                { label: "Program", value: "BS Computer Science" },
                { label: "College", value: "College of Computer Studies" },
                { label: "Year Level", value: "1st Year" },
                { label: "Section", value: "BSCS 1-A" },
                { label: "Campus", value: "Talisay Campus (Main)" },
                { label: "Academic Year", value: "2026–2027" },
                { label: "Semester", value: "2nd Semester" },
              ].map((f, i) => (
                <div key={i} className="p-3 rounded-xl" style={{ background: f.highlight ? "var(--navy-light)" : "var(--surface)", border: `1px solid ${f.highlight ? "var(--blue-mid)" : "var(--border)"}` }}>
                  <div style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.04em" }}>{f.label}</div>
                  <div style={{ fontSize: 14, fontWeight: f.highlight ? 700 : 600, color: f.highlight ? "var(--navy)" : "var(--text-primary)", marginTop: 3 }}>{f.value}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Insurance Receipt */}
          <div className="card shadow-sm" style={{ border: "2px solid var(--success)" }}>
            <div className="flex items-center gap-2 mb-4">
              <span style={{ fontSize: 20 }}>🧾</span>
              <h3 style={{ fontFamily: "'DM Sans', sans-serif", fontWeight: 700, fontSize: 15, color: "var(--success)" }}>Insurance Receipt</h3>
            </div>
            <div className="space-y-3 p-3 rounded-xl" style={{ background: "var(--success-bg)" }}>
              {[
                { label: "Receipt No.", value: "INS-2026-0001" },
                { label: "Amount Paid", value: "₱125.00" },
                { label: "Date Issued", value: "Jan 8, 2026" },
                { label: "Time", value: "2:14 PM" },
                { label: "Collected by", value: "Cashier Office" },
                { label: "Coverage", value: "AY 2026–2027 2nd Sem" },
              ].map((r, i) => (
                <div key={i} className="flex justify-between" style={{ borderBottom: i < 5 ? "1px solid rgba(5,150,105,0.15)" : "none", paddingBottom: i < 5 ? 6 : 0 }}>
                  <span style={{ fontSize: 11, color: "var(--success)", opacity: 0.7 }}>{r.label}</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: "var(--success)" }}>{r.value}</span>
                </div>
              ))}
            </div>
            <button className="btn-secondary w-full mt-4" style={{ fontSize: 12, padding: "7px 12px" }}>
              🖨 Print Receipt
            </button>
          </div>
        </div>

        {/* Enrolled Subjects */}
        <div className="card shadow-sm mb-5">
          <div className="flex items-center justify-between mb-4">
            <h3 style={{ fontFamily: "'DM Sans', sans-serif", fontWeight: 700, fontSize: 16, color: "var(--text-primary)" }}>
              Enrolled Subjects & Class Schedule
            </h3>
            <span className="badge" style={{ background: "var(--navy-light)", color: "var(--navy)" }}>
              {totalUnits} total units
            </span>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "var(--surface-mid)" }}>
                  {["Subject Code", "Description", "Units", "Days", "Time", "Room"].map(h => (
                    <th key={h} style={{ padding: "10px 14px", fontSize: 11, fontWeight: 600, color: "var(--text-muted)", textAlign: "left", textTransform: "uppercase", letterSpacing: "0.04em", whiteSpace: "nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {subjects.map((s, i) => (
                  <tr key={s.code} style={{ borderTop: i > 0 ? "1px solid var(--border)" : "none" }}>
                    <td style={{ padding: "12px 14px" }}>
                      <span className="badge" style={{ background: "var(--navy)", color: "#fff", fontSize: 11 }}>{s.code}</span>
                    </td>
                    <td style={{ padding: "12px 14px", fontSize: 13, color: "var(--text-primary)", fontWeight: 500 }}>{s.desc}</td>
                    <td style={{ padding: "12px 14px", fontSize: 13, fontWeight: 700, color: "var(--navy)", textAlign: "center" }}>{s.units}</td>
                    <td style={{ padding: "12px 14px", fontSize: 12, color: "var(--text-secondary)", fontWeight: 600 }}>{s.days}</td>
                    <td style={{ padding: "12px 14px", fontSize: 12, color: "var(--text-secondary)", whiteSpace: "nowrap" }}>{s.time}</td>
                    <td style={{ padding: "12px 14px", fontSize: 12, color: "var(--text-secondary)" }}>{s.room}</td>
                  </tr>
                ))}
                <tr style={{ borderTop: "2px solid var(--navy)", background: "var(--navy-light)" }}>
                  <td colSpan={2} style={{ padding: "10px 14px", fontSize: 13, fontWeight: 700, color: "var(--navy)" }}>Total</td>
                  <td style={{ padding: "10px 14px", fontSize: 14, fontWeight: 700, color: "var(--navy)", textAlign: "center" }}>{totalUnits}</td>
                  <td colSpan={3} />
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between">
          <button className="btn-secondary flex items-center gap-2" onClick={onGoHome}>
            <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M11 19l-7-7 7-7M18 19l-7-7 7-7" /></svg>
            Back to Dashboard
          </button>
          <div className="flex gap-3">
            <button className="btn-secondary flex items-center gap-2">
              <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M17 17H17.01M17 3H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V5a2 2 0 00-2-2z" /></svg>
              Print Enrollment Form
            </button>
            <button className="btn-primary flex items-center gap-2">
              <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
              Download as PDF
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
