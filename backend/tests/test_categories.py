from tasks.models import Category, Task

from .base import APIBase


class CategoryCrudTests(APIBase):
    url = "/api/categories/"

    def setUp(self):
        self.user = self.make_user()
        self.authenticate(self.user)

    def test_requires_authentication(self):
        self.logout_client()
        self.assertEqual(self.client.get(self.url).status_code, 401)
        self.assertEqual(self.client.post(self.url, {"name": "X"}, format="json").status_code, 401)

    def test_create_category(self):
        response = self.client.post(self.url, {"name": "Work", "color": "#ff0000"}, format="json")
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["name"], "Work")
        self.assertEqual(response.data["color"], "#ff0000")
        self.assertEqual(response.data["user"], self.user.id)
        self.assertEqual(response.data["task_count"], 0)

    def test_create_uses_default_color(self):
        response = self.client.post(self.url, {"name": "Home"}, format="json")
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["color"], "#3b82f6")

    def test_user_in_payload_is_ignored(self):
        other = self.make_user(email="other@example.com")
        response = self.client.post(self.url, {"name": "Work", "user": other.id}, format="json")
        self.assertEqual(response.status_code, 201)
        self.assertEqual(Category.objects.get(pk=response.data["id"]).user, self.user)

    def test_invalid_color_rejected(self):
        response = self.client.post(self.url, {"name": "Bad", "color": "red"}, format="json")
        self.assertEqual(response.status_code, 400)
        self.assertIn("color", response.data["errors"])

    def test_blank_name_rejected(self):
        response = self.client.post(self.url, {"name": "   "}, format="json")
        self.assertEqual(response.status_code, 400)
        self.assertIn("name", response.data["errors"])

    def test_list_returns_only_own_categories_unpaginated(self):
        self.make_category(self.user, "Mine A")
        self.make_category(self.user, "Mine B")
        other = self.make_user(email="other@example.com")
        self.make_category(other, "Theirs")
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, 200)
        self.assertEqual([c["name"] for c in response.data], ["Mine A", "Mine B"])

    def test_list_includes_task_count(self):
        category = self.make_category(self.user, "Work")
        self.make_task(self.user, "Task one", category=category)
        self.make_task(self.user, "Task two", category=category)
        response = self.client.get(self.url)
        self.assertEqual(response.data[0]["task_count"], 2)

    def test_update_category(self):
        category = self.make_category(self.user, "Work")
        response = self.client.put(
            f"{self.url}{category.id}/", {"name": "Office", "color": "#00ff00"}, format="json"
        )
        self.assertEqual(response.status_code, 200)
        category.refresh_from_db()
        self.assertEqual((category.name, category.color), ("Office", "#00ff00"))

    def test_delete_category(self):
        category = self.make_category(self.user, "Work")
        response = self.client.delete(f"{self.url}{category.id}/")
        self.assertEqual(response.status_code, 204)
        self.assertFalse(Category.objects.filter(pk=category.pk).exists())


class CategoryRulesTests(APIBase):
    url = "/api/categories/"

    def setUp(self):
        self.user = self.make_user()
        self.other = self.make_user(email="other@example.com")
        self.authenticate(self.user)

    def test_name_unique_per_user(self):
        self.make_category(self.user, "Work")
        response = self.client.post(self.url, {"name": "Work"}, format="json")
        self.assertEqual(response.status_code, 400)
        self.assertIn("name", response.data["errors"])

    def test_name_uniqueness_ignores_case(self):
        self.make_category(self.user, "Work")
        response = self.client.post(self.url, {"name": "work"}, format="json")
        self.assertEqual(response.status_code, 400)

    def test_same_name_allowed_for_different_users(self):
        self.make_category(self.other, "Work")
        response = self.client.post(self.url, {"name": "Work"}, format="json")
        self.assertEqual(response.status_code, 201)

    def test_rename_to_existing_name_rejected(self):
        self.make_category(self.user, "Work")
        other_category = self.make_category(self.user, "Home")
        response = self.client.put(f"{self.url}{other_category.id}/", {"name": "Work"}, format="json")
        self.assertEqual(response.status_code, 400)

    def test_updating_with_own_name_is_allowed(self):
        category = self.make_category(self.user, "Work")
        response = self.client.put(
            f"{self.url}{category.id}/", {"name": "Work", "color": "#111111"}, format="json"
        )
        self.assertEqual(response.status_code, 200)

    def test_cannot_access_other_users_category(self):
        foreign = self.make_category(self.other, "Secret")
        detail = f"{self.url}{foreign.id}/"
        self.assertEqual(self.client.get(detail).status_code, 404)
        self.assertEqual(self.client.put(detail, {"name": "Hacked"}, format="json").status_code, 404)
        self.assertEqual(self.client.patch(detail, {"name": "Hacked"}, format="json").status_code, 404)
        self.assertEqual(self.client.delete(detail).status_code, 404)
        foreign.refresh_from_db()
        self.assertEqual(foreign.name, "Secret")

    def test_deleting_category_keeps_tasks_with_null_category(self):
        category = self.make_category(self.user, "Work")
        task = self.make_task(self.user, "Keep me", category=category)
        response = self.client.delete(f"{self.url}{category.id}/")
        self.assertEqual(response.status_code, 204)
        task.refresh_from_db()
        self.assertIsNone(task.category)
        self.assertTrue(Task.objects.filter(pk=task.pk).exists())
