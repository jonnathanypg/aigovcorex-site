"""
RAG Service - Vector memory with Pinecone
Adapted from OnePunch RAG architecture for KindiCoreAI's hierarchical
License (parent) -> Tenant/Center (child) structure.

Namespace Strategy:
    - All vectors for a License live in namespace "license_{license_id}"
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


class RAGService:
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
        return f"license_{self.license_id}"

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
    # Text Processing
    # ================================================================

    def chunk_text(
        self,
        text: str,
        chunk_size: int = 1000,
        overlap: int = 200
    ) -> List[str]:
        """
        Split text into overlapping chunks with intelligent sentence boundary detection.
        Adapted from OnePunch RAG service.
        """
        chunks = []
        start = 0

        while start < len(text):
            end = start + chunk_size
            chunk = text[start:end]

            # Try to break at sentence boundary
            if end < len(text):
                last_period = chunk.rfind('.')
                last_newline = chunk.rfind('\n')
                break_point = max(last_period, last_newline)

                if break_point > chunk_size // 2:
                    chunk = chunk[:break_point + 1]
                    end = start + break_point + 1

            chunks.append(chunk.strip())
            start = end - overlap

        return [c for c in chunks if c]

    # ================================================================
    # Embedding Generation
    # ================================================================

    def create_embeddings(self, texts: List[str]) -> List[List[float]]:
        """Create embeddings using the configured LLM provider"""
        return self.llm.get_embeddings(texts)

    # ================================================================
    # Vector ID Generation
    # ================================================================

    def generate_chunk_id(self, document_id: int, chunk_index: int, content: str) -> str:
        """Generate unique ID for a chunk"""
        content_hash = hashlib.md5(content.encode()).hexdigest()[:8]
        return f"doc_{document_id}_chunk_{chunk_index}_{content_hash}"

    # ================================================================
    # Indexing
    # ================================================================

    def index_document(
        self,
        document_id: int,
        content: str,
        title: str = "",
        scope: str = "global",
        metadata: Optional[Dict] = None
    ) -> List[str]:
        """
        Index a document into Pinecone with hierarchical metadata.

        Args:
            document_id: Database KnowledgeDocument ID
            content: Text content to index
            title: Document title for metadata
            scope: 'global' (license-wide) or 'center' (tenant-specific)
            metadata: Additional metadata

        Returns:
            List of vector IDs created
        """
        index = self._get_index()
        if not index:
            raise ValueError("Pinecone index not available. Check PINECONE_API_KEY and index name.")

        # Chunk the content
        chunks = self.chunk_text(content)
        if not chunks:
            return []

        # Create embeddings
        embeddings = self.create_embeddings(chunks)

        # Prepare vectors with hierarchical metadata
        vectors = []
        vector_ids = []

        for i, (chunk, embedding) in enumerate(zip(chunks, embeddings)):
            vector_id = self.generate_chunk_id(document_id, i, chunk)
            vector_ids.append(vector_id)

            chunk_metadata = {
                'document_id': document_id,
                'chunk_index': i,
                'content': chunk[:1000],  # Pinecone metadata limit
                'title': title[:200] if title else '',
                'license_id': self.license_id,
                'scope': scope,
            }

            # Add tenant_id only for center-specific docs
            if scope == 'center' and self.tenant_id:
                chunk_metadata['tenant_id'] = self.tenant_id

            # Merge any additional metadata
            if metadata:
                chunk_metadata.update(metadata)

            vectors.append({
                'id': vector_id,
                'values': embedding,
                'metadata': chunk_metadata
            })

        # Upsert to Pinecone in the license namespace
        # Batch upsert in groups of 100 (Pinecone limit)
        batch_size = 100
        for i in range(0, len(vectors), batch_size):
            batch = vectors[i:i + batch_size]
            index.upsert(vectors=batch, namespace=self.namespace)

        logger.info(
            f"Indexed document {document_id} ({title}): "
            f"{len(chunks)} chunks -> namespace={self.namespace}, scope={scope}"
        )

        return vector_ids

    def ingest_text(
        self,
        text: str,
        title: str = "Documento",
        scope: str = "global",
        module: Optional[str] = None,
        program_id: Optional[int] = None,
        metadata: Optional[Dict] = None
    ) -> List[str]:
        """
        Ingest direct text into the RAG vector store with hierarchical scope.
        Used by chat sidebar upload, webhooks and dynamic document ingestion.
        
        Hierarchical scopes:
          - 'organization' / 'global': toda la entidad/licencia
          - 'module': módulo específico (kindicore, social, geo, channels, copilot)
          - 'center': tenant_id específico
          - 'project': programa / proyecto específico
          - 'operator': operador / usuario específico
        """
        index = self._get_index()
        if not index:
            logger.warning("Pinecone index not available for ingest_text")
            return []

        chunks = self.chunk_text(text)
        if not chunks:
            return []

        embeddings = self.create_embeddings(chunks)
        vectors = []
        vector_ids = []
        doc_hash = hashlib.md5(text[:200].encode()).hexdigest()[:6]
        fake_doc_id = int(datetime.utcnow().timestamp()) % 1000000

        for i, (chunk, embedding) in enumerate(zip(chunks, embeddings)):
            vid = f"text_{doc_hash}_{i}_{fake_doc_id}"
            vector_ids.append(vid)

            meta = {
                'chunk_index': i,
                'content': chunk[:1000],
                'title': title[:200],
                'license_id': self.license_id,
                'scope': scope,
            }
            if self.tenant_id:
                meta['tenant_id'] = self.tenant_id
            if module:
                meta['module'] = module
            if program_id:
                meta['program_id'] = program_id
            if metadata:
                meta.update(metadata)

            vectors.append({
                'id': vid,
                'values': embedding,
                'metadata': meta
            })

        batch_size = 100
        for i in range(0, len(vectors), batch_size):
            batch = vectors[i:i + batch_size]
            index.upsert(vectors=batch, namespace=self.namespace)

        logger.info(f"Ingested text '{title}' with {len(chunks)} chunks into namespace {self.namespace}")
        return vector_ids

    # ================================================================
    # Querying
    # ================================================================

    def query(
        self,
        query_text: str,
        top_k: int = 5,
        role: str = 'staff',
        module: Optional[str] = None,
        program_id: Optional[int] = None,
        filter_metadata: Optional[Dict] = None
    ) -> List[Dict[str, Any]]:
        """
        Query the vector store with role-based and hierarchical filtering.

        Args:
            query_text: Text to search for
            top_k: Number of results
            role: User role for scope filtering ('super_admin', 'license_admin', 'coordinator', 'staff')
            module: Optional module filter ('kindicore', 'social', 'geo', 'channels', 'copilot')
            program_id: Optional social program ID filter
            filter_metadata: Optional additional metadata filters

        Returns:
            List of results with content and metadata
        """
        index = self._get_index()
        if not index:
            return []

        # Create query embedding
        query_embedding = self.create_embeddings([query_text])[0]

        # Build metadata filter based on role and hierarchy
        query_filter = {'license_id': self.license_id}

        if role in ('super_admin', 'license_admin'):
            # Admin sees all docs in this license
            pass
        elif self.tenant_id:
            # Center staff sees: global/organization docs + their center's docs
            query_filter['$or'] = [
                {'scope': 'global'},
                {'scope': 'organization'},
                {'tenant_id': self.tenant_id}
            ]

        if module:
            query_filter['module'] = module

        if program_id:
            query_filter['program_id'] = program_id

        # Merge additional filters
        if filter_metadata:
            query_filter.update(filter_metadata)

        # Query Pinecone
        results = index.query(
            vector=query_embedding,
            top_k=top_k,
            namespace=self.namespace,
            filter=query_filter if query_filter else None,
            include_metadata=True
        )

        # Format results
        formatted_results = []
        for match in results.matches:
            formatted_results.append({
                'id': match.id,
                'score': match.score,
                'content': match.metadata.get('content', ''),
                'title': match.metadata.get('title', ''),
                'document_id': match.metadata.get('document_id'),
                'scope': match.metadata.get('scope', 'global'),
                'metadata': match.metadata
            })

        return formatted_results

    def get_context(
        self,
        query: str,
        role: str = 'staff',
        max_tokens: int = 2000,
        top_k: int = 5
    ) -> str:
        """
        Get relevant context string for a query (ready for LLM consumption).

        Args:
            query: User query
            role: User role for scope filtering
            max_tokens: Approximate max tokens for context
            top_k: Number of chunks to retrieve

        Returns:
            Combined context string
        """
        results = self.query(query, top_k=top_k, role=role)

        if not results:
            return ""

        # Combine results respecting token limit
        context_parts = []
        total_chars = 0
        max_chars = max_tokens * 4  # Rough char-to-token ratio

        for result in results:
            content = result.get('content', '')
            title = result.get('title', '')
            if total_chars + len(content) > max_chars:
                break
            header = f"[{title}]" if title else ""
            context_parts.append(f"{header}\n{content}" if header else content)
            total_chars += len(content)

        return "\n\n---\n\n".join(context_parts)

    # ================================================================
    # Deletion
    # ================================================================

    def delete_document(self, document_id: int):
        """Delete all vectors for a document from Pinecone"""
        index = self._get_index()
        if not index:
            return

        # Delete by metadata filter in the license namespace
        try:
            index.delete(
                filter={'document_id': document_id},
                namespace=self.namespace
            )
            logger.info(f"Deleted vectors for document {document_id} from namespace {self.namespace}")
        except Exception as e:
            logger.error(f"Error deleting vectors for document {document_id}: {e}")

    def delete_all_for_tenant(self, tenant_id: int):
        """Delete all vectors for a specific tenant (center)"""
        index = self._get_index()
        if not index:
            return

        try:
            index.delete(
                filter={'tenant_id': tenant_id},
                namespace=self.namespace
            )
            logger.info(f"Deleted all vectors for tenant {tenant_id} from namespace {self.namespace}")
        except Exception as e:
            logger.error(f"Error deleting tenant vectors: {e}")
