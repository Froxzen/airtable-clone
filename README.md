<div align="left" style="position: relative;">
<h1>Airtable Clone</h1>

##  Overview

This project is a modern, modular Airtable-like spreadsheet application built with React, Next.js, and TypeScript. It supports real-time editing, powerful filtering and sorting, grid views, and a highly interactive UI. The app is designed for speed, scalability, and a great user experience, with features inspired by leading online spreadsheet tools.

---

##  Features

### 🏗️ Modular UI Components
- **Search Bar**: Modular and keyboard-accessible (`Ctrl+F` to focus, `Escape` to blur), with instant filtering.
- **Sort & Filter Popups**: Reusable components for sorting and filtering by text or number, with dynamic options and icons.
- **Add Table & Add Rows**: Dedicated, reusable components for adding tables and rows, with ref forwarding for accessibility.

### 🔍 Search, Sort, and Filter Logic
- **Search**: Case-insensitive, column-aware search with keyboard shortcut support.
- **Sort**: Multi-column sorting with dynamic order, placeholder logic, and clear UI feedback.
- **Filter**: Supports text and number filters (`contains`, `equals`, `greater than`, `less than`, `is empty`, etc.), with robust handling of empty/invalid values.

### ⚡ Performance & UX
- **Virtualized Table Rendering**: Efficiently renders large datasets using virtualization for smooth scrolling.
- **Optimistic UI**: Instant feedback for row/column changes, with temporary row handling and graceful fallback on errors.

### 🧩 Grid Views
- **Multiple Views**: Supports per-table grid views, each with independent sort/filter state.
- **Persistent State**: Sorts and filters are loaded/saved per view, with deep equality checks to prevent infinite update loops.

## Tech Stack
- **Framework**: Next.js (T3 Stack)
- **Language**: TypeScript
- **Backend**: tRPC, Prisma, PostgreSQL (NeonDB)
- **Authentication**: NextAuth.js with Google OAuth
- **UI**: Tailwind CSS, TanStack Table & TanStack Virtualizer
- **Other Tools**: Faker.js, Zod, Vercel for deployment

##  Getting Started

###  Installation

Install airtable-clone using one of the following methods:

**Build from source:**

1. Clone the airtable-clone repository:
```sh
❯ git clone https://github.com/Froxzen/airtable-clone
```

2. Navigate to the project directory:
```sh
❯ cd airtable-clone
```

3. Install the project dependencies:


```sh
❯ pnpm install
```

4. Run airtable-clone using the following command:

```sh
❯ pnpm dev
```

5. Open your browser and navigate to ```http://localhost:3000```

## License
This project is licensed under the MIT License.
