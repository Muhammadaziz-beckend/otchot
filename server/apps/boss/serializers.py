from decimal import Decimal

from rest_framework import serializers

from . import services
from .models import Boss, Debt, DebtSettlement, OfficeExpense


class BossSerializer(serializers.ModelSerializer):
    class Meta:
        model = Boss
        fields = (
            "id",
            "name",
            "phone",
            "share_percent",
            "is_active",
            "create_dt",
            "update_dt",
        )


class OfficeExpenseSerializer(serializers.ModelSerializer):
    paid_by_name = serializers.CharField(source="paid_by.name", read_only=True)
    category_display = serializers.CharField(
        source="get_category_display", read_only=True
    )

    class Meta:
        model = OfficeExpense
        fields = (
            "id",
            "title",
            "description",
            "category",
            "category_display",
            "amount",
            "date",
            "paid_by",
            "paid_by_name",
            "create_dt",
            "update_dt",
        )

    def create(self, validated_data):
        expense = super().create(validated_data)
        try:
            services.split_expense_debts(expense)
        except services.ExpenseHasSettlementsError as exc:  # pragma: no cover - defensive
            raise serializers.ValidationError(str(exc))
        return expense

    def update(self, instance, validated_data):
        try:
            expense = super().update(instance, validated_data)
            services.split_expense_debts(expense)
        except services.ExpenseHasSettlementsError as exc:
            raise serializers.ValidationError(str(exc))
        return expense


class DebtSettlementSerializer(serializers.ModelSerializer):
    class Meta:
        model = DebtSettlement
        fields = ("id", "debt", "amount", "date", "comment", "create_dt")
        read_only_fields = ("debt", "create_dt")


class DebtSerializer(serializers.ModelSerializer):
    debtor_name = serializers.CharField(source="debtor.name", read_only=True)
    creditor_name = serializers.CharField(source="creditor.name", read_only=True)
    repaid_amount = serializers.DecimalField(
        max_digits=12, decimal_places=2, read_only=True
    )
    remaining_amount = serializers.DecimalField(
        max_digits=12, decimal_places=2, read_only=True
    )
    settlements = DebtSettlementSerializer(many=True, read_only=True)

    class Meta:
        model = Debt
        fields = (
            "id",
            "debtor",
            "debtor_name",
            "creditor",
            "creditor_name",
            "source_expense",
            "amount",
            "repaid_amount",
            "remaining_amount",
            "is_settled",
            "settled_at",
            "settlements",
            "create_dt",
        )
        read_only_fields = fields


class DebtSettleActionSerializer(serializers.Serializer):
    amount = serializers.DecimalField(
        max_digits=12, decimal_places=2, min_value=Decimal("0.01")
    )
    date = serializers.DateField()
    comment = serializers.CharField(required=False, allow_blank=True, default="")


class BossSummarySerializer(serializers.Serializer):
    boss = BossSerializer()
    total_paid = serializers.DecimalField(max_digits=14, decimal_places=2)
    total_obligation = serializers.DecimalField(max_digits=14, decimal_places=2)
    balance = serializers.DecimalField(max_digits=14, decimal_places=2)
    owed_to_him = serializers.DecimalField(max_digits=14, decimal_places=2)
    owes_to_others = serializers.DecimalField(max_digits=14, decimal_places=2)
    net_debt_balance = serializers.DecimalField(max_digits=14, decimal_places=2)


class OfficeReportSerializer(serializers.Serializer):
    date_from = serializers.CharField(allow_null=True)
    date_to = serializers.CharField(allow_null=True)
    total_expenses = serializers.DecimalField(max_digits=14, decimal_places=2)
    shares_total_percent = serializers.DecimalField(max_digits=6, decimal_places=2)
    bosses = BossSummarySerializer(many=True)
