# Football Tournament Predictor App

## Project Goal

Build a scalable football tournament prediction platform where users can:

* Predict football match scores
* Earn points based on prediction accuracy
* Compete on leaderboards
* View tournament progress and statistics

The platform must support:

* Normal Users
* Admin Users

The system should support up to:

* 500 users

Deployment target:

* On-Prem CentOS 7 VM

---

# Tech Stack

## Backend

* Python
* FastAPI
* SQLAlchemy
* Alembic
* JWT Authentication

## Frontend

* Next.js
* TypeScript
* Tailwind CSS
* Plain fetch method
* React Query / TanStack Query

## Database

* MySQL

---

# User Roles

## Normal User

Capabilities:

* Signup/Login
* Predict matches (scores etc.)
* View leaderboard
* View groups
* View tournament brackets
* View race charts
* View rules

## Admin User

Capabilities:

* CRUD operations for matches
* CRUD operations for teams
* CRUD operations for users
* Manage settings

---

# Authentication Rules

## Signup Fields

* Email
* Mobile Number
* Display Name
* Password

## Login

* Email + Password
* JWT-based authentication

## Security

* JWT Authentication
* bcrypt password hashing

---

# Deployment

## Environment

* CentOS 7 VM

## Reverse Proxy

* Nginx

## Backend Runtime

* Gunicorn + Uvicorn

## Frontend Runtime

* Next.js standalone server
