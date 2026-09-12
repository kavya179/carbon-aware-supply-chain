"""
ml/preprocessing.py
===================
Reusable Data Preprocessing and Feature Engineering Pipeline for Scope 3 ML Estimation.

IMPORTANT ARCHITECTURAL CONSTRAINTS:
  - Rule-based CarbonCalculationEngine is the PRIMARY calculation system.
  - ML is strictly a supplementary capability for estimating missing supplier/activity data.
  - All synthetic data is clearly labelled.
  - Preprocessor is reusable for single-record inference and batch training.
"""

import json
import warnings
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple, Union

import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split

warnings.filterwarnings("ignore")

# Directory paths
ML_DIR = Path(__file__).resolve().parent
DATASET_DIR = ML_DIR / "dataset"
MODELS_DIR = ML_DIR / "models"
MODELS_DIR.mkdir(parents=True, exist_ok=True)
DATASET_DIR.mkdir(parents=True, exist_ok=True)

INPUT_CSV = DATASET_DIR / "scope3_dataset.csv"
OUTPUT_TRAIN = DATASET_DIR / "train.csv"
OUTPUT_TEST = DATASET_DIR / "test.csv"
OUTPUT_REPORT = DATASET_DIR / "preprocessing_report.json"
PREPROCESSOR_FILE = MODELS_DIR / "preprocessor.joblib"

RANDOM_SEED = 42
TEST_SIZE = 0.20
TARGET_COL = "co2e_kg"

# Columns dropped to avoid target leakage or metadata noise
DROP_COLS = [
    "record_id",
    "source_type",
    "country_iso3",
    "energy_co2e_kg",
    "fuel_co2e_kg",
    "material_co2e_kg",
    "transport_co2e_kg",
    "co2e_kg",
]

CATEGORICAL_COLS = [
    "industry_sector",
    "country",
    "transport_mode",
    "material_type",
]

NUMERICAL_COLS = [
    "supplier_tier",
    "grid_emission_factor",
    "renewable_energy_pct",
    "energy_kwh_monthly",
    "fuel_litres_monthly",
    "production_qty_units",
    "distance_km",
    "shipment_weight_t",
    "material_qty_kg",
    "material_ef_kgco2e_kg",
    "transport_ef_kgco2e_tonne_km",
]

ENGINEERED_FEATURE_COLS = [
    "energy_emission_intensity",
    "adj_grid_factor",
    "transport_proxy",
    "material_proxy",
]

# Standard reference fallback values
DEFAULT_FALLBACKS = {
    "supplier_tier": 2,
    "grid_emission_factor": 0.400,
    "renewable_energy_pct": 20.0,
    "energy_kwh_monthly": 2500.0,
    "fuel_litres_monthly": 0.0,
    "production_qty_units": 1000.0,
    "distance_km": 500.0,
    "shipment_weight_t": 2.0,
    "material_qty_kg": 2000.0,
    "material_ef_kgco2e_kg": 2.50,
    "transport_ef_kgco2e_tonne_km": 0.080,
    "industry_sector": "Automotive & Transport Equipment",
    "country": "Germany",
    "transport_mode": "road_diesel",
    "material_type": "steel",
}

VALID_RANGES = {
    "supplier_tier": (1, 3),
    "grid_emission_factor": (0.001, 2.0),
    "renewable_energy_pct": (0.0, 100.0),
    "energy_kwh_monthly": (0.0, 100000.0),
    "fuel_litres_monthly": (0.0, 50000.0),
    "production_qty_units": (0.0, 500000.0),
    "distance_km": (1.0, 25000.0),
    "shipment_weight_t": (0.0, 10000.0),
    "material_qty_kg": (0.0, 1_000_000.0),
    "material_ef_kgco2e_kg": (0.001, 200.0),
    "transport_ef_kgco2e_tonne_km": (0.001, 5.0),
    TARGET_COL: (0.0, 10_000_000.0),
}


class CarbonDataPreprocessor:
    """
    Reusable data preprocessor and encoder for Carbon Scope 3 ML models.
    Supports fit on training data and transform on new / test data.
    """

    def __init__(self):
        self.is_fitted = False
        self.cat_mappings: Dict[str, Dict[str, int]] = {}
        self.cat_inverse: Dict[str, Dict[int, str]] = {}
        self.sector_renewable_medians: Dict[str, float] = {}
        self.transport_distance_medians: Dict[str, float] = {}
        self.global_medians: Dict[str, float] = {}
        self.feature_names: List[str] = []

    def fit(self, df: pd.DataFrame) -> "CarbonDataPreprocessor":
        """Learn encoding mappings and imputation statistics from training dataset."""
        df_clean = df.copy()

        # Learn global numerical medians
        for col in NUMERICAL_COLS:
            if col in df_clean.columns:
                valid_s = pd.to_numeric(df_clean[col], errors="coerce").dropna()
                self.global_medians[col] = float(valid_s.median()) if len(valid_s) > 0 else DEFAULT_FALLBACKS.get(col, 0.0)

        # Learn sector-specific renewable energy medians
        if "industry_sector" in df_clean.columns and "renewable_energy_pct" in df_clean.columns:
            s_ren = df_clean.groupby("industry_sector")["renewable_energy_pct"].median()
            self.sector_renewable_medians = {k: float(v) for k, v in s_ren.items()}

        # Learn transport mode distance medians
        if "transport_mode" in df_clean.columns and "distance_km" in df_clean.columns:
            s_dist = df_clean.groupby("transport_mode")["distance_km"].median()
            self.transport_distance_medians = {k: float(v) for k, v in s_dist.items()}

        # Learn categorical encodings
        for col in CATEGORICAL_COLS:
            if col in df_clean.columns:
                unique_vals = sorted(df_clean[col].dropna().astype(str).unique().tolist())
                # Index 0 reserved for 'unknown' / fallback
                mapping = {"<UNKNOWN>": 0}
                for idx, val in enumerate(unique_vals, start=1):
                    mapping[val] = idx
                self.cat_mappings[col] = mapping
                self.cat_inverse[col] = {v: k for k, v in mapping.items()}

        # Define canonical feature names
        self.feature_names = (
            NUMERICAL_COLS
            + ENGINEERED_FEATURE_COLS
            + [f"{col}_enc" for col in CATEGORICAL_COLS]
        )

        self.is_fitted = True
        return self

    def _impute_and_clean_record(self, record: Dict[str, Any]) -> Dict[str, Any]:
        """Clean and impute a single dictionary record."""
        cleaned = {}

        # 1. Categoricals
        for col in CATEGORICAL_COLS:
            val = record.get(col)
            if val is None or pd.isna(val) or str(val).strip() == "":
                cleaned[col] = DEFAULT_FALLBACKS.get(col, "<UNKNOWN>")
            else:
                cleaned[col] = str(val).strip()

        # 2. Impute renewable_energy_pct
        ren = record.get("renewable_energy_pct")
        if ren is None or pd.isna(ren):
            sec = cleaned.get("industry_sector", "")
            ren = self.sector_renewable_medians.get(sec, self.global_medians.get("renewable_energy_pct", 20.0))
        cleaned["renewable_energy_pct"] = float(np.clip(float(ren), 0.0, 100.0))

        # 3. Impute distance_km
        dist = record.get("distance_km")
        if dist is None or pd.isna(dist):
            mode = cleaned.get("transport_mode", "")
            dist = self.transport_distance_medians.get(mode, self.global_medians.get("distance_km", 500.0))
        cleaned["distance_km"] = float(np.clip(float(dist), 1.0, 25000.0))

        # 4. Impute fuel_litres_monthly
        fuel = record.get("fuel_litres_monthly")
        if fuel is None or pd.isna(fuel):
            fuel = 0.0
        cleaned["fuel_litres_monthly"] = float(np.clip(float(fuel), 0.0, 50000.0))

        # 5. Other numericals
        for col in NUMERICAL_COLS:
            if col in ["renewable_energy_pct", "distance_km", "fuel_litres_monthly"]:
                continue
            val = record.get(col)
            if val is None or pd.isna(val):
                val = self.global_medians.get(col, DEFAULT_FALLBACKS.get(col, 0.0))
            try:
                val = float(val)
            except (ValueError, TypeError):
                val = self.global_medians.get(col, DEFAULT_FALLBACKS.get(col, 0.0))
            lo, hi = VALID_RANGES.get(col, (-np.inf, np.inf))
            cleaned[col] = float(np.clip(val, lo, hi))

        # 6. Engineered features
        energy_kwh = cleaned["energy_kwh_monthly"]
        grid_ef = cleaned["grid_emission_factor"]
        ren_pct = cleaned["renewable_energy_pct"]
        dist_km = cleaned["distance_km"]
        weight_t = cleaned["shipment_weight_t"]
        trans_ef = cleaned["transport_ef_kgco2e_tonne_km"]
        mat_qty = cleaned["material_qty_kg"]
        mat_ef = cleaned["material_ef_kgco2e_kg"]

        cleaned["energy_emission_intensity"] = energy_kwh * grid_ef
        cleaned["adj_grid_factor"] = grid_ef * (1.0 - ren_pct / 100.0)
        cleaned["transport_proxy"] = dist_km * weight_t * trans_ef
        cleaned["material_proxy"] = mat_qty * mat_ef

        # 7. Categorical encoding
        for col in CATEGORICAL_COLS:
            mapping = self.cat_mappings.get(col, {})
            val_str = cleaned[col]
            cleaned[f"{col}_enc"] = mapping.get(val_str, 0)

        return cleaned

    def transform(self, data: Union[pd.DataFrame, List[Dict[str, Any]], Dict[str, Any]]) -> pd.DataFrame:
        """
        Transform raw input into the canonical feature matrix X.
        Accepts DataFrame, list of dicts, or single dict.
        """
        if not self.is_fitted:
            raise RuntimeError("CarbonDataPreprocessor must be fitted before transform().")

        if isinstance(data, dict):
            records = [data]
        elif isinstance(data, list):
            records = data
        elif isinstance(data, pd.DataFrame):
            records = data.to_dict(orient="records")
        else:
            raise TypeError(f"Unsupported data type: {type(data)}")

        cleaned_records = [self._impute_and_clean_record(r) for r in records]
        df_out = pd.DataFrame(cleaned_records)

        # Return strictly ordered feature matrix
        return df_out[self.feature_names]

    def fit_transform(self, df: pd.DataFrame) -> pd.DataFrame:
        """Fit preprocessor and transform data in one call."""
        return self.fit(df).transform(df)

    def to_dict(self) -> Dict[str, Any]:
        """Serialize preprocessor state to dictionary."""
        return {
            "is_fitted": self.is_fitted,
            "cat_mappings": self.cat_mappings,
            "cat_inverse": self.cat_inverse,
            "sector_renewable_medians": self.sector_renewable_medians,
            "transport_distance_medians": self.transport_distance_medians,
            "global_medians": self.global_medians,
            "feature_names": self.feature_names,
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "CarbonDataPreprocessor":
        """Deserialize preprocessor state from dictionary."""
        prep = cls()
        prep.is_fitted = data.get("is_fitted", False)
        prep.cat_mappings = data.get("cat_mappings", {})
        prep.cat_inverse = data.get("cat_inverse", {})
        prep.sector_renewable_medians = data.get("sector_renewable_medians", {})
        prep.transport_distance_medians = data.get("transport_distance_medians", {})
        prep.global_medians = data.get("global_medians", {})
        prep.feature_names = data.get("feature_names", [])
        return prep


# ── Standalone Preprocessing Script Execution ─────────────────────────────────

def run_dataset_audit_and_prep():
    """Run full dataset audit, train_test_split, and save preprocessing artifacts."""
    print("=" * 60)
    print("Phase 17/18 Preprocessing Pipeline")
    print("=" * 60)

    if not INPUT_CSV.exists():
        raise FileNotFoundError(f"Input dataset not found at {INPUT_CSV}")

    df_raw = pd.read_csv(INPUT_CSV)
    print(f"Loaded {len(df_raw)} records from {INPUT_CSV.name}")

    # Step 1: Missing value analysis
    missing = df_raw.isnull().sum().to_dict()
    print("Missing value counts:", {k: v for k, v in missing.items() if v > 0})

    # Step 2: Deduplication
    check_cols = [c for c in df_raw.columns if c != "record_id"]
    n_dups = int(df_raw.duplicated(subset=check_cols).sum())
    print(f"Duplicates found: {n_dups}")

    # Step 3: Train / Test Split before fitting preprocessor (No data leakage)
    train_df, test_df = train_test_split(
        df_raw,
        test_size=TEST_SIZE,
        random_state=RANDOM_SEED,
        shuffle=True,
    )
    print(f"Train partition: {len(train_df)} rows | Test partition: {len(test_df)} rows")

    # Step 4: Fit preprocessor strictly on train_df
    preprocessor = CarbonDataPreprocessor()
    preprocessor.fit(train_df)

    # Save fitted preprocessor
    import joblib
    joblib.dump(preprocessor, PREPROCESSOR_FILE)
    print(f"Fitted preprocessor saved -> {PREPROCESSOR_FILE}")

    # Save train and test sets
    train_df.to_csv(OUTPUT_TRAIN, index=False)
    test_df.to_csv(OUTPUT_TEST, index=False)
    print(f"Saved train.csv ({len(train_df)} rows) and test.csv ({len(test_df)} rows)")

    # Save preprocessing summary report
    report = {
        "status": "ready",
        "dataset_rows": len(df_raw),
        "train_rows": len(train_df),
        "test_rows": len(test_df),
        "test_split_ratio": TEST_SIZE,
        "features": preprocessor.feature_names,
        "target": TARGET_COL,
        "missing_summary": {k: v for k, v in missing.items() if v > 0},
        "categorical_columns": CATEGORICAL_COLS,
        "numerical_columns": NUMERICAL_COLS,
    }
    with open(OUTPUT_REPORT, "w") as f:
        json.dump(report, f, indent=2)
    print(f"Preprocessing report saved -> {OUTPUT_REPORT}")
    print("=" * 60)
    return preprocessor, train_df, test_df


if __name__ == "__main__":
    run_dataset_audit_and_prep()
