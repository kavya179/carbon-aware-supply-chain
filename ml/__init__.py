"""
ml/ — Machine Learning Module for Scope 3 Carbon Emission Estimation
=====================================================================
This module supplements the rule-based CarbonCalculationEngine with
ML-based estimation for missing/unavailable supplier activity data.

ARCHITECTURE PRINCIPLE:
  Rule-based engine = PRIMARY and authoritative.
  ML models = Supplementary estimation for data gaps ONLY.

File structure:
  build_dataset.py    — Generate synthetic training dataset
  preprocessing.py    — Data quality audit + feature engineering
  train_model.py      — Model training (Phase 18)
  evaluate_model.py   — Model evaluation (Phase 18)
  predict.py          — Inference interface (Phase 18)
  dataset/            — Generated CSVs and metadata
  models/             — Serialized models and metadata

Completed phases:
  Phase 17: Dataset preparation and preprocessing ✓

Upcoming phases:
  Phase 18: Model training and evaluation
"""
