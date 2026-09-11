import { createClient, type User } from "@supabase/supabase-js";

export type Role = "student" | "registrar" | "osas" | "guidance" | "medical" | "scholarship" | "cashier" | "ict" | "admin";
export type Office = "registrar" | "osas" | "guidance" | "medical" | "scholarship" | "cashier" | "ict";
export type ReviewState = "not_started" | "submitted" | "under_review" | "returned" | "cleared";

export interface Profile {
  id: string;
  email: string;
  fullName: string;
  role: Role;
  studentNumber?: string;
}

export interface StudentForm {
  studentType: "freshman" | "transferee" | "continuing" | "returning";
  academicStatus: "regular" | "irregular";
  campus: string;
  program: string;
  yearLevel: string;
  fullName: string;
  birthDate: string;
  gender: string;
  address: string;
  mobile: string;
  email: string;
  guardian: string;
  emergencyContact: string;
}

export interface Enrollment {
  id: string;
  userId: string;
  studentNumber?: string;
  step: number;
  status: "draft" | "submitted" | "in_review" | "returned" | "confirmed";
  form: StudentForm;
  documents: Record<string, string>;
  offices: Record<Office, ReviewState>;
  remarks: Record<string, string>;
  payment: { status: "ready" | "submitted" | "verifying" | "confirmed" | "rejected"; proof?: string; receipt?: string };
  idStatus: "not_started" | "scheduled" | "captured" | "processing" | "ready" | "completed";
  subjects: Array<{ code: string; title: string; units: number; schedule: string; room: string }>;
  updatedAt: string;
  events: Array<{ text: string; at: string }>;
}

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
export const isSupabaseConfigured = Boolean(url && key);
export const supabase = isSupabaseConfigured ? createClient(url!, key!) : null;

const emptyForm: StudentForm = {
  studentType: "freshman", academicStatus: "regular", campus: "Talisay", program: "BS Computer Science",
  yearLevel: "1st Year", fullName: "", birthDate: "", gender: "", address: "", mobile: "", email: "",
  guardian: "", emergencyContact: "",
};

const offices = (): Record<Office, ReviewState> => ({
  registrar: "not_started", osas: "not_started", guidance: "not_started", medical: "not_started",
  scholarship: "not_started", cashier: "not_started", ict: "not_started",
});

const now = () => new Date().toISOString();
const createEnrollment = (userId: string, name = ""): Enrollment => ({
  id: crypto.randomUUID(), userId, step: 1, status: "draft", form: { ...emptyForm, fullName: name }, documents: {},
  offices: offices(), remarks: {}, payment: { status: "ready" }, idStatus: "not_started", subjects: [], updatedAt: now(),
  events: [{ text: "Enrollment draft created", at: now() }],
});

const demoProfiles: Profile[] = [
  { id: "student-1", email: "student@demo.chmsu.edu.ph", fullName: "Ana Reyes", role: "student" },
  ...(["registrar", "osas", "guidance", "medical", "scholarship", "cashier", "ict", "admin"] as Role[]).map(role => ({
    id: `${role}-1`, email: `${role}@demo.chmsu.edu.ph`, fullName: `${role[0].toUpperCase()}${role.slice(1)} Officer`, role,
  })),
];

const demoSeed = (): Enrollment[] => {
  const first = createEnrollment("student-1", "Ana Reyes");
  first.form = { ...emptyForm, fullName: "Ana Reyes", email: "student@demo.chmsu.edu.ph", birthDate: "2007-04-18", gender: "Female", address: "Talisay City, Negros Occidental", mobile: "09171234567", guardian: "Maria Reyes", emergencyContact: "09179876543" };
  first.status = "submitted";
  first.step = 3;
  first.offices.registrar = "submitted";
  return [first];
};

const STORAGE_KEY = "chmsu-enrollment-demo-v2";
export function readDemoEnrollments(): Enrollment[] {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw) return JSON.parse(raw) as Enrollment[];
  const seeded = demoSeed();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(seeded));
  return seeded;
}

export function writeDemoEnrollment(value: Enrollment) {
  const all = readDemoEnrollments();
  const index = all.findIndex(item => item.id === value.id);
  value.updatedAt = now();
  if (index >= 0) all[index] = value; else all.push(value);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
}

export async function signIn(email: string, password: string): Promise<Profile> {
  if (supabase) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return profileForUser(data.user);
  }
  if (password !== (email.startsWith("student") ? "Student123!" : "Staff123!")) throw new Error("Incorrect demo password.");
  const profile = demoProfiles.find(item => item.email === email);
  if (!profile) throw new Error("Demo account not found.");
  localStorage.setItem("chmsu-demo-profile", JSON.stringify(profile));
  return profile;
}

export async function profileForUser(user: User): Promise<Profile> {
  const { data, error } = await supabase!.from("es_profiles").select("id,email,full_name,role,student_number,is_active").eq("id", user.id).single();
  if (error) throw error;
  if (!data.is_active) throw new Error("This account is disabled.");
  return { id: data.id, email: data.email, fullName: data.full_name, role: data.role, studentNumber: data.student_number ?? undefined };
}

export async function restoreProfile(): Promise<Profile | null> {
  if (supabase) {
    const { data } = await supabase.auth.getUser();
    return data.user ? profileForUser(data.user) : null;
  }
  const raw = localStorage.getItem("chmsu-demo-profile");
  return raw ? JSON.parse(raw) as Profile : null;
}

export async function signOut() {
  if (supabase) await supabase.auth.signOut();
  localStorage.removeItem("chmsu-demo-profile");
}

export async function registerFreshman(fullName: string, email: string, password: string): Promise<Profile> {
  if (supabase) {
    const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { full_name: fullName, student_type: "freshman" } } });
    if (error) throw error;
    if (!data.user || !data.session) throw new Error("Account created. Check your email to confirm it, then sign in.");
    return profileForUser(data.user);
  }
  const profile = { id: crypto.randomUUID(), email, fullName, role: "student" as const };
  localStorage.setItem("chmsu-demo-profile", JSON.stringify(profile));
  writeDemoEnrollment(createEnrollment(profile.id, fullName));
  return profile;
}

export async function resetPassword(email: string) {
  if (supabase) {
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: location.origin });
    if (error) throw error;
  }
}

export async function requestAccess(email: string, message: string) {
  if (supabase) {
    const { error } = await supabase.from("es_account_access_requests").insert({ email, message });
    if (error) throw error;
  } else localStorage.setItem(`access-request:${email}`, message);
}

const fromRow = (row: any): Enrollment => ({
  id: row.id, userId: row.student_id, studentNumber: row.student_number ?? undefined, step: row.current_step,
  status: row.status, form: row.form_data, documents: row.documents ?? {}, offices: row.office_statuses ?? offices(),
  remarks: row.remarks ?? {}, payment: row.payment ?? { status: "ready" }, idStatus: row.id_status ?? "not_started",
  subjects: row.assigned_subjects ?? [], updatedAt: row.updated_at, events: row.events ?? [],
});

export async function getEnrollments(profile: Profile): Promise<Enrollment[]> {
  if (!supabase) return readDemoEnrollments().filter(item => profile.role === "student" ? item.userId === profile.id : true);
  const query = supabase.from("es_enrollments").select("*").order("updated_at", { ascending: false });
  const { data, error } = profile.role === "student" ? await query.eq("student_id", profile.id) : await query;
  if (error) throw error;
  return (data ?? []).map(fromRow);
}

export async function saveEnrollment(value: Enrollment, action = "save") {
  if (!supabase) return writeDemoEnrollment(value);
  const payload = {
    id: value.id, student_id: value.userId, student_number: value.studentNumber ?? null, current_step: value.step,
    status: value.status, form_data: value.form, documents: value.documents, office_statuses: value.offices,
    remarks: value.remarks, payment: value.payment, id_status: value.idStatus, assigned_subjects: value.subjects,
    events: value.events,
  };
  const { error } = action === "save"
    ? await supabase.from("es_enrollments").upsert(payload)
    : await supabase.rpc("es_transition_enrollment", { p_enrollment_id: value.id, p_action: action, p_payload: payload });
  if (error) throw error;
}

export async function uploadDocument(enrollmentId: string, office: string, file: File): Promise<string> {
  if (!supabase) return `${file.name} (${Math.ceil(file.size / 1024)} KB)`;
  const bucket = office === "medical" ? "medical-files" : office === "cashier" ? "payment-proofs" : "enrollment-files";
  const path = `${enrollmentId}/${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "-")}`;
  const { error } = await supabase.storage.from(bucket).upload(path, file);
  if (error) throw error;
  return path;
}

export async function getPrograms(): Promise<string[]> {
  if (!supabase) return JSON.parse(localStorage.getItem("chmsu-programs") || "[\"BS Computer Science\",\"BS Information Technology\",\"BS Business Administration\"]") as string[];
  const { data, error } = await supabase.from("es_programs").select("name").eq("is_active", true).order("name");
  if (error) throw error;
  return (data ?? []).map(row => row.name);
}

export async function addProgram(name: string) {
  if (!supabase) return;
  const code = name.toUpperCase().replace(/[^A-Z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 20);
  const { error } = await supabase.from("es_programs").insert({ code, name, college: "Unassigned", campus: [] });
  if (error) throw error;
}

export async function deactivateProgram(name: string) {
  if (!supabase) return;
  const { error } = await supabase.from("es_programs").update({ is_active: false }).eq("name", name);
  if (error) throw error;
}

export const roleLabel = (role: Role) => ({ ict: "ICT-MIS", osas: "OSAS", scholarship: "Scholarship Assessment" }[role] ?? `${role[0].toUpperCase()}${role.slice(1)}`);
export const stateLabel = (value: string) => value.split("_").map(word => word[0].toUpperCase() + word.slice(1)).join(" ");
export const addEvent = (item: Enrollment, text: string) => ({ ...item, events: [{ text, at: now() }, ...item.events] });
