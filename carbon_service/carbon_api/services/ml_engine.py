"""
ML Engine Service
=================
Handles ML-powered features using Scikit-learn:
  1. Emission Forecasting (time-series regression)
  2. Supplier ESG Scoring (multi-feature scoring model)
  3. Anomaly Detection (Isolation Forest)

For the initial scaffold, the engine uses synthetic/demo data.
In production, it reads historical emission records from the backend
via API calls, trains models, and persists them with joblib.
"""
import numpy as np
import pandas as pd
from datetime import datetime, timedelta
from typing import Optional
import logging

logger = logging.getLogger(__name__)


class MLEngine:
    """
    Machine Learning engine for carbon intelligence features.

    Scikit-learn models used:
    - LinearRegression / Ridge: emission trend forecasting
    - RandomForestRegressor: supplier ESG scoring
    - IsolationForest: anomaly detection
    """

    def forecast(
        self,
        supplier_id: Optional[str] = None,
        periods: int = 12,
        frequency: str = 'monthly',
    ) -> dict:
        """
        Forecast future emissions using a trained regression model.

        Args:
            supplier_id: If provided, forecast for that specific supplier
            periods: Number of future periods to forecast
            frequency: 'monthly' or 'quarterly'

        Returns:
            dict with forecast data points and model metadata
        """
        try:
            from sklearn.linear_model import Ridge
            from sklearn.preprocessing import PolynomialFeatures
            from sklearn.pipeline import make_pipeline

            # --- Generate synthetic historical data (12 months) ---
            np.random.seed(42)
            n_historical = 24
            historical_emissions = (
                np.linspace(1000, 800, n_historical)
                + np.random.normal(0, 50, n_historical)
            ).tolist()

            X_train = np.arange(n_historical).reshape(-1, 1)
            y_train = np.array(historical_emissions)

            model = make_pipeline(PolynomialFeatures(degree=2), Ridge(alpha=1.0))
            model.fit(X_train, y_train)

            X_forecast = np.arange(n_historical, n_historical + periods).reshape(-1, 1)
            y_pred = model.predict(X_forecast)

            # Build time labels
            base_date = datetime.utcnow()
            labels = []
            for i in range(periods):
                if frequency == 'monthly':
                    month_offset = base_date.month + i
                    year_offset = base_date.year + (month_offset - 1) // 12
                    month = (month_offset - 1) % 12 + 1
                    labels.append(f"{year_offset}-{month:02d}")
                else:
                    labels.append(f"Q{(i % 4) + 1} {base_date.year + i // 4}")

            return {
                "forecast": [
                    {"period": label, "value": max(0, round(float(v), 2)), "unit": "tCO2e"}
                    for label, v in zip(labels, y_pred)
                ],
                "historical": [
                    {
                        "period": f"H-{n_historical - i}",
                        "value": round(float(v), 2),
                        "unit": "tCO2e",
                    }
                    for i, v in enumerate(historical_emissions)
                ],
                "model": {
                    "type": "Polynomial Ridge Regression",
                    "degree": 2,
                    "r2_score": round(float(model.score(X_train, y_train)), 4),
                },
                "supplierId": supplier_id,
                "frequency": frequency,
            }

        except Exception as e:
            logger.error(f"Forecast error: {e}")
            return {"error": str(e)}

    def score_supplier(self, supplier_data: dict) -> dict:
        """
        Score a supplier's carbon/ESG performance (0–100 scale).
        Higher score = better performance.

        Features used:
        - totalEmissions (normalized by tier benchmark)
        - reductionRate (YoY %)
        - dataQuality (categorical)
        - certifications count
        """
        try:
            from sklearn.preprocessing import MinMaxScaler

            # Scoring weights
            WEIGHTS = {
                'emission_efficiency': 0.40,
                'reduction_trend': 0.30,
                'data_quality': 0.15,
                'certifications': 0.15,
            }

            # Tier emission benchmarks (tCO2e)
            TIER_BENCHMARKS = {1: 500, 2: 1000, 3: 2000}
            DATA_QUALITY_SCORES = {
                'Measured': 1.0,
                'Calculated': 0.75,
                'Supplier Reported': 0.5,
                'Estimated': 0.25,
            }

            tier = supplier_data.get('tier', 1)
            benchmark = TIER_BENCHMARKS.get(tier, 1000)
            total_emissions = supplier_data.get('totalEmissions', benchmark)

            # Emission efficiency score (inverse — lower emissions = higher score)
            emission_ratio = min(total_emissions / benchmark, 2.0)
            emission_score = max(0, 1 - emission_ratio) * 100

            # Reduction trend score
            reduction_rate = supplier_data.get('reductionRate', 0.0)
            reduction_score = min(max(reduction_rate, 0), 20) * 5  # 0-20% maps to 0-100

            # Data quality score
            data_quality = supplier_data.get('dataQuality', 'Estimated')
            quality_score = DATA_QUALITY_SCORES.get(data_quality, 0.25) * 100

            # Certifications score
            certifications = supplier_data.get('certifications', [])
            cert_score = min(len(certifications) * 25, 100)

            # Weighted total
            final_score = (
                emission_score * WEIGHTS['emission_efficiency']
                + reduction_score * WEIGHTS['reduction_trend']
                + quality_score * WEIGHTS['data_quality']
                + cert_score * WEIGHTS['certifications']
            )

            grade = (
                'A' if final_score >= 80
                else 'B' if final_score >= 60
                else 'C' if final_score >= 40
                else 'D'
            )

            return {
                "supplierId": supplier_data.get('supplierId'),
                "score": round(final_score, 1),
                "grade": grade,
                "breakdown": {
                    "emissionEfficiency": round(emission_score, 1),
                    "reductionTrend": round(reduction_score, 1),
                    "dataQuality": round(quality_score, 1),
                    "certifications": round(cert_score, 1),
                },
                "benchmark": {
                    "tierBenchmark": benchmark,
                    "supplierEmissions": total_emissions,
                },
                "model": {"type": "Weighted Multi-Feature Scoring"},
            }

        except Exception as e:
            logger.error(f"Scoring error: {e}")
            return {"error": str(e)}

    def detect_anomalies(self, emission_series: list) -> dict:
        """
        Detect anomalous emission records using Isolation Forest.

        Args:
            emission_series: List of emission values (floats)

        Returns:
            dict with anomaly flags and scores
        """
        try:
            from sklearn.ensemble import IsolationForest

            if len(emission_series) < 5:
                return {"error": "Insufficient data for anomaly detection (need >= 5 records)"}

            X = np.array(emission_series).reshape(-1, 1)
            clf = IsolationForest(contamination=0.1, random_state=42)
            predictions = clf.fit_predict(X)
            scores = clf.score_samples(X)

            results = [
                {
                    "index": i,
                    "value": float(emission_series[i]),
                    "isAnomaly": bool(predictions[i] == -1),
                    "anomalyScore": round(float(scores[i]), 4),
                }
                for i in range(len(emission_series))
            ]

            anomaly_count = sum(1 for r in results if r["isAnomaly"])

            return {
                "results": results,
                "summary": {
                    "total": len(emission_series),
                    "anomalies": anomaly_count,
                    "anomalyRate": round(anomaly_count / len(emission_series), 3),
                },
                "model": {"type": "Isolation Forest", "contamination": 0.1},
            }

        except Exception as e:
            logger.error(f"Anomaly detection error: {e}")
            return {"error": str(e)}
