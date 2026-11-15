from datetime import timedelta

from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError
from django.utils import timezone

from tasks.models import Category, Subtask, Task

DEMO_EMAIL = "demo@example.com"
DEMO_PASSWORD = "Demo@12345"  # SAMPLE credential - for local development only


class Command(BaseCommand):
    help = (
        "Create a demo user (demo@example.com / Demo@12345) with sample categories and tasks. "
        "Development only: refuses to run when DEBUG is False unless --force is given."
    )

    def add_arguments(self, parser):
        parser.add_argument("--force", action="store_true", help="Run even when DEBUG is False.")

    def handle(self, *args, **options):
        if not settings.DEBUG and not options["force"]:
            raise CommandError("Refusing to create demo data while DEBUG is False (use --force).")

        User = get_user_model()
        user, created = User.objects.get_or_create(
            email=DEMO_EMAIL, defaults={"first_name": "Demo", "last_name": "User"}
        )
        if created:
            user.set_password(DEMO_PASSWORD)
            user.save()

        if user.tasks.exists():
            self.stdout.write("Demo data already present - nothing to do.")
            return

        today = timezone.localdate()
        work = Category.objects.create(user=user, name="Work", color="#3b82f6")
        personal = Category.objects.create(user=user, name="Personal", color="#10b981")
        learning = Category.objects.create(user=user, name="Learning", color="#f59e0b")

        samples = [
            ("Prepare sprint demo", "Slides and a short live walkthrough.", work, "high", "in_progress", today, "none"),
            ("Review pull requests", "Check the open PRs on the API repo.", work, "medium", "todo", today + timedelta(days=1), "daily"),
            ("Pay electricity bill", "", personal, "high", "todo", today - timedelta(days=2), "none"),
            ("Plan weekend trip", "Pick a destination and book tickets.", personal, "low", "todo", today + timedelta(days=5), "none"),
            ("Finish Django REST course", "Complete the permissions chapter.", learning, "medium", "in_progress", today + timedelta(days=3), "weekly"),
            ("Update resume", "Add the latest project.", learning, "low", "done", today - timedelta(days=1), "none"),
        ]
        created_tasks = []
        for title, description, category, priority, status, due, recurrence in samples:
            created_tasks.append(
                Task.objects.create(
                    user=user,
                    title=title,
                    description=description,
                    category=category,
                    priority=priority,
                    status=status,
                    due_date=due,
                    recurrence=recurrence,
                )
            )

        for title, done in [("Outline slides", True), ("Record screen demo", False), ("Rehearse once", False)]:
            Subtask.objects.create(task=created_tasks[0], title=title, is_completed=done)

        self.stdout.write(self.style.SUCCESS(f"Created demo user {DEMO_EMAIL} (password: {DEMO_PASSWORD}) with sample data."))
