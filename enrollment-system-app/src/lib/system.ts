import { createClient, type User } from "@supabase/supabase-js"

export type Role = "student" | "registrar" | "osas" | "guidance" | "medical" | "scholarship" | "cashier" | "ict" | "admin"

export type Office = "registrar" | "osas" | "guidance" | "medical" | "scholarship" | "cashier" | "ict"

export type ReviewState = "not_started" | "submitted" | "under_review" | "returned" | "cleared"

export type FheStatus = "pending" | "eligible" | "ineligible"
export type AssistanceStatus = "none" | "pending" | "approved" | "rejected"

export interface ScholarshipDetails {
  fheStatus: FheStatus
  additionalAwards: string[]
  assistanceStatus: AssistanceStatus
  notes: string
}

export type StudentType = "freshman" | "transferee" | "continuing" | "returning"

export interface CampusReference {
  id: string
  name: string
}

export interface ProgramReference {
  id: string
  name: string
  college: string
  campusId: string
  campusName?: string
}

export interface TermReference {
  id: string
  academicYear: string
  semester: string
  status: string
}

export interface AcademicReferences {
  campuses: CampusReference[]
  programs: ProgramReference[]
  terms: TermReference[]
}

export interface AcademicSelection {
  campusId: string | null

  programId: string | null

  termId: string | null

  studentType: StudentType

  yearLevel: number | null
}

export interface SubjectSection {
  id: string

  termId: string

  subjectId: string

  programId: string

  sectionCode: string

  code: string

  title: string

  units: number

  schedule: string

  room: string

  capacity: number

  enrolledCount: number

  scheduleData?: Array<{ day: string; start: string; end: string }> | null
}

export interface AssignedSubject {
  sectionId?: string

  sectionCode?: string

  code: string

  title: string

  units: number

  schedule: string

  room: string
}

export interface Profile {
  id: string

  email: string

  fullName: string

  role: Role

  studentNumber?: string
}

export type RegistrationResult = { status: "signed_in"; profile: Profile } | {
  status: "confirmation_required"
  email: string
}

export interface StudentForm {
  studentType: StudentType

  academicStatus: "regular" | "irregular"

  campus: string

  program: string

  yearLevel: string

  fullName: string

  birthDate: string

  gender: string

  address: string

  mobile: string

  email: string

  guardian: string

  emergencyContact: string
}

export interface Enrollment {
  id: string

  userId: string

  studentNumber?: string

  step: number

  status: "draft" | "submitted" | "in_review" | "returned" | "confirmed"

  form: StudentForm

  academic: AcademicSelection

  academicIssue?: string

  documents: Record<string, string>

  offices: Record<Office, ReviewState>

  remarks: Record<string, string>

  scholarship: ScholarshipDetails

  payment: {
    status: "ready" | "submitted" | "verifying" | "confirmed" | "rejected"
    proof?: string
    receipt?: string
  }

  idStatus: "not_started" | "scheduled" | "captured" | "processing" | "ready" | "completed"

  subjects: AssignedSubject[]

  updatedAt: string

  events: Array<{ text: string; at: string }>
}

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined

const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const isSupabaseConfigured = Boolean(url && key)

export const supabase = isSupabaseConfigured ? createClient(url!, key!) : null

const emptyForm: StudentForm = {
  studentType: "freshman",
  academicStatus: "regular",
  campus: "",
  program: "",

  yearLevel: "",
  fullName: "",
  birthDate: "",
  gender: "",
  address: "",
  mobile: "",
  email: "",

  guardian: "",
  emergencyContact: "",
}

const offices = (): Record<Office, ReviewState> => ({
  registrar: "not_started",
  osas: "not_started",
  guidance: "not_started",
  medical: "not_started",

  scholarship: "not_started",
  cashier: "not_started",
  ict: "not_started",
})

const scholarshipDetails = (): ScholarshipDetails => ({
  fheStatus: "pending",
  additionalAwards: [],
  assistanceStatus: "none",
  notes: "",
})

const now = () => new Date().toISOString()
const requireBackendCapability = (reason: unknown, capability: string) => {
  const error = reason as { code?: string; message?: string }
  if (["42703", "42883", "42P01", "PGRST202", "PGRST204"].includes(String(error?.code ?? "").toUpperCase()))
    throw new Error(`The backend is missing ${capability}. An administrator must apply the current Supabase migrations; retrying will not install it.`)
  throw reason
}

const emptyAcademic = (): AcademicSelection => ({
  campusId: null,
  programId: null,
  termId: null,
  studentType: "freshman",
  yearLevel: null,
})

const createEnrollment = (userId: string, name = ""): Enrollment => ({
  id: crypto.randomUUID(),
  userId,
  step: 1,
  status: "draft",
  form: { ...emptyForm, fullName: name },
  academic: emptyAcademic(),
  documents: {},

  offices: offices(),
  remarks: {},
  scholarship: scholarshipDetails(),
  payment: { status: "ready" },
  idStatus: "not_started",
  subjects: [],
  updatedAt: now(),

  events: [{ text: "Enrollment draft created", at: now() }],
})

const demoProfiles: Profile[] = [
  {
    id: "student-1",
    email: "student@demo.chmsu.edu.ph",
    fullName: "Ana Reyes",
    role: "student",
  },

  ...([
    "registrar",
    "osas",
    "guidance",
    "medical",
    "scholarship",
    "cashier",
    "ict",
    "admin",
  ] as Role[]).map((role) => ({
    id: `${role}-1`,
    email: `${role}@demo.chmsu.edu.ph`,
    fullName: `${role[0].toUpperCase()}${role.slice(1)} Officer`,
    role,
  })),
]

const demoSeed = (): Enrollment[] => {
  const first = createEnrollment("student-1", "Ana Reyes")

  first.form = {
    ...emptyForm,
    fullName: "Ana Reyes",
    email: "student@demo.chmsu.edu.ph",
    birthDate: "2007-04-18",
    gender: "Female",
    address: "Talisay City, Negros Occidental",
    mobile: "09171234567",
    guardian: "Maria Reyes",
    emergencyContact: "09179876543",
  }

  first.status = "submitted"

  first.step = 3

  first.offices.registrar = "submitted"

  return [first]
}

const STORAGE_KEY = "chmsu-enrollment-demo-v2"

export function readDemoEnrollments(): Enrollment[] {
  const raw = localStorage.getItem(STORAGE_KEY)

  if (raw)
    return (JSON.parse(raw) as Partial<Enrollment>[]).map(
      (item) =>
        ({
          ...item,
          form: { ...emptyForm, ...(item.form ?? {}) },
          academic: item.academic ?? emptyAcademic(),
          documents: item.documents ?? {},
          offices: { ...offices(), ...(item.offices ?? {}) },
          remarks: item.remarks ?? {},
          scholarship: { ...scholarshipDetails(), ...(item.scholarship ?? {}) },
          subjects: item.subjects ?? [],
          events: item.events ?? [],
        }) as Enrollment,
    )

  const seeded = demoSeed()

  localStorage.setItem(STORAGE_KEY, JSON.stringify(seeded))

  return seeded
}

export function writeDemoEnrollment(value: Enrollment) {
  const all = readDemoEnrollments()

  const index = all.findIndex((item) => item.id === value.id)

  value.updatedAt = now()

  if (index >= 0) all[index] = value
  else all.push(value)

  localStorage.setItem(STORAGE_KEY, JSON.stringify(all))
}

export async function signIn(
  email: string,
  password: string,
): Promise<Profile> {
  if (supabase) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) throw error

    return profileForUser(data.user)
  }

  if (password !== (email.startsWith("student") ? "Student123!" : "Staff123!"))
    throw new Error("Incorrect demo password.")

  const profile = demoProfiles.find((item) => item.email === email)

  if (!profile) throw new Error("Demo account not found.")

  localStorage.setItem("chmsu-demo-profile", JSON.stringify(profile))

  return profile
}

export async function profileForUser(user: User): Promise<Profile> {
  if (supabase && user.user_metadata?.student_type === "freshman")
    await initializeFreshmanAccount()

  const { data, error } = await supabase!
    .from("profiles")
    .select("id,email,full_name,role,student_number,is_active")
    .eq("id", user.id)
    .single()

  if (error) throw error

  if (!data.is_active) throw new Error("This account is disabled.")

  return {
    id: data.id,
    email: data.email,
    fullName: data.full_name,
    role: data.role,
    studentNumber: data.student_number ?? undefined,
  }
}

export async function restoreProfile(): Promise<Profile | null> {
  if (supabase) {
    const { data } = await supabase.auth.getUser()

    return data.user ? profileForUser(data.user) : null
  }

  const raw = localStorage.getItem("chmsu-demo-profile")

  return raw ? JSON.parse(raw) as Profile : null
}

export async function signOut() {
  if (supabase) await supabase.auth.signOut()

  localStorage.removeItem("chmsu-demo-profile")
}

async function initializeFreshmanAccount() {
  if (!supabase) return

  const { error } = await supabase.rpc("initialize_freshman_account")

  if (error) throw error
}

export async function registerFreshman(
  firstName: string,
  lastName: string,
  email: string,
  password: string,
): Promise<RegistrationResult> {
  const fullName = `${firstName.trim()} ${lastName.trim()}`.trim()

  if (supabase) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          full_name: fullName,
          student_type: "freshman",
        },
      },
    })

    if (error) throw error

    if (!data.user)
      throw new Error("We couldn't create your account. Please try again.")

    if (!data.session) return { status: "confirmation_required", email }

    await initializeFreshmanAccount()

    return { status: "signed_in", profile: await profileForUser(data.user) }
  }

  const profile = {
    id: crypto.randomUUID(),
    email,
    fullName,
    role: "student" as const,
  }

  localStorage.setItem("chmsu-demo-profile", JSON.stringify(profile))

  writeDemoEnrollment(createEnrollment(profile.id, fullName))

  return { status: "signed_in", profile }
}

export async function resetPassword(email: string) {
  if (supabase) {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: location.origin,
    })

    if (error) throw error
  }
}

export async function requestAccess(email: string, message: string) {
  if (supabase) {
    const { error } = await supabase
      .from("account_access_requests")
      .insert({ email, message })

    if (error) throw error
  } else localStorage.setItem(`access-request:${email}`, message)
}

const legacyStatuses: Record<string, Enrollment["status"]> = {
  pending: "submitted",
  approved: "in_review",
  rejected: "returned",
  completed: "confirmed",
}

const isStudentType = (value: unknown): value is StudentType =>
  ["freshman", "transferee", "continuing", "returning"].includes(String(value))

const yearNumber = (value: unknown): number | null => {
  const match = String(value ?? "").match(/[1-5]/)

  return match ? Number(match[0]) : null
}

const yearLabel = (value: number | null) =>
  value
    ? `${value}${
        value === 1 ? "st" : value === 2 ? "nd" : value === 3 ? "rd" : "th"
      } Year`
    : ""

const fromRow = (row: any): Enrollment => ({
  id: row.id,
  userId: row.student?.user_id ?? row.student_id,
  studentNumber: row.student_number ?? row.student?.student_number ?? undefined,
  step: row.current_step,

  status: legacyStatuses[row.status] ?? row.status,

  form: (() => {
    const data = { ...emptyForm, ...(row.form_data ?? {}) }

    const studentType = isStudentType(row.student_type)
      ? row.student_type
      : isStudentType(data.studentType)
        ? data.studentType
        : "freshman"

    const level = yearNumber(row.year_level ?? data.yearLevel)

    return {
      ...data,
      studentType,
      campus:
        row.campus?.name ?? row.program?.campus?.name ?? data.campus ?? "",
      program: row.program?.name ?? data.program ?? "",
      yearLevel: yearLabel(level),
    }
  })(),

  academic: {
    campusId:
      row.campus_id ??
      row.program?.campus_id ??
      row.program?.campus?.id ??
      null,

    programId: row.program_id ?? row.program?.id ?? null,

    termId: row.term_id ?? row.term?.id ?? null,

    studentType: isStudentType(row.student_type)
      ? row.student_type
      : isStudentType(row.form_data?.studentType)
        ? row.form_data.studentType
        : "freshman",

    yearLevel: yearNumber(row.year_level ?? row.form_data?.yearLevel),
  },

  academicIssue: row.academic_review?.map((review: any) => review.details?.message).filter(Boolean).join(" · ") || undefined,

  documents: row.documents ?? {},
  offices: { ...offices(), ...(row.office_statuses ?? {}) },

  remarks: row.remarks ?? {},
  scholarship: { ...scholarshipDetails(), ...(row.scholarship ?? {}) },
  payment: { status: "ready", ...(row.payment ?? {}) },
  idStatus: row.id_status ?? "not_started",

  subjects: row.assigned_subjects ?? [],
  updatedAt: row.updated_at,
  events: row.events ?? [],
})

export async function getEnrollments(profile: Profile): Promise<Enrollment[]> {
  if (!supabase)
    return readDemoEnrollments().filter((item) =>
      profile.role === "student" ? item.userId === profile.id : true,
    )

  if (profile.role === "student") await initializeFreshmanAccount()

  const query = supabase
    .from("enrollments")
    .select(
      "id,student_id,student_number,campus_id,term_id,program_id,student_type,year_level,status,current_step,form_data,office_statuses,remarks,scholarship,payment,id_status,assigned_subjects,updated_at,events,student:students!inner(user_id,student_number,full_name),program:programs!left(id,name,college,campus_id,campus:campus!left(id,name)),term:academic_terms!left(id,academic_year,semester,status)",
    )
    .order("updated_at", { ascending: false })

  const { data, error } =
    profile.role === "student"
      ? await query.eq("student.user_id", profile.id)
      : await query

  if (error) requireBackendCapability(error, "the enrollment consistency schema")

  const rows = data ?? []
  if (!rows.length) return []

  const [{ data: manifests, error: manifestError }, { data: reviews, error: reviewError }] = await Promise.all([
    supabase.rpc("get_staff_document_manifests", { p_enrollment_ids: rows.map((row) => row.id) }),
    supabase.from("enrollment_academic_reviews").select("enrollment_id,issue_key,details").eq("status", "open").in("enrollment_id", rows.map((row) => row.id)),
  ])
  if (manifestError) requireBackendCapability(manifestError, "the protected document manifest")
  if (reviewError) requireBackendCapability(reviewError, "academic review records")

  const documentsByEnrollment = new Map((manifests ?? []).map((manifest) => [manifest.enrollment_id, manifest.documents]))
  const reviewsByEnrollment = new Map<string, string[]>()
  for (const review of reviews ?? []) {
    const issues = reviewsByEnrollment.get(review.enrollment_id) ?? []
    issues.push(review.details?.message ?? review.issue_key)
    reviewsByEnrollment.set(review.enrollment_id, issues)
  }
  const hydratedRows = rows.map((row) => ({
    ...row,
    documents: documentsByEnrollment.get(row.id) ?? {},
    academic_review: (reviewsByEnrollment.get(row.id) ?? []).map((message) => ({ details: { message } })),
  }))

  return hydratedRows.map(fromRow)
}

export async function saveEnrollment(
  value: Enrollment,
  action = "save",
  actorRole?: Role,
) {
  if (!supabase) return writeDemoEnrollment(value)

  const payload: Record<string, unknown> = {
    student_number: value.studentNumber ?? null,
    current_step: value.step,

    status: value.status,
    form_data: value.form,
    documents: value.documents,
    office_statuses: value.offices,

    remarks: value.remarks,
    payment: value.payment,
    id_status: value.idStatus,

    events: value.events,
    academic: {
      campus_id: value.academic.campusId,
      program_id: value.academic.programId,
      term_id: value.academic.termId,
      student_type: value.academic.studentType,
      year_level: value.academic.yearLevel,
    },
  }

  if (actorRole !== "student") payload.scholarship = value.scholarship

  if (action === "approve")
    Object.assign(payload, { assigned_subjects: value.subjects })

  const result = actorRole === "scholarship" && action !== "save"
      ? await supabase.rpc("transition_scholarship_enrollment", { p_enrollment_id: value.id, p_action: action, p_payload: payload })
      : await supabase.rpc("transition_enrollment", { p_enrollment_id: value.id, p_action: action, p_payload: payload })

  if (result.error) requireBackendCapability(result.error, action === "save" || action === "submit" ? "transactional enrollment saving" : `${actorRole ?? "staff"} enrollment transitions`)
}

export async function uploadDocument(
  enrollmentId: string,
  office: string,
  file: File,
): Promise<string> {
  if (!supabase) return `${file.name} (${Math.ceil(file.size / 1024)} KB)`

  const bucket =
    office === "medical"
      ? "medical-files"
      : office === "cashier"
        ? "payment-proofs"
        : "enrollment-files"

  const path = `${enrollmentId}/${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "-")}`

  const { error } = await supabase.storage.from(bucket).upload(path, file)

  if (error) throw error

  return path
}

export async function getDocumentLink(
  office: string,
  path: string,
  expiresIn = 60,
  download = false,
): Promise<string> {
  if (!supabase)
    throw new Error("Document links are unavailable in local demo mode.")
  const bucket =
    office === "medical"
      ? "medical-files"
      : office === "cashier"
        ? "payment-proofs"
        : "enrollment-files"
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, expiresIn, { download })
  if (error || !data?.signedUrl)
    throw error ?? new Error("This document link is unavailable or has expired.")
  return data.signedUrl
}

export async function getPrograms(): Promise<string[]> {
  if (!supabase)
    return (await getAcademicReferenceData()).programs.map(
      (program) => program.name,
    )

  const { data, error } = await supabase
    .from("programs")
    .select("name")
    .eq("is_active", true)
    .order("name")

  if (error) throw error

  return (data ?? []).map((row) => row.name)
}

export async function addProgram(name: string, campusId: string) {
  if (!supabase) {
    const references = await getAcademicReferenceData()

    const next = {
      id: `demo-program-${crypto.randomUUID()}`,
      name,
      college: "Unassigned",
      campusId,
      campusName: references.campuses.find((campus) => campus.id === campusId)
        ?.name,
    }

    localStorage.setItem(
      "chmsu-academic-references",
      JSON.stringify({
        ...references,
        programs: [...references.programs, next],
      }),
    )

    return
  }

  const { error } = await supabase
    .from("programs")
    .insert({ name, college: "Unassigned", campus_id: campusId })

  if (error) throw error
}

export async function deactivateProgram(programId: string) {
  if (!supabase) {
    const references = await getAcademicReferenceData()

    localStorage.setItem(
      "chmsu-academic-references",
      JSON.stringify({
        ...references,
        programs: references.programs.filter(
          (program) => program.id !== programId,
        ),
      }),
    )

    return
  }

  const { error } = await supabase
    .from("programs")
    .update({ is_active: false })
    .eq("id", programId)

  if (error) throw error
}

const demoReferences = (): AcademicReferences => ({
  campuses: ["Talisay", "Alijis", "Fortune Towne", "Binalbagan"].map(
    (name) => ({
      id: `demo-campus-${name.toLowerCase().replace(/ /g, "-")}`,
      name,
    }),
  ),

  programs: [
    ["BS Computer Science", "College of Computer Studies", "Talisay"],
    ["BS Information Technology", "College of Computer Studies", "Talisay"],

    [
      "BS Business Administration",
      "College of Business Management and Accountancy",
      "Talisay",
    ],
    ["BS Criminology", "College of Criminal Justice", "Binalbagan"],
    ["Bachelor of Secondary Education", "College of Education", "Talisay"],
  ].map(([name, college, campusName]) => ({
    id: `demo-program-${name.toLowerCase().replace(/ /g, "-")}`,
    name,
    college,
    campusId: `demo-campus-${campusName.toLowerCase().replace(/ /g, "-")}`,
    campusName,
  })),

  terms: [
    {
      id: "demo-term-2026-2",
      academicYear: "2026–2027",
      semester: "2nd Semester",
      status: "open",
    },
  ],
})

export async function getAcademicReferenceData(): Promise<AcademicReferences> {
  if (!supabase) {
    const raw = localStorage.getItem("chmsu-academic-references")

    return raw ? JSON.parse(raw) as AcademicReferences : demoReferences()
  }

  const [
    { data: campuses, error: campusError },
    { data: programs, error: programError },
    { data: terms, error: termError },
  ] = await Promise.all([
    supabase.from("campus").select("id,name").order("name"),

    supabase
      .from("programs")
      .select("id,name,college,campus_id")
      .eq("is_active", true)
      .order("name"),

    supabase
      .from("academic_terms")
      .select("id,academic_year,semester,status")
      .in("status", ["open", "published"])
      .order("start_date", { ascending: false }),
  ])

  if (campusError) throw campusError
  if (programError) throw programError
  if (termError) throw termError

  const campusNames = new Map(
    (campuses ?? []).map((campus) => [campus.id, campus.name]),
  )

  return {
    campuses: campuses ?? [],

    programs: (programs ?? []).map((program) => ({
      ...program,
      campusId: program.campus_id,
      campusName: campusNames.get(program.campus_id),
    })),

    terms: (terms ?? []).map((term) => ({
      id: term.id,
      academicYear: term.academic_year,
      semester: term.semester,
      status: term.status,
    })),
  }
}

export async function getSubjectSections(
  programId: string,
  termId: string,
): Promise<SubjectSection[]> {
  if (!supabase) return []

  const { data, error } = await supabase.rpc("get_available_subject_sections", {
    p_program_id: programId,
    p_term_id: termId,
  })

  if (error) throw error

  return (data ?? []).map((row: any) => ({
    id: row.id,
    termId: row.term_id,
    subjectId: row.subject_id,
    programId: row.program_id,
    sectionCode: row.section_code,

    code: row.code,
    title: row.title,
    units: Number(row.units),
    schedule: row.schedule,
    room: row.room,
    capacity: row.capacity,

    enrolledCount: row.enrolled_count,
    scheduleData: row.schedule_data,
  }))
}

export async function saveAcademicSelection(value: Enrollment) {
  if (!supabase) return

  if (
    !value.academic.programId ||
    !value.academic.campusId ||
    !value.academic.termId ||
    !value.academic.yearLevel
  )
    throw new Error(
      "Select a campus, matching program, enrollment term, and year level.",
    )

  const { error } = await supabase.rpc("save_enrollment_academics", {
    p_enrollment_id: value.id,
    p_campus_id: value.academic.campusId,
    p_program_id: value.academic.programId,

    p_term_id: value.academic.termId,
    p_student_type: value.academic.studentType,
    p_year_level: value.academic.yearLevel,

    p_form_data: value.form,
  })

  if (error) throw error
}

export async function assignSubjectSections(
  enrollmentId: string,
  sectionIds: string[],
): Promise<AssignedSubject[]> {
  if (!supabase)
    throw new Error(
      "Curriculum and subject sections are not configured yet. Ask an administrator to publish sections for this term and program.",
    )

  const { data, error } = await supabase.rpc(
    "assign_enrollment_subject_sections",
    { p_enrollment_id: enrollmentId, p_section_ids: sectionIds },
  )

  if (error) throw error

  return (data ?? []) as AssignedSubject[]
}

export async function clearSubjectSections(enrollmentId: string) {
  if (!supabase) return
  const { error } = await supabase.rpc("clear_enrollment_subject_sections", {
    p_enrollment_id: enrollmentId,
  })
  if (error) requireBackendCapability(error, "Registrar-controlled assignment clearing")
}

const specialRoleLabels: Partial<Record<Role, string>> = {
  ict: "ICT-MIS",
  osas: "OSAS",
  scholarship: "Scholarship Assessment",
}

export const roleLabel = (role: Role) =>
  specialRoleLabels[role] ?? `${role[0].toUpperCase()}${role.slice(1)}`

export const stateLabel = (value: string) =>
  value
    .split("_")
    .map((word) => word[0].toUpperCase() + word.slice(1))
    .join(" ")

export const addEvent = (item: Enrollment, text: string) => ({
  ...item,
  events: [{ text, at: now() }, ...item.events],
})
