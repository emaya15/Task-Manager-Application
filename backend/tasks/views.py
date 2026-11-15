from django.db import IntegrityError
from django.db.models import Case, Count, IntegerField, Q, Value, When
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.filters import SearchFilter
from rest_framework.response import Response

from .filters import TaskFilter, TaskOrderingFilter
from .models import Category, Task
from .serializers import CategorySerializer, SubtaskSerializer, TaskSerializer
from .services import after_status_change

DASHBOARD_LIST_LIMIT = 10


class CategoryViewSet(viewsets.ModelViewSet):
    """CRUD for the logged-in user's categories (unpaginated, ordered by name)."""

    serializer_class = CategorySerializer
    pagination_class = None

    def get_queryset(self):
        return Category.objects.filter(user=self.request.user).annotate(
            task_count_annotated=Count("tasks")
        )

    def perform_create(self, serializer):
        try:
            serializer.save(user=self.request.user)
        except IntegrityError:
            raise ValidationError({"name": ["You already have a category with this name."]})

    def perform_update(self, serializer):
        try:
            serializer.save()
        except IntegrityError:
            raise ValidationError({"name": ["You already have a category with this name."]})


class TaskViewSet(viewsets.ModelViewSet):
    """CRUD, filtering, search, ordering, dashboard and subtasks for the user's tasks."""

    serializer_class = TaskSerializer
    filter_backends = [DjangoFilterBackend, SearchFilter, TaskOrderingFilter]
    filterset_class = TaskFilter
    search_fields = ["title", "description"]
    ordering_fields = ["due_date", "priority", "created_at"]
    ordering = ["-created_at"]

    def get_queryset(self):
        # Scoping by user means another user's task is simply "not found" (404).
        return (
            Task.objects.filter(user=self.request.user)
            .select_related("category")
            .prefetch_related("subtasks")
            .annotate(
                priority_rank=Case(
                    When(priority=Task.Priority.LOW, then=Value(1)),
                    When(priority=Task.Priority.MEDIUM, then=Value(2)),
                    When(priority=Task.Priority.HIGH, then=Value(3)),
                    default=Value(0),
                    output_field=IntegerField(),
                )
            )
        )

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

    # ------------------------------------------------------------------
    # PATCH /api/tasks/{id}/toggle-complete/
    # ------------------------------------------------------------------
    @action(detail=True, methods=["patch"], url_path="toggle-complete")
    def toggle_complete(self, request, pk=None):
        task = self.get_object()
        previous_status = task.status
        task.status = Task.Status.TODO if task.status == Task.Status.DONE else Task.Status.DONE
        task.save()
        after_status_change(task, previous_status)
        return Response(self.get_serializer(task).data)

    # ------------------------------------------------------------------
    # GET /api/tasks/dashboard/
    # ------------------------------------------------------------------
    @action(detail=False, methods=["get"], url_path="dashboard")
    def dashboard(self, request):
        today = timezone.localdate()
        tasks = Task.objects.filter(user=request.user)
        not_done = ~Q(status=Task.Status.DONE)

        stats = tasks.aggregate(
            total=Count("id"),
            todo=Count("id", filter=Q(status=Task.Status.TODO)),
            in_progress=Count("id", filter=Q(status=Task.Status.IN_PROGRESS)),
            done=Count("id", filter=Q(status=Task.Status.DONE)),
            overdue=Count("id", filter=Q(due_date__lt=today) & not_done),
            due_today=Count("id", filter=Q(due_date=today) & not_done),
        )
        total = stats["total"]
        completion = round(stats["done"] * 100 / total, 1) if total else 0.0

        def serialize(queryset):
            queryset = queryset.select_related("category").prefetch_related("subtasks")
            return TaskSerializer(
                queryset[:DASHBOARD_LIST_LIMIT], many=True, context=self.get_serializer_context()
            ).data

        due_today_tasks = serialize(tasks.filter(due_date=today).exclude(status=Task.Status.DONE))
        overdue_tasks = serialize(
            tasks.filter(due_date__lt=today).exclude(status=Task.Status.DONE).order_by("due_date", "id")
        )

        categories = (
            Category.objects.filter(user=request.user)
            .annotate(
                count=Count("tasks"),
                completed=Count("tasks", filter=Q(tasks__status=Task.Status.DONE)),
            )
            .order_by("name")
        )
        category_stats = [
            {"id": c.id, "name": c.name, "color": c.color, "count": c.count, "completed": c.completed}
            for c in categories
        ]
        uncategorized = tasks.filter(category__isnull=True)
        uncategorized_count = uncategorized.count()
        if uncategorized_count:
            category_stats.append(
                {
                    "id": None,
                    "name": "Uncategorized",
                    "color": "#94a3b8",
                    "count": uncategorized_count,
                    "completed": uncategorized.filter(status=Task.Status.DONE).count(),
                }
            )

        return Response(
            {
                "total": total,
                "todo": stats["todo"],
                "in_progress": stats["in_progress"],
                "done": stats["done"],
                "overdue": stats["overdue"],
                "due_today": stats["due_today"],
                "completion_percentage": completion,
                "due_today_tasks": due_today_tasks,
                "overdue_tasks": overdue_tasks,
                "category_stats": category_stats,
            }
        )

    # ------------------------------------------------------------------
    # Subtasks (checklist items)
    # GET/POST   /api/tasks/{id}/subtasks/
    # PATCH/PUT/DELETE /api/tasks/{id}/subtasks/{subtask_id}/
    # ------------------------------------------------------------------
    @action(detail=True, methods=["get", "post"], url_path="subtasks", pagination_class=None)
    def subtasks(self, request, pk=None):
        task = self.get_object()
        if request.method == "GET":
            return Response(SubtaskSerializer(task.subtasks.all(), many=True).data)
        serializer = SubtaskSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save(task=task)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    @action(
        detail=True,
        methods=["patch", "put", "delete"],
        url_path=r"subtasks/(?P<subtask_id>[0-9]+)",
        url_name="subtask-detail",
    )
    def subtask_detail(self, request, pk=None, subtask_id=None):
        task = self.get_object()
        subtask = get_object_or_404(task.subtasks.all(), pk=subtask_id)
        if request.method == "DELETE":
            subtask.delete()
            return Response(status=status.HTTP_204_NO_CONTENT)
        serializer = SubtaskSerializer(
            subtask, data=request.data, partial=request.method == "PATCH"
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)
