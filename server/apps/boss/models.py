from decimal import Decimal

from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models

from utils.models import DataTimeCUAbstract


class Boss(DataTimeCUAbstract):
    """
    Совладелец бизнеса (партнёр), который инвестирует в офис по своей доле.

    ``share_percent`` — доля босса в офисе в процентах. Именно по ней
    делятся расходы офиса между боссами (см. ``apps.boss.services``).
    Сумма долей всех активных боссов должна быть равна 100.
    """

    name = models.CharField("Имя", max_length=120)
    phone = models.CharField("Телефон", max_length=32, blank=True, null=True)
    share_percent = models.DecimalField(
        "Доля в бизнесе (%)",
        max_digits=5,
        decimal_places=2,
        validators=[MinValueValidator(Decimal("0")), MaxValueValidator(Decimal("100"))],
        help_text=(
            "Доля босса в офисе в процентах. Сумма долей всех активных "
            "боссов должна быть равна 100."
        ),
    )
    is_active = models.BooleanField("Активен", default=True)

    class Meta:
        verbose_name = "Босс"
        verbose_name_plural = "Боссы"
        ordering = ("id",)

    def __str__(self):
        return f"{self.name} ({self.share_percent}%)"


class OfficeExpense(DataTimeCUAbstract):
    """
    Расход на офис, фактически оплаченный одним из боссов.

    При сохранении расхода сумма автоматически делится между всеми
    активными боссами согласно их доле: доля оплатившего босса считается
    его собственным расходом, а доли остальных боссов превращаются в
    записи ``Debt`` — долг перед оплатившим боссом.
    """

    class Category(models.TextChoices):
        RENT = "rent", "Аренда"
        UTILITIES = "utilities", "Коммунальные услуги"
        REPAIR = "repair", "Ремонт"
        SUPPLIES = "supplies", "Хозтовары"
        SALARY = "salary", "Зарплата персонала"
        OTHER = "other", "Другое"

    title = models.CharField("Название", max_length=255)
    description = models.TextField("Описание", blank=True, null=True)
    category = models.CharField(
        "Категория",
        max_length=20,
        choices=Category.choices,
        default=Category.OTHER,
    )
    amount = models.DecimalField(
        "Сумма",
        max_digits=12,
        decimal_places=2,
        validators=[MinValueValidator(Decimal("0.01"))],
    )
    date = models.DateField("Дата расхода")
    paid_by = models.ForeignKey(
        Boss,
        on_delete=models.PROTECT,
        related_name="expenses",
        verbose_name="Кто оплатил",
    )

    class Meta:
        verbose_name = "Расход офиса"
        verbose_name_plural = "Расходы офиса"
        ordering = ("-date", "-id")

    def __str__(self):
        return f"{self.title} — {self.amount} ({self.paid_by.name})"


class Debt(DataTimeCUAbstract):
    """
    Долг одного босса перед другим.

    Образуется автоматически при создании ``OfficeExpense``: если офис
    "в минусе" и один босс оплачивает расход за всех, то доли остальных
    боссов (по их ``share_percent``) становятся их долгом перед тем, кто
    заплатил — то есть оплативший как бы одолжил им деньги.
    """

    debtor = models.ForeignKey(
        Boss,
        on_delete=models.CASCADE,
        related_name="debts_owed",
        verbose_name="Должник",
    )
    creditor = models.ForeignKey(
        Boss,
        on_delete=models.CASCADE,
        related_name="debts_receivable",
        verbose_name="Кредитор (кому должны)",
    )
    source_expense = models.ForeignKey(
        OfficeExpense,
        on_delete=models.CASCADE,
        related_name="debts",
        verbose_name="Расход-основание",
        null=True,
        blank=True,
    )
    amount = models.DecimalField("Сумма долга", max_digits=12, decimal_places=2)
    is_settled = models.BooleanField("Погашен", default=False)
    settled_at = models.DateTimeField("Дата погашения", null=True, blank=True)

    class Meta:
        verbose_name = "Долг между боссами"
        verbose_name_plural = "Долги между боссами"
        ordering = ("-create_dt",)

    def __str__(self):
        return f"{self.debtor.name} -> {self.creditor.name}: {self.amount}"

    @property
    def repaid_amount(self) -> Decimal:
        total = self.settlements.aggregate(s=models.Sum("amount"))["s"]
        return total or Decimal("0")

    @property
    def remaining_amount(self) -> Decimal:
        return self.amount - self.repaid_amount


class DebtSettlement(DataTimeCUAbstract):
    """Погашение (частичное или полное) долга между боссами."""

    debt = models.ForeignKey(
        Debt,
        on_delete=models.CASCADE,
        related_name="settlements",
        verbose_name="Долг",
    )
    amount = models.DecimalField(
        "Сумма погашения",
        max_digits=12,
        decimal_places=2,
        validators=[MinValueValidator(Decimal("0.01"))],
    )
    date = models.DateField("Дата погашения")
    comment = models.CharField("Комментарий", max_length=255, blank=True, null=True)

    class Meta:
        verbose_name = "Погашение долга"
        verbose_name_plural = "Погашения долгов"
        ordering = ("-date", "-id")

    def __str__(self):
        return f"{self.debt} — {self.amount}"
