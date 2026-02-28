# **App Name**: AutoDrive

## Core Features:

- Authentication: Secure user authentication using Firebase Authentication with email/password and role-based access control (`consultant` and `manager`).
- Data Model: Define and manage data models (Users, Lessons, LessonLogs) within Firestore. Store user profiles, lesson metadata, and records of completed lessons with performance metrics.
- Dashboard: Role-based dashboard UI: Consultants view available lessons and recent activity; Managers see aggregate stats and lesson completion summaries.
- Lesson Logging: Record lesson completions: Capture metrics (timestamp, userId, lessonId, stepResults, xpGained, empathy, listening, trust, followUp, closing, relationshipBuilding) into Firestore.

## Style Guidelines:

- Primary color: Dark blue (#3F51B5) to convey professionalism and trust, fitting for a training system.
- Background color: Very light gray (#F5F5F5), a desaturated shade of the primary color, for a clean and non-distracting backdrop.
- Accent color: Indigo (#9C27B0), analogous to blue but distinct, for interactive elements and highlights.
- Body and headline font: 'PT Sans', a humanist sans-serif suitable for both headlines and body text, ensuring readability.
- Use simple, clear icons from a library like Material Icons to represent lesson categories and dashboard stats.
- Dashboard layout: Use a responsive grid to adapt to different screen sizes, ensuring content is well-organized and accessible.