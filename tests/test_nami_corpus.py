from nami_corpus.sync import sync_corpus


def test_sync_corpus_creates_files():
    stats = sync_corpus()
    assert stats["missing"] == 0
    assert stats["copied"] + stats["skipped"] >= 10
