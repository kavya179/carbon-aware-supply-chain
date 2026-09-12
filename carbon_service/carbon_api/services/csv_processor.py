"""
CSV Processor Service (Django / Pandas)
========================================
Receives validated row data from Node.js, runs deep Pandas-based processing:
  1. Loads rows into a DataFrame
  2. Statistical outlier detection
  3. Missing value imputation
  4. Emission calculation per row
  5. Returns processed rows with emission values + warnings
"""
import io
import logging
from typing import Optional

import numpy as np
import pandas as pd

logger = logging.getLogger(__name__)

# ─── Emission Factors ─────────────────────────────────────────────────────────
# kgCO2e per unit (from DEFRA 2024 / IPCC AR6)
ENERGY_FACTORS = {
    'grid electricity': 0.23314,    # kgCO2e/kWh
    'natural gas':      0.18254,    # kgCO2e/kWh
    'diesel':           2.6792,     # kgCO2e/litre
    'petrol':           2.3123,     # kgCO2e/litre
    'heavy fuel oil':   3.1754,     # kgCO2e/litre
    'coal':             2.3439,     # kgCO2e/kg
    'biomass':          0.0285,     # kgCO2e/kWh
    'solar':            0.0,
    'wind':             0.0,
    'hydroelectric':    0.0,
    'lpg':              1.5550,     # kgCO2e/litre
    'other':            0.2,        # Conservative estimate
}

TRANSPORT_FACTORS = {
    'road – hgv (diesel)':    0.1072,   # kgCO2e/tonne-km
    'road – hgv (electric)':  0.0372,
    'road – van':              0.2459,   # kgCO2e/km
    'rail':                   0.0280,   # kgCO2e/tonne-km
    'sea – container':        0.0163,   # kgCO2e/tonne-km
    'sea – bulk carrier':     0.0073,
    'air – freight':          0.6020,   # kgCO2e/tonne-km
    'air – passenger':        0.2550,   # kgCO2e/passenger-km
    'pipeline':               0.0025,
    'inland waterway':        0.0318,
    'other':                  0.1072,
}

MATERIAL_FACTORS = {
    'metals & alloys':          1.85,
    'plastics & polymers':      2.53,
    'chemicals':                1.12,
    'textiles & fibres':        0.95,
    'electronics & components': 3.00,
    'agricultural & bio-based': 0.42,
    'packaging':                0.55,
    'construction materials':   0.38,
    'fuels':                    2.65,
    'other':                    1.50,
}

# Unit conversion to normalise to base unit before applying factor
ENERGY_UNIT_TO_KWH = {
    'kwh': 1, 'mwh': 1000, 'gj': 277.778, 'mj': 0.277778,
    'mmBtu': 293.071, 'litres': 1, 'kg': 1, 'tonnes': 1000, 'm3': 1,
}

KG_TO_TCO2E = 1 / 1000


class CsvProcessorService:
    """
    Processes batches of supplier activity data using Pandas.

    Input:  list of dicts (already schema-validated by Node.js)
    Output: DataFrame with emission_tCO2e column + warnings/flags
    """

    def process(self, data_type: str, rows: list) -> dict:
        """
        Main entry point.

        Args:
            data_type: 'energy' | 'transport' | 'material'
            rows: list of dicts from Node.js validation

        Returns:
            dict with processedRows, summary, warnings
        """
        if not rows:
            return {'processedRows': [], 'summary': {}, 'warnings': []}

        df = pd.DataFrame(rows)
        warnings = []

        try:
            if data_type == 'energy':
                df, warnings = self._process_energy(df)
            elif data_type == 'transport':
                df, warnings = self._process_transport(df)
            elif data_type == 'material':
                df, warnings = self._process_material(df)
            else:
                return {'error': f'Unknown data_type: {data_type}'}
        except Exception as e:
            logger.error(f'CsvProcessorService.process error: {e}')
            return {'error': str(e)}

        # Replace NaN with None for JSON serialisation
        df = df.where(pd.notna(df), None)

        processed_rows = df.to_dict(orient='records')

        summary = {
            'totalRows': len(processed_rows),
            'totalEmissions_tCO2e': round(float(df['emission_tCO2e'].sum()), 6) if 'emission_tCO2e' in df.columns else 0,
            'avgEmission_tCO2e': round(float(df['emission_tCO2e'].mean()), 6) if 'emission_tCO2e' in df.columns else 0,
            'missingValuesFilled': int(df.get('_missing_filled', pd.Series([0])).sum()),
            'outliersDetected': int(df.get('_is_outlier', pd.Series([False])).sum()),
        }

        return {
            'processedRows': processed_rows,
            'summary': summary,
            'warnings': warnings,
        }

    # ── Energy Processing ──────────────────────────────────────────────────────
    def _process_energy(self, df: pd.DataFrame):
        warnings = []

        df.columns = [c.lower().strip() for c in df.columns]

        # Coerce numeric
        df['energy_consumption'] = pd.to_numeric(df['energy_consumption'], errors='coerce')

        # ── Missing value imputation ────────────────────────────────────────────
        missing_count = df['energy_consumption'].isna().sum()
        if missing_count > 0:
            median_val = df['energy_consumption'].median()
            df['energy_consumption'].fillna(median_val, inplace=True)
            df['_missing_filled'] = df['energy_consumption'].isna().astype(int)
            warnings.append({
                'type': 'missing_values',
                'message': f'{missing_count} missing energy_consumption value(s) imputed with median ({median_val:.2f})',
            })
        else:
            df['_missing_filled'] = 0

        # ── Outlier detection (IQR method) ─────────────────────────────────────
        Q1 = df['energy_consumption'].quantile(0.25)
        Q3 = df['energy_consumption'].quantile(0.75)
        IQR = Q3 - Q1
        lower, upper = Q1 - 1.5 * IQR, Q3 + 1.5 * IQR
        df['_is_outlier'] = ~df['energy_consumption'].between(lower, upper)
        outlier_count = df['_is_outlier'].sum()
        if outlier_count > 0:
            warnings.append({
                'type': 'outliers',
                'message': f'{outlier_count} row(s) have unusually high/low energy consumption (IQR method). Please verify.',
            })

        # ── Emission calculation ────────────────────────────────────────────────
        def calc_energy_emission(row):
            source = str(row.get('energy_source', '')).strip().lower()
            factor = ENERGY_FACTORS.get(source, 0.2)  # Default to 'Other'
            consumption = float(row.get('energy_consumption', 0) or 0)
            unit = str(row.get('unit', 'kWh')).strip().lower()

            # Convert to kWh if needed
            if unit in ('litres', 'kg', 'tonnes', 'm3'):
                # For liquid fuels use the factor directly on original unit
                emission_kg = consumption * factor
            else:
                # Energy units → kWh first
                kwh = consumption * ENERGY_UNIT_TO_KWH.get(unit, 1)
                emission_kg = kwh * factor

            return round(emission_kg * KG_TO_TCO2E, 6)

        df['emission_tCO2e'] = df.apply(calc_energy_emission, axis=1)
        df['emission_factor_source'] = 'DEFRA 2024'

        return df, warnings

    # ── Transport Processing ───────────────────────────────────────────────────
    def _process_transport(self, df: pd.DataFrame):
        warnings = []
        df.columns = [c.lower().strip() for c in df.columns]

        df['distance'] = pd.to_numeric(df['distance'], errors='coerce')
        df['weight'] = pd.to_numeric(df.get('weight', pd.Series([None] * len(df))), errors='coerce')

        # Distance: impute missing with median
        if df['distance'].isna().sum() > 0:
            median_d = df['distance'].median()
            df['distance'].fillna(median_d, inplace=True)
            warnings.append({'type': 'missing_values', 'message': f'Missing distance(s) imputed with median ({median_d:.1f})'})

        # Weight: impute with 1 tonne if missing (conservative default)
        df['weight'] = df['weight'].fillna(1.0)
        df['_missing_filled'] = df['weight'].isna().astype(int)
        df['_is_outlier'] = False

        # Distance unit conversion to km
        def dist_to_km(row):
            d = float(row.get('distance', 0) or 0)
            unit = str(row.get('distance_unit', 'km')).strip().lower()
            if unit == 'miles': return d * 1.60934
            if unit == 'nautical miles': return d * 1.852
            return d

        # Weight unit to tonnes
        def weight_to_t(row):
            w = float(row.get('weight', 1) or 1)
            unit = str(row.get('weight_unit', 'tonnes')).strip().lower()
            if unit == 'kg': return w / 1000
            if unit == 'lbs': return w * 0.000453592
            return w

        def calc_transport_emission(row):
            mode = str(row.get('transport_mode', '')).strip().lower()
            factor = TRANSPORT_FACTORS.get(mode, 0.1072)
            dist_km = dist_to_km(row)
            weight_t = weight_to_t(row)

            if mode == 'air – passenger':
                passengers = float(row.get('passenger_count', 1) or 1)
                emission_kg = dist_km * passengers * factor
            elif mode == 'road – van':
                emission_kg = dist_km * factor  # per km, not tonne-km
            else:
                tonne_km = dist_km * weight_t
                emission_kg = tonne_km * factor

            return round(emission_kg * KG_TO_TCO2E, 6)

        df['emission_tCO2e'] = df.apply(calc_transport_emission, axis=1)
        df['emission_factor_source'] = 'DEFRA 2024'

        return df, warnings

    # ── Material Processing ────────────────────────────────────────────────────
    def _process_material(self, df: pd.DataFrame):
        warnings = []
        df.columns = [c.lower().strip() for c in df.columns]

        df['quantity'] = pd.to_numeric(df['quantity'], errors='coerce')

        if df['quantity'].isna().sum() > 0:
            median_q = df['quantity'].median()
            df['quantity'].fillna(median_q, inplace=True)
            warnings.append({'type': 'missing_values', 'message': f'Missing quantity(s) imputed with median ({median_q:.2f})'})

        df['_missing_filled'] = 0
        df['_is_outlier'] = False

        # Outlier detection
        Q1, Q3 = df['quantity'].quantile(0.25), df['quantity'].quantile(0.75)
        IQR = Q3 - Q1
        df['_is_outlier'] = ~df['quantity'].between(Q1 - 1.5 * IQR, Q3 + 1.5 * IQR)
        if df['_is_outlier'].sum() > 0:
            warnings.append({'type': 'outliers', 'message': f"{int(df['_is_outlier'].sum())} row(s) have unusual quantities. Please verify."})

        def calc_material_emission(row):
            category = str(row.get('material_category', 'other')).strip().lower()
            factor = MATERIAL_FACTORS.get(category, 1.5)  # kgCO2e/tonne
            quantity = float(row.get('quantity', 0) or 0)
            unit = str(row.get('unit', 'tonnes')).strip().lower()

            # Convert to tonnes
            if unit == 'kg': quantity /= 1000
            elif unit == 'lbs': quantity *= 0.000453592

            emission_kg = quantity * factor * 1000  # factor is per tonne, convert to kg
            return round(emission_kg * KG_TO_TCO2E, 6)

        df['emission_tCO2e'] = df.apply(calc_material_emission, axis=1)
        df['emission_factor_source'] = 'Ecoinvent 3.10 / IPCC AR6'

        return df, warnings
