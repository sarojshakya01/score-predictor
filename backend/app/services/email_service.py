"""Email delivery service using SMTP (async-friendly via run_in_executor)."""

import asyncio
import logging
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from functools import partial

from app.core.config import settings

logger = logging.getLogger(__name__)

# ── Shared email CSS ──────────────────────────────────────────────────────────

_EMAIL_STYLE = """
<style>
  body { font-family: Arial, sans-serif; color: #333; margin: 0; padding: 20px; }
  table { border-collapse: collapse; width: 100%; margin-top: 12px; }
  th, td { border: 1px solid #c3c3c3; padding: 8px 12px; text-align: center; }
  th { background: #0a3161; color: #fff; text-transform: capitalize; }
  tr:nth-child(even) { background: #f7f8f5; }
  .not-predicted { background: #f7c6c6; color: #7f1d1d; font-weight: bold; }
  .btn { display: inline-block; margin-top: 16px; padding: 10px 10px;
         color: #fff; border-radius: 6px;
         text-decoration: none; font-weight: bold; }
</style>
"""


def _build_base_html(body_content: str) -> str:
    """Wrap body content in the shared email HTML shell."""
    return f"""<html><head>{_EMAIL_STYLE}</head><body>
{body_content}
<br>
<p>For more details visit
  <a class="btn" href="{settings.SITE_URL}" target="_blank">Match Predictor</a>
</p>
<p>Regards,<br><strong>Admin</strong></p>
</body></html>"""


def _send_sync(
    subject: str,
    html_body: str,
    recipients: list[str],
) -> None:
    """Blocking SMTP send — called from a thread pool by the async wrapper."""
    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = settings.EMAIL_FROM
    msg["To"] = ", ".join(recipients)
    msg.attach(MIMEText(html_body, "html"))

    with smtplib.SMTP(settings.EMAIL_SMTP, settings.EMAIL_PORT) as mail:
        mail.starttls()
        mail.login(settings.EMAIL_FROM, settings.EMAIL_PASS)
        mail.sendmail(settings.EMAIL_FROM, recipients, msg.as_string())


async def send_email(
    subject: str,
    html_body: str,
    recipients: list[str],
) -> None:
    """Send an HTML email asynchronously (offloads SMTP to thread pool)."""
    if not recipients:
        logger.warning("send_email called with empty recipient list – skipping")
        return

    loop = asyncio.get_event_loop()
    try:
        await loop.run_in_executor(
            None,
            partial(_send_sync, subject, html_body, recipients),
        )
        logger.info("Email sent: %s → %d recipient(s)", subject, len(recipients))
    except Exception:
        logger.exception("Failed to send email: %s", subject)
        raise


def build_base_html(body_content: str) -> str:
    """Public alias so scheduler jobs can call this without importing the private name."""
    return _build_base_html(body_content)


# ── Notification helpers ──────────────────────────────────────────────────────

async def send_user_activation_email(
    *,
    email: str,
    first_name: str,
    activated: bool,
) -> None:
    """Notify a user that their account has been activated or deactivated."""
    if activated:
        subject = "Your account has been activated"
        heading = "Account Activated"
        message = (
            f"Hi {first_name},<br><br>"
            "Your account has been <strong>activated</strong>. "
            "You can now log in and start making predictions."
        )
        badge_color = "#15803D"
        badge_label = "Activated"
    else:
        subject = "Your account has been deactivated"
        heading = "Account Deactivated"
        message = (
            f"Hi {first_name},<br><br>"
            "Your account has been <strong>deactivated</strong>. "
            "You will not be able to log in until an administrator re-activates it. "
            "Please contact support if you believe this is a mistake."
        )
        badge_color = "#DC2626"
        badge_label = "Deactivated"

    body = f"""
<h2 style="margin-bottom:4px;">{heading}</h2>
<p>
  <span style="display:inline-block;padding:3px 10px;border-radius:12px;
               background:{badge_color};color:#fff;font-size:13px;font-weight:bold;">
    {badge_label}
  </span>
</p>
<p>{message}</p>
"""
    await send_email(
        subject=subject,
        html_body=_build_base_html(body),
        recipients=[email],
    )


async def send_match_unlocked_email(
    *,
    recipients: list[str],
    team1_name: str,
    team2_name: str,
) -> None:
    """Notify all active users that a previously locked match has been unlocked."""
    if not recipients:
        return

    subject = "A locked match has been unlocked \u2013 predictions re-opened"
    body = f"""
<h2 style="margin-bottom:4px;">Match Unlocked</h2>
<p>
  <span style="display:inline-block;padding:3px 10px;border-radius:12px;
               background:#D97706;color:#fff;font-size:13px;font-weight:bold;">
    Unlocked
  </span>
</p>
<p>
  The following match was previously locked but has now been
  <strong>unlocked</strong> \u2014 predictions are open again:
</p>
<p style="font-size:18px;font-weight:bold;text-align:center;
          padding:12px;background:#f1f5f9;border-radius:8px;">
  {team1_name} &nbsp;vs&nbsp; {team2_name}
</p>
<p>Log in and submit your prediction before it locks again.</p>
"""
    await send_email(
        subject=subject,
        html_body=_build_base_html(body),
        recipients=recipients,
    )
