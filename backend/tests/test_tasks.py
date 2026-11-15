from tasks.models import Task

from .base import APIBase


class TaskCrudTests(APIBase):
    url = "/api/tasks/"

    def setUp(self):
        self.user = self.make_user()
        self.authenticate(self.user)

    def test_all_endpoints_require_authentication(self):
        task = self.make_task(self.user)
        self.logout_client()
        self.assertEqual(self.client.get(self.url).status_code, 401)
        self.assertEqual(self.client.post(self.url, {"title": "Abc"}, format="json").status_code, 401)
        self.assertEqual(self.client.get(f"{self.url}{task.id}/").status_code, 401)
        self.assertEqual(self.client.patch(f"{self.url}{task.id}/toggle-complete/").status_code, 401)
        self.assertEqual(self.client.get(f"{self.url}dashboard/").status_code, 401)

    def test_create_task_assigns_logged_in_user(self):
        other = self.make_user(email="other@example.com")
        response = self.client.post(
            self.url,
            {"title": "Write report", "description": "Q3", "user": other.id},
            format="json",
        )
        self.assertEqual(response.status_code, 201)
        task = Task.objects.get(pk=response.data["id"])
        self.assertEqual(task.user, self.user)
        self.assertEqual(response.data["user"], self.user.id)
        self.assertEqual(response.data["status"], "todo")
        self.assertEqual(response.data["priority"], "medium")
        self.assertIsNone(response.data["completed_at"])

    def test_create_with_all_fields(self):
        category = self.make_category(self.user, "Work")
        response = self.client.post(
            self.url,
            {
                "title": "Ship feature",
                "description": "Behind a flag",
                "category": category.id,
                "priority": "high",
                "status": "in_progress",
                "due_date": self.iso(5),
            },
            format="json",
        )
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["category"], category.id)
        self.assertEqual(response.data["category_detail"]["name"], "Work")
        self.assertEqual(response.data["priority"], "high")
        self.assertEqual(response.data["due_date"], self.iso(5))

    def test_retrieve_task(self):
        task = self.make_task(self.user, "Read me")
        response = self.client.get(f"{self.url}{task.id}/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["title"], "Read me")

    def test_full_update_put(self):
        task = self.make_task(self.user, "Old title")
        response = self.client.put(
            f"{self.url}{task.id}/",
            {"title": "New title", "description": "Updated", "priority": "low", "status": "in_progress"},
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        task.refresh_from_db()
        self.assertEqual((task.title, task.priority, task.status), ("New title", "low", "in_progress"))

    def test_partial_update_patch(self):
        task = self.make_task(self.user, "Keep title", priority="low")
        response = self.client.patch(f"{self.url}{task.id}/", {"priority": "high"}, format="json")
        self.assertEqual(response.status_code, 200)
        task.refresh_from_db()
        self.assertEqual((task.title, task.priority), ("Keep title", "high"))

    def test_delete_task(self):
        task = self.make_task(self.user)
        self.assertEqual(self.client.delete(f"{self.url}{task.id}/").status_code, 204)
        self.assertFalse(Task.objects.filter(pk=task.pk).exists())
        self.assertEqual(self.client.get(f"{self.url}{task.id}/").status_code, 404)

    def test_nonexistent_task_returns_404(self):
        self.assertEqual(self.client.get(f"{self.url}999999/").status_code, 404)


class TaskOwnershipTests(APIBase):
    url = "/api/tasks/"

    def setUp(self):
        self.user = self.make_user()
        self.other = self.make_user(email="other@example.com")
        self.foreign = self.make_task(self.other, "Foreign task")
        self.authenticate(self.user)

    def test_list_excludes_other_users_tasks(self):
        self.make_task(self.user, "Mine")
        response = self.client.get(self.url)
        self.assertEqual(response.data["count"], 1)
        self.assertEqual(self.titles(response), ["Mine"])

    def test_other_users_task_returns_404_for_every_method(self):
        detail = f"{self.url}{self.foreign.id}/"
        self.assertEqual(self.client.get(detail).status_code, 404)
        self.assertEqual(self.client.put(detail, {"title": "Hacked!"}, format="json").status_code, 404)
        self.assertEqual(self.client.patch(detail, {"title": "Hacked!"}, format="json").status_code, 404)
        self.assertEqual(self.client.delete(detail).status_code, 404)
        self.assertEqual(self.client.patch(f"{detail}toggle-complete/").status_code, 404)
        self.foreign.refresh_from_db()
        self.assertEqual(self.foreign.title, "Foreign task")
        self.assertEqual(self.foreign.status, "todo")

    def test_cannot_use_other_users_category(self):
        foreign_category = self.make_category(self.other, "Theirs")
        response = self.client.post(
            self.url, {"title": "Sneaky", "category": foreign_category.id}, format="json"
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn("category", response.data["errors"])
        self.assertFalse(Task.objects.filter(title="Sneaky").exists())

    def test_cannot_move_task_to_other_users_category(self):
        mine = self.make_task(self.user, "Mine")
        foreign_category = self.make_category(self.other, "Theirs")
        response = self.client.patch(
            f"{self.url}{mine.id}/", {"category": foreign_category.id}, format="json"
        )
        self.assertEqual(response.status_code, 400)

    def test_can_use_own_category_and_clear_it(self):
        category = self.make_category(self.user, "Mine")
        task = self.make_task(self.user, "Categorised", category=category)
        response = self.client.patch(f"{self.url}{task.id}/", {"category": None}, format="json")
        self.assertEqual(response.status_code, 200)
        task.refresh_from_db()
        self.assertIsNone(task.category)

    def test_subtasks_of_foreign_task_are_hidden(self):
        response = self.client.get(f"{self.url}{self.foreign.id}/subtasks/")
        self.assertEqual(response.status_code, 404)
        response = self.client.post(
            f"{self.url}{self.foreign.id}/subtasks/", {"title": "Nope"}, format="json"
        )
        self.assertEqual(response.status_code, 404)


class TaskValidationTests(APIBase):
    url = "/api/tasks/"

    def setUp(self):
        self.user = self.make_user()
        self.authenticate(self.user)

    def post(self, **data):
        return self.client.post(self.url, data, format="json")

    def test_title_required(self):
        response = self.post(description="No title")
        self.assertEqual(response.status_code, 400)
        self.assertIn("title", response.data["errors"])

    def test_title_too_short(self):
        response = self.post(title="ab")
        self.assertEqual(response.status_code, 400)
        self.assertIn("title", response.data["errors"])

    def test_title_whitespace_only_counts_as_too_short(self):
        response = self.post(title="  a  ")
        self.assertEqual(response.status_code, 400)

    def test_title_minimum_length_boundary(self):
        self.assertEqual(self.post(title="abc").status_code, 201)

    def test_title_maximum_length_boundary(self):
        self.assertEqual(self.post(title="x" * 100).status_code, 201)
        response = self.post(title="x" * 101)
        self.assertEqual(response.status_code, 400)
        self.assertIn("title", response.data["errors"])

    def test_invalid_priority_and_status(self):
        self.assertEqual(self.post(title="Valid title", priority="urgent").status_code, 400)
        self.assertEqual(self.post(title="Valid title", status="blocked").status_code, 400)

    def test_error_payload_is_consistent(self):
        response = self.post(title="a")
        self.assertEqual(response.data["detail"], "Validation failed.")
        self.assertIsInstance(response.data["errors"]["title"], list)

    def test_due_date_in_past_rejected_on_create(self):
        response = self.post(title="Too late", due_date=self.iso(-1))
        self.assertEqual(response.status_code, 400)
        self.assertIn("due_date", response.data["errors"])

    def test_due_date_today_and_future_allowed_on_create(self):
        self.assertEqual(self.post(title="Today task", due_date=self.iso(0)).status_code, 201)
        self.assertEqual(self.post(title="Future task", due_date=self.iso(10)).status_code, 201)

    def test_due_date_optional_and_invalid_format_rejected(self):
        self.assertEqual(self.post(title="No due date").status_code, 201)
        self.assertEqual(self.post(title="Bad date", due_date="31-12-2099").status_code, 400)

    def test_past_due_date_allowed_when_editing_existing_task(self):
        overdue = self.make_task(self.user, "Overdue task", due_date=self.day(-5))
        response = self.client.patch(f"{self.url}{overdue.id}/", {"title": "Renamed task"}, format="json")
        self.assertEqual(response.status_code, 200)
        response = self.client.put(
            f"{self.url}{overdue.id}/",
            {"title": "Renamed again", "due_date": self.iso(-5)},
            format="json",
        )
        self.assertEqual(response.status_code, 200)


class TaskCompletionTests(APIBase):
    url = "/api/tasks/"

    def setUp(self):
        self.user = self.make_user()
        self.authenticate(self.user)

    def test_creating_done_task_sets_completed_at(self):
        response = self.client.post(self.url, {"title": "Already done", "status": "done"}, format="json")
        self.assertEqual(response.status_code, 201)
        self.assertIsNotNone(response.data["completed_at"])

    def test_status_done_sets_completed_at(self):
        task = self.make_task(self.user)
        response = self.client.patch(f"{self.url}{task.id}/", {"status": "done"}, format="json")
        self.assertEqual(response.status_code, 200)
        self.assertIsNotNone(response.data["completed_at"])
        task.refresh_from_db()
        self.assertIsNotNone(task.completed_at)

    def test_leaving_done_clears_completed_at(self):
        task = self.make_task(self.user, status="done")
        self.assertIsNotNone(task.completed_at)
        response = self.client.patch(f"{self.url}{task.id}/", {"status": "in_progress"}, format="json")
        self.assertEqual(response.status_code, 200)
        self.assertIsNone(response.data["completed_at"])

    def test_completed_at_cannot_be_set_by_client(self):
        task = self.make_task(self.user)
        self.client.patch(
            f"{self.url}{task.id}/", {"completed_at": "2020-01-01T00:00:00Z"}, format="json"
        )
        task.refresh_from_db()
        self.assertIsNone(task.completed_at)

    def test_completed_at_is_stable_while_staying_done(self):
        task = self.make_task(self.user, status="done")
        first = task.completed_at
        self.client.patch(f"{self.url}{task.id}/", {"title": "Renamed task"}, format="json")
        task.refresh_from_db()
        self.assertEqual(task.completed_at, first)

    def test_toggle_complete_switches_between_done_and_todo(self):
        task = self.make_task(self.user)
        toggle = f"{self.url}{task.id}/toggle-complete/"

        response = self.client.patch(toggle)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["status"], "done")
        self.assertIsNotNone(response.data["completed_at"])

        response = self.client.patch(toggle)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["status"], "todo")
        self.assertIsNone(response.data["completed_at"])

    def test_toggle_from_in_progress_goes_to_done(self):
        task = self.make_task(self.user, status="in_progress")
        response = self.client.patch(f"{self.url}{task.id}/toggle-complete/")
        self.assertEqual(response.data["status"], "done")

    def test_toggle_only_allows_patch(self):
        task = self.make_task(self.user)
        self.assertEqual(self.client.get(f"{self.url}{task.id}/toggle-complete/").status_code, 405)
