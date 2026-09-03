import django_filters as df

from .models import Debt, OfficeContribution, OfficeExpense


class OfficeExpenseFilter(df.FilterSet):
    date_from = df.DateFilter(field_name="date", lookup_expr="gte")
    date_to = df.DateFilter(field_name="date", lookup_expr="lte")
    # true - только расходы из фонда офиса, false - только личные оплаты боссов
    from_fund = df.BooleanFilter(field_name="paid_by", lookup_expr="isnull")

    class Meta:
        model = OfficeExpense
        fields = ["paid_by", "category", "date_from", "date_to", "from_fund"]


class OfficeContributionFilter(df.FilterSet):
    date_from = df.DateFilter(field_name="date", lookup_expr="gte")
    date_to = df.DateFilter(field_name="date", lookup_expr="lte")

    class Meta:
        model = OfficeContribution
        fields = ["boss", "date_from", "date_to"]


class DebtFilter(df.FilterSet):
    date_from = df.DateFilter(field_name="create_dt", lookup_expr="date__gte")
    date_to = df.DateFilter(field_name="create_dt", lookup_expr="date__lte")

    class Meta:
        model = Debt
        fields = [
            "debtor",
            "creditor",
            "is_settled",
            "source_expense",
            "date_from",
            "date_to",
        ]
