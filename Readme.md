# Football Score Predictor
Predict your score and compare with your friends.

## Requirements
1. NodeJS 20+
2. Python 3.13+
3. Mysql 5.7+


## Tech Stack

### Database
- MySQL/MariaDB

#### DB Setup
1. Install mysql/mariadb following official docs
2. Start DB server

### Backend
- FastAPI
- APScheduler
- MySQL

### Run following commands
`python3.13 -m venv .venv`

`source .venv/bin/activate`

`cd backend`

`cp sample.env .env` and update your variable's value

`uvicorn app.main:app --reload --port 8025`

### Frontend
- Next.js
- React
- TypeScript

### Run following commands
`npm install pnpm -g`

`cd frontend`

`pnpm install`

`pnpm run dev`

### Frontend
- Next.js
- React
- TypeScript

## If using Docker
`cp docker-compose.example.env .env`

`cp docker-compose.example.yml docker-compose.yml`

`docker compose up --build -d`

## Examine App
- Backend: port 8025
- Frontend: port 8026
