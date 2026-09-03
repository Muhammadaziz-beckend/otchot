"""
Бизнес-логика фонда офиса, расходов и долгов между боссами.

Идея:
    - Боссы вкладывают деньги в общий фонд офиса (OfficeContribution).
    - Расходы офиса обычно оплачиваются из этого фонда
      (OfficeExpense.paid_by = None) — фонд просто уменьшается, ни один
      босс лично ничего не платит и в минус не уходит, долгов не возникает.
    - Если фонда не хватает (или кто-то из боссов решает оплатить лично,
      в обход фонда), расход помечается paid_by = <конкретный босс>. Тогда
      сумма делится между всеми активными боссами пропорционально их доле
      (Boss.share_percent): доля оплатившего — его собственные деньги, а
      доли остальных превращаются в долг (Debt) перед оплатившим — он как
      бы одолжил им их часть.

Пример: расход 100 сом, фонд пуст, оплатил лично Босс А, доли поровну
(33.33/33.33/33.34).
    - Босс А потратил на офис свои 33.33 (это его расход).
    - Босс Б должен Боссу А 33.33.
    - Босс В должен Боссу А 33.34.
"""

from decimal import ROUND_HALF_UP, Decimal

from django.db import transaction
from django.db.models import Sum
from django.utils import timezone

from .models import Boss, Debt, DebtSettlement, OfficeContribution, OfficeExpense

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

    Если расход оплачен из фонда офиса (``paid_by is None``), долгов
    между боссами не возникает — фонд просто становится меньше.

    Если расход оплатил лично конкретный босс, каждый активный босс,
    кроме него, получает долг перед ним на сумму своей доли от
    ``expense.amount``. Метод идемпотентен: старые долги по этому расходу
    удаляются и создаются заново — но только если по ним ещё не было
    погашений (иначе пересчёт запрещён, чтобы не "потерять" уже
    возвращённые деньги).
    """
    existing = Debt.objects.filter(source_expense=expense)
    if DebtSettlement.objects.filter(debt__in=existing).exists():
        raise ExpenseHasSettlementsError(
            "Нельзя изменить этот расход: по связанным с ним долгам уже "
            "есть погашения. Сначала отмените погашения либо создайте "
            "корректирующий расход."
        )
    existing.delete()

    if expense.paid_by_id is None:
        return []  # оплачено из фонда офиса - долгов между боссами нет

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


def office_fund_balance(date_from=None, date_to=None) -> Decimal:
    """
    Текущий баланс общего фонда офиса: сумма всех взносов минус сумма
    расходов, оплаченных из фонда (``paid_by is None``). Расходы,
    оплаченные лично боссами в обход фонда, на баланс фонда не влияют.
    """
    contributions = OfficeContribution.objects.all()
    fund_expenses = OfficeExpense.objects.filter(paid_by__isnull=True)
    if date_from:
        contributions = contributions.filter(date__gte=date_from)
        fund_expenses = fund_expenses.filter(date__gte=date_from)
    if date_to:
        contributions = contributions.filter(date__lte=date_to)
        fund_expenses = fund_expenses.filter(date__lte=date_to)

    total_in = contributions.aggregate(s=Sum("amount"))["s"] or Decimal("0")
    total_out = fund_expenses.aggregate(s=Sum("amount"))["s"] or Decimal("0")
    return total_in - total_out


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
