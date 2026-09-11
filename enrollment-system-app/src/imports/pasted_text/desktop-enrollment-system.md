Create a complete, high-fidelity **desktop online enrollment system** in Figma for Carlos Hilado Memorial State University.

Use CHMSU’s enrollment process and academic programs as the content reference, but use a **neutral visual theme for now**. Do not apply CHMSU colors, logo, seal, or official branding yet.

## Platform and layout

- Design primarily for desktop at **1440 × 900 px**.
- Use a persistent left sidebar, top header, and spacious content area.
- Use responsive layouts that can adapt to tablets and smaller screens.
- Use two-column forms where appropriate.
- Use a clean navy, blue, white, and light-gray color palette.
- Use modern typography, rounded cards, subtle shadows, accessible contrast, and clear status indicators.
- Ensure buttons and form fields are easy to understand.
- Create reusable Figma components and variants.

## User types

Create interfaces for:

- Student
- Freshman applicant
- Registrar
- Office for Student Affairs and Services (OSAS)
- Guidance Services
- Medical Services
- Scholarship and Free Higher Education assessment
- Cashier or assigned insurance collection office
- ICT-MIS

## Login screen

Create a student login form containing:

- Student ID Number
- Password
- Forgot Password
- Sign In
- Request Account Access

Do not prefill the Student ID, name, password, or enrollment email.

Below the login form, create a separate card for incoming first-year students:

**New here? Start as a freshie.**

“Begin your enrollment without a student ID or portal account.”

Button:

**Freshman Enrollment**

Freshmen must be able to start without logging in, without a student ID, and without a password. Display **“Not yet assigned”** for their student number.

## Existing student profile

Use the following sample account information only on the profile page:

- Name: Cyrus
- Email: cyrus@gmail.com

Do not automatically place this email or name in the enrollment form. The enrollment form fields must remain blank until the student enters information.

## Enrollment dashboard

Show:

- Student greeting
- Academic year and semester
- Enrollment status
- Current step
- Completed steps
- Pending actions
- Announcements
- Continue Enrollment button
- Documents shortcut
- Student support shortcut

If no enrollment name has been entered, use the greeting:

**Hello, Student**

## CHMSU-based enrollment flow

Use this six-step enrollment process:

### Step 1: Forms and academic slips

Allow the student to enter:

- Student type: freshman, transferee, continuing, returning
- Regular or irregular status
- Campus
- Program
- Year level
- Full name
- Date of birth
- Gender
- Address
- Mobile number
- Email address
- Parent or guardian information
- Emergency contact
- Academic year and semester

For first-year students and transferees, explain that the Online Student Information Sheet must be completed before their scheduled enrollment.

Include the applicable:

- Admission Slip
- Loading Slip from the program chair
- Save Draft
- Review Information
- Submit Information

Do not prefill the name or email address.

### Step 2: Registrar requirements

Create different checklists for each student type.

For incoming first-year students:

- Original Senior High School Report Card
- Certificate of Rating for ALS completers, when applicable
- Original Certificate of Good Moral Character
- Two photocopies of PSA/NSO Birth Certificate
- Marriage Certificate copies when applicable
- Two recent 2 × 2 ID pictures
- Student Information Sheet
- Long brown envelope
- Long cream or white folder
- Long plastic folder for Binalbagan Campus when required

For transferees:

- Transfer Credential
- Photocopy of Transcript of Records
- Certificate of Good Moral Character
- Civil registry documents
- ID pictures
- Student Information Sheet
- Loading Slip when applicable

For continuing students:

- Accomplished Clearance Form
- Loading Slip for irregular students
- Student ID or Enrollment Form from the last school term attended

Clearly distinguish:

- Digital uploads
- Physical documents to bring
- Conditional requirements
- Campus-specific requirements

Include staff remarks, returned-for-correction states, and resubmission.

### Step 3: Assessment and insurance

Show **Free Higher Education / UniFAST** coverage as the default tuition status for eligible students.

Display:

- Tuition: Government-funded
- Tuition payable: ₱0.00
- Student insurance: ₱125.00
- Total payable: ₱125.00

The only payment in the default prototype flow is the **₱125 student insurance fee**.

Do not include:

- Sample tuition charges
- Other school fees
- Percentage scholarship discounts
- Optional tuition scholarship applications inside this payment step

Add a note that eligibility exceptions and pending school fees require staff assessment.

Create payment states:

- Awaiting assessment
- Ready for payment
- Payment submitted
- Under verification
- Payment confirmed
- Payment rejected
- Receipt issued

Payment confirmation must come from authorized staff. Paying insurance must not automatically complete enrollment.

### Step 4: Student support offices

Create separate verification cards for:

- OSAS
- Guidance Services
- Medical Services

For first-year students, include:

**Guidance Services**
- Student Individual Inventory
- Recent 2 × 2 ID picture

**Medical Services**
- Recent chest X-ray result taken within the last six months
- Recent medical certificate signed by a licensed physician
- Medical Health Form
- Recent 1 × 1 ID picture
- Additional medical clearance when required

For continuing students, include:

- Recent chest X-ray
- Recent medical certificate
- Conditional medical clearance when required

Do not include:

- Annual Student Profiling
- Accountability Clearance

Document and picture uploads must be **optional in the prototype**. Students must be able to continue without selecting or uploading pictures. Label upload controls as optional.

Include these statuses for each office:

- Not started
- Action required
- Submitted
- Under review
- Returned for correction
- Cleared

Medical documents should only be visible to authorized Medical Services personnel. Other offices should only see the student’s clearance status.

### Step 5: School ID processing

Create an ICT-MIS processing screen containing:

- Identity verification
- Photo capture status
- Student number status
- School ID processing
- Campus instructions
- Scheduled visit when required

Use these states:

- Not started
- Scheduled
- Data captured
- Processing
- Ready for release
- Completed

### Step 6: Enrollment form release

The Registrar performs the final review of:

- Student information
- Academic slips
- Registrar requirements
- Free Higher Education assessment
- Insurance payment
- Student support clearances
- School ID processing

After approval, show:

- Enrollment confirmed
- Official student number
- Program
- Year level
- Section
- Enrolled subjects
- Units
- Class schedule
- Insurance receipt
- Enrollment Form
- Print
- Download as PDF

Only show **Enrollment Confirmed** after the Registrar releases the Enrollment Form.

## Academic programs

Use CHMSU’s official undergraduate program catalog. Organize the program selector using colleges and specializations:

- College of Arts and Sciences
- College of Business Management and Accountancy
- College of Computer Studies
- College of Criminal Justice
- College of Education
- College of Engineering
- College of Fisheries
- College of Industrial Technology

Include campus availability and program-specific screening information only when verified. Do not invent course availability or assign the same subjects to every program.

## Staff dashboards

Create desktop dashboards for each office.

Each dashboard should contain:

- Summary cards
- Student processing queue
- Search
- Campus filter
- Program filter
- Student-type filter
- Status filter
- Student detail drawer or page
- Requirements checklist
- Staff remarks
- Return for correction
- Approve or clear
- Activity history
- Date and time of the latest action

The Cashier dashboard should focus on the ₱125 insurance payment and receipt verification.

The Scholarship dashboard should separate additional scholarships and financial assistance from the default Free Higher Education tuition coverage.

## System states and components

Create reusable components for:

- Buttons
- Text fields
- Select fields
- Checkboxes
- File uploads
- Tables
- Sidebar navigation
- Header
- Student cards
- Status badges
- Progress tracker
- Alerts
- Confirmation dialogs
- Payment receipt
- Empty states
- Loading states
- Error states
- Success states

Use text and icons alongside colors for statuses.

## Prototype behavior

Connect the complete clickable flow:

Login or Freshman Enrollment → Student Information → Registrar Requirements → Assessment and ₱125 Insurance → Student Support Offices → School ID Processing → Registrar Final Review → Enrollment Form Release → Enrollment Confirmed

Users must be able to move backward without losing entered information.

Include a visible label indicating that this is a prototype. Clearly identify staff approvals and payments as simulated where necessary.