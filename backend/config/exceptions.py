"""Project-wide DRF exception handler producing consistent error payloads.

Validation errors (400) always look like::

    {"detail": "Validation failed.", "errors": {"field": ["message", ...]}}

Other errors (401, 404, ...) keep DRF's ``{"detail": "..."}`` shape.
"""
import logging

from django.db import DatabaseError, IntegrityError
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import exception_handler, set_rollback

logger = logging.getLogger(__name__)


def custom_exception_handler(exc, context):
    response = exception_handler(exc, context)

    if response is None:
        # Exceptions DRF does not handle itself: database problems.
        if isinstance(exc, IntegrityError):
            set_rollback()
            return Response(
                {
                    "detail": "The request conflicts with existing data.",
                    "errors": {"non_field_errors": ["The request conflicts with existing data."]},
                },
                status=status.HTTP_400_BAD_REQUEST,
            )
        if isinstance(exc, DatabaseError):
            set_rollback()
            logger.exception("Unexpected database error", exc_info=exc)
            return Response(
                {"detail": "A database error occurred. Please try again later."},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )
        return None

    if response.status_code == status.HTTP_400_BAD_REQUEST:
        data = response.data
        if isinstance(data, dict):
            errors = data
        elif isinstance(data, list):
            errors = {"non_field_errors": data}
        else:
            errors = {"non_field_errors": [str(data)]}
        response.data = {"detail": "Validation failed.", "errors": errors}

    return response
