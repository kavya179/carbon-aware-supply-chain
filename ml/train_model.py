"""
ml/train_model.py
=================
Phase 18 — Train and Evaluate the ML Model

Trains a regression model (RandomForestRegressor) to estimate Scope 3 GHG emissions
(co2e_kg) for suppliers/activities with missing or incomplete data.

KEY PRINCIPLES & GOVERNANCE:
  1. Rule-based CarbonCalculationEngine is the PRIMARY calculation system.
  2. ML predictions are strictly supplementary ESTIMATES for filling data gaps.
  3. Preprocessor and model are trained ONLY on the training split (no data leakage).
  4. Predictions are evaluated on the held-out test split using MAE, RMSE, and R².
  5. All output models and metadata are serialized via joblib and JSON.
"""

import json
import sys
import time
import warnings
from pathlib import Path
from typing import Dict, Any, Tuple

# Ensure both project root and ml directory are in python path
ROOT_DIR = Path(__file__).resolve().parent.parent
ML_DIR = Path(__file__).resolve().parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))
if str(ML_DIR) not in sys.path:
    sys.path.insert(0, str(ML_DIR))

import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import GradientBoostingRegressor, RandomForestRegressor
from sklearn.linear_model import Ridge
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from sklearn.model_selection import KFold, cross_val_score, train_test_split

try:
    from ml.preprocessing import (
        CarbonDataPreprocessor,
        CATEGORICAL_COLS,
        DATASET_DIR,
        ENGINEERED_FEATURE_COLS,
        MODELS_DIR,
        NUMERICAL_COLS,
        RANDOM_SEED,
        TARGET_COL,
        TEST_SIZE,
    )
except ImportError:
    from preprocessing import (
        CarbonDataPreprocessor,
        CATEGORICAL_COLS,
        DATASET_DIR,
        ENGINEERED_FEATURE_COLS,
        MODELS_DIR,
        NUMERICAL_COLS,
        RANDOM_SEED,
        TARGET_COL,
        TEST_SIZE,
    )

warnings.filterwarnings("ignore")

TRAIN_CSV = DATASET_DIR / "train.csv"
TEST_CSV = DATASET_DIR / "test.csv"
FULL_DATASET_CSV = DATASET_DIR / "scope3_dataset.csv"

MODEL_FILE = MODELS_DIR / "co2e_estimator.joblib"
RF_MODEL_FILE = MODELS_DIR / "random_forest_model.joblib"
PREPROCESSOR_FILE = MODELS_DIR / "preprocessor.joblib"
FEATURE_IMPORTANCE_FILE = MODELS_DIR / "feature_importance.json"
MODEL_METADATA_FILE = MODELS_DIR / "model_metadata.json"


def calculate_mape(y_true: np.ndarray, y_pred: np.ndarray) -> float:
    """Calculate Mean Absolute Percentage Error (%) avoiding zero division."""
    mask = y_true > 0
    if not np.any(mask):
        return 0.0
    return float(np.mean(np.abs((y_true[mask] - y_pred[mask]) / y_true[mask])) * 100.0)


def train_and_evaluate() -> Dict[str, Any]:
    print("=" * 70)
    print("PHASE 18 -- TRAIN AND EVALUATE THE ML MODEL")
    print("Carbon Scope 3 Activity & Emission Estimator")
    print("=" * 70)

    # 1. Load Dataset
    print("\n[Step 1] Loading Dataset...")
    if FULL_DATASET_CSV.exists():
        df_full = pd.read_csv(FULL_DATASET_CSV)
        print(f"Loaded full dataset: {len(df_full)} rows from {FULL_DATASET_CSV.name}")
    else:
        raise FileNotFoundError(f"Dataset not found at {FULL_DATASET_CSV}")

    # 2. Train-Test Split (Strict partition to prevent data leakage)
    print(f"\n[Step 2 & 5] Performing Train/Test Split (test_size={TEST_SIZE}, seed={RANDOM_SEED})...")
    train_df, test_df = train_test_split(
        df_full,
        test_size=TEST_SIZE,
        random_state=RANDOM_SEED,
        shuffle=True,
    )
    print(f"  Training samples : {len(train_df)} ({ (1-TEST_SIZE)*100:.0f}%)")
    print(f"  Testing samples  : {len(test_df)} ({ TEST_SIZE*100:.0f}%)")

    # 3 & 4. Preprocess Features & Encode Categoricals
    print("\n[Step 3 & 4] Preprocessing & Feature Engineering...")
    preprocessor = CarbonDataPreprocessor()
    preprocessor.fit(train_df)

    X_train = preprocessor.transform(train_df)
    y_train = train_df[TARGET_COL].values
    y_train_log = np.log1p(y_train)

    X_test = preprocessor.transform(test_df)
    y_test = test_df[TARGET_COL].values
    y_test_log = np.log1p(y_test)

    print(f"  Feature Matrix Dimensions: X_train {X_train.shape}, X_test {X_test.shape}")
    print(f"  Features ({len(preprocessor.feature_names)}): {preprocessor.feature_names}")

    # 6. Train Model — RandomForestRegressor (Primary)
    print("\n[Step 6] Training Regression Models...")
    models = {
        "RandomForestRegressor": RandomForestRegressor(
            n_estimators=150,
            max_depth=16,
            min_samples_split=4,
            min_samples_leaf=2,
            random_state=RANDOM_SEED,
            n_jobs=-1,
        ),
        "GradientBoostingRegressor": GradientBoostingRegressor(
            n_estimators=120,
            learning_rate=0.08,
            max_depth=5,
            random_state=RANDOM_SEED,
        ),
        "Ridge": Ridge(alpha=1.0),
    }

    results = {}
    start_train_time = time.time()

    for name, model in models.items():
        print(f"  Training {name}...")
        t0 = time.time()
        model.fit(X_train, y_train_log)
        train_duration = time.time() - t0

        # Cross-validation on training partition (5-fold CV)
        kf = KFold(n_splits=5, shuffle=True, random_state=RANDOM_SEED)
        cv_r2_scores = cross_val_score(model, X_train, y_train_log, cv=kf, scoring="r2")
        cv_mae_scores = -cross_val_score(model, X_train, y_train_log, cv=kf, scoring="neg_mean_absolute_error")

        # 7. Predict on Test Set
        y_pred_log = model.predict(X_test)
        y_pred_kg = np.expm1(y_pred_log)

        # 8. Evaluate Model
        # Log-scale metrics
        r2_log = r2_score(y_test_log, y_pred_log)
        rmse_log = np.sqrt(mean_squared_error(y_test_log, y_pred_log))
        mae_log = mean_absolute_error(y_test_log, y_pred_log)

        # Original kg scale metrics
        r2_kg = r2_score(y_test, y_pred_kg)
        rmse_kg = np.sqrt(mean_squared_error(y_test, y_pred_kg))
        mae_kg = mean_absolute_error(y_test, y_pred_kg)
        mape_kg = calculate_mape(y_test, y_pred_kg)

        results[name] = {
            "model_instance": model,
            "train_duration_sec": round(train_duration, 4),
            "cv_5fold_r2_mean": round(float(np.mean(cv_r2_scores)), 4),
            "cv_5fold_r2_std": round(float(np.std(cv_r2_scores)), 4),
            "cv_5fold_mae_mean": round(float(np.mean(cv_mae_scores)), 4),
            "test_metrics_kg": {
                "r2_score": round(float(r2_kg), 4),
                "rmse_kg": round(float(rmse_kg), 2),
                "mae_kg": round(float(mae_kg), 2),
                "mape_pct": round(float(mape_kg), 2),
            },
            "test_metrics_log": {
                "r2_score": round(float(r2_log), 4),
                "rmse": round(float(rmse_log), 4),
                "mae": round(float(mae_log), 4),
            },
        }

    total_training_time = time.time() - start_train_time

    # Display Model Comparison Table
    print("\n" + "=" * 85)
    print(f"{'Model':<28} {'CV R2 (5-Fold)':<16} {'Test R2':<12} {'Test MAE (kg)':<16} {'Test MAPE (%)':<12}")
    print("-" * 85)
    for name, res in results.items():
        cv_str = f"{res['cv_5fold_r2_mean']:.4f} +/- {res['cv_5fold_r2_std']:.3f}"
        test_r2 = f"{res['test_metrics_kg']['r2_score']:.4f}"
        test_mae = f"{res['test_metrics_kg']['mae_kg']:,.2f}"
        test_mape = f"{res['test_metrics_kg']['mape_pct']:.2f}%"
        print(f"{name:<28} {cv_str:<16} {test_r2:<12} {test_mae:<16} {test_mape:<12}")
    print("=" * 85)

    # 9. Extract Feature Importance for Random Forest
    rf_model: RandomForestRegressor = results["RandomForestRegressor"]["model_instance"]
    importances = rf_model.feature_importances_
    feat_imp_list = sorted(
        [
            {"feature": feat, "importance": round(float(imp), 4), "percentage": round(float(imp * 100), 2)}
            for feat, imp in zip(preprocessor.feature_names, importances)
        ],
        key=lambda x: x["importance"],
        reverse=True,
    )

    print("\n[Feature Importances -- Top 10 Factors]:")
    for idx, item in enumerate(feat_imp_list[:10], start=1):
        bar = "#" * int(item["percentage"] // 2)
        print(f"  {idx:2d}. {item['feature']:<30} {item['percentage']:>5.1f}%  {bar}")

    # 10. Save Model and Artifacts via Joblib & JSON
    print("\n[Step 9] Serializing Model and Preprocessor with Joblib...")
    joblib.dump(rf_model, MODEL_FILE)
    joblib.dump(rf_model, RF_MODEL_FILE)
    joblib.dump(preprocessor, PREPROCESSOR_FILE)
    print(f"  [Saved] Primary Estimator -> {MODEL_FILE}")
    print(f"  [Saved] Preprocessor      -> {PREPROCESSOR_FILE}")

    # Save feature importances
    with open(FEATURE_IMPORTANCE_FILE, "w") as f:
        json.dump(feat_imp_list, f, indent=2)
    print(f"  [Saved] Feature Importance -> {FEATURE_IMPORTANCE_FILE}")

    # Save complete model metadata & governance documentation
    metadata = {
        "model_name": "RandomForestRegressor",
        "purpose": "Estimation of missing Scope 3 supplier and activity carbon emissions",
        "target_variable": TARGET_COL,
        "target_transformation": "log1p(co2e_kg) during training, expm1(y_pred) at inference",
        "target_units": "kg CO2e",
        "features": preprocessor.feature_names,
        "categorical_features": CATEGORICAL_COLS,
        "numerical_features": NUMERICAL_COLS,
        "engineered_features": ENGINEERED_FEATURE_COLS,
        "dataset_summary": {
            "total_samples": len(df_full),
            "train_samples": len(train_df),
            "test_samples": len(test_df),
            "train_test_split": f"{(1-TEST_SIZE)*100:.0f}/{TEST_SIZE*100:.0f}",
            "random_seed": RANDOM_SEED,
            "data_provenance": "SYNTHETIC training dataset generated using DEFRA 2023, EPA eGrid 2023, and IPCC AR6 reference emission factors.",
        },
        "evaluation_metrics": {
            "test_r2_score": results["RandomForestRegressor"]["test_metrics_kg"]["r2_score"],
            "test_mae_kg": results["RandomForestRegressor"]["test_metrics_kg"]["mae_kg"],
            "test_rmse_kg": results["RandomForestRegressor"]["test_metrics_kg"]["rmse_kg"],
            "test_mape_pct": results["RandomForestRegressor"]["test_metrics_kg"]["mape_pct"],
            "cv_5fold_r2_mean": results["RandomForestRegressor"]["cv_5fold_r2_mean"],
            "cv_5fold_r2_std": results["RandomForestRegressor"]["cv_5fold_r2_std"],
            "cv_5fold_mae_mean": results["RandomForestRegressor"]["cv_5fold_mae_mean"],
        },
        "benchmark_comparison": {
            model_k: {
                "test_r2": v["test_metrics_kg"]["r2_score"],
                "test_mae_kg": v["test_metrics_kg"]["mae_kg"],
                "test_rmse_kg": v["test_metrics_kg"]["rmse_kg"],
                "test_mape_pct": v["test_metrics_kg"]["mape_pct"],
                "cv_5fold_r2": v["cv_5fold_r2_mean"],
            }
            for model_k, v in results.items()
        },
        "hyperparameters": {
            "n_estimators": 150,
            "max_depth": 16,
            "min_samples_split": 4,
            "min_samples_leaf": 2,
            "random_state": RANDOM_SEED,
            "n_jobs": -1,
        },
        "governance_and_limitations": {
            "primary_engine_rule": "The rule-based CarbonCalculationEngine is the PRIMARY and authoritative calculation system.",
            "ml_role": "ML predictions are supplementary estimates used ONLY when activity data is missing or incomplete.",
            "data_labeling": "All predictions from this model MUST be explicitly tagged with source='ML_ESTIMATED'.",
            "synthetic_data_disclosure": "Trained on synthetic activity datasets calibrated to IPCC/DEFRA/EPA emission factors. Not direct empirical supplier measurements.",
            "accuracy_boundary": "High accuracy applies within standard industrial activity ranges. Extreme outlier facilities should be audited with primary supplier bills.",
        },
        "trained_at": time.strftime("%Y-%m-%d %H:%M:%S UTC", time.gmtime()),
    }

    with open(MODEL_METADATA_FILE, "w") as f:
        json.dump(metadata, f, indent=2)
    print(f"  [Saved] Model Metadata    -> {MODEL_METADATA_FILE}")

    print("\n" + "=" * 70)
    print("PHASE 18 MODEL TRAINING COMPLETED SUCCESSFULLY")
    print(f"Model: RandomForestRegressor | Test R2: {results['RandomForestRegressor']['test_metrics_kg']['r2_score']:.4f} | Test MAE: {results['RandomForestRegressor']['test_metrics_kg']['mae_kg']:,.2f} kg CO2e")
    print("=" * 70)

    return metadata


if __name__ == "__main__":
    train_and_evaluate()
