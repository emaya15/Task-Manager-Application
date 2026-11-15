import django_filters
from django.db.models import F
from django.utils import timezone
from rest_framework.filters import OrderingFilter

from .models import Task

DUE_CHOICES = (
    ("today", "Due today"),
    ("overdue", "Overdue"),
    ("upcoming", "Upcoming"),
)


class TaskFilter(django_filters.FilterSet):
    """?status=&priority=&category=<id>&due=today|overdue|upcoming

    ``due`` only considers open tasks (status other than Done); an overdue task
    is one whose due date has passed and that is not Done.
    """

    category = django_filters.NumberFilter(field_name="category_id")
    due = django_filters.ChoiceFilter(choices=DUE_CHOICES, method="filter_due")

    class Meta:
        model = Task
        fields = ["status", "priority", "category", "due"]

    def filter_due(self, queryset, name, value):
        today = timezone.localdate()
        open_tasks = queryset.exclude(status=Task.Status.DONE)
        if value == "today":
            return open_tasks.filter(due_date=today)
        if value == "overdue":
            return open_tasks.filter(due_date__lt=today)
        if value == "upcoming":
            return open_tasks.filter(due_date__gt=today)
        return queryset


class TaskOrderingFilter(OrderingFilter):
    """OrderingFilter that sorts priority by importance and puts empty due dates last.

    * ``priority`` is ordered Low < Medium < High (not alphabetically) through
      the ``priority_rank`` annotation added in ``TaskViewSet.get_queryset``.
    * ``due_date`` places tasks without a due date at the end in both directions.
    """

    def get_ordering(self, request, queryset, view):
        ordering = super().get_ordering(request, queryset, view)
        if not ordering:
            return ordering

        mapped = []
        # Tie-breaker follows the primary direction so equal timestamps stay deterministic.
        tiebreaker = "-id" if str(ordering[0]).startswith("-") else "id"
        for term in ordering:
            descending = term.startswith("-")
            field = term.lstrip("-")
            if field == "priority":
                mapped.append(F("priority_rank").desc() if descending else F("priority_rank").asc())
            elif field == "due_date":
                mapped.append(
                    F("due_date").desc(nulls_last=True)
                    if descending
                    else F("due_date").asc(nulls_last=True)
                )
            else:
                mapped.append(term)
        mapped.append(tiebreaker)  # deterministic order for stable pagination
        return mapped
