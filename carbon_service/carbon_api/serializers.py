"""
Carbon API Serializers — DRF request/response validation schemas.
"""
from rest_framework import serializers


class ActivityDataSerializer(serializers.Serializer):
    """Input for emission calculation."""
    activityType = serializers.CharField(max_length=100)
    value = serializers.FloatField(min_value=0)
    unit = serializers.CharField(max_length=50)
    supplierId = serializers.CharField(required=False, allow_blank=True)
    country = serializers.CharField(max_length=100, required=False, default='Global')
    category = serializers.IntegerField(min_value=1, max_value=15, required=False)


class EmissionResultSerializer(serializers.Serializer):
    """Output from emission calculation."""
    emissionValue = serializers.FloatField()
    emissionUnit = serializers.CharField()
    emissionFactor = serializers.DictField()
    methodology = serializers.CharField()
    confidence = serializers.FloatField()


class ForecastRequestSerializer(serializers.Serializer):
    """Input for ML emission forecast."""
    supplierId = serializers.CharField(required=False)
    periods = serializers.IntegerField(default=12, min_value=1, max_value=36)
    frequency = serializers.ChoiceField(choices=['monthly', 'quarterly'], default='monthly')


class SupplierScoreSerializer(serializers.Serializer):
    """Input for ESG/carbon supplier scoring."""
    supplierId = serializers.CharField()
    totalEmissions = serializers.FloatField(min_value=0)
    tier = serializers.IntegerField(min_value=1, max_value=3)
    country = serializers.CharField(max_length=100)
    certifications = serializers.ListField(
        child=serializers.CharField(), required=False, default=list
    )
    reductionRate = serializers.FloatField(required=False, default=0.0)
    dataQuality = serializers.ChoiceField(
        choices=['Measured', 'Estimated', 'Calculated', 'Supplier Reported'],
        required=False,
        default='Calculated'
    )
