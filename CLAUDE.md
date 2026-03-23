# CLAUDE.md

This file is the authoritative ruleset for working in this repository. Follow every rule. Do not substitute libraries, invent patterns, or deviate from conventions unless explicitly told to by the developer.

## Mandatory Tech Stack

These are the approved libraries. Do NOT replace any of them with an alternative unless given an extremely compelling justification **and** explicit developer approval.

| Concern             | Library                                 | Forbidden alternatives                  |
| ------------------- | --------------------------------------- | --------------------------------------- |
| App shell           | Electron                                | Tauri, NW.js, Neutralino                |
| UI framework        | React                                   | Vue, Svelte, SolidJS                    |
| UI Components       | Shadcn/ui + Radix UI                    | Material UI, Ant Design, Chakra UI      |
| Styling             | Tailwind CSS v4                         | CSS modules, styled-components, Emotion |
| Forms               | React Hook Form + `@hookform/resolvers` | Formik, manual `useState` per field     |
| Validation          | Zod                                     | Yup, Joi, manual `if` checks            |
| State management    | Zustand                                 | Redux, Jotai, Valtio, MobX              |
| Async data fetching | TanStack Query                          | SWR, raw `fetch` + `useEffect`          |
| Local database      | Prisma + better-sqlite3 (main process)  | Drizzle, TypeORM, Knex, raw SQL         |
| Local settings      | electron-store                          | localStorage, manual JSON files         |
| i18n                | react-i18next                           | next-intl, FormatJS                     |
| Logging             | Pino (main process)                     | Winston, Bunyan, `console.log`          |
| Error tracking      | Sentry                                  | Bugsnag, Datadog RUM                    |
| Toasts              | Sonner                                  | react-hot-toast, react-toastify         |
| Testing             | Vitest (unit), Playwright (e2e)         | Jest, Cypress                           |

### Anti-pattern enforcement

Do NOT implement things manually that the stack already covers:

- Use **TanStack Query** instead of raw `fetch` + `useEffect` for data fetching in the renderer.
- Use **React Hook Form** instead of manual `useState` per field.
- Use **Zod schemas** instead of hand-written validation logic.
- Use **Sonner** (`toast()`) instead of `window.alert()` or custom toast implementations.
- Use **Prisma** instead of raw SQL queries.
- Use **electron-store** instead of `localStorage` or manual config file management.
- Use **IPC** (`ipcRenderer.invoke`) instead of accessing Node.js APIs directly from the renderer.

## Electron Architecture

Electron apps have two separate processes with distinct responsibilities. Never blur this boundary.

### Main process (`src/main/`)

- Runs in Node.js — has full access to the filesystem, OS, and native APIs.
- Responsible for: creating windows, native menus, tray, auto-updater, IPC handlers, database access, and all privileged operations.
- Is the **only** process that imports Prisma, `fs`, `path`, `electron-store`, or any native Node module.

### Renderer process (`src/renderer/`)

- Runs in a sandboxed Chromium context — treat it like a browser.
- Responsible for: all React UI, routing, state, forms, and user interaction.
- **Never** imports Node.js built-ins or Electron main-process APIs directly.
- Communicates with the main process exclusively through the **preload bridge** (see IPC Patterns).

### Preload (`src/preload/`)

- Runs with Node.js integration in a limited context.
- Uses `contextBridge.exposeInMainWorld` to safely expose a typed API surface to the renderer.
- Keep it thin — only bridge, no business logic.

## IPC Patterns

All communication between the renderer and main process goes through typed IPC channels defined in the preload script.

### Defining the bridge (preload)

```typescript
// src/preload/index.ts
import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('api', {
  getUsers: () => ipcRenderer.invoke('users:getAll'),
  createUser: (data: CreateUserInput) => ipcRenderer.invoke('users:create', data),
})
```

### Declaring the type (shared)

```typescript
// src/shared/api.d.ts
interface Window {
  api: {
    getUsers: () => Promise<User[]>
    createUser: (data: CreateUserInput) => Promise<User>
  }
}
```

### Registering handlers (main)

```typescript
// src/main/ipc/users.ts
import { ipcMain } from 'electron'
import { userService } from '../services/user.service'

export function registerUserHandlers() {
  ipcMain.handle('users:getAll', () => userService.getAll())
  ipcMain.handle('users:create', (_event, data) => userService.create(data))
}
```

### Calling from the renderer

Use TanStack Query to wrap IPC calls — treat them like network requests:

```typescript
const { data: users } = useQuery({
  queryKey: ['users'],
  queryFn: () => window.api.getUsers(),
})
```

### IPC channel naming

Use `domain:action` format: `users:getAll`, `files:open`, `settings:set`.

## Project Structure

Follows electron-vite conventions. The renderer entry (`index.html`) lives at `src/renderer/index.html` and all React source files live under `src/renderer/src/`. The `@/` path alias maps to `src/renderer/src/`.

```
src/
├── main/                       # Electron main process (Node.js)
│   ├── index.ts                # Main entry — creates windows, registers handlers
│   ├── ipc/                    # IPC handler registrations (one file per domain)
│   └── services/               # Main-process business logic (db, fs, OS)
├── preload/
│   ├── index.ts                # Context bridge — exposes api to renderer
│   └── index.d.ts              # Type declarations for exposed API
├── shared/                     # Types and constants shared across processes
│   ├── api.d.ts                # Window.api type declaration
│   └── types.ts                # Shared domain types
└── renderer/
    ├── index.html              # Renderer entry (electron-vite convention)
    └── src/                    # React application
        ├── App.tsx             # Root component
        ├── main.tsx            # Renderer entry point
        ├── app.css             # Tailwind theme and global styles
        ├── env.d.ts            # Vite/electron-vite type references
        ├── components/         # Shared UI components
        │   ├── ui/             # Shadcn primitives (button, input, card, etc.)
        │   ├── layouts/        # Layout components (app-layout, sidebar, etc.)
        │   └── <feature>/      # Feature-specific components grouped in subfolders
        ├── lib/                # Utilities and initialisation
        │   ├── locales/        # i18n translation objects (en.ts, nl.ts, ...)
        │   ├── utils.ts        # cn() helper
        │   └── i18n.ts         # i18next initialization
        ├── pages/              # Page-level components (one per route)
        ├── services/           # Renderer-side service wrappers (wrap window.api calls)
        ├── stores/             # Zustand stores
        └── router.tsx          # React Router setup (HashRouter + routes)
```

### Naming conventions

- **Main-process services**: `<domain>.service.ts` (e.g. `user.service.ts`, `file.service.ts`).
- **Renderer services**: `<domain>.service.ts` inside `src/renderer/src/services/` — these wrap `window.api` calls.
- **IPC handlers**: `<domain>.ts` inside `src/main/ipc/` — register with `ipcMain.handle`.
- **Components**: PascalCase filenames and exports (e.g. `UserList`, `SettingsPanel`).
- **Pages**: PascalCase, `<Name>Page.tsx` (e.g. `UsersPage.tsx`, `SettingsPage.tsx`).
- **Stores**: camelCase filenames (e.g. `theme.ts`), hooks named `use<Name>Store`.

### When to create subfolders

- **`src/main/ipc/`**: One file per domain (`users.ts`, `files.ts`). Always register handlers via a central `registerAllHandlers()` in `main/index.ts`.
- **`src/renderer/src/components/`**: Group into a feature subfolder when you have 3+ components for the same feature.
- **`src/renderer/src/pages/`**: One file per top-level route. Nest subfolders for sections with 3+ related pages.

## Component and Page File Conventions

### Import order

Maintain this exact order, separated by blank lines where grouping changes:

1. `react-router-dom` imports
2. `react` imports
3. Third-party libraries (`lucide-react`, `react-i18next`, `sonner`, `@tanstack/react-query`, etc.)
4. Form/validation (`react-hook-form`, `zod`, `@hookform/resolvers/zod`)
5. Store imports: `@/stores/...`
6. Lib imports: `@/lib/...`
7. Service imports: `@/services/...`
8. Component imports: `@/components/...`

### Page component structure

```typescript
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'

import { useUsersService } from '@/services/users.service'

export default function UsersPage() {
  const { t } = useTranslation()
  const { getUsers } = useUsersService()

  const { data: users, isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: getUsers,
  })

  // ...
}
```

## Form Patterns

### Client-side forms

Use `useForm` + `zodResolver` for all forms:

```typescript
const schema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Please enter a valid email address'),
})

type FormValues = z.infer<typeof schema>

// Inside component:
const {
  register,
  handleSubmit,
  formState: { errors, isSubmitting },
} = useForm<FormValues>({ resolver: zodResolver(schema) })

const onSubmit = async (data: FormValues) => {
  await window.api.createUser(data)
}
```

### Error and success display

- Field errors: `<p className="text-sm text-destructive">{error}</p>`
- Error boxes: `<div className="rounded-md bg-destructive/10 border border-destructive/20 px-4 py-3">`
- Success boxes: `<div className="rounded-md bg-green-500/10 border border-green-500/20 px-4 py-3">`

## Services Layer

### Main-process services (`src/main/services/`)

Contain all business logic that runs in the main process (database queries, file I/O, OS interactions):

```typescript
// src/main/services/user.service.ts
import { db } from '../db'

export const userService = {
  getAll: () => db.user.findMany(),
  create: (data: CreateUserInput) => db.user.create({ data }),
}
```

IPC handlers call services — they do **not** contain logic themselves.

### Renderer services (`src/renderer/src/services/`)

Thin wrappers around `window.api` calls, providing a typed interface for components and TanStack Query:

```typescript
// src/renderer/src/services/users.service.ts
export function useUsersService() {
  return {
    getUsers: () => window.api.getUsers(),
    createUser: (data: CreateUserInput) => window.api.createUser(data),
  }
}
```

Components and query functions call renderer services — they do **not** call `window.api` directly.

### When to extract / split

- Extract to a service if an IPC handler contains more than a single service call.
- Split a service when it exceeds ~200 lines or handles unrelated concerns.

## TypeScript Rules

- **NEVER** use `any`. Use `unknown`, a specific type, or a generic instead. ESLint enforces this.
- Prefer `interface` over `type` for object shapes.
- Use template literals (`${variable}`) instead of string concatenation.
- Derive form types from Zod schemas: `type FormValues = z.infer<typeof schema>`.
- Shared types between main and renderer live in `src/shared/types.ts`.
- Use `import type` for type-only imports.
- Path alias: always use `@/` for imports within `src/renderer/src/` (e.g. `@/lib/utils`, `@/components/ui/button`).

## Styling Rules

- **ALWAYS** use Tailwind CSS for styling. No inline `style` attributes, no CSS modules, no styled-components.
- **ALWAYS** check for existing Shadcn components before building custom UI (`@/components/ui/`).
- Use `cn()` from `@/lib/utils` for conditional/merged class names.
- Dark mode is handled via the `.dark` class on `<html>`. Use Tailwind's `dark:` variants.
- CSS variables are defined in `src/renderer/src/app.css` — use them via Tailwind's semantic tokens (`bg-background`, `text-foreground`, `text-muted-foreground`, `border-input`, `bg-destructive`, etc.).

## i18n Rules (MANDATORY)

- **NEVER** hardcode user-facing strings. All labels, messages, placeholders, error text, success text, page titles, and button text MUST use `useTranslation()` and `t("key")`.
- Translation files live in `src/renderer/src/lib/locales/` (one file per language: `en.ts`, `nl.ts`, etc.).
- When adding new features, add translation keys to **ALL** existing locale files.
- Use nested key structure matching the feature: `users.title`, `settings.appearance.label`, `common.save`.
- Shared/reusable keys go under `common.*`.

## Validation Rules (MANDATORY)

- **NEVER** write validation logic by hand (e.g. `if (!email.includes("@"))`, `if (name.length < 1)`).
- **ALWAYS** use Zod schemas for all validation.
- Define schemas at module level: `const schema = z.object({ ... })`.
- Derive TypeScript types from schemas: `type FormValues = z.infer<typeof schema>`.
- Client forms: pass `zodResolver(schema)` to `useForm`.
- Main-process IPC handlers: validate incoming data with `schema.safeParse()` before processing.

## Core Principles

- **NEVER** create documentation files unless explicitly asked.
- **NEVER** write tests unless explicitly asked.
- **NEVER** create git commits automatically.
- **NEVER** use Docker unless specifically asked.
- Before installing a new package, check `package.json` for an existing dependency that covers the need.
- Before creating a new component, check `src/renderer/src/components/` for something reusable.
- Look at similar existing pages/components and match their patterns exactly.

## Verification (run after every change)

```bash
npm run build       # Must pass — catches type errors and build issues
npm run lint        # Must pass with zero warnings
```

### After specific changes

- **Prisma schema changed**: run `npx prisma migrate dev` then `npx prisma generate`.
- **New IPC channel added**: add the handler in `src/main/ipc/`, register it in `main/index.ts`, expose it in `src/preload/index.ts`, and declare its type in `src/shared/api.d.ts`.
- **New translation keys added**: verify they exist in ALL locale files.

## Git Workflow (when asked to commit)

- Review the diff before writing a commit message.
- Check `git log --oneline -n 10` and match the existing commit message style.
- If changes span multiple unrelated concerns, split into separate atomic commits.
- Follow conventional commit format if established in the repository.
