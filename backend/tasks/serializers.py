from django.utils import timezone
from rest_framework import serializers

from .models import Category, Subtask, Task
from .services import after_status_change


class CategorySerializer(serializers.ModelSerializer):
    task_count = serializers.SerializerMethodField()

    class Meta:
        model = Category
        fields = ("id", "user", "name", "color", "task_count", "created_at")
        read_only_fields = ("id", "user", "created_at")

    def get_task_count(self, obj):
        annotated = getattr(obj, "task_count_annotated", None)
        return annotated if annotated is not None else obj.tasks.count()

    def validate_name(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError("Name cannot be blank.")
        request = self.context.get("request")
        if request is not None:
            duplicates = Category.objects.filter(user=request.user, name__iexact=value)
            if self.instance is not None:
                duplicates = duplicates.exclude(pk=self.instance.pk)
            if duplicates.exists():
                raise serializers.ValidationError("You already have a category with this name.")
        return value


class CategoryMiniSerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = ("id", "name", "color")


class UserCategoryField(serializers.PrimaryKeyRelatedField):
    """Related field restricted to the requesting user's own categories."""

    default_error_messages = {
        "does_not_exist": "Category not found.",
        "incorrect_type": "Category must be an id.",
    }

    def get_queryset(self):
        request = self.context.get("request")
        if request is None or not request.user.is_authenticated:
            return Category.objects.none()
        return Category.objects.filter(user=request.user)


class SubtaskSerializer(serializers.ModelSerializer):
    class Meta:
        model = Subtask
        fields = ("id", "title", "is_completed", "created_at")
        read_only_fields = ("id", "created_at")
        extra_kwargs = {"title": {"max_length": 200}}

    def validate_title(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError("Title cannot be blank.")
        return value


class TaskSerializer(serializers.ModelSerializer):
    category = UserCategoryField(allow_null=True, required=False)
    category_detail = CategoryMiniSerializer(source="category", read_only=True)
    subtasks = SubtaskSerializer(many=True, read_only=True)
    subtask_count = serializers.SerializerMethodField()
    subtasks_completed = serializers.SerializerMethodField()
    is_overdue = serializers.BooleanField(read_only=True)

    class Meta:
        model = Task
        fields = (
            "id",
            "user",
            "title",
            "description",
            "category",
            "category_detail",
            "priority",
            "status",
            "due_date",
            "completed_at",
            "recurrence",
            "is_overdue",
            "subtasks",
            "subtask_count",
            "subtasks_completed",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "user", "completed_at", "created_at", "updated_at")
        extra_kwargs = {
            "title": {
                "min_length": 3,
                "max_length": 100,
                "error_messages": {
                    "min_length": "Title must be at least 3 characters.",
                    "max_length": "Title cannot exceed 100 characters.",
                },
            },
            "description": {"required": False, "allow_blank": True, "max_length": 2000},
        }

    def get_subtask_count(self, obj):
        return len(obj.subtasks.all())

    def get_subtasks_completed(self, obj):
        return sum(1 for subtask in obj.subtasks.all() if subtask.is_completed)

    def validate_due_date(self, value):
        # The "not in the past" rule applies when creating a task only, so that
        # existing (possibly overdue) tasks can still be edited.
        if self.instance is None and value is not None and value < timezone.localdate():
            raise serializers.ValidationError("Due date cannot be in the past.")
        return value

    def validate(self, attrs):
        instance = self.instance
        recurrence = attrs.get("recurrence", instance.recurrence if instance else Task.Recurrence.NONE)
        due_date = attrs.get("due_date", instance.due_date if instance else None)
        if recurrence != Task.Recurrence.NONE and due_date is None:
            raise serializers.ValidationError(
                {"due_date": ["A due date is required for recurring tasks."]}
            )
        return attrs

    def update(self, instance, validated_data):
        previous_status = instance.status
        instance = super().update(instance, validated_data)
        after_status_change(instance, previous_status)
        return instance
