"""
Trie Service - Prefix Tree Data Structure
Implements Trie data structure for O(L) instant autocomplete search
over Child Names and National IDs (Cedulas) per Tenant.

Zero-Downtime & Non-Destructive: Reads Child models without DB mutations.
"""
from typing import List, Dict, Any, Optional
from models.child import Child

class TrieNode:
    def __init__(self):
        self.children: Dict[str, 'TrieNode'] = {}
        self.is_end_of_word: bool = False
        self.items: List[Dict[str, Any]] = []


class ChildSearchTrie:
    """
    Trie Index per Tenant for O(L) Autocomplete Searches
    """
    _tries: Dict[int, TrieNode] = {}  # tenant_id -> Root TrieNode

    @classmethod
    def rebuild_trie_for_tenant(cls, tenant_id: int):
        """Build Trie index for a tenant from active children in database"""
        root = TrieNode()
        children = Child.query.filter_by(tenant_id=tenant_id, status='activo').all()

        for child in children:
            child_info = {
                'id': child.id,
                'first_name': child.first_name,
                'last_name': child.last_name,
                'full_name': f"{child.first_name} {child.last_name}",
                'cedula': child.cedula,
                'status': child.status
            }

            # Index by full name words and cedula
            search_terms = [
                child.first_name.lower(),
                child.last_name.lower(),
                f"{child.first_name} {child.last_name}".lower()
            ]
            if child.cedula:
                search_terms.append(child.cedula)

            for term in search_terms:
                cls._insert_term(root, term, child_info)

        cls._tries[tenant_id] = root
        return len(children)

    @classmethod
    def _insert_term(cls, root: TrieNode, term: str, child_info: Dict[str, Any]):
        curr = root
        for char in term:
            if char not in curr.children:
                curr.children[char] = TrieNode()
            curr = curr.children[char]
            # Keep up to 10 matching children at intermediate nodes for fast prefix matches
            if not any(c['id'] == child_info['id'] for c in curr.items):
                if len(curr.items) < 10:
                    curr.items.append(child_info)
        curr.is_end_of_word = True

    @classmethod
    def search_prefix(cls, tenant_id: int, prefix: str) -> List[Dict[str, Any]]:
        """Search prefix in O(L) time where L is length of prefix"""
        if tenant_id not in cls._tries:
            cls.rebuild_trie_for_tenant(tenant_id)

        root = cls._tries.get(tenant_id)
        if not root:
            return []

        curr = root
        for char in prefix.lower():
            if char not in curr.children:
                return []
            curr = curr.children[char]

        return curr.items
