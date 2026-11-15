from .base import APIBase


class TaskListQueryTests(APIBase):
    url = "/api/tasks/"

    def setUp(self):
        self.user = self.make_user()
        self.authenticate(self.user)

    # --- filters -----------------------------------------------------------
    def test_filter_by_status(self):
        self.make_task(self.user, "Todo one", status="todo")
        self.make_task(self.user, "Doing one", status="in_progress")
        self.make_task(self.user, "Done one", status="done")
        response = self.client.get(self.url, {"status": "in_progress"})
        self.assertEqual(self.titles(response), ["Doing one"])

    def test_filter_by_priority(self):
        self.make_task(self.user, "Low one", priority="low")
        self.make_task(self.user, "High one", priority="high")
        response = self.client.get(self.url, {"priority": "high"})
        self.assertEqual(self.titles(response), ["High one"])

    def test_filter_by_category(self):
        work = self.make_category(self.user, "Work")
        home = self.make_category(self.user, "Home")
        self.make_task(self.user, "Work task", category=work)
        self.make_task(self.user, "Home task", category=home)
        self.make_task(self.user, "Loose task")
        response = self.client.get(self.url, {"category": work.id})
        self.assertEqual(self.titles(response), ["Work task"])

    def test_filter_due_today(self):
        self.make_task(self.user, "Due today", due_date=self.day(0))
        self.make_task(self.user, "Done today", due_date=self.day(0), status="done")
        self.make_task(self.user, "Due later", due_date=self.day(2))
        self.make_task(self.user, "Overdue", due_date=self.day(-1))
        response = self.client.get(self.url, {"due": "today"})
        self.assertEqual(self.titles(response), ["Due today"])

    def test_filter_due_overdue_excludes_done_tasks(self):
        self.make_task(self.user, "Overdue open", due_date=self.day(-3))
        self.make_task(self.user, "Overdue done", due_date=self.day(-3), status="done")
        self.make_task(self.user, "Due today", due_date=self.day(0))
        response = self.client.get(self.url, {"due": "overdue"})
        self.assertEqual(self.titles(response), ["Overdue open"])

    def test_filter_due_upcoming(self):
        self.make_task(self.user, "Tomorrow", due_date=self.day(1))
        self.make_task(self.user, "Next month", due_date=self.day(30))
        self.make_task(self.user, "Today", due_date=self.day(0))
        self.make_task(self.user, "No date")
        response = self.client.get(self.url, {"due": "upcoming"})
        self.assertCountEqual(self.titles(response), ["Tomorrow", "Next month"])

    def test_invalid_filter_values_return_400(self):
        self.assertEqual(self.client.get(self.url, {"status": "bogus"}).status_code, 400)
        self.assertEqual(self.client.get(self.url, {"due": "someday"}).status_code, 400)

    def test_combined_filters(self):
        self.make_task(self.user, "Match", status="todo", priority="high")
        self.make_task(self.user, "Wrong status", status="done", priority="high")
        self.make_task(self.user, "Wrong priority", status="todo", priority="low")
        response = self.client.get(self.url, {"status": "todo", "priority": "high"})
        self.assertEqual(self.titles(response), ["Match"])

    # --- search ------------------------------------------------------------
    def test_search_in_title_and_description_case_insensitive(self):
        self.make_task(self.user, "Buy GROCERIES")
        self.make_task(self.user, "Plan trip", description="remember groceries too")
        self.make_task(self.user, "Unrelated")
        response = self.client.get(self.url, {"search": "groceries"})
        self.assertCountEqual(self.titles(response), ["Buy GROCERIES", "Plan trip"])

    def test_search_does_not_leak_other_users_tasks(self):
        other = self.make_user(email="other@example.com")
        self.make_task(other, "Groceries for other")
        self.make_task(self.user, "Groceries for me")
        response = self.client.get(self.url, {"search": "groceries"})
        self.assertEqual(self.titles(response), ["Groceries for me"])

    def test_search_with_sql_metacharacters_is_safe(self):
        self.make_task(self.user, "Normal task")
        response = self.client.get(self.url, {"search": "' OR 1=1; DROP TABLE tasks_task; --"})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["count"], 0)

    # --- ordering ----------------------------------------------------------
    def test_order_by_due_date_asc_and_desc_with_empty_dates_last(self):
        self.make_task(self.user, "Later", due_date=self.day(9))
        self.make_task(self.user, "Sooner", due_date=self.day(2))
        self.make_task(self.user, "No date")
        asc = self.client.get(self.url, {"ordering": "due_date"})
        self.assertEqual(self.titles(asc), ["Sooner", "Later", "No date"])
        desc = self.client.get(self.url, {"ordering": "-due_date"})
        self.assertEqual(self.titles(desc), ["Later", "Sooner", "No date"])

    def test_order_by_priority_uses_importance_not_alphabet(self):
        self.make_task(self.user, "High task", priority="high")
        self.make_task(self.user, "Low task", priority="low")
        self.make_task(self.user, "Medium task", priority="medium")
        asc = self.client.get(self.url, {"ordering": "priority"})
        self.assertEqual(self.titles(asc), ["Low task", "Medium task", "High task"])
        desc = self.client.get(self.url, {"ordering": "-priority"})
        self.assertEqual(self.titles(desc), ["High task", "Medium task", "Low task"])

    def test_order_by_created_at(self):
        first = self.make_task(self.user, "First created")
        second = self.make_task(self.user, "Second created")
        third = self.make_task(self.user, "Third created")
        asc = self.client.get(self.url, {"ordering": "created_at"})
        self.assertEqual([t["id"] for t in asc.data["results"]], [first.id, second.id, third.id])
        desc = self.client.get(self.url, {"ordering": "-created_at"})
        self.assertEqual([t["id"] for t in desc.data["results"]], [third.id, second.id, first.id])

    def test_default_order_is_newest_first(self):
        first = self.make_task(self.user, "Older task")
        second = self.make_task(self.user, "Newer task")
        response = self.client.get(self.url)
        self.assertEqual([t["id"] for t in response.data["results"]], [second.id, first.id])

    def test_unknown_ordering_field_is_ignored(self):
        self.make_task(self.user, "Only task")
        response = self.client.get(self.url, {"ordering": "user__password"})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["count"], 1)


class PaginationTests(APIBase):
    url = "/api/tasks/"

    def setUp(self):
        self.user = self.make_user()
        self.authenticate(self.user)
        for index in range(25):
            self.make_task(self.user, f"Task number {index:02d}")

    def test_default_page_size_is_ten_with_expected_shape(self):
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(set(response.data), {"count", "next", "previous", "results"})
        self.assertEqual(response.data["count"], 25)
        self.assertEqual(len(response.data["results"]), 10)
        self.assertIsNotNone(response.data["next"])
        self.assertIsNone(response.data["previous"])

    def test_middle_and_last_pages(self):
        second = self.client.get(self.url, {"page": 2})
        self.assertEqual(len(second.data["results"]), 10)
        self.assertIsNotNone(second.data["previous"])
        self.assertIsNotNone(second.data["next"])
        third = self.client.get(self.url, {"page": 3})
        self.assertEqual(len(third.data["results"]), 5)
        self.assertIsNone(third.data["next"])

    def test_pages_do_not_overlap(self):
        ids = []
        for page in (1, 2, 3):
            ids += [t["id"] for t in self.client.get(self.url, {"page": page}).data["results"]]
        self.assertEqual(len(ids), len(set(ids)))
        self.assertEqual(len(ids), 25)

    def test_out_of_range_page_returns_404(self):
        self.assertEqual(self.client.get(self.url, {"page": 4}).status_code, 404)

    def test_pagination_keeps_filters(self):
        for index in range(12):
            self.make_task(self.user, f"Urgent task {index:02d}", priority="high")
        first = self.client.get(self.url, {"priority": "high"})
        self.assertEqual(first.data["count"], 12)
        self.assertEqual(len(first.data["results"]), 10)
        second = self.client.get(self.url, {"priority": "high", "page": 2})
        self.assertEqual(len(second.data["results"]), 2)

    def test_page_size_param_allows_larger_pages(self):
        response = self.client.get(self.url, {"page_size": 100})
        self.assertEqual(len(response.data["results"]), 25)
