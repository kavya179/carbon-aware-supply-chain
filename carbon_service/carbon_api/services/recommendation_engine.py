"""
Recommendation Engine Service
==============================
Generates evidence-based emission reduction recommendations
based on supplier profile, emission patterns, and industry best practices.

Recommendations are rule-based in the scaffold.
In production this would use an ML-ranked recommendation model.
"""
from typing import Optional


# ─── Recommendation Rules Database ───────────────────────────────────────────
RECOMMENDATIONS = [
    {
        "id": "REC-001",
        "title": "Switch to Renewable Energy Procurement",
        "description": (
            "Transition to renewable electricity contracts (PPAs or RECs) for "
            "Tier 1 manufacturing suppliers. This can reduce Scope 3 Cat. 1 emissions by 30–60%."
        ),
        "category": "Energy",
        "scope3Categories": [1, 3],
        "estimatedReduction": {"min": 30, "max": 60, "unit": "%"},
        "difficulty": "Medium",
        "timeframe": "6–18 months",
        "priority": 1,
        "tags": ["renewable", "energy", "tier-1"],
    },
    {
        "id": "REC-002",
        "title": "Optimize Last-Mile Transportation Routes",
        "description": (
            "Use AI-powered route optimization to reduce transportation distances. "
            "Consolidate shipments and shift from air to sea freight where possible."
        ),
        "category": "Transportation",
        "scope3Categories": [4, 9],
        "estimatedReduction": {"min": 15, "max": 35, "unit": "%"},
        "difficulty": "Low",
        "timeframe": "1–3 months",
        "priority": 2,
        "tags": ["logistics", "transport", "quick-win"],
    },
    {
        "id": "REC-003",
        "title": "Implement Supplier Emission Reporting Standards",
        "description": (
            "Mandate ISO 14064 or CDP reporting from all Tier 1 & 2 suppliers. "
            "Better data quality enables more accurate reduction targeting."
        ),
        "category": "Governance",
        "scope3Categories": [1, 2, 3],
        "estimatedReduction": {"min": 5, "max": 20, "unit": "% data quality improvement"},
        "difficulty": "Medium",
        "timeframe": "3–6 months",
        "priority": 3,
        "tags": ["reporting", "governance", "data-quality"],
    },
    {
        "id": "REC-004",
        "title": "Introduce Circular Economy Practices",
        "description": (
            "Partner with suppliers to implement material recovery, recycling, and "
            "reuse programs. Focus on packaging and end-of-life categories."
        ),
        "category": "Circular Economy",
        "scope3Categories": [5, 12],
        "estimatedReduction": {"min": 10, "max": 25, "unit": "%"},
        "difficulty": "High",
        "timeframe": "12–24 months",
        "priority": 4,
        "tags": ["circular", "waste", "packaging"],
    },
    {
        "id": "REC-005",
        "title": "Supplier Carbon Performance Incentives",
        "description": (
            "Introduce preferential contract terms for suppliers who demonstrate "
            "verified carbon reductions. This creates market incentives for reduction."
        ),
        "category": "Procurement",
        "scope3Categories": [1, 2, 3, 4],
        "estimatedReduction": {"min": 8, "max": 18, "unit": "%"},
        "difficulty": "Low",
        "timeframe": "1–6 months",
        "priority": 5,
        "tags": ["procurement", "incentives", "policy"],
    },
]


class RecommendationEngine:
    """
    Generates prioritized carbon reduction recommendations.
    Recommendations are filtered/ranked based on supplier context.
    """

    def get_recommendations(self, supplier_id: Optional[str] = None) -> dict:
        """
        Return prioritized reduction recommendations.

        Args:
            supplier_id: Optional — personalize for specific supplier (future ML feature)

        Returns:
            dict with sorted recommendations list
        """
        # Sort by priority
        sorted_recs = sorted(RECOMMENDATIONS, key=lambda r: r['priority'])

        return {
            "recommendations": sorted_recs,
            "count": len(sorted_recs),
            "supplierId": supplier_id,
            "generatedAt": __import__('datetime').datetime.utcnow().isoformat() + "Z",
            "methodology": "GHG Protocol Scope 3 + Industry Best Practices",
        }
