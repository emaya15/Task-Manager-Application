from datetime import timedelta

from django.conf import settings
from django.contrib.auth import get_user_model
from django.urls import reverse

from .base import PASSWORD, APIBase

User = get_user_model()


class RegistrationTests(APIBase):
    url = "/api/auth/register/"

    def payload(self, **overrides):
        data = {
            "first_name": "Bob",
            "last_name": "Builder",
            "email": "bob@example.com",
            "password": PASSWORD,
            "password_confirm": PASSWORD,
        }
        data.update(overrides)
        return data

    def test_register_success(self):
        response = self.client.post(self.url, self.payload(), format="json")
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["email"], "bob@example.com")
        self.assertNotIn("password", response.data)
        self.assertNotIn("password_confirm", response.data)
        self.assertTrue(User.objects.filter(email="bob@example.com").exists())

    def test_password_is_hashed(self):
        self.client.post(self.url, self.payload(), format="json")
        user = User.objects.get(email="bob@example.com")
        self.assertNotEqual(user.password, PASSWORD)
        self.assertTrue(user.password.startswith(("pbkdf2_", "argon2", "bcrypt")))
        self.assertTrue(user.check_password(PASSWORD))

    def test_email_is_lowercased(self):
        response = self.client.post(self.url, self.payload(email="Bob@Example.COM"), format="json")
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["email"], "bob@example.com")

    def test_duplicate_email_rejected_case_insensitively(self):
        self.make_user(email="bob@example.com")
        response = self.client.post(self.url, self.payload(email="BOB@example.com"), format="json")
        self.assertEqual(response.status_code, 400)
        self.assertIn("email", response.data["errors"])

    def test_password_too_short(self):
        response = self.client.post(
            self.url, self.payload(password="Ab1!", password_confirm="Ab1!"), format="json"
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn("password", response.data["errors"])

    def test_password_confirmation_must_match(self):
        response = self.client.post(
            self.url, self.payload(password_confirm="Different123!"), format="json"
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn("password_confirm", response.data["errors"])

    def test_required_fields(self):
        response = self.client.post(self.url, {}, format="json")
        self.assertEqual(response.status_code, 400)
        for field in ("first_name", "last_name", "email", "password", "password_confirm"):
            self.assertIn(field, response.data["errors"])

    def test_invalid_email(self):
        response = self.client.post(self.url, self.payload(email="not-an-email"), format="json")
        self.assertEqual(response.status_code, 400)
        self.assertIn("email", response.data["errors"])


class LoginAndTokenTests(APIBase):
    def setUp(self):
        self.user = self.make_user()

    def test_jwt_lifetimes_match_requirements(self):
        self.assertEqual(settings.SIMPLE_JWT["ACCESS_TOKEN_LIFETIME"], timedelta(minutes=30))
        self.assertEqual(settings.SIMPLE_JWT["REFRESH_TOKEN_LIFETIME"], timedelta(days=1))

    def test_login_success(self):
        response = self.client.post(
            "/api/auth/login/",
            {"email": "alice@example.com", "password": PASSWORD},
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        self.assertIn("access", response.data)
        self.assertIn("refresh", response.data)
        self.assertEqual(response.data["user"]["email"], "alice@example.com")
        self.assertNotIn("password", response.data["user"])

    def test_login_email_is_case_insensitive(self):
        response = self.client.post(
            "/api/auth/login/",
            {"email": "ALICE@Example.com", "password": PASSWORD},
            format="json",
        )
        self.assertEqual(response.status_code, 200)

    def test_login_wrong_password(self):
        response = self.client.post(
            "/api/auth/login/",
            {"email": "alice@example.com", "password": "wrong-password"},
            format="json",
        )
        self.assertEqual(response.status_code, 401)

    def test_login_unknown_user(self):
        response = self.client.post(
            "/api/auth/login/",
            {"email": "nobody@example.com", "password": PASSWORD},
            format="json",
        )
        self.assertEqual(response.status_code, 401)

    def test_login_missing_fields(self):
        response = self.client.post("/api/auth/login/", {}, format="json")
        self.assertEqual(response.status_code, 400)

    def _login(self):
        return self.client.post(
            "/api/auth/login/",
            {"email": "alice@example.com", "password": PASSWORD},
            format="json",
        ).data

    def test_me_requires_authentication(self):
        response = self.client.get("/api/auth/me/")
        self.assertEqual(response.status_code, 401)

    def test_me_with_access_token(self):
        tokens = self._login()
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {tokens['access']}")
        response = self.client.get("/api/auth/me/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["email"], "alice@example.com")
        self.assertEqual(response.data["first_name"], "Alice")
        self.assertNotIn("password", response.data)

    def test_me_rejects_garbage_token(self):
        self.client.credentials(HTTP_AUTHORIZATION="Bearer not-a-real-token")
        self.assertEqual(self.client.get("/api/auth/me/").status_code, 401)

    def test_me_update_name(self):
        self.authenticate(self.user)
        response = self.client.put(
            "/api/auth/me/",
            {"first_name": "Alicia", "last_name": "Updated", "email": "hacker@example.com"},
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        self.user.refresh_from_db()
        self.assertEqual(self.user.first_name, "Alicia")
        self.assertEqual(self.user.email, "alice@example.com")  # email is read-only

    def test_token_refresh(self):
        tokens = self._login()
        response = self.client.post(
            "/api/auth/token/refresh/", {"refresh": tokens["refresh"]}, format="json"
        )
        self.assertEqual(response.status_code, 200)
        self.assertIn("access", response.data)
        # Refresh token rotation: a new refresh token is issued as well.
        self.assertIn("refresh", response.data)

    def test_rotated_refresh_token_cannot_be_reused(self):
        tokens = self._login()
        first = self.client.post(
            "/api/auth/token/refresh/", {"refresh": tokens["refresh"]}, format="json"
        )
        self.assertEqual(first.status_code, 200)
        reused = self.client.post(
            "/api/auth/token/refresh/", {"refresh": tokens["refresh"]}, format="json"
        )
        self.assertEqual(reused.status_code, 401)

    def test_token_refresh_with_invalid_token(self):
        response = self.client.post(
            "/api/auth/token/refresh/", {"refresh": "invalid"}, format="json"
        )
        self.assertEqual(response.status_code, 401)

    def test_logout_blacklists_refresh_token(self):
        tokens = self._login()
        response = self.client.post(
            "/api/auth/logout/", {"refresh": tokens["refresh"]}, format="json"
        )
        self.assertEqual(response.status_code, 200)
        after = self.client.post(
            "/api/auth/token/refresh/", {"refresh": tokens["refresh"]}, format="json"
        )
        self.assertEqual(after.status_code, 401)

    def test_logout_requires_refresh_token(self):
        response = self.client.post("/api/auth/logout/", {}, format="json")
        self.assertEqual(response.status_code, 400)

    def test_logout_with_invalid_token(self):
        response = self.client.post("/api/auth/logout/", {"refresh": "junk"}, format="json")
        self.assertEqual(response.status_code, 400)


class ChangePasswordTests(APIBase):
    url = "/api/auth/change-password/"

    def setUp(self):
        self.user = self.make_user()
        self.authenticate(self.user)

    def payload(self, **overrides):
        data = {
            "old_password": PASSWORD,
            "new_password": "BrandNewPass456!",
            "new_password_confirm": "BrandNewPass456!",
        }
        data.update(overrides)
        return data

    def test_requires_authentication(self):
        self.logout_client()
        self.assertEqual(self.client.put(self.url, self.payload(), format="json").status_code, 401)

    def test_change_password_success(self):
        response = self.client.put(self.url, self.payload(), format="json")
        self.assertEqual(response.status_code, 200)
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password("BrandNewPass456!"))
        self.assertFalse(self.user.check_password(PASSWORD))

        self.logout_client()
        login = self.client.post(
            "/api/auth/login/",
            {"email": "alice@example.com", "password": "BrandNewPass456!"},
            format="json",
        )
        self.assertEqual(login.status_code, 200)

    def test_wrong_old_password(self):
        response = self.client.put(self.url, self.payload(old_password="nope-nope"), format="json")
        self.assertEqual(response.status_code, 400)
        self.assertIn("old_password", response.data["errors"])

    def test_confirmation_mismatch(self):
        response = self.client.put(
            self.url, self.payload(new_password_confirm="Mismatch123!"), format="json"
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn("new_password_confirm", response.data["errors"])

    def test_new_password_too_short(self):
        response = self.client.put(
            self.url, self.payload(new_password="Ab1!", new_password_confirm="Ab1!"), format="json"
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn("new_password", response.data["errors"])

    def test_new_password_must_differ(self):
        response = self.client.put(
            self.url,
            self.payload(new_password=PASSWORD, new_password_confirm=PASSWORD),
            format="json",
        )
        self.assertEqual(response.status_code, 400)

    def test_url_names_resolve(self):
        self.assertEqual(reverse("auth-change-password"), self.url)
