import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from nami_build.agent_runner import build_prompt, git_branch_name
from nami_build.queue import BuildJob, BuildQueue, JobStatus


class BuildQueueTests(unittest.TestCase):
    def test_enqueue_and_get(self):
        with tempfile.TemporaryDirectory() as tmp:
            q = BuildQueue(root=Path(tmp))
            job = q.enqueue("Add health route to dev_dashboard", source="test")
            self.assertEqual(len(job.id), 12)
            self.assertEqual(job.status, JobStatus.PENDING)

            loaded = q.get(job.id)
            assert loaded is not None
            self.assertEqual(loaded.task, job.task)

            pending_path = Path(tmp) / "pending" / f"{job.id}.json"
            self.assertTrue(pending_path.is_file())

    def test_move_to_completed(self):
        with tempfile.TemporaryDirectory() as tmp:
            q = BuildQueue(root=Path(tmp))
            job = q.enqueue("test task")
            job.result_summary = "done"
            q.move(job, JobStatus.COMPLETED)
            finished = q.get(job.id)
            assert finished is not None
            self.assertEqual(finished.status, JobStatus.COMPLETED)

    def test_list_recent(self):
        with tempfile.TemporaryDirectory() as tmp:
            q = BuildQueue(root=Path(tmp))
            q.enqueue("one")
            q.enqueue("two")
            jobs = q.list_recent(limit=5)
            self.assertEqual(len(jobs), 2)


class BuildPromptTests(unittest.TestCase):
    def test_prompt_includes_task(self):
        text = build_prompt("Fix pytest in nami_build", turn_cap=5)
        self.assertIn("Fix pytest in nami_build", text)
        self.assertIn("Turn cap: 5", text)

    def test_branch_name(self):
        self.assertTrue(git_branch_name("abcd1234efgh").startswith("nami/build-"))


class BuildHttpTests(unittest.TestCase):
    def setUp(self):
        self._tmpdir = tempfile.TemporaryDirectory()
        self.addCleanup(self._tmpdir.cleanup)
        self.queue_root = Path(self._tmpdir.name)

    @patch.dict("os.environ", {"NAMI_BUILD_TOKEN": "test-secret"}, clear=False)
    def test_enqueue_requires_auth(self):
        from nami_build.http import create_app

        with patch("nami_build.http.BuildQueue", return_value=BuildQueue(root=self.queue_root)):
            app = create_app(start_worker=False)
            client = app.test_client()
            resp = client.post("/api/build/enqueue", json={"task": "hello"})
            self.assertEqual(resp.status_code, 401)

    @patch("nami_build.http._auth_ok", return_value=True)
    def test_enqueue_creates_job(self, _mock_auth):
        from nami_build.http import create_app

        q = BuildQueue(root=self.queue_root)
        with patch("nami_build.http.BuildQueue", return_value=q):
            app = create_app(start_worker=False)
            client = app.test_client()
            resp = client.post(
                "/api/build/enqueue",
                json={"task": "Add route", "source": "telegram"},
                headers={"Authorization": "Bearer test-secret"},
            )
            self.assertEqual(resp.status_code, 201)
            data = resp.get_json()
            self.assertTrue(data["ok"])
            self.assertEqual(data["job"]["task"], "Add route")
            self.assertEqual(len(q.pending_jobs()), 1)


if __name__ == "__main__":
    unittest.main()
