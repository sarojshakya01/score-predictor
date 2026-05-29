# Backend Rules

- Use service layer
- No SQL in routes
- Use repository pattern
- Use async DB operations

# Frontend Rules

- Use server components when possible
- Use React Query for APIs
- Avoid duplicated UI logic

# AI Agent Instructions

When generating code:

* Use clean architecture principles
* Use TypeScript in frontend
* Use Pydantic schemas in backend
* Use SQLAlchemy ORM
* Avoid business logic in controllers/routes
* Keep services modular
* Use reusable UI components
* Use responsive layouts
* Follow REST API conventions
* Write production-ready code
* Include validation and error handling
* Use pagination for list APIs

---

# Never Do

- business logic in controllers
- direct DB access in controllers
- use any
- duplicate DTOs

# AI Agent Instructions

When generating code:
- preserve existing architecture
- do not rename DTOs
- avoid introducing new frameworks
- generate production-ready code
- include typing
- include validation decorators
- prefer composition over inheritance