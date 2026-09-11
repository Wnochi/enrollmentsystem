import { Building2, LogIn } from "lucide-react";
import { useState } from "react";

interface Props {
  onLogin: (role: string) => void;
  onBackToStudent: () => void;
}

const staffRoles = [
  { id: "registrar", label: "Registrar" },
  { id: "osas", label: "OSAS" },
  { id: "cashier", label: "Cashier" },
  { id: "scholarship", label: "Scholarship" },
];

export default function StaffLoginScreen({ onLogin, onBackToStudent }: Props) {
  const [role, setRole] = useState("registrar");

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "var(--surface)" }}>
      <main className="flex-1 flex items-center justify-center p-6">
        <section className="w-full max-w-md">
          <div className="text-center mb-6">
            <div className="w-12 h-12 rounded-2xl inline-flex items-center justify-center mb-4" style={{ background: "var(--navy)" }}>
              <Building2 size={23} strokeWidth={2} color="#93C5FD" aria-hidden="true" />
            </div>
            <p style={{ color: "var(--blue)", fontSize: 12, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}>CHMSU Enrollment</p>
            <h1 style={{ fontFamily: "'DM Sans', sans-serif", fontWeight: 700, fontSize: 27, color: "var(--text-primary)", letterSpacing: "-0.02em", marginTop: 4 }}>Staff Sign In</h1>
            <p style={{ color: "var(--text-secondary)", fontSize: 14, marginTop: 6 }}>Use your authorized staff portal credentials.</p>
          </div>

          <div className="card shadow-sm">
            <div className="space-y-4">
              <div>
                <label className="form-label" htmlFor="staff-id">Staff ID or email</label>
                <input id="staff-id" className="form-input" type="text" placeholder="e.g. registrar@chmsu.edu.ph" autoComplete="username" />
              </div>
              <div>
                <label className="form-label" htmlFor="staff-password">Password</label>
                <input id="staff-password" className="form-input" type="password" placeholder="Enter your password" autoComplete="current-password" />
              </div>
              <div>
                <label className="form-label" htmlFor="staff-role">Portal role</label>
                <select id="staff-role" className="form-select" value={role} onChange={(event) => setRole(event.target.value)}>
                  {staffRoles.map((role) => <option key={role.id} value={role.id}>{role.label}</option>)}
                </select>
              </div>
              <button
                className="btn-primary w-full flex items-center justify-center gap-2"
                onClick={() => onLogin(role)}
                style={{ padding: "12px 20px", fontSize: 15 }}
              >
                <LogIn size={18} strokeWidth={2} aria-hidden="true" />
                Sign In to Staff Portal
              </button>
            </div>
          </div>

          <button onClick={onBackToStudent} className="w-full mt-5" style={{ color: "var(--text-secondary)", background: "none", border: "none", cursor: "pointer", fontSize: 13 }}>
            Return to Student Sign In
          </button>
        </section>
      </main>
    </div>
  );
}
