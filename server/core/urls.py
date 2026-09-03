"""
URL configuration for core project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/5.1/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
from django.contrib import admin
from django.conf import settings
from django.shortcuts import redirect
from django.urls import path, include, re_path
from django.views.static import serve
from api.docs import schema_view_v1

urlpatterns = [
    path("api/v1/",include('api.v1.urls')),

    # swaggers
    path("api/v1/swagger/", schema_view_v1.with_ui("swagger", cache_timeout=0)),

    path('admin/', admin.site.urls),
    path('',lambda r: redirect('admin/')),
]

# Статику раздаёт whitenoise (см. MIDDLEWARE/STATICFILES_STORAGE) - она
# работает независимо от DEBUG. А вот media (аватарки) whitenoise не
# трогает, а django.conf.urls.static.static() отдаёт их только при
# DEBUG=True, поэтому здесь раздаём media явно, без привязки к DEBUG.
# Для реального прод-трафика лучше отдавать media через nginx/S3, но
# для этого проекта этого достаточно.
urlpatterns += [
    re_path(r"^media/(?P<path>.*)$", serve, {"document_root": settings.MEDIA_ROOT}),
]
