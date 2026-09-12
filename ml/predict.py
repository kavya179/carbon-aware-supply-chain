"""
ml/predict.py
=============
Phase 18 — Production ML Prediction and Estimation Interface

Provides robust inference functions to estimate missing or unavailable Scope 3
supplier and activity emissions using the trained RandomForest model.

KEY GOVERNANCE RULES:
  1. All returned estimates are strictly labelled source='ML_ESTIMATED'.
  2. Output is intended solely for data gap-filling when primary data is unavailable.
  3. The rule-based CarbonCalculationEngine remains the primary and authoritative system.
  4. Never present ML estimates as verified primary Scope 3 emissions.
"""

import argparse
import json
import sys
import warnings
from pathlib import Path
from typing import Any, Dict, List, Optional, Union

ROOT_DIR = Path(__file__).resolve().parent.parent
ML_DIR = Path(__file__).resolve().parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))
if str(ML_DIR) not in sys.path:
    sys.path.insert(0, str(ML_DIR))

import joblib
import numpy as np
import pandas as pd

try:
    from ml.preprocessing import CarbonDataPreprocessor, MODELS_DIR
except ImportError:
    from preprocessing import CarbonDataPreprocessor, MODELS_DIR

warnings.filterwarnings("ignore")

MODEL_FILE = MODELS_DIR / "co2e_estimator.joblib"
PREPROCESSOR_FILE = MODELS_DIR / "preprocessor.joblib"
MODEL_METADATA_FILE = MODELS_DIR / "model_metadata.json"

_CACHED_MODEL = None
_CACHED_PREPROCESSOR = None
_CACHED_METADATA = None

SOURCE_LABEL = "ML_ESTIMATED"
DISCLAIMER_TEXT = (
    "ML-estimated value for gap-filling missing activity/supplier data. "
    "Authority resides with the rule-based CarbonCalculationEngine."
)


def load_artifacts() -> tuple:
    """Load model and preprocessor with memory caching for fast inference."""
    global _CACHED_MODEL, _CACHED_PREPROCESSOR, _CACHED_METADATA

    if _CACHED_MODEL is None or _CACHED_PREPROCESSOR is None:
        if not MODEL_FILE.exists() or not PREPROCESSOR_FILE.exists():
            raise FileNotFoundError(
                f"Model or Preprocessor not found in {MODELS_DIR}. "
                "Run `python ml/train_model.py` first."
            )
        _CACHED_MODEL = joblib.load(MODEL_FILE)
        _CACHED_PREPROCESSOR = joblib.load(PREPROCESSOR_FILE)
        if MODEL_METADATA_FILE.exists():
            with open(MODEL_METADATA_FILE, "r") as f:
                _CACHED_METADATA = json.load(f)

    return _CACHED_MODEL, _CACHED_PREPROCESSOR, _CACHED_METADATA


def _calculate_confidence_score(tree_preds: np.ndarray, mean_pred: float) -> float:
    """
    Calculate confidence score (0.0 to 1.0) based on tree prediction variance (CV).
    Lower relative standard deviation across random forest trees indicates higher confidence.
    """
    if len(tree_preds) == 0 or mean_pred <= 0:
        return 0.50
    std_dev = float(np.std(tree_preds))
    rel_std = std_dev / mean_pred
    # Map relative std: 0.0 -> 0.98 confidence, 0.5+ -> 0.40 confidence
    score = 1.0 / (1.0 + 2.0 * rel_std)
    return round(float(np.clip(score, 0.30, 0.98)), 3)


def estimate_co2e(features: Dict[str, Any]) -> Dict[str, Any]:
    """
    Estimate missing Scope 3 carbon emissions for a single supplier activity.

    Parameters:
      features: dict with available features. Missing values will be imputed automatically.
        - industry_sector: str (e.g. 'Automotive Manufacturing', 'Steel & Metals')
        - supplier_tier: int (1, 2, or 3)
        - country: str (e.g. 'Germany', 'India', 'United States')
        - energy_kwh_monthly: float
        - grid_emission_factor: float (kg CO2e / kWh)
        - renewable_energy_pct: float (0 - 100)
        - fuel_litres_monthly: float
        - transport_mode: str (e.g. 'road_diesel', 'sea_container', 'rail_electric')
        - distance_km: float
        - shipment_weight_t: float
        - material_type: str (e.g. 'steel', 'aluminum_primary', 'plastic_pet')
        - material_qty_kg: float
        - material_ef_kgco2e_kg: float
        - transport_ef_kgco2e_tonne_km: float

    Returns:
      Structured estimation dictionary with source='ML_ESTIMATED'.
    """
    model, preprocessor, metadata = load_artifacts()

    # Preprocess input dictionary
    X_df = preprocessor.transform(features)

    # Individual tree predictions for uncertainty estimation
    if hasattr(model, "estimators_"):
        tree_preds_log = np.array([tree.predict(X_df.values)[0] for tree in model.estimators_])
        tree_preds_kg = np.expm1(tree_preds_log)
        pred_kg = float(np.mean(tree_preds_kg))
        confidence = _calculate_confidence_score(tree_preds_kg, pred_kg)
        pred_p10 = float(np.percentile(tree_preds_kg, 10))
        pred_p90 = float(np.percentile(tree_preds_kg, 90))
    else:
        pred_log = float(model.predict(X_df)[0])
        pred_kg = float(np.expm1(pred_log))
        confidence = 0.85
        pred_p10 = round(pred_kg * 0.90, 2)
        pred_p90 = round(pred_kg * 1.10, 2)

    pred_tonnes = round(pred_kg / 1000.0, 4)
    pred_kg = round(pred_kg, 2)

    return {
        "status": "success",
        "co2e_kg_estimated": pred_kg,
        "co2e_tonnes_estimated": pred_tonnes,
        "uncertainty_interval_kg": {
            "p10": round(pred_p10, 2),
            "p90": round(pred_p90, 2),
        },
        "source": SOURCE_LABEL,
        "is_gap_fill": True,
        "confidence_score": confidence,
        "confidence_level": "HIGH" if confidence >= 0.80 else ("MEDIUM" if confidence >= 0.60 else "LOW"),
        "model_used": type(model).__name__,
        "imputed_features": {
            k: features.get(k, "IMPUTED_BY_PIPELINE")
            for k in ["renewable_energy_pct", "distance_km", "fuel_litres_monthly"]
            if k not in features or features[k] is None
        },
        "disclaimer": DISCLAIMER_TEXT,
    }


def estimate_co2e_batch(records: Union[List[Dict[str, Any]], pd.DataFrame]) -> List[Dict[str, Any]]:
    """
    Batch estimation for multiple supplier / activity records.
    """
    model, preprocessor, metadata = load_artifacts()

    if isinstance(records, pd.DataFrame):
        df_in = records
    else:
        df_in = pd.DataFrame(records)

    X_df = preprocessor.transform(df_in)
    preds_log = model.predict(X_df)
    preds_kg = np.expm1(preds_log)

    results = []
    for i, pred in enumerate(preds_kg):
        val_kg = round(float(pred), 2)
        results.append({
            "record_index": i,
            "co2e_kg_estimated": val_kg,
            "co2e_tonnes_estimated": round(val_kg / 1000.0, 4),
            "source": SOURCE_LABEL,
            "is_gap_fill": True,
            "disclaimer": DISCLAIMER_TEXT,
        })
    return results


def main():
    parser = argparse.ArgumentParser(description="Carbon Scope 3 ML Predictor CLI")
    parser.add_argument("--industry", default="Automotive Manufacturing", help="Industry sector")
    parser.add_argument("--tier", type=int, default=2, choices=[1, 2, 3], help="Supplier tier level")
    parser.add_argument("--country", default="Germany", help="Supplier country")
    parser.add_argument("--energy_kwh", type=float, default=12000.0, help="Monthly electricity consumption (kWh)")
    parser.add_argument("--renewable_pct", type=float, default=40.0, help="Renewable electricity (%)")
    parser.add_argument("--transport_mode", default="road_diesel", help="Transport mode")
    parser.add_argument("--distance_km", type=float, default=850.0, help="Shipping distance (km)")
    parser.add_argument("--weight_t", type=float, default=3.5, help="Shipment weight in tonnes")
    parser.add_argument("--material_type", default="steel", help="Primary material type")
    parser.add_argument("--material_qty_kg", type=float, default=15000.0, help="Material quantity in kg")
    args = parser.parse_args()

    input_data = {
        "industry_sector": args.industry,
        "supplier_tier": args.tier,
        "country": args.country,
        "energy_kwh_monthly": args.energy_kwh,
        "renewable_energy_pct": args.renewable_pct,
        "transport_mode": args.transport_mode,
        "distance_km": args.distance_km,
        "shipment_weight_t": args.weight_t,
        "material_type": args.material_type,
        "material_qty_kg": args.material_qty_kg,
    }

    print("=" * 70)
    print("CARBON SCOPE 3 ML ESTIMATION (GAP-FILLING)")
    print("=" * 70)
    print("Input Profile:")
    for k, v in input_data.items():
        print(f"  {k:<25}: {v}")

    result = estimate_co2e(input_data)

    print("\nEstimation Result:")
    print(f"  Estimated Emissions (kg)     : {result['co2e_kg_estimated']:,.2f} kg CO2e")
    print(f"  Estimated Emissions (tonnes) : {result['co2e_tonnes_estimated']:,.3f} tCO2e")
    print(f"  80% Prediction Interval      : [{result['uncertainty_interval_kg']['p10']:,.2f}, {result['uncertainty_interval_kg']['p90']:,.2f}] kg")
    print(f"  Confidence Level             : {result['confidence_level']} (Score: {result['confidence_score']:.3f})")
    print(f"  Provenance / Source Tag      : {result['source']}")
    print(f"  Model Used                   : {result['model_used']}")
    print(f"  Governance Disclaimer        : {result['disclaimer']}")
    print("=" * 70)


if __name__ == "__main__":
    main()
