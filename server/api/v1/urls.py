from django.urls import path, include
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import (
    TokenObtainPairView, TokenRefreshView, TokenVerifyView,
)

from apps.account.views.auth import Login
from apps.boss.views import BossViewSet, DebtViewSet, OfficeExpenseViewSet

router = DefaultRouter()
router.register("bosses", BossViewSet, basename="boss")
router.register("office-expenses", OfficeExpenseViewSet, basename="office-expense")
router.register("debts", DebtViewSet, basename="debt")

urlpatterns = [
    # path("auth/login/", Login.as_view(), name="login"),
    path("api/auth/login/",   TokenObtainPairView.as_view()),
    path("api/auth/refresh/", TokenRefreshView.as_view()),
    path("api/auth/verify/",  TokenVerifyView.as_view()),
    #
    path("", include(router.urls)),
]
