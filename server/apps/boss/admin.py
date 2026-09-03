from django.contrib import admin

from .models import Boss, Debt, DebtSettlement, OfficeContribution, OfficeExpense


@admin.register(Boss)
class BossAdmin(admin.ModelAdmin):
    list_display = ("id", "name", "phone", "share_percent", "is_active")
    list_editable = ("share_percent", "is_active")
    search_fields = ("name", "phone")


@admin.register(OfficeContribution)
class OfficeContributionAdmin(admin.ModelAdmin):
    list_display = ("id", "boss", "amount", "date", "comment")
    list_filter = ("boss", "date")
    date_hierarchy = "date"


class DebtInline(admin.TabularInline):
    model = Debt
    extra = 0
    fields = ("debtor", "creditor", "amount", "is_settled")
    readonly_fields = ("debtor", "creditor", "amount", "is_settled")
    can_delete = False


@admin.register(OfficeExpense)
class OfficeExpenseAdmin(admin.ModelAdmin):
    list_display = ("id", "title", "category", "amount", "date", "paid_by")
    list_filter = ("category", "paid_by", "date")
    search_fields = ("title", "description")
    date_hierarchy = "date"
    inlines = (DebtInline,)


class DebtSettlementInline(admin.TabularInline):
    model = DebtSettlement
    extra = 0
    fields = ("amount", "date", "comment")


@admin.register(Debt)
class DebtAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "debtor",
        "creditor",
        "amount",
        "remaining_amount",
        "is_settled",
        "source_expense",
    )
    list_filter = ("is_settled", "debtor", "creditor")
    inlines = (DebtSettlementInline,)
