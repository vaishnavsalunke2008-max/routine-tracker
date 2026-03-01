# Routine Tracker – System Context

## Purpose
This is a personal performance tracking app designed for discipline, balance, and long-term self-improvement.

The app is not just a habit tracker.
It is a performance evaluation system.

---

## Core Philosophy

1. Track execution, not mood.
2. Evaluate in 10-day cycles to avoid emotional overreaction.
3. Focus on consistency over intensity.
4. Provide visual identity feedback using a radar chart.

---

## Core Features

### 1. Daily Habit Tracking
- Users can mark habits complete.
- Score updates dynamically.
- Data stored locally (localStorage).

### 2. Radar (Pentagon) Performance Chart
Five core categories:

- Discipline
- Health
- Content
- Skill
- Spiritual

Each category score = 
(completed habits in category / total habits in category) × 100

Radar updates dynamically when habits are checked.

---

### 3. 10-Day Evaluation System

- Store daily category scores with ISO date (YYYY-MM-DD).
- Every 10 unique days:
    - Calculate average score per category.
    - Generate feedback based on scale:

        80–100 → Strong Area
        60–79 → Stable but Improve
        40–59 → Needs Attention
        Below 40 → Critical – Immediate Focus Required

- Calculate Consistency Score:
    - Elite (8–10 strong days)
    - Disciplined (6–7)
    - Inconsistent (4–5)
    - Unstable (0–3)

- Reset cycle after evaluation.

---

## Deployment Architecture

Development:
- Local environment

Version Control:
- GitHub repository

Hosting:
- Vercel (auto-deploy on push)

App Type:
- Progressive Web App (PWA)
- Installed in standalone mode on mobile
- Uses manifest.json and service worker

---

## Future Improvements (Optional Ideas)

- Lifetime performance tracking
- Previous 10-day cycle comparison
- Automatic service worker update refresh
- Strategic focus suggestions based on weakest category
- Dark mode enhancements
- Performance history graphs

---

## Important Notes

This app is built for:
- Long-term consistency
- Balanced life optimization
- Measured growth
- Identity-based self-improvement

It should remain:
- Minimal
- Clean
- Fast
- Focused on performance clarity
