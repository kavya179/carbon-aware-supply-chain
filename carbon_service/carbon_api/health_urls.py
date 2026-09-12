"""Health check URL (separate from main api/ prefix)."""
from django.urls import path
from django.http import JsonResponse
import datetime


def health_check(request):
    return JsonResponse({
        "status": "ok",
        "service": "carbon-intelligence-service",
        "timestamp": datetime.datetime.utcnow().isoformat() + "Z",
        "version": "0.1.0",
    })


urlpatterns = [
    path('', health_check, name='health-check'),
]
