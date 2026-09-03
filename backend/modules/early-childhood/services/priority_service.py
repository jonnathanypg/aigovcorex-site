"""
Priority Service - High Performance Max-Heap Engine
Implements Max-Heap (heapq) algorithms for $O(1)$ priority access
to Vulnerability Applications (Ficha R01 MIES) and Critical Medical Alerts.

Zero-Downtime & 100% Non-destructive: Operates seamlessly on existing DB models.
"""
import heapq
import time
from typing import List, Dict, Optional, Any
from models.application import Application, WaitingList

class ApplicationHeapItem:
    """Wrapper to enable Max-Heap comparison in heapq (invert priority_score for min-heap behavior)"""
    def __init__(self, application: Application):
        self.application = application
        # Priority score is 0 to 100. Invert so highest score comes first in min-heap.
        self.priority = -(application.priority_score or 0)
        self.timestamp = application.created_at.timestamp() if application.created_at else time.time()

    def __lt__(self, other):
        if self.priority == other.priority:
            return self.timestamp < other.timestamp  # Earliest application breaks ties
        return self.priority < other.priority


class VulnerabilityPriorityHeap:
    """
    In-Memory Max-Heap Service for Center Admissions & Waiting Lists
    """
    _heaps: Dict[int, List[ApplicationHeapItem]] = {}  # tenant_id -> Heap List

    @classmethod
    def rebuild_heap_for_tenant(cls, tenant_id: int):
        """Build or refresh the Max-Heap for a specific tenant from database"""
        apps = Application.query.filter_by(
            center_id=tenant_id,
            status='pending'
        ).all()
        
        heap_list = [ApplicationHeapItem(app) for app in apps]
        heapq.heapify(heap_list)
        cls._heaps[tenant_id] = heap_list
        return len(heap_list)

    @classmethod
    def get_top_priority_application(cls, tenant_id: int) -> Optional[Application]:
        """Get highest priority applicant in O(1) time"""
        if tenant_id not in cls._heaps or not cls._heaps[tenant_id]:
            cls.rebuild_heap_for_tenant(tenant_id)

        heap = cls._heaps.get(tenant_id, [])
        if heap:
            return heap[0].application  # O(1) inspection of root
        return None

    @classmethod
    def pop_top_priority_application(cls, tenant_id: int) -> Optional[Application]:
        """Extract highest priority applicant in O(log N) time"""
        if tenant_id not in cls._heaps or not cls._heaps[tenant_id]:
            cls.rebuild_heap_for_tenant(tenant_id)

        heap = cls._heaps.get(tenant_id, [])
        if heap:
            item = heapq.heappop(heap)
            return item.application
        return None

    @classmethod
    def add_application(cls, application: Application):
        """Insert a new application into the tenant's heap in O(log N) time"""
        tenant_id = application.center_id
        if tenant_id not in cls._heaps:
            cls.rebuild_heap_for_tenant(tenant_id)
        
        item = ApplicationHeapItem(application)
        heapq.heappush(cls._heaps[tenant_id], item)
