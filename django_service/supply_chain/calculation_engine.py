import re
from decimal import Decimal, ROUND_HALF_UP
from django.db import transaction
from django.core.exceptions import ValidationError
from .models import (
    SupplierActivityData,
    EmissionFactor,
    CarbonCalculation,
    AuditLog
)

# Standardized central emission factors documentation catalog
STANDARD_FACTORS = [
    # --- Energy / Electricity ---
    {
        'activity_name': 'Grid Electricity - Global Benchmark',
        'category': 'ELECTRICITY',
        'scope': 'Scope 3 Cat 3 / Cat 1',
        'unit': 'kWh',
        'factor_value': Decimal('0.436000'),
        'source': 'IEA Global Emission Factors 2024',
        'region': 'Global',
        'year': 2024
    },
    {
        'activity_name': 'Grid Electricity - US Average',
        'category': 'ELECTRICITY',
        'scope': 'Scope 3 Cat 3 / Cat 1',
        'unit': 'kWh',
        'factor_value': Decimal('0.385000'),
        'source': 'EPA eGRID 2024',
        'region': 'North America',
        'year': 2024
    },
    {
        'activity_name': 'Grid Electricity - European Average',
        'category': 'ELECTRICITY',
        'scope': 'Scope 3 Cat 3 / Cat 1',
        'unit': 'kWh',
        'factor_value': Decimal('0.255000'),
        'source': 'EEA 2024',
        'region': 'Europe',
        'year': 2024
    },
    {
        'activity_name': 'Grid Electricity - Asia Pacific Average',
        'category': 'ELECTRICITY',
        'scope': 'Scope 3 Cat 3 / Cat 1',
        'unit': 'kWh',
        'factor_value': Decimal('0.582000'),
        'source': 'IEA 2024',
        'region': 'Asia-Pacific',
        'year': 2024
    },
    # --- Energy / Fuels ---
    {
        'activity_name': 'Diesel Fuel Combustion',
        'category': 'FUEL',
        'scope': 'Scope 3 Cat 1 / Cat 3',
        'unit': 'liter',
        'factor_value': Decimal('2.687000'),
        'source': 'DEFRA 2024 Conversion Factors',
        'region': 'Global',
        'year': 2024
    },
    {
        'activity_name': 'Natural Gas Combustion',
        'category': 'FUEL',
        'scope': 'Scope 3 Cat 1 / Cat 3',
        'unit': 'm3',
        'factor_value': Decimal('2.028000'),
        'source': 'DEFRA 2024 Conversion Factors',
        'region': 'Global',
        'year': 2024
    },
    {
        'activity_name': 'Petrol / Gasoline Combustion',
        'category': 'FUEL',
        'scope': 'Scope 3 Cat 1 / Cat 3',
        'unit': 'liter',
        'factor_value': Decimal('2.315000'),
        'source': 'DEFRA 2024 Conversion Factors',
        'region': 'Global',
        'year': 2024
    },
    # --- Transportation / Logistics ---
    {
        'activity_name': 'Road Freight (Heavy Duty Diesel Truck)',
        'category': 'TRANSPORT',
        'scope': 'Scope 3 Cat 4 (Upstream Transport)',
        'unit': 'tonne-km',
        'factor_value': Decimal('0.082000'),
        'source': 'DEFRA / GLEC Framework 2024',
        'region': 'Global',
        'year': 2024
    },
    {
        'activity_name': 'Rail Freight (Electric / Diesel Mix)',
        'category': 'TRANSPORT',
        'scope': 'Scope 3 Cat 4 (Upstream Transport)',
        'unit': 'tonne-km',
        'factor_value': Decimal('0.028000'),
        'source': 'DEFRA 2024 Conversion Factors',
        'region': 'Global',
        'year': 2024
    },
    {
        'activity_name': 'Sea Freight (Container Ship)',
        'category': 'TRANSPORT',
        'scope': 'Scope 3 Cat 4 (Upstream Transport)',
        'unit': 'tonne-km',
        'factor_value': Decimal('0.016000'),
        'source': 'IMO / DEFRA 2024',
        'region': 'Global',
        'year': 2024
    },
    {
        'activity_name': 'Air Freight (Long Haul Cargo)',
        'category': 'TRANSPORT',
        'scope': 'Scope 3 Cat 4 (Upstream Transport)',
        'unit': 'tonne-km',
        'factor_value': Decimal('0.602000'),
        'source': 'DEFRA 2024 Conversion Factors',
        'region': 'Global',
        'year': 2024
    },
    # --- Materials / Purchased Goods ---
    {
        'activity_name': 'Primary Aluminium (Smelted Ingots)',
        'category': 'MATERIAL',
        'scope': 'Scope 3 Cat 1 (Purchased Goods)',
        'unit': 'kg',
        'factor_value': Decimal('8.240000'),
        'source': 'International Aluminium Institute 2024',
        'region': 'Global',
        'year': 2024
    },
    {
        'activity_name': 'Recycled / Secondary Aluminium',
        'category': 'MATERIAL',
        'scope': 'Scope 3 Cat 1 (Purchased Goods)',
        'unit': 'kg',
        'factor_value': Decimal('0.650000'),
        'source': 'International Aluminium Institute 2024',
        'region': 'Global',
        'year': 2024
    },
    {
        'activity_name': 'Primary Crude Steel (BOF)',
        'category': 'MATERIAL',
        'scope': 'Scope 3 Cat 1 (Purchased Goods)',
        'unit': 'kg',
        'factor_value': Decimal('2.150000'),
        'source': 'WorldSteel Association 2024',
        'region': 'Global',
        'year': 2024
    },
    {
        'activity_name': 'Lithium Carbonate (Battery Grade)',
        'category': 'MATERIAL',
        'scope': 'Scope 3 Cat 1 (Purchased Goods)',
        'unit': 'kg',
        'factor_value': Decimal('15.600000'),
        'source': 'Argonne GREET Model 2024',
        'region': 'Global',
        'year': 2024
    },
    {
        'activity_name': 'Cathode Active Material (NMC 811)',
        'category': 'MATERIAL',
        'scope': 'Scope 3 Cat 1 (Purchased Goods)',
        'unit': 'kg',
        'factor_value': Decimal('24.300000'),
        'source': 'Argonne GREET Model 2024',
        'region': 'Global',
        'year': 2024
    },
    {
        'activity_name': 'Virgin Polypropylene Plastic',
        'category': 'MATERIAL',
        'scope': 'Scope 3 Cat 1 (Purchased Goods)',
        'unit': 'kg',
        'factor_value': Decimal('1.950000'),
        'source': 'PlasticsEurope Eco-profiles 2024',
        'region': 'Global',
        'year': 2024
    },
    {
        'activity_name': 'Corrugated Cardboard Packaging',
        'category': 'MATERIAL',
        'scope': 'Scope 3 Cat 1 (Purchased Goods)',
        'unit': 'kg',
        'factor_value': Decimal('0.820000'),
        'source': 'DEFRA 2024 Conversion Factors',
        'region': 'Global',
        'year': 2024
    }
]


def seed_standard_emission_factors():
    """
    Populates SQLite database with standard documented emission factors if not already present.
    """
    created_count = 0
    for factor_data in STANDARD_FACTORS:
        obj, created = EmissionFactor.objects.get_or_create(
            activity_name=factor_data['activity_name'],
            category=factor_data['category'],
            region=factor_data['region'],
            year=factor_data['year'],
            defaults={
                'scope': factor_data['scope'],
                'unit': factor_data['unit'],
                'factor_value': factor_data['factor_value'],
                'source': factor_data['source']
            }
        )
        if created:
            created_count += 1
    return created_count


class CarbonCalculationEngine:
    """
    Deterministic rule-based Scope 3 carbon calculation engine.
    Applies documented greenhouse gas emission factors without heuristics or ML.
    Produces auditable mathematical traces and snapshots in SQLite.
    """

    @classmethod
    def match_emission_factor(cls, activity_data):
        """
        Centrally resolves the appropriate documented emission factor from SQLite
        based on domain, activity type, transport mode, fuel type, or material type.
        """
        # Ensure emission factor library is seeded
        if EmissionFactor.objects.count() < len(STANDARD_FACTORS):
            seed_standard_emission_factors()

        act_type_lower = activity_data.activity_type.lower()
        fuel_type_lower = (activity_data.fuel_type or '').lower()
        tmode_lower = (activity_data.transport_mode or '').lower()
        mat_lower = (activity_data.material_type or '').lower()

        # 1. Transportation Matching
        if 'transport' in act_type_lower or 'freight' in act_type_lower or tmode_lower:
            if 'air' in tmode_lower or 'flight' in tmode_lower or 'air' in act_type_lower:
                ef = EmissionFactor.objects.filter(category='TRANSPORT', activity_name__icontains='Air').first()
            elif 'sea' in tmode_lower or 'ship' in tmode_lower or 'ocean' in tmode_lower:
                ef = EmissionFactor.objects.filter(category='TRANSPORT', activity_name__icontains='Sea').first()
            elif 'rail' in tmode_lower or 'train' in tmode_lower:
                ef = EmissionFactor.objects.filter(category='TRANSPORT', activity_name__icontains='Rail').first()
            else:
                ef = EmissionFactor.objects.filter(category='TRANSPORT', activity_name__icontains='Road').first()
            if ef:
                return ef

        # 2. Fuel Matching
        if 'fuel' in act_type_lower or fuel_type_lower or 'gas' in act_type_lower or 'diesel' in act_type_lower:
            if 'gas' in fuel_type_lower or 'gas' in act_type_lower:
                ef = EmissionFactor.objects.filter(category='FUEL', activity_name__icontains='Natural Gas').first()
            elif 'petrol' in fuel_type_lower or 'gasoline' in fuel_type_lower:
                ef = EmissionFactor.objects.filter(category='FUEL', activity_name__icontains='Petrol').first()
            else:
                ef = EmissionFactor.objects.filter(category='FUEL', activity_name__icontains='Diesel').first()
            if ef:
                return ef

        # 3. Materials Matching
        if 'material' in act_type_lower or 'good' in act_type_lower or mat_lower:
            if 'lithium' in mat_lower:
                ef = EmissionFactor.objects.filter(category='MATERIAL', activity_name__icontains='Lithium').first()
            elif 'cathode' in mat_lower or 'battery' in mat_lower:
                ef = EmissionFactor.objects.filter(category='MATERIAL', activity_name__icontains='Cathode').first()
            elif 'steel' in mat_lower:
                ef = EmissionFactor.objects.filter(category='MATERIAL', activity_name__icontains='Steel').first()
            elif 'plastic' in mat_lower or 'polypropylene' in mat_lower:
                ef = EmissionFactor.objects.filter(category='MATERIAL', activity_name__icontains='Plastic').first()
            elif 'cardboard' in mat_lower or 'packag' in mat_lower:
                ef = EmissionFactor.objects.filter(category='MATERIAL', activity_name__icontains='Packaging').first()
            else:
                ef = EmissionFactor.objects.filter(category='MATERIAL', activity_name__icontains='Aluminium').first()
            if ef:
                return ef

        # 4. Electricity / Energy Matching (with regional fallback)
        supplier = activity_data.supplier
        region = supplier.region if supplier else 'Global'
        ef = EmissionFactor.objects.filter(category='ELECTRICITY', region__iexact=region).first()
        if not ef:
            ef = EmissionFactor.objects.filter(category='ELECTRICITY', activity_name__icontains='Global').first()
        if not ef:
            ef = EmissionFactor.objects.filter(category='ELECTRICITY').first()

        return ef

    @classmethod
    def calculate_co2e(cls, activity_data, emission_factor=None, user=None):
        """
        Executes deterministic Scope 3 calculation for a single SupplierActivityData record.
        Formula Rules:
        - Energy: CO2e = Consumption (standardized to kWh or fuel unit) * Emission Factor
        - Transportation: CO2e = Distance (km) * Weight (tonnes) * Transport Factor (kg CO2e / tonne-km)
                          Or Quantity (tonne-km) * Transport Factor
        - Materials: CO2e = Material Quantity (standardized to kg) * Material Factor (kg CO2e / kg)
        """
        if not emission_factor:
            emission_factor = cls.match_emission_factor(activity_data)

        if not emission_factor:
            raise ValidationError("No matching emission factor found in central library.")

        input_qty = Decimal(str(activity_data.quantity))
        unit = str(activity_data.unit).strip().lower()
        factor_val = Decimal(str(emission_factor.factor_value))
        category = emission_factor.category

        co2e_kg = Decimal('0.0000')
        formula_text = ""

        # --- RULE 1: Energy Calculations ---
        if category in ('ELECTRICITY', 'FUEL'):
            normalized_qty = input_qty
            calc_unit = activity_data.unit

            # Unit standardizations
            if unit in ('mwh', 'megawatt-hour'):
                normalized_qty = input_qty * Decimal('1000.0') # 1 MWh = 1000 kWh
                formula_text = f"Energy Consumption ({input_qty} {activity_data.unit} = {normalized_qty} kWh) × {factor_val} kg CO2e/kWh"
            elif unit in ('gwh', 'gigawatt-hour'):
                normalized_qty = input_qty * Decimal('1000000.0')
                formula_text = f"Energy Consumption ({input_qty} {activity_data.unit} = {normalized_qty} kWh) × {factor_val} kg CO2e/kWh"
            else:
                formula_text = f"Energy Consumption ({input_qty} {activity_data.unit}) × {factor_val} kg CO2e/{emission_factor.unit}"

            co2e_kg = normalized_qty * factor_val

        # --- RULE 2: Transportation Calculations ---
        elif category == 'TRANSPORT':
            dist = activity_data.distance
            weight = activity_data.shipment_weight

            # Case A: Explicit distance and weight provided -> Distance * Weight * Factor
            if dist is not None and weight is not None and dist > 0 and weight > 0:
                dist_dec = Decimal(str(dist))
                weight_dec = Decimal(str(weight))
                tkm = dist_dec * weight_dec
                co2e_kg = tkm * factor_val
                formula_text = (
                    f"Distance ({dist_dec} km) × Weight ({weight_dec} tonnes) = {tkm} tonne-km × "
                    f"{factor_val} kg CO2e/tonne-km"
                )
            # Case B: Activity quantity is already in tonne-km or km
            else:
                co2e_kg = input_qty * factor_val
                formula_text = f"Transport Activity ({input_qty} {activity_data.unit}) × {factor_val} kg CO2e/{emission_factor.unit}"

        # --- RULE 3: Materials Calculations ---
        elif category == 'MATERIAL':
            normalized_kg = input_qty
            if unit in ('tonne', 'tonnes', 'metric_ton', 'metric_tonnes', 't'):
                normalized_kg = input_qty * Decimal('1000.0') # 1 tonne = 1000 kg
                formula_text = (
                    f"Material Quantity ({input_qty} {activity_data.unit} = {normalized_kg} kg) × "
                    f"{factor_val} kg CO2e/kg"
                )
            elif unit in ('g', 'gram', 'grams'):
                normalized_kg = input_qty / Decimal('1000.0')
                formula_text = (
                    f"Material Quantity ({input_qty} {activity_data.unit} = {normalized_kg} kg) × "
                    f"{factor_val} kg CO2e/kg"
                )
            else:
                formula_text = f"Material Quantity ({input_qty} {activity_data.unit}) × {factor_val} kg CO2e/{emission_factor.unit}"

            co2e_kg = normalized_kg * factor_val

        # General / Fallback
        else:
            co2e_kg = input_qty * factor_val
            formula_text = f"Activity ({input_qty} {activity_data.unit}) × {factor_val} kg CO2e/{emission_factor.unit}"

        # Round values deterministically
        co2e_kg_rounded = co2e_kg.quantize(Decimal('0.0001'), rounding=ROUND_HALF_UP)
        co2e_tonnes = (co2e_kg / Decimal('1000.0')).quantize(Decimal('0.000001'), rounding=ROUND_HALF_UP)

        full_formula = f"{formula_text} = {co2e_kg_rounded} kg CO2e ({co2e_tonnes} tCO2e)"

        with transaction.atomic():
            calc, created = CarbonCalculation.objects.update_or_create(
                activity_data=activity_data,
                defaults={
                    'emission_factor': emission_factor,
                    'co2e_kg': co2e_kg_rounded,
                    'co2e_tonnes': co2e_tonnes,
                    'input_value': input_qty,
                    'unit': activity_data.unit,
                    'emission_factor_value': factor_val,
                    'emission_factor_source': emission_factor.source,
                    'formula': full_formula,
                    'calculation_method': 'SUPPLIER_SPECIFIC',
                    'status': 'VERIFIED' if activity_data.verification_status == 'VERIFIED' else 'ESTIMATED',
                    'calculated_by': user
                }
            )

            # Complete 8-Part Calculation Trace Audit Log
            AuditLog.log_action(
                user=user,
                action='CARBON_CALCULATION_RUN',
                entity_type='CarbonCalculation',
                entity_id=str(calc.id),
                details={
                    'supplier_name': activity_data.supplier.name if activity_data.supplier else '',
                    'supplier_id': activity_data.supplier_id,
                    'activity_id': activity_data.id,
                    'input_value': float(input_qty),
                    'unit': str(activity_data.unit),
                    'emission_factor_value': float(factor_val),
                    'emission_factor_source': str(emission_factor.source),
                    'formula': full_formula,
                    'result_kg': float(co2e_kg_rounded),
                    'result_tonnes': float(co2e_tonnes),
                    'result': f"{float(co2e_kg_rounded):,.4f} kg CO2e ({float(co2e_tonnes):,.6f} tCO2e)",
                    'timestamp': calc.calculated_at.isoformat() if calc.calculated_at else None,
                    'verification_status': calc.status,
                    'calculation_trace': {
                        'input': float(input_qty),
                        'unit': str(activity_data.unit),
                        'emission_factor': float(factor_val),
                        'source': str(emission_factor.source),
                        'formula': full_formula,
                        'result': f"{float(co2e_kg_rounded):,.4f} kg CO2e ({float(co2e_tonnes):,.6f} tCO2e)",
                        'timestamp': calc.calculated_at.isoformat() if calc.calculated_at else None,
                        'verification_status': calc.status
                    }
                }
            )

        return calc
