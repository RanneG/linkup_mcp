import asyncio
import importlib
import sys
import types
import unittest


class FailingThenSuccessfulWorkflow:
    instances: list["FailingThenSuccessfulWorkflow"] = []

    def __init__(self) -> None:
        self.ready = False
        FailingThenSuccessfulWorkflow.instances.append(self)

    async def ingest_documents(self, directory: str) -> None:
        if len(FailingThenSuccessfulWorkflow.instances) == 1:
            raise RuntimeError("temporary ingest failure")
        self.ready = True


class RagRuntimeRecoveryTests(unittest.TestCase):
    def setUp(self) -> None:
        self._previous_modules = {
            "rag": sys.modules.get("rag"),
            "rag_runtime": sys.modules.get("rag_runtime"),
        }
        FailingThenSuccessfulWorkflow.instances.clear()

    def tearDown(self) -> None:
        for name, module in self._previous_modules.items():
            if module is None:
                sys.modules.pop(name, None)
            else:
                sys.modules[name] = module

    def _import_runtime_with_stub(self):
        rag_stub = types.ModuleType("rag")
        rag_stub.RAGWorkflow = FailingThenSuccessfulWorkflow
        sys.modules["rag"] = rag_stub
        sys.modules.pop("rag_runtime", None)
        return importlib.import_module("rag_runtime")

    def test_failed_ingest_does_not_poison_future_rag_queries(self) -> None:
        rag_runtime = self._import_runtime_with_stub()

        with self.assertRaisesRegex(RuntimeError, "temporary ingest failure"):
            asyncio.run(rag_runtime.ensure_rag_ready())

        self.assertIsNone(rag_runtime._rag_workflow)

        workflow = asyncio.run(rag_runtime.ensure_rag_ready())

        self.assertIs(workflow, FailingThenSuccessfulWorkflow.instances[1])
        self.assertTrue(workflow.ready)
        self.assertIs(rag_runtime._rag_workflow, workflow)


if __name__ == "__main__":
    unittest.main()
