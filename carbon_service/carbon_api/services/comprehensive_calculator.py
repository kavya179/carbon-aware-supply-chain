"""
Comprehensive Carbon Calculator Engine
======================================
Loads emission factors from a separate configuration file and calculates 
the footprint across Energy, Transport, and Material categories.
"""
import os
import json
import logging
from .ml_imputation import MLImputationEngine

logger = logging.getLogger(__name__)

KG_TO_TONNE = 1 / 1000

# Load emission factors from JSON
config_path = os.path.join(os.path.dirname(__file__), 'emission_factors.json')
try:
    with open(config_path, 'r') as f:
        FACTORS = json.load(f)
except Exception as e:
    logger.error(f"Failed to load emission factors: {e}")
    FACTORS = {"energy": {}, "transport": {}, "material": {}}

# Unit conversions
ENERGY_UNIT_TO_KWH = {
    'kwh': 1, 'mwh': 1000, 'gj': 277.778, 'mj': 0.277778,
    'mmbtu': 293.071, 'litres': 1, 'kg': 1, 'tonnes': 1000, 'm3': 1,
}

def dist_to_km(dist: float, unit: str) -> float:
    unit = unit.strip().lower()
    if unit == 'miles': return dist * 1.60934
    if unit == 'nautical miles': return dist * 1.852
    return dist

def weight_to_tonnes(weight: float, unit: str) -> float:
    unit = unit.strip().lower()
    if unit == 'kg': return weight / 1000
    if unit == 'lbs': return weight * 0.000453592
    return weight

def get_factor(category: str, key: str, default: float) -> float:
    """Case-insensitive lookup for emission factors"""
    key_lower = key.strip().lower()
    for k, v in FACTORS.get(category, {}).items():
        if k.strip().lower() == key_lower:
            return v
    return default


class ComprehensiveCalculator:
    """
    Engine that calculates total supplier footprint from combined data.
    """

    def calculate_footprint(self, data: dict) -> dict:
        """
        Receives:
        {
            "energy": { "consumption": float, "source": str, "unit": str },
            "transport": { "distance": float, "mode": str, "distanceUnit": str, "weight": float, "weightUnit": str },
            "material": { "quantity": float, "type": str, "unit": str }
        }
        """
        
        # ── 0. AI/ML Imputation for missing data ──
        data = MLImputationEngine.impute_missing_data(data)
        estimation_flags = data.get('estimationFlags', {})
        
        # ── 1. Energy Calculation ──
        energy_emissions = 0.0
        energy_data = data.get('energy')
        if energy_data:
            source = str(energy_data.get('source', '')).strip()
            consumption = float(energy_data.get('consumption', 0) or 0)
            unit = str(energy_data.get('unit', 'kWh')).strip().lower()
            
            factor = get_factor("energy", source, 0.2)
            
            if unit in ('litres', 'kg', 'tonnes', 'm3'):
                emission_kg = consumption * factor
            else:
                kwh = consumption * ENERGY_UNIT_TO_KWH.get(unit, 1)
                emission_kg = kwh * factor
                
            energy_emissions = emission_kg * KG_TO_TONNE

        # ── 2. Transport Calculation ──
        transport_emissions = 0.0
        transport_data = data.get('transport')
        if transport_data:
            mode = str(transport_data.get('mode', '')).strip()
            distance = float(transport_data.get('distance', 0) or 0)
            dist_unit = str(transport_data.get('distanceUnit', 'km'))
            weight = float(transport_data.get('weight', 1) or 1)
            weight_unit = str(transport_data.get('weightUnit', 'tonnes'))
            
            dist_km = dist_to_km(distance, dist_unit)
            weight_t = weight_to_tonnes(weight, weight_unit)
            
            factor = get_factor("transport", mode, 0.1072)
            
            if 'passenger' in mode.lower():
                emission_kg = dist_km * weight * factor # weight acts as passenger count here
            elif 'van' in mode.lower():
                emission_kg = dist_km * factor
            else:
                tonne_km = dist_km * weight_t
                emission_kg = tonne_km * factor
                
            transport_emissions = emission_kg * KG_TO_TONNE

        # ── 3. Material Calculation ──
        material_emissions = 0.0
        material_data = data.get('material')
        if material_data:
            mat_type = str(material_data.get('type', 'Other')).strip()
            quantity = float(material_data.get('quantity', 0) or 0)
            unit = str(material_data.get('unit', 'tonnes')).strip().lower()
            
            # Since mat_type is arbitrary, we try to map or fallback to 'Other'
            factor = get_factor("material", mat_type, 1.50)
            
            weight_t = weight_to_tonnes(quantity, unit)
            # material factors are in kgCO2e/tonne.
            # So weight_t * factor = kgCO2e
            emission_kg = weight_t * factor * 1000
            material_emissions = emission_kg * KG_TO_TONNE

        # ── Totals ──
        energy_emissions = round(energy_emissions, 6)
        transport_emissions = round(transport_emissions, 6)
        material_emissions = round(material_emissions, 6)
        
        total_emissions = round(energy_emissions + transport_emissions + material_emissions, 6)

        return {
            "energyEmissions": energy_emissions,
            "transportEmissions": transport_emissions,
            "materialEmissions": material_emissions,
            "totalEmissions_tCO2e": total_emissions,
            "metadata": FACTORS.get("metadata", {}),
            "estimationFlags": estimation_flags
        }
