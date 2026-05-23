import asyncio
import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import rag_runtime


class RagRuntimeTests(unittest.TestCase):
    def tearDown(self) -> None:
        rag_runtime._rag_workflow = None

    def test_default_data_dir_is_independent_of_cwd(self) -> None:
        ingested_dirs: list[str] = []

        class FakeWorkflow:
            async def ingest_documents(self, directory: str) -> None:
                ingested_dirs.append(directory)

        previous_cwd = os.getcwd()
        with tempfile.TemporaryDirectory() as tempdir:
            os.chdir(tempdir)
            try:
                with patch.object(rag_runtime, "RAGWorkflow", FakeWorkflow):
                    workflow = asyncio.run(rag_runtime.ensure_rag_ready())
            finally:
                os.chdir(previous_cwd)

        expected = Path(rag_runtime.__file__).resolve().parent / "data"
        self.assertIsInstance(workflow, FakeWorkflow)
        self.assertEqual(ingested_dirs, [str(expected)])


if __name__ == "__main__":
    unittest.main()
