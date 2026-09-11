import { ReactNode } from "react"
import {
  Bell,
  ClipboardList,
  Folder,
  Headphones,
  LayoutDashboard,
  LogOut,
  UserRound,
  type LucideIcon,
} from "lucide-react"

type StudentView = "dashboard" | "enrollment" | "documents" | "support" | "profile"
interface Props {
  children: ReactNode
  userType: "student" | "freshman"
  activeNav: StudentView
  onNav: (v: StudentView) => void
  onLogout: () => void
}

const navItems: { id: StudentView; label: string; Icon: LucideIcon }[] = [
  {
    id: "dashboard",
    label: "Dashboard",
    Icon: LayoutDashboard,
  },
  {
    id: "enrollment",
    label: "My Enrollment",
    Icon: ClipboardList,
  },
  {
    id: "documents",
    label: "Documents",
    Icon: Folder,
  },
  {
    id: "support",
    label: "Student Support",
    Icon: Headphones,
  },
  {
    id: "profile",
    label: "My Profile",
    Icon: UserRound,
  },
]

export default function Layout({
  children,
  userType,
  activeNav,
  onNav,
  onLogout,
}: Props) {
  return (
    <div className="flex flex-col h-full">
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside
          className="flex-shrink-0 flex flex-col w-56 overflow-y-auto"
          style={{ background: "var(--navy)", minHeight: 0 }}
        >
          {/* Logo */}
          <div className="flex items-center gap-3 px-5 py-5 flex-shrink-0">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ background: "rgba(37,99,235,0.3)" }}
            >
              <svg
                width="16"
                height="16"
                fill="none"
                stroke="#93C5FD"
                strokeWidth="2"
                viewBox="0 0 24 24"
              >
                <path d="M12 14l9-5-9-5-9 5 9 5z" />
              </svg>
            </div>
            <div>
              <div
                style={{
                  fontFamily: "'DM Sans', sans-serif",
                  fontWeight: 700,
                  fontSize: 14,
                  color: "#fff",
                  letterSpacing: "-0.01em",
                }}
              >
                CHMSU
              </div>
              <div
                style={{
                  fontSize: 10,
                  color: "#64748B",
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                }}
              >
                Enrollment
              </div>
            </div>
          </div>

          {/* AY Badge */}
          <div
            className="mx-4 mb-4 px-3 py-2 rounded-lg"
            style={{
              background: "rgba(37,99,235,0.2)",
              border: "1px solid rgba(37,99,235,0.3)",
            }}
          >
            <div
              style={{
                fontSize: 11,
                color: "#93C5FD",
                fontWeight: 600,
                letterSpacing: "0.04em",
              }}
            >
              AY 2026-2027
            </div>
            <div style={{ fontSize: 12, color: "#94A3B8", marginTop: 1 }}>
              2nd Semester
            </div>
          </div>

          {/* Nav */}
          <nav className="flex-1 px-3 space-y-0.5">
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => onNav(item.id)}
                className={`sidebar-nav-item w-full text-left ${
                  activeNav === item.id ? "active" : ""
                }`}
              >
                <item.Icon size={19} strokeWidth={2} aria-hidden="true" />
                {item.label}
              </button>
            ))}
          </nav>

          {/* User Info */}
          <div
            className="px-4 py-4 border-t flex-shrink-0"
            style={{ borderColor: "rgba(255,255,255,0.08)" }}
          >
            <div className="flex items-center gap-3">
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                style={{ background: "rgba(37,99,235,0.3)" }}
              >
                <svg
                  width="14"
                  height="14"
                  fill="none"
                  stroke="#93C5FD"
                  strokeWidth="2"
                  viewBox="0 0 24 24"
                >
                  <circle cx="12" cy="8" r="4" />
                  <path d="M4 20c0-4 3.582-7 8-7s8 3 8 7" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: "#E2E8F0",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {userType === "freshman" ? "Freshman Applicant" : "Cyrus"}
                </div>
                <div style={{ fontSize: 11, color: "#64748B" }}>
                  {userType === "freshman" ? "Not yet assigned" : "2026-0001"}
                </div>
              </div>
              <button
                onClick={onLogout}
                title="Sign Out"
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: "#64748B",
                  flexShrink: 0,
                }}
              >
                <LogOut size={18} strokeWidth={2} aria-hidden="true" />
              </button>
            </div>
          </div>
        </aside>

        {/* Main */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Header */}
          <header
            className="flex-shrink-0 flex items-center justify-between px-6 bg-white border-b"
            style={{ height: 56, borderColor: "var(--border)" }}
          >
            <div className="flex items-center gap-2">
              <span style={{ fontSize: 13, color: "var(--text-muted)" }}>
                Student Portal
              </span>
              <svg
                width="14"
                height="14"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                viewBox="0 0 24 24"
                style={{ color: "var(--text-muted)" }}
              >
                <path d="M9 18l6-6-6-6" />
              </svg>
              <span
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: "var(--text-primary)",
                  textTransform: "capitalize",
                }}
              >
                {activeNav === "enrollment"
                  ? "My Enrollment"
                  : activeNav === "support"
                    ? "Student Support"
                    : activeNav.charAt(0).toUpperCase() + activeNav.slice(1)}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <div
                className="badge"
                style={{
                  background: "var(--blue-light)",
                  color: "var(--blue)",
                  fontSize: 11,
                }}
              >
                <span
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: "50%",
                    background: "var(--blue)",
                    display: "inline-block",
                  }}
                />
                Enrollment Open
              </div>
              <button
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 8,
                  border: "1px solid var(--border)",
                  background: "none",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "var(--text-secondary)",
                }}
              >
                <Bell size={19} strokeWidth={2} aria-hidden="true" />
              </button>
            </div>
          </header>

          {/* Content */}
          <main
            className="flex-1 overflow-y-auto"
            style={{ background: "var(--surface)" }}
          >
            {children}
          </main>
        </div>
      </div>
    </div>
  )
}
