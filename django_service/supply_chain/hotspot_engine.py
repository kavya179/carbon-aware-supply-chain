"""
Carbon Hotspot Detection Engine (Phase 12)
Purely rule-based, auditable, and explainable carbon hotspot detection
across multi-tier supply chains on SQLite.

Identifies:
1. Highest-emission suppliers (with main source of emissions)
2. Highest-emission tiers (Tier 1, Tier 2, Tier 3)
3. Highest-emission activities (Electricity, Fuel, Transport, Material)
4. Highest-emission materials (by material type & quantity)
5. Highest-emission transport modes (Road, Rail, Sea, Air)

Guarantees:
- Configurable thresholds (HIGH, MEDIUM, LOW)
- Zero double counting (uses deduplicated calculations from analytics)
- Explainable outputs tracing directly to calculation formulas and emission factors
- Zero machine learning
"""

from decimal import Decimal, ROUND_HALF_UP
from datetime import date
from django.conf import settings
from .models import Hotspot, Supplier
from .analytics import get_company_calculations, build_chart_format


class HotspotConfig:
    """
    Centralized, configurable thresholds for carbon hotspot impact classification.
    Prevents scattered hard-coded numbers across the codebase.
    """
    # Default thresholds as percentages of total footprint
    DEFAULT_HIGH_THRESHOLD = Decimal('20.0')    # >= 20.0% contribution -> HIGH
    DEFAULT_MEDIUM_THRESHOLD = Decimal('5.0')   # >= 5.0% and < 20.0% -> MEDIUM
    DEFAULT_LOW_THRESHOLD = Decimal('0.0')      # < 5.0% -> LOW

    @classmethod
    def get_thresholds(cls, request=None):
        """
        Retrieves active thresholds, allowing request-level or settings overrides.
        Query params: ?high_threshold=25.0&medium_threshold=10.0
        """
        high = getattr(settings, 'HOTSPOT_HIGH_THRESHOLD', cls.DEFAULT_HIGH_THRESHOLD)
        medium = getattr(settings, 'HOTSPOT_MEDIUM_THRESHOLD', cls.DEFAULT_MEDIUM_THRESHOLD)

        if request and hasattr(request, 'query_params'):
            high_param = request.query_params.get('high_threshold')
            med_param = request.query_params.get('medium_threshold')
            if high_param:
                try:
                    high = Decimal(str(high_param))
                except Exception:
                    pass
            if med_param:
                try:
                    medium = Decimal(str(med_param))
                except Exception:
                    pass

        return {
            'HIGH': high,
            'MEDIUM': medium,
            'LOW': Decimal('0.0')
        }

    @classmethod
    def classify(cls, contribution_pct, thresholds=None):
        """
        Classifies impact as HIGH, MEDIUM, or LOW based on active thresholds.
        """
        if thresholds is None:
            thresholds = {
                'HIGH': cls.DEFAULT_HIGH_THRESHOLD,
                'MEDIUM': cls.DEFAULT_MEDIUM_THRESHOLD
            }

        pct = Decimal(str(contribution_pct))
        if pct >= thresholds['HIGH']:
            return 'HIGH'
        elif pct >= thresholds['MEDIUM']:
            return 'MEDIUM'
        else:
            return 'LOW'


def get_canonical_category(calc):
    """
    Maps calculations into one of the 4 standard categories:
    ELECTRICITY, FUEL, TRANSPORT, MATERIAL.
    """
    cat = (calc.emission_factor.category or '').upper()
    act = (calc.activity_data.activity_type or '').upper()
    combined = f"{cat} {act}"

    if 'ELECTRICITY' in combined or 'SOLAR' in combined or 'GRID' in combined:
        return 'ELECTRICITY'
    elif 'FUEL' in combined or 'GAS' in combined or 'DIESEL' in combined or 'PETROL' in combined or 'COMBUSTION' in combined:
        return 'FUEL'
    elif 'TRANSPORT' in combined or 'LOGISTICS' in combined or 'FREIGHT' in combined or bool(calc.activity_data.transport_mode):
        return 'TRANSPORT'
    elif 'MATERIAL' in combined or 'PROCUREMENT' in combined or 'EXTRACTION' in combined or bool(calc.activity_data.material_type):
        return 'MATERIAL'
    return 'OTHER'


class CarbonHotspotDetector:
    """
    Core rule-based engine that aggregates deduplicated calculation records
    and pinpoints carbon hotspots across all 5 supply chain dimensions.
    """

    def __init__(self, company, reporting_period=None, tier=None, thresholds=None):
        self.company = company
        self.reporting_period = reporting_period
        self.tier = tier
        self.thresholds = thresholds or HotspotConfig.get_thresholds()

        # Retrieve deduplicated calculation records ensuring zero double counting
        self.unique_calcs_dict, self.supplier_tier_map = get_company_calculations(
            company=self.company,
            reporting_period=self.reporting_period,
            tier=self.tier
        )

        # Calculate grand total company emissions
        self.total_co2e_kg = Decimal('0.0000')
        for calc, _ in self.unique_calcs_dict.values():
            self.total_co2e_kg += Decimal(str(calc.co2e_kg))

        self.total_co2e_tonnes = (
            self.total_co2e_kg / Decimal('1000')
        ).quantize(Decimal('0.0001'), rounding=ROUND_HALF_UP)

    def _calc_pct(self, sub_co2e_kg):
        """Helper to calculate percentage of total company footprint."""
        if self.total_co2e_kg <= 0:
            return Decimal('0.00')
        pct = (Decimal(str(sub_co2e_kg)) / self.total_co2e_kg) * Decimal('100')
        return pct.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)

    # -------------------------------------------------------------------------
    # 1. SUPPLIER HOTSPOTS
    # -------------------------------------------------------------------------
    def detect_supplier_hotspots(self, impact_filter=None):
        """
        Identifies highest-emission suppliers, calculates their contribution,
        assigns HIGH/MEDIUM/LOW impact, pinpoints their main emission source,
        and provides an auditable explanation.
        """
        supplier_data = {}

        for calc, s_tier in self.unique_calcs_dict.values():
            supplier = calc.activity_data.supplier
            sid = supplier.id
            if sid not in supplier_data:
                supplier_data[sid] = {
                    'supplier_id': sid,
                    'supplier_name': supplier.name,
                    'supplier_code': supplier.supplier_code,
                    'tier_level': s_tier,
                    'country': supplier.country,
                    'industry_sector': supplier.industry_sector,
                    'co2e_kg': Decimal('0.0000'),
                    'activities': {},
                    'calculations_count': 0,
                    'primary_formulas': set(),
                    'verification_breakdown': {'VERIFIED': 0, 'UNVERIFIED': 0}
                }

            entry = supplier_data[sid]
            co2e = Decimal(str(calc.co2e_kg))
            entry['co2e_kg'] += co2e
            entry['calculations_count'] += 1

            # Track activity breakdown for main source identification
            act_type = calc.activity_data.activity_type.capitalize()
            entry['activities'][act_type] = entry['activities'].get(act_type, Decimal('0.0000')) + co2e

            # Record formula details
            if calc.formula:
                entry['primary_formulas'].add(calc.formula)

            # Verification status
            v_status = calc.activity_data.verification_status
            if v_status in entry['verification_breakdown']:
                entry['verification_breakdown'][v_status] += 1

        # Process and sort suppliers
        results = []
        for sid, s in supplier_data.items():
            co2e_kg = s['co2e_kg']
            co2e_tonnes = (co2e_kg / Decimal('1000')).quantize(Decimal('0.0001'), rounding=ROUND_HALF_UP)
            pct = self._calc_pct(co2e_kg)
            impact = HotspotConfig.classify(pct, self.thresholds)

            # Filter by impact if requested
            if impact_filter and impact != impact_filter.upper():
                continue

            # Determine main emission source
            main_source = "N/A"
            main_act_name = "N/A"
            top_act_co2e = Decimal('0.0000')
            for act_name, act_co2e in s['activities'].items():
                if act_co2e > top_act_co2e:
                    top_act_co2e = act_co2e
                    main_act_name = act_name

            if top_act_co2e > 0 and co2e_kg > 0:
                act_share = ((top_act_co2e / co2e_kg) * Decimal('100')).quantize(Decimal('0.01'))
                main_source = f"{main_act_name} ({act_share}% of supplier footprint)"

            # Construct human-readable, auditable explanation
            explanation = (
                f"{s['supplier_name']} (Tier {s['tier_level']}) contributes {pct}% "
                f"({float(co2e_tonnes):,.2f} tCO2e) of the company's total Scope 3 footprint. "
                f"The predominant emission driver is {main_act_name}, representing "
                f"{float(top_act_co2e / Decimal('1000')):,.2f} tCO2e across "
                f"{s['calculations_count']} auditable calculation records."
            )

            results.append({
                'supplier_id': s['supplier_id'],
                'supplier_name': s['supplier_name'],
                'supplier_code': s['supplier_code'],
                'tier_level': s['tier_level'],
                'country': s['country'],
                'industry_sector': s['industry_sector'],
                'total_emissions_kg': float(co2e_kg),
                'total_emissions_tonnes': float(co2e_tonnes),
                'contribution_pct': float(pct),
                'impact': impact,
                'main_source': main_source,
                'main_activity': main_act_name,
                'calculations_count': s['calculations_count'],
                'explanation': explanation,
                'verification_summary': s['verification_breakdown']
            })

        # Sort descending by emissions
        results.sort(key=lambda x: x['total_emissions_kg'], reverse=True)
        for idx, item in enumerate(results, 1):
            item['rank'] = idx

        return results

    # -------------------------------------------------------------------------
    # 2. TIER HOTSPOTS
    # -------------------------------------------------------------------------
    def detect_tier_hotspots(self):
        """
        Evaluates emissions aggregated by Tier 1, Tier 2, and Tier 3.
        Classifies highest-emission tiers and identifies key contributing drivers.
        """
        tier_names = {
            1: "Tier 1 (Direct Suppliers)",
            2: "Tier 2 (Sub-contractors)",
            3: "Tier 3 (Raw Materials / Extraction)"
        }
        tier_data = {t: {
            'co2e_kg': Decimal('0.0000'),
            'suppliers': set(),
            'activities': {}
        } for t in (1, 2, 3)}

        for calc, s_tier in self.unique_calcs_dict.values():
            if s_tier not in tier_data:
                continue
            co2e = Decimal(str(calc.co2e_kg))
            tier_data[s_tier]['co2e_kg'] += co2e
            tier_data[s_tier]['suppliers'].add(calc.activity_data.supplier.name)

            act_type = calc.activity_data.activity_type.capitalize()
            tier_data[s_tier]['activities'][act_type] = (
                tier_data[s_tier]['activities'].get(act_type, Decimal('0.0000')) + co2e
            )

        results = []
        for t in (1, 2, 3):
            co2e_kg = tier_data[t]['co2e_kg']
            co2e_tonnes = (co2e_kg / Decimal('1000')).quantize(Decimal('0.0001'), rounding=ROUND_HALF_UP)
            pct = self._calc_pct(co2e_kg)
            impact = HotspotConfig.classify(pct, self.thresholds)

            # Main activity driver
            main_source = "None"
            top_act_co2e = Decimal('0.0000')
            for act_name, act_co2e in tier_data[t]['activities'].items():
                if act_co2e > top_act_co2e:
                    top_act_co2e = act_co2e
                    main_source = act_name

            explanation = (
                f"{tier_names[t]} accounts for {pct}% ({float(co2e_tonnes):,.2f} tCO2e) "
                f"of enterprise emissions across {len(tier_data[t]['suppliers'])} suppliers. "
                f"Primary emission source: {main_source}."
            )

            results.append({
                'tier': t,
                'tier_name': tier_names[t],
                'total_emissions_kg': float(co2e_kg),
                'total_emissions_tonnes': float(co2e_tonnes),
                'contribution_pct': float(pct),
                'impact': impact,
                'main_source': main_source,
                'supplier_count': len(tier_data[t]['suppliers']),
                'suppliers': sorted(list(tier_data[t]['suppliers'])),
                'explanation': explanation
            })

        results.sort(key=lambda x: x['total_emissions_kg'], reverse=True)
        for idx, item in enumerate(results, 1):
            item['rank'] = idx

        return results

    # -------------------------------------------------------------------------
    # 3. ACTIVITY HOTSPOTS
    # -------------------------------------------------------------------------
    def detect_activity_hotspots(self):
        """
        Ranks highest-emission activity categories:
        Electricity, Fuel, Transport, Material.
        """
        activity_categories = {
            'MATERIAL': 'Raw Materials & Purchased Goods',
            'ELECTRICITY': 'Electricity Consumption',
            'FUEL': 'Fuel & Thermal Energy',
            'TRANSPORT': 'Freight Transportation & Logistics'
        }
        act_data = {k: {
            'co2e_kg': Decimal('0.0000'),
            'record_count': 0,
            'top_supplier': None,
            'supplier_shares': {}
        } for k in activity_categories}

        for calc, _ in self.unique_calcs_dict.values():
            atype = get_canonical_category(calc)
            if atype not in act_data:
                continue

            co2e = Decimal(str(calc.co2e_kg))
            act_data[atype]['co2e_kg'] += co2e
            act_data[atype]['record_count'] += 1

            sname = calc.activity_data.supplier.name
            act_data[atype]['supplier_shares'][sname] = (
                act_data[atype]['supplier_shares'].get(sname, Decimal('0.0000')) + co2e
            )

        results = []
        for atype, data in act_data.items():
            co2e_kg = data['co2e_kg']
            co2e_tonnes = (co2e_kg / Decimal('1000')).quantize(Decimal('0.0001'), rounding=ROUND_HALF_UP)
            pct = self._calc_pct(co2e_kg)
            impact = HotspotConfig.classify(pct, self.thresholds)

            # Find top supplier contributor for this activity
            top_supplier = "None"
            top_supp_co2e = Decimal('0.0000')
            for sname, sco2e in data['supplier_shares'].items():
                if sco2e > top_supp_co2e:
                    top_supp_co2e = sco2e
                    top_supplier = sname

            main_source = f"Top contributor: {top_supplier}"
            if top_supp_co2e > 0 and co2e_kg > 0:
                s_pct = ((top_supp_co2e / co2e_kg) * Decimal('100')).quantize(Decimal('0.01'))
                main_source += f" ({s_pct}% of activity)"

            explanation = (
                f"{activity_categories[atype]} represents {pct}% ({float(co2e_tonnes):,.2f} tCO2e) "
                f"of Scope 3 emissions across {data['record_count']} activity entries. "
                f"The highest emission source within this activity is {top_supplier}."
            )

            results.append({
                'activity_code': atype,
                'activity_name': activity_categories[atype],
                'total_emissions_kg': float(co2e_kg),
                'total_emissions_tonnes': float(co2e_tonnes),
                'contribution_pct': float(pct),
                'impact': impact,
                'main_source': main_source,
                'record_count': data['record_count'],
                'top_supplier': top_supplier,
                'explanation': explanation
            })

        results.sort(key=lambda x: x['total_emissions_kg'], reverse=True)
        for idx, item in enumerate(results, 1):
            item['rank'] = idx

        return results

    # -------------------------------------------------------------------------
    # 4. MATERIAL HOTSPOTS
    # -------------------------------------------------------------------------
    def detect_material_hotspots(self):
        """
        Identifies highest-emission materials (e.g. Aluminium, Steel, Lithium),
        quantities consumed, supplying entities, and contribution shares.
        """
        material_data = {}
        total_material_co2e = Decimal('0.0000')

        for calc, _ in self.unique_calcs_dict.values():
            is_material = (
                get_canonical_category(calc) == 'MATERIAL'
                or bool(calc.activity_data.material_type)
            )
            if not is_material:
                continue

            co2e = Decimal(str(calc.co2e_kg))
            total_material_co2e += co2e

            mtype = (calc.activity_data.material_type or '').strip()
            if not mtype and calc.emission_factor:
                mtype = calc.emission_factor.activity_name
            if not mtype:
                mtype = "Raw Material"

            if mtype not in material_data:
                material_data[mtype] = {
                    'material_name': mtype,
                    'co2e_kg': Decimal('0.0000'),
                    'quantity_kg': Decimal('0.0000'),
                    'suppliers': set(),
                    'emission_factors': set()
                }

            entry = material_data[mtype]
            entry['co2e_kg'] += co2e

            # Standardize quantity in kg
            raw_qty = Decimal(str(calc.activity_data.quantity or 0))
            unit = (calc.activity_data.unit or '').lower()
            if unit in ('tonne', 'tonnes', 't', 'metric ton'):
                raw_qty *= Decimal('1000')
            entry['quantity_kg'] += raw_qty

            entry['suppliers'].add(calc.activity_data.supplier.name)
            if calc.emission_factor:
                entry['emission_factors'].add(calc.emission_factor.activity_name)

        results = []
        for mname, data in material_data.items():
            co2e_kg = data['co2e_kg']
            co2e_tonnes = (co2e_kg / Decimal('1000')).quantize(Decimal('0.0001'), rounding=ROUND_HALF_UP)
            pct_company = self._calc_pct(co2e_kg)
            impact = HotspotConfig.classify(pct_company, self.thresholds)

            pct_material = Decimal('0.00')
            if total_material_co2e > 0:
                pct_material = ((co2e_kg / total_material_co2e) * Decimal('100')).quantize(Decimal('0.01'))

            suppliers_list = sorted(list(data['suppliers']))
            main_source = f"Supplied by: {', '.join(suppliers_list[:2])}"

            explanation = (
                f"Material '{mname}' generates {pct_company}% ({float(co2e_tonnes):,.2f} tCO2e) "
                f"of enterprise emissions ({pct_material}% of all purchased materials). "
                f"Volume consumed: {float(data['quantity_kg']):,.1f} kg across {len(suppliers_list)} supplier(s)."
            )

            results.append({
                'material_name': mname,
                'total_emissions_kg': float(co2e_kg),
                'total_emissions_tonnes': float(co2e_tonnes),
                'contribution_pct': float(pct_company),
                'material_share_pct': float(pct_material),
                'impact': impact,
                'main_source': main_source,
                'total_quantity_kg': float(data['quantity_kg']),
                'supplier_count': len(suppliers_list),
                'suppliers': suppliers_list,
                'emission_factors': sorted(list(data['emission_factors'])),
                'explanation': explanation
            })

        results.sort(key=lambda x: x['total_emissions_kg'], reverse=True)
        for idx, item in enumerate(results, 1):
            item['rank'] = idx

        return results

    # -------------------------------------------------------------------------
    # 5. TRANSPORT MODE HOTSPOTS
    # -------------------------------------------------------------------------
    def detect_transport_hotspots(self):
        """
        Identifies highest-emission transport modes (Road, Rail, Sea, Air),
        calculating tonne-km, average distances, and emission shares.
        """
        transport_data = {}
        total_transport_co2e = Decimal('0.0000')

        for calc, _ in self.unique_calcs_dict.values():
            is_transport = (
                get_canonical_category(calc) == 'TRANSPORT'
                or bool(calc.activity_data.transport_mode)
            )
            if not is_transport:
                continue

            co2e = Decimal(str(calc.co2e_kg))
            total_transport_co2e += co2e

            mode = (calc.activity_data.transport_mode or '').capitalize().strip() or "Road"
            if mode not in transport_data:
                transport_data[mode] = {
                    'transport_mode': mode,
                    'co2e_kg': Decimal('0.0000'),
                    'distance_km': Decimal('0.0000'),
                    'weight_tonnes': Decimal('0.0000'),
                    'shipment_count': 0,
                    'suppliers': set()
                }

            entry = transport_data[mode]
            entry['co2e_kg'] += co2e
            entry['shipment_count'] += 1

            if calc.activity_data.distance:
                entry['distance_km'] += Decimal(str(calc.activity_data.distance))
            if calc.activity_data.shipment_weight:
                entry['weight_tonnes'] += Decimal(str(calc.activity_data.shipment_weight))

            entry['suppliers'].add(calc.activity_data.supplier.name)

        results = []
        for mode, data in transport_data.items():
            co2e_kg = data['co2e_kg']
            co2e_tonnes = (co2e_kg / Decimal('1000')).quantize(Decimal('0.0001'), rounding=ROUND_HALF_UP)
            pct_company = self._calc_pct(co2e_kg)
            impact = HotspotConfig.classify(pct_company, self.thresholds)

            pct_transport = Decimal('0.00')
            if total_transport_co2e > 0:
                pct_transport = ((co2e_kg / total_transport_co2e) * Decimal('100')).quantize(Decimal('0.01'))

            suppliers_list = sorted(list(data['suppliers']))
            tonne_km = (data['distance_km'] * data['weight_tonnes']).quantize(Decimal('0.01'))
            main_source = f"{data['shipment_count']} shipments ({float(data['distance_km']):,.1f} total km)"

            explanation = (
                f"Transport mode '{mode}' accounts for {pct_company}% ({float(co2e_tonnes):,.2f} tCO2e) "
                f"of total footprint ({pct_transport}% of all logistics). "
                f"Total distance covered: {float(data['distance_km']):,.1f} km across {data['shipment_count']} shipments."
            )

            results.append({
                'transport_mode': mode,
                'total_emissions_kg': float(co2e_kg),
                'total_emissions_tonnes': float(co2e_tonnes),
                'contribution_pct': float(pct_company),
                'transport_share_pct': float(pct_transport),
                'impact': impact,
                'main_source': main_source,
                'total_distance_km': float(data['distance_km']),
                'total_weight_tonnes': float(data['weight_tonnes']),
                'total_tonne_km': float(tonne_km),
                'shipment_count': data['shipment_count'],
                'suppliers': suppliers_list,
                'explanation': explanation
            })

        results.sort(key=lambda x: x['total_emissions_kg'], reverse=True)
        for idx, item in enumerate(results, 1):
            item['rank'] = idx

        return results

    # -------------------------------------------------------------------------
    # MASTER OVERVIEW & CHART DATA
    # -------------------------------------------------------------------------
    def get_full_overview(self):
        """
        Consolidates hotspots across all 5 dimensions into a master dashboard payload.
        """
        suppliers = self.detect_supplier_hotspots()
        tiers = self.detect_tier_hotspots()
        activities = self.detect_activity_hotspots()
        materials = self.detect_material_hotspots()
        transport = self.detect_transport_hotspots()

        # Count severity distribution across suppliers
        high_count = sum(1 for s in suppliers if s['impact'] == 'HIGH')
        medium_count = sum(1 for s in suppliers if s['impact'] == 'MEDIUM')
        low_count = sum(1 for s in suppliers if s['impact'] == 'LOW')

        # Build Chart.js formatted visual datasets
        # 1. Top 5 Suppliers Bar Chart
        top_5_suppliers = suppliers[:5]
        supplier_labels = [s['supplier_name'] for s in top_5_suppliers]
        supplier_values = [s['total_emissions_tonnes'] for s in top_5_suppliers]
        supplier_colors = [
            '#ef4444' if s['impact'] == 'HIGH' else '#f59e0b' if s['impact'] == 'MEDIUM' else '#3b82f6'
            for s in top_5_suppliers
        ]
        supplier_chart = build_chart_format(
            labels=supplier_labels,
            data=supplier_values,
            unit="tCO2e",
            chart_type="bar",
            colors=supplier_colors
        )

        # 2. Activity Breakdown Pie Chart
        act_labels = [a['activity_name'] for a in activities]
        act_values = [a['total_emissions_tonnes'] for a in activities]
        activity_chart = build_chart_format(
            labels=act_labels,
            data=act_values,
            unit="tCO2e",
            chart_type="doughnut"
        )

        return {
            'summary': {
                'total_company_emissions_kg': float(self.total_co2e_kg),
                'total_company_emissions_tonnes': float(self.total_co2e_tonnes),
                'reporting_period': self.reporting_period or 'All Periods',
                'active_suppliers_analyzed': len(suppliers),
                'hotspots_detected': {
                    'high_count': high_count,
                    'medium_count': medium_count,
                    'low_count': low_count,
                    'total': len(suppliers)
                },
                'thresholds_applied': {
                    'high_threshold_pct': float(self.thresholds['HIGH']),
                    'medium_threshold_pct': float(self.thresholds['MEDIUM']),
                    'classification_rule': f"HIGH >= {self.thresholds['HIGH']}%, MEDIUM >= {self.thresholds['MEDIUM']}%, LOW < {self.thresholds['MEDIUM']}%"
                }
            },
            'highest_emission_suppliers': suppliers,
            'highest_emission_tiers': tiers,
            'highest_emission_activities': activities,
            'highest_emission_materials': materials,
            'highest_emission_transport_modes': transport,
            'charts': {
                'top_suppliers_chart': supplier_chart,
                'activity_distribution_chart': activity_chart
            }
        }

    # -------------------------------------------------------------------------
    # PERSISTENCE / SYNC TO DATABASE
    # -------------------------------------------------------------------------
    def sync_to_database(self):
        """
        Synchronizes detected supplier hotspots to the persistent `Hotspot`
        database model in SQLite for historical tracking and recommendations.
        """
        suppliers = self.detect_supplier_hotspots()
        synced_count = 0
        today = date.today()

        for s in suppliers:
            # Only persist HIGH and MEDIUM hotspots to prevent database clutter
            if s['impact'] not in ('HIGH', 'MEDIUM'):
                continue

            try:
                supplier_obj = Supplier.objects.get(id=s['supplier_id'])
            except Supplier.DoesNotExist:
                continue

            # Update or create hotspot entry
            hotspot_obj, created = Hotspot.objects.update_or_create(
                company=self.company,
                supplier=supplier_obj,
                defaults={
                    'tier_level': s['tier_level'],
                    'emission_category': s['main_activity'],
                    'total_co2e_tonnes': Decimal(str(s['total_emissions_tonnes'])),
                    'contribution_pct': Decimal(str(s['contribution_pct'])),
                    'severity': s['impact'],
                    'identified_date': today,
                    'status': 'OPEN'
                }
            )
            synced_count += 1

        return synced_count
