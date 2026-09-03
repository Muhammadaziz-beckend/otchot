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

    4 знака после запятой (не 2) специально: 100% на 3 боссов не делится
    ровно при точности в 2 знака (33.33+33.33+33.34 - каждый уже не
    ровно треть), из-за чего при делении крупных сумм получались
    заметные расхождения в копейках. При 33.3333/33.3333/33.3334
    сумма всё ещё точно равна 100.0000, а расхождение при делении
    почти любой суммы уходит в пределах 1 копейки.
    """

    name = models.CharField("Имя", max_length=120)
    phone = models.CharField("Телефон", max_length=32, blank=True, null=True)
    share_percent = models.DecimalField(
        "Доля в бизнесе (%)",
        max_digits=7,
        decimal_places=4,
        validators=[MinValueValidator(Decimal("0")), MaxValueValidator(Decimal("100"))],
        help_text=(
            "Доля босса в офисе в процентах (до 4 знаков после запятой - "
            "например 33.3333). Сумма долей всех активных боссов должна "
            "быть равна 100."
        ),
    )
    is_active = models.BooleanField("Активен", default=True)

    class Meta:
        verbose_name = "Босс"
        verbose_name_plural = "Боссы"
        ordering = ("id",)

    def __str__(self):
        return f"{self.name} ({self.share_percent}%)"


class OfficeContribution(DataTimeCUAbstract):
    """
    Взнос (вложение) босса в общий фонд офиса.

    Из этого фонда в первую очередь оплачиваются расходы офиса
    (``OfficeExpense.paid_by = None``) — пока в фонде хватает денег,
    отдельные боссы не уходят в минус и долги между ними не возникают.
    Долг образуется только если кто-то из боссов платит за офис лично
    (``OfficeExpense.paid_by`` = конкретный босс), то есть в обход фонда.
    """

    boss = models.ForeignKey(
        Boss,
        on_delete=models.PROTECT,
        related_name="contributions",
        verbose_name="Кто вложил",
    )
    amount = models.DecimalField(
        "Сумма взноса",
        max_digits=12,
        decimal_places=2,
        validators=[MinValueValidator(Decimal("0.01"))],
    )
    date = models.DateField("Дата взноса")
    comment = models.CharField("Комментарий", max_length=255, blank=True, null=True)

    class Meta:
        verbose_name = "Взнос в фонд офиса"
        verbose_name_plural = "Взносы в фонд офиса"
        ordering = ("-date", "-id")

    def __str__(self):
        return f"{self.boss.name} -> фонд офиса: {self.amount}"


class OfficeExpense(DataTimeCUAbstract):
    """
    Расход на офис.

    Обычно оплачивается из общего фонда офиса (``paid_by = None``) —
    деньгами, которые боссы туда вложили (``OfficeContribution``). В этом
    случае долгов между боссами не возникает, фонд просто уменьшается.

    Если же расход оплатил лично один из боссов в обход фонда
    (``paid_by`` = этот босс), сумма автоматически делится между всеми
    активными боссами согласно их доле: доля оплатившего считается его
    собственным расходом, а доли остальных превращаются в записи
    ``Debt`` — долг перед оплатившим боссом.
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
        verbose_name="Кто оплатил лично",
        null=True,
        blank=True,
        help_text="Пусто — оплачено из фонда офиса. Указан босс — он оплатил лично, в обход фонда.",
    )

    class Meta:
        verbose_name = "Расход офиса"
        verbose_name_plural = "Расходы офиса"
        ordering = ("-date", "-id")

    def __str__(self):
        payer = self.paid_by.name if self.paid_by_id else "фонд офиса"
        return f"{self.title} — {self.amount} ({payer})"


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
