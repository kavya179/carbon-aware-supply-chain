"""
Seed Demo Dataset for Hackathon Presentation
Creates a complete, realistic multi-tier supply chain scenario for Apex Motors Corporation [DEMO].

Hierarchy Structure:
  Company: Apex Motors Corporation [DEMO]
    ├── Tier 1: Apex Battery Systems GmbH [DEMO]
    │     └── Tier 2: Voltaic Cell Innovations [DEMO]
    │           └── Tier 3: Atacama Lithium Refining Ltd [DEMO]
    ├── Tier 1: Kinetic Motor Works Ltd [DEMO]
    │     ├── Tier 2: Silicon Semi Foundry Inc [DEMO]
    │     │     └── Tier 3: Vales Copper & Metals SA [DEMO]
    │     └── Tier 2: Alpine Precision Components [DEMO] (MISSING DATA CASE FOR ML GAP-FILLING)
    └── Tier 1: AeroBody Chassis Systems [DEMO]
          └── Tier 2: Nordic Extrusions AB [DEMO]
                ├── Tier 3: Siberia & Nord Smelting Co [DEMO] (OBVIOUS HIGH CARBON HOTSPOT)
                └── Tier 3: Nordic Recycled Alloys [DEMO] (LOWER-CARBON CIRCULAR BENCHMARK)
"""

import sys
from decimal import Decimal
from datetime import date
from django.core.management.base import BaseCommand
from django.contrib.auth.models import User
from django.db import transaction

from supply_chain.models import (
    Company,
    Supplier,
    SupplierRelationship,
    UserProfile,
    EmissionFactor,
    SupplierActivityData,
    CarbonCalculation,
    Hotspot,
    Recommendation,
    AuditLog,
    Report
)
from supply_chain.calculation_engine import (
    seed_standard_emission_factors,
    CarbonCalculationEngine
)
from supply_chain.hotspot_engine import CarbonHotspotDetector
from supply_chain.recommendation_engine import RuleBasedRecommendationEngine


class Command(BaseCommand):
    help = 'Seeds realistic, auditable sample demo data for hackathon presentation'

    def handle(self, *args, **options):
        self.stdout.write(self.style.NOTICE("==> Seeding Hackathon Demo Dataset (Apex Motors Corporation)..."))

        with transaction.atomic():
            # 1. Seed Emission Factors
            self.stdout.write("--> Ensuring standard emission factors...")
            seed_standard_emission_factors()

            # 2. Setup Reporting Company
            company, created = Company.objects.get_or_create(
                name='Apex Motors Corporation',
                defaults={
                    'industry': 'Automotive & Electric Mobility [DEMO]',
                    'country': 'Germany',
                    'registration_number': 'DEMO-REG-2024-EV',
                    'reporting_year': 2024,
                    'target_reduction_pct': Decimal('30.00'),
                }
            )
            self.stdout.write(f"--> Company: {company.name}")

            # 3. Create Demo Users
            users_data = [
                ('demo_manager', 'manager@apexmotors-demo.com', 'COMPANY_MANAGER', 'DemoManager2026!'),
                ('demo_auditor', 'auditor@esg-assurance-demo.com', 'AUDITOR', 'DemoAuditor2026!'),
                ('demo_supplier', 'supplier@battery-systems-demo.com', 'SUPPLIER', 'DemoSupplier2026!'),
            ]
            for username, email, role, pwd in users_data:
                u, u_created = User.objects.get_or_create(
                    username=username,
                    defaults={'email': email, 'first_name': username.split('_')[0].capitalize(), 'last_name': 'Demo'}
                )
                u.set_password(pwd)
                u.save()

                UserProfile.objects.update_or_create(
                    user=u,
                    defaults={'role': role, 'company': company}
                )
            self.stdout.write("--> Created demo authentication accounts (Manager, Auditor, Supplier)")

            # 4. Define Demo Suppliers
            suppliers_spec = [
                # Tier 1
                ('SUP-DEMO-T1-01', 'Apex Battery Systems GmbH [DEMO]', 'Automotive Manufacturing', 'Stuttgart', 'Germany', 'ACTIVE'),
                ('SUP-DEMO-T1-02', 'Kinetic Motor Works Ltd [DEMO]', 'Automotive & Transport Equipment', 'Birmingham', 'United Kingdom', 'ACTIVE'),
                ('SUP-DEMO-T1-03', 'AeroBody Chassis Systems [DEMO]', 'Automotive Manufacturing', 'Gothenburg', 'Sweden', 'ACTIVE'),

                # Tier 2
                ('SUP-DEMO-T2-01', 'Voltaic Cell Innovations [DEMO]', 'Electronics Assembly', 'Ulsan', 'South Korea', 'ACTIVE'),
                ('SUP-DEMO-T2-02', 'Silicon Semi Foundry Inc [DEMO]', 'Semiconductor Fabrication', 'Hsinchu', 'Taiwan', 'ACTIVE'),
                ('SUP-DEMO-T2-03', 'Nordic Extrusions AB [DEMO]', 'Steel & Metals', 'Stockholm', 'Sweden', 'ACTIVE'),
                # MISSING DATA CASE FOR ML GAP-FILLING (Unverified / Data gaps)
                ('SUP-DEMO-T2-04', 'Alpine Precision Components [DEMO]', 'Automotive Manufacturing', 'Graz', 'Austria', 'PENDING_VERIFICATION'),

                # Tier 3
                # OBVIOUS HOTSPOT
                ('SUP-DEMO-T3-01', 'Siberia & Nord Smelting Co [DEMO]', 'Mining & Raw Materials', 'Krasnoyarsk', 'Global', 'ACTIVE'),
                ('SUP-DEMO-T3-02', 'Atacama Lithium Refining Ltd [DEMO]', 'Chemical Processing', 'Antofagasta', 'Chile', 'ACTIVE'),
                ('SUP-DEMO-T3-03', 'Vales Copper & Metals SA [DEMO]', 'Mining & Raw Materials', 'Carajas', 'Brazil', 'ACTIVE'),
                ('SUP-DEMO-T3-04', 'Nordic Recycled Alloys [DEMO]', 'Mining & Raw Materials', 'Oslo', 'Norway', 'ACTIVE'),
            ]

            supplier_objs = {}
            for code, name, sector, loc, country, status in suppliers_spec:
                sup, _ = Supplier.objects.update_or_create(
                    supplier_code=code,
                    defaults={
                        'name': name,
                        'industry_sector': sector,
                        'location': loc,
                        'country': country,
                        'status': status,
                        'contact_email': f"contact@{code.lower().replace('-', '')}.demo",
                    }
                )
                supplier_objs[code] = sup

            # 5. Build Multi-Tier Relationships
            # Tier 1 Relationships (direct to company, parent=None)
            t1_specs = [
                ('SUP-DEMO-T1-01', 1, None, Decimal('45.00')),
                ('SUP-DEMO-T1-02', 1, None, Decimal('35.00')),
                ('SUP-DEMO-T1-03', 1, None, Decimal('20.00')),
            ]
            for scode, tier, parent_code, share in t1_specs:
                SupplierRelationship.objects.update_or_create(
                    company=company,
                    supplier=supplier_objs[scode],
                    parent_supplier=None,
                    defaults={'tier_level': tier, 'procurement_share_pct': share, 'status': 'ACTIVE'}
                )

            # Tier 2 Relationships (parent is Tier 1)
            t2_specs = [
                ('SUP-DEMO-T2-01', 2, 'SUP-DEMO-T1-01', Decimal('70.00')),
                ('SUP-DEMO-T2-02', 2, 'SUP-DEMO-T1-02', Decimal('60.00')),
                ('SUP-DEMO-T2-03', 2, 'SUP-DEMO-T1-03', Decimal('80.00')),
                ('SUP-DEMO-T2-04', 2, 'SUP-DEMO-T1-02', Decimal('40.00')), # Missing data case
            ]
            for scode, tier, parent_code, share in t2_specs:
                SupplierRelationship.objects.update_or_create(
                    company=company,
                    supplier=supplier_objs[scode],
                    parent_supplier=supplier_objs[parent_code],
                    defaults={'tier_level': tier, 'procurement_share_pct': share, 'status': 'ACTIVE'}
                )

            # Tier 3 Relationships (parent is Tier 2)
            t3_specs = [
                ('SUP-DEMO-T3-01', 3, 'SUP-DEMO-T2-03', Decimal('90.00')), # Obvious Hotspot
                ('SUP-DEMO-T3-02', 3, 'SUP-DEMO-T2-01', Decimal('85.00')),
                ('SUP-DEMO-T3-03', 3, 'SUP-DEMO-T2-02', Decimal('75.00')),
                ('SUP-DEMO-T3-04', 3, 'SUP-DEMO-T2-03', Decimal('10.00')), # Circular alternative
            ]
            for scode, tier, parent_code, share in t3_specs:
                SupplierRelationship.objects.update_or_create(
                    company=company,
                    supplier=supplier_objs[scode],
                    parent_supplier=supplier_objs[parent_code],
                    defaults={'tier_level': tier, 'procurement_share_pct': share, 'status': 'ACTIVE'}
                )

            self.stdout.write("--> Mapped Multi-Tier Supply Chain Tree (Tier 1 -> Tier 2 -> Tier 3)")

            # 6. Seed Realistic Operational Activity Data
            activities_spec = [
                # --- TIER 3: THE OBVIOUS HOTSPOT ---
                # Siberia Smelting: 20,000 kg Virgin Aluminium (8.24 kg CO2e/kg = 164.8 tCO2e)
                {
                    'supplier_code': 'SUP-DEMO-T3-01',
                    'activity_type': 'Virgin Aluminium Smelting & Ingot Casting',
                    'quantity': Decimal('20000.0000'),
                    'unit': 'kg',
                    'material_type': 'Virgin Aluminium',
                    'source': 'Smelter Production Manifest [DEMO]',
                    'status': 'VERIFIED',
                },
                # Siberia Smelting: Electricity (150,000 kWh = 65.4 tCO2e)
                {
                    'supplier_code': 'SUP-DEMO-T3-01',
                    'activity_type': 'Electricity Consumption (Smelter Potline)',
                    'quantity': Decimal('150000.0000'),
                    'unit': 'kWh',
                    'source': 'Regional Utility Meter [DEMO]',
                    'status': 'VERIFIED',
                },

                # --- TIER 3: LITHIUM EXTRACTION ---
                # Atacama Lithium: 5,000 kg Lithium Carbonate (15.60 kg CO2e/kg = 78.0 tCO2e)
                {
                    'supplier_code': 'SUP-DEMO-T3-02',
                    'activity_type': 'Lithium Carbonate (Battery Grade)',
                    'quantity': Decimal('5000.0000'),
                    'unit': 'kg',
                    'material_type': 'Lithium Carbonate (Battery Grade)',
                    'source': 'Brine Refinery Certificate [DEMO]',
                    'status': 'VERIFIED',
                },
                # Atacama Lithium: Sea Transport (5 tonnes over 12,000 km = 60,000 t-km = 0.96 tCO2e)
                {
                    'supplier_code': 'SUP-DEMO-T3-02',
                    'activity_type': 'Maritime Container Freight',
                    'quantity': Decimal('60000.0000'),
                    'unit': 'tonne-km',
                    'transport_mode': 'Sea',
                    'distance': Decimal('12000.00'),
                    'shipment_weight': Decimal('5.00'),
                    'source': 'Bill of Lading [DEMO]',
                    'status': 'VERIFIED',
                },

                # --- TIER 3: COPPER WIRE ROD ---
                # Vales Copper: 8,000 kg Refined Copper (3.81 kg CO2e/kg = 30.48 tCO2e)
                {
                    'supplier_code': 'SUP-DEMO-T3-03',
                    'activity_type': 'Primary Refined Copper',
                    'quantity': Decimal('8000.0000'),
                    'unit': 'kg',
                    'material_type': 'Primary Refined Copper',
                    'source': 'Refinery Batch QA [DEMO]',
                    'status': 'VERIFIED',
                },

                # --- TIER 3: RECYCLED ALUMINUM BENCHMARK ---
                # Nordic Recycled Alloys: 2,000 kg Recycled Aluminium (0.50 kg CO2e/kg = 1.0 tCO2e)
                {
                    'supplier_code': 'SUP-DEMO-T3-04',
                    'activity_type': 'Recycled / Secondary Aluminium',
                    'quantity': Decimal('2000.0000'),
                    'unit': 'kg',
                    'material_type': 'Recycled / Secondary Aluminium',
                    'source': 'Circular Scrap Foundry [DEMO]',
                    'status': 'VERIFIED',
                },

                # --- TIER 2: VOLTAIC CELL (Cell Maker) ---
                # Electricity: 80,000 kWh Asia-Pacific Grid (0.582 = 46.56 tCO2e)
                {
                    'supplier_code': 'SUP-DEMO-T2-01',
                    'activity_type': 'Electricity Consumption',
                    'quantity': Decimal('80000.0000'),
                    'unit': 'kWh',
                    'source': 'Smart Meter Telematics [DEMO]',
                    'status': 'VERIFIED',
                },

                # --- TIER 2: SILICON SEMI FOUNDRY ---
                # Air Freight: 1,500 tonne-km (0.602 = 0.903 tCO2e)
                {
                    'supplier_code': 'SUP-DEMO-T2-02',
                    'activity_type': 'Air Cargo Freight',
                    'quantity': Decimal('1500.0000'),
                    'unit': 'tonne-km',
                    'transport_mode': 'Air',
                    'distance': Decimal('3000.00'),
                    'shipment_weight': Decimal('0.50'),
                    'source': 'Airway Bill [DEMO]',
                    'status': 'VERIFIED',
                },
                # Electricity: 40,000 kWh Asia-Pacific Grid (0.582 = 23.28 tCO2e)
                {
                    'supplier_code': 'SUP-DEMO-T2-02',
                    'activity_type': 'Electricity Consumption',
                    'quantity': Decimal('40000.0000'),
                    'unit': 'kWh',
                    'source': 'Cleanroom Facility Telematics [DEMO]',
                    'status': 'VERIFIED',
                },

                # --- TIER 2: NORDIC EXTRUSIONS ---
                # Road Transport: 20,000 tonne-km (0.082 = 1.64 tCO2e)
                {
                    'supplier_code': 'SUP-DEMO-T2-03',
                    'activity_type': 'Road Freight (Heavy Duty Diesel Truck)',
                    'quantity': Decimal('20000.0000'),
                    'unit': 'tonne-km',
                    'transport_mode': 'Road',
                    'distance': Decimal('800.00'),
                    'shipment_weight': Decimal('25.00'),
                    'source': 'Fleet Telematics [DEMO]',
                    'status': 'VERIFIED',
                },

                # --- TIER 1: APEX BATTERY SYSTEMS ---
                # Electricity: 60,000 kWh European Grid (0.255 = 15.3 tCO2e)
                {
                    'supplier_code': 'SUP-DEMO-T1-01',
                    'activity_type': 'Electricity Consumption',
                    'quantity': Decimal('60000.0000'),
                    'unit': 'kWh',
                    'source': 'Assembly Plant Submeter [DEMO]',
                    'status': 'VERIFIED',
                },

                # --- TIER 1: KINETIC MOTOR WORKS ---
                # Diesel Fuel: 4,000 liters (2.687 = 10.748 tCO2e)
                {
                    'supplier_code': 'SUP-DEMO-T1-02',
                    'activity_type': 'Diesel Fuel Combustion',
                    'quantity': Decimal('4000.0000'),
                    'unit': 'liter',
                    'fuel_type': 'Diesel',
                    'source': 'Fuel Tank Telemetry [DEMO]',
                    'status': 'VERIFIED',
                },

                # --- TIER 1: AEROBODY CHASSIS SYSTEMS ---
                # Primary Steel: 15,000 kg (1.890 = 28.35 tCO2e)
                {
                    'supplier_code': 'SUP-DEMO-T1-03',
                    'activity_type': 'Primary Steel',
                    'quantity': Decimal('15000.0000'),
                    'unit': 'kg',
                    'material_type': 'Primary Steel',
                    'source': 'ERP Steel Invoice [DEMO]',
                    'status': 'VERIFIED',
                },
                # Rail Freight: 18,000 tonne-km (0.028 = 0.504 tCO2e)
                {
                    'supplier_code': 'SUP-DEMO-T1-03',
                    'activity_type': 'Rail Freight (Electric / Diesel Mix)',
                    'quantity': Decimal('18000.0000'),
                    'unit': 'tonne-km',
                    'transport_mode': 'Rail',
                    'distance': Decimal('600.00'),
                    'shipment_weight': Decimal('30.00'),
                    'source': 'Rail Waybill [DEMO]',
                    'status': 'VERIFIED',
                },
            ]

            admin_user = User.objects.filter(username='demo_manager').first()

            created_activities = []
            for act in activities_spec:
                sup = supplier_objs[act['supplier_code']]
                a, _ = SupplierActivityData.objects.update_or_create(
                    supplier=sup,
                    activity_type=act['activity_type'],
                    reporting_period='2024-Q1',
                    defaults={
                        'quantity': act['quantity'],
                        'unit': act['unit'],
                        'source': act.get('source', 'Supplier ERP [DEMO]'),
                        'material_type': act.get('material_type', ''),
                        'transport_mode': act.get('transport_mode', ''),
                        'fuel_type': act.get('fuel_type', ''),
                        'distance': act.get('distance', None),
                        'shipment_weight': act.get('shipment_weight', None),
                        'verification_status': act.get('status', 'VERIFIED'),
                        'data_quality_score': 4,
                        'period_start': date(2024, 1, 1),
                        'period_end': date(2024, 3, 31),
                    }
                )
                created_activities.append(a)

            self.stdout.write(f"--> Seeded {len(created_activities)} operational activity records across materials, energy, and transport")

            # 7. Execute Deterministic Carbon Calculation Engine
            self.stdout.write("--> Running CarbonCalculationEngine for all activity records...")
            calc_count = 0
            for a in created_activities:
                calc = CarbonCalculationEngine.calculate_co2e(a, user=admin_user)
                if calc:
                    calc_count += 1
            self.stdout.write(f"--> Computed {calc_count} deterministic CarbonCalculation records with auditable formulas")

            # 8. Sync Carbon Hotspots
            self.stdout.write("--> Running CarbonHotspotDetector and syncing to database...")
            detector = CarbonHotspotDetector(company=company, reporting_period='2024-Q1')
            synced_hotspots = detector.sync_to_database()
            self.stdout.write(f"--> Hotspots synchronized: {synced_hotspots} hotspots")

            # 9. Pre-seed Targeted Circular Recommendations
            self.stdout.write("--> Generating Decarbonization & Circularity Recommendations...")
            rec_engine = RuleBasedRecommendationEngine(company=company, reporting_period='2024-Q1')
            recs_count = rec_engine.generate_and_persist()
            self.stdout.write(f"--> Generated and persisted {recs_count} targeted decarbonization actions")

            # 10. Create Immutable Audit Log Entries
            AuditLog.log_action(
                user=admin_user,
                action='DATASET_INITIALIZED',
                entity_type='Company',
                entity_id=company.id,
                details={'description': 'Initialized hackathon demo dataset for Apex Motors Corporation [DEMO] with 11 suppliers across Tier 1, 2, and 3'}
            )
            AuditLog.log_action(
                user=admin_user,
                action='SCOPE3_CALCULATED',
                entity_type='CarbonCalculation',
                entity_id='ALL',
                details={'period': '2024-Q1', 'status': 'DETERMINISTIC_VERIFIED', 'zero_double_counting': True}
            )
            AuditLog.log_action(
                user=admin_user,
                action='HOTSPOTS_IDENTIFIED',
                entity_type='Hotspot',
                entity_id='SUP-DEMO-T3-01',
                details={'supplier': 'Siberia & Nord Smelting Co [DEMO]', 'impact': 'HIGH', 'reason': 'Primary Virgin Aluminium Smelting (>30% Footprint)'}
            )

            # 11. Create a Pre-Generated Carbon Report
            Report.objects.update_or_create(
                company=company,
                title='Apex Motors Corporation - 2024-Q1 Scope 3 GHG Sustainability Disclosure [DEMO]',
                reporting_year=2024,
                defaults={
                    'total_scope3_tonnes': Decimal('429.35'),
                    'tier1_emissions_tonnes': Decimal('54.39'),
                    'tier2_emissions_tonnes': Decimal('72.38'),
                    'tier3_emissions_tonnes': Decimal('302.58'),
                    'report_format': 'PDF',
                    'status': 'FINAL',
                    'generated_by': admin_user,
                }
            )

            self.stdout.write(self.style.SUCCESS("==> Hackathon Demo Dataset Successfully Seeded!"))
            self.stdout.write(self.style.SUCCESS(
                "    - Company: Apex Motors Corporation\n"
                "    - Obvious Hotspot: Siberia & Nord Smelting Co [DEMO] (Tier 3)\n"
                "    - Missing Data Case: Alpine Precision Components [DEMO] (Tier 2, for ML Gap-Filling)\n"
                "    - Logins: demo_manager / DemoManager2026!, demo_auditor / DemoAuditor2026!\n"
            ))
