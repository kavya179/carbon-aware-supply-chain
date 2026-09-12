from decimal import Decimal
from rest_framework import serializers
from django.contrib.auth.models import User
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


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'first_name', 'last_name']


class UserProfileSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)
    company_name = serializers.CharField(source='company.name', read_only=True)
    supplier_name = serializers.CharField(source='supplier.name', read_only=True)

    class Meta:
        model = UserProfile
        fields = ['id', 'user', 'role', 'company', 'company_name', 'supplier', 'supplier_name', 'phone']


class RegisterSerializer(serializers.Serializer):
    username = serializers.CharField(max_length=150)
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True, min_length=8)
    role = serializers.ChoiceField(choices=UserProfile.ROLE_CHOICES)
    company_id = serializers.IntegerField(required=False, allow_null=True)
    supplier_id = serializers.IntegerField(required=False, allow_null=True)
    phone = serializers.CharField(max_length=30, required=False, allow_blank=True)

    def validate_username(self, value):
        if User.objects.filter(username=value).exists():
            raise serializers.ValidationError("A user with that username already exists.")
        return value

    def validate_email(self, value):
        if User.objects.filter(email=value).exists():
            raise serializers.ValidationError("A user with that email already exists.")
        return value

    def create(self, validated_data):
        # Create user with Django PBKDF2 password hashing
        user = User.objects.create_user(
            username=validated_data['username'],
            email=validated_data['email'],
            password=validated_data['password']
        )
        profile = UserProfile.objects.create(
            user=user,
            role=validated_data['role'],
            company_id=validated_data.get('company_id'),
            supplier_id=validated_data.get('supplier_id'),
            phone=validated_data.get('phone', '')
        )
        return profile


class CompanySerializer(serializers.ModelSerializer):
    class Meta:
        model = Company
        fields = '__all__'


class SubSupplierSimpleSerializer(serializers.ModelSerializer):
    class Meta:
        model = Supplier
        fields = ['id', 'name', 'supplier_code', 'industry_sector', 'country', 'status']


class SupplierSerializer(serializers.ModelSerializer):
    tier_level = serializers.SerializerMethodField()
    parent_supplier = serializers.SerializerMethodField()
    procurement_share_pct = serializers.SerializerMethodField()
    sub_suppliers = serializers.SerializerMethodField()
    activity_count = serializers.SerializerMethodField()

    class Meta:
        model = Supplier
        fields = [
            'id', 'name', 'supplier_code', 'industry_sector', 'location',
            'country', 'region', 'contact_name', 'contact_email', 'contact_phone',
            'status', 'tier_level', 'parent_supplier', 'procurement_share_pct',
            'sub_suppliers', 'activity_count', 'created_at', 'updated_at'
        ]

    def _get_relationship(self, obj):
        request = self.context.get('request')
        if not request or not request.user or not request.user.is_authenticated:
            return None
        profile = getattr(request.user, 'profile', None)
        if not profile or not profile.company:
            return None
        return obj.customer_relationships.filter(company=profile.company).first()

    def get_tier_level(self, obj):
        rel = self._get_relationship(obj)
        return rel.tier_level if rel else None

    def get_parent_supplier(self, obj):
        rel = self._get_relationship(obj)
        if rel and rel.parent_supplier:
            return {
                'id': rel.parent_supplier.id,
                'name': rel.parent_supplier.name,
                'supplier_code': rel.parent_supplier.supplier_code
            }
        return None

    def get_procurement_share_pct(self, obj):
        rel = self._get_relationship(obj)
        return str(rel.procurement_share_pct) if rel else None

    def get_sub_suppliers(self, obj):
        request = self.context.get('request')
        if not request or not request.user or not request.user.is_authenticated:
            return []
        profile = getattr(request.user, 'profile', None)
        if not profile or not profile.company:
            return []
        sub_rels = SupplierRelationship.objects.filter(
            company=profile.company,
            parent_supplier=obj
        ).select_related('supplier')
        return SubSupplierSimpleSerializer([r.supplier for r in sub_rels], many=True).data

    def get_activity_count(self, obj):
        return obj.activities.count()


class SupplierCreateUpdateSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=255)
    supplier_code = serializers.CharField(max_length=50)
    industry_sector = serializers.CharField(max_length=100)
    location = serializers.CharField(max_length=150, required=False, allow_blank=True)
    country = serializers.CharField(max_length=100)
    region = serializers.CharField(max_length=100, required=False, allow_blank=True)
    contact_name = serializers.CharField(max_length=150, required=False, allow_blank=True)
    contact_email = serializers.EmailField()
    contact_phone = serializers.CharField(max_length=50, required=False, allow_blank=True)
    status = serializers.ChoiceField(choices=Supplier.STATUS_CHOICES, default='ACTIVE')
    tier_level = serializers.IntegerField(min_value=1, max_value=3, default=1)
    parent_supplier_id = serializers.IntegerField(required=False, allow_null=True)
    procurement_share_pct = serializers.DecimalField(
        max_digits=5, decimal_places=2, default=Decimal('100.00'), min_value=Decimal('0.01'), max_value=Decimal('100.00')
    )

    def validate(self, attrs):
        tier_level = attrs.get('tier_level', 1)
        parent_supplier_id = attrs.get('parent_supplier_id')
        request = self.context.get('request')
        profile = getattr(request.user, 'profile', None)
        company = profile.company if profile else None

        if not company:
            raise serializers.ValidationError("Authenticated company user is required.")

        # Rule 1: Tier 1 suppliers cannot have a parent supplier
        if tier_level == 1 and parent_supplier_id:
            raise serializers.ValidationError({
                "parent_supplier_id": "Tier 1 suppliers supply directly to the company and cannot have a parent supplier."
            })

        # Rule 2: Tier 2 and Tier 3 suppliers MUST have a parent supplier
        if tier_level in (2, 3) and not parent_supplier_id:
            raise serializers.ValidationError({
                "parent_supplier_id": f"Tier {tier_level} suppliers must specify an active parent supplier in your supply chain."
            })

        if parent_supplier_id:
            try:
                parent_supplier = Supplier.objects.get(id=parent_supplier_id)
            except Supplier.DoesNotExist:
                raise serializers.ValidationError({"parent_supplier_id": "Specified parent supplier does not exist."})

            # Check if parent supplier is connected to this company
            parent_rel = SupplierRelationship.objects.filter(
                company=company,
                supplier=parent_supplier
            ).first()

            if not parent_rel:
                raise serializers.ValidationError({
                    "parent_supplier_id": "Parent supplier does not belong to your company's supply chain."
                })

            # Rule 3: Tier 2 parent MUST be Tier 1
            if tier_level == 2 and parent_rel.tier_level != 1:
                raise serializers.ValidationError({
                    "parent_supplier_id": f"Invalid Tier Hierarchy: The parent of a Tier 2 supplier must be Tier 1. (Found parent at Tier {parent_rel.tier_level})"
                })

            # Rule 4: Tier 3 parent MUST be Tier 2 (Tier 3 cannot be parent of Tier 1 or 2, and Tier 1 cannot be parent of Tier 3 directly)
            if tier_level == 3 and parent_rel.tier_level != 2:
                raise serializers.ValidationError({
                    "parent_supplier_id": f"Invalid Tier Hierarchy: The parent of a Tier 3 supplier must be Tier 2. (Found parent at Tier {parent_rel.tier_level})"
                })

        return attrs


class SupplierRelationshipCreateSerializer(serializers.Serializer):
    supplier_id = serializers.IntegerField()
    parent_supplier_id = serializers.IntegerField(required=False, allow_null=True)
    tier_level = serializers.IntegerField(min_value=1, max_value=3, default=1)
    procurement_share_pct = serializers.DecimalField(
        max_digits=5, decimal_places=2, default=Decimal('100.00'), min_value=Decimal('0.01'), max_value=Decimal('100.00')
    )
    status = serializers.ChoiceField(choices=SupplierRelationship.STATUS_CHOICES, default='ACTIVE')

    def validate(self, attrs):
        request = self.context.get('request')
        profile = getattr(request.user, 'profile', None)
        company = profile.company if profile else None

        if not company:
            raise serializers.ValidationError("Authenticated company user is required.")

        supplier_id = attrs['supplier_id']
        parent_supplier_id = attrs.get('parent_supplier_id')
        tier_level = attrs.get('tier_level', 1)

        # 1. Prevent self-referencing supplier
        if parent_supplier_id and supplier_id == parent_supplier_id:
            raise serializers.ValidationError({"parent_supplier_id": "A supplier cannot be its own parent supplier."})

        # Fetch supplier
        try:
            supplier = Supplier.objects.get(id=supplier_id)
        except Supplier.DoesNotExist:
            raise serializers.ValidationError({"supplier_id": "Specified supplier does not exist."})

        # 2. Tier 1 constraints: must not have parent
        if tier_level == 1 and parent_supplier_id is not None:
            raise serializers.ValidationError({"parent_supplier_id": "Tier 1 suppliers supply directly to the company and cannot have a parent supplier."})

        # 3. Tier 2 and Tier 3 constraints
        if tier_level in (2, 3):
            if not parent_supplier_id:
                raise serializers.ValidationError({"parent_supplier_id": f"Tier {tier_level} suppliers must specify an active parent supplier in your supply chain."})

            try:
                parent_supplier = Supplier.objects.get(id=parent_supplier_id)
            except Supplier.DoesNotExist:
                raise serializers.ValidationError({"parent_supplier_id": "Specified parent supplier does not exist."})

            # Check parent belongs to same company
            parent_rel = SupplierRelationship.objects.filter(
                company=company,
                supplier=parent_supplier
            ).first()

            if not parent_rel:
                raise serializers.ValidationError({"parent_supplier_id": "Parent supplier does not belong to your company's supply chain."})

            # Rule: Parent of Tier 2 MUST be Tier 1
            if tier_level == 2 and parent_rel.tier_level != 1:
                raise serializers.ValidationError({
                    "parent_supplier_id": f"Invalid Tier Hierarchy: The parent of a Tier 2 supplier must be Tier 1. (Found parent at Tier {parent_rel.tier_level})"
                })

            # Rule: Parent of Tier 3 MUST be Tier 2
            if tier_level == 3 and parent_rel.tier_level != 2:
                raise serializers.ValidationError({
                    "parent_supplier_id": f"Invalid Tier Hierarchy: The parent of a Tier 3 supplier must be Tier 2. (Found parent at Tier {parent_rel.tier_level})"
                })

            # 4. Circular relationship prevention: walk up the chain from parent_supplier
            curr_parent_id = parent_supplier_id
            visited = set()
            while curr_parent_id:
                if curr_parent_id == supplier_id:
                    raise serializers.ValidationError({
                        "parent_supplier_id": f"Circular relationship detected: Supplier {supplier.name} is already an ancestor of the proposed parent."
                    })
                if curr_parent_id in visited:
                    break
                visited.add(curr_parent_id)

                upstream_rel = SupplierRelationship.objects.filter(
                    company=company,
                    supplier_id=curr_parent_id
                ).first()
                curr_parent_id = upstream_rel.parent_supplier_id if upstream_rel else None

        # 5. Duplicate relationship prevention
        existing = SupplierRelationship.objects.filter(
            company=company,
            supplier_id=supplier_id,
            parent_supplier_id=parent_supplier_id
        ).exists()
        if existing:
            raise serializers.ValidationError("Duplicate relationship: this supplier relationship already exists for this company.")

        return attrs


class SupplierRelationshipSerializer(serializers.ModelSerializer):
    supplier_name = serializers.CharField(source='supplier.name', read_only=True)
    supplier_code = serializers.CharField(source='supplier.supplier_code', read_only=True)
    parent_supplier_name = serializers.CharField(source='parent_supplier.name', read_only=True)
    company_name = serializers.CharField(source='company.name', read_only=True)

    class Meta:
        model = SupplierRelationship
        fields = '__all__'
        read_only_fields = ['company']



import re

VALID_UNITS = {
    # Energy
    'kwh', 'mwh', 'gwh', 'mj', 'gj', 'btu', 'therm',
    # Fuel
    'liter', 'liters', 'litre', 'litres', 'l', 'gallon', 'gallons', 'gal', 'm3', 'cubic_meter', 'cubic_meters',
    # Transportation
    'km', 'kilometer', 'kilometers', 'mile', 'miles', 'tonne-km', 'tkm', 'ton-mile', 'ton-miles',
    # Materials / Mass
    'kg', 'kilogram', 'kilograms', 'tonne', 'tonnes', 'metric_ton', 'metric_tonnes', 'g', 'gram', 'grams', 'lb', 'lbs', 'pound', 'pounds',
    # Discrete
    'unit', 'units', 'piece', 'pieces', 'pcs'
}

REPORTING_PERIOD_REGEX = re.compile(
    r'^(\d{4}-Q[1-4]|\d{4}-(0[1-9]|1[0-2])|\d{4}-H[1-2]|\d{4}|\d{4}-\d{2}-\d{2}(\s*(to|/)\s*)\d{4}-\d{2}-\d{2})$',
    re.IGNORECASE
)


class SupplierActivityDataSerializer(serializers.ModelSerializer):
    supplier_name = serializers.CharField(source='supplier.name', read_only=True)
    supplier_code = serializers.CharField(source='supplier.supplier_code', read_only=True)
    submitted_by_username = serializers.CharField(source='submitted_by.username', read_only=True, default='')
    value = serializers.DecimalField(
        source='quantity',
        max_digits=15,
        decimal_places=4,
        required=False
    )
    quantity = serializers.DecimalField(
        max_digits=15,
        decimal_places=4,
        required=False
    )
    timestamp = serializers.DateTimeField(source='created_at', read_only=True)
    is_verified = serializers.BooleanField(read_only=True)

    class Meta:
        model = SupplierActivityData
        fields = [
            'id',
            'supplier',
            'supplier_name',
            'supplier_code',
            'reporting_period',
            'period_start',
            'period_end',
            'activity_type',
            'value',
            'quantity',
            'unit',
            'source',
            'verification_status',
            'verification_notes',
            'is_verified',
            'timestamp',
            'fuel_type',
            'transport_mode',
            'distance',
            'shipment_weight',
            'material_type',
            'metadata',
            'data_quality_score',
            'notes',
            'submitted_by',
            'submitted_by_username',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['submitted_by', 'created_at', 'updated_at']

    def validate(self, attrs):
        # 1. Resolve 'value' and 'quantity'
        val = attrs.get('quantity')
        if val is None:
            val = self.initial_data.get('value')
            if val is not None:
                try:
                    val = Decimal(str(val))
                    attrs['quantity'] = val
                except Exception:
                    raise serializers.ValidationError({"value": "Value must be a valid numeric decimal."})

        if val is None:
            raise serializers.ValidationError({"value": "Field 'value' or 'quantity' is required."})

        # 2. Prevent negative and zero values
        if val <= Decimal('0'):
            raise serializers.ValidationError({
                "value": "Value must be a positive number strictly greater than 0. Negative or zero values are not permitted."
            })

        # 3. Validate Unit
        unit = attrs.get('unit', '').strip()
        if not unit:
            raise serializers.ValidationError({"unit": "Measurement unit is required."})
        normalized_unit = unit.lower().replace(' ', '')
        if normalized_unit not in VALID_UNITS and not re.match(r'^[a-zA-Z0-9_\-\/\^]+$', unit):
            raise serializers.ValidationError({
                "unit": f"Invalid unit '{unit}'. Must be a recognized measurement unit (e.g. kWh, MWh, liters, km, tonne-km, kg, tonnes)."
            })

        # 4. Validate Reporting Period
        reporting_period = attrs.get('reporting_period', '').strip()
        period_start = attrs.get('period_start')
        period_end = attrs.get('period_end')

        if not reporting_period and not (period_start and period_end):
            raise serializers.ValidationError({
                "reporting_period": "Reporting period is required (e.g. '2024-Q1', '2024-05', or '2024')."
            })

        if reporting_period and not REPORTING_PERIOD_REGEX.match(reporting_period):
            raise serializers.ValidationError({
                "reporting_period": f"Invalid reporting period '{reporting_period}'. Expected formats: 'YYYY-Q1'..'YYYY-Q4', 'YYYY-MM', 'YYYY', or 'YYYY-MM-DD to YYYY-MM-DD'."
            })

        # 5. Prevent negative distances or weights
        distance = attrs.get('distance')
        if distance is not None and distance < Decimal('0'):
            raise serializers.ValidationError({"distance": "Transportation distance cannot be negative."})

        shipment_weight = attrs.get('shipment_weight')
        if shipment_weight is not None and shipment_weight < Decimal('0'):
            raise serializers.ValidationError({"shipment_weight": "Shipment weight cannot be negative."})

        # 6. Default source if empty
        if not attrs.get('source'):
            attrs['source'] = 'Supplier Self-Report'

        # 7. Default verification status
        if not attrs.get('verification_status'):
            attrs['verification_status'] = 'UNVERIFIED'

        return attrs


class EmissionFactorSerializer(serializers.ModelSerializer):
    class Meta:
        model = EmissionFactor
        fields = '__all__'


class CarbonCalculationSerializer(serializers.ModelSerializer):
    supplier_id = serializers.IntegerField(source='activity_data.supplier.id', read_only=True)
    supplier_name = serializers.CharField(source='activity_data.supplier.name', read_only=True)
    supplier_code = serializers.CharField(source='activity_data.supplier.supplier_code', read_only=True)
    activity_type = serializers.CharField(source='activity_data.activity_type', read_only=True)
    reporting_period = serializers.CharField(source='activity_data.reporting_period', read_only=True)
    verification_status = serializers.CharField(source='activity_data.verification_status', read_only=True)
    emission_factor_name = serializers.CharField(source='emission_factor.activity_name', read_only=True)
    calculated_by_username = serializers.CharField(source='calculated_by.username', read_only=True, default='')
    timestamp = serializers.DateTimeField(source='calculated_at', read_only=True)

    class Meta:
        model = CarbonCalculation
        fields = [
            'id',
            'activity_data',
            'activity_type',
            'supplier_id',
            'supplier_name',
            'supplier_code',
            'reporting_period',
            'input_value',
            'unit',
            'emission_factor',
            'emission_factor_name',
            'emission_factor_value',
            'emission_factor_source',
            'formula',
            'co2e_kg',
            'co2e_tonnes',
            'calculation_method',
            'status',
            'verification_status',
            'timestamp',
            'calculated_by',
            'calculated_by_username',
            'calculated_at',
        ]
        read_only_fields = [
            'co2e_kg',
            'co2e_tonnes',
            'formula',
            'calculated_at',
            'calculated_by'
        ]


class HotspotSerializer(serializers.ModelSerializer):
    supplier_name = serializers.CharField(source='supplier.name', read_only=True)
    company_name = serializers.CharField(source='company.name', read_only=True)

    class Meta:
        model = Hotspot
        fields = '__all__'


class RecommendationSerializer(serializers.ModelSerializer):
    supplier_name = serializers.CharField(source='supplier.name', read_only=True)

    class Meta:
        model = Recommendation
        fields = '__all__'


class AuditLogSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source='user.username', read_only=True)
    user_role = serializers.SerializerMethodField()

    class Meta:
        model = AuditLog
        fields = '__all__'

    def get_user_role(self, obj):
        if obj.user and hasattr(obj.user, 'profile'):
            return obj.user.profile.role
        return 'SYSTEM'


class ReportSerializer(serializers.ModelSerializer):
    company_name = serializers.CharField(source='company.name', read_only=True)
    generated_by_username = serializers.CharField(source='generated_by.username', read_only=True)

    class Meta:
        model = Report
        fields = '__all__'
        read_only_fields = ['company', 'generated_by']
