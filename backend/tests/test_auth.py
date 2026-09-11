import unittest
from fastapi.testclient import TestClient
from backend.main import app
from backend.database_auth import SessionLocal
from backend.auth.models import User

class TestAuthEndpoints(unittest.TestCase):
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

if __name__ == '__main__':
    unittest.main()
