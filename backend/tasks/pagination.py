from rest_framework.pagination import PageNumberPagination


class StandardResultsPagination(PageNumberPagination):
    """10 items per page; responses contain count, next, previous, results.

    ``page_size`` may be passed (max 100) - used by the Kanban board to load
    many tasks per request.
    """

    page_size = 10
    page_size_query_param = "page_size"
    max_page_size = 100
