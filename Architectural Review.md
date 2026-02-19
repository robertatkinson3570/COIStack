Perform a thorough architectural review of this entire codebase. Analyze the project structure, patterns, and implementation decisions. Produce a detailed report covering:

**Project Structure & Organization:**
- Evaluate folder structure and file organization
- Check for clear separation of concerns (UI, business logic, data access, utilities)
- Identify misplaced files or inconsistent naming conventions
- Assess module boundaries and dependency direction

**Code Quality & Patterns:**
- Identify inconsistent patterns (e.g., mixing async styles, state management approaches)
- Find dead code, unused imports, unused dependencies
- Check for proper error handling throughout (are errors swallowed? are there unhandled promise rejections?)
- Evaluate DRY violations - find duplicated logic that should be abstracted
- Assess function/component complexity (find functions > 50 lines that should be split)

**State Management:**
- Evaluate how state is managed (client state, server state, URL state)
- Identify prop drilling, unnecessary re-renders, or state stored at wrong levels
- Check for race conditions or stale state bugs

**API & Data Layer:**
- Review API route structure and REST/GraphQL conventions
- Check for N+1 queries, missing indexes, or inefficient data fetching
- Evaluate data validation at API boundaries (input sanitization, schema validation)
- Review database schema design if applicable

**Security:**
- Check authentication/authorization implementation at every layer
- Look for SQL injection, XSS, CSRF vulnerabilities
- Review environment variable handling and secrets management
- Check for exposed sensitive data in API responses or client bundles
- Verify proper CORS configuration

**Performance:**
- Identify large bundle sizes, missing code splitting, unoptimized imports
- Check for missing memoization, unnecessary re-renders, expensive computations
- Review image optimization, lazy loading, and caching strategies
- Look for memory leaks (uncleaned event listeners, subscriptions, intervals)

**Type Safety & Contracts:**
- Evaluate TypeScript usage (excessive `any`, missing types, loose generics)
- Check API contracts between frontend and backend
- Review validation schemas and their coverage

**Scalability Concerns:**
- Identify bottlenecks that would break at 10x or 100x current usage
- Review database query patterns under load
- Assess horizontal scaling readiness

**Deliverables:**
1. ARCHITECTURE_REVIEW.md - Full report with findings categorized by severity (Critical / High / Medium / Low)
2. For each finding: description, file locations, recommended fix, and effort estimate
3. A prioritized action plan for addressing the top issues
4. Automatically fix any Low-effort/High-impact issues directly in the code