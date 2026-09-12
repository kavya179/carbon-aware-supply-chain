"""
Custom DRF exception handler — returns consistent JSON error format.
"""
from rest_framework.views import exception_handler
from rest_framework.response import Response


def custom_exception_handler(exc, context):
    response = exception_handler(exc, context)

    if response is not None:
        response.data = {
            'success': False,
            'error': response.data,
            'status': response.status_code,
        }

    return response
