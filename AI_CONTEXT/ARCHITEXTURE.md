# High Level Architecture

```text
Next.js Frontend
        |
        | REST API
        |
FastAPI Backend
        |
        | SQLAlchemy ORM
        |
MySQL Database
```

---

# Backend Structure

```text
src/backend/
    ├── app/
    │   ├── api/
    │   ├── core/
    │   ├── db/
    │   ├── models/
    │   ├── schemas/
    │   ├── services/
    │   ├── repositories/
    │   ├── middleware/
    │   ├── utils/
│   └── main.py
```

---

# Frontend Structure

```text
src/frontend/
    ├── app/
    │   ├── admin/
    │   ├── leaderboard/
    │   ├── predictions/
    │   ├── groups/
    │   ├── brackets/
    │   ├── charts/
    │   ├── rules/
    │   ├── login/
    │   ├── signup/
│   └── page.tsx
```

---

# Frontend Pages

# Public / Normal User Pages

## 1. Home Page

### Features

* Show upcoming matches
* Show match time/date
* Show teams
* Quick access to prediction page

### Components

* Upcoming Match Cards
* Tournament Summary
* Navigation Menu

---

## 2. Predict Page

### Features

* Predict match scores
* Submit prediction
* Edit prediction before deadline

### Notes

Prediction schema and scoring logic will be provided later.

### Components

* Match Prediction Form
* Prediction History
* Countdown Timer

---

## 3. Leaderboard Page

### Features

* Show accumulated points of all users
* Ranking system
* User statistics

### Components

* Rank Table
* Points Summary
* User Position Highlight

---

## 4. Group Stage Page

### Features

* Show tournament groups
* Show teams in groups
* Show standings

### Components

* Group Tables
* Match Statistics

---

## 5. Tournament Brackets Page

### Features

Display knockout rounds:

* Round of 32
* Round of 16
* Quarter Final
* Semi Final
* Final

### Components

* Interactive Bracket Tree

---

## 6. Race Chart Page

### Features

* Display leaderboard progression over time
* Compare user points visually

### Components

* Race Bar Graph

### Suggested Libraries

* Chart.js

---

## 7. Prediction Rules Page

### Features

* Show score prediction rules from settings table

---


---

# Admin Pages

Admin pages should be accessible only to users with ADMIN role.

---

## 1. Admin Dashboard

### Features

* List settings
* Create settings
* Update settings
* Delete settings

---

## 2. Games Management

### Features

* List matches
* Create matches
* Update matches
* Delete matches

### Components

* Matches Table
* Create/Edit Modal
* Search and Filters

---

## 3. Teams Management

### Features

* List teams
* Create team
* Update team
* Delete team

## 4. Users Management

### Features

* List users
* Create user
* Update user
* Delete user
* Assign roles

### User Types

* Admin
* Normal User


---

# Database

## Database Engine

* MySQL

## Initial Tables

* teams
fields: id (auto increment, pk), name (unique), group, fifa_code

* matches
fields: 
id(auto increment, pk), team1_score, team2_score, yellow_card_count, red_card_count,
opening_team_id, first_scoring_team_id, is_goal_in_first_half,
game_duration (90 min/120 min, penalty),
match_datetime, match_locked (to check prection can be made or not), match_reminder_sent (true or false),
match_day (1,2,3 etc)

* predictions
fields: id (auto increment, pk), user_id, match_id, team1_score, team2_score, yellow_card_count, red_card_count,
opening_team_id, first_scoring_team_id, is_goal_in_first_half,
game_duration (90 min/120 min, penalty),
predicted_datetime

* users
fields:
id (auto increment pk),
email,
first_name,
middle_name,
last_name,
mobile_no,
password,

* settings
fields:
id (auto increment pk),
name,
value


---

# Scalability

## Expected Users

* Up to 500 users

## Requirements

* Pagination support
* Efficient indexing
* Optimized queries

---

# Monitoring

## Logging

* Structured logging

## Health Check

* /health endpoint

## Backup

* Scheduled MySQL backups
