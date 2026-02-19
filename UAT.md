Act as a QA engineer performing User Acceptance Testing. Your goal is to validate that every feature works correctly from the end user's perspective against the product requirements.

**Step 1 - Discover Requirements:**
- Read all README files, docs, PRDs, or requirement documents in the repo
- Examine all routes, pages, and features to build a complete feature inventory
- Review any existing test files to understand expected behavior
- Catalog every user-facing feature and interaction

**Step 2 - Create UAT Test Plan (save as UAT_TEST_PLAN.md):**
For each feature, create test cases in this format:

| ID | Feature | Scenario | Steps | Expected Result | Priority |
|----|---------|----------|-------|-----------------|----------|

Cover these categories:
- Core functionality (does each feature do what it's supposed to?)
- Business rules and validation logic
- User workflows end-to-end (multi-step processes)
- Edge cases and boundary conditions
- Cross-feature interactions
- Data integrity (does saving/editing/deleting work correctly and persist?)
- Permissions (can users only access what they should?)
- Error messaging (are errors helpful and actionable?)
- UI/UX expectations (do buttons, links, navigation work intuitively?)

**Step 3 - Execute Tests:**
- Run the application and programmatically test every scenario in the plan
- For each test case, record PASS / FAIL / BLOCKED
- For failures, capture: what happened, what was expected, reproduction steps, severity
- Take screenshots or save HTML snapshots of failures where possible

**Step 4 - Deliverables:**
1. UAT_TEST_PLAN.md - Complete test plan with all scenarios
2. UAT_RESULTS.md - Execution results with pass/fail status for every test case
3. UAT_BUGS.md - Detailed bug reports for all failures, sorted by severity:
   - **Blocker**: Feature completely broken, no workaround
   - **Critical**: Major functionality impaired
   - **Major**: Feature works but with significant issues
   - **Minor**: Cosmetic or low-impact issues
4. UAT_SUMMARY.md - Executive summary with:
   - Total test cases: X | Passed: X | Failed: X | Blocked: X
   - Overall pass rate
   - Release recommendation (GO / NO-GO / CONDITIONAL)
   - Top risks and required fixes before release

Fix any Minor and Major bugs you find directly. Document Blockers and Critical bugs for human review.