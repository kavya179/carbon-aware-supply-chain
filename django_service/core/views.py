from rest_framework.decorators import api_view
from rest_framework.response import Response
from django.db import connection

@api_view(['GET'])
def health_check(request):
    db_connected = False
    try:
        connection.ensure_connection()
        db_connected = True
    except Exception as e:
        db_error = str(e)
        return Response({
            "status": "error",
            "database": "sqlite",
            "database_connected": False,
            "error": db_error
        }, status=500)

    return Response({
        "status": "ok",
        "database": "sqlite",
        "database_connected": db_connected,
        "service": "django_service",
        "framework": "Django REST Framework"
    })
