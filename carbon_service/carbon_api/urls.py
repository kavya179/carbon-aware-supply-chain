"""carbon_api URL patterns."""
from django.urls import path
from . import views

urlpatterns = [
    path('calculate/', views.CalculateEmissionView.as_view(), name='calculate-emission'),
    path('calculate-comprehensive/', views.ComprehensiveCalculationView.as_view(), name='calculate-comprehensive'),
    path('generate-recommendations/', views.GenerateRecommendationsView.as_view(), name='generate-recommendations'),
    path('forecast/', views.ForecastView.as_view(), name='forecast'),
    path('recommendations/', views.RecommendationsView.as_view(), name='recommendations'),
    path('score/', views.SupplierScoreView.as_view(), name='supplier-score'),
    path('process-csv/', views.ProcessCsvView.as_view(), name='process-csv'),
]
