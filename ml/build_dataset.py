"""
Phase 17 â€” ML Dataset Generation
=====================================
Generates a structured, labelled dataset for Scope 3 carbon emission estimation.

DATA PROVENANCE TRANSPARENCY (required):
  - SOURCE_TYPE = 'REFERENCE'  : Derived from publicly available emission factor
                                  databases (DEFRA, EPA, IPCC AR6, GHG Protocol).
  - SOURCE_TYPE = 'DERIVED'    : Computed from the reference emission factors
                                  combined with generated activity parameters.
  - SOURCE_TYPE = 'SYNTHETIC'  : Parametrically generated plausible supply-chain
                                  scenarios. NOT real-world supplier data.
                                  Must not be reported as actual emissions.

This dataset is an INPUT to model training only.
The rule-based CarbonCalculationEngine remains the primary calculation system.
ML models trained on this data are for ESTIMATION of missing values only.

Target variable:
    co2e_kg  â€” carbon dioxide equivalent in kilograms
                (CALCULATED from reference factors Ã— activity quantity)

Usage:
    python build_dataset.py
    â†’ writes ml/dataset/scope3_dataset.csv
    â†’ writes ml/dataset/scope3_dataset_meta.json
"""

import json
import os
import random
import sys
from pathlib import Path

import numpy as np
import pandas as pd

# â”€â”€ Reproducibility â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
RANDOM_SEED = 42
random.seed(RANDOM_SEED)
np.random.seed(RANDOM_SEED)

# â”€â”€ Paths â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
ML_DIR = Path(__file__).parent
DATASET_DIR = ML_DIR / "dataset"
DATASET_DIR.mkdir(parents=True, exist_ok=True)
OUTPUT_CSV = DATASET_DIR / "scope3_dataset.csv"
OUTPUT_META = DATASET_DIR / "scope3_dataset_meta.json"

# â”€â”€ Reference Emission Factors â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
# Source: DEFRA 2023, EPA eGrid 2023, IPCC AR6 WG3
# Units: kg CO2e per unit of activity
# SOURCE_TYPE: REFERENCE

EMISSION_FACTORS = {
    # Transport (kg CO2e per tonne-km)
    "transport": {
        "road_diesel":      0.1033,   # DEFRA 2023 HGV articulated >33t laden
        "road_electric":    0.0210,   # EV HGV, UK grid average
        "rail_freight":     0.0280,   # Freight rail, diesel
        "sea_container":    0.0160,   # Container ship deep sea
        "sea_bulk":         0.0120,   # Bulk carrier deep sea
        "air_freight":      0.6020,   # Air freight (belly + dedicated)
        "inland_waterway":  0.0310,   # River barge
    },
    # Energy (kg CO2e per kWh)
    "energy": {
        "grid_uk":          0.2070,   # UK national grid 2023
        "grid_india":       0.7082,   # CEA India 2022
        "grid_germany":     0.3850,   # Germany 2022
        "grid_usa":         0.3860,   # US average EPA eGrid 2023
        "grid_china":       0.5810,   # China average
        "natural_gas":      0.2030,   # Natural gas combustion
        "renewable":        0.0200,   # Wind/solar lifecycle
        "coal":             0.9400,   # Coal combustion
    },
    # Materials (kg CO2e per kg of material)
    "material": {
        "steel":            1.8500,   # World Steel Association 2023
        "aluminium":        8.2400,   # Primary aluminium, world average
        "aluminium_recycled": 0.5100, # Secondary aluminium
        "copper":           3.1700,   # Primary copper smelting
        "plastic_pet":      3.1000,   # PET plastic production
        "plastic_pp":       1.6500,   # Polypropylene
        "glass":            0.8500,   # Soda-lime glass
        "rubber":           3.8500,   # Natural rubber processing
        "lithium_battery":  75.0,     # Li-ion battery production kgCO2e/kWh
        "concrete":         0.1300,   # Ready-mix concrete
        "cotton_fabric":    8.0000,   # Cotton production incl. land use
        "wood_timber":      0.4600,   # Timber, air dried
        "cardboard":        0.8900,   # Corrugated cardboard
        "chemicals_general": 2.2000, # Generic industrial chemicals
    },
    # Fuel combustion on-site (kg CO2e per litre)
    "fuel": {
        "diesel":           2.6900,
        "petrol":           2.3100,
        "lpg":              1.5550,
        "natural_gas_m3":   2.0400,   # per m3
    },
}

# â”€â”€ Industry Sectors â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
INDUSTRY_SECTORS = [
    "Automotive Manufacturing",
    "Electronics Assembly",
    "Chemical Processing",
    "Textiles & Apparel",
    "Steel & Metals",
    "Plastics Manufacturing",
    "Agricultural Commodities",
    "Pharmaceutical Manufacturing",
    "Mining & Raw Materials",
    "Food Processing",
    "Logistics & Freight",
    "Packaging Materials",
    "Semiconductor Fabrication",
    "Construction Materials",
    "Renewable Energy Components",
]

# Typical energy intensity by sector (kWh per unit production)
SECTOR_ENERGY_PROFILE = {
    "Automotive Manufacturing":      {"base_kwh": 2200, "std": 600, "fuel_use": True},
    "Electronics Assembly":          {"base_kwh": 800,  "std": 200, "fuel_use": False},
    "Chemical Processing":           {"base_kwh": 4500, "std": 1200,"fuel_use": True},
    "Textiles & Apparel":            {"base_kwh": 950,  "std": 300, "fuel_use": False},
    "Steel & Metals":                {"base_kwh": 6000, "std": 2000,"fuel_use": True},
    "Plastics Manufacturing":        {"base_kwh": 1800, "std": 500, "fuel_use": True},
    "Agricultural Commodities":      {"base_kwh": 600,  "std": 200, "fuel_use": True},
    "Pharmaceutical Manufacturing":  {"base_kwh": 3500, "std": 800, "fuel_use": False},
    "Mining & Raw Materials":        {"base_kwh": 5500, "std": 1800,"fuel_use": True},
    "Food Processing":               {"base_kwh": 1200, "std": 400, "fuel_use": False},
    "Logistics & Freight":           {"base_kwh": 400,  "std": 150, "fuel_use": True},
    "Packaging Materials":           {"base_kwh": 1400, "std": 400, "fuel_use": False},
    "Semiconductor Fabrication":     {"base_kwh": 9000, "std": 2500,"fuel_use": False},
    "Construction Materials":        {"base_kwh": 2800, "std": 900, "fuel_use": True},
    "Renewable Energy Components":   {"base_kwh": 2100, "std": 600, "fuel_use": False},
}

# Material primary use by sector
SECTOR_PRIMARY_MATERIAL = {
    "Automotive Manufacturing":     ["steel", "aluminium", "rubber", "plastic_pp"],
    "Electronics Assembly":         ["copper", "aluminium", "plastic_pet", "chemicals_general"],
    "Chemical Processing":          ["chemicals_general", "plastic_pp", "glass"],
    "Textiles & Apparel":           ["cotton_fabric", "plastic_pet"],
    "Steel & Metals":               ["steel", "aluminium", "copper"],
    "Plastics Manufacturing":       ["plastic_pet", "plastic_pp", "chemicals_general"],
    "Agricultural Commodities":     ["wood_timber", "cardboard", "cotton_fabric"],
    "Pharmaceutical Manufacturing": ["chemicals_general", "glass", "plastic_pet"],
    "Mining & Raw Materials":       ["steel", "copper", "concrete", "chemicals_general"],
    "Food Processing":              ["cardboard", "plastic_pet", "glass"],
    "Logistics & Freight":          ["cardboard", "plastic_pp"],
    "Packaging Materials":          ["cardboard", "plastic_pet", "glass"],
    "Semiconductor Fabrication":    ["chemicals_general", "copper", "aluminium"],
    "Construction Materials":       ["concrete", "steel", "glass", "wood_timber"],
    "Renewable Energy Components":  ["steel", "aluminium", "copper", "lithium_battery"],
}

# Typical supplier countries with grid factors
COUNTRY_GRID = {
    "United Kingdom":    ("grid_uk",      0.2070, "GBR"),
    "Germany":           ("grid_germany", 0.3850, "DEU"),
    "United States":     ("grid_usa",     0.3860, "USA"),
    "India":             ("grid_india",   0.7082, "IND"),
    "China":             ("grid_china",   0.5810, "CHN"),
    "France":            ("grid_uk",      0.0560, "FRA"),  # very low nuclear
    "Japan":             ("grid_usa",     0.4700, "JPN"),
    "South Korea":       ("grid_usa",     0.4350, "KOR"),
    "Brazil":            ("grid_uk",      0.0800, "BRA"),  # hydro heavy
    "Australia":         ("grid_usa",     0.6600, "AUS"),
    "Saudi Arabia":      ("grid_india",   0.7400, "SAU"),
    "Mexico":            ("grid_usa",     0.4200, "MEX"),
    "Turkey":            ("grid_germany", 0.4450, "TUR"),
    "Vietnam":           ("grid_india",   0.5900, "VNM"),
    "South Africa":      ("grid_india",   0.8900, "ZAF"),
}

TRANSPORT_MODES = list(EMISSION_FACTORS["transport"].keys())
COUNTRIES = list(COUNTRY_GRID.keys())


# â”€â”€ Dataset Generation â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

def _clamp(value, low, high):
    return max(low, min(high, value))


def generate_record(record_id: int, tier: int) -> dict:
    """
    Generate one synthetic supply-chain activity record.
    Returns a dict with features and a DERIVED co2e_kg target.
    """
    sector = random.choice(INDUSTRY_SECTORS)
    country = random.choice(COUNTRIES)
    grid_key, grid_factor, iso3 = COUNTRY_GRID[country]

    # Renewable energy adoption (%) â€” more renewable = lower grid factor
    renewable_pct = _clamp(np.random.beta(2, 5) * 100, 0, 100)
    effective_grid_factor = grid_factor * (1 - renewable_pct / 100) + \
                            EMISSION_FACTORS["energy"]["renewable"] * (renewable_pct / 100)

    # Production quantity (units/tonnes produced per month)
    production_qty = abs(np.random.normal(5000, 2500))
    production_qty = _clamp(production_qty, 100, 30000)

    # Energy consumption (kWh/month)
    ep = SECTOR_ENERGY_PROFILE.get(sector, {"base_kwh": 2000, "std": 600, "fuel_use": True})
    energy_kwh = abs(np.random.normal(ep["base_kwh"], ep["std"]))
    energy_kwh = _clamp(energy_kwh, 50, 25000)

    # On-site fuel use (litres diesel/month); some sectors have negligible on-site combustion
    fuel_litres = 0.0
    if ep["fuel_use"] and random.random() > 0.25:
        fuel_litres = abs(np.random.exponential(800))
        fuel_litres = _clamp(fuel_litres, 0, 8000)

    # Material type and quantity (kg/month)
    mat_candidates = SECTOR_PRIMARY_MATERIAL.get(sector, ["steel"])
    material_type = random.choice(mat_candidates)
    material_qty_kg = abs(np.random.normal(production_qty * 1.2, production_qty * 0.4))
    material_qty_kg = _clamp(material_qty_kg, 100, 100000)

    # Transport
    transport_mode = random.choice(TRANSPORT_MODES)
    distance_km = abs(np.random.exponential(2500))
    distance_km = _clamp(distance_km, 50, 20000)
    # Weight shipped = ~80% of production qty in tonnes
    shipment_weight_tonnes = production_qty * 0.8 / 1000

    # â”€â”€ Target calculation â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    # All components DERIVED from reference factors

    # a) Energy emissions
    energy_co2e = energy_kwh * effective_grid_factor

    # b) Fuel combustion emissions
    fuel_co2e = fuel_litres * EMISSION_FACTORS["fuel"]["diesel"]

    # c) Material emissions (Scope 3 upstream)
    mat_factor = EMISSION_FACTORS["material"].get(material_type, 2.0)
    material_co2e = material_qty_kg * mat_factor

    # d) Transport emissions
    transport_factor = EMISSION_FACTORS["transport"].get(transport_mode, 0.1)
    transport_co2e = distance_km * shipment_weight_tonnes * transport_factor

    # e) Total
    total_co2e_kg = energy_co2e + fuel_co2e + material_co2e + transport_co2e

    # Add small realistic noise (Â±3%) to simulate measurement uncertainty
    noise = np.random.normal(1.0, 0.03)
    total_co2e_kg *= noise
    total_co2e_kg = max(0.0, total_co2e_kg)

    # â”€â”€ Introduce deliberate missing values (realistic data quality) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    # ~8% chance renewable_pct is missing (supplier didn't report)
    if random.random() < 0.08:
        renewable_pct = np.nan
    # ~5% chance distance is missing
    if random.random() < 0.05:
        distance_km = np.nan
    # ~6% chance fuel_litres is missing
    if random.random() < 0.06:
        fuel_litres = np.nan

    return {
        "record_id":            record_id,
        "source_type":          "SYNTHETIC",       # NOT real supplier data
        "supplier_tier":        tier,
        "industry_sector":      sector,
        "country":              country,
        "country_iso3":         iso3,
        "grid_emission_factor": round(grid_factor, 4),
        "renewable_energy_pct": round(renewable_pct, 2) if not np.isnan(renewable_pct) else np.nan,
        "energy_kwh_monthly":   round(energy_kwh, 2),
        "fuel_litres_monthly":  round(fuel_litres, 2) if not np.isnan(fuel_litres) else np.nan,
        "production_qty_units": round(production_qty, 1),
        "transport_mode":       transport_mode,
        "distance_km":          round(distance_km, 1) if not np.isnan(distance_km) else np.nan,
        "shipment_weight_t":    round(shipment_weight_tonnes, 3),
        "material_type":        material_type,
        "material_qty_kg":      round(material_qty_kg, 2),
        "material_ef_kgco2e_kg": round(mat_factor, 4),    # reference factor used
        "transport_ef_kgco2e_tonne_km": round(transport_factor, 4),  # reference factor used
        "energy_co2e_kg":       round(energy_co2e, 4),    # component (derived)
        "fuel_co2e_kg":         round(fuel_co2e, 4),      # component (derived)
        "material_co2e_kg":     round(material_co2e, 4),  # component (derived)
        "transport_co2e_kg":    round(transport_co2e, 4), # component (derived)
        "co2e_kg":              round(total_co2e_kg, 4),  # TARGET (derived)
    }


def build_dataset(n_total: int = 2000) -> pd.DataFrame:
    """
    Generate n_total records with realistic tier distribution:
      Tier 1: 30%  (direct suppliers â€” more data available)
      Tier 2: 40%  (sub-contractors)
      Tier 3: 30%  (raw material suppliers)
    """
    tier_distribution = {
        1: int(n_total * 0.30),
        2: int(n_total * 0.40),
        3: n_total - int(n_total * 0.30) - int(n_total * 0.40),
    }

    records = []
    record_id = 1
    for tier, count in tier_distribution.items():
        for _ in range(count):
            records.append(generate_record(record_id, tier))
            record_id += 1

    df = pd.DataFrame(records)
    # Shuffle to mix tiers
    df = df.sample(frac=1, random_state=RANDOM_SEED).reset_index(drop=True)
    return df


def save_dataset(df: pd.DataFrame):
    df.to_csv(OUTPUT_CSV, index=False)
    print(f"[OK] Dataset saved -> {OUTPUT_CSV}  ({len(df):,} rows)")


def save_metadata(df: pd.DataFrame):
    meta = {
        "provenance": {
            "source_type": "SYNTHETIC",
            "notice": (
                "All records are parametrically generated synthetic scenarios. "
                "Emission factors are derived from DEFRA 2023, EPA eGrid 2023, "
                "IPCC AR6, and GHG Protocol reference databases. "
                "This dataset must NOT be used to report actual supplier emissions."
            ),
            "emission_factor_sources": [
                "DEFRA 2023 Greenhouse Gas Conversion Factors",
                "US EPA eGrid 2023",
                "IPCC AR6 Working Group III (2022)",
                "World Steel Association 2023 LCA Data",
                "International Aluminium Institute 2023",
            ],
            "random_seed": RANDOM_SEED,
        },
        "schema": {
            "record_id":              "Unique row identifier",
            "source_type":            "Data provenance label: always SYNTHETIC",
            "supplier_tier":          "Supply chain tier: 1 (direct), 2 (sub), 3 (raw material)",
            "industry_sector":        "Supplier industry sector (categorical)",
            "country":                "Supplier country (categorical)",
            "country_iso3":           "ISO 3166-1 alpha-3 country code",
            "grid_emission_factor":   "National grid emission factor (kg CO2e/kWh) [REFERENCE]",
            "renewable_energy_pct":   "% of energy from renewable sources (may be NaN)",
            "energy_kwh_monthly":     "Monthly energy consumption (kWh) [SYNTHETIC]",
            "fuel_litres_monthly":    "Monthly on-site diesel consumption (L) (may be NaN) [SYNTHETIC]",
            "production_qty_units":   "Monthly production output (units/tonnes) [SYNTHETIC]",
            "transport_mode":         "Primary inbound/outbound transport mode (categorical)",
            "distance_km":            "Shipping distance (km) (may be NaN) [SYNTHETIC]",
            "shipment_weight_t":      "Shipment weight (tonnes) [SYNTHETIC]",
            "material_type":          "Primary input material (categorical)",
            "material_qty_kg":        "Monthly material consumption (kg) [SYNTHETIC]",
            "material_ef_kgco2e_kg":  "Material emission factor used (kg CO2e/kg) [REFERENCE]",
            "transport_ef_kgco2e_tonne_km": "Transport emission factor used [REFERENCE]",
            "energy_co2e_kg":         "Energy emission component (kg CO2e) [DERIVED]",
            "fuel_co2e_kg":           "Fuel combustion component (kg CO2e) [DERIVED]",
            "material_co2e_kg":       "Material upstream component (kg CO2e) [DERIVED]",
            "transport_co2e_kg":      "Transport component (kg CO2e) [DERIVED]",
            "co2e_kg":                "TARGET â€” total Scope 3 emissions (kg CO2e) [DERIVED]",
        },
        "statistics": {
            "total_records": len(df),
            "tier_distribution": df["supplier_tier"].value_counts().to_dict(),
            "sector_distribution": df["industry_sector"].value_counts().to_dict(),
            "missing_value_counts": df.isnull().sum().to_dict(),
            "target_co2e_kg": {
                "min":    round(df["co2e_kg"].min(), 2),
                "max":    round(df["co2e_kg"].max(), 2),
                "mean":   round(df["co2e_kg"].mean(), 2),
                "median": round(df["co2e_kg"].median(), 2),
                "std":    round(df["co2e_kg"].std(), 2),
            },
        },
    }
    with open(OUTPUT_META, "w") as f:
        json.dump(meta, f, indent=2)
    print(f"[OK] Metadata saved -> {OUTPUT_META}")


if __name__ == "__main__":
    print("=" * 60)
    print("Phase 17 -- ML Dataset Generation")
    print("Provenance: SYNTHETIC (reference EFs from DEFRA/EPA/IPCC)")
    print("=" * 60)
    n = int(sys.argv[1]) if len(sys.argv) > 1 else 2000
    df = build_dataset(n)
    save_dataset(df)
    save_metadata(df)
    print(f"\nDataset shape: {df.shape}")
    print(f"Columns: {list(df.columns)}")
    print(f"\nTarget (co2e_kg) distribution:")
    print(df["co2e_kg"].describe())
    print(f"\nMissing values:")
    print(df.isnull().sum()[df.isnull().sum() > 0])

