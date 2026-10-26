# TicketFlow — Enterprise Ticket Management System

> ### 🎓 College Project Presentation Pitch
> **"TicketFlow is a production-grade, enterprise-ready IT Service Management (ITSM) and customer support platform built on the MERN stack. Designed to bridge the gap between clients, support engineers, and technical leadership, TicketFlow replaces static ticket boards with an event-driven architecture featuring real-time bi-directional WebSockets, automated background SLA breach monitoring via scheduled cron workers, role-based access control (RBAC), AI-assisted ticket triage, interactive analytics visualizers, and resilient input validation. Engineered to enterprise standards, the entire platform is hardened against malicious payloads and verified with 245 automated integration tests achieving a 100% pass rate."**

---

## 📋 Table of Contents
1. [Executive Overview](#-executive-overview)
2. [Technology Stack](#-technology-stack)
3. [System Architecture & Directory Structure](#-system-architecture--directory-structure)
4. [Key Features & Capabilities](#-key-features--capabilities)
5. [Database Schema & Collections](#-database-schema--collections)
6. [Core API Endpoints](#-core-api-endpoints)
7. [Installation & Setup Guide](#-installation--setup-guide)
8. [Pre-Seeded Demo Accounts](#-pre-seeded-demo-accounts)
9. [Automated Testing & Quality Assurance](#-automated-testing--quality-assurance)
10. [Production Build & Verification](#-production-build--verification)

---

## 🌟 Executive Overview

TicketFlow is engineered to deliver enterprise service desk capabilities within a modern, responsive, and ultra-resilient web architecture. It provides an intuitive single-page application (SPA) frontend with a dark-slate glassmorphism aesthetic, paired with a robust Express/Node.js REST and WebSocket API backed by MongoDB.

### Highlights:
- **Zero-Crash Resiliency**: Intercepts corrupted JSON payloads, malformed MongoDB ObjectIds, and out-of-bounds parameters cleanly with HTTP 400 Bad Request responses.
- **Bi-Directional Collaboration**: Real-time room-scoped ticket updates, live comment feeds, and instant in-app notification toasts powered by Socket.IO.
- **Automated Service Level Agreement (SLA) Engine**: Background cron daemon continually monitors ticket response and resolution deadlines, auto-flagging breaches and warning assignees.
- **Enterprise Security**: Strict CORS policies, bcrypt salted password hashing, Mongoose query projection exclusion (`select: false`), JWT signature verification, and zero stack trace leakage in production.

---

## 🛠 Technology Stack

### Frontend
- **Framework**: [React 18](https://react.dev/) (Functional components, custom Hooks)
- **Build Tool**: [Vite 5](https://vitejs.dev/) (Instant HMR, Rollup optimized bundling)
- **Routing**: [React Router v6](https://reactrouter.com/) (Protected routes, role-based route guards)
- **Data Visualization**: [Recharts 3](https://recharts.org/) (Interactive area, bar, and pie charts)
- **Icons**: [Lucide React](https://lucide.dev/) (Modern iconography)
- **Styling**: Vanilla CSS Design System (Custom dark-slate / glassmorphism tokens, CSS variables, mobile responsiveness)
- **HTTP Client**: [Axios](https://axios-http.com/) (Configured with request/response interceptors)
- **State Management**: React Context API (`AuthContext`, `SocketContext`, `ToastContext`)

### Backend
- **Runtime**: [Node.js](https://nodejs.org/) (v18+ LTS, tested on v25)
- **Server Framework**: [Express 4](https://expressjs.com/) (RESTful routing, modular controllers, global error middleware)
- **Real-Time Engine**: [Socket.IO 4](https://socket.io/) (JWT handshake authentication, room-based isolation)
- **Database & ODM**: [MongoDB](https://www.mongodb.com/) via [Mongoose 8](https://mongoosejs.com/) (Schema validation, indexes, compound aggregations)
- **Embedded Database Fallback**: [MongoMemoryServer 10](https://github.com/nodkz/mongodb-memory-server) (Zero-dependency local database out of the box)
- **Authentication**: [JSON Web Tokens (JWT)](https://jwt.io/) & [Bcryptjs](https://github.com/dcodeIO/bcrypt.js)
- **Background Scheduling**: [node-cron](https://github.com/node-cron/node-cron) (Periodic automated SLA breach monitoring)
- **File Uploads**: [Multer](https://github.com/expressjs/multer) (Disk storage, MIME validation, 10MB size limiting)
- **Transactional Mailer**: [Nodemailer](https://nodemailer.com/) (Asynchronous, fail-safe SMTP delivery)

---

## 🏗 System Architecture & Directory Structure

```
Ticket Management System/
│
├── client/                              # Frontend React (Vite SPA)
│   ├── src/
│   │   ├── components/                  # Reusable UI & presentation components
│   │   │   ├── analytics/               # Recharts charts (SLADashboard, KPI summaries)
│   │   │   ├── Navbar.jsx               # Responsive navigation bar with mobile drawer
│   │   │   ├── NotificationBell.jsx     # Live unread counter & quick dropdown
│   │   │   ├── TicketTable.jsx          # Sortable ticket list with status/priority pills
│   │   │   ├── CommentSection.jsx       # Real-time comment thread & file viewer
│   │   │   ├── AttachmentSection.jsx    # Drag-and-drop file upload & secure download
│   │   │   ├── TicketHistory.jsx        # Audit trail timeline for compliance
│   │   │   └── Toast.jsx                # Global notification toast container
│   │   ├── context/                     # Shared application contexts
│   │   │   ├── AuthContext.jsx          # Authentication state, login/logout, tokens
│   │   │   ├── SocketContext.jsx        # WebSocket connection & event distribution
│   │   │   └── ToastContext.jsx         # Non-blocking global notification toasts
│   │   ├── pages/                       # Route pages
│   │   │   ├── Home.jsx                 # Landing page & feature showcase
│   │   │   ├── Login.jsx                # Authentication with 1-click demo buttons
│   │   │   ├── Register.jsx             # New user registration with department selection
│   │   │   ├── Dashboard.jsx            # Role-conditioned metrics & quick actions
│   │   │   ├── Tickets.jsx              # Search, filter, sort & paginated ticket table
│   │   │   ├── TicketDetails.jsx        # Detailed lifecycle view, comments, attachments
│   │   │   ├── Analytics.jsx            # Performance analytics & SLA reports
│   │   │   ├── AdminSLA.jsx             # Administrative SLA target configuration
│   │   │   ├── UserManagement.jsx       # Admin user directory & role controls
│   │   │   ├── AgentManagement.jsx      # Support agent queue overview & assignments
│   │   │   ├── Notifications.jsx        # Dedicated notification center with filters
│   │   │   └── Profile.jsx              # User profile & notification preferences
│   │   ├── services/                    # API interaction services
│   │   │   ├── api.js                   # Axios base client with JWT interceptor
│   │   │   ├── ticketService.js         # Ticket CRUD & status workflows
│   │   │   ├── notificationService.js   # Notification queries & mark-as-read
│   │   │   └── slaService.js            # SLA target fetching & updates
│   │   ├── App.jsx                      # Routing table & layout wrappers
│   │   ├── index.css                    # Design system (Dark-slate tokens & utilities)
│   │   └── main.jsx                     # Application entry point
│   ├── index.html                       # HTML5 entry with Outfit / Inter typography
│   ├── vite.config.js                   # Vite dev server & proxy configuration
│   └── package.json
│
├── server/                              # Backend Node.js / Express REST & WebSocket API
│   ├── config/                          # Database connection with auto-fallback
│   │   └── db.js                        # Connects to local Mongo or MongoMemoryServer
│   ├── controllers/                     # Endpoint controllers
│   │   ├── authController.js            # Registration, login, profile, user admin
│   │   ├── ticketController.js          # Ticket CRUD, search, filter, pagination, status
│   │   ├── commentController.js         # Ticket comments & first-response SLA triggers
│   │   ├── attachmentController.js      # Secure file upload & retrieval
│   │   ├── ticketHistoryController.js   # Audit logs & change tracking
│   │   ├── notificationController.js    # Persistent in-app notifications
│   │   ├── analyticsController.js       # Role-specific dashboard KPI aggregations
│   │   └── slaController.js             # SLA target retrieval & admin updates
│   ├── middleware/                      # Express middleware
│   │   ├── auth.js                      # JWT protect & role authorize guards
│   │   ├── upload.js                    # Multer configuration with MIME security
│   │   └── errorHandler.js              # Centralized error handler & CastError mapping
│   ├── models/                          # Mongoose data schemas
│   │   ├── User.js                      # User accounts, hashed passwords, roles
│   │   ├── Ticket.js                    # Core ticket schema, enums, SLA subdocument
│   │   ├── Comment.js                   # Ticket comments & internal notes
│   │   ├── Attachment.js                # File attachment metadata
│   │   ├── TicketHistory.js             # Immutable lifecycle audit events
│   │   ├── Notification.js              # In-app notifications
│   │   ├── SLA.js                       # Priority-to-deadline configurations
│   │   └── Counter.js                   # Atomic sequence generator for human IDs
│   ├── routes/                          # Express REST API routes
│   │   ├── authRoutes.js                # /api/auth
│   │   ├── ticketRoutes.js              # /api/tickets
│   │   ├── notificationRoutes.js        # /api/notifications
│   │   ├── analyticsRoutes.js           # /api/analytics
│   │   └── slaRoutes.js                 # /api/sla
│   ├── services/                        # Specialized business logic
│   │   ├── emailService.js              # Transactional email notifications
│   │   └── aiClassificationService.js   # Heuristic & AI ticket triage engine
│   ├── socket/                          # WebSocket engine
│   │   └── index.js                     # Socket.IO room management & auth
│   ├── tests/                           # Automated integration test suites (245 tests)
│   │   ├── auth.test.js                 # Phase 1: Authentication & RBAC (11 tests)
│   │   ├── tickets.test.js              # Phase 2: Core Ticket Management (21 tests)
│   │   ├── phase3.test.js               # Phase 3: Comments, Attachments & History (31 tests)
│   │   ├── phase4.test.js               # Phase 4: Sockets & Real-Time Sync (41 tests)
│   │   ├── phase5.test.js               # Phase 5: SLA Engine & Breach Monitoring (34 tests)
│   │   ├── phase6.test.js               # Phase 6: Role Dashboards & Metrics (10 tests)
│   │   ├── phase7.test.js               # Phase 7: Server-side Search & Filter (20 tests)
│   │   ├── phase8.test.js               # Phase 8: Admin User Management (23 tests)
│   │   ├── phase9.test.js               # Phase 9: In-App Notifications (20 tests)
│   │   ├── phase11.test.js              # Phase 11: Security, CORS & DB Invariance (15 tests)
│   │   └── phase12.test.js              # Phase 12: Input Validation & Resiliency (19 tests)
│   ├── utils/                           # Helper utilities
│   │   ├── generateToken.js             # Cryptographic JWT generator
│   │   ├── historyLogger.js             # Audit logger helper
│   │   ├── notificationService.js       # Unified notification dispatch
│   │   ├── seed.js                      # Default data & demo accounts provisioner
│   │   └── slaMonitor.js                # Cron-based automated breach watcher
│   ├── uploads/                         # Stored file attachments directory
│   ├── server.js                        # Main Express entry & Socket.IO initialization
│   ├── .env                             # Server environment variables
│   ├── .env.example                     # Environment template
│   └── package.json
│
├── .env.example                         # Root environment template
├── .gitignore                           # Git exclusion rules
├── package.json                         # Root orchestration scripts
└── README.md                            # Comprehensive project documentation
```

---

## 🚀 Key Features & Capabilities

### 1. Multi-Tier Role-Based Access Control (RBAC)
- **User Role**: Create and track personal tickets, participate in comment threads, configure notification preferences, and download attachments. Data queries are strictly scoped to `createdBy: req.user.id`.
- **Support Agent Role**: Access assigned ticket queues, investigate issues, advance workflow status (`Assigned` &rarr; `In Progress` &rarr; `Resolved`), adjust priorities, and trigger AI classification assistance.
- **Administrator Role**: Universal visibility across all system tickets, reassign tickets to any agent, configure organization-wide SLA rules, manage user accounts (promote/demote roles, activate/deactivate users), and access aggregate analytics dashboards.

### 2. Real-Time Bi-Directional Collaboration (Socket.IO)
- Secure WebSocket handshakes verified via JWT authentication.
- Room-based isolation: Users join individual ticket rooms (`ticket:<id>`) and role-scoped rooms (`role:admin`, `role:agent`).
- Instantaneous updates: When an agent updates a ticket status, comments, or attaches a file, changes are reflected instantly on the client without manual page refreshes.

### 3. Automated Service Level Agreement (SLA) Engine
- Dynamic MongoDB mapping for priority targets:
  - **Critical**: 1h Response / 8h Resolution
  - **High**: 4h Response / 24h Resolution
  - **Medium**: 12h Response / 48h Resolution
  - **Low**: 24h Response / 72h Resolution
- Background cron worker (`slaMonitor.js`) inspects unresolved tickets every 60 seconds.
- Automatically calculates and stamps `responseDueAt` and `resolutionDueAt` upon ticket creation.
- Flags breaches (`responseBreached: true`, `resolutionBreached: true`) and generates automated notifications for assigned agents and administrators.

### 4. AI-Assisted Triage & Ticket Classification
- Evaluates ticket `title` and `description` to infer recommended category and urgency priority.
- Supports external AI integration while including an offline heuristic NLP engine for reliable local operation without external API keys.

### 5. Persistent In-App Notification Center
- Dedicated `Notification` collection storing alerts for assignments, status changes, comments, and SLA warnings.
- Real-time notification badge counter on the navigation bar.
- Notification dropdown with instant previews and a full `/notifications` management page with "Mark all as read" capability.

### 6. Server-Side Search, Filter, Sort & Pagination
- High-performance indexed pagination (`page`, `limit`) with comprehensive pagination metadata (`totalItems`, `totalPages`, `hasNextPage`, `hasPreviousPage`).
- Case-insensitive multi-field search across `ticketId`, `title`, `description`, and `category` with ReDoS regex sanitization.
- Multi-dimensional filtering by `status`, `priority`, `category`, and ISO 8601 date ranges (`fromDate`, `toDate`).
- Multi-criteria sorting (`newest`, `oldest`, `priority`, `recently_updated`).

### 7. Input Validation, Error Handling & Malformed Request Resiliency
- Global Express `SyntaxError` handler intercepts malformed JSON payloads and returns clean HTTP 400 Bad Request responses without terminating the Node.js event loop.
- Automatic Mongoose `CastError` translation converts unparseable ObjectIds into descriptive HTTP 400 responses.
- Strict enum boundary validation ensures only recognized `CATEGORIES`, `PRIORITIES`, and `STATUSES` are accepted.
- Standardized error response contract prevents internal database stack trace leakage.

---

## 🗄 Database Schema & Collections

| Collection | Key Fields | Purpose |
| :--- | :--- | :--- |
| **`users`** | `name`, `email`, `password` (select: false), `role`, `department`, `isActive`, `lastLogin` | User authentication, identity, and role management |
| **`tickets`** | `ticketId` (e.g. TKT-000001), `title`, `description`, `category`, `priority`, `status`, `createdBy`, `assignedTo`, `sla`, `resolvedAt`, `closedAt` | Core ticket lifecycle records |
| **`comments`** | `ticket`, `user`, `message`, `isInternal` | Public and internal discussions per ticket |
| **`attachments`** | `ticket`, `uploadedBy`, `originalName`, `storedName`, `mimeType`, `fileSize`, `filePath` | Secure file metadata |
| **`tickethistories`**| `ticket`, `performedBy`, `action`, `field`, `oldValue`, `newValue` | Immutable audit trail for compliance |
| **`notifications`** | `recipient`, `ticket`, `type`, `title`, `message`, `isRead` | Persistent in-app user notifications |
| **`slas`** | `priority`, `responseTimeHours`, `resolutionTimeHours`, `isActive` | Organizational SLA configuration rules |
| **`counters`** | `id`, `seq` | Atomic sequence generator for human-readable IDs |

---

## 🔌 Core API Endpoints

### Authentication & Users (`/api/auth`)
- `POST /api/auth/register` — Register new user account
- `POST /api/auth/login` — Authenticate and receive JWT token
- `GET /api/auth/me` — Retrieve authenticated user profile
- `PUT /api/auth/profile` — Update user profile details
- `GET /api/auth/users` — Administrative user list (search, filter, paginate)
- `PUT /api/auth/users/:id/role` — Update user role (Admin only)
- `PUT /api/auth/users/:id/status` — Toggle user active/inactive status (Admin only)

### Tickets (`/api/tickets`)
- `POST /api/tickets` — Create a new ticket (triggers automatic SLA assignment)
- `GET /api/tickets` — Retrieve tickets with search, filtering, sorting, and pagination
- `GET /api/tickets/:id` — Retrieve single ticket by ObjectId or `TKT-xxxxxx` ID
- `PUT /api/tickets/:id` — Update ticket details (subject to role permissions)
- `PUT /api/tickets/:id/status` — Advance ticket status in lifecycle workflow
- `PUT /api/tickets/:id/priority` — Adjust ticket priority level
- `PUT /api/tickets/:id/assign` — Assign ticket to support agent (Admin only)
- `DELETE /api/tickets/:id` — Delete ticket (Users for Open tickets; Admins universally)
- `POST /api/tickets/:id/classify` — Run AI triage assessment

### Comments & Attachments (`/api/tickets/:ticketId/...`)
- `GET /api/tickets/:ticketId/comments` — Fetch ticket discussion thread
- `POST /api/tickets/:ticketId/comments` — Add comment (stamps `firstRespondedAt` on first response)
- `DELETE /api/tickets/:ticketId/comments/:commentId` — Remove comment
- `GET /api/tickets/:ticketId/attachments` — List uploaded files
- `POST /api/tickets/:ticketId/attachments` — Upload file attachment (max 10MB)
- `GET /api/tickets/:ticketId/attachments/:id/download` — Securely stream file download
- `GET /api/tickets/:ticketId/history` — Retrieve audit history trail

### Notifications (`/api/notifications`)
- `GET /api/notifications` — Retrieve paginated notifications
- `GET /api/notifications/unread-count` — Get integer count of unread notifications
- `PUT /api/notifications/:id/read` — Mark single notification as read
- `PUT /api/notifications/read-all` — Mark all user notifications as read
- `DELETE /api/notifications/:id` — Delete notification

### Analytics & SLA Rules (`/api/analytics`, `/api/sla`)
- `GET /api/analytics/dashboard` — Role-specific aggregated KPI dashboard metrics
- `GET /api/analytics/overview` — High-level summary metrics
- `GET /api/analytics/sla` — Organization-wide SLA compliance rates
- `GET /api/sla` — List active SLA targets
- `PUT /api/sla/:priority` — Update SLA target durations (Admin only)

---

## 💻 Installation & Setup Guide

### Prerequisites
- [Node.js](https://nodejs.org/) v18.0.0 or higher
- [npm](https://www.npmjs.com/) v9.0.0 or higher
- Optional: Local MongoDB instance (TicketFlow automatically falls back to an embedded in-memory MongoDB instance if local MongoDB is not running).

### Step 1: Clone & Configure

```bash
# Navigate to project directory
cd "Ticket Management System"

# Copy environment template to active configuration
cp .env.example .env
cp server/.env.example server/.env
```

### Step 2: Install Dependencies

```bash
# Install root orchestration packages
npm install

# Install server packages
cd server && npm install

# Install client packages
cd ../client && npm install
cd ..
```

### Step 3: Seed Default Data

```bash
# Automatically populates demo accounts (Admin, Agent, User) and default SLA rules
cd server
npm run seed
cd ..
```

### Step 4: Run the Development Servers

Open two terminal windows or run the provided scripts:

**Terminal 1 (Backend API & WebSocket Server):**
```bash
cd server
npm start
# Server starts on http://localhost:5001 with Socket.IO enabled
```

**Terminal 2 (Frontend Client Application):**
```bash
cd client
npm run dev
# Vite client starts on http://localhost:3000
```

Open your browser and navigate to **`http://localhost:3000`**.

---

## 👥 Pre-Seeded Demo Accounts

The login page (`http://localhost:3000/login`) includes **1-Click Demo Login Buttons** for instant access without manual typing:

| Role | Email | Password | Access Capabilities |
| :--- | :--- | :--- | :--- |
| **Administrator** | `admin@example.com` | `password123` | Full access, user management, SLA configuration, global analytics |
| **Support Agent** | `agent@example.com` | `password123` | Assigned queues, status lifecycle transitions, AI advisor, comments |
| **Standard User** | `user@example.com` | `password123` | Ticket creation, personal ticket tracking, comments, attachments |

---

## 🧪 Automated Testing & Quality Assurance

TicketFlow features an exhaustive test suite built with the native Node.js test runner (`node:test`) and Supertest.

### Running the Test Suite:

```bash
cd server
npm test
```

### Test Suite Coverage (245 Total Tests, 100% Passing):

| Test Suite | File | Tests | Focus Area |
| :--- | :--- | :--- | :--- |
| **Phase 1** | `tests/auth.test.js` | 11 | Authentication, JWT signing, password hashing, RBAC |
| **Phase 2** | `tests/tickets.test.js` | 21 | Core ticket lifecycle, status transitions, role boundaries |
| **Phase 3** | `tests/phase3.test.js` | 31 | Comments, file attachments, MIME security, audit logging |
| **Phase 4** | `tests/phase4.test.js` | 41 | Socket.IO room isolation, real-time broadcasts, filtering |
| **Phase 5** | `tests/phase5.test.js` | 34 | SLA calculation, cron monitoring, breach detection |
| **Phase 6** | `tests/phase6.test.js` | 10 | Role-conditioned analytics dashboards, KPI aggregations |
| **Phase 7** | `tests/phase7.test.js` | 20 | Server-side search, pagination metadata, ReDoS protection |
| **Phase 8** | `tests/phase8.test.js` | 23 | Administrative user & agent management, self-protection guards |
| **Phase 9** | `tests/phase9.test.js` | 20 | Persistent notification lifecycle, unread counts, mark-all-read |
| **Phase 11** | `tests/phase11.test.js` | 15 | Strict CORS, data leakage prevention, DB state invariance |
| **Phase 12** | `tests/phase12.test.js` | 19 | Malformed JSON resiliency, Mongoose CastError, enum limits |
| **Total** | **11 Suites** | **245** | **100% Pass Rate (0 fails, 0 skips)** |

---

## 📦 Production Build & Verification

The frontend client compiles into a highly optimized, minified production bundle via Vite:

```bash
cd client
npm run build
```

**Build Output:**
- `dist/index.html` (1.24 kB)
- `dist/assets/index-xc6HQxR0.css` (17.39 kB / gzip: 4.28 kB)
- `dist/assets/index-DF6rcHO_.js` (904.62 kB / gzip: 249.57 kB)
- **Status: Verified & production-ready with 0 compilation errors.**

To preview the production bundle locally:
```bash
cd client
npm run preview
# Serves optimized bundle on http://localhost:4173
```

---

## 📄 License & Academic Attribution
Developed as an enterprise software engineering demonstration project. Licensed under the ISC License.
