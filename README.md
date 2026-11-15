# Task Manager (Django REST + React + MySQL)

A Todoist-style task manager: JWT authentication, categories, tasks with priorities and due dates, search / filters /
sorting / pagination, a statistics dashboard, plus bonus features (subtasks, Kanban board, dark mode, recurring tasks,
refresh-token blacklisting on logout, email reminders, automated tests, Docker).

> **Status note (read me first):** all code was written and statically checked (every Python file compiles, the whole
> React app bundles with esbuild, the Postman JSON is valid). The Django test suite and `npm run build` could **not** be
> executed in the environment that generated this project (no MySQL, no package-install network access), so run them
> yourself using the commands below before relying on the project. See [Known limitations](#known-limitations).

## Table of contents
1. [Technology stack](#technology-stack)
2. [Project structure](#project-structure)
3. [Quick start on Windows PowerShell](#quick-start-on-windows-powershell)
4. [Running with Docker Compose](#running-with-docker-compose)
5. [Running the tests](#running-the-tests)
6. [Features](#features)
7. [API documentation](#api-documentation)
8. [Postman collection](#postman-collection)
9. [Demo credentials](#demo-credentials)
10. [Screenshots](#screenshots)
11. [Troubleshooting](#troubleshooting)
12. [Known limitations](#known-limitations)

## Technology stack

| Layer    | Tools |
| -------- | ----- |
| Backend  | Python 3.10+, Django, Django REST Framework, djangorestframework-simplejwt (with token blacklist), django-cors-headers, django-filter, python-decouple, mysqlclient, WhiteNoise, Gunicorn |
| Frontend | React 18 + Vite, React Router 6, Axios, React Context API, plain CSS (light/dark themes) |
| Database | MySQL 8 |
| Tooling  | Docker + Docker Compose, Postman collection |

## Project structure

```
task-manager/
├── backend/
│   ├── config/                  # settings, urls, wsgi/asgi, custom exception handler
│   ├── accounts/                # custom email-based User, auth endpoints, admin
│   ├── tasks/                   # Category, Task, Subtask models, API, filters, services
│   │   └── management/commands/ # send_task_reminders, seed_demo_data
│   ├── tests/                   # automated tests (auth, categories, tasks, filters, dashboard, bonuses)
│   ├── manage.py
│   ├── requirements.txt
│   ├── .env.example
│   ├── Dockerfile
│   └── docker-entrypoint.sh
├── frontend/
│   ├── src/
│   │   ├── api/                 # axios.js (single instance + interceptors), auth/tasks/categories calls
│   │   ├── components/          # TaskForm, TaskCard, KanbanBoard, Navbar, ...
│   │   ├── pages/               # Login, Register, Dashboard, Tasks, Board, Categories, Profile, 404, ...
│   │   ├── context/             # AuthContext, ThemeContext, ToastContext
│   │   ├── routes/              # ProtectedRoute, PublicRoute
│   │   ├── hooks/               # useDebounce, useCategories
│   │   ├── utils/  styles/
│   │   ├── App.jsx
│   │   └── main.jsx
│   ├── public/
│   ├── package.json
│   ├── .env.example
│   ├── Dockerfile  nginx.conf
├── postman/task-manager-collection.json
├── screenshots/                 # see screenshots/README.md
├── docker-compose.yml
├── .env.example                 # used by docker-compose only
├── .gitignore
└── README.md
```

## Quick start on Windows PowerShell

### 1. Prerequisites
* **Python 3.10+** – https://www.python.org/downloads/ (tick *Add python.exe to PATH*). Check: `python --version`
* **Node.js 18+** – https://nodejs.org . Check: `node --version`
* **MySQL 8** – https://dev.mysql.com/downloads/installer/ (keep the root password you choose).
* `mysqlclient` is installed from a pre-built wheel on Windows for common Python versions. If `pip` tries to compile it and
  fails, see [Troubleshooting](#troubleshooting).

### 2. Extract and enter the project
```powershell
Expand-Archive -Path .\task-manager-project.zip -DestinationPath .
cd .\task-manager
```

### 3. Create the MySQL database and user
Open PowerShell and run (enter your MySQL root password when asked):
```powershell
mysql -u root -p
```
then paste inside the MySQL prompt (choose your own password instead of `ChangeMe123!`):
```sql
CREATE DATABASE task_manager CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'task_manager_user'@'localhost' IDENTIFIED BY 'ChangeMe123!';
GRANT ALL PRIVILEGES ON task_manager.* TO 'task_manager_user'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```
(The privileges on `task_manager.*` also let Django create its temporary `test_task_manager` database when running tests:
`GRANT ALL PRIVILEGES ON test_task_manager.* TO 'task_manager_user'@'localhost';`)

### 4. Backend: virtual environment, dependencies, configuration
```powershell
cd .\backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install -r requirements.txt
Copy-Item .env.example .env
```
If PowerShell blocks the activation script, run once: `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`.

Edit `.env` (e.g. `notepad .env`): set `DB_PASSWORD` to the password from step 3, and generate a secret key:
```powershell
python -c "from django.core.management.utils import get_random_secret_key as g; print(g())"
```
Paste the output as `SECRET_KEY`. **`.env` is git-ignored – never commit it.**

### 5. Migrations, superuser, demo data, server
```powershell
python manage.py migrate
python manage.py createsuperuser          # email + first/last name + password (for /admin/)
python manage.py seed_demo_data           # optional: demo user with sample tasks (DEBUG=True only)
python manage.py runserver
```
API: http://localhost:8000/api/ · Admin: http://localhost:8000/admin/

### 6. Frontend (new PowerShell window)
```powershell
cd .\task-manager\frontend
npm install
Copy-Item .env.example .env
npm run dev
```
Open http://localhost:5173 . `VITE_API_URL` in `frontend/.env` must point at the API (default `http://localhost:8000/api`).
Production build: `npm run build` (output in `frontend/dist`), preview with `npm run preview`.

### 7. Email reminders (tasks due tomorrow)
```powershell
python manage.py send_task_reminders --dry-run   # list who would be emailed
python manage.py send_task_reminders             # send (console backend prints to the terminal by default)
```
Schedule it once a day with Windows **Task Scheduler** (action: run
`<path>\backend\.venv\Scripts\python.exe` with arguments `manage.py send_task_reminders` and start-in `<path>\backend`).
For real emails set `EMAIL_BACKEND=django.core.mail.backends.smtp.EmailBackend` and the `EMAIL_*` values in `.env`.

## Running with Docker Compose
```powershell
cd .\task-manager
Copy-Item .env.example .env       # then edit .env: SECRET_KEY, DB_PASSWORD, DB_ROOT_PASSWORD
docker compose up --build
```
* Frontend http://localhost:5173 · API http://localhost:8000/api/ · Admin http://localhost:8000/admin/
* Migrations run automatically on start. Create an admin user:
  `docker compose exec backend python manage.py createsuperuser`
* Demo data (needs `DEBUG=True` in `.env`, or use `--force`): `docker compose exec backend python manage.py seed_demo_data --force`
* Reminders: `docker compose exec backend python manage.py send_task_reminders`
* Stop: `docker compose down` (add `-v` to also delete the database volume).
* `VITE_API_URL` is baked into the frontend image at build time; rebuild after changing it.

## Running the tests
```powershell
cd .\backend
.\.venv\Scripts\Activate.ps1
python manage.py test tests -v 2
```
The suite uses Django's test runner against a temporary database (`test_task_manager` on MySQL). To run without MySQL
for a quick check set `DB_ENGINE=sqlite` in `.env` (or `$env:DB_ENGINE="sqlite"` for the current session) – but MySQL is the
supported database. Covered areas: registration, login/JWT, token refresh and rotation, logout blacklisting, password
change, category CRUD + ownership + uniqueness, task CRUD + ownership (404 for other users' tasks), validation, due-date
rules, completion/`completed_at`, toggle, filters, search, sorting, pagination, dashboard statistics, unauthorised access,
subtasks, recurring tasks, reminder command, admin registration.

## Features
**Core:** registration/login with JWT (30 min access, 1 day refresh) · automatic silent token refresh with a single shared
refresh request · protected routes · categories (unique per user, deleting keeps tasks) · tasks with priority, status, due
date, `completed_at` handling · search (debounced 500 ms), filters, sorting and 10-per-page pagination stored in the URL ·
dashboard with counts, completion bar, due-today / overdue lists and per-category stats · Django admin · toast
notifications, loading states, empty states, confirmation before delete, responsive layout.

**Bonus:** subtasks/checklists · Kanban board with drag-and-drop (plus a "Move to" select for touch/keyboard) · dark
mode toggle (remembered) · daily/weekly recurring tasks (completing one creates the next, including its checklist) ·
logout blacklists the refresh token · email reminder management command · automated tests · Docker Compose.

**Security notes:** passwords hashed by Django (PBKDF2); every query is scoped to `request.user` so other users' objects
return 404; `category` must belong to the requester; secrets only via environment variables; CORS limited to configured
origins; ORM queries only (no raw SQL). The short-lived access token is kept in memory; the refresh token is in
`localStorage` so sessions survive a page refresh (trade-off: readable by injected JavaScript – tokens rotate and are
blacklisted on logout).

## API documentation
Base URL `http://localhost:8000/api`. Authenticated endpoints need `Authorization: Bearer <access>`.

Errors: validation → `400 {"detail": "Validation failed.", "errors": {"field": ["message"]}}`; missing/invalid token →
`401`; someone else's object or unknown id → `404`.

### Auth
| Method | Path | Body / notes |
| --- | --- | --- |
| POST | `/auth/register/` | `first_name, last_name, email, password (min 8), password_confirm` → 201 |
| POST | `/auth/login/` | `email, password` → `access, refresh, user` |
| POST | `/auth/token/refresh/` | `refresh` → new `access` (+ rotated `refresh`) |
| POST | `/auth/logout/` | `refresh` → blacklists it |
| GET/PUT/PATCH | `/auth/me/` | current user; first/last name editable |
| PUT | `/auth/change-password/` | `old_password, new_password, new_password_confirm` |

### Categories (unpaginated list)
| Method | Path | Notes |
| --- | --- | --- |
| GET / POST | `/categories/` | fields `name` (unique per user), `color` (`#rrggbb`) |
| GET / PUT / PATCH / DELETE | `/categories/{id}/` | delete sets tasks' category to null |

### Tasks
| Method | Path | Notes |
| --- | --- | --- |
| GET | `/tasks/` | paginated `{count, next, previous, results}` (10/page; optional `page_size` ≤ 100) |
| POST | `/tasks/` | title 3–100 chars; `due_date` not in the past on create; `status`: `todo / in_progress / done`; `priority`: `low / medium / high`; `recurrence`: `none / daily / weekly` (needs a due date) |
| GET / PUT / PATCH / DELETE | `/tasks/{id}/` | |
| PATCH | `/tasks/{id}/toggle-complete/` | Done ⇄ To Do |
| GET | `/tasks/dashboard/` | statistics (below) |
| GET / POST | `/tasks/{id}/subtasks/` | checklist items `{title}` |
| PATCH / PUT / DELETE | `/tasks/{id}/subtasks/{subtask_id}/` | e.g. `{"is_completed": true}` |

**List query parameters:** `status`, `priority`, `category=<id>`, `due=today\|overdue\|upcoming` (open tasks only),
`search=<text>` (title + description), `ordering=due_date\|-due_date\|priority\|-priority\|created_at\|-created_at`
(priority sorts Low < Medium < High; empty due dates sort last), `page`.

**Dashboard response:** `total, todo, in_progress, done, overdue, due_today, completion_percentage, due_today_tasks[],
overdue_tasks[], category_stats[{id,name,color,count,completed}]`. Overdue = due date passed **and** status not Done.

## Postman collection
1. Postman → **Import** → select `postman/task-manager-collection.json`.
2. Make sure the API is running; adjust the `base_url` collection variable if needed.
3. Run **1. Authentication → Register**, then **Login (saves tokens)**. Login stores `access_token` and `refresh_token`
   in collection variables; every other request sends the Bearer token automatically.
4. Run **Create category** and **Create task** – they save `category_id` / `task_id` for the following requests.
Folders cover auth, categories, tasks, search/filter/sort/pagination, dashboard and subtasks (35 requests).

## Demo credentials
> **Sample credentials for local development only** – created by `python manage.py seed_demo_data` (refuses to run when
> `DEBUG=False`). Never use them in production.

| | |
| --- | --- |
| Email | `demo@example.com` |
| Password | `Demo@12345` |

## Screenshots
Real screenshots could not be captured in the build environment, so none are bundled (no fake images). See
[`screenshots/README.md`](screenshots/README.md) for the list of 11 pages to capture and the file names to use.

## Troubleshooting
| Problem | Fix |
| --- | --- |
| `pip install mysqlclient` fails to build on Windows | Upgrade pip (`python -m pip install --upgrade pip`) so a pre-built wheel is used; or use a supported Python version (3.10–3.13); or install Visual C++ Build Tools. |
| `django.db.utils.OperationalError: (1045) Access denied` | `DB_USER` / `DB_PASSWORD` in `backend/.env` don't match the MySQL user from step 3. |
| `(2003) Can't connect to MySQL server` | MySQL service not running (`Get-Service *mysql*`, `Start-Service MySQL80`) or wrong `DB_HOST`/`DB_PORT`. |
| `(1049) Unknown database 'task_manager'` | Create the database (step 3). |
| `decouple.UndefinedValueError: SECRET_KEY not found` | `backend/.env` is missing – copy `.env.example` and fill it in. |
| Browser shows a CORS error | Add the exact frontend origin (e.g. `http://localhost:5173`) to `CORS_ALLOWED_ORIGINS` and restart Django. |
| Frontend: "Cannot reach the server" | Django isn't running, or `VITE_API_URL` is wrong. Restart `npm run dev` after editing `.env`. |
| `Activate.ps1 cannot be loaded because running scripts is disabled` | `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` |
| Port 8000 / 5173 already in use | `python manage.py runserver 8001` (then update `VITE_API_URL`), or `npm run dev -- --port 5174` (then add that origin to CORS). |
| Test run: "Access denied … test_task_manager" | `GRANT ALL PRIVILEGES ON test_task_manager.* TO 'task_manager_user'@'localhost';` |
| Docker: backend restarts / can't reach db | Check `.env` has `DB_PASSWORD` and `DB_ROOT_PASSWORD`; view logs with `docker compose logs backend db`. |
| Logged out unexpectedly | Access tokens last 30 min and refresh tokens 1 day; after a day you must log in again. |

## Known limitations
* **Not executed in the build environment:** the Django test suite, `npm install` / `npm run build`, Docker, and a live
  MySQL connection could not be run there. Code was checked statically only. Please run the test and build commands above.
* No screenshots are bundled (see above).
* Migrations were written by hand to match the models; if `python manage.py makemigrations --check` reports changes on
  your machine (Django versions differ in how they serialise some options), run `python manage.py makemigrations` once.
* Kanban drag-and-drop uses native HTML5 drag events (no mouse-free keyboard drag); the "Move to" selector is the
  accessible/touch alternative.
* Reminders are sent by a management command and must be scheduled externally (cron / Task Scheduler).
* The refresh token is stored in `localStorage` (see security notes); a production deployment may prefer httpOnly cookies.
