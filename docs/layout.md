# Application layout and navigation

Task 6 established the protected HR workspace around the authentication flow. Later approved tasks now provide employee retrieval, salary editing, and salary reporting within that shell.

## Routes

| Route          | Access     | Current behavior                                                                       |
| -------------- | ---------- | -------------------------------------------------------------------------------------- |
| `/login`       | Public     | Shows the sign-in form; an authenticated user is redirected to a safe workspace route. |
| `/dashboard`   | HR manager | Shows currency-isolated salary summaries and country/department/job-level breakdowns.  |
| `/employees`   | HR manager | Shows the functional read-only employee directory added in Task 7.                     |
| `/`            | HR manager | Redirects to `/dashboard`.                                                             |
| Any other path | HR manager | Shows an in-app not-found page with a dashboard link.                                  |

Unauthenticated workspace requests redirect to `/login`. After a successful sign-in, the app returns the user to `/dashboard` or `/employees` when that was the original destination. Arbitrary external or unknown return paths are rejected.

## Workspace behavior

- A permanent side navigation is shown on larger screens. Smaller screens use a menu button and temporary drawer.
- Dashboard and Employees use URL-backed links, active-page styling, page titles, and heading focus after navigation.
- A skip link lets keyboard users move directly to main content.
- The shell displays the authenticated HR email and provides sign-out with progress and error feedback.
- Reusable components provide loading, error, empty, form-field, page-header, and display-table presentation. Feature modules will supply their data and actions in later tasks.

## Verification

Run `npm run check` from the repository root. Component tests cover protected redirects, safe post-login return, desktop navigation, mobile drawer behavior, sign-out, and shared UI states. Manual browser checks covered direct `/employees` access before and after login, navigation, reload persistence, and desktop/mobile layouts.

The development server handles route fallback. Production hosting must serve the React entry document for unknown non-API paths; that single-origin fallback is part of the later deployment task.
