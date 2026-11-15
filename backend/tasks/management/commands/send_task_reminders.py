from datetime import timedelta
from itertools import groupby

from django.conf import settings
from django.core.mail import send_mail
from django.core.management.base import BaseCommand
from django.utils import timezone

from tasks.models import Task


class Command(BaseCommand):
    help = (
        "Email each user a reminder listing their open tasks that are due tomorrow. "
        "Schedule it once a day (cron / Windows Task Scheduler / docker exec)."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Show who would be emailed without sending anything.",
        )
        parser.add_argument(
            "--days",
            type=int,
            default=1,
            help="How many days ahead to look (default 1 = tomorrow).",
        )

    def handle(self, *args, **options):
        target_date = timezone.localdate() + timedelta(days=options["days"])
        tasks = (
            Task.objects.filter(due_date=target_date, user__is_active=True)
            .exclude(status=Task.Status.DONE)
            .select_related("user", "category")
            .order_by("user_id", "title", "id")
        )

        sent = 0
        failed = 0
        for _user_id, user_tasks in groupby(tasks, key=lambda task: task.user_id):
            user_tasks = list(user_tasks)
            user = user_tasks[0].user
            subject = f"Reminder: {len(user_tasks)} task(s) due {target_date:%d %b %Y}"
            body = self.build_body(user, user_tasks, target_date)

            if options["dry_run"]:
                self.stdout.write(f"[dry-run] would email {user.email}: {len(user_tasks)} task(s)")
                sent += 1
                continue

            try:
                send_mail(subject, body, settings.DEFAULT_FROM_EMAIL, [user.email], fail_silently=False)
                sent += 1
            except Exception as exc:  # noqa: BLE001 - one bad address must not stop the batch
                failed += 1
                self.stderr.write(f"Could not email {user.email}: {exc}")

        verb = "Would send" if options["dry_run"] else "Sent"
        self.stdout.write(self.style.SUCCESS(f"{verb} {sent} reminder email(s) for {target_date}."))
        if failed:
            self.stdout.write(self.style.WARNING(f"{failed} email(s) failed."))

    @staticmethod
    def build_body(user, tasks, target_date):
        lines = [
            f"Hi {user.first_name or 'there'},",
            "",
            f"These tasks are due on {target_date:%A, %d %B %Y}:",
            "",
        ]
        for task in tasks:
            category = f" [{task.category.name}]" if task.category else ""
            lines.append(f"- {task.title} (priority: {task.get_priority_display()}){category}")
        lines += ["", "Good luck!", "- Task Manager"]
        return "\n".join(lines)
