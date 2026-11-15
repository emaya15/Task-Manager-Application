"""Business logic that goes beyond a single serializer/view (recurring tasks)."""
from datetime import timedelta

from django.utils import timezone

from .models import Subtask, Task

RECURRENCE_DELTAS = {
    Task.Recurrence.DAILY: timedelta(days=1),
    Task.Recurrence.WEEKLY: timedelta(weeks=1),
}


def spawn_next_occurrence(task):
    """Create the next copy of a completed recurring task.

    The new task is due one period after the completed one (moved forward until
    it is not in the past). Returns the new task, an existing identical open
    task (so toggling Done repeatedly never creates duplicates) or ``None`` when
    the task does not recur.
    """
    delta = RECURRENCE_DELTAS.get(task.recurrence)
    if delta is None or task.due_date is None:
        return None

    today = timezone.localdate()
    next_due = task.due_date + delta
    while next_due < today:
        next_due += delta

    existing = (
        Task.objects.filter(
            user=task.user,
            title=task.title,
            recurrence=task.recurrence,
            due_date=next_due,
        )
        .exclude(status=Task.Status.DONE)
        .first()
    )
    if existing:
        return existing

    new_task = Task.objects.create(
        user=task.user,
        title=task.title,
        description=task.description,
        category=task.category,
        priority=task.priority,
        status=Task.Status.TODO,
        due_date=next_due,
        recurrence=task.recurrence,
    )
    Subtask.objects.bulk_create(
        [Subtask(task=new_task, title=s.title, is_completed=False) for s in task.subtasks.all()]
    )
    return new_task


def after_status_change(task, previous_status):
    """Hook run after a task's status was saved."""
    if previous_status != Task.Status.DONE and task.status == Task.Status.DONE:
        return spawn_next_occurrence(task)
    return None
