# ── Stage 1: builder ──────────────────────────────────────────────────────────
FROM python:3.12-slim AS builder

WORKDIR /app

# System deps needed to compile mysqlclient
RUN apt-get update && apt-get install -y --no-install-recommends \
        gcc \
        default-libmysqlclient-dev \
        pkg-config \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --upgrade pip \
 && pip install --no-cache-dir --prefix=/install -r requirements.txt

# ── Stage 2: runner ───────────────────────────────────────────────────────────
FROM python:3.12-slim AS runner

WORKDIR /app

# Runtime MySQL client shared library
RUN apt-get update && apt-get install -y --no-install-recommends \
        default-libmysqlclient-dev \
    && rm -rf /var/lib/apt/lists/*

# Non-root user
RUN addgroup --system --gid 1001 appgroup \
 && adduser  --system --uid 1001 --ingroup appgroup appuser

# Copy installed packages from builder
COPY --from=builder /install /usr/local

RUN mkdir -p /app/cache \
    && chown -R appuser:appgroup /app/cache \
    && chmod -R 775 /app/cache

# Copy application source
COPY --chown=appuser:appgroup . .

RUN chmod -R u+rwX,g+rwX /app/cache

USER appuser

EXPOSE 8025

# DATABASE_URL, JWT_SECRET, EMAIL_* etc. are injected at runtime via .env / compose
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8025"]
