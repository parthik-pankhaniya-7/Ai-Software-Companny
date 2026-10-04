"""Vector storage and semantic search using ChromaDB.

Provides persistent vector embeddings and similarity queries for project artifacts,
memory, and documents.
"""

import os
from pathlib import Path
import re
from typing import Any

try:
    import chromadb
    from chromadb.utils.embedding_functions import DefaultEmbeddingFunction
    HAS_CHROMADB = True
except ImportError:
    chromadb = None  # type: ignore
    DefaultEmbeddingFunction = None  # type: ignore
    HAS_CHROMADB = False


def _get_chroma_dir() -> Path:
    """Return the chroma persistence directory under DATA_DIR."""
    data_dir_env = os.environ.get("DATA_DIR", "./data")
    chroma_dir = Path(data_dir_env).resolve() / "chroma"
    chroma_dir.mkdir(parents=True, exist_ok=True)
    return chroma_dir


def _get_client() -> Any:
    """Initialize and return a PersistentClient for ChromaDB."""
    if not HAS_CHROMADB or chromadb is None:
        raise ImportError(
            "chromadb is required for vector operations. Install chromadb to enable."
        )
    chroma_dir = _get_chroma_dir()
    return chromadb.PersistentClient(path=str(chroma_dir))


def _get_embedding_function() -> Any:
    """Return the default ChromaDB embedding function."""
    if not HAS_CHROMADB or DefaultEmbeddingFunction is None:
        raise ImportError(
            "chromadb is required for vector operations. Install chromadb to enable."
        )
    return DefaultEmbeddingFunction()


def _sanitize_collection_name(project_id: str) -> str:
    """Ensure collection name meets Chroma naming constraints (3-63 chars, alphanumeric/dash/underscore)."""
    clean_id = re.sub(r"[^a-zA-Z0-9_-]", "_", project_id)
    name = f"proj_{clean_id}"
    if len(name) > 63:
        name = name[:63]
    return name


def _get_collection(client: Any, project_id: str) -> Any:
    """Get or create collection for a given project."""
    coll_name = _sanitize_collection_name(project_id)
    ef = _get_embedding_function()
    return client.get_or_create_collection(name=coll_name, embedding_function=ef)


def index(project_id: str, ref_id: str, text: str, kind: str = "doc") -> None:
    """Upsert a document into the project's Chroma vector collection."""
    client = _get_client()
    collection = _get_collection(client, project_id)
    collection.upsert(
        ids=[ref_id],
        documents=[text],
        metadatas=[{"kind": kind, "ref_id": ref_id}],
    )


def search(project_id: str, query: str, k: int = 5) -> list[dict]:
    """Search for relevant documents in the project's vector collection."""
    client = _get_client()
    collection = _get_collection(client, project_id)
    count = collection.count()
    if count == 0:
        return []

    n_results = min(k, count)
    results = collection.query(query_texts=[query], n_results=n_results)

    hits: list[dict] = []
    ids = results.get("ids", [[]])[0] if results.get("ids") else []
    docs = results.get("documents", [[]])[0] if results.get("documents") else []
    metas = results.get("metadatas", [[]])[0] if results.get("metadatas") else []
    distances = (
        results.get("distances", [[]])[0]
        if results.get("distances") and results["distances"]
        else [0.0] * len(ids)
    )

    for i in range(len(ids)):
        ref_id = ids[i]
        content = docs[i] if i < len(docs) else ""
        meta = metas[i] if i < len(metas) and metas[i] else {}
        kind = meta.get("kind", "doc")
        score = float(distances[i]) if i < len(distances) else 0.0
        hits.append({
            "ref_id": ref_id,
            "content": content,
            "kind": kind,
            "score": score,
        })
    return hits
