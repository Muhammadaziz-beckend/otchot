"""
Бизнес-логика распределения расходов офиса и долгов между боссами.

Идея:
    - Каждый босс владеет долей офиса (Boss.share_percent).
    - Когда создаётся расход офиса (OfficeExpense), его сумма делится
      между всеми активными боссами пропорционально их долям.
    - Доля того, кто фактически оплатил расход, — это его собственные
      деньги, потраченные на офис (не долг).
    - Доли остальных боссов превращаются в долг (Debt) перед оплатившим:
      он как бы одолжил им их часть.

Пример: расход 100 сом оплатил Босс А, доли поровну (33.33/33.33/33.34).
    - Босс А потратил на офис свои 33.33 (это его расход).
    - Босс Б должен Боссу А 33.33.
    - Босс В должен Боссу А 33.34.
"""

from decimal import ROUND_HALF_UP, Decimal

from django.db import transaction
from django.utils import timezone

from .models import Boss, Debt, DebtSettlement, OfficeExpense

TWO_PLACES = Decimal("0.01")


def _round(value: Decimal) -> Decimal:
    return value.quantize(TWO_PLACES, rounding=ROUND_HALF_UP)


def calculate_shares(amount: Decimal, bosses: list[Boss]) -> dict[int, Decimal]:
    """
    Делит ``amount`` между ``bosses`` пропорционально их ``share_percent``.

    Округление каждой доли до копеек может дать сумму, чуть отличающуюся
    от ``amount`` (например 33.33 + 33.33 + 33.33 = 99.99 вместо 100).
    Чтобы сумма долей всегда точно совпадала с ``amount``, доля последнего
    босса в списке досчитывается как остаток, а не округляется отдельно.
    """
    bosses = list(bosses)
    shares: dict[int, Decimal] = {}
    allocated = Decimal("0")
    for boss in bosses[:-1]:
        part = _round(amount * boss.share_percent / Decimal("100"))
        shares[boss.id] = part
        allocated += part
    if bosses:
        shares[bosses[-1].id] = amount - allocated
    return shares


class ExpenseHasSettlementsError(ValueError):
    """Расход нельзя изменить/удалить — по его долгам уже есть погашения."""


@transaction.atomic
def split_expense_debts(expense: OfficeExpense) -> list[Debt]:
    """
    Пересчитывает долги для расхода офиса.

    Каждый активный босс, кроме оплатившего, получает долг перед
    оплатившим на сумму своей доли от ``expense.amount``. Метод
    идемпотентен: старые долги по этому расходу удаляются и создаются
    заново — но только если по ним ещё не было погашений (иначе
    пересчёт запрещён, чтобы не "потерять" уже возвращённые деньги).
    """
    existing = Debt.objects.filter(source_expense=expense)
    if DebtSettlement.objects.filter(debt__in=existing).exists():
        raise ExpenseHasSettlementsError(
            "Нельзя изменить этот расход: по связанным с ним долгам уже "
            "есть погашения. Сначала отмените погашения либо создайте "
            "корректирующий расход."
        )
    existing.delete()

    bosses = list(Boss.objects.filter(is_active=True).order_by("id"))
    if not bosses:
        return []

    shares = calculate_shares(expense.amount, bosses)

    created = []
    for boss in bosses:
        if boss.id == expense.paid_by_id:
            continue  # его собственная доля - это его расход, не долг
        debt = Debt.objects.create(
            debtor=boss,
            creditor=expense.paid_by,
            source_expense=expense,
            amount=shares[boss.id],
        )
        created.append(debt)
    return created


@transaction.atomic
def delete_expense(expense: OfficeExpense) -> None:
    """Удаляет расход, если по его долгам ещё не было погашений."""
    existing = Debt.objects.filter(source_expense=expense)
    if DebtSettlement.objects.filter(debt__in=existing).exists():
        raise ExpenseHasSettlementsError(
            "Нельзя удалить этот расход: по связанным с ним долгам уже "
            "есть погашения."
        )
    expense.delete()


@transaction.atomic
def settle_debt(debt: Debt, amount: Decimal, date, comment: str = "") -> DebtSettlement:
    """Регистрирует погашение (полное или частичное) долга между боссами."""
    if amount <= 0:
        raise ValueError("Сумма погашения должна быть положительной.")
    if amount > debt.remaining_amount:
        raise ValueError("Сумма погашения превышает оставшийся долг.")

    settlement = DebtSettlement.objects.create(
        debt=debt,
        amount=amount,
        date=date,
        comment=comment,
    )

    debt.refresh_from_db()
    if debt.remaining_amount <= 0:
        debt.is_settled = True
        debt.settled_at = timezone.now()
        debt.save(update_fields=["is_settled", "settled_at"])

    return settlement
