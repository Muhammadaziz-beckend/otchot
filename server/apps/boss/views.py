from decimal import Decimal

from django.db.models import Sum
from django.shortcuts import get_object_or_404
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import status
from rest_framework.decorators import action
from rest_framework.filters import OrderingFilter, SearchFilter
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.viewsets import ModelViewSet, ReadOnlyModelViewSet

from utils.mixins import UltraModelViewSet
from utils.paginations import PaginatorClass

from . import services
from .filters import DebtFilter, OfficeContributionFilter, OfficeExpenseFilter
from .models import Boss, Debt, OfficeContribution, OfficeExpense
from .serializers import (
    BossSerializer,
    BossSummarySerializer,
    DebtSerializer,
    DebtSettleActionSerializer,
    OfficeContributionSerializer,
    OfficeExpenseSerializer,
    OfficeReportSerializer,
)


def _period_filtered_expenses(date_from=None, date_to=None):
    qs = OfficeExpense.objects.all()
    if date_from:
        qs = qs.filter(date__gte=date_from)
    if date_to:
        qs = qs.filter(date__lte=date_to)
    return qs


def _period_filtered_contributions(date_from=None, date_to=None):
    qs = OfficeContribution.objects.all()
    if date_from:
        qs = qs.filter(date__gte=date_from)
    if date_to:
        qs = qs.filter(date__lte=date_to)
    return qs


def _boss_summary(boss: Boss, expenses_qs, contributions_qs) -> dict:
    """
    Считает отчёт по одному боссу за период.

    - total_contributed — сколько босс вложил в фонд офиса за период.
    - total_paid — сколько босс лично оплатил расходов офиса в обход
      фонда (расходы, оплаченные из фонда, тут не учитываются - за них
      никто из боссов лично не платил).
    - total_obligation — сколько он "должен был" отдать по своей доле от
      всех расходов офиса за период (независимо от того, из чьих денег
      они оплачены - из фонда или лично кем-то из боссов).
    - balance = total_paid - total_obligation. Положительный — босс
      лично заплатил больше своей доли (переплатил за других), но не
      учитывает его взносы в фонд - для этого есть total_contributed.
    - owed_to_him / owes_to_others / net_debt_balance — актуальный остаток
      по долгам (Debt) между боссами с учётом уже сделанных погашений.
      Долги возникают только по лично оплаченным расходам, не по тем,
      что оплачены из фонда.
    """
    total_contributed = contributions_qs.filter(boss=boss).aggregate(s=Sum("amount"))["s"] or Decimal("0")
    total_paid = expenses_qs.filter(paid_by=boss).aggregate(s=Sum("amount"))["s"] or Decimal("0")
    total_expenses = expenses_qs.aggregate(s=Sum("amount"))["s"] or Decimal("0")
    total_obligation = (total_expenses * boss.share_percent / Decimal("100")).quantize(Decimal("0.01"))

    # Считаем именно остаток (amount - уже погашенное), а не исходную сумму
    # долга — иначе частично погашенный долг всё ещё учитывался бы целиком.
    debts_qs = Debt.objects.filter(source_expense__in=expenses_qs)
    owed_to_him = sum(
        (d.remaining_amount for d in debts_qs.filter(creditor=boss, is_settled=False)),
        Decimal("0"),
    )
    owes_to_others = sum(
        (d.remaining_amount for d in debts_qs.filter(debtor=boss, is_settled=False)),
        Decimal("0"),
    )

    return {
        "boss": boss,
        "total_contributed": total_contributed,
        "total_paid": total_paid,
        "total_obligation": total_obligation,
        "balance": total_paid - total_obligation,
        "owed_to_him": owed_to_him,
        "owes_to_others": owes_to_others,
        "net_debt_balance": owed_to_him - owes_to_others,
    }


class BossViewSet(UltraModelViewSet):
    """
    CRUD боссов + отчёты.

    GET /bosses/{id}/summary/?date_from=&date_to=  — отчёт по одному боссу
    GET /bosses/report/?date_from=&date_to()       — отчёт по офису целиком
    """

    queryset = Boss.objects.all()
    serializer_class = BossSerializer
    pagination_class = PaginatorClass
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ["is_active"]
    search_fields = ["name", "phone"]
    ordering_fields = ["name", "share_percent", "create_dt"]

    @action(detail=True, methods=["get"])
    def summary(self, request, pk=None):
        boss = self.get_object()
        date_from = request.query_params.get("date_from")
        date_to = request.query_params.get("date_to")
        expenses_qs = _period_filtered_expenses(date_from, date_to)
        contributions_qs = _period_filtered_contributions(date_from, date_to)
        data = _boss_summary(boss, expenses_qs, contributions_qs)
        return Response(BossSummarySerializer(data).data)

    @action(detail=False, methods=["get"], url_path="report")
    def report(self, request):
        date_from = request.query_params.get("date_from")
        date_to = request.query_params.get("date_to")
        expenses_qs = _period_filtered_expenses(date_from, date_to)
        contributions_qs = _period_filtered_contributions(date_from, date_to)

        bosses = Boss.objects.filter(is_active=True).order_by("id")
        shares_total = bosses.aggregate(s=Sum("share_percent"))["s"] or Decimal("0")

        expenses_from_fund = expenses_qs.filter(paid_by__isnull=True).aggregate(s=Sum("amount"))["s"] or Decimal("0")
        expenses_personal = expenses_qs.filter(paid_by__isnull=False).aggregate(s=Sum("amount"))["s"] or Decimal("0")

        data = {
            "date_from": date_from,
            "date_to": date_to,
            "total_expenses": expenses_qs.aggregate(s=Sum("amount"))["s"] or Decimal("0"),
            "total_expenses_from_fund": expenses_from_fund,
            "total_expenses_personal": expenses_personal,
            "total_contributions": contributions_qs.aggregate(s=Sum("amount"))["s"] or Decimal("0"),
            "fund_balance": services.office_fund_balance(),
            "shares_total_percent": shares_total,
            "bosses": [_boss_summary(boss, expenses_qs, contributions_qs) for boss in bosses],
        }
        return Response(OfficeReportSerializer(data).data)


class OfficeExpenseViewSet(UltraModelViewSet):
    """
    Расходы офиса. Фильтры: ?paid_by=<boss_id> — сколько и что оплатил
    конкретный босс; ?category=; ?date_from=&date_to=; ?search=.

    При создании/изменении суммы или плательщика долги между боссами
    пересчитываются автоматически (см. apps.boss.services).
    Изменить/удалить расход, по долгам которого уже было погашение,
    нельзя — API вернёт 400.
    """

    queryset = OfficeExpense.objects.select_related("paid_by").all()
    serializer_class = OfficeExpenseSerializer
    pagination_class = PaginatorClass
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_class = OfficeExpenseFilter
    search_fields = ["title", "description"]
    ordering_fields = ["date", "amount", "create_dt"]

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        try:
            services.delete_expense(instance)
        except services.ExpenseHasSettlementsError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(status=status.HTTP_204_NO_CONTENT)


class OfficeContributionViewSet(UltraModelViewSet):
    """
    Взносы боссов в общий фонд офиса. Фильтры: ?boss=<id>, ?date_from=,
    ?date_to=. Текущий баланс фонда доступен в GET /bosses/report/
    (поле fund_balance) и пересчитывается автоматически.
    """

    queryset = OfficeContribution.objects.select_related("boss").all()
    serializer_class = OfficeContributionSerializer
    pagination_class = PaginatorClass
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, OrderingFilter]
    filterset_class = OfficeContributionFilter
    ordering_fields = ["date", "amount", "create_dt"]


class DebtViewSet(ReadOnlyModelViewSet):
    """
    Долги между боссами (только чтение + погашение).
    Фильтры: ?debtor=, ?creditor=, ?is_settled=, ?source_expense=.

    POST /debts/{id}/settle/  { "amount": "33.33", "date": "2026-09-03", "comment": "" }
    Регистрирует полное или частичное погашение долга.
    """

    queryset = Debt.objects.select_related(
        "debtor", "creditor", "source_expense"
    ).prefetch_related("settlements").all()
    serializer_class = DebtSerializer
    pagination_class = PaginatorClass
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend]
    filterset_class = DebtFilter

    @action(detail=True, methods=["post"])
    def settle(self, request, pk=None):
        debt = self.get_object()
        serializer = DebtSettleActionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        try:
            services.settle_debt(
                debt,
                amount=serializer.validated_data["amount"],
                date=serializer.validated_data["date"],
                comment=serializer.validated_data.get("comment", ""),
            )
        except ValueError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        debt.refresh_from_db()
        return Response(DebtSerializer(debt).data)
