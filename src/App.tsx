import { useEffect, useState } from "react";
import { createClient, type Session } from "@supabase/supabase-js";
import { projectId, publicAnonKey } from "../utils/supabase/info";
import { enrollmentApi, type EnrollmentRecord, type StaffStudent } from "./lib/enrollment-api";
import LoginScreen from "./components/LoginScreen";
import Layout from "./components/Layout";
import StudentDashboard from "./components/StudentDashboard";
import EnrollmentFlow from "./components/EnrollmentFlow";
import EnrollmentConfirmed from "./components/EnrollmentConfirmed";
import StaffDashboard from "./components/StaffDashboard";

type AppView = "login" | "student" | "staff" | "confirmed";
type StudentNav = "dashboard" | "enrollment" | "documents" | "support" | "profile";
const supabase = createClient(`https://${projectId}.supabase.co`, publicAnonKey);
const staffRoles = ["registrar", "osas", "scholarship", "cashier"];

export default function App() {
  const [view, setView] = useState<AppView>("login");
  const [userType, setUserType] = useState<"student" | "freshman">("student");
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [enrollment, setEnrollment] = useState<EnrollmentRecord | null>(null);
  const [staffStudents, setStaffStudents] = useState<StaffStudent[]>([]);
  const [studentNav, setStudentNav] = useState<StudentNav>("dashboard");
  const [enrollmentStep, setEnrollmentStep] = useState(1);
  useEffect(() => {
    const syncSession = async (nextSession: Session | null) => {
      setSession(nextSession);
      if (!nextSession) { setRole(null); setEnrollment(null); setStaffStudents([]); setView("login"); return; }
      try {
        let profile: { role: string };
        try {
          profile = await enrollmentApi.profile(nextSession);
        } catch {
          // Email-confirmed freshman accounts may not have had a session at sign-up time.
          profile = await enrollmentApi.createStudentProfile(nextSession);
        }
        setRole(profile.role);
        if (staffRoles.includes(profile.role)) {
          setView("staff");
          const queue = await enrollmentApi.staffEnrollments(nextSession, profile.role);
          setStaffStudents(queue.students);
        } else if (profile.role === "student") {
          setUserType("student"); setView("student"); setStudentNav("dashboard");
          setEnrollment(await enrollmentApi.getEnrollment(nextSession));
        } else setView("login");
      } catch { setView("login"); }
    };
    supabase.auth.getSession().then(({ data }) => syncSession(data.session));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => { void syncSession(nextSession); });
    return () => listener.subscription.unsubscribe();
  }, []);

  const handleLogout = async () => { await supabase.auth.signOut(); setView("login"); setEnrollmentStep(1); };
  const resetToLogin = () => { setView("login"); setEnrollmentStep(1); };
  const saveStep = async (nextStep: number) => {
    if (!session) return;
    const record = await enrollmentApi.saveEnrollment(session, { currentStep: nextStep, status: nextStep >= 6 ? "Ready for confirmation" : "In Progress" });
    setEnrollment(record); setEnrollmentStep(record.currentStep);
  };
  const confirmEnrollment = async (formData: Record<string, unknown>) => {
    if (!session) return;
    const record = await enrollmentApi.confirmEnrollment(session, formData);
    setEnrollment(record); setView("confirmed");
  };

  if (!session || view === "login") return <LoginScreen supabase={supabase} onAccountCreated={() => supabase.auth.refreshSession()} />;

  if (view === "confirmed") {
    return <EnrollmentConfirmed onGoHome={() => { if (session) { setView("student"); setStudentNav("dashboard"); } }} />;
  }

  if (view === "staff") {
    return (
      <StaffDashboard
        role={role ?? "registrar"}
        students={staffStudents}
        onLogout={handleLogout}
      />
    );
  }

  return (
    <Layout
      userType={userType}
      activeNav={studentNav}
      onNav={(nav) => setStudentNav(nav)}
      supabase={supabase}
      onLogout={resetToLogin}
    >
      {studentNav === "dashboard" && (
        <StudentDashboard
          userType={userType}
          enrollmentStep={enrollment?.currentStep ?? enrollmentStep}
          enrollmentStatus={enrollment?.status}
          studentName={session.user.user_metadata.full_name || session.user.email || "Student"}
          onContinue={() => setStudentNav("enrollment")}
          onViewConfirmed={() => setView("confirmed")}
        />
      )}

      {studentNav === "enrollment" && (
        <EnrollmentFlow
          userType={userType}
          step={enrollment?.currentStep ?? enrollmentStep}
          onStepChange={(s) => { void saveStep(s); }}
          onComplete={(formData) => { void confirmEnrollment(formData); }}
        />
      )}

      {studentNav === "documents" && (
        <div className="p-6 max-w-4xl mx-auto">
          <h1 style={{ fontFamily: "'DM Sans', sans-serif", fontWeight: 700, fontSize: 24, color: "var(--text-primary)", letterSpacing: "-0.02em", marginBottom: 8 }}>My Documents</h1>
          <p style={{ fontSize: 14, color: "var(--text-secondary)", marginBottom: 20 }}>Manage your uploaded enrollment documents and downloads.</p>
          <div className="grid grid-cols-2 gap-4">
            {[
              { name: "Student Information Sheet", status: "Uploaded", date: "Jan 8, 2026", type: "upload" },
              { name: "Admission Slip", status: "Uploaded", date: "Jan 8, 2026", type: "upload" },
              { name: "Loading Slip", status: "Pending Upload", date: "—", type: "pending" },
              { name: "Enrollment Form", status: "Not Yet Released", date: "—", type: "locked" },
              { name: "Insurance Receipt", status: "Not Yet Issued", date: "—", type: "locked" },
            ].map((doc, i) => (
              <div key={i} className="card flex items-center gap-4 shadow-sm">
                <div style={{ fontSize: 28, flexShrink: 0 }}>{doc.type === "locked" ? "🔒" : doc.type === "pending" ? "📎" : "📄"}</div>
                <div className="flex-1">
                  <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>{doc.name}</div>
                  <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>{doc.date}</div>
                </div>
                <span className="badge" style={{ background: doc.status === "Uploaded" ? "var(--success-bg)" : doc.type === "pending" ? "var(--warning-bg)" : "#F1F5F9", color: doc.status === "Uploaded" ? "var(--success)" : doc.type === "pending" ? "var(--warning)" : "var(--text-muted)", fontSize: 11 }}>
                  {doc.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {studentNav === "support" && (
        <div className="p-6 max-w-4xl mx-auto">
          <h1 style={{ fontFamily: "'DM Sans', sans-serif", fontWeight: 700, fontSize: 24, color: "var(--text-primary)", letterSpacing: "-0.02em", marginBottom: 8 }}>Student Support</h1>
          <p style={{ fontSize: 14, color: "var(--text-secondary)", marginBottom: 20 }}>Contact and status information for all student support offices.</p>
          <div className="grid grid-cols-3 gap-4">
            {[
              { icon: "🎓", name: "OSAS", desc: "Office for Student Affairs and Services", contact: "osas@chmsu.edu.ph", hours: "Mon–Fri, 8AM–5PM" },
              { icon: "🧠", name: "Guidance Services", desc: "Student counseling and guidance clearance", contact: "guidance@chmsu.edu.ph", hours: "Mon–Fri, 8AM–5PM" },
              { icon: "🏥", name: "Medical Services", desc: "Health clearance and medical records", contact: "medical@chmsu.edu.ph", hours: "Mon–Fri, 7AM–4PM" },
              { icon: "💳", name: "Cashier", desc: "Insurance payment and fee collection", contact: "cashier@chmsu.edu.ph", hours: "Mon–Fri, 8AM–4PM" },
              { icon: "📋", name: "Registrar", desc: "Records, requirements, and enrollment forms", contact: "registrar@chmsu.edu.ph", hours: "Mon–Fri, 8AM–5PM" },
              { icon: "🖥️", name: "ICT-MIS", desc: "School ID processing and technical support", contact: "ict@chmsu.edu.ph", hours: "Mon–Fri, 8AM–5PM" },
            ].map((o, i) => (
              <div key={i} className="card shadow-sm">
                <div style={{ fontSize: 28, marginBottom: 10 }}>{o.icon}</div>
                <div style={{ fontFamily: "'DM Sans', sans-serif", fontWeight: 700, fontSize: 15, color: "var(--text-primary)" }}>{o.name}</div>
                <p style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 4, lineHeight: 1.5 }}>{o.desc}</p>
                <div className="mt-4 space-y-1">
                  <div style={{ fontSize: 12, color: "var(--text-muted)" }}>📧 {o.contact}</div>
                  <div style={{ fontSize: 12, color: "var(--text-muted)" }}>🕐 {o.hours}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {studentNav === "profile" && (
        <div className="p-6 max-w-2xl mx-auto">
          <h1 style={{ fontFamily: "'DM Sans', sans-serif", fontWeight: 700, fontSize: 24, color: "var(--text-primary)", letterSpacing: "-0.02em", marginBottom: 20 }}>My Profile</h1>
          <div className="card shadow-sm">
            <div className="flex items-center gap-5 mb-6 pb-5 border-b" style={{ borderColor: "var(--border)" }}>
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-2xl" style={{ background: "var(--navy-light)" }}>
                {userType === "freshman" ? "🎓" : "C"}
              </div>
              <div>
                <div style={{ fontFamily: "'DM Sans', sans-serif", fontWeight: 700, fontSize: 20, color: "var(--text-primary)" }}>
                  {userType === "freshman" ? "Freshman Applicant" : "Cyrus"}
                </div>
                <div style={{ fontSize: 13, color: "var(--text-muted)" }}>
                  {userType === "freshman" ? "Student Number: Not yet assigned" : "Student No: 2026-0001 · cyrus@gmail.com"}
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {userType !== "freshman" && [
                { label: "Email Address", value: "cyrus@gmail.com" },
                { label: "Student Number", value: "2026-0001" },
                { label: "Academic Year", value: "2026–2027" },
                { label: "Semester", value: "2nd Semester" },
              ].map((f, i) => (
                <div key={i}>
                  <div style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 500 }}>{f.label}</div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)", marginTop: 2 }}>{f.value}</div>
                </div>
              ))}
              {userType === "freshman" && (
                <div className="col-span-2 p-4 rounded-xl" style={{ background: "var(--navy-light)", border: "1px solid var(--blue-mid)" }}>
                  <div style={{ fontSize: 13, color: "var(--navy)", fontWeight: 600 }}>Freshman Applicant</div>
                  <p style={{ fontSize: 12, color: "#3B82F6", marginTop: 4 }}>Your student number will be assigned after enrollment is confirmed by the Registrar.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}

