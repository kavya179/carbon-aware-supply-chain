"""
Hotspot API Views (Phase 12)
Exposes REST endpoints for carbon hotspot detection across suppliers,
tiers, activities, materials, and transport modes.
"""

from rest_framework import permissions, status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.exceptions import PermissionDenied

from .models import Company, AuditLog
from .hotspot_engine import HotspotConfig, CarbonHotspotDetector


def _get_target_company(request):
    """
    Resolves the company for which to compute hotspots based on user role.
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
        # Auditor can specify ?company_id=X, default to first company
        cid = request.query_params.get('company_id')
        if cid:
            try:
                return Company.objects.get(id=cid)
            except Company.DoesNotExist:
                raise PermissionDenied(f"Company ID {cid} not found.")
        company = Company.objects.first()
        if not company:
            raise PermissionDenied("No company found for auditing.")
        return company

    raise PermissionDenied("Suppliers are not authorized to view enterprise hotspot analytics.")


class HotspotOverviewView(APIView):
    """
    GET /api/hotspots/overview/
    GET /api/analytics/hotspots/
    Master endpoint delivering high-level hotspot summaries, configured
    thresholds, top items across all 5 dimensions, and pre-formatted chart data.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        company = _get_target_company(request)
        period = request.query_params.get('reporting_period')
        tier = request.query_params.get('tier')
        thresholds = HotspotConfig.get_thresholds(request)

        detector = CarbonHotspotDetector(
            company=company,
            reporting_period=period,
            tier=tier,
            thresholds=thresholds
        )

        overview = detector.get_full_overview()
        overview['company_name'] = company.name
        overview['company_id'] = company.id
        return Response(overview, status=status.HTTP_200_OK)


class SupplierHotspotsView(APIView):
    """
    GET /api/hotspots/suppliers/
    Ranks suppliers by total carbon emissions, calculated contributions,
    and impact classifications (HIGH, MEDIUM, LOW).
    Filter by: ?impact=HIGH, ?reporting_period=2024-Q1, ?tier=1
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        company = _get_target_company(request)
        period = request.query_params.get('reporting_period')
        tier = request.query_params.get('tier')
        impact_filter = request.query_params.get('impact')
        thresholds = HotspotConfig.get_thresholds(request)

        detector = CarbonHotspotDetector(
            company=company,
            reporting_period=period,
            tier=tier,
            thresholds=thresholds
        )

        suppliers = detector.detect_supplier_hotspots(impact_filter=impact_filter)

        return Response({
            'company_name': company.name,
            'reporting_period': period or 'All Periods',
            'total_company_co2e_kg': float(detector.total_co2e_kg),
            'total_company_co2e_tonnes': float(detector.total_co2e_tonnes),
            'thresholds': {
                'HIGH': float(thresholds['HIGH']),
                'MEDIUM': float(thresholds['MEDIUM']),
                'LOW': float(thresholds['LOW'])
            },
            'count': len(suppliers),
            'suppliers': suppliers
        }, status=status.HTTP_200_OK)


class TierHotspotsView(APIView):
    """
    GET /api/hotspots/tiers/
    Evaluates emissions aggregated by Tier 1, Tier 2, and Tier 3.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        company = _get_target_company(request)
        period = request.query_params.get('reporting_period')
        thresholds = HotspotConfig.get_thresholds(request)

        detector = CarbonHotspotDetector(
            company=company,
            reporting_period=period,
            thresholds=thresholds
        )

        tiers = detector.detect_tier_hotspots()

        return Response({
            'company_name': company.name,
            'reporting_period': period or 'All Periods',
            'total_company_co2e_kg': float(detector.total_co2e_kg),
            'total_company_co2e_tonnes': float(detector.total_co2e_tonnes),
            'thresholds': {
                'HIGH': float(thresholds['HIGH']),
                'MEDIUM': float(thresholds['MEDIUM']),
                'LOW': float(thresholds['LOW'])
            },
            'tiers': tiers
        }, status=status.HTTP_200_OK)


class ActivityHotspotsView(APIView):
    """
    GET /api/hotspots/activities/
    Ranks emission activities: Electricity, Fuel, Transport, Material.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        company = _get_target_company(request)
        period = request.query_params.get('reporting_period')
        tier = request.query_params.get('tier')
        thresholds = HotspotConfig.get_thresholds(request)

        detector = CarbonHotspotDetector(
            company=company,
            reporting_period=period,
            tier=tier,
            thresholds=thresholds
        )

        activities = detector.detect_activity_hotspots()

        return Response({
            'company_name': company.name,
            'reporting_period': period or 'All Periods',
            'total_company_co2e_kg': float(detector.total_co2e_kg),
            'total_company_co2e_tonnes': float(detector.total_co2e_tonnes),
            'thresholds': {
                'HIGH': float(thresholds['HIGH']),
                'MEDIUM': float(thresholds['MEDIUM']),
                'LOW': float(thresholds['LOW'])
            },
            'activities': activities
        }, status=status.HTTP_200_OK)


class MaterialHotspotsView(APIView):
    """
    GET /api/hotspots/materials/
    Identifies highest-emission purchased materials and suppliers.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        company = _get_target_company(request)
        period = request.query_params.get('reporting_period')
        thresholds = HotspotConfig.get_thresholds(request)

        detector = CarbonHotspotDetector(
            company=company,
            reporting_period=period,
            thresholds=thresholds
        )

        materials = detector.detect_material_hotspots()

        return Response({
            'company_name': company.name,
            'reporting_period': period or 'All Periods',
            'total_company_co2e_kg': float(detector.total_co2e_kg),
            'total_company_co2e_tonnes': float(detector.total_co2e_tonnes),
            'thresholds': {
                'HIGH': float(thresholds['HIGH']),
                'MEDIUM': float(thresholds['MEDIUM']),
                'LOW': float(thresholds['LOW'])
            },
            'materials': materials
        }, status=status.HTTP_200_OK)


class TransportHotspotsView(APIView):
    """
    GET /api/hotspots/transport/
    Identifies highest-emission transport modes, distances, and weights.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        company = _get_target_company(request)
        period = request.query_params.get('reporting_period')
        thresholds = HotspotConfig.get_thresholds(request)

        detector = CarbonHotspotDetector(
            company=company,
            reporting_period=period,
            thresholds=thresholds
        )

        transport = detector.detect_transport_hotspots()

        return Response({
            'company_name': company.name,
            'reporting_period': period or 'All Periods',
            'total_company_co2e_kg': float(detector.total_co2e_kg),
            'total_company_co2e_tonnes': float(detector.total_co2e_tonnes),
            'thresholds': {
                'HIGH': float(thresholds['HIGH']),
                'MEDIUM': float(thresholds['MEDIUM']),
                'LOW': float(thresholds['LOW'])
            },
            'transport_modes': transport
        }, status=status.HTTP_200_OK)


class HotspotSyncView(APIView):
    """
    POST /api/hotspots/sync/
    Synchronizes detected supplier hotspots to the persistent `Hotspot`
    database model in SQLite.
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        company = _get_target_company(request)
        period = request.data.get('reporting_period') or request.query_params.get('reporting_period')
        thresholds = HotspotConfig.get_thresholds(request)

        detector = CarbonHotspotDetector(
            company=company,
            reporting_period=period,
            thresholds=thresholds
        )

        synced_count = detector.sync_to_database()

        AuditLog.log_action(
            user=request.user,
            action='HOTSPOTS_GENERATED',
            entity_type='Hotspot',
            entity_id=f"hotspots-{company.id}",
            details={
                'company': company.name,
                'reporting_period': period or 'All Periods',
                'synced_count': synced_count,
                'thresholds': {
                    'HIGH': float(thresholds['HIGH']),
                    'MEDIUM': float(thresholds['MEDIUM']),
                    'LOW': float(thresholds['LOW'])
                }
            },
            request=request
        )

        return Response({
            'status': 'success',
            'company_name': company.name,
            'reporting_period': period or 'All Periods',
            'synced_hotspots': synced_count,
            'message': f"Successfully synchronized {synced_count} carbon hotspots to SQLite."
        }, status=status.HTTP_200_OK)
