from django.urls import path, include
from rest_framework.routers import DefaultRouter
from core.views import health_check
from .views import (
    register_view,
    login_view,
    logout_view,
    me_view,
    SupplierViewSet,
    SupplierRelationshipViewSet,
    SupplierActivityDataViewSet,
    EmissionFactorViewSet,
    CarbonCalculationViewSet,
    HotspotViewSet,
    RecommendationViewSet,
    AuditLogViewSet,
    ReportViewSet,
)
from .analytics import (
    TotalEmissionsView,
    TierEmissionsView,
    SupplierEmissionsView,
    ActivityEmissionsView,
    MaterialEmissionsView,
    TransportEmissionsView,
    DashboardAggregationView
)
from .hotspot_views import (
    HotspotOverviewView,
    SupplierHotspotsView,
    TierHotspotsView,
    ActivityHotspotsView,
    MaterialHotspotsView,
    TransportHotspotsView,
    HotspotSyncView
)
from .recommendation_views import (
    RecommendationOverviewView,
    RecommendationGenerateView,
    MaterialRecommendationsView,
    TransportRecommendationsView,
    EnergyRecommendationsView,
    SupplierRecommendationsView
)
from .report_views import (
    ReportDataView,
    ReportGenerateView,
    ReportPDFView,
    ReportListView,
)

router = DefaultRouter()
router.register(r'suppliers', SupplierViewSet, basename='supplier')
router.register(r'relationships', SupplierRelationshipViewSet, basename='relationship')
router.register(r'activity-data', SupplierActivityDataViewSet, basename='activity-data')
router.register(r'emission-factors', EmissionFactorViewSet, basename='emission-factor')
router.register(r'calculations', CarbonCalculationViewSet, basename='calculation')
router.register(r'hotspots', HotspotViewSet, basename='hotspot')
router.register(r'recommendations', RecommendationViewSet, basename='recommendation')
router.register(r'audit-logs', AuditLogViewSet, basename='audit-log')
router.register(r'reports', ReportViewSet, basename='report')

urlpatterns = [
    # Health endpoint
    path('health/', health_check, name='health-check'),

    # Explicit supply chain hierarchy alias route
    path('supply-chain/hierarchy/', SupplierViewSet.as_view({'get': 'hierarchy'}), name='supply-chain-hierarchy'),

    # Explicit CSV upload alias route
    path('upload-csv/', SupplierActivityDataViewSet.as_view({'post': 'upload_csv'}), name='upload-csv'),

    # Carbon Hotspot Detection Endpoints (Phase 12)
    path('hotspots/overview/', HotspotOverviewView.as_view(), name='hotspots-overview'),
    path('hotspots/suppliers/', SupplierHotspotsView.as_view(), name='hotspots-suppliers'),
    path('hotspots/tiers/', TierHotspotsView.as_view(), name='hotspots-tiers'),
    path('hotspots/activities/', ActivityHotspotsView.as_view(), name='hotspots-activities'),
    path('hotspots/materials/', MaterialHotspotsView.as_view(), name='hotspots-materials'),
    path('hotspots/transport/', TransportHotspotsView.as_view(), name='hotspots-transport'),
    path('hotspots/sync/', HotspotSyncView.as_view(), name='hotspots-sync'),
    path('analytics/hotspots/', HotspotOverviewView.as_view(), name='analytics-hotspots'),

    # Circular and Lower-Carbon Recommendation Endpoints (Phase 14)
    path('recommendations/overview/', RecommendationOverviewView.as_view(), name='recommendations-overview'),
    path('recommendations/generate/', RecommendationGenerateView.as_view(), name='recommendations-generate'),
    path('recommendations/material/', MaterialRecommendationsView.as_view(), name='recommendations-material'),
    path('recommendations/transport/', TransportRecommendationsView.as_view(), name='recommendations-transport'),
    path('recommendations/energy/', EnergyRecommendationsView.as_view(), name='recommendations-energy'),
    path('recommendations/suppliers/', SupplierRecommendationsView.as_view(), name='recommendations-suppliers'),

    # Carbon Reporting Endpoints (Phase 16)
    path('reports/data/', ReportDataView.as_view(), name='reports-data'),
    path('reports/generate/', ReportGenerateView.as_view(), name='reports-generate'),
    path('reports/pdf/', ReportPDFView.as_view(), name='reports-pdf'),
    path('reports/list/', ReportListView.as_view(), name='reports-list'),

    # Multi-Tier Carbon Aggregation & Analytics Endpoints (Phase 11)
    path('analytics/emissions/total/', TotalEmissionsView.as_view(), name='analytics-emissions-total'),
    path('analytics/emissions/tier/', TierEmissionsView.as_view(), name='analytics-emissions-tier'),
    path('analytics/emissions/supplier/', SupplierEmissionsView.as_view(), name='analytics-emissions-supplier'),
    path('analytics/emissions/activity/', ActivityEmissionsView.as_view(), name='analytics-emissions-activity'),
    path('analytics/emissions/material/', MaterialEmissionsView.as_view(), name='analytics-emissions-material'),
    path('analytics/emissions/transport/', TransportEmissionsView.as_view(), name='analytics-emissions-transport'),
    path('analytics/dashboard/', DashboardAggregationView.as_view(), name='analytics-dashboard'),

    # Direct short aliases
    path('emissions/total/', TotalEmissionsView.as_view(), name='emissions-total'),
    path('emissions/tier/', TierEmissionsView.as_view(), name='emissions-tier'),
    path('emissions/supplier/', SupplierEmissionsView.as_view(), name='emissions-supplier'),
    path('emissions/activity/', ActivityEmissionsView.as_view(), name='emissions-activity'),

    # Authentication endpoints
    path('auth/register/', register_view, name='auth-register'),
    path('auth/login/', login_view, name='auth-login'),
    path('auth/logout/', logout_view, name='auth-logout'),
    path('auth/me/', me_view, name='auth-me'),

    # Role-protected API resources
    path('', include(router.urls)),
]

