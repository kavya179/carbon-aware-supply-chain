from django.contrib import admin
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
    Report,
)

@admin.register(Company)
class CompanyAdmin(admin.ModelAdmin):
    list_display = ('name', 'industry', 'country', 'reporting_year', 'target_reduction_pct')
    search_fields = ('name', 'industry', 'country')

@admin.register(Supplier)
class SupplierAdmin(admin.ModelAdmin):
    list_display = ('name', 'supplier_code', 'industry_sector', 'country', 'status')
    list_filter = ('status', 'country')
    search_fields = ('name', 'supplier_code')

@admin.register(SupplierRelationship)
class SupplierRelationshipAdmin(admin.ModelAdmin):
    list_display = ('supplier', 'company', 'tier_level', 'parent_supplier', 'status', 'procurement_share_pct')
    list_filter = ('tier_level', 'status', 'company')
    search_fields = ('supplier__name', 'parent_supplier__name')

@admin.register(UserProfile)
class UserProfileAdmin(admin.ModelAdmin):
    list_display = ('user', 'role', 'company', 'supplier')
    list_filter = ('role',)

@admin.register(EmissionFactor)
class EmissionFactorAdmin(admin.ModelAdmin):
    list_display = ('activity_name', 'category', 'scope', 'factor_value', 'unit', 'source')
    list_filter = ('category', 'scope')
    search_fields = ('activity_name', 'source')

@admin.register(SupplierActivityData)
class SupplierActivityDataAdmin(admin.ModelAdmin):
    list_display = ('supplier', 'activity_type', 'quantity', 'unit', 'verification_status', 'period_end')
    list_filter = ('verification_status', 'activity_type')

@admin.register(CarbonCalculation)
class CarbonCalculationAdmin(admin.ModelAdmin):
    list_display = ('activity_data', 'emission_factor', 'co2e_tonnes', 'status', 'calculated_at')
    list_filter = ('status', 'calculation_method')

@admin.register(Hotspot)
class HotspotAdmin(admin.ModelAdmin):
    list_display = ('supplier', 'company', 'tier_level', 'total_co2e_tonnes', 'severity', 'status')
    list_filter = ('severity', 'status', 'tier_level')

@admin.register(Recommendation)
class RecommendationAdmin(admin.ModelAdmin):
    list_display = ('title', 'supplier', 'action_type', 'potential_reduction_tonnes', 'status')
    list_filter = ('action_type', 'status', 'cost_level')

@admin.register(AuditLog)
class AuditLogAdmin(admin.ModelAdmin):
    list_display = ('action', 'entity_type', 'entity_id', 'user', 'timestamp')
    list_filter = ('action', 'entity_type')

@admin.register(Report)
class ReportAdmin(admin.ModelAdmin):
    list_display = ('title', 'company', 'reporting_year', 'total_scope3_tonnes', 'status')
    list_filter = ('status', 'reporting_year')
