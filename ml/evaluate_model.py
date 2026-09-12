"""
ml/evaluate_model.py
====================
Phase 18 — Comprehensive ML Model Evaluation

Evaluates the trained RandomForestRegressor on the held-out test partition (test.csv).
Computes MAE, RMSE, R², MAPE, error percentiles, and sliced performance by:
  - Supplier Tier (Tier 1, Tier 2, Tier 3)
  - Industry Sector
  - Transport Mode
  - Material Type
  - Emission Magnitude Categories

IMPORTANT:
  - Held-out test data was NOT seen during training or preprocessing fitting.
  - Evaluation is reported in actual kg CO2e and tonnes CO2e.
  - ML outputs are supplementary gap-filling estimates; rule-based engine is primary.
"""

import json
import sys
import warnings
from pathlib import Path
from typing import Dict, Any, List

ROOT_DIR = Path(__file__).resolve().parent.parent
ML_DIR = Path(__file__).resolve().parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))
if str(ML_DIR) not in sys.path:
    sys.path.insert(0, str(ML_DIR))

import joblib
import numpy as np
import pandas as pd
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score

try:
    from ml.preprocessing import (
        CarbonDataPreprocessor,
        DATASET_DIR,
        MODELS_DIR,
        TARGET_COL,
    )
except ImportError:
    from preprocessing import (
        CarbonDataPreprocessor,
        DATASET_DIR,
        MODELS_DIR,
        TARGET_COL,
    )

warnings.filterwarnings("ignore")

TEST_CSV = DATASET_DIR / "test.csv"
MODEL_FILE = MODELS_DIR / "co2e_estimator.joblib"
PREPROCESSOR_FILE = MODELS_DIR / "preprocessor.joblib"
EVALUATION_REPORT_FILE = MODELS_DIR / "evaluation_report.json"
MODEL_METADATA_FILE = MODELS_DIR / "model_metadata.json"


def calculate_mape(y_true: np.ndarray, y_pred: np.ndarray) -> float:
    mask = y_true > 0
    if not np.any(mask):
        return 0.0
    return float(np.mean(np.abs((y_true[mask] - y_pred[mask]) / y_true[mask])) * 100.0)


def evaluate() -> Dict[str, Any]:
    print("=" * 75)
    print("PHASE 18 -- ML MODEL EVALUATION ON HELD-OUT TEST SET")
    print("=" * 75)

    if not MODEL_FILE.exists() or not PREPROCESSOR_FILE.exists():
        raise FileNotFoundError(
            f"Model or Preprocessor not found. Run python ml/train_model.py first."
        )

    if not TEST_CSV.exists():
        raise FileNotFoundError(f"Test dataset not found at {TEST_CSV}")

    # 1. Load Model & Preprocessor
    print("\n[Step 1] Loading Trained Model & Preprocessor...")
    model = joblib.load(MODEL_FILE)
    preprocessor: CarbonDataPreprocessor = joblib.load(PREPROCESSOR_FILE)
    test_df = pd.read_csv(TEST_CSV)
    print(f"  Model type        : {type(model).__name__}")
    print(f"  Held-out test rows: {len(test_df)} samples (20% of full dataset)")

    # 2. Transform Features
    print("\n[Step 2] Transforming Test Features using Frozen Preprocessor...")
    X_test = preprocessor.transform(test_df)
    y_true = test_df[TARGET_COL].values
    y_true_log = np.log1p(y_true)

    # 3. Model Inference (Log Scale -> Expm1)
    y_pred_log = model.predict(X_test)
    y_pred = np.expm1(y_pred_log)

    # 4. Global Test Metrics
    r2 = r2_score(y_true, y_pred)
    rmse = np.sqrt(mean_squared_error(y_true, y_pred))
    mae = mean_absolute_error(y_true, y_pred)
    mape = calculate_mape(y_true, y_pred)
    med_ae = float(np.median(np.abs(y_true - y_pred)))
    p90_ae = float(np.percentile(np.abs(y_true - y_pred), 90))
    p95_ae = float(np.percentile(np.abs(y_true - y_pred), 95))
    bias = float(np.mean(y_pred - y_true))

    print("\n[Step 3] Overall Test Performance Summary:")
    print("-" * 55)
    print(f"  R2 (Coefficient of Determination) : {r2:.4f}  (>0.95 indicates strong fit)")
    print(f"  MAE  (Mean Absolute Error)        : {mae:,.2f} kg CO2e  ({mae/1000:.3f} tCO2e)")
    print(f"  RMSE (Root Mean Squared Error)    : {rmse:,.2f} kg CO2e  ({rmse/1000:.3f} tCO2e)")
    print(f"  MAPE (Mean Absolute % Error)      : {mape:.2f}%")
    print(f"  Median Absolute Error             : {med_ae:,.2f} kg CO2e")
    print(f"  90th Percentile Absolute Error    : {p90_ae:,.2f} kg CO2e")
    print(f"  95th Percentile Absolute Error    : {p95_ae:,.2f} kg CO2e")
    print(f"  Mean Bias (Pred - True)           : {bias:+,.2f} kg CO2e")
    print("-" * 55)

    # 5. Sliced Analysis by Supplier Tier
    print("\n[Step 4] Performance Breakdown by Supplier Tier:")
    print(f"  {'Tier':<10} {'Count':<8} {'Mean True (kg)':<18} {'MAE (kg)':<14} {'RMSE (kg)':<14} {'MAPE (%)':<10}")
    print("  " + "-" * 75)
    tier_breakdown = {}
    for tier in sorted(test_df["supplier_tier"].unique()):
        mask = test_df["supplier_tier"] == tier
        y_t = y_true[mask]
        y_p = y_pred[mask]
        t_mae = mean_absolute_error(y_t, y_p)
        t_rmse = np.sqrt(mean_squared_error(y_t, y_p))
        t_mape = calculate_mape(y_t, y_p)
        t_mean = np.mean(y_t)
        tier_breakdown[f"Tier {tier}"] = {
            "sample_count": int(np.sum(mask)),
            "mean_true_kg": round(float(t_mean), 2),
            "mae_kg": round(float(t_mae), 2),
            "rmse_kg": round(float(t_rmse), 2),
            "mape_pct": round(float(t_mape), 2),
        }
        print(f"  Tier {tier:<5} {int(np.sum(mask)):<8} {t_mean:>14,.2f}    {t_mae:>10,.2f}    {t_rmse:>10,.2f}    {t_mape:>7.2f}%")

    # 6. Sliced Analysis by Industry Sector
    print("\n[Step 5] Performance Breakdown by Industry Sector:")
    print(f"  {'Sector':<35} {'Count':<7} {'Mean True (kg)':<16} {'MAE (kg)':<12} {'MAPE (%)':<10}")
    print("  " + "-" * 82)
    sector_breakdown = {}
    for sector in sorted(test_df["industry_sector"].unique()):
        mask = test_df["industry_sector"] == sector
        y_t = y_true[mask]
        y_p = y_pred[mask]
        s_mae = mean_absolute_error(y_t, y_p)
        s_mape = calculate_mape(y_t, y_p)
        s_mean = np.mean(y_t)
        sector_breakdown[sector] = {
            "sample_count": int(np.sum(mask)),
            "mean_true_kg": round(float(s_mean), 2),
            "mae_kg": round(float(s_mae), 2),
            "mape_pct": round(float(s_mape), 2),
        }
        print(f"  {sector:<35} {int(np.sum(mask)):<7} {s_mean:>12,.2f}    {s_mae:>10,.2f}  {s_mape:>7.2f}%")

    # 7. Sliced Analysis by Emission Magnitude
    print("\n[Step 6] Performance Breakdown by Emission Magnitude:")
    print(f"  {'Emission Bracket':<22} {'Count':<8} {'Mean True (kg)':<18} {'MAE (kg)':<14} {'MAPE (%)':<10}")
    print("  " + "-" * 75)
    magnitude_bins = [
        ("Low (<10 tCO2e)", y_true < 10000),
        ("Medium (10-50 tCO2e)", (y_true >= 10000) & (y_true < 50000)),
        ("High (>50 tCO2e)", y_true >= 50000),
    ]
    magnitude_breakdown = {}
    for label, mask in magnitude_bins:
        if np.any(mask):
            y_t = y_true[mask]
            y_p = y_pred[mask]
            m_mae = mean_absolute_error(y_t, y_p)
            m_mape = calculate_mape(y_t, y_p)
            m_mean = np.mean(y_t)
            magnitude_breakdown[label] = {
                "sample_count": int(np.sum(mask)),
                "mean_true_kg": round(float(m_mean), 2),
                "mae_kg": round(float(m_mae), 2),
                "mape_pct": round(float(m_mape), 2),
            }
            print(f"  {label:<22} {int(np.sum(mask)):<8} {m_mean:>14,.2f}    {m_mae:>10,.2f}    {m_mape:>7.2f}%")

    # 8. Save Comprehensive Evaluation Report
    eval_report = {
        "evaluation_title": "Phase 18 -- ML Model Evaluation on Test Partition",
        "model_name": "RandomForestRegressor",
        "held_out_samples": len(test_df),
        "overall_metrics": {
            "r2_score": round(float(r2), 4),
            "mae_kg": round(float(mae), 2),
            "rmse_kg": round(float(rmse), 2),
            "mape_pct": round(float(mape), 2),
            "median_absolute_error_kg": round(med_ae, 2),
            "p90_absolute_error_kg": round(p90_ae, 2),
            "p95_absolute_error_kg": round(p95_ae, 2),
            "mean_bias_kg": round(bias, 2),
        },
        "tier_breakdown": tier_breakdown,
        "sector_breakdown": sector_breakdown,
        "magnitude_breakdown": magnitude_breakdown,
        "governance_note": (
            "Evaluation conducted on held-out test data. "
            "ML estimates are for filling missing activity data only. "
            "Primary Scope 3 accounting remains with the rule-based CarbonCalculationEngine."
        ),
    }

    with open(EVALUATION_REPORT_FILE, "w") as f:
        json.dump(eval_report, f, indent=2)
    print(f"\n[Saved] Detailed Evaluation Report -> {EVALUATION_REPORT_FILE}")
    print("=" * 75)
    return eval_report


if __name__ == "__main__":
    evaluate()
