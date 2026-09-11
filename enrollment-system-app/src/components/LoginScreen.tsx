interface Props {
  onLogin: (userType: "student" | "freshman") => void;
  onAccessStaff: () => void;
}

export default function LoginScreen({ onLogin, onAccessStaff }: Props) {
  return (
    <div className="min-h-screen flex flex-col" style={{ background: "var(--surface)" }}>
      <div className="flex flex-1">
        {/* Left Panel */}
        <div className="hidden lg:flex flex-col justify-between w-96 p-10" style={{ background: "var(--navy)" }}>
          <div>
            <div className="flex items-center gap-3 mb-12">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "rgba(37,99,235,0.3)" }}>
                <svg width="22" height="22" fill="none" stroke="#93C5FD" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M12 14l9-5-9-5-9 5 9 5z" /><path d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" />
                </svg>
              </div>
              <div>
                <div style={{ fontFamily: "'DM Sans', sans-serif", fontWeight: 700, fontSize: 16, color: "#fff", letterSpacing: "-0.02em" }}>CHMSU</div>
                <div style={{ fontSize: 11, color: "#94A3B8", letterSpacing: "0.05em" }}>ENROLLMENT PORTAL</div>
              </div>
            </div>

            <div className="space-y-8 mt-4">
              <div>
                <h1 style={{ fontFamily: "'DM Sans', sans-serif", fontWeight: 700, fontSize: 30, color: "#fff", lineHeight: 1.2, letterSpacing: "-0.02em" }}>
                  Online Enrollment System
                </h1>
                <p style={{ color: "#94A3B8", fontSize: 15, marginTop: 12, lineHeight: 1.6 }}>
                  Carlos Hilado Memorial State University — Academic Year 2026–2027
                </p>
              </div>

              <div className="space-y-4">
                {[
                  { icon: "📋", label: "Complete your enrollment online", sub: "Submit forms and requirements digitally" },
                  { icon: "🔔", label: "Track your enrollment status", sub: "Real-time updates from all offices" },
                  { icon: "📄", label: "Download your enrollment form", sub: "Official form released after final approval" },
                ].map((item, i) => (
                  <div key={i} className="flex items-start gap-3 p-4 rounded-xl" style={{ background: "rgba(255,255,255,0.05)" }}>
                    <span style={{ fontSize: 18 }}>{item.icon}</span>
                    <div>
                      <div style={{ color: "#E2E8F0", fontSize: 14, fontWeight: 500 }}>{item.label}</div>
                      <div style={{ color: "#64748B", fontSize: 12, marginTop: 2 }}>{item.sub}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div style={{ color: "#475569", fontSize: 12 }}>
            © 2026 Carlos Hilado Memorial State University · ICT-MIS
          </div>
        </div>

        {/* Right Panel */}
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="w-full max-w-md space-y-6">
            {/* Header */}
            <div className="text-center mb-2">
              <div className="flex justify-center mb-4 lg:hidden">
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: "var(--navy)" }}>
                  <svg width="22" height="22" fill="none" stroke="#93C5FD" strokeWidth="2" viewBox="0 0 24 24">
                    <path d="M12 14l9-5-9-5-9 5 9 5z" /><path d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" />
                  </svg>
                </div>
              </div>
              <h2 style={{ fontFamily: "'DM Sans', sans-serif", fontWeight: 700, fontSize: 26, color: "var(--text-primary)", letterSpacing: "-0.02em" }}>
                Student Sign In
              </h2>
              <p style={{ color: "var(--text-secondary)", fontSize: 14, marginTop: 6 }}>
                Use your student ID and portal password
              </p>
            </div>

            {/* Login Form Card */}
            <div className="card shadow-sm">
              <div className="space-y-4">
                <div>
                  <label className="form-label">Student ID Number</label>
                  <input
                    className="form-input"
                    type="text"
                    placeholder="e.g. 2026-0001"
                    autoComplete="username"
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="form-label" style={{ marginBottom: 0 }}>Password</label>
                    <button
                      style={{ fontSize: 13, color: "var(--blue)", background: "none", border: "none", cursor: "pointer", fontWeight: 500, padding: 0 }}
                    >
                      Forgot Password?
                    </button>
                  </div>
                  <input
                    className="form-input"
                    type="password"
                    placeholder="Enter your password"
                    autoComplete="current-password"
                  />
                </div>

                <button
                  className="btn-primary w-full mt-2"
                  onClick={() => onLogin("student")}
                  style={{ padding: "12px 20px", fontSize: 15 }}
                >
                  Sign In
                </button>

                <div className="text-center">
                  <button
                    style={{ fontSize: 13, color: "var(--text-secondary)", background: "none", border: "none", cursor: "pointer" }}
                  >
                    Don&apos;t have an account?{" "}
                    <span style={{ color: "var(--blue)", fontWeight: 600 }}>Request Account Access</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Divider */}
            <div className="flex items-center gap-3">
              <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
              <span style={{ fontSize: 13, color: "var(--text-muted)", whiteSpace: "nowrap" }}>or</span>
              <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
            </div>

            {/* Freshman Card */}
            <div className="card" style={{ borderColor: "#BFDBFE", background: "var(--blue-light)" }}>
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "var(--blue)", marginTop: 2 }}>
                  <svg width="18" height="18" fill="none" stroke="#fff" strokeWidth="2" viewBox="0 0 24 24">
                    <path d="M12 14l9-5-9-5-9 5 9 5z" /><path d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" />
                  </svg>
                </div>
                <div className="flex-1">
                  <div style={{ fontFamily: "'DM Sans', sans-serif", fontWeight: 700, fontSize: 15, color: "var(--navy)" }}>
                    New here? Start as a freshie.
                  </div>
                  <p style={{ fontSize: 13, color: "#3B82F6", marginTop: 4, lineHeight: 1.5 }}>
                    Begin your enrollment without a student ID or portal account.
                  </p>
                  <button
                    className="btn-primary mt-4"
                    onClick={() => onLogin("freshman")}
                    style={{ background: "var(--navy)", fontSize: 13, padding: "9px 16px" }}
                  >
                    Freshman Enrollment →
                  </button>
                </div>
              </div>
            </div>

            {/* Staff link */}
            <div className="text-center">
              <span style={{ fontSize: 13, color: "var(--text-muted)" }}>
                Staff?{" "}
                <button
                  onClick={onAccessStaff}
                  style={{ color: "var(--blue)", background: "none", border: "none", cursor: "pointer", fontWeight: 500, fontSize: 13 }}
                >
                  Access Staff Portal
                </button>
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
