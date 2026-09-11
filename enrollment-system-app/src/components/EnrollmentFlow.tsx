import { useState } from "react";

interface Props {
  userType: "student" | "freshman";
  step: number;
  onStepChange: (s: number) => void;
  onComplete: () => void;
}

const STEPS = [
  "Forms & Academic Slips",
  "Registrar Requirements",
  "Assessment & Insurance",
  "Student Support Offices",
  "School ID Processing",
  "Enrollment Form Release",
];

// ─── Shared sub-components ────────────────────────────────────────────────────

function ProgressTracker({ current }: { current: number }) {
  return (
    <div className="flex items-center gap-0 mb-6">
      {STEPS.map((label, i) => {
        const n = i + 1;
        const done = n < current;
        const active = n === current;
        return (
          <div key={n} className="flex items-center flex-1">
            <div className="flex flex-col items-center" style={{ minWidth: 64 }}>
              <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0"
                style={{ background: done ? "var(--success)" : active ? "var(--blue)" : "var(--border)", color: done || active ? "#fff" : "var(--text-muted)", border: active ? "2px solid var(--blue)" : "none", boxShadow: active ? "0 0 0 4px rgba(37,99,235,0.15)" : "none" }}>
                {done ? <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M5 13l4 4L19 7" /></svg> : n}
              </div>
              <div style={{ fontSize: 10, color: active ? "var(--blue)" : done ? "var(--success)" : "var(--text-muted)", marginTop: 4, textAlign: "center", fontWeight: active ? 600 : 400, lineHeight: 1.3 }}>
                {label}
              </div>
            </div>
            {i < STEPS.length - 1 && (
              <div style={{ flex: 1, height: 2, background: done ? "var(--blue)" : "var(--border)", marginBottom: 18 }} />
            )}
          </div>
        );
      })}
    </div>
  );
}

function StepCard({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="card shadow-sm">
      <div className="mb-5 pb-4 border-b" style={{ borderColor: "var(--border)" }}>
        <h2 style={{ fontFamily: "'DM Sans', sans-serif", fontWeight: 700, fontSize: 20, color: "var(--text-primary)", letterSpacing: "-0.01em" }}>{title}</h2>
        {subtitle && <p style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 4 }}>{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

function FormField({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="form-label">
        {label}{required && <span style={{ color: "var(--danger)", marginLeft: 3 }}>*</span>}
      </label>
      {children}
    </div>
  );
}

function DocItem({ label, type, required, note }: { label: string; type: "upload" | "physical" | "conditional"; required?: boolean; note?: string }) {
  const [checked, setChecked] = useState(false);
  const colors = { upload: { bg: "var(--blue-light)", color: "var(--blue)", label: "Digital Upload" }, physical: { bg: "#F0FDF4", color: "#166534", label: "Bring Original" }, conditional: { bg: "var(--warning-bg)", color: "var(--warning)", label: "Conditional" } };
  const c = colors[type];
  return (
    <div className="flex items-start gap-3 p-3 rounded-xl" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
      <input type="checkbox" checked={checked} onChange={e => setChecked(e.target.checked)} style={{ marginTop: 2, width: 16, height: 16, accentColor: "var(--blue)", cursor: "pointer", flexShrink: 0 }} />
      <div className="flex-1">
        <div style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)", textDecoration: checked ? "line-through" : "none", opacity: checked ? 0.6 : 1 }}>{label}</div>
        {note && <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>{note}</div>}
      </div>
      <span className="badge" style={{ background: c.bg, color: c.color, fontSize: 10, flexShrink: 0 }}>{c.label}</span>
      {!required && <span className="badge" style={{ background: "#F1F5F9", color: "#94A3B8", fontSize: 10, flexShrink: 0 }}>Optional</span>}
    </div>
  );
}

function OfficeCard({ office, icon, status, children, onUpdateStatus }: { office: string; icon: string; status: string; children: React.ReactNode; onUpdateStatus: (s: string) => void }) {
  const statusMap: Record<string, { bg: string; color: string }> = {
    "Not Started": { bg: "#F1F5F9", color: "#64748B" },
    "Action Required": { bg: "var(--warning-bg)", color: "var(--warning)" },
    "Submitted": { bg: "var(--blue-light)", color: "var(--blue)" },
    "Under Review": { bg: "#EDE9FE", color: "#7C3AED" },
    "Returned for Correction": { bg: "var(--danger-bg)", color: "var(--danger)" },
    "Cleared": { bg: "var(--success-bg)", color: "var(--success)" },
  };
  const s = statusMap[status] ?? { bg: "#F1F5F9", color: "#64748B" };
  return (
    <div className="card shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <span style={{ fontSize: 22 }}>{icon}</span>
          <div>
            <h3 style={{ fontFamily: "'DM Sans', sans-serif", fontWeight: 700, fontSize: 15, color: "var(--text-primary)" }}>{office}</h3>
          </div>
        </div>
        <span className="badge" style={{ background: s.bg, color: s.color }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: s.color, display: "inline-block" }} />
          {status}
        </span>
      </div>
      {children}
      {status !== "Cleared" && (
        <button
          className="btn-primary mt-4 w-full"
          style={{ fontSize: 13, padding: "9px 16px" }}
          onClick={() => onUpdateStatus(status === "Not Started" ? "Submitted" : "Cleared")}
        >
          {status === "Not Started" ? "Submit for Review" : status === "Submitted" ? "Mark as Cleared" : "Clear"}
        </button>
      )}
      {status === "Cleared" && (
        <div className="flex items-center gap-2 mt-4 p-3 rounded-xl" style={{ background: "var(--success-bg)" }}>
          <svg width="16" height="16" fill="none" stroke="var(--success)" strokeWidth="2" viewBox="0 0 24 24"><path d="M5 13l4 4L19 7" /></svg>
          <span style={{ fontSize: 13, fontWeight: 600, color: "var(--success)" }}>Clearance Granted</span>
        </div>
      )}
    </div>
  );
}

// ─── Step Components ───────────────────────────────────────────────────────────

function Step1({ userType }: { userType: "student" | "freshman" }) {
  const [studentType, setStudentType] = useState(userType === "freshman" ? "freshman" : "continuing");
  const programs = ["Bachelor of Science in Computer Science", "Bachelor of Science in Information Technology", "Bachelor of Science in Nursing", "Bachelor of Science in Business Administration", "Bachelor of of Arts in Communication", "Bachelor of Secondary Education"];
  return (
    <StepCard title="Forms & Academic Slips" subtitle="Complete your student information before your scheduled enrollment date.">
      {(studentType === "freshman" || studentType === "transferee") && (
        <div className="mb-5 p-4 rounded-xl" style={{ background: "var(--blue-light)", border: "1px solid var(--blue-mid)" }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--navy)" }}>Online Student Information Sheet Required</div>
          <p style={{ fontSize: 12, color: "#3B82F6", marginTop: 3 }}>First-year students and transferees must complete this form before their scheduled enrollment.</p>
        </div>
      )}

      <div className="space-y-5">
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Student Type" required>
            <select className="form-select" value={studentType} onChange={e => setStudentType(e.target.value)}>
              <option value="freshman">Freshman (1st Year)</option>
              <option value="transferee">Transferee</option>
              <option value="continuing">Continuing Student</option>
              <option value="returning">Returning Student</option>
            </select>
          </FormField>
          <FormField label="Student Status" required>
            <select className="form-select">
              <option value="">Select status…</option>
              <option>Regular</option>
              <option>Irregular</option>
            </select>
          </FormField>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <FormField label="Campus" required>
            <select className="form-select">
              <option value="">Select campus…</option>
              <option>Talisay Campus (Main)</option>
              <option>Binalbagan Campus</option>
              <option>Fortune Towne Campus</option>
              <option>Alijis Campus</option>
            </select>
          </FormField>
          <FormField label="Academic Year & Semester" required>
            <select className="form-select">
              <option>2026–2027 · 2nd Semester</option>
              <option>2027–2028 · 1st Semester</option>
            </select>
          </FormField>
        </div>

        <FormField label="College & Program" required>
          <select className="form-select">
            <option value="">Select program…</option>
            <optgroup label="College of Computer Studies">
              <option>BS Computer Science</option>
              <option>BS Information Technology</option>
            </optgroup>
            <optgroup label="College of Business Management and Accountancy">
              <option>BS Business Administration</option>
              <option>BS Accountancy</option>
              <option>BS Management Accounting</option>
            </optgroup>
            <optgroup label="College of Arts and Sciences">
              <option>BA Communication</option>
              <option>BS Biology</option>
              <option>BS Mathematics</option>
            </optgroup>
            <optgroup label="College of Education">
              <option>Bachelor of Elementary Education</option>
              <option>Bachelor of Secondary Education — English</option>
              <option>Bachelor of Secondary Education — Mathematics</option>
              <option>Bachelor of Secondary Education — Science</option>
            </optgroup>
            <optgroup label="College of Engineering">
              <option>BS Civil Engineering</option>
              <option>BS Electrical Engineering</option>
            </optgroup>
            <optgroup label="College of Criminal Justice">
              <option>BS Criminology</option>
            </optgroup>
            <optgroup label="College of Fisheries">
              <option>BS Fisheries</option>
            </optgroup>
            <optgroup label="College of Industrial Technology">
              <option>BS Industrial Technology — Automotive</option>
              <option>BS Industrial Technology — Electronics</option>
            </optgroup>
          </select>
        </FormField>

        <FormField label="Year Level" required>
          <select className="form-select">
            <option value="">Select year level…</option>
            <option>1st Year</option><option>2nd Year</option><option>3rd Year</option><option>4th Year</option><option>5th Year</option>
          </select>
        </FormField>

        <div className="border-t pt-5 mt-2" style={{ borderColor: "var(--border)" }}>
          <h4 style={{ fontFamily: "'DM Sans', sans-serif", fontWeight: 600, fontSize: 14, color: "var(--text-primary)", marginBottom: 14 }}>Personal Information</h4>
          <div className="grid grid-cols-3 gap-4">
            <FormField label="Last Name" required><input className="form-input" placeholder="Last name" /></FormField>
            <FormField label="First Name" required><input className="form-input" placeholder="First name" /></FormField>
            <FormField label="Middle Name"><input className="form-input" placeholder="Middle name" /></FormField>
          </div>
          <div className="grid grid-cols-3 gap-4 mt-4">
            <FormField label="Date of Birth" required><input type="date" className="form-input" /></FormField>
            <FormField label="Gender" required>
              <select className="form-select">
                <option value="">Select…</option>
                <option>Male</option><option>Female</option>
              </select>
            </FormField>
            <FormField label="Civil Status">
              <select className="form-select">
                <option>Single</option><option>Married</option>
              </select>
            </FormField>
          </div>
          <div className="mt-4">
            <FormField label="Complete Address" required><input className="form-input" placeholder="House No., Street, Barangay, City/Municipality, Province" /></FormField>
          </div>
          <div className="grid grid-cols-2 gap-4 mt-4">
            <FormField label="Mobile Number" required><input className="form-input" placeholder="09XX XXX XXXX" /></FormField>
            <FormField label="Email Address" required><input className="form-input" type="email" placeholder="you@email.com" /></FormField>
          </div>
        </div>

        <div className="border-t pt-5" style={{ borderColor: "var(--border)" }}>
          <h4 style={{ fontFamily: "'DM Sans', sans-serif", fontWeight: 600, fontSize: 14, color: "var(--text-primary)", marginBottom: 14 }}>Parent / Guardian & Emergency Contact</h4>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Parent / Guardian Name"><input className="form-input" placeholder="Full name" /></FormField>
            <FormField label="Relationship"><input className="form-input" placeholder="e.g. Mother, Father, Guardian" /></FormField>
          </div>
          <div className="grid grid-cols-2 gap-4 mt-4">
            <FormField label="Contact Number"><input className="form-input" placeholder="09XX XXX XXXX" /></FormField>
            <FormField label="Emergency Contact Name"><input className="form-input" placeholder="Full name" /></FormField>
          </div>
        </div>

        <div className="border-t pt-5" style={{ borderColor: "var(--border)" }}>
          <h4 style={{ fontFamily: "'DM Sans', sans-serif", fontWeight: 600, fontSize: 14, color: "var(--text-primary)", marginBottom: 14 }}>Academic Slips</h4>
          <div className="grid grid-cols-2 gap-3">
            <div className="upload-zone">
              <div style={{ fontSize: 22, marginBottom: 6 }}>📋</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>Admission Slip</div>
              <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>For incoming students and transferees</div>
              <div style={{ fontSize: 11, color: "var(--blue)", marginTop: 6 }}>Click to upload (PDF/JPG)</div>
            </div>
            <div className="upload-zone">
              <div style={{ fontSize: 22, marginBottom: 6 }}>📄</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>Loading Slip</div>
              <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>From your Program Chair</div>
              <div style={{ fontSize: 11, color: "var(--blue)", marginTop: 6 }}>Click to upload (PDF/JPG)</div>
            </div>
          </div>
        </div>
      </div>
    </StepCard>
  );
}

function Step2({ userType }: { userType: "student" | "freshman" }) {
  const [activeTab, setActiveTab] = useState(userType === "freshman" ? "freshman" : "continuing");
  const tabs = [{ id: "freshman", label: "Freshman" }, { id: "transferee", label: "Transferee" }, { id: "continuing", label: "Continuing" }];
  return (
    <StepCard title="Registrar Requirements" subtitle="Submit all required documents to the Registrar's Office. Check items you have prepared.">
      <div className="flex gap-2 mb-5 p-1 rounded-xl" style={{ background: "var(--surface)", border: "1px solid var(--border)", display: "inline-flex" }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)}
            style={{ padding: "7px 16px", borderRadius: 10, fontSize: 13, fontWeight: 600, border: "none", cursor: "pointer", background: activeTab === t.id ? "var(--navy)" : "none", color: activeTab === t.id ? "#fff" : "var(--text-secondary)", transition: "all 0.15s" }}>
            {t.label}
          </button>
        ))}
      </div>

      <div className="space-y-2">
        {activeTab === "freshman" && <>
          <DocItem label="Original Senior High School Report Card (Form 138)" type="physical" required />
          <DocItem label="Certificate of Rating (for ALS completers)" type="physical" note="Required only for ALS completers" />
          <DocItem label="Original Certificate of Good Moral Character" type="physical" required />
          <DocItem label="Two (2) photocopies of PSA/NSO Birth Certificate" type="physical" required />
          <DocItem label="Marriage Certificate (certified copies)" type="physical" note="Applicable to married applicants only" />
          <DocItem label="Two (2) recent 2×2 ID pictures" type="physical" required />
          <DocItem label="Student Information Sheet (SIS)" type="upload" required />
          <DocItem label="Long brown envelope" type="physical" required />
          <DocItem label="Long cream or white folder" type="physical" required />
          <DocItem label="Long plastic folder" type="physical" note="Required for Binalbagan Campus only" />
        </>}

        {activeTab === "transferee" && <>
          <DocItem label="Transfer Credential / Honorable Dismissal" type="physical" required />
          <DocItem label="Photocopy of Transcript of Records" type="physical" required />
          <DocItem label="Certificate of Good Moral Character" type="physical" required />
          <DocItem label="PSA/NSO Birth Certificate (photocopy)" type="physical" required />
          <DocItem label="Two (2) recent 2×2 ID pictures" type="physical" required />
          <DocItem label="Student Information Sheet" type="upload" required />
          <DocItem label="Loading Slip from Program Chair" type="upload" note="If applicable" />
          <DocItem label="Marriage Certificate (if applicable)" type="physical" />
        </>}

        {activeTab === "continuing" && <>
          <DocItem label="Accomplished Clearance Form" type="physical" required />
          <DocItem label="Loading Slip" type="upload" note="Required for irregular students" />
          <DocItem label="Student ID or Enrollment Form (last semester)" type="physical" required />
        </>}
      </div>

      <div className="mt-5 p-4 rounded-xl" style={{ background: "var(--surface-mid)", border: "1px solid var(--border)" }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", marginBottom: 8 }}>Staff Remarks</div>
        <div className="p-3 rounded-lg text-sm" style={{ background: "#fff", border: "1px solid var(--border)", color: "var(--text-muted)", minHeight: 48 }}>
          No remarks from the Registrar yet. Your submission is pending review.
        </div>
      </div>

      <div className="mt-4 p-3 rounded-xl flex items-center gap-3" style={{ background: "var(--warning-bg)", border: "1px solid #FDE68A" }}>
        <svg width="16" height="16" fill="none" stroke="var(--warning)" strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" /><path d="M12 8v4m0 4h.01" /></svg>
        <span style={{ fontSize: 12, color: "#92400E" }}>Physical documents must be brought to the Registrar's Office. Digital uploads supplement but do not replace original documents.</span>
      </div>
    </StepCard>
  );
}

function Step3() {
  const [paymentState, setPaymentState] = useState<"awaiting" | "ready" | "submitted" | "verifying" | "confirmed" | "rejected" | "receipt">("ready");
  const stateLabels: Record<string, { label: string; color: string; bg: string; icon: string }> = {
    awaiting: { label: "Awaiting Assessment", color: "var(--text-muted)", bg: "#F1F5F9", icon: "⏳" },
    ready: { label: "Ready for Payment", color: "#B45309", bg: "#FEF9C3", icon: "💳" },
    submitted: { label: "Payment Submitted", color: "var(--blue)", bg: "var(--blue-light)", icon: "📤" },
    verifying: { label: "Under Verification", color: "#7C3AED", bg: "#F5F3FF", icon: "🔍" },
    confirmed: { label: "Payment Confirmed", color: "var(--success)", bg: "var(--success-bg)", icon: "✅" },
    rejected: { label: "Payment Rejected", color: "var(--danger)", bg: "var(--danger-bg)", icon: "❌" },
    receipt: { label: "Receipt Issued", color: "#166534", bg: "#DCFCE7", icon: "🧾" },
  };
  const st = stateLabels[paymentState];
  return (
    <StepCard title="Assessment & Insurance" subtitle="Review your tuition coverage and complete the mandatory insurance payment.">
      <div className="grid grid-cols-2 gap-6">
        {/* Fee Breakdown */}
        <div>
          <h4 style={{ fontFamily: "'DM Sans', sans-serif", fontWeight: 600, fontSize: 14, color: "var(--text-primary)", marginBottom: 14 }}>Fee Summary</h4>
          <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--border)" }}>
            <div className="p-4" style={{ background: "var(--navy)" }}>
              <div style={{ fontSize: 12, color: "#93C5FD", fontWeight: 500 }}>Free Higher Education / UniFAST</div>
              <div style={{ fontFamily: "'DM Sans', sans-serif", fontWeight: 700, fontSize: 18, color: "#fff", marginTop: 4 }}>Government-Funded Tuition</div>
            </div>
            <div className="p-4 space-y-3">
              {[
                { label: "Tuition Fee", value: "Government-funded", muted: true },
                { label: "Tuition Payable", value: "₱0.00", muted: true },
                { label: "Student Insurance Fee", value: "₱125.00", highlight: true },
              ].map((row, i) => (
                <div key={i} className="flex items-center justify-between py-2" style={{ borderBottom: i < 2 ? "1px solid var(--border)" : "none" }}>
                  <span style={{ fontSize: 13, color: row.highlight ? "var(--text-primary)" : "var(--text-secondary)", fontWeight: row.highlight ? 600 : 400 }}>{row.label}</span>
                  <span style={{ fontSize: 14, fontWeight: 700, color: row.muted ? "var(--text-muted)" : "var(--text-primary)" }}>{row.value}</span>
                </div>
              ))}
              <div className="flex items-center justify-between pt-2 mt-1" style={{ borderTop: "2px solid var(--navy)" }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: "var(--navy)" }}>Total Payable</span>
                <span style={{ fontSize: 20, fontWeight: 700, fontFamily: "'DM Sans', sans-serif", color: "var(--navy)" }}>₱125.00</span>
              </div>
            </div>
          </div>
          <div className="mt-3 p-3 rounded-xl" style={{ background: "var(--surface-mid)", border: "1px solid var(--border)" }}>
            <p style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.5 }}>
              Eligibility exceptions and pending school fees require staff assessment. Contact the Registrar for concerns.
            </p>
          </div>
        </div>

        {/* Payment Status */}
        <div>
          <h4 style={{ fontFamily: "'DM Sans', sans-serif", fontWeight: 600, fontSize: 14, color: "var(--text-primary)", marginBottom: 14 }}>Payment Status</h4>
          <div className="card flex flex-col items-center text-center gap-3 py-6" style={{ border: `2px solid ${st.bg}` }}>
            <span style={{ fontSize: 36 }}>{st.icon}</span>
            <span className="badge" style={{ background: st.bg, color: st.color, fontSize: 13, padding: "5px 14px" }}>{st.label}</span>
            {paymentState === "confirmed" && (
              <div style={{ fontSize: 12, color: "var(--success)", fontWeight: 500 }}>Payment confirmed by Cashier</div>
            )}
            {paymentState === "receipt" && (
              <div className="text-center">
                <div style={{ fontSize: 12, color: "#166534", fontWeight: 600 }}>Receipt #INS-2026-0001</div>
                <div style={{ fontSize: 11, color: "#166534" }}>Issued Jan 8, 2026 · 2:14 PM</div>
                <button className="btn-secondary mt-3" style={{ fontSize: 12, padding: "6px 14px" }}>🖨 Print Receipt</button>
              </div>
            )}
            {paymentState === "rejected" && (
              <div className="text-center">
                <p style={{ fontSize: 12, color: "var(--danger)", maxWidth: 220 }}>Your payment was rejected by the Cashier. Please resubmit with correct payment proof.</p>
                <button className="btn-primary mt-3" style={{ background: "var(--danger)", fontSize: 12, padding: "6px 14px" }} onClick={() => setPaymentState("submitted")}>Resubmit Payment</button>
              </div>
            )}
            {!["confirmed", "receipt", "rejected"].includes(paymentState) && (
              <p style={{ fontSize: 12, color: "var(--text-secondary)", maxWidth: 220 }}>
                {paymentState === "ready" ? "Proceed to the Cashier or designated insurance collection office to pay the ₱125.00 insurance fee." : "Your payment submission is being reviewed by authorized staff."}
              </p>
            )}
          </div>

          {/* State simulator */}
          <div className="mt-4">
            <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 8 }}>Payment status:</div>
            <div className="flex flex-wrap gap-2">
              {(["awaiting", "ready", "submitted", "verifying", "confirmed", "rejected", "receipt"] as const).map(s => (
                <button key={s} onClick={() => setPaymentState(s)}
                  style={{ padding: "5px 10px", borderRadius: 6, fontSize: 11, border: `1px solid ${paymentState === s ? "var(--blue)" : "var(--border)"}`, background: paymentState === s ? "var(--blue-light)" : "#fff", color: paymentState === s ? "var(--blue)" : "var(--text-secondary)", cursor: "pointer", fontWeight: 500 }}>
                  {stateLabels[s].label}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-4 p-3 rounded-xl" style={{ background: "var(--warning-bg)", border: "1px solid #FDE68A" }}>
            <p style={{ fontSize: 12, color: "#92400E" }}>
              Payment confirmation must come from authorized Cashier staff. Submitting payment does not automatically complete enrollment.
            </p>
          </div>
        </div>
      </div>
    </StepCard>
  );
}

function Step4({ userType }: { userType: "student" | "freshman" }) {
  const [osasSt, setOsasSt] = useState("Not Started");
  const [guidSt, setGuidSt] = useState("Not Started");
  const [medSt, setMedSt] = useState("Not Started");
  const statuses = ["Not Started", "Submitted", "Under Review", "Returned for Correction", "Cleared"];

  return (
    <StepCard title="Student Support Offices" subtitle="Complete clearance from all required offices. Uploaded documents are optional.">
      <div className="grid grid-cols-3 gap-4">
        <OfficeCard office="OSAS" icon="🎓" status={osasSt} onUpdateStatus={(s) => setOsasSt(s === "Submitted" ? "Submitted" : "Cleared")}>
          <div className="space-y-2 text-sm" style={{ color: "var(--text-secondary)" }}>
            <p>The Office for Student Affairs and Services reviews your enrollment eligibility and verifies student records.</p>
            <div className="mt-3">
              <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)", marginBottom: 6 }}>Clearance Status Only</div>
              <div className="p-3 rounded-lg" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
                <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Your clearance status is shared with OSAS. Details remain private.</span>
              </div>
            </div>
          </div>
        </OfficeCard>

        <OfficeCard office="Guidance Services" icon="🧠" status={guidSt} onUpdateStatus={(s) => setGuidSt(s === "Submitted" ? "Submitted" : "Cleared")}>
          <div className="space-y-2">
            <p style={{ fontSize: 12, color: "var(--text-secondary)" }}>Submit required documents for Guidance clearance.</p>
            {userType === "freshman" && (
              <div className="space-y-2">
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)", marginBottom: 6 }}>Requirements</div>
                  <DocItem label="Student Individual Inventory Form" type="upload" />
                  <div className="mt-2" />
                  <DocItem label="Recent 2×2 ID Picture" type="physical" />
                </div>
              </div>
            )}
            {userType !== "freshman" && (
              <div className="upload-zone mt-2">
                <div style={{ fontSize: 18 }}>📋</div>
                <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>No additional documents required</div>
              </div>
            )}
          </div>
        </OfficeCard>

        <OfficeCard office="Medical Services" icon="🏥" status={medSt} onUpdateStatus={(s) => setMedSt(s === "Submitted" ? "Submitted" : "Cleared")}>
          <div className="space-y-2">
            <p style={{ fontSize: 12, color: "var(--text-secondary)" }}>Medical documents are only visible to authorized Medical Services staff.</p>
            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)", marginBottom: 6 }}>Requirements</div>
            <div className="space-y-2">
              <DocItem label="Recent chest X-ray result (within 6 months)" type="upload" />
              <DocItem label="Medical certificate by licensed physician" type="upload" />
              <DocItem label="Medical Health Form (MHF)" type="upload" />
              {userType === "freshman" && <>
                <DocItem label="Recent 1×1 ID picture" type="physical" />
                <DocItem label="Additional medical clearance" type="conditional" note="When required by physician" />
              </>}
            </div>
            <div className="mt-3 p-2 rounded-lg" style={{ background: "var(--danger-bg)", border: "1px solid #FECACA" }}>
              <span style={{ fontSize: 11, color: "var(--danger)" }}>🔒 Medical documents are private and only visible to Medical Services staff.</span>
            </div>
          </div>
        </OfficeCard>
      </div>

      <div className="mt-4 p-4 rounded-xl" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", marginBottom: 8 }}>Clearance Statuses</div>
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: "OSAS", state: osasSt, set: setOsasSt },
            { label: "Guidance", state: guidSt, set: setGuidSt },
            { label: "Medical", state: medSt, set: setMedSt },
          ].map(({ label, state, set }) => (
            <div key={label}>
              <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 4 }}>{label}</div>
              <select className="form-select" style={{ fontSize: 12, padding: "7px 10px" }} value={state} onChange={e => set(e.target.value)}>
                {statuses.map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
          ))}
        </div>
      </div>
    </StepCard>
  );
}

function Step5() {
  const [status, setStatus] = useState("Not Started");
  const statuses = ["Not Started", "Scheduled", "Data Captured", "Processing", "Ready for Release", "Completed"];
  const statusIcons: Record<string, string> = { "Not Started": "⬜", Scheduled: "📅", "Data Captured": "📸", Processing: "⚙️", "Ready for Release": "🎉", Completed: "✅" };
  return (
    <StepCard title="School ID Processing" subtitle="ICT-MIS handles your identity verification and school ID production.">
      <div className="grid grid-cols-2 gap-6">
        <div className="space-y-4">
          {[
            { label: "Identity Verification", desc: "Government ID or PSA Birth Certificate", done: ["Data Captured", "Processing", "Ready for Release", "Completed"].includes(status) },
            { label: "Photo Capture", desc: "Biometric photo taken at the ICT-MIS office", done: ["Data Captured", "Processing", "Ready for Release", "Completed"].includes(status) },
            { label: "Student Number", desc: status === "Not Started" ? "Not yet assigned" : "2026-0001", done: status !== "Not Started" },
            { label: "School ID Production", desc: "Physical ID card printing and lamination", done: ["Ready for Release", "Completed"].includes(status) },
          ].map((item, i) => (
            <div key={i} className="flex items-start gap-3 p-4 rounded-xl" style={{ background: item.done ? "var(--success-bg)" : "var(--surface)", border: `1px solid ${item.done ? "var(--success)" : "var(--border)"}` }}>
              <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: item.done ? "var(--success)" : "var(--border)" }}>
                {item.done ? <svg width="14" height="14" fill="none" stroke="#fff" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M5 13l4 4L19 7" /></svg> : <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{i + 1}</span>}
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: item.done ? "var(--success)" : "var(--text-primary)" }}>{item.label}</div>
                <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>{item.desc}</div>
              </div>
            </div>
          ))}
        </div>

        <div className="space-y-4">
          <div className="card flex flex-col items-center text-center gap-3 py-8" style={{ border: "1px solid var(--border)" }}>
            <span style={{ fontSize: 42 }}>{statusIcons[status]}</span>
            <div style={{ fontFamily: "'DM Sans', sans-serif", fontWeight: 700, fontSize: 18, color: "var(--text-primary)" }}>ID Status</div>
            <span className="badge" style={{ background: status === "Completed" ? "var(--success-bg)" : "var(--navy-light)", color: status === "Completed" ? "var(--success)" : "var(--navy)", fontSize: 13, padding: "5px 14px" }}>{status}</span>
            <p style={{ fontSize: 12, color: "var(--text-secondary)", maxWidth: 200 }}>
              {status === "Not Started" && "Visit the ICT-MIS office for photo capture and ID processing."}
              {status === "Scheduled" && "You have a scheduled appointment at the ICT-MIS office."}
              {status === "Data Captured" && "Your photo and data have been captured. ID is being processed."}
              {status === "Processing" && "Your school ID is being printed. Check back soon."}
              {status === "Ready for Release" && "Your school ID is ready for pickup at the ICT-MIS office."}
              {status === "Completed" && "School ID released. Enrollment ID processing complete."}
            </p>
          </div>

          <div className="p-4 rounded-xl" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", marginBottom: 10 }}>Payment Status</div>
            <div className="flex flex-wrap gap-2">
              {statuses.map(s => (
                <button key={s} onClick={() => setStatus(s)}
                  style={{ padding: "5px 10px", borderRadius: 6, fontSize: 11, border: `1px solid ${status === s ? "var(--blue)" : "var(--border)"}`, background: status === s ? "var(--blue-light)" : "#fff", color: status === s ? "var(--blue)" : "var(--text-secondary)", cursor: "pointer", fontWeight: 500 }}>
                  {s}
                </button>
              ))}
            </div>
          </div>

          <div className="p-4 rounded-xl" style={{ background: "var(--navy-light)", border: "1px solid #BFDBFE" }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--navy)", marginBottom: 4 }}>Campus Instructions</div>
            <p style={{ fontSize: 12, color: "var(--navy-mid)", lineHeight: 1.6 }}>
              Visit the ICT-MIS office on your campus with a valid government-issued ID. Bring your enrollment documents. Photo capture appointments may be required — check the bulletin board or contact ICT-MIS directly.
            </p>
          </div>
        </div>
      </div>
    </StepCard>
  );
}

function Step6({ onComplete }: { onComplete: () => void }) {
  const [approved, setApproved] = useState(false);
  const checks = [
    { label: "Student Information & Academic Slips", status: "Verified" },
    { label: "Registrar Requirements", status: "Verified" },
    { label: "Free Higher Education Assessment", status: "Eligible — Government-Funded" },
    { label: "Student Insurance Payment (₱125.00)", status: "Confirmed — Receipt #INS-2026-0001" },
    { label: "OSAS Clearance", status: "Cleared" },
    { label: "Guidance Services Clearance", status: "Cleared" },
    { label: "Medical Services Clearance", status: "Cleared" },
    { label: "School ID Processing", status: "Ready for Release" },
  ];
  return (
    <StepCard title="Enrollment Form Release" subtitle="The Registrar performs the final review before releasing your official Enrollment Form.">
      {!approved ? (
        <>
          <div className="space-y-2 mb-5">
            {checks.map((c, i) => (
              <div key={i} className="flex items-center gap-3 p-3 rounded-xl" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
                <svg width="16" height="16" fill="none" stroke="var(--success)" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M5 13l4 4L19 7" /></svg>
                <span style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)", flex: 1 }}>{c.label}</span>
                <span style={{ fontSize: 12, color: "var(--success)", fontWeight: 500 }}>{c.status}</span>
              </div>
            ))}
          </div>
          <div className="p-4 rounded-xl mb-5" style={{ background: "var(--warning-bg)", border: "1px solid #FDE68A" }}>
            <p style={{ fontSize: 13, color: "#92400E" }}>Awaiting final Registrar approval. The Enrollment Form will only be released after all requirements have been verified by the Registrar.</p>
          </div>
          <button className="btn-primary w-full" style={{ background: "var(--success)", fontSize: 14 }} onClick={() => setApproved(true)}>
            Release Enrollment Form
          </button>
        </>
      ) : (
        <div className="text-center py-4">
          <div style={{ fontSize: 56, marginBottom: 12 }}>🎉</div>
          <h3 style={{ fontFamily: "'DM Sans', sans-serif", fontWeight: 700, fontSize: 24, color: "var(--success)", letterSpacing: "-0.02em" }}>Enrollment Confirmed!</h3>
          <p style={{ fontSize: 14, color: "var(--text-secondary)", marginTop: 6 }}>Your enrollment has been officially confirmed by the Registrar.</p>
          <div className="grid grid-cols-2 gap-4 mt-8 text-left">
            {[
              { label: "Student Number", value: "2026-0001" },
              { label: "Program", value: "BS Computer Science" },
              { label: "Year Level", value: "1st Year" },
              { label: "Section", value: "BSCS 1-A" },
              { label: "Academic Year", value: "2026–2027" },
              { label: "Semester", value: "2nd Semester" },
            ].map((f, i) => (
              <div key={i} className="p-3 rounded-xl" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
                <div style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 500 }}>{f.label}</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", marginTop: 2 }}>{f.value}</div>
              </div>
            ))}
          </div>
          <div className="mt-5 p-4 rounded-xl" style={{ background: "var(--navy-light)", border: "1px solid #BFDBFE" }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--navy)", marginBottom: 8 }}>Enrolled Subjects</div>
            <div className="space-y-2">
              {[
                { code: "CS 101", desc: "Introduction to Computing", units: 3, sched: "MWF 7:30–8:30AM" },
                { code: "CS 102", desc: "Programming Fundamentals", units: 3, sched: "TTh 9:00–10:30AM" },
                { code: "MATH 101", desc: "Mathematics in the Modern World", units: 3, sched: "MWF 10:30–11:30AM" },
                { code: "ENG 101", desc: "Purposive Communication", units: 3, sched: "TTh 1:00–2:30PM" },
                { code: "PE 1", desc: "Physical Education 1", units: 2, sched: "MW 3:00–4:00PM" },
              ].map((s, i) => (
                <div key={i} className="flex items-center gap-3 text-left p-2 rounded-lg" style={{ background: "#fff" }}>
                  <span className="badge" style={{ background: "var(--navy)", color: "#fff", fontSize: 10, flexShrink: 0 }}>{s.code}</span>
                  <span style={{ fontSize: 12, fontWeight: 500, flex: 1 }}>{s.desc}</span>
                  <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{s.units} units</span>
                  <span style={{ fontSize: 11, color: "var(--text-secondary)" }}>{s.sched}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="flex gap-3 mt-5">
            <button className="btn-secondary flex-1 flex items-center justify-center gap-2">
              <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M17 17H17.01M17 3H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V5a2 2 0 00-2-2z" /></svg>
              Print Enrollment Form
            </button>
            <button className="btn-primary flex-1 flex items-center justify-center gap-2" onClick={onComplete}>
              <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
              Download as PDF
            </button>
          </div>
        </div>
      )}
    </StepCard>
  );
}

// ─── Main EnrollmentFlow ───────────────────────────────────────────────────────

export default function EnrollmentFlow({ userType, step, onStepChange, onComplete }: Props) {
  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 style={{ fontFamily: "'DM Sans', sans-serif", fontWeight: 700, fontSize: 22, color: "var(--text-primary)", letterSpacing: "-0.02em" }}>
            My Enrollment — AY 2026–2027 · 2nd Semester
          </h1>
          <p style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 3 }}>Step {step} of 6 · {STEPS[step - 1]}</p>
        </div>
        <div className="flex items-center gap-2">
          {step > 1 && (
            <button className="btn-secondary flex items-center gap-2" onClick={() => onStepChange(step - 1)}>
              <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M11 19l-7-7 7-7M18 19l-7-7 7-7" /></svg>
              Previous Step
            </button>
          )}
          {step < 6 && (
            <button className="btn-primary flex items-center gap-2" onClick={() => onStepChange(step + 1)}>
              Save & Continue
              <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M13 5l7 7-7 7" /></svg>
            </button>
          )}
        </div>
      </div>

      <ProgressTracker current={step} />

      {step === 1 && <Step1 userType={userType} />}
      {step === 2 && <Step2 userType={userType} />}
      {step === 3 && <Step3 />}
      {step === 4 && <Step4 userType={userType} />}
      {step === 5 && <Step5 />}
      {step === 6 && <Step6 onComplete={onComplete} />}

      <div className="flex gap-3 mt-4">
        <button className="btn-secondary flex items-center gap-2">
          <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1-4H9a1 1 0 00-1 1v4a1 1 0 001 1h6a1 1 0 001-1V4a1 1 0 00-1-1z" /></svg>
          Save Draft
        </button>
      </div>
    </div>
  );
}
