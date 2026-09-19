import unittest
from unittest.mock import AsyncMock, patch
from fastapi.testclient import TestClient
from backend.main import app
from backend.database_auth import SessionLocal
from backend.auth.models import User

class TestAuthEndpoints(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.patchers = [
            patch("backend.main.db_pool.connect", new_callable=AsyncMock),
            patch("backend.main.dashboard_pool.connect", new_callable=AsyncMock),
            patch("backend.scheduler.background_scheduler", new_callable=AsyncMock),
            patch("backend.treatment_service.init_treatment_table", new_callable=AsyncMock),
        ]
        for p in cls.patchers:
            p.start()

    @classmethod
    def tearDownClass(cls):
        for p in cls.patchers:
            p.stop()

    def setUp(self):
        self.client_ctx = TestClient(app)
        self.client = self.client_ctx.__enter__()
        self.db = SessionLocal()
        # Clean up any test users
        self.db.query(User).filter(User.username.like("test_%")).delete(synchronize_session=False)
        self.db.commit()

    def tearDown(self):
        self.db.query(User).filter(User.username.like("test_%")).delete(synchronize_session=False)
        self.db.commit()
        self.db.close()
        self.client_ctx.__exit__(None, None, None)

    def test_register_and_login_flow(self):
        # 1. Register new nurse
        reg_payload = {
            "firstname": "สมศรี",
            "lastname": "ใจดี",
            "role": "nurse",
            "username": "test_nurse_01",
            "password": "Password123"
        }
        reg_res = self.client.post("/auth/register", json=reg_payload)
        self.assertEqual(reg_res.status_code, 201, reg_res.text)
        user_data = reg_res.json()
        self.assertEqual(user_data["username"], "test_nurse_01")
        self.assertEqual(user_data["role"], "nurse")

        # 2. Login with correct credentials
        login_payload = {
            "username": "test_nurse_01",
            "password": "Password123"
        }
        login_res = self.client.post("/auth/login", json=login_payload)
        self.assertEqual(login_res.status_code, 200)
        token_data = login_res.json()
        self.assertIn("access_token", token_data)
        token = token_data["access_token"]

        # 3. Access /auth/me with Bearer token
        me_res = self.client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})
        self.assertEqual(me_res.status_code, 200)
        self.assertEqual(me_res.json()["username"], "test_nurse_01")

        # 4. Login with wrong password should fail (401)
        bad_login = self.client.post("/auth/login", json={"username": "test_nurse_01", "password": "WrongPassword"})
        self.assertEqual(bad_login.status_code, 401)

    def test_it_admin_role_protection(self):
        # Register regular nurse
        self.client.post("/auth/register", json={
            "firstname": "Nurse",
            "lastname": "One",
            "role": "nurse",
            "username": "test_nurse_role",
            "password": "Password123"
        })
        nurse_tok = self.client.post("/auth/login", json={"username": "test_nurse_role", "password": "Password123"}).json()["access_token"]

        # Nurse attempts to list users -> 403 Forbidden
        nurse_res = self.client.get("/auth/users", headers={"Authorization": f"Bearer {nurse_tok}"})
        self.assertEqual(nurse_res.status_code, 403)

        # Register IT Admin
        self.client.post("/auth/register", json={
            "firstname": "Admin",
            "lastname": "Super",
            "role": "it_admin",
            "username": "test_admin_role",
            "password": "AdminPassword123"
        })
        admin_tok = self.client.post("/auth/login", json={"username": "test_admin_role", "password": "AdminPassword123"}).json()["access_token"]

        # Admin lists users -> 200 OK
        admin_res = self.client.get("/auth/users", headers={"Authorization": f"Bearer {admin_tok}"})
        self.assertEqual(admin_res.status_code, 200)
        self.assertIsInstance(admin_res.json(), list)

    def test_admin_reset_password(self):
        # Register nurse
        reg_res = self.client.post("/auth/register", json={
            "firstname": "Nurse",
            "lastname": "Reset",
            "role": "nurse",
            "username": "test_nurse_reset",
            "password": "OldPassword123"
        })
        nurse_id = reg_res.json()["id"]

        # Register admin
        self.client.post("/auth/register", json={
            "firstname": "Admin",
            "lastname": "Reset",
            "role": "it_admin",
            "username": "test_admin_reset",
            "password": "AdminPassword123"
        })
        admin_tok = self.client.post("/auth/login", json={"username": "test_admin_reset", "password": "AdminPassword123"}).json()["access_token"]

        # 1. Reset password with short password (< 6 chars) -> 422
        bad_reset = self.client.put(
            f"/auth/users/{nurse_id}/reset-password",
            json={"password": "123"},
            headers={"Authorization": f"Bearer {admin_tok}"}
        )
        self.assertEqual(bad_reset.status_code, 422)

        # 2. Reset password successfully
        reset_res = self.client.put(
            f"/auth/users/{nurse_id}/reset-password",
            json={"password": "NewSecurePassword456!"},
            headers={"Authorization": f"Bearer {admin_tok}"}
        )
        self.assertEqual(reset_res.status_code, 200)

        # 3. Old password fails
        old_login = self.client.post("/auth/login", json={"username": "test_nurse_reset", "password": "OldPassword123"})
        self.assertEqual(old_login.status_code, 401)

        # 4. New password succeeds
        new_login = self.client.post("/auth/login", json={"username": "test_nurse_reset", "password": "NewSecurePassword456!"})
        self.assertEqual(new_login.status_code, 200)

    def test_admin_delete_user(self):
        # Register nurse
        nurse_res = self.client.post("/auth/register", json={
            "firstname": "Nurse",
            "lastname": "Del",
            "role": "nurse",
            "username": "test_nurse_del",
            "password": "Password123"
        })
        nurse_id = nurse_res.json()["id"]

        # Register admin
        admin_res = self.client.post("/auth/register", json={
            "firstname": "Admin",
            "lastname": "Del",
            "role": "it_admin",
            "username": "test_admin_del",
            "password": "AdminPassword123"
        })
        admin_id = admin_res.json()["id"]
        admin_tok = self.client.post("/auth/login", json={"username": "test_admin_del", "password": "AdminPassword123"}).json()["access_token"]

        # 1. Admin attempts to delete self -> 400
        self_del = self.client.delete(f"/auth/users/{admin_id}", headers={"Authorization": f"Bearer {admin_tok}"})
        self.assertEqual(self_del.status_code, 400)
        self.assertIn("ไม่สามารถลบบัญชีตัวเองได้", self_del.json()["detail"])

        # 2. Admin deletes nurse -> 200
        del_res = self.client.delete(f"/auth/users/{nurse_id}", headers={"Authorization": f"Bearer {admin_tok}"})
        self.assertEqual(del_res.status_code, 200)
        self.assertEqual(del_res.json()["user_id"], nurse_id)

        # 3. Deleted nurse cannot login -> 401
        login_res = self.client.post("/auth/login", json={"username": "test_nurse_del", "password": "Password123"})
        self.assertEqual(login_res.status_code, 401)


if __name__ == '__main__':
    unittest.main()
