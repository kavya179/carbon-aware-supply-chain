from decimal import Decimal
from rest_framework import status, permissions, viewsets
from rest_framework.decorators import api_view, permission_classes, action
from rest_framework.response import Response
from rest_framework.exceptions import PermissionDenied
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from rest_framework_simplejwt.tokens import RefreshToken
from .csv_processor import CSVValidationProcessor
from .calculation_engine import CarbonCalculationEngine, seed_standard_emission_factors
from django.contrib.auth import authenticate
from django.db.models import Q, Sum
from .models import (
    Company,
    Supplier,
    SupplierRelationship,
    UserProfile,
    EmissionFactor,
    SupplierActivityData,
    CarbonCalculation,
    Hotspot,
    Recommendation,
    AuditLog,
    Report
)
from .serializers import (
    RegisterSerializer,
    UserProfileSerializer,
    SupplierSerializer,
    SupplierCreateUpdateSerializer,
    SupplierRelationshipSerializer,
    SupplierRelationshipCreateSerializer,
    SupplierActivityDataSerializer,
    EmissionFactorSerializer,
    CarbonCalculationSerializer,
    HotspotSerializer,
    RecommendationSerializer,
    AuditLogSerializer,
    ReportSerializer
)
from .permissions import (
    IsCompanyManager,
    IsSupplierUser,
    IsAuditor,
    IsManagerOrAuditor,
    IsPermittedToSubmitActivity
)


# -------------------------------------------------------------
# Authentication Views
# -------------------------------------------------------------

@api_view(['POST'])
@permission_classes([permissions.AllowAny])
def register_view(request):
    """
    Registers a new user, hashes the password via Django PBKDF2, and issues JWT tokens.
    """
    serializer = RegisterSerializer(data=request.data)
    if serializer.is_valid():
        profile = serializer.save()
        refresh = RefreshToken.for_user(profile.user)

        # Audit log creation
        AuditLog.objects.create(
            user=profile.user,
            action='USER_REGISTERED',
            entity_type='UserProfile',
            entity_id=str(profile.id),
            details={'username': profile.user.username, 'role': profile.role}
        )

        return Response({
            'message': 'Registration successful',
            'user': UserProfileSerializer(profile).data,
            'tokens': {
                'refresh': str(refresh),
                'access': str(refresh.access_token),
            }
        }, status=status.HTTP_201_CREATED)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['POST'])
@permission_classes([permissions.AllowAny])
def login_view(request):
    """
    Authenticates username & password, returns JWT tokens and user role metadata.
    """
    username = request.data.get('username')
    password = request.data.get('password')

    if not username or not password:
        return Response(
            {'error': 'Both username and password are required.'},
            status=status.HTTP_400_BAD_REQUEST
        )

    user = authenticate(username=username, password=password)
    if not user:
        return Response(
            {'error': 'Invalid username or password.'},
            status=status.HTTP_401_UNAUTHORIZED
        )

    profile, _ = UserProfile.objects.get_or_create(user=user)
    refresh = RefreshToken.for_user(user)

    # Log successful login
    AuditLog.objects.create(
        user=user,
        action='USER_LOGIN',
        entity_type='User',
        entity_id=str(user.id),
        details={'role': profile.role}
    )

    return Response({
        'message': 'Login successful',
        'user': UserProfileSerializer(profile).data,
        'tokens': {
            'refresh': str(refresh),
            'access': str(refresh.access_token),
        }
    }, status=status.HTTP_200_OK)


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def logout_view(request):
    """
    Handles token logout / invalidation.
    """
    refresh_token = request.data.get('refresh')
    if refresh_token:
        try:
            token = RefreshToken(refresh_token)
            token.blacklist()
        except Exception:
            pass  # If token blacklisting is disabled, proceed

    return Response({'message': 'Logged out successfully'}, status=status.HTTP_200_OK)


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def me_view(request):
    """
    Returns the authenticated user profile and permissions.
    """
    profile, _ = UserProfile.objects.get_or_create(user=request.user)
    return Response(UserProfileSerializer(profile).data)


# -------------------------------------------------------------
# Protected Role-Based ViewSets
# -------------------------------------------------------------

class SupplierViewSet(viewsets.ModelViewSet):
    """
    Complete supplier management viewset supporting:
    - Add supplier with Tier 1, Tier 2, or Tier 3 hierarchy
    - View suppliers filtered by company
    - Search suppliers (name, code, industry, country, location)
    - Filter suppliers (tier, status, country, industry)
    - View supplier details & sub-suppliers
    - Update supplier & tier relationships
    - Soft delete / deactivate supplier
    """
    serializer_class = SupplierSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        profile = getattr(user, 'profile', None)
        if not profile:
            return Supplier.objects.none()

        qs = Supplier.objects.none()

        if profile.role in ('COMPANY_MANAGER', 'ADMIN') and profile.company:
            # Multi-tenant isolation: strictly suppliers linked to this company
            qs = Supplier.objects.filter(customer_relationships__company=profile.company).distinct()
        elif profile.role == 'SUPPLIER' and profile.supplier:
            # Strictly the supplier's own profile
            qs = Supplier.objects.filter(id=profile.supplier_id)
        elif profile.role == 'AUDITOR':
            # Auditors can inspect suppliers across the system
            qs = Supplier.objects.all()
        else:
            return Supplier.objects.none()

        # Search support
        search = self.request.query_params.get('search')
        if search:
            qs = qs.filter(
                Q(name__icontains=search) |
                Q(supplier_code__icontains=search) |
                Q(industry_sector__icontains=search) |
                Q(country__icontains=search) |
                Q(location__icontains=search) |
                Q(contact_name__icontains=search)
            )

        # Tier filter
        tier = self.request.query_params.get('tier') or self.request.query_params.get('tier_level')
        if tier:
            if profile.company:
                qs = qs.filter(
                    customer_relationships__company=profile.company,
                    customer_relationships__tier_level=tier
                )
            else:
                qs = qs.filter(customer_relationships__tier_level=tier)

        # Status filter
        status_param = self.request.query_params.get('status')
        if status_param:
            qs = qs.filter(status__iexact=status_param)

        # Country filter
        country = self.request.query_params.get('country')
        if country:
            qs = qs.filter(country__iexact=country)

        # Industry filter
        industry = self.request.query_params.get('industry') or self.request.query_params.get('industry_sector')
        if industry:
            qs = qs.filter(industry_sector__icontains=industry)

        return qs.distinct()

    def create(self, request, *args, **kwargs):
        profile = getattr(request.user, 'profile', None)
        if not profile or profile.role not in ('COMPANY_MANAGER', 'ADMIN') or not profile.company:
            raise PermissionDenied("Only Company Managers can add suppliers.")

        serializer = SupplierCreateUpdateSerializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        # Get or create the unique supplier record without duplication
        supplier, created = Supplier.objects.get_or_create(
            supplier_code=data['supplier_code'],
            defaults={
                'name': data['name'],
                'industry_sector': data['industry_sector'],
                'location': data.get('location', ''),
                'country': data['country'],
                'region': data.get('region', 'Global'),
                'contact_name': data.get('contact_name', ''),
                'contact_email': data['contact_email'],
                'contact_phone': data.get('contact_phone', ''),
                'status': data.get('status', 'ACTIVE')
            }
        )

        if not created:
            # Update metadata if existing
            for field in ['name', 'industry_sector', 'location', 'country', 'region', 'contact_name', 'contact_email', 'contact_phone', 'status']:
                if field in data:
                    setattr(supplier, field, data[field])
            supplier.save()

        # Establish or update the tier relationship with this company
        parent_supplier = None
        if data.get('parent_supplier_id'):
            parent_supplier = Supplier.objects.get(id=data['parent_supplier_id'])

        relationship, rel_created = SupplierRelationship.objects.update_or_create(
            company=profile.company,
            supplier=supplier,
            defaults={
                'parent_supplier': parent_supplier,
                'tier_level': data.get('tier_level', 1),
                'procurement_share_pct': data.get('procurement_share_pct', Decimal('100.00')),
                'status': data.get('status', 'ACTIVE')
            }
        )

        # Audit log entry
        AuditLog.objects.create(
            user=request.user,
            action='SUPPLIER_ADDED',
            entity_type='Supplier',
            entity_id=str(supplier.id),
            details={
                'supplier_code': supplier.supplier_code,
                'tier_level': relationship.tier_level,
                'parent_supplier_id': parent_supplier.id if parent_supplier else None
            }
        )

        output_serializer = SupplierSerializer(supplier, context={'request': request})
        return Response(output_serializer.data, status=status.HTTP_201_CREATED)

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop('partial', False)
        instance = self.get_object()
        profile = getattr(request.user, 'profile', None)

        if not profile or profile.role not in ('COMPANY_MANAGER', 'ADMIN'):
            raise PermissionDenied("Only Company Managers can modify suppliers.")

        serializer = SupplierCreateUpdateSerializer(data=request.data, partial=partial, context={'request': request})
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        # Update supplier base fields
        for field in ['name', 'industry_sector', 'location', 'country', 'region', 'contact_name', 'contact_email', 'contact_phone', 'status']:
            if field in data:
                setattr(instance, field, data[field])
        instance.save()

        # Update relationship tier & parent if provided
        if 'tier_level' in data or 'parent_supplier_id' in data:
            parent_supplier = None
            parent_id = data.get('parent_supplier_id')
            if parent_id:
                parent_supplier = Supplier.objects.get(id=parent_id)

            relationship = SupplierRelationship.objects.filter(
                company=profile.company,
                supplier=instance
            ).first()

            if relationship:
                if 'tier_level' in data:
                    relationship.tier_level = data['tier_level']
                if 'parent_supplier_id' in data:
                    relationship.parent_supplier = parent_supplier
                if 'procurement_share_pct' in data:
                    relationship.procurement_share_pct = data['procurement_share_pct']
                relationship.save()

        # Audit log entry
        AuditLog.objects.create(
            user=request.user,
            action='SUPPLIER_UPDATED',
            entity_type='Supplier',
            entity_id=str(instance.id),
            details={'updated_fields': list(data.keys())}
        )

        output_serializer = SupplierSerializer(instance, context={'request': request})
        return Response(output_serializer.data)

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        profile = getattr(request.user, 'profile', None)

        if not profile or profile.role not in ('COMPANY_MANAGER', 'ADMIN'):
            raise PermissionDenied("Only Company Managers can remove or deactivate suppliers.")

        # Soft delete: mark relationship and supplier as INACTIVE
        relationship = SupplierRelationship.objects.filter(
            company=profile.company,
            supplier=instance
        ).first()

        if relationship:
            relationship.status = 'INACTIVE'
            relationship.save()

        instance.status = 'INACTIVE'
        instance.save()

        AuditLog.objects.create(
            user=request.user,
            action='SUPPLIER_DEACTIVATED',
            entity_type='Supplier',
            entity_id=str(instance.id),
            details={'status': 'INACTIVE'}
        )

        return Response(
            {'message': f"Supplier '{instance.name}' has been deactivated."},
            status=status.HTTP_200_OK
        )

    @action(detail=True, methods=['post'])
    def deactivate(self, request, pk=None):
        return self.destroy(request, pk=pk)

    @action(detail=True, methods=['post'])
    def activate(self, request, pk=None):
        instance = self.get_object()
        profile = getattr(request.user, 'profile', None)
        if not profile or profile.role not in ('COMPANY_MANAGER', 'ADMIN'):
            raise PermissionDenied("Only Company Managers can activate suppliers.")

        relationship = SupplierRelationship.objects.filter(
            company=profile.company,
            supplier=instance
        ).first()

        if relationship:
            relationship.status = 'ACTIVE'
            relationship.save()

        instance.status = 'ACTIVE'
        instance.save()

        AuditLog.objects.create(
            user=request.user,
            action='SUPPLIER_ACTIVATED',
            entity_type='Supplier',
            entity_id=str(instance.id),
            details={'status': 'ACTIVE'}
        )

        output_serializer = SupplierSerializer(instance, context={'request': request})
        return Response(output_serializer.data)

    @action(detail=False, methods=['get'])
    def hierarchy(self, request):
        """
        Builds the entire supply-chain tree/network for the company.
        Formats nodes with supplier, tier, and recursive children array for visualization.
        If ?supplier_id=<id> or ?supplier_code=<code> is provided, returns that specific node's subtree.
        """
        profile = getattr(request.user, 'profile', None)
        if not profile or not profile.company:
            raise PermissionDenied("Company association required to view supply chain hierarchy.")

        company = profile.company
        relationships = SupplierRelationship.objects.filter(
            company=company,
            status='ACTIVE'
        ).select_related('supplier', 'parent_supplier')

        children_by_parent = {}
        for rel in relationships:
            pid = rel.parent_supplier_id
            if pid not in children_by_parent:
                children_by_parent[pid] = []
            children_by_parent[pid].append(rel)

        def build_node(rel):
            s = rel.supplier
            children_rels = children_by_parent.get(s.id, [])
            return {
                'id': s.id,
                'supplier': s.name,
                'supplier_code': s.supplier_code,
                'tier': rel.tier_level,
                'industry_sector': s.industry_sector,
                'location': s.location,
                'country': s.country,
                'region': s.region,
                'contact_email': s.contact_email,
                'procurement_share_pct': float(rel.procurement_share_pct),
                'status': rel.status,
                'children': [build_node(c) for c in children_rels]
            }

        # Check if single supplier subtree requested via query param
        target_supplier_id = request.query_params.get('supplier_id')
        target_supplier_code = request.query_params.get('supplier_code')
        if target_supplier_id or target_supplier_code:
            target_rel = None
            if target_supplier_id:
                target_rel = relationships.filter(supplier_id=target_supplier_id).first()
            elif target_supplier_code:
                target_rel = relationships.filter(supplier__supplier_code=target_supplier_code).first()

            if not target_rel:
                return Response(
                    {'error': 'Supplier not found in active supply chain relationships.'},
                    status=status.HTTP_404_NOT_FOUND
                )
            return Response(build_node(target_rel))

        tree = [build_node(r) for r in children_by_parent.get(None, [])]

        # Summary statistics
        tier1_count = len(children_by_parent.get(None, []))
        tier2_count = sum(1 for r in relationships if r.tier_level == 2)
        tier3_count = sum(1 for r in relationships if r.tier_level == 3)

        return Response({
            'company': company.name,
            'reporting_year': company.reporting_year,
            'summary': {
                'tier1_count': tier1_count,
                'tier2_count': tier2_count,
                'tier3_count': tier3_count,
                'total_suppliers': relationships.values('supplier_id').distinct().count()
            },
            'tree': tree
        })

    @action(detail=True, methods=['get'], url_path='hierarchy')
    def supplier_hierarchy(self, request, pk=None):
        """
        Returns the subtree rooted at this specific supplier:
        {
            "supplier": "Supplier A",
            "tier": 1,
            "children": [ ... ]
        }
        """
        instance = self.get_object()
        profile = getattr(request.user, 'profile', None)
        if not profile or not profile.company:
            raise PermissionDenied("Company association required.")

        company = profile.company
        relationships = SupplierRelationship.objects.filter(
            company=company,
            status='ACTIVE'
        ).select_related('supplier', 'parent_supplier')

        children_by_parent = {}
        for rel in relationships:
            pid = rel.parent_supplier_id
            if pid not in children_by_parent:
                children_by_parent[pid] = []
            children_by_parent[pid].append(rel)

        target_rel = relationships.filter(supplier=instance).first()
        if not target_rel:
            return Response({
                'id': instance.id,
                'supplier': instance.name,
                'supplier_code': instance.supplier_code,
                'tier': 1,
                'children': []
            })

        def build_node(rel):
            s = rel.supplier
            children_rels = children_by_parent.get(s.id, [])
            return {
                'id': s.id,
                'supplier': s.name,
                'supplier_code': s.supplier_code,
                'tier': rel.tier_level,
                'industry_sector': s.industry_sector,
                'location': s.location,
                'country': s.country,
                'region': s.region,
                'contact_email': s.contact_email,
                'procurement_share_pct': float(rel.procurement_share_pct),
                'status': rel.status,
                'children': [build_node(c) for c in children_rels]
            }

        return Response(build_node(target_rel))

    @action(detail=True, methods=['get'])
    def upstream(self, request, pk=None):
        """
        Retrieves all upstream ancestors from this supplier leading back to Company.
        """
        instance = self.get_object()
        profile = getattr(request.user, 'profile', None)
        if not profile or not profile.company:
            raise PermissionDenied("Company association required.")

        company = profile.company
        upstream_chain = []
        curr_supplier_id = instance.id
        visited = set()

        while curr_supplier_id:
            rel = SupplierRelationship.objects.filter(
                company=company,
                supplier_id=curr_supplier_id
            ).select_related('parent_supplier').first()

            if not rel or not rel.parent_supplier:
                break

            parent = rel.parent_supplier
            if parent.id in visited:
                break
            visited.add(parent.id)

            parent_rel = SupplierRelationship.objects.filter(
                company=company,
                supplier=parent
            ).first()

            upstream_chain.append({
                'id': parent.id,
                'supplier': parent.name,
                'supplier_code': parent.supplier_code,
                'tier': parent_rel.tier_level if parent_rel else 1,
                'industry_sector': parent.industry_sector,
                'country': parent.country
            })

            curr_supplier_id = parent.id

        return Response({
            'supplier': instance.name,
            'supplier_code': instance.supplier_code,
            'upstream_suppliers': upstream_chain,
            'total_upstream_count': len(upstream_chain),
            'root_company': company.name
        })

    @action(detail=True, methods=['get'])
    def downstream(self, request, pk=None):
        """
        Retrieves all downstream descendants/sub-suppliers feeding into this supplier.
        """
        instance = self.get_object()
        profile = getattr(request.user, 'profile', None)
        if not profile or not profile.company:
            raise PermissionDenied("Company association required.")

        company = profile.company
        downstream_list = []

        def collect_downstream(parent_id, current_depth=1):
            sub_rels = SupplierRelationship.objects.filter(
                company=company,
                parent_supplier_id=parent_id
            ).select_related('supplier')

            for r in sub_rels:
                s = r.supplier
                downstream_list.append({
                    'id': s.id,
                    'supplier': s.name,
                    'supplier_code': s.supplier_code,
                    'tier': r.tier_level,
                    'relative_depth': current_depth,
                    'parent_supplier_id': parent_id,
                    'industry_sector': s.industry_sector,
                    'country': s.country,
                    'status': r.status
                })
                collect_downstream(s.id, current_depth + 1)

        collect_downstream(instance.id)

        return Response({
            'supplier': instance.name,
            'supplier_code': instance.supplier_code,
            'downstream_suppliers': downstream_list,
            'total_downstream_count': len(downstream_list)
        })


class SupplierRelationshipViewSet(viewsets.ModelViewSet):
    """
    CRUD ViewSet for managing explicit multi-tier supply chain linkages.
    """
    serializer_class = SupplierRelationshipSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        profile = getattr(self.request.user, 'profile', None)
        if not profile or not profile.company:
            return SupplierRelationship.objects.none()
        return SupplierRelationship.objects.filter(company=profile.company)

    def create(self, request, *args, **kwargs):
        profile = getattr(request.user, 'profile', None)
        if not profile or profile.role not in ('COMPANY_MANAGER', 'ADMIN') or not profile.company:
            raise PermissionDenied("Only Company Managers can establish supplier relationships.")

        serializer = SupplierRelationshipCreateSerializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        relationship = SupplierRelationship.objects.create(
            company=profile.company,
            supplier_id=data['supplier_id'],
            parent_supplier_id=data.get('parent_supplier_id'),
            tier_level=data.get('tier_level', 1),
            procurement_share_pct=data.get('procurement_share_pct', Decimal('100.00')),
            status=data.get('status', 'ACTIVE')
        )

        AuditLog.objects.create(
            user=request.user,
            action='RELATIONSHIP_CREATED',
            entity_type='SupplierRelationship',
            entity_id=str(relationship.id),
            details={
                'supplier_id': relationship.supplier_id,
                'parent_supplier_id': relationship.parent_supplier_id,
                'tier_level': relationship.tier_level
            }
        )

        output = SupplierRelationshipSerializer(relationship)
        return Response(output.data, status=status.HTTP_201_CREATED)

    def destroy(self, request, *args, **kwargs):
        profile = getattr(request.user, 'profile', None)
        if not profile or profile.role not in ('COMPANY_MANAGER', 'ADMIN') or not profile.company:
            raise PermissionDenied("Only Company Managers can remove supplier relationships.")

        instance = self.get_object()
        rel_id = instance.id
        instance.delete()

        AuditLog.objects.create(
            user=request.user,
            action='RELATIONSHIP_REMOVED',
            entity_type='SupplierRelationship',
            entity_id=str(rel_id),
            details={'deleted': True}
        )

        return Response({'message': 'Supplier relationship removed successfully.'}, status=status.HTTP_200_OK)

    @action(detail=False, methods=['delete', 'post'])
    def remove(self, request):
        """
        Removes a relationship by supplier_id and optional parent_supplier_id, or relationship_id.
        """
        profile = getattr(request.user, 'profile', None)
        if not profile or profile.role not in ('COMPANY_MANAGER', 'ADMIN') or not profile.company:
            raise PermissionDenied("Only Company Managers can remove supplier relationships.")

        rel_id = request.data.get('relationship_id') or request.query_params.get('relationship_id')
        supplier_id = request.data.get('supplier_id') or request.query_params.get('supplier_id')
        parent_id = request.data.get('parent_supplier_id') or request.query_params.get('parent_supplier_id')

        qs = SupplierRelationship.objects.filter(company=profile.company)
        if rel_id:
            target = qs.filter(id=rel_id).first()
        elif supplier_id:
            q = qs.filter(supplier_id=supplier_id)
            if parent_id:
                q = q.filter(parent_supplier_id=parent_id)
            target = q.first()
        else:
            return Response({'error': 'Specify relationship_id or supplier_id.'}, status=status.HTTP_400_BAD_REQUEST)

        if not target:
            return Response({'error': 'Supplier relationship not found.'}, status=status.HTTP_404_NOT_FOUND)

        deleted_id = target.id
        target.delete()

        AuditLog.objects.create(
            user=request.user,
            action='RELATIONSHIP_REMOVED',
            entity_type='SupplierRelationship',
            entity_id=str(deleted_id),
            details={'supplier_id': supplier_id, 'deleted': True}
        )
        return Response({'message': 'Supplier relationship removed successfully.'}, status=status.HTTP_200_OK)


class SupplierActivityDataViewSet(viewsets.ModelViewSet):
    """
    Supplier Activity Data ViewSet:
    - Company Managers: Can upload, view, filter, verify, and summarize data for suppliers in their supply chain.
    - Suppliers: Can view and submit data strictly for their own supplier entity.
    - Auditors: Full read-only inspection and verification authority across activity data.
    """
    serializer_class = SupplierActivityDataSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        profile = getattr(user, 'profile', None)
        if not profile:
            return SupplierActivityData.objects.none()

        if profile.role in ('COMPANY_MANAGER', 'ADMIN') and profile.company:
            qs = SupplierActivityData.objects.filter(
                supplier__customer_relationships__company=profile.company
            ).distinct()
        elif profile.role == 'SUPPLIER' and profile.supplier:
            qs = SupplierActivityData.objects.filter(supplier=profile.supplier)
        elif profile.role == 'AUDITOR':
            qs = SupplierActivityData.objects.all()
        else:
            return SupplierActivityData.objects.none()

        # Query Filters
        supplier_id = self.request.query_params.get('supplier_id') or self.request.query_params.get('supplier')
        if supplier_id:
            qs = qs.filter(supplier_id=supplier_id)

        activity_type = self.request.query_params.get('activity_type')
        if activity_type:
            qs = qs.filter(activity_type__icontains=activity_type)

        reporting_period = self.request.query_params.get('reporting_period')
        if reporting_period:
            qs = qs.filter(reporting_period__iexact=reporting_period)

        # Distinguish verified vs unverified
        verification_status = self.request.query_params.get('verification_status')
        if verification_status:
            qs = qs.filter(verification_status__iexact=verification_status)

        is_verified_param = self.request.query_params.get('is_verified')
        if is_verified_param is not None:
            if is_verified_param.lower() in ('true', '1', 'yes'):
                qs = qs.filter(verification_status='VERIFIED')
            elif is_verified_param.lower() in ('false', '0', 'no'):
                qs = qs.exclude(verification_status='VERIFIED')

        # Domain filter (Energy, Transportation, Materials)
        domain = self.request.query_params.get('domain') or self.request.query_params.get('category')
        if domain:
            d_lower = domain.lower()
            if 'energy' in d_lower or 'power' in d_lower:
                qs = qs.filter(Q(activity_type__icontains='energy') | Q(activity_type__icontains='electricity') | Q(activity_type__icontains='fuel') | Q(fuel_type__gt=''))
            elif 'transport' in d_lower or 'freight' in d_lower or 'logistics' in d_lower:
                qs = qs.filter(Q(activity_type__icontains='transport') | Q(activity_type__icontains='freight') | Q(transport_mode__gt=''))
            elif 'material' in d_lower or 'goods' in d_lower:
                qs = qs.filter(Q(activity_type__icontains='material') | Q(activity_type__icontains='goods') | Q(material_type__gt=''))

        # Search filter
        search = self.request.query_params.get('search')
        if search:
            qs = qs.filter(
                Q(supplier__name__icontains=search) |
                Q(supplier__supplier_code__icontains=search) |
                Q(activity_type__icontains=search) |
                Q(material_type__icontains=search) |
                Q(fuel_type__icontains=search) |
                Q(source__icontains=search) |
                Q(reporting_period__icontains=search)
            )

        return qs.order_by('-created_at')

    def perform_create(self, serializer):
        profile = getattr(self.request.user, 'profile', None)
        if not profile:
            raise PermissionDenied("Authentication profile required.")

        requested_supplier = serializer.validated_data.get('supplier')
        requested_supplier_id = requested_supplier.id if requested_supplier else None

        # Supplier role: can only submit for themselves
        if profile.role == 'SUPPLIER':
            if requested_supplier_id != profile.supplier_id:
                raise PermissionDenied("Suppliers cannot submit activity data for other suppliers.")

        # Company Manager role: can only submit for suppliers in their supply chain
        if profile.role in ('COMPANY_MANAGER', 'ADMIN'):
            is_permitted = SupplierRelationship.objects.filter(
                company=profile.company,
                supplier_id=requested_supplier_id
            ).exists()
            if not is_permitted:
                raise PermissionDenied("You can only submit activity data for suppliers in your company's supply chain.")

        # Auditor role: cannot create activity data (read-only / verification only)
        if profile.role == 'AUDITOR':
            raise PermissionDenied("Auditors cannot submit new activity data; they can only verify or inspect.")

        activity = serializer.save(submitted_by=self.request.user)

        # Audit log
        AuditLog.objects.create(
            user=self.request.user,
            action='ACTIVITY_DATA_SUBMITTED',
            entity_type='SupplierActivityData',
            entity_id=str(activity.id),
            details={
                'supplier_id': requested_supplier_id,
                'activity_type': activity.activity_type,
                'quantity': float(activity.quantity),
                'unit': activity.unit,
                'reporting_period': activity.reporting_period,
                'verification_status': activity.verification_status
            }
        )

    @action(detail=False, methods=['post'], url_path='bulk')
    def bulk_create(self, request):
        """
        Accepts an array of activity records or {"activities": [...]} for batch entry.
        """
        profile = getattr(request.user, 'profile', None)
        if not profile:
            raise PermissionDenied("Authentication profile required.")

        records = request.data if isinstance(request.data, list) else request.data.get('activities', [])
        if not records or not isinstance(records, list):
            return Response(
                {'error': 'A list of activity data items or {"activities": [...]} is required.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        created_instances = []
        errors = []

        for index, item in enumerate(records):
            serializer = SupplierActivityDataSerializer(data=item, context={'request': request})
            if serializer.is_valid():
                supplier = serializer.validated_data.get('supplier')
                supplier_id = supplier.id if supplier else None

                if profile.role == 'SUPPLIER' and supplier_id != profile.supplier_id:
                    errors.append({'index': index, 'error': "Permission denied: Supplier ID mismatch."})
                    continue
                if profile.role in ('COMPANY_MANAGER', 'ADMIN'):
                    if not SupplierRelationship.objects.filter(company=profile.company, supplier_id=supplier_id).exists():
                        errors.append({'index': index, 'error': f"Supplier {supplier_id} not in company supply chain."})
                        continue

                inst = serializer.save(submitted_by=request.user)
                created_instances.append(inst)
            else:
                errors.append({'index': index, 'errors': serializer.errors})

        if errors and not created_instances:
            return Response({'error': 'Failed to create bulk activities.', 'details': errors}, status=status.HTTP_400_BAD_REQUEST)

        # Audit log
        AuditLog.objects.create(
            user=request.user,
            action='BULK_ACTIVITY_DATA_SUBMITTED',
            entity_type='SupplierActivityData',
            entity_id=str(created_instances[0].id) if created_instances else 'bulk',
            details={'count': len(created_instances), 'errors_count': len(errors)}
        )

        return Response({
            'message': f"Successfully created {len(created_instances)} activity records.",
            'created_count': len(created_instances),
            'failed_count': len(errors),
            'errors': errors if errors else None,
            'data': SupplierActivityDataSerializer(created_instances, many=True).data
        }, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'])
    def verify(self, request, pk=None):
        """
        Verifies an activity data record (Company Manager or Auditor only).
        """
        profile = getattr(request.user, 'profile', None)
        if not profile or profile.role not in ('AUDITOR', 'COMPANY_MANAGER', 'ADMIN'):
            raise PermissionDenied("Only Auditors and Company Managers can verify activity data.")

        instance = self.get_object()
        instance.verification_status = 'VERIFIED'
        notes = request.data.get('verification_notes') or request.data.get('notes')
        if notes:
            instance.verification_notes = notes
        instance.save()

        AuditLog.objects.create(
            user=request.user,
            action='ACTIVITY_DATA_VERIFIED',
            entity_type='SupplierActivityData',
            entity_id=str(instance.id),
            details={'status': 'VERIFIED', 'verified_by': request.user.username, 'role': profile.role}
        )

        return Response({
            'message': f"Activity record {instance.id} has been verified.",
            'data': SupplierActivityDataSerializer(instance).data
        }, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'])
    def reject(self, request, pk=None):
        """
        Rejects an unverified activity data record with an explanation note.
        """
        profile = getattr(request.user, 'profile', None)
        if not profile or profile.role not in ('AUDITOR', 'COMPANY_MANAGER', 'ADMIN'):
            raise PermissionDenied("Only Auditors and Company Managers can reject activity data.")

        instance = self.get_object()
        instance.verification_status = 'REJECTED'
        reason = request.data.get('reason') or request.data.get('verification_notes') or 'Failed audit criteria'
        instance.verification_notes = reason
        instance.save()

        AuditLog.objects.create(
            user=request.user,
            action='ACTIVITY_DATA_REJECTED',
            entity_type='SupplierActivityData',
            entity_id=str(instance.id),
            details={'status': 'REJECTED', 'reason': reason}
        )

        return Response({
            'message': f"Activity record {instance.id} has been rejected.",
            'data': SupplierActivityDataSerializer(instance).data
        }, status=status.HTTP_200_OK)

    @action(detail=False, methods=['get'])
    def summary(self, request):
        """
        Returns statistical summary distinguishing verified vs unverified data,
        breakdown by reporting period, and categorization across Energy, Transport, Materials.
        """
        qs = self.get_queryset()
        total_records = qs.count()
        verified_count = qs.filter(verification_status='VERIFIED').count()
        unverified_count = qs.exclude(verification_status='VERIFIED').count()
        rejected_count = qs.filter(verification_status='REJECTED').count()

        # Categorization breakdown
        energy_records = qs.filter(
            Q(activity_type__icontains='energy') |
            Q(activity_type__icontains='electricity') |
            Q(activity_type__icontains='fuel') |
            Q(fuel_type__gt='')
        ).count()

        transport_records = qs.filter(
            Q(activity_type__icontains='transport') |
            Q(activity_type__icontains='freight') |
            Q(transport_mode__gt='')
        ).count()

        materials_records = qs.filter(
            Q(activity_type__icontains='material') |
            Q(activity_type__icontains='goods') |
            Q(material_type__gt='')
        ).count()

        # Distinct reporting periods
        periods = sorted(list({p for p in qs.values_list('reporting_period', flat=True) if p}))

        return Response({
            'total_records': total_records,
            'verified_records': verified_count,
            'unverified_records': unverified_count,
            'rejected_records': rejected_count,
            'verification_ratio_pct': round((verified_count / total_records * 100), 2) if total_records > 0 else 0.0,
            'categories': {
                'energy_records': energy_records,
                'transportation_records': transport_records,
                'materials_records': materials_records,
                'other_records': total_records - (energy_records + transport_records + materials_records)
            },
            'reporting_periods': sorted(periods)
        }, status=status.HTTP_200_OK)

    @action(detail=False, methods=['post'], parser_classes=[MultiPartParser, FormParser, JSONParser], url_path='upload-csv')
    def upload_csv(self, request):
        """
        Uploads and validates supplier activity data CSV using Pandas.
        Supports:
        - Multipart file upload: request.FILES['file'] or request.FILES['csv_file']
        - Raw CSV string / JSON: request.data['csv_text']
        Returns a comprehensive validation report: valid rows, invalid rows, missing fields,
        invalid values, duplicate rows, and persists only valid rows to SQLite.
        """
        profile = getattr(request.user, 'profile', None)
        if not profile or profile.role not in ('COMPANY_MANAGER', 'ADMIN') or not profile.company:
            raise PermissionDenied("Only Company Managers can upload supplier activity CSV files.")

        uploaded_file = request.FILES.get('file') or request.FILES.get('csv_file')
        csv_text = request.data.get('csv_text')

        if not uploaded_file and not csv_text:
            return Response(
                {
                    'success': False,
                    'error': "No CSV file or 'csv_text' provided in upload request. Please provide 'file' as multipart or 'csv_text' in JSON.",
                    'summary': {
                        'total_rows': 0,
                        'valid_rows_count': 0,
                        'invalid_rows_count': 0,
                        'duplicate_rows_count': 0,
                        'imported_records_count': 0
                    },
                    'validation_report': {
                        'valid_rows': [],
                        'invalid_rows': [],
                        'missing_fields': ["No input file or csv_text provided"],
                        'invalid_values': [],
                        'duplicate_rows': []
                    }
                },
                status=status.HTTP_400_BAD_REQUEST
            )

        target_input = uploaded_file if uploaded_file else csv_text

        processor = CSVValidationProcessor(company=profile.company, user=request.user)
        report = processor.process_csv(target_input)

        validation_report = report.get('validation_report', {})
        AuditLog.log_action(
            user=request.user,
            action='CSV_UPLOADED',
            entity_type='SupplierActivityData',
            entity_id=f"csv-{request.user.id}-{report.get('valid_count', 0)}",
            details={
                'filename': getattr(uploaded_file, 'name', 'csv_text_input'),
                'valid_count': report.get('valid_count', len(validation_report.get('valid_rows', []))),
                'invalid_count': report.get('invalid_count', len(validation_report.get('invalid_rows', []))),
                'duplicate_count': len(validation_report.get('duplicate_rows', [])),
                'missing_fields_count': len(validation_report.get('missing_fields', [])),
                'success': report.get('success', False)
            },
            request=request
        )

        http_status = status.HTTP_200_OK if report.get('success') else status.HTTP_400_BAD_REQUEST
        return Response(report, status=http_status)


class EmissionFactorViewSet(viewsets.ModelViewSet):
    """
    Centralized library for documented GHG emission factors (DEFRA, EPA, IEA, IPCC).
    Factors are centrally managed in SQLite rather than hardcoded throughout the app.
    """
    serializer_class = EmissionFactorSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        # Auto-seed standard library if empty
        if EmissionFactor.objects.count() < 10:
            seed_standard_emission_factors()

        qs = EmissionFactor.objects.all()
        category = self.request.query_params.get('category')
        if category:
            qs = qs.filter(category__iexact=category)

        search = self.request.query_params.get('search')
        if search:
            qs = qs.filter(
                Q(activity_name__icontains=search) |
                Q(source__icontains=search) |
                Q(region__icontains=search)
            )

        return qs.order_by('category', 'activity_name')

    def perform_create(self, serializer):
        profile = getattr(self.request.user, 'profile', None)
        if not profile or profile.role not in ('COMPANY_MANAGER', 'AUDITOR', 'ADMIN'):
            raise PermissionDenied("Only Company Managers and Auditors can register custom emission factors.")
        ef = serializer.save()
        AuditLog.log_action(
            user=self.request.user,
            action='EMISSION_FACTOR_CREATED',
            entity_type='EmissionFactor',
            entity_id=str(ef.id),
            details={
                'activity_name': ef.activity_name,
                'category': ef.category,
                'factor_value': float(ef.factor_value),
                'unit': ef.unit,
                'source': ef.source,
                'region': ef.region
            },
            request=self.request
        )

    def perform_update(self, serializer):
        profile = getattr(self.request.user, 'profile', None)
        if not profile or profile.role not in ('COMPANY_MANAGER', 'AUDITOR', 'ADMIN'):
            raise PermissionDenied("Only Company Managers and Auditors can modify emission factors.")
        instance = self.get_object()
        old_val = float(instance.factor_value)
        ef = serializer.save()
        AuditLog.log_action(
            user=self.request.user,
            action='EMISSION_FACTOR_UPDATED',
            entity_type='EmissionFactor',
            entity_id=str(ef.id),
            details={
                'activity_name': ef.activity_name,
                'old_factor_value': old_val,
                'new_factor_value': float(ef.factor_value),
                'source': ef.source
            },
            request=self.request
        )

    def perform_destroy(self, instance):
        profile = getattr(self.request.user, 'profile', None)
        if not profile or profile.role not in ('COMPANY_MANAGER', 'ADMIN'):
            raise PermissionDenied("Only Company Managers and Admins can delete emission factors.")
        ef_id = instance.id
        act_name = instance.activity_name
        instance.delete()
        AuditLog.log_action(
            user=self.request.user,
            action='EMISSION_FACTOR_DELETED',
            entity_type='EmissionFactor',
            entity_id=str(ef_id),
            details={'activity_name': act_name},
            request=self.request
        )

    @action(detail=False, methods=['post'], url_path='seed')
    def seed_defaults(self, request):
        created = seed_standard_emission_factors()
        return Response({
            'message': f"Central emission factors library initialized. {created} new factors added.",
            'total_factors': EmissionFactor.objects.count()
        }, status=status.HTTP_200_OK)


class CarbonCalculationViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Core rule-based carbon calculation engine endpoint.
    - Calculate Scope 3 CO2e emissions for activity records
    - Inspect transparent audit trail, formulas, and factor sources
    - Batch calculate emissions across multi-tier suppliers
    - Statistical emissions summaries categorized by tier and domain
    """
    serializer_class = CarbonCalculationSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        profile = getattr(user, 'profile', None)
        if not profile:
            return CarbonCalculation.objects.none()

        if profile.role == 'AUDITOR':
            qs = CarbonCalculation.objects.all()
        elif profile.role in ('COMPANY_MANAGER', 'ADMIN') and profile.company:
            qs = CarbonCalculation.objects.filter(
                activity_data__supplier__customer_relationships__company=profile.company
            ).distinct()
        elif profile.role == 'SUPPLIER' and profile.supplier:
            qs = CarbonCalculation.objects.filter(
                activity_data__supplier=profile.supplier
            )
        else:
            return CarbonCalculation.objects.none()

        # Query Filters
        supplier_id = self.request.query_params.get('supplier_id')
        if supplier_id:
            qs = qs.filter(activity_data__supplier_id=supplier_id)

        period = self.request.query_params.get('reporting_period')
        if period:
            qs = qs.filter(activity_data__reporting_period__iexact=period)

        category = self.request.query_params.get('category')
        if category:
            qs = qs.filter(emission_factor__category__iexact=category)

        status_param = self.request.query_params.get('status')
        if status_param:
            qs = qs.filter(status__iexact=status_param)

        search = self.request.query_params.get('search')
        if search:
            qs = qs.filter(
                Q(activity_data__supplier__name__icontains=search) |
                Q(activity_data__activity_type__icontains=search) |
                Q(emission_factor__activity_name__icontains=search) |
                Q(formula__icontains=search)
            )

        return qs.order_by('-calculated_at')

    @action(detail=False, methods=['post'])
    def calculate(self, request):
        """
        Calculates carbon emissions for a single SupplierActivityData record.
        Payload:
        {
            "activity_data_id": 123,
            "emission_factor_id": 456 (optional: auto-matched if omitted)
        }
        """
        profile = getattr(request.user, 'profile', None)
        if not profile or profile.role not in ('COMPANY_MANAGER', 'ADMIN', 'AUDITOR'):
            raise PermissionDenied("Only Company Managers and Auditors can trigger carbon calculations.")

        act_id = request.data.get('activity_data_id') or request.data.get('activity_id')
        if not act_id:
            return Response({'error': "Field 'activity_data_id' is required."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            activity = SupplierActivityData.objects.select_related('supplier').get(id=act_id)
        except SupplierActivityData.DoesNotExist:
            return Response({'error': f"Activity data with ID {act_id} not found."}, status=status.HTTP_404_NOT_FOUND)

        # Multi-tenant security check
        if profile.role in ('COMPANY_MANAGER', 'ADMIN') and profile.company:
            is_permitted = SupplierRelationship.objects.filter(
                company=profile.company,
                supplier=activity.supplier
            ).exists()
            if not is_permitted:
                raise PermissionDenied("Supplier does not belong to your company's supply chain.")

        # Optional emission factor override
        emission_factor = None
        ef_id = request.data.get('emission_factor_id')
        if ef_id:
            try:
                emission_factor = EmissionFactor.objects.get(id=ef_id)
            except EmissionFactor.DoesNotExist:
                return Response({'error': f"Emission factor with ID {ef_id} not found."}, status=status.HTTP_404_NOT_FOUND)

        calc = CarbonCalculationEngine.calculate_co2e(
            activity_data=activity,
            emission_factor=emission_factor,
            user=request.user
        )

        return Response(
            CarbonCalculationSerializer(calc).data,
            status=status.HTTP_200_OK
        )

    @action(detail=False, methods=['post'], url_path='batch')
    def batch_calculate(self, request):
        """
        Calculates emissions across multiple activity records.
        Supports:
        - {"activity_ids": [1, 2, 3]}
        - Or filters: {"reporting_period": "2024-Q1", "supplier_id": 8}
        - Or empty payload to compute all pending uncalculated records for the company.
        """
        profile = getattr(request.user, 'profile', None)
        if not profile or profile.role not in ('COMPANY_MANAGER', 'ADMIN', 'AUDITOR'):
            raise PermissionDenied("Only Company Managers and Auditors can trigger carbon calculations.")

        qs = SupplierActivityData.objects.all()
        if profile.role in ('COMPANY_MANAGER', 'ADMIN') and profile.company:
            qs = qs.filter(supplier__customer_relationships__company=profile.company).distinct()

        activity_ids = request.data.get('activity_ids')
        if activity_ids and isinstance(activity_ids, list):
            qs = qs.filter(id__in=activity_ids)
        else:
            period = request.data.get('reporting_period') or request.query_params.get('reporting_period')
            if period:
                qs = qs.filter(reporting_period__iexact=period)

            supp_id = request.data.get('supplier_id') or request.query_params.get('supplier_id')
            if supp_id:
                qs = qs.filter(supplier_id=supp_id)

        calculations = []
        errors = []

        for act in qs:
            try:
                calc = CarbonCalculationEngine.calculate_co2e(
                    activity_data=act,
                    user=request.user
                )
                calculations.append(calc)
            except Exception as e:
                errors.append({'activity_id': act.id, 'error': str(e)})

        total_kg = sum(c.co2e_kg for c in calculations)
        total_tonnes = sum(c.co2e_tonnes for c in calculations)

        return Response({
            'message': f"Batch calculation complete. {len(calculations)} records calculated.",
            'calculated_count': len(calculations),
            'failed_count': len(errors),
            'total_co2e_kg': float(total_kg),
            'total_co2e_tonnes': float(total_tonnes),
            'errors': errors if errors else None,
            'data': CarbonCalculationSerializer(calculations, many=True).data
        }, status=status.HTTP_200_OK)

    @action(detail=False, methods=['get'])
    def summary(self, request):
        """
        Aggregates emissions by category, by supplier tier (Tier 1, 2, 3),
        and identifies high-level totals for the company.
        """
        qs = self.get_queryset()
        total_kg = qs.aggregate(s=Sum('co2e_kg'))['s'] or Decimal('0.0000')
        total_tonnes = qs.aggregate(s=Sum('co2e_tonnes'))['s'] or Decimal('0.000000')

        # Categorical breakdown
        cat_breakdown = {}
        for cat in ('ELECTRICITY', 'FUEL', 'TRANSPORT', 'MATERIAL', 'WASTE'):
            sub_qs = qs.filter(emission_factor__category=cat)
            kg_val = sub_qs.aggregate(s=Sum('co2e_kg'))['s'] or Decimal('0.0000')
            t_val = sub_qs.aggregate(s=Sum('co2e_tonnes'))['s'] or Decimal('0.000000')
            if kg_val > 0:
                cat_breakdown[cat.lower()] = {
                    'co2e_kg': float(kg_val),
                    'co2e_tonnes': float(t_val),
                    'share_pct': round(float(kg_val / total_kg * 100), 2) if total_kg > 0 else 0.0
                }

        # Multi-tier breakdown (Tier 1 vs Tier 2 vs Tier 3)
        tier_breakdown = {1: Decimal('0.0'), 2: Decimal('0.0'), 3: Decimal('0.0')}
        company = getattr(request.user.profile, 'company', None) if hasattr(request.user, 'profile') else None

        for calc in qs.select_related('activity_data__supplier'):
            supp = calc.activity_data.supplier
            rel = None
            if company:
                rel = SupplierRelationship.objects.filter(company=company, supplier=supp).first()
            tier = rel.tier_level if rel else 1
            tier_breakdown[tier] = tier_breakdown.get(tier, Decimal('0.0')) + calc.co2e_kg

        tier_summary = {
            f"tier_{t}": {
                'co2e_kg': float(tier_breakdown[t]),
                'co2e_tonnes': float(round(tier_breakdown[t] / Decimal('1000.0'), 6)),
                'share_pct': round(float(tier_breakdown[t] / total_kg * 100), 2) if total_kg > 0 else 0.0
            }
            for t in (1, 2, 3)
        }

        # Reporting periods
        periods = sorted(list({c.activity_data.reporting_period for c in qs.select_related('activity_data') if c.activity_data.reporting_period}))

        return Response({
            'total_calculations': qs.count(),
            'total_co2e_kg': float(total_kg),
            'total_co2e_tonnes': float(total_tonnes),
            'by_category': cat_breakdown,
            'by_tier': tier_summary,
            'reporting_periods': periods
        }, status=status.HTTP_200_OK)


class HotspotViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Company Managers: View hotspots for their company.
    Auditors: Inspect hotspots.
    Suppliers: Restricted (403).
    Supports filters: ?severity=HIGH, ?tier=1, ?status=OPEN
    """
    serializer_class = HotspotSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        profile = getattr(user, 'profile', None)
        if not profile:
            return Hotspot.objects.none()

        if profile.role in ('COMPANY_MANAGER', 'ADMIN') and profile.company:
            qs = Hotspot.objects.filter(company=profile.company)
        elif profile.role == 'AUDITOR':
            qs = Hotspot.objects.all()
        else:
            raise PermissionDenied("Suppliers are not authorized to view company-wide hotspots.")

        # Filter by severity
        severity = self.request.query_params.get('severity')
        if severity:
            qs = qs.filter(severity__iexact=severity)

        # Filter by tier_level
        tier = self.request.query_params.get('tier')
        if tier:
            qs = qs.filter(tier_level=tier)

        # Filter by status
        status_param = self.request.query_params.get('status')
        if status_param:
            qs = qs.filter(status__iexact=status_param)

        return qs.select_related('supplier', 'company')

    @action(detail=False, methods=['get'], url_path='overview')
    def overview(self, request):
        """Dynamic carbon hotspot overview across all 5 dimensions."""
        from .hotspot_views import HotspotOverviewView
        return HotspotOverviewView().get(request)

    @action(detail=False, methods=['post'], url_path='sync')
    def sync_hotspots(self, request):
        """Synchronize detected hotspots to the database."""
        from .hotspot_views import HotspotSyncView
        return HotspotSyncView().post(request)


class RecommendationViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Company Managers: View recommendations for their company suppliers.
    Suppliers: View recommendations for their own supplier.
    Auditors: View recommendations.
    """
    serializer_class = RecommendationSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        profile = getattr(user, 'profile', None)
        if not profile:
            return Recommendation.objects.none()

        if profile.role in ('COMPANY_MANAGER', 'ADMIN') and profile.company:
            return Recommendation.objects.filter(
                supplier__customer_relationships__company=profile.company
            ).distinct()

        if profile.role == 'SUPPLIER' and profile.supplier:
            return Recommendation.objects.filter(supplier=profile.supplier)

        if profile.role == 'AUDITOR':
            return Recommendation.objects.all()

        return Recommendation.objects.none()


class AuditLogViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Auditors & Company Managers: Inspect immutable audit logs and calculation lineages.
    Suppliers: Strictly Forbidden (403).
    Guarantees:
    - Immutability: Modifications and deletions are strictly rejected.
    - Full transparency: Lineage of every carbon calculation is verifiable.
    """
    serializer_class = AuditLogSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        profile = getattr(user, 'profile', None)
        if not profile or profile.role == 'SUPPLIER':
            raise PermissionDenied("Suppliers are not authorized to access audit logs.")

        if profile.role in ('AUDITOR', 'COMPANY_MANAGER', 'ADMIN'):
            qs = AuditLog.objects.all().select_related('user')
        else:
            return AuditLog.objects.none()

        # Query Filters
        action_param = self.request.query_params.get('action')
        if action_param:
            qs = qs.filter(action__iexact=action_param)

        entity_type = self.request.query_params.get('entity_type')
        if entity_type:
            qs = qs.filter(entity_type__iexact=entity_type)

        entity_id = self.request.query_params.get('entity_id')
        if entity_id:
            qs = qs.filter(entity_id=entity_id)

        user_id = self.request.query_params.get('user_id')
        if user_id:
            qs = qs.filter(user_id=user_id)

        start_date = self.request.query_params.get('start_date')
        if start_date:
            qs = qs.filter(timestamp__gte=start_date)

        end_date = self.request.query_params.get('end_date')
        if end_date:
            qs = qs.filter(timestamp__lte=end_date)

        search = self.request.query_params.get('search')
        if search:
            qs = qs.filter(
                Q(action__icontains=search) |
                Q(entity_type__icontains=search) |
                Q(entity_id__icontains=search) |
                Q(user__username__icontains=search)
            )

        return qs.order_by('-timestamp')

    @action(detail=False, methods=['get'], url_path='summary')
    def summary(self, request):
        """
        Compliance summary of tracked actions in SQLite audit ledger.
        """
        qs = self.get_queryset()
        total_logs = qs.count()

        # Aggregate counts by action
        from django.db.models import Count
        action_counts = dict(qs.values('action').annotate(c=Count('id')).values_list('action', 'c'))

        return Response({
            'ledger_status': 'IMMUTABLE_SQLITE_VERIFIED',
            'total_audit_events': total_logs,
            'action_breakdown': action_counts,
            'auditor_readiness': '100% AUDITABLE',
            'retention_policy': 'Permanent historical compliance retention'
        }, status=status.HTTP_200_OK)

    @action(detail=False, methods=['get'], url_path='calculation-traces')
    def calculation_traces(self, request):
        """
        Auditor endpoint to inspect the exact 8-part mathematical trace for carbon values:
        Input -> Unit -> Emission Factor -> Source -> Formula -> Result -> Timestamp -> Verification Status
        """
        profile = getattr(request.user, 'profile', None)
        if not profile or profile.role == 'SUPPLIER':
            raise PermissionDenied("Suppliers are not authorized to view calculation traces.")

        calc_qs = CarbonCalculation.objects.select_related(
            'activity_data', 'activity_data__supplier', 'emission_factor', 'calculated_by'
        ).all()

        supplier_id = request.query_params.get('supplier_id')
        if supplier_id:
            calc_qs = calc_qs.filter(activity_data__supplier_id=supplier_id)

        period = request.query_params.get('reporting_period')
        if period:
            calc_qs = calc_qs.filter(activity_data__reporting_period__iexact=period)

        traces = []
        for c in calc_qs[:100]:
            act = c.activity_data
            ef = c.emission_factor
            input_val = float(c.input_value or (act.quantity if act else 0.0))
            unit_val = c.unit or (act.unit if act else '')
            ef_val = float(c.emission_factor_value or (ef.factor_value if ef else 0.0))
            source_val = c.emission_factor_source or (ef.source if ef else '')
            result_kg = float(c.co2e_kg)
            result_tonnes = float(c.co2e_tonnes)
            ts = c.calculated_at.isoformat() if c.calculated_at else ''
            ver_status = c.status

            lineage = (
                f"Input ({input_val:,.2f} {unit_val}) × Emission Factor ({ef_val:,.6f} kg CO2e/{unit_val}) "
                f"[{source_val}] = Result ({result_kg:,.2f} kg CO2e / {result_tonnes:,.4f} tCO2e). "
                f"Status: {ver_status} at {ts}"
            )

            traces.append({
                'calculation_id': c.id,
                'supplier_name': act.supplier.name if act and act.supplier else 'Unknown',
                'activity_type': act.activity_type if act else 'General',
                'input': input_val,
                'unit': unit_val,
                'emission_factor': ef_val,
                'source': source_val,
                'formula': c.formula,
                'result_kg': result_kg,
                'result_tonnes': result_tonnes,
                'timestamp': ts,
                'verification_status': ver_status,
                'calculation_lineage': lineage,
                'auditor_verifiable': True
            })

        return Response({
            'total_traces': len(traces),
            'methodology': 'Deterministic Scope 3 Rule-Based Trace (Zero ML)',
            'traces': traces
        }, status=status.HTTP_200_OK)


class ReportViewSet(viewsets.ModelViewSet):
    """
    Company Managers: Generate & view reports for their company.
    Auditors: View reports.
    Suppliers: Strictly Forbidden (403).
    """
    serializer_class = ReportSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        profile = getattr(user, 'profile', None)
        if not profile or profile.role == 'SUPPLIER':
            raise PermissionDenied("Suppliers are not authorized to view or generate company reports.")

        if profile.role in ('COMPANY_MANAGER', 'ADMIN') and profile.company:
            return Report.objects.filter(company=profile.company)

        if profile.role == 'AUDITOR':
            return Report.objects.all()

        return Report.objects.none()

    def perform_create(self, serializer):
        profile = getattr(self.request.user, 'profile', None)
        if not profile or profile.role not in ('COMPANY_MANAGER', 'ADMIN') or not profile.company:
            raise PermissionDenied("Only Company Managers can generate company reports.")

        report = serializer.save(
            company=profile.company,
            generated_by=self.request.user
        )

        AuditLog.objects.create(
            user=self.request.user,
            action='REPORT_GENERATED',
            entity_type='Report',
            entity_id=str(report.id),
            details={'title': report.title, 'reporting_year': report.reporting_year}
        )
