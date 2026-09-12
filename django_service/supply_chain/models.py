from decimal import Decimal
from django.db import models
from django.contrib.auth.models import User
from django.core.validators import MinValueValidator, MaxValueValidator
from django.core.exceptions import ValidationError


class Company(models.Model):
    """
    Corporate reporting enterprise measuring Scope 3 supply chain footprints.
    """
    name = models.CharField(max_length=255, unique=True)
    industry = models.CharField(max_length=100)
    country = models.CharField(max_length=100)
    registration_number = models.CharField(max_length=100, blank=True, null=True)
    reporting_year = models.PositiveIntegerField(
        default=2024,
        validators=[MinValueValidator(2000), MaxValueValidator(2100)]
    )
    target_reduction_pct = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=Decimal('30.00'),
        validators=[MinValueValidator(Decimal('0.00')), MaxValueValidator(Decimal('100.00'))],
        help_text="Target carbon reduction percentage (0.00% to 100.00%)"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'companies'
        verbose_name_plural = 'Companies'
        ordering = ['name']

    def __str__(self):
        return self.name


class Supplier(models.Model):
    """
    Distinct supplier entity in the supply chain network.
    Suppliers are stored without duplication, regardless of whether they supply
    as Tier 1, Tier 2, or Tier 3 via SupplierRelationship.
    """
    STATUS_CHOICES = [
        ('ACTIVE', 'Active'),
        ('INACTIVE', 'Inactive'),
        ('PENDING_VERIFICATION', 'Pending Verification'),
    ]

    name = models.CharField(max_length=255)
    supplier_code = models.CharField(max_length=50, unique=True)
    industry_sector = models.CharField(max_length=100)
    location = models.CharField(max_length=150, blank=True, default='')
    country = models.CharField(max_length=100)
    region = models.CharField(max_length=100, blank=True, default='Global')
    contact_name = models.CharField(max_length=150, blank=True, default='')
    contact_email = models.EmailField()
    contact_phone = models.CharField(max_length=50, blank=True, default='')
    status = models.CharField(max_length=30, choices=STATUS_CHOICES, default='ACTIVE')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'suppliers'
        ordering = ['name']

    def __str__(self):
        return f"{self.name} ({self.supplier_code})"


class SupplierRelationship(models.Model):
    """
    Models the multi-tier supply chain hierarchy (Company -> Tier 1 -> Tier 2 -> Tier 3).
    A supplier is not duplicated when participating at different tiers.
    - If parent_supplier is NULL: Supplier is Tier 1 (direct vendor to the company).
    - If parent_supplier is specified: Supplier is Tier 2 or Tier 3 providing goods/services to that parent vendor.
    """
    STATUS_CHOICES = [
        ('ACTIVE', 'Active Relationship'),
        ('INACTIVE', 'Terminated / Inactive'),
    ]

    company = models.ForeignKey(
        Company,
        on_delete=models.CASCADE,
        related_name='supplier_relationships'
    )
    supplier = models.ForeignKey(
        Supplier,
        on_delete=models.CASCADE,
        related_name='customer_relationships'
    )
    parent_supplier = models.ForeignKey(
        Supplier,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='sub_supplier_relationships'
    )
    tier_level = models.PositiveSmallIntegerField(
        default=1,
        validators=[MinValueValidator(1), MaxValueValidator(3)],
        help_text="Tier depth: 1 = Tier 1 (Direct), 2 = Tier 2, 3 = Tier 3"
    )
    procurement_share_pct = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=Decimal('100.00'),
        validators=[MinValueValidator(Decimal('0.01')), MaxValueValidator(Decimal('100.00'))],
        help_text="Procurement share / spend allocation percentage"
    )
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='ACTIVE')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'supplier_relationships'
        ordering = ['tier_level', 'supplier__name']
        constraints = [
            models.UniqueConstraint(
                fields=['company', 'supplier', 'parent_supplier'],
                name='unique_company_supplier_parent_tier'
            )
        ]

    def clean(self):
        # Supplier cannot supply themselves
        if self.parent_supplier and self.supplier_id == self.parent_supplier_id:
            raise ValidationError("A supplier cannot be its own parent supplier.")

        # If tier is 1, parent_supplier must be None
        if self.tier_level == 1 and self.parent_supplier is not None:
            raise ValidationError("Tier 1 suppliers supply directly to the company and cannot have a parent supplier.")

        # If tier is 2 or 3, parent_supplier must be defined
        if self.tier_level in (2, 3) and self.parent_supplier is None:
            raise ValidationError(f"Tier {self.tier_level} suppliers must have an identified parent supplier.")

        # Hierarchy rule: Parent of Tier 2 MUST be Tier 1 for this company
        if self.tier_level == 2 and self.parent_supplier:
            parent_rel = SupplierRelationship.objects.filter(
                company=self.company,
                supplier=self.parent_supplier,
                tier_level=1
            ).first()
            if not parent_rel:
                raise ValidationError("The parent of a Tier 2 supplier must be an existing Tier 1 supplier for this company.")

        # Hierarchy rule: Parent of Tier 3 MUST be Tier 2 for this company
        if self.tier_level == 3 and self.parent_supplier:
            parent_rel = SupplierRelationship.objects.filter(
                company=self.company,
                supplier=self.parent_supplier,
                tier_level=2
            ).first()
            if not parent_rel:
                raise ValidationError("The parent of a Tier 3 supplier must be an existing Tier 2 supplier for this company.")

    def save(self, *args, **kwargs):
        self.full_clean()
        super().save(*args, **kwargs)

    def __str__(self):
        if self.parent_supplier:
            return f"{self.supplier.name} (Tier {self.tier_level} -> {self.parent_supplier.name})"
        return f"{self.supplier.name} (Tier 1 -> {self.company.name})"


class UserProfile(models.Model):
    """
    Role-based profile extending Django authentication User.
    """
    ROLE_CHOICES = [
        ('COMPANY_MANAGER', 'Company / Sustainability Manager'),
        ('ADMIN', 'Company / Sustainability Admin'),
        ('SUPPLIER', 'Supplier Contributor'),
        ('AUDITOR', 'Third-Party Auditor'),
        ('VIEWER', 'Executive Viewer'),
    ]

    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='profile')
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default='VIEWER')
    company = models.ForeignKey(
        Company,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='users'
    )
    supplier = models.ForeignKey(
        Supplier,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='representatives'
    )
    phone = models.CharField(max_length=30, blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'user_profiles'

    def __str__(self):
        return f"{self.user.username} ({self.role})"


class EmissionFactor(models.Model):
    """
    Standardized GHG emissions factors library (DEFRA, EPA GHG Hub, IPCC).
    """
    CATEGORY_CHOICES = [
        ('ELECTRICITY', 'Electricity & Thermal Energy'),
        ('TRANSPORT', 'Freight & Logistics'),
        ('MATERIAL', 'Purchased Goods & Raw Materials'),
        ('FUEL', 'Stationary & Mobile Combustion'),
        ('WASTE', 'Waste Management & Disposal'),
    ]

    activity_name = models.CharField(max_length=255)
    category = models.CharField(max_length=50, choices=CATEGORY_CHOICES)
    scope = models.CharField(max_length=50, help_text="e.g. Scope 3 Cat 1, Scope 3 Cat 4")
    unit = models.CharField(max_length=50, help_text="e.g. kWh, tonne-km, kg, liter")
    factor_value = models.DecimalField(
        max_digits=12,
        decimal_places=6,
        validators=[MinValueValidator(Decimal('0.000000'))],
        help_text="Emission intensity in kg CO2e per unit"
    )
    source = models.CharField(max_length=150, help_text="e.g. DEFRA 2024, EPA GHG Hub, IPCC AR6")
    region = models.CharField(max_length=100, default='Global')
    year = models.PositiveIntegerField(default=2024)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'emission_factors'
        ordering = ['category', 'activity_name']
        constraints = [
            models.UniqueConstraint(
                fields=['activity_name', 'category', 'region', 'year'],
                name='unique_emission_factor_entry'
            )
        ]

    def __str__(self):
        return f"{self.activity_name} ({self.factor_value} kg CO2e / {self.unit})"


class SupplierActivityData(models.Model):
    """
    Operational activity reports submitted by suppliers for Scope 3 emissions calculation.
    Supports Energy (electricity/fuel), Transportation (distance/weight/mode),
    Materials (type/quantity), and general operational activity streams.
    """
    VERIFICATION_CHOICES = [
        ('UNVERIFIED', 'Unverified'),
        ('SUBMITTED', 'Submitted for Review'),
        ('VERIFIED', 'Verified by Auditor'),
        ('REJECTED', 'Rejected'),
        ('DRAFT', 'Draft'),
    ]

    supplier = models.ForeignKey(
        Supplier,
        on_delete=models.CASCADE,
        related_name='activities'
    )
    reporting_period = models.CharField(
        max_length=50,
        blank=True,
        default='',
        help_text="Standard reporting period, e.g. '2024-Q1', '2024-05', or '2024'"
    )
    period_start = models.DateField(null=True, blank=True)
    period_end = models.DateField(null=True, blank=True)
    activity_type = models.CharField(
        max_length=100,
        help_text="e.g. Electricity Consumption, Fuel Combustion, Road Freight, Primary Steel, Raw Materials"
    )
    quantity = models.DecimalField(
        max_digits=15,
        decimal_places=4,
        validators=[MinValueValidator(Decimal('0.0001'))],
        help_text="Activity quantity / numeric value consumed or produced"
    )
    unit = models.CharField(
        max_length=50,
        help_text="Measurement unit e.g. kWh, MWh, liters, km, tonne-km, kg, tonnes"
    )
    source = models.CharField(
        max_length=150,
        blank=True,
        default='Supplier Self-Report',
        help_text="Origin of data e.g. Utility Meter, Fleet Telematics, ERP Invoices, Supplier Self-Report"
    )

    # Domain-specific structured fields
    # Energy:
    fuel_type = models.CharField(max_length=50, blank=True, default='', help_text="e.g. Diesel, Natural Gas, Petrol, Coal")
    # Transportation:
    transport_mode = models.CharField(max_length=50, blank=True, default='', help_text="e.g. Road, Air, Sea, Rail")
    distance = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        null=True,
        blank=True,
        validators=[MinValueValidator(Decimal('0.00'))],
        help_text="Transportation distance in km or miles"
    )
    shipment_weight = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        null=True,
        blank=True,
        validators=[MinValueValidator(Decimal('0.00'))],
        help_text="Shipment payload weight in kg or tonnes"
    )
    # Materials:
    material_type = models.CharField(max_length=100, blank=True, default='', help_text="e.g. Virgin Aluminium, Lithium Carbonate, Scrap Steel")

    # Extensible metadata for calculation engine
    metadata = models.JSONField(default=dict, blank=True, help_text="Additional key-value parameters for emission calculations")

    data_quality_score = models.PositiveSmallIntegerField(
        default=3,
        validators=[MinValueValidator(1), MaxValueValidator(5)],
        help_text="Data reliability score (1: Estimate to 5: Auditable primary meter data)"
    )
    verification_status = models.CharField(
        max_length=30,
        choices=VERIFICATION_CHOICES,
        default='UNVERIFIED'
    )
    verification_notes = models.TextField(blank=True, null=True, help_text="Auditor notes on verification or rejection")
    submitted_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='submitted_activities'
    )
    notes = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'supplier_activity_data'
        ordering = ['-created_at', 'supplier']

    @property
    def value(self):
        """Alias for quantity to match API contracts."""
        return self.quantity

    @value.setter
    def value(self, val):
        self.quantity = val

    @property
    def timestamp(self):
        """Alias for created_at timestamp."""
        return self.created_at

    @property
    def is_verified(self):
        """Convenient boolean indicator for audit readiness."""
        return self.verification_status == 'VERIFIED'

    def clean(self):
        if self.period_start and self.period_end and self.period_end < self.period_start:
            raise ValidationError("period_end cannot be earlier than period_start.")
        if self.quantity is not None and self.quantity <= 0:
            raise ValidationError("quantity/value must be greater than zero.")

    def save(self, *args, **kwargs):
        self.full_clean()
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.supplier.name} - {self.activity_type} ({self.quantity} {self.unit}) [{self.verification_status}]"


class CarbonCalculation(models.Model):
    """
    Deterministic carbon emissions computed from activity data and matched emission factor.
    """
    METHOD_CHOICES = [
        ('SUPPLIER_SPECIFIC', 'Supplier Specific Activity Data'),
        ('HYBRID', 'Hybrid Primary & Secondary Estimates'),
        ('AVERAGE_DATA', 'Industry Average Emission Benchmark'),
        ('SPEND_BASED', 'Economic Input-Output Spend-Based'),
    ]
    STATUS_CHOICES = [
        ('ESTIMATED', 'Estimated'),
        ('VERIFIED', 'Verified by Auditor'),
        ('AUDITED', 'Third-Party Audited'),
    ]

    activity_data = models.OneToOneField(
        SupplierActivityData,
        on_delete=models.CASCADE,
        related_name='calculation'
    )
    emission_factor = models.ForeignKey(
        EmissionFactor,
        on_delete=models.PROTECT,
        related_name='calculations'
    )
    co2e_kg = models.DecimalField(max_digits=18, decimal_places=4)
    co2e_tonnes = models.DecimalField(max_digits=18, decimal_places=6)

    # Historical audit snapshot fields
    input_value = models.DecimalField(max_digits=18, decimal_places=4, null=True, blank=True, help_text="Original activity quantity")
    unit = models.CharField(max_length=50, blank=True, default='', help_text="Unit of activity input")
    emission_factor_value = models.DecimalField(max_digits=12, decimal_places=6, null=True, blank=True, help_text="Snapshot of emission factor intensity")
    emission_factor_source = models.CharField(max_length=150, blank=True, default='', help_text="Source of the emission factor at calculation time")
    formula = models.TextField(blank=True, default='', help_text="Auditable mathematical calculation trace")

    calculation_method = models.CharField(
        max_length=50,
        choices=METHOD_CHOICES,
        default='SUPPLIER_SPECIFIC'
    )
    status = models.CharField(max_length=30, choices=STATUS_CHOICES, default='ESTIMATED')
    calculated_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='performed_calculations'
    )
    calculated_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'carbon_calculations'
        ordering = ['-calculated_at']

    @property
    def timestamp(self):
        return self.calculated_at

    @property
    def supplier_name(self):
        return self.activity_data.supplier.name if self.activity_data and self.activity_data.supplier else ''

    @property
    def supplier_id(self):
        return self.activity_data.supplier_id if self.activity_data else None

    @property
    def reporting_period(self):
        return self.activity_data.reporting_period if self.activity_data else ''

    @property
    def verification_status(self):
        return self.activity_data.verification_status if self.activity_data else ''

    def clean(self):
        if self.activity_data and self.emission_factor:
            if not self.input_value:
                self.input_value = self.activity_data.quantity
            if not self.unit:
                self.unit = self.activity_data.unit
            if not self.emission_factor_value:
                self.emission_factor_value = self.emission_factor.factor_value
            if not self.emission_factor_source:
                self.emission_factor_source = self.emission_factor.source
            if not self.co2e_kg or not self.co2e_tonnes:
                expected_kg = self.activity_data.quantity * self.emission_factor.factor_value
                self.co2e_kg = round(expected_kg, 4)
                self.co2e_tonnes = round(expected_kg / Decimal('1000.0'), 6)
            if not self.formula:
                self.formula = f"{self.input_value} {self.unit} × {self.emission_factor_value} kg CO2e/{self.unit} = {self.co2e_kg} kg CO2e"

    def save(self, *args, **kwargs):
        self.clean()
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.activity_data.supplier.name} Calculation: {self.co2e_tonnes} tCO2e ({self.formula})"


class Hotspot(models.Model):
    """
    Identifies high-carbon concentration hotspots across suppliers and tiers.
    """
    SEVERITY_CHOICES = [
        ('LOW', 'Low Severity (< 5% share)'),
        ('MEDIUM', 'Medium Severity (5% - 15% share)'),
        ('HIGH', 'High Severity (15% - 30% share)'),
        ('CRITICAL', 'Critical Severity (> 30% share)'),
    ]
    STATUS_CHOICES = [
        ('OPEN', 'Open Action Required'),
        ('IN_REVIEW', 'Mitigation Under Review'),
        ('MITIGATED', 'Mitigated / Decarbonized'),
    ]

    company = models.ForeignKey(
        Company,
        on_delete=models.CASCADE,
        related_name='hotspots'
    )
    supplier = models.ForeignKey(
        Supplier,
        on_delete=models.CASCADE,
        related_name='hotspots'
    )
    tier_level = models.PositiveSmallIntegerField(
        validators=[MinValueValidator(1), MaxValueValidator(3)]
    )
    emission_category = models.CharField(max_length=100)
    total_co2e_tonnes = models.DecimalField(max_digits=15, decimal_places=4)
    contribution_pct = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        validators=[MinValueValidator(Decimal('0.01')), MaxValueValidator(Decimal('100.00'))],
        help_text="Percentage contribution to total Scope 3 footprint"
    )
    severity = models.CharField(max_length=20, choices=SEVERITY_CHOICES, default='MEDIUM')
    identified_date = models.DateField()
    status = models.CharField(max_length=30, choices=STATUS_CHOICES, default='OPEN')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'carbon_hotspots'
        ordering = ['-total_co2e_tonnes']

    def __str__(self):
        return f"Hotspot: {self.supplier.name} (Tier {self.tier_level}, {self.total_co2e_tonnes} tCO2e)"


class Recommendation(models.Model):
    """
    Targeted decarbonization and circular supply chain interventions.
    """
    ACTION_CHOICES = [
        ('RENEWABLE_ENERGY', 'Renewable Energy PPA / Solar Transition'),
        ('CIRCULARITY', 'Circular / Recycled Material Substitution'),
        ('LOGISTICS_EFFICIENCY', 'Freight Modal Shift / Logistics Optimization'),
        ('PROCESS_OPTIMIZATION', 'Manufacturing Efficiency & Heat Recovery'),
        ('SUPPLIER_ENGAGEMENT', 'Supplier Capacity Building & Audits'),
    ]
    COST_CHOICES = [
        ('LOW', 'Low OPEX (< $10k)'),
        ('MEDIUM', 'Medium Investment ($10k - $100k)'),
        ('HIGH', 'High Investment ($100k - $500k)'),
        ('CAPEX_INTENSIVE', 'Major Strategic CAPEX (> $500k)'),
    ]
    STATUS_CHOICES = [
        ('PROPOSED', 'Proposed'),
        ('ACCEPTED', 'Accepted by Supplier'),
        ('IN_PROGRESS', 'Implementation In Progress'),
        ('COMPLETED', 'Completed & Verified'),
        ('REJECTED', 'Rejected'),
    ]

    hotspot = models.ForeignKey(
        Hotspot,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='recommendations'
    )
    supplier = models.ForeignKey(
        Supplier,
        on_delete=models.CASCADE,
        related_name='recommendations'
    )
    title = models.CharField(max_length=255)
    description = models.TextField()
    action_type = models.CharField(max_length=50, choices=ACTION_CHOICES)

    # Hotspot Context & Explainability (Phase 14)
    hotspot_name = models.CharField(max_length=255, blank=True, default='', help_text="Originating hotspot entity")
    reason = models.TextField(blank=True, default='', help_text="Underlying rationale based on hotspot metrics")
    recommended_alternative = models.CharField(max_length=255, blank=True, default='', help_text="Specific lower-carbon or circular alternative")
    calculation_basis = models.TextField(blank=True, default='', help_text="Auditable mathematical formula trace")

    # Quantified Current vs Alternative Emissions
    current_emissions_kg = models.DecimalField(max_digits=18, decimal_places=4, default=Decimal('0.0'))
    current_emissions_tonnes = models.DecimalField(max_digits=18, decimal_places=6, default=Decimal('0.0'))
    alternative_emissions_kg = models.DecimalField(max_digits=18, decimal_places=4, default=Decimal('0.0'))
    alternative_emissions_tonnes = models.DecimalField(max_digits=18, decimal_places=6, default=Decimal('0.0'))
    estimated_reduction_kg = models.DecimalField(max_digits=18, decimal_places=4, default=Decimal('0.0'))
    reduction_pct = models.DecimalField(max_digits=6, decimal_places=2, default=Decimal('0.0'))

    # Estimated Potential Reduction (Explicitly not guaranteed)
    potential_reduction_tonnes = models.DecimalField(
        max_digits=15,
        decimal_places=4,
        validators=[MinValueValidator(Decimal('0.0001'))],
        help_text="Estimated potential annual metric tonnes of CO2e reduced"
    )
    cost_level = models.CharField(max_length=20, choices=COST_CHOICES, default='MEDIUM')
    payback_period_years = models.DecimalField(
        max_digits=4,
        decimal_places=1,
        null=True,
        blank=True,
        validators=[MinValueValidator(Decimal('0.1')), MaxValueValidator(Decimal('50.0'))]
    )
    status = models.CharField(max_length=30, choices=STATUS_CHOICES, default='PROPOSED')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'recommendations'
        ordering = ['-potential_reduction_tonnes']

    def __str__(self):
        return f"{self.title} (-{self.potential_reduction_tonnes} tCO2e)"


class AuditLog(models.Model):
    """
    Immutable compliance log tracking data submissions, calculation updates, and status overrides.
    Strictly forbids updates and deletions to guarantee audit integrity in SQLite.
    """
    user = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='audit_logs'
    )
    action = models.CharField(max_length=100, help_text="e.g. ACTIVITY_SUBMITTED, CALCULATION_RUN")
    entity_type = models.CharField(max_length=100, help_text="Target table/model name")
    entity_id = models.CharField(max_length=50)
    details = models.JSONField(default=dict, help_text="Context details or field diff")
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    timestamp = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'audit_logs'
        ordering = ['-timestamp']

    def save(self, *args, **kwargs):
        if self.pk:
            raise ValidationError("AuditLog records are strictly immutable and cannot be updated.")
        super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        raise ValidationError("AuditLog records are strictly immutable and cannot be deleted.")

    @classmethod
    def log_action(cls, user, action, entity_type, entity_id, details=None, ip_address=None, request=None):
        """
        Standardized factory method to create an immutable audit record.
        Extracts IP address from request if available.
        """
        ip = ip_address
        if request and not ip:
            x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
            if x_forwarded_for:
                ip = x_forwarded_for.split(',')[0].strip()
            else:
                ip = request.META.get('REMOTE_ADDR')

        return cls.objects.create(
            user=user if user and getattr(user, 'is_authenticated', False) else None,
            action=action,
            entity_type=entity_type,
            entity_id=str(entity_id),
            details=details or {},
            ip_address=ip
        )

    def __str__(self):
        return f"[{self.timestamp}] {self.action} on {self.entity_type}:{self.entity_id}"


class Report(models.Model):
    """
    Scope 3 compliance disclosure summaries with multi-tier emissions breakdowns.
    """
    FORMAT_CHOICES = [
        ('JSON', 'JSON Structured Output'),
        ('PDF', 'PDF Executive Report'),
        ('CSV', 'CSV Raw Export'),
    ]
    STATUS_CHOICES = [
        ('DRAFT', 'Draft'),
        ('FINAL', 'Finalized'),
        ('PUBLISHED', 'Published for Stakeholders'),
    ]

    company = models.ForeignKey(
        Company,
        on_delete=models.CASCADE,
        related_name='reports'
    )
    title = models.CharField(max_length=255)
    reporting_year = models.PositiveIntegerField(
        validators=[MinValueValidator(2000), MaxValueValidator(2100)]
    )
    total_scope3_tonnes = models.DecimalField(max_digits=18, decimal_places=4)
    tier1_emissions_tonnes = models.DecimalField(max_digits=18, decimal_places=4)
    tier2_emissions_tonnes = models.DecimalField(max_digits=18, decimal_places=4)
    tier3_emissions_tonnes = models.DecimalField(max_digits=18, decimal_places=4)
    report_format = models.CharField(max_length=20, choices=FORMAT_CHOICES, default='JSON')
    status = models.CharField(max_length=30, choices=STATUS_CHOICES, default='DRAFT')
    generated_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='generated_reports'
    )
    generated_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'reports'
        ordering = ['-generated_at']

    def __str__(self):
        return f"{self.title} ({self.reporting_year}) - {self.total_scope3_tonnes} tCO2e"
