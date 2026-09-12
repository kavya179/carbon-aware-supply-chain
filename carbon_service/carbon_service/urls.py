"""Carbon Intelligence Service URL Configuration."""
from django.urls import path, include

urlpatterns = [
    path('api/carbon/', include('carbon_api.urls')),
    path('health/', include('carbon_api.health_urls')),
]
