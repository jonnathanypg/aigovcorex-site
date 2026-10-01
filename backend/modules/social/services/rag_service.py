"""
Social RAG Service - Vector memory with Pinecone for Social Module
Adapted from early-childhood RAG architecture for Social Programs

Namespace Strategy:
    - All vectors for a License live in namespace "social_license_{license_id}"
    - Metadata includes 'scope' ('global' or 'center') and optional 'tenant_id'

Query Strategy:
    - License Admin: Sees ALL docs in their license namespace
    - Center Staff: Sees 'global' docs + docs matching their tenant_id
"""
import os
import json
import hashlib
import logging
from typing import List, Dict, Optional, Any
from datetime import datetime

logger = logging.getLogger(__name__)

# Global singleton for Pinecone client
_pinecone_client = None


class SocialRAGService:
    """RAG service for vector memory operations with hierarchical multi-tenant isolation"""

    def __init__(self, license_id: int, tenant_id: int = None):
        """
        Args:
            license_id: The license (organization) ID - REQUIRED
            tenant_id: The tenant (center) ID - OPTIONAL (None for admin scope)
        """
        self.license_id = license_id
        self.tenant_id = tenant_id
        self._index = None
        self._llm = None

    @property
    def llm(self):
        """Lazy load LLM interface for embeddings"""
        if not self._llm:
            from agents.llm_interface import get_llm
            self._llm = get_llm()
        return self._llm

    @property
    def namespace(self) -> str:
        """Pinecone namespace for this license"""
        return f"social_license_{self.license_id}"

    # ================================================================
    # Pinecone Connection
    # ================================================================

    def _get_pinecone_client(self):
        """Initialize Pinecone client (singleton)"""
        global _pinecone_client
        if _pinecone_client:
            return _pinecone_client

        try:
            from pinecone import Pinecone

            api_key = os.getenv('PINECONE_API_KEY')
            if not api_key:
                logger.warning("PINECONE_API_KEY not set - RAG disabled")
                return None

            _pinecone_client = Pinecone(api_key=api_key)
            return _pinecone_client
        except ImportError as e:
            logger.error(f"Failed to import pinecone: {e}")
            return None
        except Exception as e:
            logger.error(f"Error initializing Pinecone client: {e}")
            return None

    def _get_index(self):
        """Get Pinecone index"""
        if self._index:
            return self._index

        pc = self._get_pinecone_client()
        if not pc:
            return None

        index_name = os.getenv('PINECONE_INDEX_NAME', 'kindicore-rag')
        host = os.getenv('PINECONE_HOST')

        try:
            if host:
                self._index = pc.Index(index_name, host=host)
            else:
                self._index = pc.Index(index_name)
            return self._index
        except Exception as e:
            logger.error(f"Failed to connect to Pinecone index '{index_name}': {e}")
            return None

    # ================================================================
    # Document Ingestion
    # ================================================================

    def generate_chunk_id(self, content: str, metadata: Dict) -> str:
        """Generate deterministic chunk ID from content + metadata"""
        h = hashlib.md5()
        h.update(content.encode('utf-8'))
        h.update(json.dumps(metadata, sort_keys=True).encode('utf-8'))
        return h.hexdigest()[:16]

    def chunk_text(self, text: str, chunk_size: int = 1000, overlap: int = 200) -> List[str]:
        """Split text into overlapping chunks"""
        if len(text) <= chunk_size:
            return [text]
        chunks = []
        start = 0
        while start < len(text):
            end = min(start + chunk_size, len(text))
            chunk = text[start:end]
            chunks.append(chunk)
            start = end - overlap
            if start >= len(text):
                break
        return chunks

    def create_embeddings(self, texts: List[str]) -> List[List[float]]:
        """Create embeddings for a list of texts"""
        if not self.llm:
            logger.warning("LLM not available - cannot create embeddings")
            return [[] for _ in texts]

        try:
            embeddings = self.llm.embed(texts)
            return embeddings
        except Exception as e:
            logger.error(f"Error creating embeddings: {e}")
            return [[] for _ in texts]

    def index_document(self, content: str, metadata: Dict, scope: str = "global") -> bool:
        """Index a document in Pinecone"""
        index = self._get_index()
        if not index:
            return False

        # Prepare metadata
        doc_metadata = {
            **metadata,
            'scope': scope,
            'tenant_id': self.tenant_id,
            'license_id': self.license_id,
            'indexed_at': datetime.utcnow().isoformat(),
            'content_hash': hashlib.md5(content.encode()).hexdigest()[:16]
        }

        # Chunk the content
        chunks = self.chunk_text(content)
        if not chunks:
            return False

        # Create embeddings
        embeddings = self.create_embeddings(chunks)
        if not embeddings or not embeddings[0]:
            logger.warning("Failed to create embeddings")
            return False

        # Prepare vectors for upsert
        vectors = []
        for i, (chunk, embedding) in enumerate(zip(chunks, embeddings)):
            if not embedding:
                continue
            chunk_metadata = {
                **doc_metadata,
                'chunk_index': i,
                'chunk_total': len(chunks),
                'content': chunk[:1000]  # Store first 1000 chars in metadata for quick preview
            }
            chunk_id = self.generate_chunk_id(chunk, {**metadata, 'chunk_index': i})
            vectors.append({
                'id': chunk_id,
                'values': embedding,
                'metadata': chunk_metadata
            })

        if not vectors:
            return False

        try:
            index.upsert(vectors=vectors, namespace=self.namespace)
            logger.info(f"Indexed document with {len(vectors)} chunks in namespace {self.namespace}")
            return True
        except Exception as e:
            logger.error(f"Error upserting vectors: {e}")
            return False

    def ingest_text(self, content: str, metadata: Dict, scope: str = "global") -> Dict[str, Any]:
        """Ingest plain text into the vector store"""
        success = self.index_document(content, metadata, scope)
        return {
            'success': success,
            'chunks': len(self.chunk_text(content)) if success else 0,
            'namespace': self.namespace
        }

    # ================================================================
    # Query / Retrieval
    # ================================================================

    def query(self, query_text: str, top_k: int = 5, score_threshold: float = 0.7) -> List[Dict]:
        """Query the vector store for relevant documents"""
        index = self._get_index()
        if not index:
            return []

        try:
            query_embedding = self.create_embeddings([query_text])
            if not query_embedding or not query_embedding[0]:
                return []

            # Build filter for tenant isolation
            filter_dict = {}
            if self.tenant_id:
                # Center staff sees: global docs + their center's docs
                filter_dict = {
                    '$or': [
                        {'scope': 'global'},
                        {'tenant_id': self.tenant_id}
                    ]
                }
            else:
                # License admin sees all
                filter_dict = {}

            results = index.query(
                vector=query_embedding[0],
                top_k=top_k,
                namespace=self.namespace,
                filter=filter_dict if filter_dict else None,
                include_metadata=True,
                include_values=False
            )

            matches = []
            for match in results.matches:
                if match.score >= score_threshold:
                    matches.append({
                        'id': match.id,
                        'score': match.score,
                        'metadata': match.metadata,
                        'content': match.metadata.get('content', '')
                    })
            return matches

        except Exception as e:
            logger.error(f"Error querying vector store: {e}")
            return []

    def get_context(self, query_text: str, max_tokens: int = 3000) -> str:
        """Get relevant context for a query, formatted for LLM"""
        matches = self.query(query_text, top_k=5)
        if not matches:
            return ""

        context_parts = []
        token_count = 0
        for match in matches:
            content = match.get('content', '')
            metadata = match.get('metadata', {})
            source = metadata.get('source', 'documento')
            chunk = f"[Fuente: {source}] {content}"
            # Rough token estimate: 1 token ≈ 4 chars
            if token_count + len(chunk) // 4 > max_tokens:
                break
            context_parts.append(chunk)
            token_count += len(chunk) // 4

        return "\n\n---\n\n".join(context_parts)

    # ================================================================
    # Document Management
    # ================================================================

    def delete_document(self, content_hash: str) -> bool:
        """Delete a document by content hash"""
        index = self._get_index()
        if not index:
            return False

        try:
            # Query to find vectors with this content_hash
            results = index.query(
                vector=[0] * 1536,  # dummy vector
                top_k=100,
                namespace=self.namespace,
                filter={'content_hash': content_hash},
                include_metadata=True
            )

            if results.matches:
                ids = [m.id for m in results.matches]
                index.delete(ids=ids, namespace=self.namespace)
                logger.info(f"Deleted {len(ids)} chunks with hash {content_hash}")
                return True
            return False
        except Exception as e:
            logger.error(f"Error deleting document: {e}")
            return False

    def delete_all_for_tenant(self) -> bool:
        """Delete all documents for this tenant (admin only)"""
        if self.tenant_id:
            logger.warning("Cannot delete all for tenant - use license admin scope")
            return False

        index = self._get_index()
        if not index:
            return False

        try:
            # Delete all in namespace
            index.delete(delete_all=True, namespace=self.namespace)
            logger.info(f"Deleted all vectors in namespace {self.namespace}")
            return True
        except Exception as e:
            logger.error(f"Error deleting all vectors: {e}")
            return False