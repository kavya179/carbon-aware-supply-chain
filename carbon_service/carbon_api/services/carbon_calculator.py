"""
Carbon Calculator Service
=========================
Converts raw activity data into CO2-equivalent emissions
using the GHG Protocol methodology and IPCC / DEFRA emission factors.

Emission factors are stored in-memory for the initial scaffold.
In production, these would be loaded from a database or external API.
"""
import pandas as pd
from typing import Optional


# ─── Emission Factor Database (simplified) ────────────────────────────────────
# Format: { activity_type: { unit: { factor_kgCO2e_per_unit, source } } }
EMISSION_FACTORS = {
    "Energy Consumption": {
        "kWh": {"factor": 0.23314, "source": "DEFRA 2024 (UK Grid)"},
        "MWh": {"factor": 233.14, "source": "DEFRA 2024 (UK Grid)"},
        "GJ": {"factor": 64.76, "source": "DEFRA 2024"},
    },
    "Transportation (Road)": {
        "tonne-km": {"factor": 0.1072, "source": "DEFRA 2024 — HGV average"},
        "km": {"factor": 0.17, "source": "DEFRA 2024 — average car"},
    },
    "Transportation (Air)": {
        "tonne-km": {"factor": 0.602, "source": "DEFRA 2024 — short-haul freight"},
        "passenger-km": {"factor": 0.255, "source": "DEFRA 2024 — economy class"},
    },
    "Transportation (Sea)": {
        "tonne-km": {"factor": 0.01623, "source": "DEFRA 2024 — container ship"},
    },
    "Raw Material Production": {
        "tonne": {"factor": 1.85, "source": "Ecoinvent 3.10 — average manufacturing"},
        "kg": {"factor": 0.00185, "source": "Ecoinvent 3.10 — average manufacturing"},
    },
    "Manufacturing Process": {
        "tonne": {"factor": 2.4, "source": "IPCC AR6 industry average"},
        "unit": {"factor": 0.05, "source": "IPCC AR6 — generic unit"},
    },
    "Waste Generated": {
        "tonne": {"factor": 0.46, "source": "DEFRA 2024 — mixed waste landfill"},
        "kg": {"factor": 0.00046, "source": "DEFRA 2024"},
    },
    "Business Travel": {
        "passenger-km": {"factor": 0.255, "source": "DEFRA 2024 — air economy"},
        "km": {"factor": 0.17, "source": "DEFRA 2024 — average car"},
    },
}

# Conversion: kg CO2e → tCO2e
KG_TO_TONNE = 1 / 1000


class CarbonCalculator:
    """
    Converts raw activity data to tCO2e emissions.

    Usage:
        calculator = CarbonCalculator()
        result = calculator.calculate(
            activity_type="Energy Consumption",
            value=1000,
            unit="kWh",
        )
    """

    def __init__(self):
        self.factors = EMISSION_FACTORS

    def calculate(
        self,
        activity_type: str,
        value: float,
        unit: str,
        country: Optional[str] = "Global",
    ) -> dict:
        """
        Calculate CO2e emissions from activity data.

        Args:
            activity_type: Type of activity (must match EMISSION_FACTORS keys)
            value: Quantity of the activity
            unit: Unit of the quantity
            country: Country for localized factors (future enhancement)

        Returns:
            dict with emissionValue (tCO2e), factor info, and metadata
        """
        if activity_type not in self.factors:
            return {
                "emissionValue": None,
                "emissionUnit": "tCO2e",
                "error": f"Unknown activity type: '{activity_type}'",
                "availableTypes": list(self.factors.keys()),
            }

        unit_factors = self.factors[activity_type]
        if unit not in unit_factors:
            return {
                "emissionValue": None,
                "emissionUnit": "tCO2e",
                "error": f"Unknown unit '{unit}' for activity '{activity_type}'",
                "availableUnits": list(unit_factors.keys()),
            }

        factor_data = unit_factors[unit]
        emission_kg = value * factor_data["factor"]
        emission_tonne = round(emission_kg * KG_TO_TONNE, 6)

        return {
            "emissionValue": emission_tonne,
            "emissionUnit": "tCO2e",
            "emissionFactor": {
                "value": factor_data["factor"],
                "unit": f"kg CO2e / {unit}",
                "source": factor_data["source"],
            },
            "activityData": {
                "type": activity_type,
                "value": value,
                "unit": unit,
                "country": country,
            },
            "methodology": "GHG Protocol Scope 3 — Activity-based calculation",
            "confidence": 0.85,
        }

    def bulk_calculate(self, activities: list) -> pd.DataFrame:
        """
        Calculate emissions for a list of activity records.

        Args:
            activities: List of dicts with activityType, value, unit, country

        Returns:
            pandas DataFrame with original data + calculated emissions
        """
        df = pd.DataFrame(activities)
        results = []
        for _, row in df.iterrows():
            result = self.calculate(
                activity_type=row.get('activityType', ''),
                value=float(row.get('value', 0)),
                unit=row.get('unit', ''),
                country=row.get('country', 'Global'),
            )
            results.append(result.get('emissionValue'))
        df['emissionValue_tCO2e'] = results
        return df
