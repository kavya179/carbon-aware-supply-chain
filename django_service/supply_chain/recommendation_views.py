"""
Recommendation API Views (Phase 14)
Exposes REST endpoints for rule-based circular and lower-carbon recommendations.
All calculations are strictly rule-based, derived from actual hotspots,
and explicitly labeled as estimated potential reductions.
"""

from rest_framework import permissions, status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.exceptions import PermissionDenied

from .models import Company, Recommendation, AuditLog
from .serializers import RecommendationSerializer
from .recommendation_engine import RuleBasedRecommendationEngine


def _get_target_company(request):
    """
    Resolves target enterprise company for recommendations.
    """
    user = request.user
    profile = getattr(user, 'profile', None)
    if not profile:
        raise PermissionDenied("User profile not found.")

    if profile.role in ('COMPANY_MANAGER', 'ADMIN'):
        if not profile.company:
            raise PermissionDenied("Manager has no associated company.")
        return profile.company

    if profile.role == 'AUDITOR':
        cid = request.query_params.get('company_id')
        if cid:
            try:
                return Company.objects.get(id=cid)
            except Company.DoesNotExist:
                raise PermissionDenied(f"Company ID {cid} not found.")
        company = Company.objects.first()
        if not company:
            raise PermissionDenied("No enterprise company found.")
        return company

    raise PermissionDenied("Suppliers are not authorized to view enterprise recommendation engine.")


class RecommendationOverviewView(APIView):
    """
    GET /api/recommendations/overview/
    Master endpoint delivering live rule-based decarbonization and circularity recommendations.
    Supports ?category=MATERIAL|ENERGY|TRANSPORT|SUPPLIER and ?reporting_period=2026-Q1
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        company = _get_target_company(request)
        period = request.query_params.get('reporting_period')
        category_filter = request.query_params.get('category')

        engine = RuleBasedRecommendationEngine(company=company, reporting_period=period)
        all_recs = engine.generate_recommendations()

        if category_filter:
            recs = [r for r in all_recs if r['category'].upper() == category_filter.upper()]
        else:
            recs = all_recs

        total_reduction_kg = sum(r['estimated_potential_reduction']['co2e_kg'] for r in all_recs)
        total_reduction_tonnes = sum(r['estimated_potential_reduction']['co2e_tonnes'] for r in all_recs)

        domain_breakdown = {
            'MATERIAL': {
                'count': len([r for r in all_recs if r['category'] == 'MATERIAL']),
                'potential_reduction_tonnes': round(sum(r['estimated_potential_reduction']['co2e_tonnes'] for r in all_recs if r['category'] == 'MATERIAL'), 2)
            },
            'ENERGY': {
                'count': len([r for r in all_recs if r['category'] == 'ENERGY']),
                'potential_reduction_tonnes': round(sum(r['estimated_potential_reduction']['co2e_tonnes'] for r in all_recs if r['category'] == 'ENERGY'), 2)
            },
            'TRANSPORT': {
                'count': len([r for r in all_recs if r['category'] == 'TRANSPORT']),
                'potential_reduction_tonnes': round(sum(r['estimated_potential_reduction']['co2e_tonnes'] for r in all_recs if r['category'] == 'TRANSPORT'), 2)
            },
            'SUPPLIER': {
                'count': len([r for r in all_recs if r['category'] == 'SUPPLIER']),
                'potential_reduction_tonnes': round(sum(r['estimated_potential_reduction']['co2e_tonnes'] for r in all_recs if r['category'] == 'SUPPLIER'), 2)
            },
        }

        return Response({
            'company': company.name,
            'reporting_period': period or 'ALL',
            'methodology': 'Deterministic Rule-Based Decarbonization Engine (Zero Machine Learning)',
            'disclaimer': 'All figures represent estimated potential reductions derived from verified activity hotspots and published emission factor variances. Reductions are not guaranteed and depend on operational feasibility.',
            'summary': {
                'total_recommendations_available': len(all_recs),
                'filtered_recommendations_count': len(recs),
                'total_estimated_potential_reduction_kg': round(total_reduction_kg, 2),
                'total_estimated_potential_reduction_tonnes': round(total_reduction_tonnes, 2),
                'domain_breakdown': domain_breakdown,
            },
            'recommendations': recs
        })


class RecommendationGenerateView(APIView):
    """
    POST /api/recommendations/generate/
    Executes rule-based engine and synchronizes / persists generated recommendations
    into SQLite database (Recommendation model).
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        company = _get_target_company(request)
        period = request.data.get('reporting_period') or request.query_params.get('reporting_period')

        engine = RuleBasedRecommendationEngine(company=company, reporting_period=period)
        saved_recs = engine.persist_recommendations(user=request.user)

        total_reduction_tonnes = sum(float(r.potential_reduction_tonnes) for r in saved_recs)

        AuditLog.log_action(
            user=request.user,
            action='RECOMMENDATIONS_GENERATED',
            entity_type='Recommendation',
            entity_id=f"recs-{company.id}",
            details={
                'company': company.name,
                'reporting_period': period or 'ALL',
                'persisted_count': len(saved_recs),
                'total_estimated_reduction_tonnes': round(total_reduction_tonnes, 2)
            },
            request=request
        )

        serialized = RecommendationSerializer(saved_recs, many=True).data

        return Response({
            'status': 'success',
            'company': company.name,
            'persisted_count': len(saved_recs),
            'message': f"Successfully generated and persisted {len(saved_recs)} rule-based recommendations into SQLite.",
            'recommendations': serialized
        }, status=status.HTTP_201_CREATED)


class MaterialRecommendationsView(APIView):
    """
    GET /api/recommendations/material/
    Circularity & lower-carbon material substitutions.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        company = _get_target_company(request)
        period = request.query_params.get('reporting_period')
        engine = RuleBasedRecommendationEngine(company=company, reporting_period=period)
        recs = [r for r in engine.generate_recommendations() if r['category'] == 'MATERIAL']
        return Response({
            'domain': 'MATERIAL',
            'count': len(recs),
            'recommendations': recs
        })


class TransportRecommendationsView(APIView):
    """
    GET /api/recommendations/transport/
    Modal shift and shorter-distance routing recommendations.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        company = _get_target_company(request)
        period = request.query_params.get('reporting_period')
        engine = RuleBasedRecommendationEngine(company=company, reporting_period=period)
        recs = [r for r in engine.generate_recommendations() if r['category'] == 'TRANSPORT']
        return Response({
            'domain': 'TRANSPORT',
            'count': len(recs),
            'recommendations': recs
        })


class EnergyRecommendationsView(APIView):
    """
    GET /api/recommendations/energy/
    Renewable power and energy-efficiency interventions.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        company = _get_target_company(request)
        period = request.query_params.get('reporting_period')
        engine = RuleBasedRecommendationEngine(company=company, reporting_period=period)
        recs = [r for r in engine.generate_recommendations() if r['category'] == 'ENERGY']
        return Response({
            'domain': 'ENERGY',
            'count': len(recs),
            'recommendations': recs
        })


class SupplierRecommendationsView(APIView):
    """
    GET /api/recommendations/suppliers/
    Lower-carbon supplier transition and near-shoring recommendations.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        company = _get_target_company(request)
        period = request.query_params.get('reporting_period')
        engine = RuleBasedRecommendationEngine(company=company, reporting_period=period)
        recs = [r for r in engine.generate_recommendations() if r['category'] == 'SUPPLIER']
        return Response({
            'domain': 'SUPPLIER',
            'count': len(recs),
            'recommendations': recs
        })
