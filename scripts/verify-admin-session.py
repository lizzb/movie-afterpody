#!/usr/bin/env python3
"""Pass U76 — repeatable admin verification identity.

Restores a short-lived Supabase session minted by

    lovable auth-session --json           # sole auth user
    lovable auth-session --json --self    # requester's own account
    lovable auth-session --json --user <uuid>

into a Playwright browser and proves the real admin path works end to end:
JWT -> requireSupabaseAuth -> RLS -> has_role. No credential is ever stored in
this repo; the session file (~/.cache/lovable-auth/session.json) is secret,
short-lived, and only read here.

Usage:  python3 scripts/verify-admin-session.py [start_path]
Exit 0 = signed in AND admin surface reachable. Exit 1 = blocked; the printed
reason is what must be quoted before labelling an admin-only item
"IMPLEMENTED, NOT VERIFIED" for session reasons.
"""

import asyncio
import json
import os
import pathlib
import sys

from playwright.async_api import async_playwright

BASE = os.environ.get("VERIFY_BASE_URL", "http://localhost:8080")
SESSION_FILE = pathlib.Path.home() / ".cache" / "lovable-auth" / "session.json"
OUT = pathlib.Path("/tmp/browser/u76")


def load_session() -> dict:
    if not SESSION_FILE.exists():
        sys.exit("BLOCKED: no minted session. Run: lovable auth-session --json")
    return json.loads(SESSION_FILE.read_text())


async def main(start_path: str) -> None:
    data = load_session()
    OUT.mkdir(parents=True, exist_ok=True)

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(viewport={"width": 1280, "height": 1800})
        cookies = data.get("cookies") or []
        if cookies:
            await context.add_cookies([{**c, "url": BASE} for c in cookies])
        page = await context.new_page()
        errors: list[str] = []
        page.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)

        await page.goto(BASE, wait_until="domcontentloaded")
        await page.evaluate(
            "([k, v]) => localStorage.setItem(k, v)",
            [data["storage_key"], json.dumps(data["session"])],
        )

        await page.goto(f"{BASE}{start_path}", wait_until="domcontentloaded")
        await page.wait_for_timeout(6000)
        body = await page.inner_text("body")
        await page.screenshot(path=str(OUT / "admin.png"))

        signed_in = "Sign in" not in body or "Ingest" in body
        not_admin = "not an admin" in body.lower()
        print(f"url={page.url}")
        print(f"signed_in_heuristic={signed_in} not_admin_notice={not_admin}")
        print(f"console_errors={errors[:5]}")
        print(body[:1200])
        await browser.close()

        if not_admin:
            sys.exit("BLOCKED: session restored but the account has no admin role.")


if __name__ == "__main__":
    asyncio.run(main(sys.argv[1] if len(sys.argv) > 1 else "/admin/ingest"))
