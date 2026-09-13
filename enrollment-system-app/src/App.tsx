import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react"

import {
  Bell,
  BookOpen,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  Eye,
  EyeOff,
  FileText,
  GraduationCap,
  LayoutDashboard,
  LockKeyhole,
  LogOut,
  Menu,
  Search,
  ShieldCheck,
  Upload,
  UserRound,
  Users,
  X,
} from "lucide-react"

import {
  addEvent,
  addProgram,
  assignSubjectSections,
  clearSubjectSections,
  deactivateProgram,
  getAcademicReferenceData,
  getDocumentLink,
  getEnrollments,
  getSubjectSections,
  isSupabaseConfigured,
  registerFreshman,
  requestAccess,
  resetPassword,
  restoreProfile,
  roleLabel,
  saveEnrollment,
  signIn,
  signOut,
  stateLabel,
  supabase,
  uploadDocument,
  type AcademicReferences,
  type Enrollment,
  type Office,
  type Profile,
  type Role,
  type ScholarshipDetails,
  type StudentForm,
  type SubjectSection,
} from "./lib/system"

const offices: Office[] = ["registrar", "osas", "guidance", "medical", "scholarship", "cashier", "ict"]

const steps = [
  "Student information",
  "Registrar requirements",
  "Assessment & insurance",
  "Support clearances",
  "School ID",
  "Final review",
]

const requirements: Record<string, string[]> = {
  freshman: [
    "Senior High School Report Card",
    "Certificate of Good Moral Character",
    "PSA Birth Certificate",
    "2 × 2 ID picture",
    "Student Information Sheet",
  ],

  transferee: [
    "Transfer Credential",
    "Transcript of Records",
    "Certificate of Good Moral Character",
    "PSA Birth Certificate",
    "Student Information Sheet",
  ],

  continuing: [
    "Accomplished Clearance Form",
    "Previous Enrollment Form",
    "Loading Slip (if irregular)",
  ],

  returning: [
    "Accomplished Clearance Form",
    "Previous Enrollment Form",
    "Registrar re-admission approval",
  ],
}

type PortalRoute = "overview" | "enroll" | "documents" | "updates" | "queue" | "activity" | "academic"
type ActionState = { status: "idle" | "pending" | "success" | "error"; message?: string }

const routeForRole = (role: Role): PortalRoute => role === "student" ? "overview" : "queue"
const validRoutes = (role: Role): PortalRoute[] => role === "student" ? ["overview", "enroll", "documents", "updates"] : ["queue", "activity", "academic"]
const readRoute = (role: Role) => {
  const route = location.hash.slice(1) as PortalRoute
  return validRoutes(role).includes(route) ? route : routeForRole(role)
}
const enrollmentStatusLabel = (value: string) => ({ draft: "Incomplete", submitted: "Submitted", in_review: "Awaiting review", returned: "Returned for correction", confirmed: "Approved / confirmed" }[value] ?? stateLabel(value))
const correctionStep = (item: Enrollment) => item.offices.registrar === "returned" ? 2 : item.payment.status === "rejected" ? 3 : (["osas", "guidance", "medical", "scholarship"] as Office[]).some(office => item.offices[office] === "returned") ? 4 : item.idStatus === "scheduled" && item.status === "returned" ? 5 : 2
const documentFilename = (path: string) => path.includes("/") ? path.slice(path.lastIndexOf("/") + 1).replace(/^[0-9a-f-]{36}-/i, "") : path.replace(/\s+\(\d+ KB\)$/, "")
const documentOffice = (name: string) => name.toLowerCase().includes("payment") ? "cashier" : name.toLowerCase().includes("medical") ? "medical" : "registrar"
const staffStatuses = (office: Office) => office === "cashier" ? ["ready", "submitted", "verifying", "confirmed", "rejected"] : office === "ict" ? ["not_started", "scheduled", "captured", "processing", "ready", "completed"] : ["not_started", "submitted", "under_review", "returned", "cleared"]
const staffStatusFor = (item: Enrollment, office: Office) => office === "cashier" ? item.payment.status : office === "ict" ? item.idStatus : item.offices[office]
const errorMessage = (reason: unknown, fallback: string) => reason instanceof Error ? reason.message : typeof reason === "object" && reason !== null && "message" in reason ? String(reason.message) : fallback
const isMissingBackendCapability = (message: string) => message.includes("An administrator must apply the current Supabase migrations")
const isRetryableError = (message: string) => /network|fetch|timeout|temporar|connection|offline|rate limit/i.test(message)
const officeLabel = (office: Office) => roleLabel(office)
const countStatus = (items: Enrollment[], office: Office, status: string) => items.filter((item) => staffStatusFor(item, office) === status).length
const officeComplete = (item: Enrollment, office: Office) => office === "cashier" ? item.payment.status === "confirmed" : office === "ict" ? ["ready", "completed"].includes(item.idStatus) : item.offices[office] === "cleared"
const officeItems = (items: Enrollment[], office: Office) => items.filter((item) => !officeComplete(item, office))
const countScholarship = (items: Enrollment[], predicate: (value: ScholarshipDetails) => boolean) => items.filter((item) => predicate(item.scholarship)).length
const routeTitle = (route: PortalRoute) => ({ overview: "Enrollment overview", enroll: "Enrollment form", documents: "Documents", updates: "Activity", queue: "Enrollment queue", activity: "Activity history", academic: "Academic setup" })[route]

export default function App() {
  const [profile, setProfile] = useState<Profile | null>(null)

  const [loading, setLoading] = useState(true)

  useEffect(() => {
    restoreProfile()
      .then(setProfile)
      .catch(() => setProfile(null))
      .finally(() => setLoading(false))
  }, [])

  if (loading)
    return (
      <Centered>
        <div className="spinner" />
        <p>Loading enrollment portal…</p>
      </Centered>
    )

  if (!profile) return <Auth onAuthenticated={setProfile} />

  return (
    <Portal
      profile={profile}
      onExit={async () => {
        await signOut()
        setProfile(null)
      }}
    />
  )
}

function Auth({
  onAuthenticated,
}: {
  onAuthenticated: (profile: Profile) => void
}) {
  const [mode, setMode] = useState<"signin" | "freshman" | "access">("signin")

  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: isSupabaseConfigured ? "" : "student@demo.chmsu.edu.ph",
    password: isSupabaseConfigured ? "" : "Student123!",
    confirmPassword: "",
    message: "",
    consent: false,
  })

  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState("")
  const [error, setError] = useState("")

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setBusy(true)
    setError("")
    setNotice("")

    try {
      if (mode === "signin")
        onAuthenticated(await signIn(form.email, form.password))
      else if (mode === "freshman") {
        if (!form.firstName.trim() || !form.lastName.trim())
          throw new Error("Enter your first and last name.")

        if (form.password.length < 8)
          throw new Error("Use at least 8 characters for your password.")

        if (form.password !== form.confirmPassword)
          throw new Error("Passwords do not match.")

        if (!form.consent)
          throw new Error(
            "Confirm that your information is accurate to continue.",
          )

        const result = await registerFreshman(
          form.firstName,
          form.lastName,
          form.email,
          form.password,
        )

        if (result.status === "confirmation_required") {
          setMode("signin")

          setForm((previous) => ({
            ...previous,
            email: result.email,
            password: "",
            confirmPassword: "",
            consent: false,
          }))

          setNotice(
            "Account created. Check your email to confirm your account, then sign in.",
          )
        } else onAuthenticated(result.profile)
      } else {
        await requestAccess(form.email, form.message)
        setNotice("Your access request was sent to the Registrar.")
      }
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Something went wrong.",
      )
    } finally {
      setBusy(false)
    }
  }

  const chooseDemo = (role: Role) =>
    setForm({
      ...form,
      email: `${role}@demo.chmsu.edu.ph`,
      password: role === "student" ? "Student123!" : "Staff123!",
    })

  const switchMode = (next: "signin" | "freshman" | "access") => {
    setMode(next)
    setError("")
    setNotice("")
    setShowPassword(false)
    setShowConfirmPassword(false)
  }

  const registration = mode === "freshman"

  return (
    <div className="auth-page">
      <header className="university-header">
        <div className="university-identity"><GraduationCap aria-hidden="true" /><div><strong>Carlos Hilado Memorial State University</strong><span>Office of the Registrar</span></div></div>
        <span className="portal-label">Student & administrator services</span>
      </header>
      <section className="auth-intro"><p className="eyebrow">CHMSU / ENROLLMENT</p><h1>Online enrollment</h1><p>Access your enrollment record, submit requirements, and check office clearances.</p></section>
      <main className="auth-panel">
        <div className={`auth-card ${registration ? "registration-card" : ""}`}>
          <div className="auth-heading">
            <h2>
              {mode === "signin"
                ? "Sign in to your account"
                : mode === "freshman"
                  ? "Create your freshman account"
                  : "Request account access"}
            </h2>
            <p className="muted">
              {mode === "signin"
                ? "Sign in with your student or staff account."
                : mode === "freshman"
                  ? "Enter your details to create an enrollment account."
                  : "Tell the Registrar which email should receive access."}
            </p>
          </div>
          <form onSubmit={submit} className="stack">
            {registration && (
              <div className="registration-fields">
                <div className="name-grid">
                  <Field label="First name">
                    <input
                      required
                      autoComplete="given-name"
                      value={form.firstName}
                      onChange={(e) =>
                        setForm({ ...form, firstName: e.target.value })
                      }
                    />
                  </Field>
                  <Field label="Last name">
                    <input
                      required
                      autoComplete="family-name"
                      value={form.lastName}
                      onChange={(e) =>
                        setForm({ ...form, lastName: e.target.value })
                      }
                    />
                  </Field>
                </div>
              </div>
            )}
            <Field label="Email address">
              <input
                required
                autoComplete="email"
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </Field>
            {mode !== "access" && (
              <Field label="Password">
                <div className="password-control">
                  <input
                    required
                    minLength={8}
                    autoComplete={
                      registration ? "new-password" : "current-password"
                    }
                    type={showPassword ? "text" : "password"}
                    value={form.password}
                    onChange={(e) =>
                      setForm({ ...form, password: e.target.value })
                    }
                  />
                  <button
                    type="button"
                    className="password-toggle"
                    aria-label={
                      showPassword ? "Hide password" : "Show password"
                    }
                    onClick={() => setShowPassword((value) => !value)}
                  >
                    {showPassword ? <EyeOff /> : <Eye />}
                  </button>
                </div>
                {registration && (
                  <span className="field-hint">
                    Use at least 8 characters. A mix of letters and numbers is
                    recommended.
                  </span>
                )}
              </Field>
            )}
            {registration && (
              <Field label="Confirm password">
                <div className="password-control">
                  <input
                    required
                    minLength={8}
                    autoComplete="new-password"
                    type={showConfirmPassword ? "text" : "password"}
                    value={form.confirmPassword}
                    onChange={(e) =>
                      setForm({ ...form, confirmPassword: e.target.value })
                    }
                  />
                  <button
                    type="button"
                    className="password-toggle"
                    aria-label={
                      showConfirmPassword
                        ? "Hide confirm password"
                        : "Show confirm password"
                    }
                    onClick={() => setShowConfirmPassword((value) => !value)}
                  >
                    {showConfirmPassword ? <EyeOff /> : <Eye />}
                  </button>
                </div>
                {form.confirmPassword &&
                  form.password !== form.confirmPassword && (
                    <span className="field-error">
                      Passwords do not match yet.
                    </span>
                  )}
              </Field>
            )}
            {mode === "access" && (
              <Field label="Reason">
                <textarea
                  required
                  value={form.message}
                  onChange={(e) =>
                    setForm({ ...form, message: e.target.value })
                  }
                />
              </Field>
            )}
            {registration && (
              <label className="consent-row">
                <input
                  type="checkbox"
                  checked={form.consent}
                  onChange={(e) =>
                    setForm({ ...form, consent: e.target.checked })
                  }
                />
                <span>
                  I confirm that the information I provide is accurate and may
                  be used for enrollment processing.
                </span>
              </label>
            )}
            {error && <Alert tone="error">{error}</Alert>}
            {notice && <Alert tone="success">{notice}</Alert>}
            <button className="primary" disabled={busy}>
              {busy
                ? mode === "signin" ? "Signing in…" : mode === "freshman" ? "Creating account…" : "Sending request…"
                : mode === "signin"
                  ? "Sign in"
                  : mode === "freshman"
                    ? "Create account"
                    : "Send request"}
            </button>
          </form>
          {mode === "signin" && (
            <button
              className="link"
              onClick={async () => {
                await resetPassword(form.email)
                setNotice(
                  "If the account exists, a recovery email has been sent.",
                )
              }}
            >
              Forgot password?
            </button>
          )}
          <div className="auth-switches">
            <button
              onClick={() =>
                switchMode(mode === "freshman" ? "signin" : "freshman")
              }
            >
              {mode === "freshman"
                ? "Already have an account? Sign in"
                : "New student? Start enrollment"}
            </button>
            {mode !== "freshman" && (
              <button
                onClick={() =>
                  switchMode(mode === "access" ? "signin" : "access")
                }
              >
                {mode === "access"
                  ? "Return to sign in"
                  : "Request account access"}
              </button>
            )}
          </div>
          {!isSupabaseConfigured && (
            <details className="demo-box">
              <summary>Demo accounts</summary>
              <p>Student: student@demo.chmsu.edu.ph / Student123!</p>
              <div className="demo-roles">
                {(["student", "admin"] as Role[]).map((role) => (
                  <button key={role} onClick={() => chooseDemo(role)}>
                    {roleLabel(role)}
                  </button>
                ))}
              </div>
            </details>
          )}
        </div>
      </main>
    </div>
  )
}

function Portal({ profile, onExit }: { profile: Profile; onExit: () => void }) {
  const [items, setItems] = useState<Enrollment[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState("")
  const [mobile, setMobile] = useState(false)
  const [route, setRoute] = useState<PortalRoute>(() => readRoute(profile.role))
  const [updateAvailable, setUpdateAvailable] = useState(false)
  const [references, setReferences] = useState<AcademicReferences | null>(null)
  const dirtyRef = useRef(false)
  const sidebarRef = useRef<HTMLElement>(null)
  const menuButtonRef = useRef<HTMLButtonElement>(null)
  const mainRef = useRef<HTMLElement>(null)

  const setDirty = (dirty: boolean) => {
    dirtyRef.current = dirty
    if (!dirty) setUpdateAvailable(false)
  }
  const reload = async (force = false) => {
    if (!force && dirtyRef.current) return setUpdateAvailable(true)
    setLoadError("")
    try { setItems(await getEnrollments(profile)) }
    catch (reason) { setLoadError(errorMessage(reason, "Enrollment records could not be loaded.")) }
    finally { setLoading(false) }
  }

  useEffect(() => { void reload(true) }, [profile.id])
  useEffect(() => {
    getAcademicReferenceData().then(setReferences).catch(() => setReferences(null))
  }, [])
  useEffect(() => {
    const syncRoute = () => {
      const next = readRoute(profile.role)
      if (!validRoutes(profile.role).includes(location.hash.slice(1) as PortalRoute)) history.replaceState(null, "", `#${next}`)
      setRoute(next)
    }
    window.addEventListener("hashchange", syncRoute)
    syncRoute()
    return () => window.removeEventListener("hashchange", syncRoute)
  }, [profile.role])
  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      mainRef.current?.querySelector<HTMLElement>("[data-page-heading]")?.focus()
    })
    return () => window.cancelAnimationFrame(frame)
  }, [route, loading, loadError])
  useEffect(() => {
    const drawer = sidebarRef.current
    const updateInert = () => drawer?.toggleAttribute("inert", !mobile && window.matchMedia("(max-width: 899px)").matches)
    updateInert()
    window.addEventListener("resize", updateInert)
    return () => window.removeEventListener("resize", updateInert)
  }, [mobile])
  useEffect(() => {
    if (!mobile) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    const drawer = sidebarRef.current
    const focusable = () => Array.from(drawer?.querySelectorAll<HTMLElement>("a[href], button, input, select, textarea") ?? []).filter((element) => !element.hasAttribute("disabled"))
    focusable()[0]?.focus()
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault()
        setMobile(false)
        return
      }
      if (event.key !== "Tab") return
      const elements = focusable()
      if (!elements.length) return
      const first = elements[0]
      const last = elements[elements.length - 1]
      if (!drawer?.contains(document.activeElement)) {
        event.preventDefault()
        const edge = event.shiftKey ? last : first
        edge.focus()
      } else if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    document.addEventListener("keydown", onKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener("keydown", onKeyDown)
      menuButtonRef.current?.focus()
    }
  }, [mobile])
  useEffect(() => {
    const client = supabase
    if (!client) return
    const channel = client.channel(`enrollments:${profile.id}`).on("postgres_changes", { event: "*", schema: "public", table: "enrollments" }, () => { void reload() }).subscribe()
    return () => { void client.removeChannel(channel) }
  }, [profile.id])

  const persist = async (item: Enrollment, action = "save", office?: Office) => {
    await saveEnrollment(item, action, profile.role, office)
    try {
      setItems(await getEnrollments(profile))
      setLoadError("")
    } catch {
      throw new Error("Your change was saved, but the latest record could not be loaded. Refresh the page before trying again.")
    }
    setDirty(false)
  }
  const navigate = (next: PortalRoute) => { if (location.hash !== `#${next}`) location.hash = next; setMobile(false) }
  const navItems = profile.role === "student" ? [
    ["overview", <LayoutDashboard />, "Enrollment overview"], ["enroll", <ClipboardList />, "Enrollment form"], ["documents", <FileText />, "Documents"], ["updates", <Bell />, "Activity"],
  ] as const : profile.role === "admin" ? [
    ["queue", <Users />, "Dashboard"], ["activity", <ClipboardList />, "Activity history"], ["academic", <BookOpen />, "Academic setup"],
  ] as const : [
    ["queue", <Users />, "Dashboard"], ["activity", <ClipboardList />, "Activity history"],
  ] as const
  const selectedTerm = references?.terms.find((term) => term.id === items[0]?.academic.termId)
  const termLabel = selectedTerm ? `${selectedTerm.academicYear} · ${selectedTerm.semester}` : ""

  return (
    <div className="app-shell">
      {mobile && <button className="mobile-backdrop" tabIndex={-1} aria-label="Close navigation" onMouseDown={(event) => { event.preventDefault(); setMobile(false) }} onClick={() => setMobile(false)} />}
      <aside className={mobile ? "sidebar open" : "sidebar"} ref={sidebarRef} aria-label="Portal navigation" role={mobile ? "dialog" : undefined} aria-modal={mobile ? true : undefined}>
        <div className="logo">
          <div className="brand-mark small">
            <GraduationCap />
          </div>
          <div>
            <strong>CHMSU</strong>
            <span>Enrollment Hub</span>
          </div>
          <button className="icon mobile-only" aria-label="Close navigation" onClick={() => setMobile(false)}>
            <X />
          </button>
        </div>
        <nav aria-label="Primary">
          {navItems.map(([href, icon, label]) => <Nav key={href} href={href} icon={icon} label={label} active={route === href} onNavigate={navigate} />)}
        </nav>
        <div className="user-card">
          <div className="avatar">{profile.fullName[0]}</div>
          <div>
            <strong>{profile.fullName}</strong>
            <span>{roleLabel(profile.role)}</span>
          </div>
          <button className="signout" onClick={onExit}><LogOut /> <span>Sign out</span></button>
        </div>
      </aside>
      <div className="main-column">
        <header className="topbar">
          <button className="icon mobile-only" aria-label="Open navigation" ref={menuButtonRef} onClick={() => setMobile(true)}>
            <Menu />
          </button>
          <div>
            <p className="eyebrow">CHMSU ONLINE SERVICES</p>
            <strong>{route === "queue" && profile.role !== "student" ? `${roleLabel(profile.role)} dashboard` : routeTitle(route)}</strong>
          </div>
          {termLabel && <span className="term-context">{termLabel}</span>}
        </header>
        <main className="content" ref={mainRef}>
          {loading ? (
            <Centered>
              <div className="spinner" />
              <p>Loading records…</p>
            </Centered>
          ) : loadError ? (
            <section className="card state-card"><Alert tone="error">{loadError}</Alert>{!isMissingBackendCapability(loadError) && <button className="secondary" onClick={() => void reload(true)}>Retry</button>}</section>
          ) : profile.role === "student" ? (
            <StudentPortal item={items[0]} persist={persist} route={route} onNavigate={navigate} onDirtyChange={setDirty} updateAvailable={updateAvailable} onRefresh={() => { setDirty(false); void reload(true) }} />
          ) : route === "academic" ? <AdminPortal items={items} /> : route === "activity" ? <ActivityHistory items={items} /> : <StaffPortal items={items} persist={persist} />}
        </main>
      </div>
    </div>
  )
}

function StudentPortal({
  item,
  persist,
  route,
  onNavigate,
  onDirtyChange,
  updateAvailable,
  onRefresh,
}: {
  item?: Enrollment
  persist: (item: Enrollment, action?: string, office?: Office) => Promise<void>
  route: PortalRoute
  onNavigate: (route: PortalRoute) => void
  onDirtyChange: (dirty: boolean) => void
  updateAvailable: boolean
  onRefresh: () => void
}) {
  const [working, setWorking] = useState(item)
  const [notice, setNotice] = useState("")
  const [saveState, setSaveState] = useState<ActionState>({ status: "idle" })
  const lastSave = useRef<(() => Promise<void>) | null>(null)
  const dirtyRef = useRef(false)

  const [references, setReferences] = useState<AcademicReferences | null>(null)
  const [referenceError, setReferenceError] = useState("")

  useEffect(() => { if (!dirtyRef.current) setWorking(item) }, [item])

  useEffect(() => {
    getAcademicReferenceData()
      .then(setReferences)
      .catch((reason) =>
        setReferenceError(
          reason instanceof Error
            ? reason.message
            : "Academic reference data could not be loaded.",
        ),
      )
  }, [])

  if (!working)
    return (
      <Empty
        title="No enrollment record"
        text="Create a freshman enrollment from the sign-in page or ask the Registrar to open a record."
      />
    )

  const updateWorking = (next: Enrollment) => { dirtyRef.current = true; setWorking(next); setSaveState({ status: "idle" }); setNotice(""); onDirtyChange(true) }
  const save = async (
    next = working,
    action = "save",
    message = "Draft saved.",
  ) => {
    lastSave.current = null
    setWorking(next)
    setSaveState({ status: "pending", message: action === "save" ? "Saving…" : "Submitting…" })
    try {
      await persist(next, action)
      dirtyRef.current = false
      onDirtyChange(false)
      setNotice(message)
      setSaveState({ status: "success", message })
    } catch (reason) {
      const error = errorMessage(reason, "The change could not be saved.")
      setSaveState({ status: "error", message: error })
      if (isRetryableError(error)) lastSave.current = () => save(next, action, message)
      throw reason
    }
  }

  return (
    <>
      <div className="page-head">
        <div>
          <p className="eyebrow">{working.form.fullName || "Student"}</p>
          <h1 data-page-heading tabIndex={-1}>{routeTitle(route)}</h1>
          <p>{route === "overview" ? "Review your enrollment status and next action." : route === "enroll" ? "Complete each section and save your progress as you go." : route === "documents" ? "View submitted files and download available copies." : "Review recent changes to your enrollment record."}</p>
        </div>
        <Status value={working.status} />
      </div>
      {working.status === "returned" && (
        <Alert tone="error">
          <strong>Correction needed.</strong>{" "}
          {(Object.keys(working.offices) as Office[])
            .filter((office) => working.offices[office] === "returned")
            .map(roleLabel)
            .join(", ") || "Review the staff remarks below."}{" "}
          {(Object.keys(working.offices) as Office[])
            .filter((office) => working.offices[office] === "returned" && working.remarks[office])
            .map((office) => `${roleLabel(office)}: ${working.remarks[office]}`)
            .join(" · ")}{" "}
          <button className="link inline-link" onClick={() => onNavigate("enroll")}>
            Open correction form
          </button>
        </Alert>
      )}
      {working.academicIssue && (
        <Alert tone="error">Academic review required: {working.academicIssue}</Alert>
      )}
      {referenceError && (
        <Alert tone="error">
          Academic choices are unavailable: {referenceError}
        </Alert>
      )}
      {updateAvailable && (
        <Alert tone="info">
          This enrollment was updated elsewhere. Your edits are safe.{" "}
          <button className="link inline-link" onClick={onRefresh}>
            Review update
          </button>
        </Alert>
      )}
      <ActionFeedback
        state={saveState}
        onRetry={lastSave.current ? () => void lastSave.current?.() : undefined}
      />
      {notice && saveState.status === "idle" && (
        <Alert tone="success">{notice}</Alert>
      )}
      {route === "overview" && (
        <Overview
          item={working}
          onContinue={() => onNavigate("enroll")}
        />
      )}{" "}
      {route === "enroll" && (
        <EnrollmentWizard
          item={working}
          setItem={updateWorking}
          save={save}
          references={references}
          correction={working.status === "returned"}
          saving={saveState.status === "pending"}
        />
      )}{" "}
      {route === "documents" && <Documents item={working} />}{" "}
      {route === "updates" && <section className="card"><Timeline events={working.events} /></section>}
    </>
  )
}

function Overview({
  item,
  onContinue,
}: {
  item: Enrollment
  onContinue: () => void
}) {
  return (
    <div className="overview-layout">
      <section className="card next-action">
        <div>
          <p className="eyebrow">NEXT ACTION</p>
          <h2>{item.status === "confirmed" ? "Enrollment record released" : steps[Math.max(0, item.step - 1)]}</h2>
          <p>{item.status === "confirmed" ? "Your printable enrollment record is ready." : "Continue the form from the last saved section."}</p>
        </div>
        {item.status !== "confirmed" && <button className="primary" onClick={onContinue}>Continue enrollment <ChevronRight /></button>}
        {item.status === "confirmed" && <button className="primary" onClick={() => window.print()}>Print enrollment record</button>}
      </section>
      <section className="card">
        <div className="section-title compact-title"><div><h2>Student details</h2><p>Information on this enrollment record.</p></div></div>
        <div className="record-rows">
          <RecordRow label="Student number" value={item.studentNumber ?? "Not yet assigned"} />
          <RecordRow label="Full name" value={item.form.fullName || "—"} />
          <RecordRow label="Program" value={item.form.program || "Not selected"} />
          <RecordRow label="Campus and year" value={[item.form.campus, item.form.yearLevel].filter(Boolean).join(" · ") || "Not selected"} />
        </div>
      </section>
      <section className="card">
        <div className="section-title compact-title"><div><h2>Office status</h2><p>Current review and remarks.</p></div></div>
        <div className="record-rows">
          {(["registrar", "osas", "guidance", "medical", "scholarship", "cashier", "ict"] as Office[]).map((office) => (
            <RecordRow key={office} label={roleLabel(office)} value={stateLabel(staffStatusFor(item, office))} detail={item.remarks[office]} />
          ))}
        </div>
      </section>
      <section className="card wide">
        <div className="section-title compact-title"><div><h2>Recent activity</h2><p>Latest changes to your enrollment record.</p></div></div>
        <Timeline events={item.events.slice(0, 5)} />
      </section>
    </div>
  )
}

function EnrollmentWizard({
  item,
  setItem,
  save,
  references,
  correction = false,
  saving = false,
}: {
  item: Enrollment
  setItem: (item: Enrollment) => void
  save: (item?: Enrollment, action?: string, message?: string) => Promise<void>
  references: AcademicReferences | null
  correction?: boolean
  saving?: boolean
}) {
  const [busy, setBusy] = useState(false)
  const [viewedStep, setViewedStep] = useState(() => correction ? correctionStep(item) : item.step)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [uploadState, setUploadState] = useState<ActionState>({ status: "idle" })
  const lastUpload = useRef<(() => Promise<void>) | null>(null)
  const updateForm = (key: keyof StudentForm, value: string) =>
    setItem({ ...item, form: { ...item.form, [key]: value } })

  const activeStep = Math.max(1, Math.min(6, viewedStep))
  const next = async () => {
    if (activeStep === 1) {
      const nextErrors = Object.fromEntries([
        ...(["fullName", "birthDate", "gender", "mobile", "email", "address", "guardian", "emergencyContact"] as const)
          .filter((key) => !item.form[key].trim())
          .map((key) => [key, "This field is required."]),
        ...([["campusId", item.academic.campusId], ["programId", item.academic.programId], ["termId", item.academic.termId], ["yearLevel", item.academic.yearLevel]] as const)
          .filter(([, value]) => !value)
          .map(([key]) => [key, "Choose an option."]),
      ])
      if (item.form.email && !/^\S+@\S+\.\S+$/.test(item.form.email)) nextErrors.email = "Enter a valid email address."
      setErrors(nextErrors)
      if (Object.keys(nextErrors).length) return
    }
    const updated = addEvent(
      {
        ...item,
        step: Math.max(item.step, Math.min(6, activeStep + 1)),
        status: item.status,
      },
      steps[activeStep - 1] + " submitted",
    )
    try { await save(updated, "save", "Progress saved."); setViewedStep(Math.min(6, activeStep + 1)) } catch { /* feedback is rendered by the parent */ }
  }

  const upload = async (office: string, key: string, file?: File) => {
    if (!file) return
    const extension = file.name.split(".").pop()?.toLowerCase()
    if (!["pdf", "jpg", "jpeg", "png"].includes(extension ?? "") || (file.type && !["application/pdf", "image/jpeg", "image/png"].includes(file.type))) {
      setUploadState({ status: "error", message: "Use a PDF, JPG, or PNG file." })
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      setUploadState({ status: "error", message: "Files must be 10 MB or smaller." })
      return
    }
    setBusy(true)
    setUploadState({ status: "pending", message: "Uploading…" })
    try {
      const path = await uploadDocument(item.id, office, file)
      const next = {
        ...item,
        documents: { ...item.documents, [key]: path },
        payment:
          office === "cashier"
            ? { ...item.payment, proof: path, status: "submitted" as const }
            : item.payment,
      }
      await save(next, "save", file.name + " uploaded.")
      setUploadState({ status: "success", message: file.name + " uploaded." })
    } catch (reason) {
      const error = reason instanceof Error ? reason.message : "Upload failed. Try again."
      setUploadState({ status: "error", message: error })
      lastUpload.current = () => upload(office, key, file)
    } finally {
      setBusy(false)
    }
  }

  if (item.status === "confirmed") {
    const term = references?.terms.find((value) => value.id === item.academic.termId)
    return <Confirmed item={item} termLabel={term ? `${term.academicYear} · ${term.semester}` : "Not selected"} />
  }
  return (
    <div className="wizard">
      <div className="stepper">
        {steps.map((name, index) => (
          <button
            key={name}
            className={
              activeStep === index + 1
                ? "active"
                : item.step > index + 1
                  ? "done"
                  : ""
            }
            onClick={() => index + 1 <= item.step && setViewedStep(index + 1)}
          >
            <span>{item.step > index + 1 ? "✓" : index + 1}</span>
            <small>{name}</small>
          </button>
        ))}
      </div>
      <section className="card form-card">
        <div className="section-title">
          <div>
            <p className="eyebrow">STEP {activeStep} OF 6</p>
            <h2>{steps[activeStep - 1]}</h2>
          </div>
          <Status value={item.status} />
        </div>
        {activeStep === 1 && (
          <StudentInfo
            form={item.form}
            academic={item.academic}
            references={references}
            update={updateForm}
            setItem={setItem}
            item={item}
            errors={errors}
            locked={item.offices.registrar === "cleared"}
          />
        )}{" "}
        {activeStep === 2 && (
          <RequirementUpload item={item} upload={upload} busy={busy} locked={item.offices.registrar === "cleared"} />
        )}{" "}
        {activeStep === 3 && <Payment item={item} upload={upload} busy={busy} locked={item.payment.status === "confirmed" || item.payment.status === "verifying"} />}{" "}
        {activeStep === 4 && <OfficeClearances item={item} />}{" "}
        {activeStep === 5 && <IdProcessing item={item} />}{" "}
        {activeStep === 6 && <FinalReview item={item} references={references} />}
        <ActionFeedback state={uploadState} onRetry={lastUpload.current ? () => void lastUpload.current?.() : undefined} />
        <div className="form-actions">
          <button
            className="secondary"
            disabled={activeStep === 1}
            onClick={() => setViewedStep(Math.max(1, activeStep - 1))}
          >
            Back
          </button>
          <button className="secondary" disabled={busy || saving} onClick={() => void save().catch(() => {})}>
            Save draft
          </button>
          {activeStep < 6 && (
            <button className="primary" disabled={busy || saving} onClick={() => void next()}>
              Save and continue <ChevronRight />
            </button>
          )}
          {activeStep === 6 && item.status !== "submitted" && (
            <button className="primary" disabled={busy || saving} onClick={() => void save(item, "submit", "Enrollment submitted successfully.").catch(() => {})}>
              Submit enrollment
            </button>
          )}
        </div>
      </section>
    </div>
  )
}

function StudentInfo({
  form,
  academic,
  references,
  update,
  setItem,
  item,
  errors,
  locked,
}: {
  form: StudentForm
  academic: Enrollment["academic"]
  references: AcademicReferences | null
  update: (key: keyof StudentForm, value: string) => void
  setItem: (item: Enrollment) => void
  item: Enrollment
  errors: Record<string, string>
  locked: boolean
}) {
  const fields: Array<[keyof StudentForm, string, string]> = [
    ["fullName", "Full name", "text"],
    ["birthDate", "Date of birth", "date"],
    ["gender", "Gender", "text"],
    ["mobile", "Mobile number", "tel"],
    ["email", "Email address", "email"],
    ["address", "Home address", "text"],
    ["guardian", "Parent or guardian", "text"],
    ["emergencyContact", "Emergency contact", "tel"],
  ]

  const selectedCampus = references?.campuses.find(
    (campus) => campus.id === academic.campusId,
  )
  const programs =
    references?.programs.filter(
      (program) => program.campusId === academic.campusId,
    ) ?? []
  const openTerms =
    references?.terms.filter(
      (term) => term.status === "open" || term.status === "published",
    ) ?? []

  const updateAcademic = (next: Partial<Enrollment["academic"]>) => {
    const value = { ...academic, ...next }
    const campusName =
      references?.campuses.find((campus) => campus.id === value.campusId)
        ?.name ?? ""
    const program = references?.programs.find(
      (program) => program.id === value.programId,
    )
    setItem({
      ...item,
      academic: value,
      form: {
        ...item.form,
        studentType: value.studentType,
        campus: campusName,
        program: program?.name ?? "",
        yearLevel: value.yearLevel
          ? `${value.yearLevel}${
              value.yearLevel === 1
                ? "st"
                : value.yearLevel === 2
                  ? "nd"
                  : value.yearLevel === 3
                    ? "rd"
                    : "th"
            } Year`
          : "",
      },
    })
  }

  return (
    <>
      {references &&
        (!references.campuses.length ||
          !references.programs.length ||
          !openTerms.length) && (
          <Alert tone="info">
            Academic setup is incomplete. An administrator must publish a
            campus, an active campus-linked program, and an open enrollment term
            before this form can be submitted.
          </Alert>
        )}
      {selectedCampus && !programs.length && (
        <Alert tone="info">
          No active programs are available at {selectedCampus.name}. Choose
          another campus or ask an administrator to configure one.
        </Alert>
      )}
      {locked && <Alert tone="info">The Registrar has cleared this information. It can be changed only if the record is returned for correction.</Alert>}
      <section className="form-section">
        <h3>Academic information</h3>
        <div className="form-grid">
          <Field label="Student type" error={errors.studentType}>
            <select disabled={locked} value={academic.studentType} onChange={(e) => updateAcademic({ studentType: e.target.value as Enrollment["academic"]["studentType"] })}>
              {["freshman", "transferee", "continuing", "returning"].map((v) => <option key={v} value={v}>{stateLabel(v)}</option>)}
            </select>
          </Field>
          <Field label="Academic status" error={errors.academicStatus}>
            <select disabled={locked} value={form.academicStatus} onChange={(e) => update("academicStatus", e.target.value)}><option value="regular">Regular</option><option value="irregular">Irregular</option></select>
          </Field>
          <Field label="Campus" error={errors.campusId}>
            <select disabled={locked} value={academic.campusId ?? ""} onChange={(e) => updateAcademic({ campusId: e.target.value || null, programId: null })}>
              <option value="">Select campus…</option>{references?.campuses.map((campus) => <option key={campus.id} value={campus.id}>{campus.name}</option>)}
            </select>
          </Field>
          <Field label="Program" error={errors.programId}>
            <select value={academic.programId ?? ""} disabled={locked || !selectedCampus} onChange={(e) => updateAcademic({ programId: e.target.value || null })}>
              <option value="">{selectedCampus ? "Select program…" : "Select campus first"}</option>{programs.map((program) => <option key={program.id} value={program.id}>{program.name} · {program.college}</option>)}
            </select>
          </Field>
          <Field label="Enrollment term" error={errors.termId}>
            <select disabled={locked} value={academic.termId ?? ""} onChange={(e) => updateAcademic({ termId: e.target.value || null })}>
              <option value="">Select term…</option>{openTerms.map((term) => <option key={term.id} value={term.id}>{term.academicYear} · {term.semester}</option>)}
            </select>
          </Field>
          <Field label="Year level" error={errors.yearLevel}>
            <select disabled={locked} value={academic.yearLevel ?? ""} onChange={(e) => updateAcademic({ yearLevel: e.target.value ? Number(e.target.value) : null })}>
              <option value="">Select year level…</option>{[1, 2, 3, 4, 5].map((value) => <option key={value} value={value}>{value}{value === 1 ? "st" : value === 2 ? "nd" : value === 3 ? "rd" : "th"} Year</option>)}
            </select>
          </Field>
        </div>
      </section>
      <section className="form-section">
        <h3>Personal information</h3>
        <div className="form-grid">
          {fields.slice(0, 3).map(([key, label, type]) => <Field key={key} label={label} error={errors[key]}><input required disabled={locked} type={type} value={form[key]} onChange={(e) => update(key, e.target.value)} /></Field>)}
          <Field label="Home address" error={errors.address}><input required disabled={locked} type="text" value={form.address} onChange={(e) => update("address", e.target.value)} /></Field>
        </div>
      </section>
      <section className="form-section">
        <h3>Contact information</h3>
        <div className="form-grid">
          {fields.slice(3, 5).map(([key, label, type]) => <Field key={key} label={label} error={errors[key]}><input required disabled={locked} type={type} value={form[key]} onChange={(e) => update(key, e.target.value)} /></Field>)}
          {fields.slice(6).map(([key, label, type]) => <Field key={key} label={label} error={errors[key]}><input required disabled={locked} type={type} value={form[key]} onChange={(e) => update(key, e.target.value)} /></Field>)}
        </div>
      </section>
    </>
  )
}

function RequirementUpload({
  item,
  upload,
  busy,
  locked,
}: {
  item: Enrollment
  upload: (office: string, key: string, file?: File) => void
  busy: boolean
  locked: boolean
}) {
  return (
    <div className="upload-list">
      {locked && <Alert tone="info">Registrar documents are locked after clearance.</Alert>}
      {requirements[item.form.studentType].map((name, index) => (
        <label className="upload-row" key={name}>
          <div className="file-icon">
            <FileText />
          </div>
          <div>
            <strong>{name}</strong>
            <span>
              {item.documents[name]
                ? `${documentFilename(item.documents[name])} · Uploaded`
                : index > 2
                ? "Bring original; digital copy optional"
                : "PDF, JPG or PNG · max 10 MB"}
            </span>
          </div>
          <Status value={item.documents[name] ? "uploaded" : "pending"} />
          <input
            disabled={busy || locked}
            type="file"
            accept=".pdf,.jpg,.jpeg,.png"
            onChange={(e) => upload("registrar", name, e.target.files?.[0])}
          />
          <Upload />
        </label>
      ))}
    </div>
  )
}

function Payment({
  item,
  upload,
  busy,
  locked,
}: {
  item: Enrollment
  upload: (office: string, key: string, file?: File) => void
  busy: boolean
  locked: boolean
}) {
  return (
    <div className="payment-grid">
      <div className="invoice">
        <p>Free Higher Education / UniFAST</p>
        <h3>Government-funded tuition</h3>
        <div>
          <span>Tuition payable</span>
          <strong>₱0.00</strong>
        </div>
        <div>
          <span>Student insurance</span>
          <strong>₱125.00</strong>
        </div>
        <div className="total">
          <span>Total payable</span>
          <strong>₱125.00</strong>
        </div>
      </div>
      <div className="card inset">
        <Status value={item.payment.status} />
        <h3>Payment proof</h3>
        <p>
          Pay through the designated Cashier channel, then upload a clear
          receipt or transaction image.
        </p>
        <label className="dropzone">
          <Upload />
          <strong>{item.payment.proof ? documentFilename(item.payment.proof) : "Choose payment proof"}</strong>
          <span>PDF, JPG or PNG · max 10 MB</span>
          <input
            disabled={busy || locked}
            type="file"
            accept=".pdf,.jpg,.jpeg,.png"
            onChange={(e) =>
              upload("cashier", "payment-proof", e.target.files?.[0])
            }
          />
        </label>
        {item.payment.receipt && (
          <Alert tone="success">Receipt issued: {item.payment.receipt}</Alert>
        )}
      </div>
    </div>
  )
}

function OfficeClearances({ item }: { item: Enrollment }) {
  return (
    <div className="office-grid">
      {(["osas", "guidance", "medical"] as Office[]).map((office) => (
        <div className="office-card" key={office}>
          <div className="file-icon">
            <ShieldCheck />
          </div>
          <div>
            <h3>{roleLabel(office)}</h3>
            <p>{item.remarks[office] || "No staff remarks."}</p>
          </div>
          <Status value={item.offices[office]} />
        </div>
      ))}
    </div>
  )
}

function IdProcessing({ item }: { item: Enrollment }) {
  return (
    <div className="process">
      <div className="process-icon">
        <UserRound />
      </div>
      <h3>{stateLabel(item.idStatus)}</h3>
      <p>
        ICT-MIS verifies identity, captures the photo, assigns the student
        number, and prepares the school ID.
      </p>
      {item.studentNumber && (
        <Alert tone="success">
          Assigned student number: {item.studentNumber}
        </Alert>
      )}
    </div>
  )
}

function FinalReview({ item, references }: { item: Enrollment; references: AcademicReferences | null }) {
  const checks = [
    ["Student information", item.status !== "draft"],
    ["Registrar requirements", item.offices.registrar === "cleared"],
    [
      "Free Higher Education assessment",
      item.offices.scholarship === "cleared",
    ],
    ["Insurance payment", item.payment.status === "confirmed"],
    ["OSAS clearance", item.offices.osas === "cleared"],
    ["Guidance clearance", item.offices.guidance === "cleared"],
    ["Medical clearance", item.offices.medical === "cleared"],
    ["School ID processing", ["ready", "completed"].includes(item.idStatus)],
  ] as const
  return (
    <div>
      <div className="check-list">
        {checks.map(([name, done]) => (
          <div key={name}>
            <span className={done ? "check yes" : "check"}>
              {done ? "✓" : "!"}
            </span>
            <strong>{name}</strong>
            <Status value={done ? "verified" : "pending"} />
          </div>
        ))}
      </div>
      {item.status === "confirmed" && <Confirmed item={item} termLabel={references?.terms.find((term) => term.id === item.academic.termId) ? `${references.terms.find((term) => term.id === item.academic.termId)?.academicYear} · ${references.terms.find((term) => term.id === item.academic.termId)?.semester}` : "Not selected"} />}
    </div>
  )
}

function Confirmed({ item, termLabel }: { item: Enrollment; termLabel: string }) {
  return (
    <div className="confirmed">
      <CheckCircle2 />
      <h2>Enrollment confirmed</h2>
      <p>Student no. {item.studentNumber}</p>
      <div className="confirmed-summary">
        <span><small>Program</small><strong>{item.form.program || "—"}</strong></span>
        <span><small>Year level</small><strong>{item.form.yearLevel || "—"}</strong></span>
        <span><small>Campus</small><strong>{item.form.campus || "—"}</strong></span>
        <span><small>Term</small><strong>{termLabel}</strong></span>
      </div>
      <button className="primary" onClick={() => window.print()}>
        Print / Save as PDF
      </button>
      <div className="subject-table">
        {item.subjects.map((subject) => (
          <div key={subject.code}>
            <strong>{subject.code}</strong>
            <span>{subject.title}</span>
            <span>{subject.schedule}</span>
            <span>{subject.room}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function StaffPortal({
  items,
  persist,
}: {
  items: Enrollment[]
  persist: (item: Enrollment, action?: string, office?: Office) => Promise<void>
}) {
  const [query, setQuery] = useState("")
  const [status, setStatus] = useState("")
  const [campusFilter, setCampusFilter] = useState("")
  const [programFilter, setProgramFilter] = useState("")
  const [studentTypeFilter, setStudentTypeFilter] = useState("")
  const [selected, setSelected] = useState<Enrollment | null>(null)
  const [remark, setRemark] = useState("")
  const [sections, setSections] = useState<SubjectSection[]>([])
  const [sectionIds, setSectionIds] = useState<string[]>([])
  const [sectionError, setSectionError] = useState("")
  const [sectionBusy, setSectionBusy] = useState(false)
  const [decisionState, setDecisionState] = useState<ActionState>({ status: "idle" })
  const [lastDecision, setLastDecision] = useState<"approve" | "return" | "release" | null>(null)
  const drawerRef = useRef<HTMLElement>(null)
  const [office, setOffice] = useState<Office>("registrar")
  const visibleDocuments = (item: Enrollment) => Object.entries(item.documents)

  useEffect(() => {
    if (!selected) return
    drawerRef.current?.focus()
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSelected(null)
      if (event.key !== "Tab" || !drawerRef.current) return
      const focusable = drawerRef.current.querySelectorAll<HTMLElement>("button, input, select, textarea, a[href]")
      if (!focusable.length) return
      const first = focusable[0], last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
    }
    document.addEventListener("keydown", onKeyDown)
    return () => document.removeEventListener("keydown", onKeyDown)
  }, [selected])

  useEffect(() => {
    if (
      office !== "registrar" ||
      !selected?.academic.programId ||
      !selected.academic.termId
    ) {
      setSections([])
      setSectionIds([])
      setSectionError("")
      return
    }

    setSectionError("")
    setSectionIds(
      selected.subjects.flatMap((subject) =>
        subject.sectionId ? [subject.sectionId] : [],
      ),
    )

    getSubjectSections(selected.academic.programId, selected.academic.termId)
      .then(setSections)
      .catch((reason) =>
        setSectionError(
          reason instanceof Error
            ? reason.message
            : "Subject sections could not be loaded.",
        ),
      )
  }, [
    office,
    selected?.id,
    selected?.academic.programId,
    selected?.academic.termId,
    selected?.subjects,
  ])

  const filtered = useMemo(
    () =>
      items.filter(
        (item) =>
          `${item.form.fullName} ${item.form.program}`
            .toLowerCase()
            .includes(query.toLowerCase()) &&
          (!campusFilter || item.form.campus === campusFilter) &&
          (!programFilter || item.form.program === programFilter) &&
          (!studentTypeFilter || item.form.studentType === studentTypeFilter) &&
          (!status ||
            staffStatusFor(item, office) === status),
      ),
    [items, query, status, campusFilter, programFilter, studentTypeFilter, office],
  )

  const campusOptions = [...new Set(items.map((item) => item.form.campus).filter(Boolean))]
  const programOptions = [...new Set(items.map((item) => item.form.program).filter(Boolean))]

  const assign = async () => {
    if (!selected || office !== "registrar") return

    if (!selected.academic.programId || !selected.academic.termId)
      return setSectionError(
        "This record needs a valid academic term and program before sections can be assigned.",
      )

    if (!sectionIds.length)
      return setSectionError(
        "Select at least one real subject section. No subjects are assigned automatically.",
      )

    setSectionBusy(true)
    setSectionError("")

    try {
      const subjects = await assignSubjectSections(selected.id, sectionIds)
      setSelected({ ...selected, subjects })
    } catch (reason) {
      setSectionError(
        reason instanceof Error
          ? reason.message
          : "Subject assignment was rejected.",
      )
    } finally {
      setSectionBusy(false)
    }
  }

  const clearAssignments = async () => {
    if (!selected || office !== "registrar") return
    setSectionBusy(true)
    setSectionError("")
    try {
      await clearSubjectSections(selected.id)
      setSectionIds([])
      setSelected({ ...selected, subjects: [] })
    } catch (reason) {
      setSectionError(errorMessage(reason, "Subject assignments could not be cleared."))
    } finally {
      setSectionBusy(false)
    }
  }

  const act = async (decision: "approve" | "return") => {
    if (!selected) return
    if (decisionState.status === "pending") return
    if (
      office === "registrar" &&
      decision === "approve" &&
      (!selected.subjects.length ||
        selected.subjects.some((subject) => !subject.sectionId))
    )
      return setSectionError(
        "Save real term sections before approving this enrollment. Existing labels without section IDs are not treated as valid assignments.",
      )
    let next = structuredClone(selected)
    const label = roleLabel(office)
    if (office === "cashier")
      next.payment =
        decision === "approve"
          ? {
              ...next.payment,
              status: "confirmed",
              receipt: `INS-${new Date().getFullYear()}-${Math.floor(Math.random() * 90000 + 10000)}`,
            }
          : { ...next.payment, status: "rejected" }
    else if (office === "ict")
      next.idStatus = decision === "approve" ? "ready" : "scheduled"
    else next.offices[office] = decision === "approve" ? "cleared" : "returned"
    next.status = decision === "return" ? "returned" : next.status === "draft" ? "in_review" : next.status
    next.remarks[office] = remark
    next = addEvent(
      next,
      `${label}: ${
        decision === "approve"
          ? "approved / cleared"
          : "returned for correction"
      }${remark ? ` — ${remark}` : ""}`,
    )
    setLastDecision(decision)
    setDecisionState({ status: "pending", message: decision === "approve" ? "Saving decision…" : "Returning record…" })
    try {
      await persist(next, decision, office)
      setDecisionState({ status: "success", message: "Decision saved." })
      setSelected(null)
      setRemark("")
    } catch (reason) {
      const message = errorMessage(reason, "Decision could not be saved.")
      if (!isRetryableError(message)) setLastDecision(null)
      setDecisionState({ status: "error", message })
    }
  }

  const release = async () => {
    if (!selected) return
    if (decisionState.status === "pending") return
    const ready =
      selected.payment.status === "confirmed" &&
      (["osas", "guidance", "medical", "scholarship"] as Office[]).every(
        (o) => selected.offices[o] === "cleared",
      ) &&
      ["ready", "completed"].includes(selected.idStatus) &&
      selected.subjects.length &&
      selected.subjects.every((subject) => subject.sectionId)
    if (!ready) {
      setLastDecision("release")
      setDecisionState({ status: "error", message: "Payment, support clearances, assessment, ID processing, and real assigned sections must be complete." })
      return
    }
    let next = structuredClone(selected)
    next.status = "confirmed"
    next.studentNumber ||= `${new Date().getFullYear()}-${String(Math.floor(Math.random() * 90000 + 10000))}`
    next.offices.registrar = "cleared"
    next = addEvent(next, "Registrar released the official Enrollment Form")
    setLastDecision("release")
    setDecisionState({ status: "pending", message: "Releasing enrollment form…" })
    try {
      await persist(next, "release", "registrar")
      setDecisionState({ status: "success", message: "Enrollment form released." })
      setSelected(null)
    } catch (reason) {
      setDecisionState({ status: "error", message: reason instanceof Error ? reason.message : "Enrollment form could not be released." })
    }
  }

  return (
    <>
      <div className="page-head">
        <div>
          <p className="eyebrow">ROLE-PROTECTED WORKSPACE</p>
          <h1 data-page-heading tabIndex={-1}>{officeLabel(office)} dashboard</h1>
          <p>{staffDashboardDescription(office)}</p>
        </div>
        <div className="summary-pill">
          <strong>{filtered.length}</strong>
          <span>records</span>
        </div>
      </div>
      <StaffDashboardByRole role={office} items={items} filteredCount={filtered.length} />
      <div className="toolbar">
        <label>
          Workflow office
          <select value={office} onChange={(event) => { setOffice(event.target.value as Office); setSelected(null); setStatus("") }}>
            {offices.map((value) => <option key={value} value={value}>{officeLabel(value)}</option>)}
          </select>
        </label>
      </div>
      <ActionFeedback state={decisionState} onRetry={lastDecision === "release" && selected ? release : (lastDecision === "approve" || lastDecision === "return") && selected ? () => void act(lastDecision) : undefined} />
      <div className="toolbar">
        <label>
          <Search />
          <input
            placeholder="Search student or program"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <select aria-label="Filter by campus" value={campusFilter} onChange={(e) => setCampusFilter(e.target.value)}>
          <option value="">All campuses</option>
          {campusOptions.map((value) => <option key={value} value={value}>{value}</option>)}
        </select>
        <select aria-label="Filter by program" value={programFilter} onChange={(e) => setProgramFilter(e.target.value)}>
          <option value="">All programs</option>
          {programOptions.map((value) => <option key={value} value={value}>{value}</option>)}
        </select>
        <select aria-label="Filter by student type" value={studentTypeFilter} onChange={(e) => setStudentTypeFilter(e.target.value)}>
          <option value="">All student types</option>
          {(["freshman", "transferee", "continuing", "returning"] as const).map((value) => <option key={value} value={value}>{stateLabel(value)}</option>)}
        </select>
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">All statuses</option>
            {staffStatuses(office).map((v) => (
            <option key={v} value={v}>
              {stateLabel(v)}
            </option>
          ))}
        </select>
      </div>
      <section className="table-card">
        <div className="table-head">
          <span>Student</span>
          <span>Program</span>
          <span>Campus</span>
          <span>Status</span>
          <span>Updated</span>
        </div>
        {filtered.map((item) => (
                <button
            className="table-row"
            key={item.id}
            onClick={() => { setSelected(item); setRemark(""); setDecisionState({ status: "idle" }) }}
          >
            <span>
              <strong>{item.form.fullName || "Unnamed student"}</strong>
              <small>{item.studentNumber || "Not yet assigned"}</small>
            </span>
            <span>{item.form.program || "Academic setup incomplete"}</span>
            <span>{item.form.campus || "Not assigned"}</span>
            <Status
              value={staffStatusFor(item, office)}
            />
            <span>{new Date(item.updatedAt).toLocaleDateString()}</span>
          </button>
        ))}
        {!filtered.length && (
          <Empty
            title="Queue is clear"
            text="No records match the current filters."
          />
        )}
      </section>
      {selected && (
        <div className="drawer-backdrop" onMouseDown={() => setSelected(null)}>
          <aside className="drawer" ref={drawerRef} role="dialog" aria-modal="true" aria-labelledby="drawer-title" tabIndex={-1} onMouseDown={(e) => e.stopPropagation()}>
            <button className="icon close" aria-label="Close student record" onClick={() => setSelected(null)}>
              <X />
            </button>
            <p className="eyebrow">STUDENT RECORD</p>
            <h2 id="drawer-title">{selected.form.fullName}</h2>
            <p>
              {selected.form.program || "Program not assigned"} ·{" "}
              {selected.form.studentType} ·{" "}
              {selected.form.campus || "Campus not assigned"}
            </p>
            {selected.academicIssue && (
              <Alert tone="error">Academic review required: {selected.academicIssue}</Alert>
            )}
            <div className="detail-grid">
              <Stat
                value={selected.studentNumber || "Pending"}
                label="Student number"
              />
              <Stat
                value={stateLabel(selected.payment.status)}
                label="Payment"
              />
              <Stat
                value={`${selected.subjects.length}`}
                label="Assigned subjects"
              />
              <Stat value={stateLabel(selected.status)} label="Enrollment" />
            </div>
            {office === "cashier" && <div className="record-rows"><RecordRow label="Insurance fee" value="₱125.00" /><RecordRow label="Receipt" value={selected.payment.receipt || "Not issued"} /></div>}
            {office === "ict" && <div className="record-rows"><RecordRow label="ID status" value={stateLabel(selected.idStatus)} /><RecordRow label="Student number" value={selected.studentNumber || "Pending assignment"} /></div>}
            <div className="document-summary">
              <h3>Submitted documents</h3>
              {visibleDocuments(selected).map(([name]) => <span key={name}><FileText />{name}</span>)}
              {!visibleDocuments(selected).length && <small>No documents submitted.</small>}
            </div>
            {office === "registrar" && (
              <div className="subject-assignment">
                <h3>Subject sections</h3>
                {sectionError && <Alert tone="error">{sectionError}</Alert>}
                {!selected.academic.programId || !selected.academic.termId ? (
                  <Alert tone="info">
                    Academic setup is incomplete. Save a valid program and term
                    before assigning sections.
                  </Alert>
                ) : !sections.length ? (
                  <Alert tone="info">
                    No term-appropriate sections are published for this program.
                    An administrator must configure curriculum and sections
                    before assignment.
                  </Alert>
                ) : (
                  <div className="document-summary">
                    {sections.map((section) => (
                      <label key={section.id}>
                        <input
                          type="checkbox"
                          checked={sectionIds.includes(section.id)}
                          onChange={(event) =>
                            setSectionIds((current) =>
                              event.target.checked
                                ? [...current, section.id]
                                : current.filter((id) => id !== section.id),
                            )
                          }
                        />
                        <span>
                          {section.code} · {section.title} ·{" "}
                          {section.sectionCode} · {section.schedule} ·{" "}
                          {section.enrolledCount}/{section.capacity}
                        </span>
                      </label>
                    ))}
                  </div>
                )}
              <button
                className="secondary full"
                disabled={sectionBusy || decisionState.status === "pending" || !sections.length}
                  onClick={() => void assign()}
                >
                  {sectionBusy
                    ? "Saving subject assignments…"
                    : "Save subject assignments"}
                </button>
                {!!selected.subjects.length && (
                  <button className="danger full" disabled={sectionBusy || decisionState.status === "pending"} onClick={() => void clearAssignments()}>
                    Clear assignments for academic correction
                  </button>
                )}
              </div>
            )}
            {office === "scholarship" && (
              <div className="subject-assignment">
                <h3>Scholarship assessment</h3>
                <Field label="Free Higher Education status">
                  <select value={selected.scholarship.fheStatus} onChange={(event) => setSelected({ ...selected, scholarship: { ...selected.scholarship, fheStatus: event.target.value as ScholarshipDetails["fheStatus"] } })}>
                    <option value="pending">Pending assessment</option>
                    <option value="eligible">Eligible</option>
                    <option value="ineligible">Not eligible</option>
                  </select>
                </Field>
                <Field label="Additional scholarship awards">
                  <input value={selected.scholarship.additionalAwards.join(", ")} placeholder="Separate awards with commas" onChange={(event) => setSelected({ ...selected, scholarship: { ...selected.scholarship, additionalAwards: event.target.value.split(",").map((value) => value.trim()).filter(Boolean) } })} />
                </Field>
                <Field label="Financial assistance">
                  <select value={selected.scholarship.assistanceStatus} onChange={(event) => setSelected({ ...selected, scholarship: { ...selected.scholarship, assistanceStatus: event.target.value as ScholarshipDetails["assistanceStatus"] } })}>
                    <option value="none">No additional assistance</option>
                    <option value="pending">Pending</option>
                    <option value="approved">Approved</option>
                    <option value="rejected">Rejected</option>
                  </select>
                </Field>
              </div>
            )}
            <Field label="Staff remarks">
              <textarea
                value={remark}
                onChange={(e) => setRemark(e.target.value)}
                placeholder="Required when returning a record"
              />
            </Field>
            <ActionFeedback state={decisionState} onRetry={lastDecision === "release" ? release : (lastDecision === "approve" || lastDecision === "return") ? () => void act(lastDecision) : undefined} />
            <div className="drawer-actions">
              <button
                className="danger"
                disabled={!remark.trim() || decisionState.status === "pending"}
                onClick={() => void act("return")}
              >
                Return for correction
              </button>
              <button className="primary" disabled={decisionState.status === "pending"} onClick={() => void act("approve")}>
                Approve / clear
              </button>
            </div>
            {office === "registrar" && (
              <button className="release" disabled={decisionState.status === "pending"} onClick={() => void release()}>
                Release enrollment form
              </button>
            )}
            <h3>Activity history</h3>
            <Timeline events={selected.events} />
          </aside>
        </div>
      )}
    </>
  )
}

type StaffDashboardProps = { items: Enrollment[]; filteredCount: number }
type StaffMetric = { label: string; value: string | number }

const staffDashboardDescription = (office: Office) => ({
  registrar: "Validate enrollment records, assign real subject sections, and release official enrollment forms.",
  osas: "Review student eligibility and complete the Office for Student Affairs and Services clearance.",
  guidance: "Review guidance requirements and record the student support clearance decision.",
  medical: "Review restricted medical requirements and record the Medical Services clearance.",
  scholarship: "Assess Free Higher Education eligibility, additional awards, and financial assistance.",
  cashier: "Verify the ₱125.00 insurance payment and issue a receipt for each accepted payment.",
  ict: "Process identity capture, student numbers, and school ID readiness.",
}[office])

function StaffDashboardByRole({ role, items, filteredCount }: StaffDashboardProps & { role: Office }) {
  switch (role) {
    case "registrar": return <RegistrarDashboard items={items} filteredCount={filteredCount} />
    case "osas": return <OsasDashboard items={items} filteredCount={filteredCount} />
    case "guidance": return <GuidanceDashboard items={items} filteredCount={filteredCount} />
    case "medical": return <MedicalDashboard items={items} filteredCount={filteredCount} />
    case "scholarship": return <ScholarshipDashboard items={items} filteredCount={filteredCount} />
    case "cashier": return <CashierDashboard items={items} filteredCount={filteredCount} />
    case "ict": return <IctDashboard items={items} filteredCount={filteredCount} />
  }
}

function StaffRoleSummary({ title, description, metrics, children }: { title: string; description: string; metrics: StaffMetric[]; children?: ReactNode }) {
  return (
    <>
      <div className="staff-summary-grid">
        {metrics.map((metric) => <div className="card" key={metric.label}><strong>{metric.value}</strong><span>{metric.label}</span></div>)}
      </div>
      <section className="card staff-role-panel">
        <h2>{title}</h2>
        <p>{description}</p>
        {children}
      </section>
    </>
  )
}

function RegistrarDashboard({ items, filteredCount }: StaffDashboardProps) {
  return <StaffRoleSummary title="Registrar processing" description="The Registrar owns requirements validation, academic checks, section assignments, and final release." metrics={[
    { label: "Visible queue", value: filteredCount },
    { label: "Needs review", value: officeItems(items, "registrar").length },
    { label: "Academic issues", value: items.filter((item) => item.academicIssue).length },
    { label: "Ready to release", value: items.filter((item) => item.status === "in_review" && item.payment.status === "confirmed" && item.subjects.length > 0).length },
  ]}><div className="record-rows"><RecordRow label="Primary action" value="Validate and release enrollment" /><RecordRow label="Section assignment" value="Required before approval" /></div></StaffRoleSummary>
}

function OsasDashboard({ items, filteredCount }: StaffDashboardProps) {
  return <StaffRoleSummary title="OSAS eligibility review" description="OSAS sees student information and non-medical enrollment documents needed for eligibility review." metrics={[
    { label: "Visible queue", value: filteredCount },
    { label: "Pending OSAS", value: countStatus(items, "osas", "submitted") + countStatus(items, "osas", "under_review") },
    { label: "Cleared", value: countStatus(items, "osas", "cleared") },
    { label: "Returned", value: countStatus(items, "osas", "returned") },
  ]}><div className="record-rows"><RecordRow label="Primary action" value="Approve or return eligibility review" /><RecordRow label="Medical records" value="Clearance status only" /></div></StaffRoleSummary>
}

function GuidanceDashboard({ items, filteredCount }: StaffDashboardProps) {
  return <StaffRoleSummary title="Guidance clearance" description="Guidance staff review guidance requirements, add remarks, and complete the support clearance." metrics={[
    { label: "Visible queue", value: filteredCount },
    { label: "Pending guidance", value: countStatus(items, "guidance", "submitted") + countStatus(items, "guidance", "under_review") },
    { label: "Cleared", value: countStatus(items, "guidance", "cleared") },
    { label: "Returned", value: countStatus(items, "guidance", "returned") },
  ]}><div className="record-rows"><RecordRow label="Primary action" value="Record guidance clearance" /><RecordRow label="Staff remarks" value="Visible in student activity history" /></div></StaffRoleSummary>
}

function MedicalDashboard({ items, filteredCount }: StaffDashboardProps) {
  const medicalDocuments = items.reduce((count, item) => count + Object.keys(item.documents).filter((name) => documentOffice(name) === "medical").length, 0)
  return <StaffRoleSummary title="Medical Services clearance" description="Medical documents are private to Medical Services and the student. Other offices see only the clearance status." metrics={[
    { label: "Visible queue", value: filteredCount },
    { label: "Pending medical", value: countStatus(items, "medical", "submitted") + countStatus(items, "medical", "under_review") },
    { label: "Medical files", value: medicalDocuments },
    { label: "Cleared", value: countStatus(items, "medical", "cleared") },
  ]}><div className="record-rows"><RecordRow label="Primary action" value="Approve or return medical clearance" /><RecordRow label="Privacy boundary" value="Medical files are restricted" /></div></StaffRoleSummary>
}

function ScholarshipDashboard({ items, filteredCount }: StaffDashboardProps) {
  const awards = items.reduce((count, item) => count + item.scholarship.additionalAwards.length, 0)
  return <StaffRoleSummary title="Scholarship and FHE assessment" description="Free Higher Education coverage is tracked separately from additional scholarships and financial assistance." metrics={[
    { label: "Visible queue", value: filteredCount },
    { label: "FHE eligible", value: countScholarship(items, (value) => value.fheStatus === "eligible") },
    { label: "Pending assessment", value: countScholarship(items, (value) => value.fheStatus === "pending") },
    { label: "Additional awards", value: awards },
  ]}><div className="record-rows"><RecordRow label="Financial assistance pending" value={countScholarship(items, (value) => value.assistanceStatus === "pending")} /><RecordRow label="Primary action" value="Save assessment and clear scholarship review" /></div></StaffRoleSummary>
}

function CashierDashboard({ items, filteredCount }: StaffDashboardProps) {
  return <StaffRoleSummary title="Insurance payment verification" description="Cashier processing is centered on the mandatory ₱125.00 student insurance payment and receipt verification." metrics={[
    { label: "Visible queue", value: filteredCount },
    { label: "Payment submitted", value: countStatus(items, "cashier", "submitted") + countStatus(items, "cashier", "verifying") },
    { label: "Confirmed", value: countStatus(items, "cashier", "confirmed") },
    { label: "Rejected", value: countStatus(items, "cashier", "rejected") },
  ]}><div className="record-rows"><RecordRow label="Required payment" value="₱125.00 insurance" /><RecordRow label="Primary action" value="Verify proof and issue receipt" /></div></StaffRoleSummary>
}

function IctDashboard({ items, filteredCount }: StaffDashboardProps) {
  return <StaffRoleSummary title="ICT-MIS ID processing" description="ICT-MIS manages identity capture, student-number assignment, and school ID readiness." metrics={[
    { label: "Visible queue", value: filteredCount },
    { label: "Not started", value: countStatus(items, "ict", "not_started") },
    { label: "Processing", value: countStatus(items, "ict", "processing") + countStatus(items, "ict", "captured") },
    { label: "Ready or complete", value: countStatus(items, "ict", "ready") + countStatus(items, "ict", "completed") },
  ]}><div className="record-rows"><RecordRow label="Primary action" value="Update ID processing status" /><RecordRow label="Output" value="Student number and school ID readiness" /></div></StaffRoleSummary>
}

function AdminDashboard({ items }: { items: Enrollment[] }) {
  const officeNames: Office[] = ["registrar", "osas", "guidance", "medical", "scholarship", "cashier", "ict"]
  return <>
    <div className="page-head">
      <div><p className="eyebrow">SYSTEM OVERVIEW</p><h1 data-page-heading tabIndex={-1}>Admin dashboard</h1><p>Monitor enrollment progress across offices without making office decisions.</p></div>
      <div className="summary-pill"><strong>{items.length}</strong><span>enrollment records</span></div>
    </div>
    <div className="staff-summary-grid">
      <div className="card"><strong>{items.filter((item) => item.status === "submitted" || item.status === "in_review").length}</strong><span>Active reviews</span></div>
      <div className="card"><strong>{items.filter((item) => item.status === "returned").length}</strong><span>Returned records</span></div>
      <div className="card"><strong>{items.filter((item) => item.status === "confirmed").length}</strong><span>Confirmed enrollments</span></div>
      <div className="card"><strong>{items.filter((item) => item.academicIssue).length}</strong><span>Academic issues</span></div>
    </div>
    <section className="card staff-role-panel"><h2>Office progress</h2><p>Cross-office clearance counts for the current enrollment records.</p><div className="record-rows">{officeNames.map((office) => <RecordRow key={office} label={officeLabel(office)} value={`${items.filter((item) => officeComplete(item, office)).length} cleared · ${officeItems(items, office).length} open`} />)}</div></section>
    <section className="table-card"><div className="table-head"><span>Student</span><span>Program</span><span>Campus</span><span>Status</span><span>Updated</span></div>{items.map((item) => <div className="table-row" key={item.id}><span><strong>{item.form.fullName || "Unnamed student"}</strong><small>{item.studentNumber || "Not yet assigned"}</small></span><span>{item.form.program || "Academic setup incomplete"}</span><span>{item.form.campus || "Not assigned"}</span><Status value={item.status} /><span>{new Date(item.updatedAt).toLocaleDateString()}</span></div>)}{!items.length && <Empty title="No enrollments" text="No enrollment records are available." />}</section>
  </>
}

function AdminPortal({ items }: { items: Enrollment[] }) {
  const [references, setReferences] = useState<AcademicReferences | null>(null)
  const [name, setName] = useState("")
  const [campusId, setCampusId] = useState("")
  const [error, setError] = useState("")

  const reload = () =>
    getAcademicReferenceData()
      .then(setReferences)
      .catch((reason) =>
        setError(
          reason instanceof Error
            ? reason.message
            : "Academic reference data could not be loaded.",
        ),
      )
  useEffect(() => {
    void reload()
  }, [])

  const add = async () => {
    const value = name.trim()
    if (!value || !campusId)
      return setError("Choose a campus before adding a program.")
    if (
      references?.programs.some(
        (program) => program.name === value && program.campusId === campusId,
      )
    )
      return
    try {
      await addProgram(value, campusId)
      setName("")
      await reload()
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Program could not be added.",
      )
    }
  }

  const deactivate = async (programId: string) => {
    try {
      await deactivateProgram(programId)
      await reload()
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Program could not be deactivated.",
      )
    }
  }

  return (
    <>
      <div className="page-head">
        <div>
          <p className="eyebrow">SYSTEM ADMINISTRATION</p>
          <h1 data-page-heading tabIndex={-1}>Academic setup</h1>
          <p>
            Manage reference data without changing historical enrollment
            records.
          </p>
        </div>
        <div className="summary-pill"><strong>{items.length}</strong><span>enrollment records</span></div>
      </div>
      {error && <Alert tone="error">{error}</Alert>}
      <section className="card">
        <div className="section-title">
          <div>
            <h2>Programs by campus</h2>
            <p>
              Programs remain referenced by completed records when deactivated.
            </p>
          </div>
          <span className="heading-count">{references?.programs.length ?? 0} active programs</span>
        </div>
        <form
          className="inline-form"
          onSubmit={(e) => {
            e.preventDefault()
            void add()
          }}
        >
          <input
            placeholder="New program name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <select
            value={campusId}
            onChange={(e) => setCampusId(e.target.value)}
          >
            <option value="">Choose campus…</option>
            {references?.campuses.map((campus) => (
              <option key={campus.id} value={campus.id}>
                {campus.name}
              </option>
            ))}
          </select>
          <button className="primary">Add program</button>
        </form>
        <div className="manage-list">
          {references?.programs.map((program) => (
            <div key={program.id}>
              <BookOpen />
              <span>
                <strong>{program.name}</strong>
                <small>
                  {program.campusName ??
                    references.campuses.find(
                      (campus) => campus.id === program.campusId,
                    )?.name ??
                    "Campus unavailable"}
                </small>
              </span>
              <Status value="active" />
              <button
                className="link"
                onClick={() => void deactivate(program.id)}
              >
                Deactivate
              </button>
            </div>
          ))}
        </div>
      </section>
    </>
  )
}

function ActivityHistory({ items }: { items: Enrollment[] }) {
  const events = items.flatMap((item) => item.events.map((event) => ({ ...event, student: item.form.fullName || "Unnamed student" }))).sort((a, b) => b.at.localeCompare(a.at))
  return <><div className="page-head"><div><p className="eyebrow">ROLE-PROTECTED WORKSPACE</p><h1 data-page-heading tabIndex={-1}>Activity history</h1><p>Recent enrollment changes across the records you can access.</p></div></div><section className="card"><div className="timeline">{events.map((event, index) => <div key={`${event.at}-${index}`}><i/><span><strong>{event.student}: {event.text}</strong><small>{new Date(event.at).toLocaleString()}</small></span></div>)}{!events.length && <Empty title="No activity yet" text="Enrollment actions will appear here."/>}</div></section></>
}

function Documents({ item }: { item: Enrollment }) {
  const [state, setState] = useState<ActionState>({ status: "idle" })
  const openDocument = async (name: string, path: string, download = false) => {
    setState({ status: "pending", message: download ? "Preparing download…" : "Preparing preview…" })
    try {
      const url = await getDocumentLink(documentOffice(name), path, 60, download)
      window.open(url, "_blank", "noopener,noreferrer")
      setState({ status: "success", message: download ? "Download ready." : "Preview opened in a new tab." })
    } catch (reason) {
      setState({ status: "error", message: reason instanceof Error ? reason.message : "Document access was denied or expired." })
    }
  }
  return (
    <section className="card">
      <h2>Submitted documents</h2>
      <ActionFeedback state={state} />
      <div className="manage-list">
        {Object.entries(item.documents).map(([name, path]) => (
          <div key={name}>
            <FileText />
            <span>
              <strong>{name}</strong>
              <small>{documentFilename(path)} · Uploaded</small>
            </span>
            <Status value="uploaded" />
            <div className="document-actions">
              <button className="secondary compact" disabled={state.status === "pending"} onClick={() => void openDocument(name, path)}>Preview</button>
              <button className="link" disabled={state.status === "pending"} onClick={() => void openDocument(name, path, true)}>Download</button>
            </div>
          </div>
        ))}
        {!Object.keys(item.documents).length && (
          <Empty
            title="No files uploaded"
            text="Documents added during enrollment will appear here."
          />
        )}
      </div>
    </section>
  )
}

function Timeline({ events }: { events: Enrollment["events"] }) {
  return (
    <div className="timeline">
      {events.map((event, index) => (
        <div key={`${event.at}-${index}`}>
          <i />
          <span>
            <strong>{event.text}</strong>
            <small>{new Date(event.at).toLocaleString()}</small>
          </span>
        </div>
      ))}
    </div>
  )
}

function Field({ label, children, error }: { label: string; children: ReactNode; error?: string }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
      {error && <small className="field-error">{error}</small>}
    </label>
  )
}

function Status({ value }: { value: string }) {
  const label = ["draft", "submitted", "in_review", "returned", "confirmed"].includes(value)
    ? enrollmentStatusLabel(value)
    : stateLabel(value)
  return <span className={"status " + value}>{label}</span>
}

function Stat({ value, label }: { value: string | number; label: string }) {
  return (
    <div className="stat">
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  )
}

function RecordRow({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return <div className="record-row"><span>{label}</span><strong>{value}</strong>{detail && <small>{detail}</small>}</div>
}

function ActionFeedback({ state, onRetry }: { state: ActionState; onRetry?: () => void }) {
  if (state.status === "idle") return null
  if (state.status === "pending") return <Alert tone="info">{state.message}</Alert>
  return <Alert tone={state.status === "error" ? "error" : "success"}>{state.message}{state.status === "error" && onRetry && <> <button className="link inline-link" onClick={onRetry}>Retry</button></>}</Alert>
}

function Alert({
  tone,
  children,
}: {
  tone: "error" | "success" | "info"
  children: ReactNode
}) {
  return <div className={`alert ${tone}`} role={tone === "error" ? "alert" : "status"} aria-live="polite">{children}</div>
}

function Nav({ href, icon, label, active, onNavigate }: { href: PortalRoute; icon: ReactNode; label: string; active: boolean; onNavigate: (route: PortalRoute) => void }) {
  return (
    <a className={active ? "nav active" : "nav"} href={`#${href}`} aria-current={active ? "page" : undefined} onClick={() => onNavigate(href)}>
      {icon}
      <span>{label}</span>
    </a>
  )
}

function Empty({ title, text }: { title: string; text: string }) {
  return (
    <div className="empty">
      <ClipboardList />
      <h3>{title}</h3>
      <p>{text}</p>
    </div>
  )
}

function Centered({ children }: { children: ReactNode }) {
  return <div className="centered">{children}</div>
}
