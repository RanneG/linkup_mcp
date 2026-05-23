import asyncio
import os
import sys
import tempfile
import types
import unittest
from pathlib import Path

_rag_stub = types.ModuleType("rag")


class FakeWorkflow:
    ingested_dirs: list[str] = []

    async def ingest_documents(self, directory: str) -> None:
        self.ingested_dirs.append(directory)


_rag_stub.RAGWorkflow = FakeWorkflow
sys.modules.setdefault("rag", _rag_stub)

import rag_runtime  # noqa: E402  (import after stubbing heavyweight rag module)


class RagRuntimeTests(unittest.TestCase):
    def tearDown(self) -> None:
        rag_runtime._rag_workflow = None
        FakeWorkflow.ingested_dirs.clear()

    def test_default_data_dir_is_independent_of_cwd(self) -> None:
        previous_cwd = os.getcwd()
        with tempfile.TemporaryDirectory() as tempdir:
            os.chdir(tempdir)
            try:
                workflow = asyncio.run(rag_runtime.ensure_rag_ready())
            finally:
                os.chdir(previous_cwd)

        expected = Path(rag_runtime.__file__).resolve().parent / "data"
        self.assertIsInstance(workflow, FakeWorkflow)
        self.assertEqual(FakeWorkflow.ingested_dirs, [str(expected)])


if __name__ == "__main__":
    unittest.main()
