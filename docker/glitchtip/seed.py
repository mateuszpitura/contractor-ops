"""GlitchTip seed — idempotent bootstrap for local dev.

Creates (or no-ops on rerun):
- Superuser  admin@local / admin (override via GT_ADMIN_EMAIL / GT_ADMIN_PASSWORD)
- Organization  contractor-ops
- Team        dev
- Project     contractor-ops (platform: javascript-nextjs)
- Project key — prints the DSN to stdout for the dev-portal to pick up.

Run via:
  docker compose exec glitchtip-web ./manage.py shell < docker/glitchtip/seed.py
or via the dedicated glitchtip-seed sidecar in docker-compose.yml.
"""

import os
import sys

from allauth.account.models import EmailAddress
from django.contrib.auth import get_user_model
from django.utils.text import slugify

from apps.organizations_ext.models import (
    Organization,
    OrganizationOwner,
    OrganizationUser,
    OrganizationUserRole,
)
from apps.projects.models import Project, ProjectKey
from apps.teams.models import Team

User = get_user_model()

ADMIN_EMAIL = os.environ.get("GT_ADMIN_EMAIL", "admin@glitchtip.local")
ADMIN_PASSWORD = os.environ.get("GT_ADMIN_PASSWORD", "Test1234!")
ORG_NAME = os.environ.get("GT_ORG_NAME", "contractor-ops")
TEAM_NAME = os.environ.get("GT_TEAM_NAME", "dev")
PROJECT_NAME = os.environ.get("GT_PROJECT_NAME", "contractor-ops")
PLATFORM = os.environ.get("GT_PROJECT_PLATFORM", "javascript-nextjs")


def log(msg: str) -> None:
    print(f"[seed] {msg}", file=sys.stderr)


user, created = User.objects.get_or_create(
    email=ADMIN_EMAIL,
    defaults={"is_staff": True, "is_superuser": True, "is_active": True},
)
user.is_staff = True
user.is_superuser = True
user.is_active = True
user.set_password(ADMIN_PASSWORD)
user.save()
log(f"user {'created' if created else 'updated'}: {ADMIN_EMAIL}")

# django-allauth requires a verified EmailAddress record to permit login.
# Without it the username/password form rejects credentials even when the
# password hash is correct.
email_obj, _ = EmailAddress.objects.update_or_create(
    user=user,
    email=ADMIN_EMAIL,
    defaults={"verified": True, "primary": True},
)
log(f"email-address verified: {email_obj.email}")

org, created = Organization.objects.get_or_create(
    slug=slugify(ORG_NAME),
    defaults={"name": ORG_NAME},
)
log(f"org {'created' if created else 'exists'}: {org.slug}")

org_user, _ = OrganizationUser.objects.get_or_create(
    user=user,
    organization=org,
    defaults={"role": OrganizationUserRole.OWNER},
)
OrganizationOwner.objects.get_or_create(
    organization=org,
    defaults={"organization_user": org_user},
)
log(f"org-owner wired: {user.email} owns {org.slug}")

team, created = Team.objects.get_or_create(
    slug=slugify(TEAM_NAME),
    organization=org,
)
team.members.add(org_user)
log(f"team {'created' if created else 'exists'}: {team.slug}")

project, created = Project.objects.get_or_create(
    slug=slugify(PROJECT_NAME),
    organization=org,
    defaults={"name": PROJECT_NAME, "platform": PLATFORM},
)
if not created and project.platform != PLATFORM:
    project.platform = PLATFORM
    project.save(update_fields=["platform"])
project.teams.add(team)
log(f"project {'created' if created else 'exists'}: {project.slug} (platform={project.platform})")

key = ProjectKey.objects.filter(project=project).first()
if key is None:
    key = ProjectKey.objects.create(project=project, label="default")
    log("project-key created")
else:
    log("project-key exists")

# DSN format documented at https://glitchtip.com/documentation
# scheme://public_key@host/project_id
domain = os.environ.get("GLITCHTIP_DOMAIN", "http://localhost:8000").rstrip("/")
dsn = f"{domain.split('://', 1)[0]}://{key.public_key}@{domain.split('://', 1)[1]}/{project.id}"
print(f"NEXT_PUBLIC_SENTRY_DSN={dsn}")
log(f"DSN ready — copy line above into .env (NEXT_PUBLIC_SENTRY_DSN)")
