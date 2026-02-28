

# Inter Department Workflow Automation

## Overview
A dashboard-heavy enterprise workflow application where departments can assign and track tasks between each other, with role-based access control, file attachments, and email notifications.

---

## 1. Authentication & Onboarding
- **Email/password sign-up and login** using Supabase Auth
- Password reset flow with dedicated reset page
- Protected routes — unauthenticated users redirected to login
- After first login, users see their department dashboard

## 2. Role-Based Access Control
- **Three roles**: Admin, Manager, Staff (stored in a dedicated `user_roles` table)
- **Admin**: Full access — manage departments, users, all tasks, view all stats
- **Manager**: Manage tasks within and across their department, view department stats
- **Staff**: View and update tasks assigned to them, create new task requests
- First registered user (or seeded user) gets Admin role

## 3. Department Management
- **Pre-seeded departments** (e.g., HR, Finance, IT, Operations, Marketing) created via database migration
- Admin can add, edit, or deactivate departments
- Admin assigns users to departments from a user management panel
- Each user belongs to one department

## 4. User Management (Admin Only)
- View all registered users in a data table
- Assign/change department and role for each user
- Deactivate user accounts

## 5. Task/Workflow System
- **Create tasks** with: title, description, priority (Low/Medium/High/Urgent), due date, assigned department, assigned user
- **Task statuses**: Pending → In Progress → Completed
- Tasks can be assigned **across departments** (e.g., HR assigns a task to IT)
- File attachments per task using Supabase Storage
- Task detail view with activity/status history
- Filter and sort tasks by status, priority, department, due date

## 6. Dashboard (Home Page)
- **Admin dashboard**: Organization-wide stats — total tasks, completion rates, department performance, overdue tasks
- **Manager dashboard**: Department-specific stats, team workload overview
- **Staff dashboard**: Personal task list, upcoming deadlines
- Charts and graphs (using Recharts) for visual statistics
- Data tables with dense, information-rich layout

## 7. Email Notifications
- Supabase Edge Function to send emails when:
  - A task is assigned to a user
  - A task status changes
- Uses Supabase's built-in email capabilities or a connected email service

## 8. File Management
- Upload files (documents, images) to tasks via Supabase Storage
- View and download attached files from the task detail page
- Storage bucket with proper RLS policies

## 9. Pages & Navigation
- **Sidebar navigation** with role-aware menu items:
  - Dashboard
  - Tasks (All / My Tasks)
  - Departments (Admin only)
  - Users (Admin only)
  - Settings/Profile
- Responsive but optimized for desktop use

## 10. Database Schema (High Level)
- `profiles` — user profile info linked to auth.users
- `departments` — pre-seeded department list
- `user_roles` — role assignments (Admin/Manager/Staff)
- `tasks` — core task data with department and user assignments
- `task_attachments` — file metadata linked to storage
- `task_history` — status change log for audit trail

---

## Implementation Order
1. Supabase setup + database schema + RLS policies
2. Auth pages (login, signup, reset password)
3. Layout with sidebar navigation
4. Dashboard page with statistics
5. Department management (Admin)
6. User management (Admin)
7. Task creation, listing, and detail views
8. File upload on tasks
9. Email notification edge function
10. Polish and role-based UI refinements

