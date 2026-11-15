from datetime import timedelta

from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.test import APITestCase
from rest_framework_simplejwt.tokens import RefreshToken

from tasks.models import Category, Task

User = get_user_model()

PASSWORD = "StrongPass123!"


class APIBase(APITestCase):
    """Shared helpers for API tests."""

    password = PASSWORD

    def make_user(self, email="alice@example.com", first_name="Alice", last_name="Tester"):
        return User.objects.create_user(
            email=email, password=self.password, first_name=first_name, last_name=last_name
        )

    def authenticate(self, user):
        token = RefreshToken.for_user(user).access_token
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")

    def logout_client(self):
        self.client.credentials()

    def make_category(self, user, name="Work", color="#3b82f6"):
        return Category.objects.create(user=user, name=name, color=color)

    def make_task(self, user, title="Sample task", **kwargs):
        return Task.objects.create(user=user, title=title, **kwargs)

    @staticmethod
    def today():
        return timezone.localdate()

    def day(self, offset):
        return self.today() + timedelta(days=offset)

    def iso(self, offset):
        return self.day(offset).isoformat()

    @staticmethod
    def titles(response):
        return [item["title"] for item in response.data["results"]]
