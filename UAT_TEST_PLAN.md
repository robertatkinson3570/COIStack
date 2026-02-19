# CertWall -- User Acceptance Test Plan

**Application:** CertWall -- COI Compliance Management System
**Version:** 1.0 (Production Build)
**Date:** 2026-02-18
**Prepared by:** QA Engineering
**Tech Stack:** Next.js 15, TypeScript, Supabase, Stripe, Claude/OpenAI Vision

---

## Table of Contents

1. [Test Scope](#test-scope)
2. [Prerequisites](#prerequisites)
3. [Test Cases](#test-cases)
   - [Authentication](#1-authentication)
   - [Organization Setup](#2-organization-setup)
   - [Dashboard](#3-dashboard)
   - [Upload Flow](#4-upload-flow)
   - [Compliance](#5-compliance)
   - [Reminders](#6-reminders)
   - [Export](#7-export)
   - [Team Management](#8-team-management)
   - [Billing](#9-billing)
   - [Support](#10-support)
   - [Settings](#11-settings)
   - [Marketing Pages](#12-marketing-pages)
   - [Navigation](#13-navigation)
   - [Security](#14-security)
   - [Edge Cases](#15-edge-cases)

---

## Test Scope

This UAT covers the complete CertWall application including authentication, multi-tenant data isolation, COI upload/extraction pipeline, compliance scoring, reminders, audit export, team management, billing via Stripe, support ticketing, user settings, marketing pages, navigation, security controls, and edge-case handling.

---

## Prerequisites

- A Supabase project with the production schema applied (all `cw_` tables, RLS policies, triggers)
- Stripe test-mode keys configured (`STRIPE_SECRET_KEY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET`, price IDs for all tiers)
- OpenAI/Claude API key configured for COI extraction
- At least two test email addresses (for multi-user/team testing)
- Sample PDF COI files: one valid, one expired, one non-PDF, one over 4 MB, one duplicate
- Application running locally or on a staging environment at a known `NEXT_PUBLIC_APP_URL`

---

## Test Cases

### 1. Authentication

| ID | Feature | Scenario | Steps | Expected Result | Priority |
|----|---------|----------|-------|-----------------|----------|
| AUTH-01 | Register | Successful registration with valid data | 1. Navigate to `/auth/register`. 2. Enter full name, work email, password (8+ chars), company name. 3. Click "Create Account". | Account is created. User profile row exists in `cw_user_profiles`. User is redirected to `/dashboard`. | P0 |
| AUTH-02 | Register | Validation rejects incomplete fields | 1. Navigate to `/auth/register`. 2. Leave one or more required fields blank. 3. Click "Create Account". | Form shows inline validation errors for each missing/invalid field. No API call is made. | P0 |
| AUTH-03 | Register | Password minimum length enforced | 1. Navigate to `/auth/register`. 2. Fill all fields but enter a 5-character password. 3. Click "Create Account". | Validation error displayed: password must be at least 8 characters. | P1 |
| AUTH-04 | Register | Duplicate email rejected | 1. Register with email `test@example.com`. 2. Attempt to register again with the same email. | Error message indicating the email is already registered. User remains on the register page. | P1 |
| AUTH-05 | Login | Successful email/password login | 1. Navigate to `/auth/login`. 2. Enter valid email and password. 3. Click "Sign In". | User is authenticated and redirected to `/dashboard`. Session cookie is set. | P0 |
| AUTH-06 | Login | Invalid credentials show error | 1. Navigate to `/auth/login`. 2. Enter a valid email with an incorrect password. 3. Click "Sign In". | Error message is displayed (e.g., "Invalid login credentials"). User stays on login page. | P0 |
| AUTH-07 | Login | Magic link login | 1. Navigate to `/auth/login`. 2. Click the magic link / email link option. 3. Enter a registered email. 4. Submit. | Success message shown ("Check your email"). A magic link email is sent. Clicking the link logs the user in and redirects to `/dashboard`. | P1 |
| AUTH-08 | Forgot Password | Reset link sent | 1. Navigate to `/auth/forgot-password`. 2. Enter a registered email. 3. Click "Send Reset Link". | Success message displayed ("Check your email for a reset link") regardless of whether the email exists in the system. | P1 |
| AUTH-09 | Forgot Password | Non-existent email does not leak info | 1. Navigate to `/auth/forgot-password`. 2. Enter an email that is NOT registered. 3. Submit. | The same success message is shown as for a valid email. No indication that the email does not exist. | P1 |
| AUTH-10 | Logout | User can sign out | 1. Log in to the app. 2. Click the logout button in the sidebar. | Session is destroyed. User is redirected to `/` (landing page). Visiting `/dashboard` redirects to `/auth/login`. | P0 |
| AUTH-11 | Session Redirect | Authenticated user redirected from auth pages | 1. Log in to the app. 2. Manually navigate to `/auth/login`. | User is redirected to `/dashboard`. Same behavior for `/auth/register`. | P1 |
| AUTH-12 | Session Redirect | Unauthenticated user redirected to login | 1. Log out. 2. Navigate to `/dashboard`. | Redirected to `/auth/login?redirect=/dashboard`. After login, redirected back to `/dashboard`. | P0 |

---

### 2. Organization Setup

| ID | Feature | Scenario | Steps | Expected Result | Priority |
|----|---------|----------|-------|-----------------|----------|
| ORG-01 | Org Creation | Organization created during registration | 1. Register a new account with company name "Acme Properties". | A `cw_organizations` row is created with `name = "Acme Properties"`, `slug = "acme-properties"`, `plan_tier = "starter"`, `subscription_status = "trialing"`, `vendor_limit = 75`. | P0 |
| ORG-02 | Membership | Owner membership created | 1. Register a new account. 2. Query `cw_org_memberships` for the new user. | A membership row exists with `role = "owner"`. | P0 |
| ORG-03 | Templates | Default compliance templates seeded | 1. Register a new account. 2. Query `cw_requirements_templates` for the new org. | Template rows exist for each trade type (GC, HVAC, CLEANING, ELECTRICAL, PLUMBING, ROOFING, LANDSCAPING, OTHER) with valid `rules_json`. | P0 |
| ORG-04 | Duplicate Org | User already in org cannot create another | 1. Register and get an org. 2. Call `POST /api/auth/setup-org` with a new company name. | API returns 409: "User already belongs to an organization". | P1 |

---

### 3. Dashboard

| ID | Feature | Scenario | Steps | Expected Result | Priority |
|----|---------|----------|-------|-----------------|----------|
| DASH-01 | Summary Cards | Correct counts displayed | 1. Ensure the org has vendors with green, yellow, and red compliance statuses. 2. Navigate to `/dashboard`. | Three summary cards display the correct count for Compliant (green), Expiring Soon (yellow), and Non-Compliant (red). | P0 |
| DASH-02 | Vendor Table | Vendors listed with correct data | 1. Navigate to `/dashboard`. | Vendor table shows all org vendors with columns for name, trade type, status badge, expiry date, and last upload date. | P0 |
| DASH-03 | Loading State | Skeleton shown while data loads | 1. Navigate to `/dashboard` (with slow network or throttled). | Skeleton cards (3) and skeleton table rows (4) are displayed before data arrives. No flash of empty content. | P1 |
| DASH-04 | Empty State | No vendors shows appropriate message | 1. Register a brand new account (no vendors). 2. Navigate to `/dashboard`. | All summary cards show 0. The vendor table area shows an empty state with a prompt to add vendors. | P1 |
| DASH-05 | Refresh | Data reloads on refresh button click | 1. On the dashboard, click the "Refresh" button. | The refresh icon animates (spins). Data is re-fetched from `/api/compliance`. Updated data is rendered. | P1 |
| DASH-06 | Error Handling | API failure shows toast error | 1. Simulate a failure on `GET /api/compliance` (e.g., invalid token). 2. Navigate to `/dashboard`. | A toast notification appears: "Failed to load compliance data". | P2 |

---

### 4. Upload Flow

| ID | Feature | Scenario | Steps | Expected Result | Priority |
|----|---------|----------|-------|-----------------|----------|
| UPLD-01 | Full Upload | Successful PDF upload and extraction | 1. Navigate to `/upload`. 2. Select a vendor from the dropdown. 3. Choose a valid PDF file (under 4 MB). 4. Click "Upload & Analyze". | Upload progress shown. Extraction runs. Results panel appears with compliance badge (GREEN/YELLOW/RED), extracted fields, and confidence score. | P0 |
| UPLD-02 | Vendor Selection | Vendor list loads and is selectable | 1. Navigate to `/upload`. | The vendor dropdown populates with all vendors belonging to the user's organization. Each vendor shows name and trade type. | P0 |
| UPLD-03 | File Validation | Non-PDF file rejected | 1. Navigate to `/upload`. 2. Select a vendor. 3. Attempt to choose a `.docx` or `.jpg` file. | The file input only accepts PDFs (via `accept="application/pdf"`). If bypass occurs, API returns 400: "Only PDF files are accepted". | P0 |
| UPLD-04 | File Size Limit | File over 4 MB rejected | 1. Navigate to `/upload`. 2. Select a vendor. 3. Choose a PDF larger than 4 MB. | Client-side warning: "File exceeds 4MB limit." If submitted, API returns 413: "File exceeds 4MB limit". | P0 |
| UPLD-05 | Duplicate Detection | Same file for same vendor detected | 1. Upload a PDF for Vendor A. 2. Upload the exact same PDF file for Vendor A again. | The second upload returns `is_duplicate: true`. Error displayed: "This document has already been uploaded for this vendor." No new extraction runs. | P0 |
| UPLD-06 | Upload Progress | Stage indicators update during process | 1. Start an upload. Observe the button text. | Button shows "Uploading..." during upload, then "Extracting & Scoring..." during extraction, then resets. | P1 |
| UPLD-07 | Error Recovery | Failed extraction shows error message | 1. Upload a valid PDF. 2. Simulate extraction API failure. | Error message displayed in a red alert box. The stage resets to "error". User can retry. | P1 |

---

### 5. Compliance

| ID | Feature | Scenario | Steps | Expected Result | Priority |
|----|---------|----------|-------|-----------------|----------|
| COMP-01 | Green Status | Fully compliant COI scores green | 1. Upload a COI with all required coverages (GL limits met, workers' comp present, additional insured present, unexpired). | Compliance status is GREEN. No failure reasons listed. Dashboard card for "Compliant" increments by 1. | P0 |
| COMP-02 | Yellow Status | Expiring-soon COI scores yellow | 1. Upload a COI with valid coverage but an expiration date within 30 days. | Compliance status is YELLOW. Reason includes expiry warning. Dashboard "Expiring Soon" count increments. | P0 |
| COMP-03 | Red Status | Non-compliant COI scores red | 1. Upload a COI missing workers' compensation or with GL limits below the trade-type threshold. | Compliance status is RED. Failure reasons list the specific deficiencies. Dashboard "Non-Compliant" count increments. | P0 |
| COMP-04 | Regression Detection | Coverage downgrade flagged | 1. Upload a compliant COI for Vendor A. 2. Upload a second COI for Vendor A with lower GL limits. | The response includes `diff.has_regression: true` with regressions listed. The extraction is flagged `needs_review: true`. | P0 |
| COMP-05 | Re-scoring | Extraction can be re-scored | 1. Obtain an `extraction_id` from a previous upload. 2. Call `POST /api/compliance/score` with that extraction_id. | A new compliance score is computed and the `cw_compliance_status` row is updated. The response includes the recalculated status and reasons. | P1 |
| COMP-06 | Needs Review Flag | Low confidence triggers review flag | 1. Upload a COI that produces a confidence score below 0.7 (e.g., a poorly scanned PDF). | The extraction result has `needs_review: true`. | P1 |

---

### 6. Reminders

| ID | Feature | Scenario | Steps | Expected Result | Priority |
|----|---------|----------|-------|-----------------|----------|
| REM-01 | Run Reminders | Reminders generated for expiring vendors | 1. Ensure at least one vendor has a `next_expiry_date` within 30 days. 2. On the dashboard, click "Run Reminders". | A dialog shows results with the number of reminders sent. Each reminder shows vendor name, stage (30d/14d/7d/1d/expired_weekly), and message preview. | P0 |
| REM-02 | Deduplication | Same reminder not sent twice | 1. Click "Run Reminders" once (generates a 30d reminder for Vendor A). 2. Click "Run Reminders" again immediately. | The second run returns 0 new reminders for Vendor A at the 30d stage, because it was already logged. | P0 |
| REM-03 | Expired Weekly | Expired vendor gets weekly reminders | 1. Ensure a vendor's COI expired more than 1 day ago. 2. Run reminders. 3. Wait 7+ days (or adjust test data). 4. Run reminders again. | First run sends `expired_weekly`. Second run after 7 days sends another `expired_weekly`. Runs within the 7-day window are deduplicated. | P1 |
| REM-04 | No Expiry Date | Vendors without expiry are skipped | 1. Ensure a vendor has no `next_expiry_date` in compliance status. 2. Run reminders. | That vendor does not appear in the reminder results. | P2 |

---

### 7. Export

| ID | Feature | Scenario | Steps | Expected Result | Priority |
|----|---------|----------|-------|-----------------|----------|
| EXP-01 | Audit ZIP | ZIP file generated and downloadable | 1. Ensure the org has at least 2 vendors with uploaded COIs. 2. On the dashboard, click "Export Audit". | A ZIP file is generated and uploaded to Supabase Storage. A signed download URL is returned. The URL downloads a valid ZIP. | P0 |
| EXP-02 | CSV Content | CSV includes all vendor compliance data | 1. Download the audit ZIP. 2. Extract and open the CSV file. | The CSV contains columns for vendor name, trade type, status, next expiry date, GL limits, workers' comp, additional insured, waiver of subrogation, missing items, and last upload date. Each vendor has one row. | P0 |
| EXP-03 | PDF Inclusion | Vendor PDFs included in ZIP | 1. Download the audit ZIP. 2. Check the file listing. | Each vendor with an uploaded COI has a corresponding PDF file in the ZIP named `{VendorName}_coi.pdf`. | P1 |
| EXP-04 | Signed URL Expiry | Download link expires after 1 hour | 1. Generate an audit export. 2. Note the `expires_in: "1 hour"` in the response. 3. Attempt to use the URL after 1 hour. | The URL returns a 403/expired error after 1 hour. | P2 |

---

### 8. Team Management

| ID | Feature | Scenario | Steps | Expected Result | Priority |
|----|---------|----------|-------|-----------------|----------|
| TEAM-01 | View Team | Team members listed | 1. Log in as the org owner. 2. Navigate to `/settings/team`. | The members table shows the owner with their name, email, role badge ("owner"), and join date. | P0 |
| TEAM-02 | Invite Member | Owner sends invite | 1. As owner, on the Team page, enter an email and select role "member". 2. Click "Send Invite". | Toast: "Invitation sent to {email}". The invite appears in the "Pending Invitations" section with status "Pending". The API returns an `invite_url`. | P0 |
| TEAM-03 | Accept Invite | Invited user joins org | 1. Register a new account using the invite token URL. 2. (Or as an existing user) call `POST /api/team/invite/accept` with the token. | The new user is added to the org with the invited role. The invite status changes to "accepted". The user sees the org's dashboard data. | P0 |
| TEAM-04 | Duplicate Invite | Duplicate pending invite rejected | 1. As owner, invite `user@example.com` with role "member". 2. Try to invite `user@example.com` again while the first is still pending. | API returns 409: "A pending invite already exists for this email". | P1 |
| TEAM-05 | Existing Member Invite | Invite rejected for current member | 1. As owner, try to invite an email that already belongs to a member of the org. | API returns 409: "This user is already a member of your organization". | P1 |
| TEAM-06 | Revoke Invite | Owner revokes a pending invite | 1. As owner, find a pending invite. 2. Call `DELETE /api/team/invite/{id}`. | Invite status changes to "revoked". It no longer appears in the pending invites list. | P1 |
| TEAM-07 | Change Role | Owner changes member role | 1. As owner, call `PUT /api/team/{userId}/role` with `{ role: "admin" }`. | The member's role is updated to "admin". The change is reflected on the team page. | P1 |
| TEAM-08 | Self-Role Change Blocked | Owner cannot change own role | 1. As owner, call `PUT /api/team/{ownUserId}/role` with `{ role: "admin" }`. | API returns 400: "You can't change your own role". | P1 |
| TEAM-09 | Remove Member | Owner removes a team member | 1. As owner, call `DELETE /api/team/{userId}`. | The membership row is deleted. The member no longer appears on the team page. The removed user can no longer access the org's data. | P0 |
| TEAM-10 | Self-Removal Blocked | Owner cannot remove self | 1. As owner, call `DELETE /api/team/{ownUserId}`. | API returns 400: "You can't remove yourself". | P1 |
| TEAM-11 | Admin Invite Restriction | Non-owner cannot invite as admin | 1. Log in as an admin (not owner). 2. Try to invite someone with `role: "admin"`. | API returns 403: "Only owners can invite admins". | P1 |
| TEAM-12 | Team Limit | Invite blocked at plan limit | 1. Ensure org is on Starter plan (limit 3). 2. Add members until count equals 3. 3. Attempt to send another invite. | API returns 403: "Team member limit reached (3). Upgrade your plan to invite more members." | P1 |
| TEAM-13 | Invite Visibility | Only owner/admin see invite form | 1. Log in as a "member" role user. 2. Navigate to `/settings/team`. | The invite form is NOT displayed. The team members list is visible but read-only. | P1 |

---

### 9. Billing

| ID | Feature | Scenario | Steps | Expected Result | Priority |
|----|---------|----------|-------|-----------------|----------|
| BILL-01 | Current Plan Display | Billing page shows plan info | 1. Log in as owner. 2. Navigate to `/settings/billing`. | Current plan card shows the plan name (e.g., "starter"), subscription status badge (e.g., "trialing"), vendor usage progress bar (count/limit), and trial end date if trialing. | P0 |
| BILL-02 | Checkout | Stripe checkout session created | 1. As owner, call `POST /api/billing/checkout` with `{ tier: "growth" }`. | API returns a Stripe checkout URL. Navigating to the URL shows the Stripe Checkout page with the Growth plan price ($299/mo). | P0 |
| BILL-03 | Portal Access | Billing portal opens | 1. As owner with an existing Stripe customer, click "Manage Billing" on the billing page. | `POST /api/billing/portal` returns a URL. The URL opens the Stripe Billing Portal where the user can manage payment methods, view invoices, and cancel. | P0 |
| BILL-04 | Portal Without Stripe | Portal fails gracefully without Stripe customer | 1. As owner of an org with no `stripe_customer_id`, click "Manage Billing". | API returns 400: "No billing account found. Please select a plan first." Toast error is shown. | P1 |
| BILL-05 | Webhook - Checkout Complete | Subscription activated on checkout | 1. Complete a Stripe Checkout session for the Growth plan. 2. Stripe sends `checkout.session.completed` webhook. | The org's `plan_tier` is updated to "growth", `subscription_status` to "active" (or "trialing"), `vendor_limit` to 200. `stripe_customer_id` and `stripe_subscription_id` are stored. | P0 |
| BILL-06 | Webhook - Subscription Deleted | Cancellation downgrades plan | 1. Cancel the subscription in Stripe. 2. Stripe sends `customer.subscription.deleted` webhook. | The org's `subscription_status` is set to "canceled", `plan_tier` to "starter", `vendor_limit` to 75. | P0 |
| BILL-07 | Webhook - Payment Failed | Failed payment sets past_due | 1. Simulate a failed invoice payment. 2. Stripe sends `invoice.payment_failed` webhook. | The org's `subscription_status` is set to "past_due". | P1 |
| BILL-08 | Webhook Signature | Invalid signature rejected | 1. Send a request to `POST /api/billing/webhook` with an invalid `stripe-signature` header. | API returns 400: "Webhook signature verification failed". No database changes occur. | P0 |
| BILL-09 | Owner-Only Billing | Non-owner cannot access checkout | 1. Log in as an admin. 2. Call `POST /api/billing/checkout`. | API returns 403 (role check fails). The billing page shows "Only the organization owner can manage billing." | P1 |
| BILL-10 | Billing Status | API returns current billing info | 1. Call `GET /api/billing/status` as an authenticated user. | Response includes `plan_tier`, `subscription_status`, `vendor_limit`, `vendor_count`, and `trial_ends_at`. | P1 |

---

### 10. Support

| ID | Feature | Scenario | Steps | Expected Result | Priority |
|----|---------|----------|-------|-----------------|----------|
| SUP-01 | Create Ticket | Ticket created successfully | 1. Navigate to `/support`. 2. Click "New Ticket". 3. Enter subject and description. 4. Click "Submit Ticket". | Toast: "Support ticket created". The ticket appears in the "Your Tickets" list with status "open" and priority "medium" (default). | P0 |
| SUP-02 | List Tickets | All org tickets displayed | 1. Create 2+ tickets. 2. Navigate to `/support`. | All tickets are listed with subject, priority badge, status badge, and creation date. Most recent ticket appears first. | P0 |
| SUP-03 | Ticket Detail | Ticket messages visible | 1. Call `GET /api/support/tickets/{id}`. | Response includes the ticket details and an array of messages (initially empty). | P1 |
| SUP-04 | Reply to Ticket | User adds a message | 1. Call `POST /api/support/tickets/{id}/reply` with `{ message: "More details here" }`. | A new message row is created with `is_staff: false`. The ticket's `updated_at` timestamp is refreshed. | P1 |
| SUP-05 | Update Status | Ticket creator can close ticket | 1. As the ticket creator, call `PUT /api/support/tickets/{id}` with `{ status: "resolved" }`. | Ticket status updated to "resolved". `resolved_at` timestamp is set. | P1 |
| SUP-06 | Empty State | No tickets shows placeholder | 1. As a user with no tickets, navigate to `/support`. | An empty state is displayed with a help icon and text: "No support tickets yet". | P2 |
| SUP-07 | Validation | Ticket without subject rejected | 1. Call `POST /api/support/tickets` with an empty subject. | API returns 400: "subject and description are required". | P1 |

---

### 11. Settings

| ID | Feature | Scenario | Steps | Expected Result | Priority |
|----|---------|----------|-------|-----------------|----------|
| SET-01 | Profile Display | Profile page loads user data | 1. Navigate to `/settings/profile`. | The email field is displayed (read-only, disabled). The full name field is pre-populated with the current name. | P0 |
| SET-02 | Profile Update | Name saved successfully | 1. Navigate to `/settings/profile`. 2. Change the full name. 3. Click "Save Changes". | Toast: "Profile updated". The `cw_user_profiles` row is updated. Refreshing the page shows the new name. | P0 |
| SET-03 | Profile Loading | Skeleton shown during load | 1. Navigate to `/settings/profile` (with slow network). | Skeleton placeholders appear for the email and name fields until data loads. | P2 |
| SET-04 | Team Page Access | Team page renders for all roles | 1. Log in with different roles (owner, admin, member, viewer). 2. Navigate to `/settings/team`. | All roles can view the team members list. Only owner/admin see the invite form. | P1 |
| SET-05 | Billing Page Access | Billing page renders for all roles | 1. Log in as a non-owner. 2. Navigate to `/settings/billing`. | Plan information is visible. The "Manage Billing" button is NOT shown. A message says "Only the organization owner can manage billing." | P1 |

---

### 12. Marketing Pages

| ID | Feature | Scenario | Steps | Expected Result | Priority |
|----|---------|----------|-------|-----------------|----------|
| MKT-01 | Landing Page | All sections render | 1. Navigate to `/`. | The page renders in order: MarketingNav, Hero, HowItWorks, Features, FAQ, CTASection, MarketingFooter. No console errors. | P0 |
| MKT-02 | Landing Hero CTAs | CTA buttons navigate correctly | 1. On the landing page, click "Start Free Trial". | User is navigated to `/auth/register`. 2. Click "See Pricing" navigates to `/pricing`. | P0 |
| MKT-03 | Pricing Page | Pricing cards displayed | 1. Navigate to `/pricing`. | Page shows headline "Simple pricing that scales with you", subheadline about 14-day trial, and pricing cards (Starter $149, Growth $299, Pro $499, Scale $799). | P0 |
| MKT-04 | Pricing Metadata | SEO metadata is set | 1. View the page source or inspect `<head>` on `/pricing`. | Title is "Pricing" (with site suffix). Description includes "Simple, transparent pricing for property managers". | P2 |
| MKT-05 | Blog Listing | Blog index shows posts | 1. Navigate to `/blog`. | A grid of blog post cards is displayed. Each card shows tags, title, excerpt, publication date, and read time. Cards link to `/blog/{slug}`. | P1 |
| MKT-06 | Blog Empty State | No posts shows message | 1. Remove all MDX files temporarily. 2. Navigate to `/blog`. | Message displayed: "No posts yet. Check back soon!" | P2 |
| MKT-07 | Blog Post | Individual post renders | 1. Navigate to `/blog/{valid-slug}` (e.g., `/blog/what-is-a-coi`). | The post page shows title, author, date, read time, tags, full MDX content rendered with prose styling, related posts section, and a CTA ("Ready to automate your COI compliance?"). | P1 |
| MKT-08 | Blog 404 | Invalid slug returns not-found | 1. Navigate to `/blog/nonexistent-slug`. | A 404 (Not Found) page is displayed. | P2 |
| MKT-09 | FAQ Accordion | Questions expand/collapse | 1. On the landing page, scroll to the FAQ section. 2. Click on a question. | The answer expands below the question. Clicking again collapses it. Only one question is open at a time (single collapsible mode). | P1 |
| MKT-10 | Footer Links | Footer is present with links | 1. On the landing page, scroll to the footer. | Footer contains the logo, product links (Features, Pricing, Blog), company links, and legal links. Copyright notice shows "2026 CertWall". | P2 |

---

### 13. Navigation

| ID | Feature | Scenario | Steps | Expected Result | Priority |
|----|---------|----------|-------|-----------------|----------|
| NAV-01 | Sidebar Navigation | All links functional | 1. Log in and navigate to `/dashboard`. 2. Click each sidebar link: Dashboard, Upload COI, Team, Billing, Profile, Support. | Each link navigates to the correct page. "Vendors" and "Templates" links are disabled with a "Soon" badge. | P0 |
| NAV-02 | Active State | Current page highlighted in sidebar | 1. Navigate to `/dashboard`. 2. Observe the sidebar. | The "Dashboard" link has the active styling (accent background, foreground text, font-medium). Other links have muted styling. | P1 |
| NAV-03 | Sidebar Collapse | Sidebar can be collapsed and expanded | 1. Click the collapse chevron button in the sidebar header. 2. Click again. | The sidebar collapses to icon-only mode (64px wide). Labels, org info, and user name are hidden. Clicking again expands it back to full width (256px). | P1 |
| NAV-04 | Marketing Nav | Desktop navigation links | 1. Visit `/` on desktop (768px+). | Top navigation shows Logo, Features link, Pricing link, Blog link, theme toggle, Login button, and "Get Started" button. | P0 |
| NAV-05 | Mobile Nav | Hamburger menu opens on mobile | 1. Visit `/` on a viewport under 768px. 2. Click the hamburger menu icon. | A mobile menu slides open with Features, Pricing, Blog links, and Login/Get Started buttons. Clicking a link closes the menu. | P1 |
| NAV-06 | Theme Toggle | Dark/light mode toggles | 1. On any page, click the theme toggle button (sun/moon icon). | The UI switches between light and dark mode. The preference persists across page navigations and after refresh (stored in localStorage). | P1 |
| NAV-07 | Org Badge | Sidebar footer shows org info | 1. Log in and view the sidebar (expanded). | The sidebar footer shows the organization name, plan tier badge (e.g., "starter"), user avatar initials, user name, and user role. | P1 |
| NAV-08 | Logout Button | Sidebar logout works | 1. Click the logout icon button in the sidebar footer. | `supabase.auth.signOut()` is called. User is redirected to `/`. Session is cleared. | P0 |

---

### 14. Security

| ID | Feature | Scenario | Steps | Expected Result | Priority |
|----|---------|----------|-------|-----------------|----------|
| SEC-01 | Middleware Protection | Protected routes require auth | 1. Without a session, visit `/dashboard`, `/upload`, `/settings/profile`, `/settings/team`, `/settings/billing`, `/support`. | Each route redirects to `/auth/login?redirect={path}`. No page content is rendered before redirect. | P0 |
| SEC-02 | Public Routes | Public pages accessible without auth | 1. Without a session, visit `/`, `/pricing`, `/blog`, `/blog/{slug}`. | All pages render normally without redirect. | P0 |
| SEC-03 | API Auth | API routes return 401 without session | 1. Call `GET /api/vendors` without auth cookies. | Response: 401 `{ error: "Unauthorized" }`. Same for all protected API routes. | P0 |
| SEC-04 | Org Isolation | Users cannot see other orgs' data | 1. Register Org A with vendors. 2. Register Org B. 3. As Org B user, call `GET /api/vendors`. | Response only contains Org B's vendors (initially empty). No data from Org A is visible. | P0 |
| SEC-05 | Org Isolation Upload | Cannot upload to another org's vendor | 1. As Org B user, call `POST /api/upload` with a `vendor_id` belonging to Org A. | API returns 404: "Vendor not found". The upload does not proceed. | P0 |
| SEC-06 | Role Enforcement - Viewer | Viewer cannot upload COIs | 1. Add a user with role "viewer" to the org. 2. As that user, call `POST /api/upload`. | API returns 403 (role check fails for viewer). | P0 |
| SEC-07 | Role Enforcement - Member | Member cannot delete vendors | 1. As a member, call `DELETE /api/vendors/{id}`. | API returns 403 (role check requires owner or admin for delete). | P1 |
| SEC-08 | Role Enforcement - Invite | Member cannot send invites | 1. As a member, call `POST /api/team/invite`. | API returns 403 (role check requires owner or admin). | P1 |
| SEC-09 | Webhook No Auth | Webhook route accessible without user auth | 1. Send a properly signed `POST /api/billing/webhook` request without user session cookies. | The webhook processes successfully (signature verification passes). It does not require Supabase user auth. | P0 |
| SEC-10 | Vendor Limit | Vendor creation blocked at plan limit | 1. As an org on Starter plan (vendor_limit = 75), add vendors until count = 75. 2. Try to add one more. | API returns 403: "You've reached your plan's vendor limit (75). Upgrade to add more vendors." | P0 |
| SEC-11 | Owner Cannot Invite Owner | Role "owner" cannot be assigned via invite | 1. As owner, call `POST /api/team/invite` with `{ role: "owner" }`. | API returns 400: "Cannot invite as owner". | P1 |
| SEC-12 | Invite Email Match | Invite acceptance requires matching email | 1. Create invite for `user-a@example.com`. 2. Log in as `user-b@example.com`. 3. Call accept invite with the token. | API returns 403: "This invite was sent to a different email address". | P0 |

---

### 15. Edge Cases

| ID | Feature | Scenario | Steps | Expected Result | Priority |
|----|---------|----------|-------|-----------------|----------|
| EDGE-01 | Large File | Upload file exactly at 4 MB limit | 1. Upload a PDF that is exactly 4,194,304 bytes. | The file is accepted and processed successfully (the check is `file.size > MAX_FILE_SIZE`, not `>=`). | P2 |
| EDGE-02 | Invalid PDF | Upload a corrupted/invalid PDF | 1. Rename a text file to `.pdf`. 2. Upload it. | The upload succeeds (file type check passes for content-type), but the PDF-to-image conversion fails. API returns 500: "PDF conversion failed: ..." Error message shown to user. | P1 |
| EDGE-03 | Expired Invite | Accept invite after 7-day expiry | 1. Create an invite. 2. Manually set `expires_at` to a past date in the database. 3. Try to accept the invite. | API returns 410: "This invite has expired". The invite status is updated to "expired". | P1 |
| EDGE-04 | User Already In Org | Accept invite when already a member | 1. User is already in an org. 2. Try to accept an invite to a different org. | API returns 409: "You already belong to an organization. Leave your current organization first." | P1 |
| EDGE-05 | Missing Compliance Template | Upload for trade type without template | 1. Delete the compliance template for a specific trade type. 2. Upload a COI for a vendor of that trade type. | Extraction succeeds but scoring fails. API returns 500: "No compliance template found". | P2 |
| EDGE-06 | Concurrent Uploads | Two uploads for same vendor at the same time | 1. Initiate two simultaneous uploads for the same vendor with different PDFs. | Both uploads complete successfully. Each creates its own document and extraction. The compliance status reflects the most recent extraction. | P2 |
| EDGE-07 | Empty Vendor List | Upload page with no vendors | 1. Navigate to `/upload` for an org with zero vendors. | The vendor dropdown is empty. The submit button remains disabled. User should see a prompt to add a vendor first. | P1 |
| EDGE-08 | Special Characters in Vendor Name | Vendor name with special characters in export | 1. Create a vendor named "O'Brien & Sons / LLC". 2. Upload a COI. 3. Run audit export. | The ZIP file contains a PDF with the vendor name sanitized (special characters replaced with underscores): `O_Brien___Sons___LLC_coi.pdf`. The CSV contains the original name. | P2 |
| EDGE-09 | No COI On File | Dashboard shows red for vendor without upload | 1. Add a vendor without uploading any COI. 2. View the dashboard. | The vendor appears in the table with status "red" and reason "No COI on file". | P1 |
| EDGE-10 | Session Expiry | Session expires during active use | 1. Log in. 2. Wait for the session to expire (or manually delete cookies). 3. Attempt to refresh dashboard data. | The API returns 401. The middleware redirects the user to `/auth/login`. No sensitive data is exposed. | P1 |
| EDGE-11 | Webhook Missing Org ID | Webhook event without org_id metadata | 1. Send a valid Stripe webhook event with `metadata.org_id` missing. | The webhook handler processes without error but makes no database changes (the `if (!orgId) break` guard activates). Returns `{ received: true }`. | P2 |
| EDGE-12 | Profile of Deleted User | Viewing team after member's auth account deleted | 1. Remove a user's auth account from Supabase. 2. View the team page. | The membership still shows but the profile may show "Unknown" for the name and empty email. The page does not crash. | P2 |

---

## Summary

| Area | Test Count | P0 | P1 | P2 |
|------|-----------|-----|-----|-----|
| Authentication | 12 | 5 | 6 | 1 |
| Organization Setup | 4 | 3 | 1 | 0 |
| Dashboard | 6 | 2 | 2 | 2 |
| Upload Flow | 7 | 4 | 2 | 1 |
| Compliance | 6 | 4 | 2 | 0 |
| Reminders | 4 | 2 | 1 | 1 |
| Export | 4 | 2 | 1 | 1 |
| Team Management | 13 | 3 | 9 | 1 |
| Billing | 10 | 4 | 4 | 2 |
| Support | 7 | 2 | 4 | 1 |
| Settings | 5 | 2 | 2 | 1 |
| Marketing Pages | 10 | 3 | 3 | 4 |
| Navigation | 8 | 3 | 4 | 1 |
| Security | 12 | 7 | 4 | 1 |
| Edge Cases | 12 | 0 | 6 | 6 |
| **Total** | **120** | **46** | **50** | **24** |

---

## Notes

- **P0 (Critical):** Must pass before any release. Blocking defects.
- **P1 (High):** Should pass for release. Important but non-blocking for core workflow.
- **P2 (Medium):** Nice to verify. May be deferred if schedule is tight.
- All test cases assume the tester has access to Supabase Studio for data verification and Stripe test dashboard for webhook testing.
- Multi-tenant isolation tests (SEC-04, SEC-05) require two separate browser sessions or incognito windows with different accounts.
