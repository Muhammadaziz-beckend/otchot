# REST_FRAMEWORK = {
#     "DEFAULT_RENDERER_CLASSES": [
#         "rest_framework.renderers.JSONRenderer",
#         "rest_framework.renderers.BrowsableAPIRenderer",
#     ],
#     "DEFAULT_AUTHENTICATION_CLASSES": [
#         "rest_framework_simplejwt.authentication.JWTAuthentication",
#     ],
#     "DEFAULT_PERMISSION_CLASSES": (
#         "rest_framework.permissions.IsAuthenticated",
#     ),
#     "DEFAULT_SCHEMA_CLASS": "drf_spectacular.openapi.AutoSchema",
# }


REST_FRAMEWORK = {
    "DEFAULT_RENDERER_CLASSES": [
        "rest_framework.renderers.JSONRenderer",
        "rest_framework.renderers.BrowsableAPIRenderer",
    ],
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "rest_framework.authentication.BasicAuthentication",
        "rest_framework.authentication.SessionAuthentication",
        "rest_framework.authentication.TokenAuthentication",
    ],
    "DEFAULT_SCHEMA_CLASS": "drf_spectacular.openapi.AutoSchema",
}