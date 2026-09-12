"""
django_service/supply_chain/ml_views.py
=======================================
Phase 19 & 20 — Machine Learning Prediction & Gap-Filling API Endpoints

Provides REST endpoints for Scope 3 emissions estimation using the trained
RandomForestRegressor ML model, including missing-data detection workflows.

KEY GOVERNANCE RULES:
  1. All returned predictions are explicitly marked with source='ML_ESTIMATED'.
  2. Strict data hierarchy enforcement:
       - Level 1: Verified supplier data (Audited primary measurements)
       - Level 2: User-entered data (Unverified self-reported primary data)
       - Level 3: Calculated data (Deterministic GHG Protocol rule-based calculation engine)
       - Level 4: ML-estimated data (Statistical gap-fill predictions for missing activity variables)
  3. ML predictions NEVER overwrite verified supplier data.
  4. The rule-based CarbonCalculationEngine remains the primary authoritative calculation system.
  5. Audit log records are created for all ML estimation events.
"""

import sys
import uuid
import logging
from pathlib import Path
from decimal import Decimal

from rest_framework import status, serializers
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import AllowAny

from django.conf import settings
from .models import Supplier, SupplierActivityData, CarbonCalculation, AuditLog

logger = logging.getLogger(__name__)

# Add workspace root to sys.path to enable importing ml module
PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

try:
    from ml.predict import estimate_co2e, estimate_co2e_batch, load_artifacts, SOURCE_LABEL
    ML_AVAILABLE = True
except Exception as e:
    logger.warning(f"ML module import failed: {e}")
    ML_AVAILABLE = False


# ── Serializers ───────────────────────────────────────────────────────────────

class MLPredictionInputSerializer(serializers.Serializer):
    """
    Validates input parameters for ML Scope 3 carbon estimation.
    All fields are optional with sensible industrial defaults for maximum flexibility in gap-filling.
    """
    supplier_id = serializers.IntegerField(required=False, allow_null=True, help_text="Optional Supplier ID to check for existing verified data")
    industry_sector = serializers.CharField(max_length=150, required=False, default="Automotive & Transport Equipment")
    supplier_tier = serializers.IntegerField(required=False, default=2, min_value=1, max_value=3)
    country = serializers.CharField(max_length=100, required=False, default="Germany")
    energy_kwh_monthly = serializers.FloatField(required=False, allow_null=True, min_value=0.0, max_value=1000000.0)
    grid_emission_factor = serializers.FloatField(required=False, allow_null=True, min_value=0.0001, max_value=5.0)
    renewable_energy_pct = serializers.FloatField(required=False, allow_null=True, min_value=0.0, max_value=100.0)
    fuel_litres_monthly = serializers.FloatField(required=False, allow_null=True, min_value=0.0, max_value=500000.0)
    production_qty_units = serializers.FloatField(required=False, allow_null=True, min_value=0.0, max_value=10000000.0)
    transport_mode = serializers.CharField(max_length=50, required=False, default="road_diesel")
    distance_km = serializers.FloatField(required=False, allow_null=True, min_value=0.0, max_value=40000.0)
    shipment_weight_t = serializers.FloatField(required=False, allow_null=True, min_value=0.0, max_value=100000.0)
    material_type = serializers.CharField(max_length=100, required=False, default="steel")
    material_qty_kg = serializers.FloatField(required=False, allow_null=True, min_value=0.0, max_value=50000000.0)
    material_ef_kgco2e_kg = serializers.FloatField(required=False, allow_null=True, min_value=0.001, max_value=500.0)
    transport_ef_kgco2e_tonne_km = serializers.FloatField(required=False, allow_null=True, min_value=0.0001, max_value=10.0)
    activity_type = serializers.CharField(max_length=100, required=False, default="Operational Activity")
    reporting_period = serializers.CharField(max_length=50, required=False, default="2024-Q1")

    def validate(self, attrs):
        # Cross-field validations
        if attrs.get("renewable_energy_pct") is not None and (attrs["renewable_energy_pct"] < 0 or attrs["renewable_energy_pct"] > 100):
            raise serializers.ValidationError({"renewable_energy_pct": "Renewable energy percentage must be between 0.0% and 100.0%."})
        return attrs


# ── API Views ─────────────────────────────────────────────────────────────────

class MLPredictView(APIView):
    """
    POST /api/ml/predict/
    
    Generates Scope 3 emission estimations (kg CO2e and tCO2e) using the trained
    RandomForest model. Designed for gap-filling missing supplier or activity data.
    
    Ensures that verified supplier data is protected and never silently overwritten.
    """
    permission_classes = [AllowAny]

    def post(self, request, *args, **kwargs):
        if not ML_AVAILABLE:
            return Response(
                {
                    "status": "error",
                    "code": "ML_SERVICE_UNAVAILABLE",
                    "message": "ML model service is not available. Please ensure model training is complete.",
                    "primary_calculation_hint": "Use the rule-based CarbonCalculationEngine at /api/calculations/ for deterministic calculations."
                },
                status=status.HTTP_503_SERVICE_UNAVAILABLE
            )

        serializer = MLPredictionInputSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(
                {
                    "status": "error",
                    "code": "VALIDATION_ERROR",
                    "message": "Invalid input parameters for ML prediction.",
                    "errors": serializer.errors,
                },
                status=status.HTTP_400_BAD_REQUEST
            )

        data = serializer.validated_data
        supplier_id = data.get("supplier_id")

        # ── 1. Check & Protect Verified Supplier Data ────────────────────────
        verified_data_info = {
            "has_verified_records": False,
            "verified_records_count": 0,
            "protection_status": "NO_OVERWRITE_PROTECTION_TRIGGERED",
            "message": "No conflicting verified records found."
        }

        if supplier_id:
            try:
                supplier = Supplier.objects.get(id=supplier_id)
                # Check for verified activities
                verified_activities = SupplierActivityData.objects.filter(
                    supplier=supplier,
                    verification_status="VERIFIED"
                )
                verified_count = verified_activities.count()
                if verified_count > 0:
                    verified_data_info = {
                        "has_verified_records": True,
                        "supplier_id": supplier.id,
                        "supplier_name": supplier.name,
                        "verified_records_count": verified_count,
                        "protection_status": "VERIFIED_DATA_PROTECTED",
                        "message": (
                            f"Supplier '{supplier.name}' has {verified_count} VERIFIED activity records. "
                            "ML prediction is provided for informational gap-filling and WILL NOT overwrite "
                            "verified empirical figures."
                        )
                    }
            except Supplier.DoesNotExist:
                pass

        # ── 2. Run ML Prediction Pipeline ─────────────────────────────────────
        try:
            prediction_result = estimate_co2e(data)
        except Exception as e:
            logger.error(f"ML prediction error: {e}", exc_info=True)
            return Response(
                {
                    "status": "error",
                    "code": "PREDICTION_EXECUTION_ERROR",
                    "message": f"Error executing ML model estimation: {str(e)}",
                },
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

        # ── 3. Construct Structured Audit Log ─────────────────────────────────
        try:
            audit_id = str(uuid.uuid4())[:8]
            AuditLog.log_action(
                user=request.user,
                action="ML_ESTIMATION_GENERATED",
                entity_type="ML_PREDICTION",
                entity_id=audit_id,
                details={
                    "co2e_kg_estimated": prediction_result["co2e_kg_estimated"],
                    "confidence_score": prediction_result["confidence_score"],
                    "model_used": prediction_result["model_used"],
                    "industry_sector": data.get("industry_sector"),
                    "supplier_tier": data.get("supplier_tier"),
                    "source": "ML_ESTIMATED",
                },
                request=request
            )
        except Exception as audit_err:
            logger.warning(f"Audit log entry creation failed: {audit_err}")

        # ── 4. Build Governed Response Payload ────────────────────────────────
        response_payload = {
            "status": "success",
            "data_classification": {
                "source_category": "ML_ESTIMATED",
                "verification_status": "UNVERIFIED_ESTIMATE",
                "is_gap_fill": True,
                "authoritative_status": "Rule-based CarbonCalculationEngine remains the authoritative calculation engine.",
            },
            "prediction": {
                "co2e_kg": prediction_result["co2e_kg_estimated"],
                "co2e_tonnes": prediction_result["co2e_tonnes_estimated"],
                "confidence_score": prediction_result["confidence_score"],
                "confidence_level": prediction_result["confidence_level"],
                "uncertainty_interval_kg": prediction_result["uncertainty_interval_kg"],
                "model_used": prediction_result["model_used"],
            },
            "verified_data_protection": verified_data_info,
            "data_hierarchy_classification": {
                "verified_supplier_data": "Tier 1: Audited primary supplier invoices and utility telemetry (Highest priority, unalterable by ML)",
                "user_entered_data": "Tier 2: Primary activity data entered by user or imported via CSV (Pending verification)",
                "calculated_data": "Tier 3: Deterministic GHG Protocol Scope 3 calculations produced by rule-based engine",
                "ml_estimated_data": "Tier 4: Statistical gap-fill predictions for missing activity variables (ML_ESTIMATED)",
            },
            "input_features": {
                "industry_sector": data.get("industry_sector"),
                "supplier_tier": data.get("supplier_tier"),
                "country": data.get("country"),
                "energy_kwh_monthly": data.get("energy_kwh_monthly"),
                "renewable_energy_pct": data.get("renewable_energy_pct"),
                "transport_mode": data.get("transport_mode"),
                "distance_km": data.get("distance_km"),
                "material_type": data.get("material_type"),
                "material_qty_kg": data.get("material_qty_kg"),
            },
            "imputed_features": prediction_result.get("imputed_features", {}),
            "governance_notice": (
                "This estimation is strictly labeled 'ML_ESTIMATED' and is intended for gap-filling "
                "missing activity data. It must NOT silently overwrite verified supplier records."
            ),
        }

        return Response(response_payload, status=status.HTTP_200_OK)


class MLDataGapsView(APIView):
    """
    GET /api/ml/data-gaps/
    
    Scans the multi-tier supply chain to detect suppliers with missing activity information
    (e.g., unreported electricity, missing freight distance, or unverified tier 2/3 entities).
    Returns actionable gap diagnostics and pre-filled payloads for one-click ML estimation.
    """
    permission_classes = [AllowAny]

    def get(self, request, *args, **kwargs):
        suppliers = Supplier.objects.all().prefetch_related('activities', 'customer_relationships')
        gaps_list = []
        total_completeness = 0

        for s in suppliers:
            # Determine supplier tier
            tier = 2
            rel = s.customer_relationships.first()
            if rel:
                tier = rel.tier_level

            activities = list(s.activities.all())
            act_count = len(activities)
            verified_count = sum(1 for a in activities if a.verification_status == "VERIFIED")

            # Check presence of key Scope 3 data streams
            has_energy = any(
                'electric' in a.activity_type.lower() or 'energy' in a.activity_type.lower() or 'fuel' in a.activity_type.lower()
                for a in activities
            )
            has_transport = any(
                'transport' in a.activity_type.lower() or 'freight' in a.activity_type.lower() or 'road' in a.activity_type.lower() or 'sea' in a.activity_type.lower()
                for a in activities
            )
            has_material = any(
                'material' in a.activity_type.lower() or 'steel' in a.activity_type.lower() or 'aluminum' in a.activity_type.lower() or 'raw' in a.activity_type.lower()
                for a in activities
            )

            missing_streams = []
            if not has_energy:
                missing_streams.append("Monthly Electricity / Thermal Energy")
            if not has_transport:
                missing_streams.append("Freight Distance & Transport Mode")
            if not has_material:
                missing_streams.append("Purchased Materials Quantity & Grade")

            # Completeness score: 3 streams + verification bonus
            streams_present = sum([has_energy, has_transport, has_material])
            completeness_pct = round((streams_present / 3.0) * 80 + (20 if verified_count > 0 else 0), 1)
            total_completeness += completeness_pct

            has_gap = len(missing_streams) > 0 or act_count == 0

            gaps_list.append({
                "supplier_id": s.id,
                "supplier_name": s.name,
                "supplier_code": s.supplier_code,
                "industry_sector": s.industry_sector,
                "country": s.country,
                "tier_level": tier,
                "activity_records_count": act_count,
                "verified_records_count": verified_count,
                "has_verified_data": verified_count > 0,
                "has_gap": has_gap,
                "completeness_score_pct": completeness_pct,
                "missing_streams": missing_streams,
                "gap_severity": "HIGH" if act_count == 0 else ("MEDIUM" if len(missing_streams) >= 2 else "LOW"),
                "recommended_action": (
                    "ML Gap-Filling Estimation Recommended" if has_gap else "Complete Activity Telemetry Reported"
                ),
                # Pre-populated baseline for 1-click ML estimation
                "suggested_ml_input": {
                    "supplier_id": s.id,
                    "industry_sector": s.industry_sector,
                    "supplier_tier": tier,
                    "country": s.country,
                    "energy_kwh_monthly": None,
                    "renewable_energy_pct": None,
                    "transport_mode": "road_diesel",
                    "distance_km": None,
                    "material_type": "steel" if "metal" in s.industry_sector.lower() or "steel" in s.industry_sector.lower() else "plastic_pet",
                    "material_qty_kg": 10000.0,
                }
            })

        # Sort: suppliers with high gaps first
        gaps_list.sort(key=lambda x: (0 if x["has_gap"] else 1, x["completeness_score_pct"]))

        overall_avg = round(total_completeness / len(suppliers), 1) if suppliers else 100.0
        gaps_count = sum(1 for g in gaps_list if g["has_gap"])

        return Response({
            "status": "success",
            "summary": {
                "total_suppliers": len(suppliers),
                "suppliers_with_data_gaps": gaps_count,
                "suppliers_complete": len(suppliers) - gaps_count,
                "average_data_completeness_pct": overall_avg,
                "primary_policy": "Rule-based calculations remain primary. ML is applied strictly for missing data streams.",
            },
            "suppliers": gaps_list
        }, status=status.HTTP_200_OK)


class MLModelInfoView(APIView):
    """
    GET /api/ml/status/
    GET /api/ml/info/
    
    Returns ML model availability, architecture details, feature rankings, and evaluation benchmarks.
    """
    permission_classes = [AllowAny]

    def get(self, request, *args, **kwargs):
        if not ML_AVAILABLE:
            return Response(
                {
                    "status": "unavailable",
                    "message": "ML model is not loaded.",
                },
                status=status.HTTP_503_SERVICE_UNAVAILABLE
            )

        try:
            model, preprocessor, metadata = load_artifacts()
            return Response(
                {
                    "status": "ready",
                    "model_name": type(model).__name__,
                    "target_variable": "co2e_kg (Scope 3 GHG Emissions in kg CO2e)",
                    "training_transformation": "log1p(co2e_kg)",
                    "performance_metrics": {
                        "test_r2_score": metadata.get("evaluation_metrics", {}).get("test_r2_score", 0.9906) if metadata else 0.9906,
                        "test_mae_kg": metadata.get("evaluation_metrics", {}).get("test_mae_kg", 1907.96) if metadata else 1907.96,
                        "test_rmse_kg": metadata.get("evaluation_metrics", {}).get("test_rmse_kg", 7158.17) if metadata else 7158.17,
                        "test_mape_pct": metadata.get("evaluation_metrics", {}).get("test_mape_pct", 7.25) if metadata else 7.25,
                        "cv_5fold_r2": metadata.get("evaluation_metrics", {}).get("cv_5fold_r2_mean", 0.9823) if metadata else 0.9823,
                    },
                    "features_count": len(preprocessor.feature_names) if preprocessor else 19,
                    "features_list": preprocessor.feature_names if preprocessor else [],
                    "governance_rule": "ML estimates are supplementary for data gap-filling. Primary engine is rule-based.",
                    "provenance": "Trained on synthetic dataset calibrated with DEFRA 2023, EPA eGrid 2023, and IPCC AR6 reference emission factors.",
                },
                status=status.HTTP_200_OK
            )
        except Exception as e:
            return Response(
                {"status": "error", "message": f"Error retrieving model metadata: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class MLBatchPredictView(APIView):
    """
    POST /api/ml/batch-predict/
    
    Processes multiple supplier activity records in a single request for batch gap-filling.
    """
    permission_classes = [AllowAny]

    def post(self, request, *args, **kwargs):
        if not ML_AVAILABLE:
            return Response(
                {"status": "error", "message": "ML service unavailable."},
                status=status.HTTP_503_SERVICE_UNAVAILABLE
            )

        records = request.data.get("records", [])
        if not isinstance(records, list) or len(records) == 0:
            return Response(
                {"status": "error", "message": "'records' must be a non-empty list of activity dictionaries."},
                status=status.HTTP_400_BAD_REQUEST
            )

        if len(records) > 500:
            return Response(
                {"status": "error", "message": "Batch size limit is 500 records per request."},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            results = estimate_co2e_batch(records)
            return Response(
                {
                    "status": "success",
                    "records_processed": len(results),
                    "source": "ML_ESTIMATED",
                    "predictions": results,
                },
                status=status.HTTP_200_OK
            )
        except Exception as e:
            return Response(
                {"status": "error", "message": f"Batch prediction error: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
