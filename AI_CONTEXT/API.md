# Authentication APIs

## Signup

POST /auth/signup

## Login

POST /auth/login

## Refresh Token

POST /auth/refresh

## Current User

GET /auth/me

---

# User APIs

## Current User Profile

GET /users/me

## Update Current User

PUT /users/me

## Leaderboard

GET /leaderboard

Requires:
- Bearer access token

Query params:
- offset
- limit

Returns:
- ranked users
- race chart frames for cumulative points after each completed match

---

# Prediction APIs

## Upcoming Matches

GET /matches/upcoming/

Returns:
- upcoming match schedule
- team names and groups
- venue name
- lock status fields

## Create Prediction

POST /predictions

Fields include:
- first_scoring_team_id
- is_goal_in_first_half

The first-goal fields are required when the predicted score contains at least one goal.

## Update Prediction

PUT /predictions/{id}

## Current User Predictions

GET /predictions/me

---

# Home APIs

## Home Summary

GET /home/summary

Returns:
- open matches
- predictions made
- matches locking soon
- completed matches
- next prediction lock

---

# Group APIs

## Group Standings

GET /groups

---

# Admin APIs

# Matches

## List Matches

GET /admin/matches

## Create Match

POST /admin/matches

Fields include:
- first_scoring_team_id
- is_goal_in_first_half

The first-goal fields are required when both final score fields are set and the match has at least one goal.

## Update Match

PUT /admin/matches/{id}

## Delete Match

DELETE /admin/matches/{id}

---

# Teams

## List Teams

GET /admin/teams

## Create Team

POST /admin/teams

## Update Team

PUT /admin/teams/{id}

## Delete Team

DELETE /admin/teams/{id}

---

---

# Settings

## List Teams

GET /admin/settings

## Create Settings

POST /admin/settings

## Update Settings

PUT /admin/settings/{id}

## Delete Settings

DELETE /admin/settings/{id}

---

# Users

## List Users

GET /admin/users

## Create User

POST /admin/users

## Update User

PUT /admin/users/{id}

## Delete User

DELETE /admin/users/{id}

---

# Future APIs

* Live scores API
* Notification API
* Analytics API
* OAuth login APIs


# Deployment Requirements

## Docker file and docker compose yml for both backend and frontend
