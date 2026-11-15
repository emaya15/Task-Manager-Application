from .base import APIBase


class DashboardTests(APIBase):
    url = "/api/tasks/dashboard/"

    def setUp(self):
        self.user = self.make_user()
        self.authenticate(self.user)

    def test_requires_authentication(self):
        self.logout_client()
        self.assertEqual(self.client.get(self.url).status_code, 401)

    def test_empty_dashboard(self):
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, 200)
        data = response.data
        self.assertEqual(data["total"], 0)
        self.assertEqual(data["completion_percentage"], 0)
        self.assertEqual(data["overdue"], 0)
        self.assertEqual(data["due_today"], 0)
        self.assertEqual(data["category_stats"], [])
        self.assertEqual(data["due_today_tasks"], [])
        self.assertEqual(data["overdue_tasks"], [])

    def build_fixture(self):
        work = self.make_category(self.user, "Work")
        home = self.make_category(self.user, "Home")
        self.make_category(self.user, "Empty")
        self.make_task(self.user, "Overdue todo", status="todo", due_date=self.day(-3), category=work)
        self.make_task(self.user, "Doing today", status="in_progress", due_date=self.day(0), category=work)
        self.make_task(self.user, "Finished late", status="done", due_date=self.day(-2), category=home)
        self.make_task(self.user, "Finished today", status="done", due_date=self.day(0), category=home)
        self.make_task(self.user, "Backlog item", status="todo")
        self.make_task(self.user, "Future todo", status="todo", due_date=self.day(7), category=home)

    def test_counts_and_completion_percentage(self):
        self.build_fixture()
        data = self.client.get(self.url).data
        self.assertEqual(data["total"], 6)
        self.assertEqual(data["todo"], 3)
        self.assertEqual(data["in_progress"], 1)
        self.assertEqual(data["done"], 2)
        self.assertEqual(data["completion_percentage"], 33.3)

    def test_overdue_means_past_due_and_not_done(self):
        self.build_fixture()
        data = self.client.get(self.url).data
        self.assertEqual(data["overdue"], 1)
        self.assertEqual([t["title"] for t in data["overdue_tasks"]], ["Overdue todo"])
        self.assertTrue(data["overdue_tasks"][0]["is_overdue"])

    def test_due_today_excludes_finished_tasks(self):
        self.build_fixture()
        data = self.client.get(self.url).data
        self.assertEqual(data["due_today"], 1)
        self.assertEqual([t["title"] for t in data["due_today_tasks"]], ["Doing today"])

    def test_category_statistics(self):
        self.build_fixture()
        stats = {row["name"]: row for row in self.client.get(self.url).data["category_stats"]}
        self.assertEqual(stats["Work"]["count"], 2)
        self.assertEqual(stats["Home"]["count"], 3)
        self.assertEqual(stats["Home"]["completed"], 2)
        self.assertEqual(stats["Empty"]["count"], 0)
        self.assertEqual(stats["Uncategorized"]["count"], 1)
        self.assertIsNone(stats["Uncategorized"]["id"])

    def test_dashboard_ignores_other_users_data(self):
        other = self.make_user(email="other@example.com")
        self.make_task(other, "Not mine", status="done", due_date=self.day(-1))
        self.make_task(other, "Also not mine", due_date=self.day(0))
        self.make_category(other, "Other category")
        self.make_task(self.user, "Mine", status="todo")
        data = self.client.get(self.url).data
        self.assertEqual(data["total"], 1)
        self.assertEqual(data["done"], 0)
        self.assertEqual(data["overdue"], 0)
        self.assertEqual([row["name"] for row in data["category_stats"]], ["Uncategorized"])

    def test_all_done_is_one_hundred_percent(self):
        self.make_task(self.user, "Done A", status="done")
        self.make_task(self.user, "Done B", status="done")
        self.assertEqual(self.client.get(self.url).data["completion_percentage"], 100.0)

    def test_dashboard_route_is_not_treated_as_task_id(self):
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, 200)
        self.assertIn("total", response.data)
