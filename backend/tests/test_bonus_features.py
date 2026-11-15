from io import StringIO

from django.contrib import admin
from django.core import mail
from django.core.management import call_command
from django.core.management.base import CommandError
from django.test import override_settings

from tasks.models import Category, Subtask, Task

from .base import APIBase


class SubtaskTests(APIBase):
    def setUp(self):
        self.user = self.make_user()
        self.authenticate(self.user)
        self.task = self.make_task(self.user, "Parent task")
        self.url = f"/api/tasks/{self.task.id}/subtasks/"

    def test_add_and_list_subtasks(self):
        response = self.client.post(self.url, {"title": "Step one"}, format="json")
        self.assertEqual(response.status_code, 201)
        self.assertFalse(response.data["is_completed"])
        self.client.post(self.url, {"title": "Step two"}, format="json")
        listing = self.client.get(self.url)
        self.assertEqual([s["title"] for s in listing.data], ["Step one", "Step two"])

    def test_blank_subtask_title_rejected(self):
        response = self.client.post(self.url, {"title": "  "}, format="json")
        self.assertEqual(response.status_code, 400)

    def test_subtasks_are_embedded_in_task_payload(self):
        Subtask.objects.create(task=self.task, title="A", is_completed=True)
        Subtask.objects.create(task=self.task, title="B")
        data = self.client.get(f"/api/tasks/{self.task.id}/").data
        self.assertEqual(data["subtask_count"], 2)
        self.assertEqual(data["subtasks_completed"], 1)
        self.assertEqual(len(data["subtasks"]), 2)

    def test_toggle_edit_and_delete_subtask(self):
        subtask = Subtask.objects.create(task=self.task, title="Check me")
        detail = f"{self.url}{subtask.id}/"
        response = self.client.patch(detail, {"is_completed": True}, format="json")
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data["is_completed"])
        response = self.client.patch(detail, {"title": "Renamed"}, format="json")
        self.assertEqual(response.data["title"], "Renamed")
        self.assertEqual(self.client.delete(detail).status_code, 204)
        self.assertFalse(Subtask.objects.filter(pk=subtask.pk).exists())

    def test_subtask_of_another_task_is_404(self):
        other_task = self.make_task(self.user, "Other parent")
        subtask = Subtask.objects.create(task=other_task, title="Elsewhere")
        response = self.client.patch(f"{self.url}{subtask.id}/", {"is_completed": True}, format="json")
        self.assertEqual(response.status_code, 404)

    def test_deleting_task_deletes_subtasks(self):
        Subtask.objects.create(task=self.task, title="Gone soon")
        self.client.delete(f"/api/tasks/{self.task.id}/")
        self.assertEqual(Subtask.objects.count(), 0)


class RecurringTaskTests(APIBase):
    url = "/api/tasks/"

    def setUp(self):
        self.user = self.make_user()
        self.authenticate(self.user)

    def test_recurring_task_requires_due_date(self):
        response = self.client.post(self.url, {"title": "Standup", "recurrence": "daily"}, format="json")
        self.assertEqual(response.status_code, 400)
        self.assertIn("due_date", response.data["errors"])

    def test_invalid_recurrence_rejected(self):
        response = self.client.post(
            self.url,
            {"title": "Standup", "recurrence": "monthly", "due_date": self.iso(1)},
            format="json",
        )
        self.assertEqual(response.status_code, 400)

    def test_completing_daily_task_creates_next_occurrence(self):
        category = self.make_category(self.user, "Work")
        task = self.make_task(
            self.user,
            "Daily review",
            description="Look at PRs",
            priority="high",
            category=category,
            due_date=self.day(0),
            recurrence="daily",
        )
        Subtask.objects.create(task=task, title="Open PR list", is_completed=True)

        response = self.client.patch(f"{self.url}{task.id}/toggle-complete/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["status"], "done")

        successor = Task.objects.exclude(pk=task.pk).get(title="Daily review")
        self.assertEqual(successor.due_date, self.day(1))
        self.assertEqual(successor.status, "todo")
        self.assertEqual(successor.recurrence, "daily")
        self.assertEqual(successor.priority, "high")
        self.assertEqual(successor.category, category)
        self.assertEqual(successor.user, self.user)
        self.assertEqual(successor.description, "Look at PRs")
        copied = list(successor.subtasks.values_list("title", "is_completed"))
        self.assertEqual(copied, [("Open PR list", False)])

    def test_completing_weekly_task_moves_one_week(self):
        task = self.make_task(self.user, "Weekly report", due_date=self.day(2), recurrence="weekly")
        self.client.patch(f"{self.url}{task.id}/", {"status": "done"}, format="json")
        successor = Task.objects.exclude(pk=task.pk).get(title="Weekly report")
        self.assertEqual(successor.due_date, self.day(9))

    def test_overdue_recurring_task_next_due_is_not_in_the_past(self):
        task = self.make_task(self.user, "Late daily", due_date=self.day(-10), recurrence="daily")
        self.client.patch(f"{self.url}{task.id}/toggle-complete/")
        successor = Task.objects.exclude(pk=task.pk).get(title="Late daily")
        self.assertGreaterEqual(successor.due_date, self.today())

    def test_non_recurring_task_does_not_spawn(self):
        task = self.make_task(self.user, "One off", due_date=self.day(1))
        self.client.patch(f"{self.url}{task.id}/toggle-complete/")
        self.assertEqual(Task.objects.count(), 1)

    def test_toggling_back_and_forth_does_not_create_duplicates(self):
        task = self.make_task(self.user, "Repeat me", due_date=self.day(0), recurrence="daily")
        toggle = f"{self.url}{task.id}/toggle-complete/"
        self.client.patch(toggle)  # done -> spawns
        self.client.patch(toggle)  # back to todo
        self.client.patch(toggle)  # done again -> must reuse the open successor
        self.assertEqual(Task.objects.filter(title="Repeat me").count(), 2)


class ReminderCommandTests(APIBase):
    def setUp(self):
        self.alice = self.make_user(email="alice@example.com", first_name="Alice")
        self.bob = self.make_user(email="bob@example.com", first_name="Bob")

    def run_command(self, *args):
        out = StringIO()
        call_command("send_task_reminders", *args, stdout=out, stderr=StringIO())
        return out.getvalue()

    def test_emails_users_with_tasks_due_tomorrow(self):
        category = self.make_category(self.alice, "Work")
        self.make_task(self.alice, "Submit report", due_date=self.day(1), priority="high", category=category)
        self.make_task(self.alice, "File taxes", due_date=self.day(1))
        self.make_task(self.bob, "Call dentist", due_date=self.day(1))

        output = self.run_command()
        self.assertEqual(len(mail.outbox), 2)
        recipients = sorted(message.to[0] for message in mail.outbox)
        self.assertEqual(recipients, ["alice@example.com", "bob@example.com"])
        alice_mail = next(m for m in mail.outbox if m.to == ["alice@example.com"])
        self.assertIn("Submit report", alice_mail.body)
        self.assertIn("File taxes", alice_mail.body)
        self.assertNotIn("Call dentist", alice_mail.body)
        self.assertIn("2 task(s)", alice_mail.subject)
        self.assertIn("Sent 2 reminder", output)

    def test_ignores_done_today_and_other_dates(self):
        self.make_task(self.alice, "Done already", due_date=self.day(1), status="done")
        self.make_task(self.alice, "Due today", due_date=self.day(0))
        self.make_task(self.alice, "Due in 2 days", due_date=self.day(2))
        self.make_task(self.alice, "No date")
        self.run_command()
        self.assertEqual(len(mail.outbox), 0)

    def test_skips_inactive_users(self):
        self.make_task(self.bob, "Call dentist", due_date=self.day(1))
        self.bob.is_active = False
        self.bob.save()
        self.run_command()
        self.assertEqual(len(mail.outbox), 0)

    def test_dry_run_sends_nothing(self):
        self.make_task(self.alice, "Submit report", due_date=self.day(1))
        output = self.run_command("--dry-run")
        self.assertEqual(len(mail.outbox), 0)
        self.assertIn("alice@example.com", output)

    def test_days_option(self):
        self.make_task(self.alice, "In three days", due_date=self.day(3))
        self.run_command("--days", "3")
        self.assertEqual(len(mail.outbox), 1)


class AdminAndSeedTests(APIBase):
    def test_models_registered_in_admin(self):
        from accounts.models import User

        for model in (User, Category, Task):
            self.assertIn(model, admin.site._registry)

    def test_task_admin_configuration(self):
        task_admin = admin.site._registry[Task]
        for column in ("title", "user", "priority", "status", "due_date"):
            self.assertIn(column, task_admin.list_display)
        self.assertIn("status", task_admin.list_filter)
        self.assertIn("priority", task_admin.list_filter)
        self.assertIn("title", task_admin.search_fields)

    @override_settings(DEBUG=True)
    def test_seed_demo_data_is_idempotent(self):
        call_command("seed_demo_data", stdout=StringIO())
        call_command("seed_demo_data", stdout=StringIO())
        from django.contrib.auth import get_user_model

        user = get_user_model().objects.get(email="demo@example.com")
        self.assertTrue(user.check_password("Demo@12345"))
        self.assertEqual(user.tasks.count(), 6)
        self.assertEqual(user.categories.count(), 3)

    @override_settings(DEBUG=False)
    def test_seed_demo_data_refuses_without_debug(self):
        with self.assertRaises(CommandError):
            call_command("seed_demo_data", stdout=StringIO())
