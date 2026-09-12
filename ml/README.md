# Scope 3 Machine Learning Carbon Intelligence (`ml/`)

This directory contains the machine learning subsystem for **estimating missing or unavailable supplier and activity data** in Scope 3 greenhouse gas calculations.

---

## ⚠️ Key Architecture & Governance Principles

1. **Rule-Based Engine is Primary**: The `CarbonCalculationEngine` (GHG Protocol Scope 3 activity-based calculations) is the **primary and authoritative** calculation system.
2. **Supplementary Gap-Filling Only**: ML is used strictly as an enhancement for estimating emissions when supplier activity data is missing or inaccessible.
3. **Explicit Provenance Labeling**: All ML-derived values are tagged with `source='ML_ESTIMATED'` and `is_gap_fill=True`. They are never represented as audited empirical figures.
4. **Synthetic Training Data Disclosure**: The training dataset is synthetic, calibrated to IPCC AR6, DEFRA 2023, and EPA eGrid 2023 emission factors.

---

## Directory Structure

```
ml/
├── dataset/
│   ├── scope3_dataset.csv          # 2,000 synthetic records with provenance tags
│   ├── scope3_dataset_meta.json    # Dataset schema and emission factor references
│   ├── train.csv                   # 80% training partition (1,600 records)
│   ├── test.csv                    # 20% held-out test partition (400 records)
│   └── preprocessing_report.json   # Data quality audit and distribution stats
├── models/
│   ├── co2e_estimator.joblib       # Primary serialized RandomForestRegressor
│   ├── preprocessor.joblib         # Reusable CarbonDataPreprocessor instance
│   ├── feature_importance.json     # Feature importance ranking
│   ├── model_metadata.json         # Complete model configuration and training metrics
│   └── evaluation_report.json      # Sliced evaluation report on held-out test set
├── build_dataset.py                # Dataset generator using reference EFs
├── preprocessing.py                # Reusable preprocessor & feature engineering
├── train_model.py                  # Model training, 5-fold CV, and benchmarking
├── evaluate_model.py               # Comprehensive evaluation on test partition
├── predict.py                      # Production inference interface (single & batch)
└── README.md                       # Documentation
```

---

## Features & Target

### Target Variable
- **Target**: `co2e_kg` (Total Greenhouse Gas Emissions in kg CO₂e)
- **Transformation**: `log1p(co2e_kg)` during training, `expm1(y_pred)` at inference.

### 19 Input Features
| Feature Group | Features | Description |
| :--- | :--- | :--- |
| **Supplier Profile** | `supplier_tier`, `industry_sector_enc`, `country_enc` | Supplier hierarchy and sector |
| **Energy & Utilities** | `energy_kwh_monthly`, `grid_emission_factor`, `renewable_energy_pct`, `fuel_litres_monthly` | Electricity, grid carbon intensity, renewables share |
| **Logistics & Freight**| `transport_mode_enc`, `distance_km`, `shipment_weight_t`, `transport_ef_kgco2e_tonne_km` | Mode, shipping distance, payload |
| **Material Inputs**    | `material_type_enc`, `material_qty_kg`, `material_ef_kgco2e_kg` | Material family, mass, material carbon factor |
| **Production Scale**   | `production_qty_units` | Monthly units manufactured |
| **Engineered Proxies** | `energy_emission_intensity`, `adj_grid_factor`, `transport_proxy`, `material_proxy` | Interaction terms |

---

## Model Evaluation Results (Held-Out Test Set: 400 Samples)

| Metric | Random Forest (Primary) | Gradient Boosting | Ridge Baseline |
| :--- | :---: | :---: | :---: |
| **5-Fold CV $R^2$** | **$0.9823 \pm 0.004$** | $0.9880 \pm 0.004$ | $0.6557 \pm 0.019$ |
| **Test $R^2$** | **0.9906** | 0.9930 | -1.4384 |
| **Test MAE** | **1,907.96 kg CO₂e** | 1,640.68 kg CO₂e | 19,826.01 kg CO₂e |
| **Test RMSE** | **7,158.17 kg CO₂e** | 6,192.45 kg CO₂e | 83,040.12 kg CO₂e |
| **Test MAPE** | **7.25%** | 5.96% | 51.37% |

### Performance by Supplier Tier
- **Tier 1**: MAE = 1,894.06 kg CO₂e | MAPE = 6.79%
- **Tier 2**: MAE = 1,307.81 kg CO₂e | MAPE = 7.09%
- **Tier 3**: MAE = 2,681.45 kg CO₂e | MAPE = 7.96%

---

## Quick Usage

### 1. Command Line Estimation
```bash
python ml/predict.py --industry "Automotive Manufacturing" --tier 2 --energy_kwh 10000 --material_type "steel" --material_qty_kg 15000
```

### 2. Python API
```python
from ml.predict import estimate_co2e

estimate = estimate_co2e({
    "industry_sector": "Semiconductor Fabrication",
    "supplier_tier": 2,
    "country": "Taiwan",
    "energy_kwh_monthly": 15000,
    "renewable_energy_pct": 35.0,
    "material_type": "copper",
    "material_qty_kg": 5000,
})

print(estimate["co2e_kg_estimated"])      # kg CO2e
print(estimate["confidence_level"])       # 'HIGH'
print(estimate["source"])                 # 'ML_ESTIMATED'
```

---

## Limitations
1. **Synthetic Training Baseline**: Trained on synthetic activity distributions matching published sector averages. Real-world facilities with highly anomalous processes should be audited with primary utility bills.
2. **Non-Replacing**: Never replaces verified activity measurements when primary data is submitted by suppliers.
