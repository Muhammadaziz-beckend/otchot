from django.urls import path, include
from rest_framework.routers import DefaultRouter

from apps.account.views.auth import Login
from apps.boss.views import BossViewSet, DebtViewSet, OfficeExpenseViewSet

router = DefaultRouter()
router.register("bosses", BossViewSet, basename="boss")
router.register("office-expenses", OfficeExpenseViewSet, basename="office-expense")
router.register("debts", DebtViewSet, basename="debt")

urlpatterns = [
    path("api/auth/login/", Login.as_view()),
    #
    path("", include(router.urls)),
]
