from rest_framework.permissions import BasePermission, SAFE_METHODS

class IsCompanyManager(BasePermission):
    """
    Allows access only to Company / Sustainability Managers.
    """
    def has_permission(self, request, view):
        if not (request.user and request.user.is_authenticated):
            return False
        profile = getattr(request.user, 'profile', None)
        return bool(profile and profile.role in ('COMPANY_MANAGER', 'ADMIN') and profile.company is not None)

    def has_object_permission(self, request, view, obj):
        profile = getattr(request.user, 'profile', None)
        if not profile or not profile.company:
            return False
        # If obj has company attribute
        if hasattr(obj, 'company'):
            return obj.company_id == profile.company_id
        # If obj is a Supplier
        if hasattr(obj, 'customer_relationships'):
            return obj.customer_relationships.filter(company=profile.company).exists()
        return True


class IsSupplierUser(BasePermission):
    """
    Allows access only to Supplier representatives.
    """
    def has_permission(self, request, view):
        if not (request.user and request.user.is_authenticated):
            return False
        profile = getattr(request.user, 'profile', None)
        return bool(profile and profile.role == 'SUPPLIER' and profile.supplier is not None)

    def has_object_permission(self, request, view, obj):
        profile = getattr(request.user, 'profile', None)
        if not profile or not profile.supplier:
            return False
        # If object is the Supplier itself
        if hasattr(obj, 'supplier_code'):
            return obj.id == profile.supplier_id
        # If object has supplier attribute (e.g. SupplierActivityData)
        if hasattr(obj, 'supplier'):
            return obj.supplier_id == profile.supplier_id
        return False


class IsAuditor(BasePermission):
    """
    Allows read-only audit access to calculations, audit logs, and reports.
    """
    def has_permission(self, request, view):
        if not (request.user and request.user.is_authenticated):
            return False
        profile = getattr(request.user, 'profile', None)
        if not profile or profile.role != 'AUDITOR':
            return False
        # Auditors have read-only inspection rights
        return request.method in SAFE_METHODS

    def has_object_permission(self, request, view, obj):
        profile = getattr(request.user, 'profile', None)
        return bool(profile and profile.role == 'AUDITOR' and request.method in SAFE_METHODS)


class IsManagerOrAuditor(BasePermission):
    """
    Allows Company Managers (read/write) or Auditors (read-only)
    """
    def has_permission(self, request, view):
        if not (request.user and request.user.is_authenticated):
            return False
        profile = getattr(request.user, 'profile', None)
        if not profile:
            return False
        if profile.role in ('COMPANY_MANAGER', 'ADMIN') and profile.company:
            return True
        if profile.role == 'AUDITOR' and request.method in SAFE_METHODS:
            return True
        return False

    def has_object_permission(self, request, view, obj):
        profile = getattr(request.user, 'profile', None)
        if not profile:
            return False
        if profile.role in ('COMPANY_MANAGER', 'ADMIN'):
            if hasattr(obj, 'company'):
                return obj.company_id == profile.company_id
            return True
        if profile.role == 'AUDITOR' and request.method in SAFE_METHODS:
            return True
        return False


class IsPermittedToSubmitActivity(BasePermission):
    """
    Allows Company Managers (for their company's suppliers) or
    Supplier representatives (strictly for their own supplier).
    """
    def has_permission(self, request, view):
        if not (request.user and request.user.is_authenticated):
            return False
        profile = getattr(request.user, 'profile', None)
        return bool(profile and profile.role in ('COMPANY_MANAGER', 'ADMIN', 'SUPPLIER'))
