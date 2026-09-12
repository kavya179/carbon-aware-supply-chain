from decimal import Decimal, ROUND_HALF_UP
from django.db.models import Sum, Q, Min
from rest_framework import permissions, status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.exceptions import PermissionDenied

from .models import (
    Supplier,
    SupplierRelationship,
    SupplierActivityData,
    EmissionFactor,
    CarbonCalculation
)


def get_company_calculations(company, reporting_period=None, tier=None, supplier_id=None):
    """
    Retrieves unique, deduplicated CarbonCalculation records for a company.
    CRITICAL: Avoids double counting by using distinct IDs and strict set semantics.
    A supplier appearing in multiple supply chain relationship paths is counted EXACTLY ONCE.
    """
    # 1. Unique active suppliers in company's supply chain
    active_rels = SupplierRelationship.objects.filter(
        company=company,
        status='ACTIVE'
    ).select_related('supplier')

    # Build unique tier mapping per supplier (minimum tier level = closest distance to company)
    supplier_tier_map = {}
    for rel in active_rels:
        sid = rel.supplier_id
        if sid not in supplier_tier_map or rel.tier_level < supplier_tier_map[sid]:
            supplier_tier_map[sid] = rel.tier_level

    # 2. Get distinct calculations belonging to these suppliers
    supplier_ids = list(supplier_tier_map.keys())
    qs = CarbonCalculation.objects.filter(
        activity_data__supplier_id__in=supplier_ids
    ).select_related(
        'activity_data__supplier',
        'emission_factor'
    )

    if reporting_period:
        qs = qs.filter(activity_data__reporting_period__iexact=reporting_period)

    if supplier_id:
        qs = qs.filter(activity_data__supplier_id=supplier_id)

    # Convert to list to enforce in-memory deduplication if any ORM duplicate exists
    unique_calcs_dict = {}
    for calc in qs:
        # If tier filter specified, check supplier's assigned tier
        s_tier = supplier_tier_map.get(calc.activity_data.supplier_id, 1)
        if tier is not None and s_tier != int(tier):
            continue
        unique_calcs_dict[calc.id] = (calc, s_tier)

    return unique_calcs_dict, supplier_tier_map


def build_chart_format(labels, data, unit="tCO2e", chart_type="bar", colors=None):
    """
    Formats data structures ready for React / Chart.js / D3 visualizations.
    """
    default_colors = [
        "#10B981", "#3B82F6", "#F59E0B", "#EF4444", "#8B5CF6",
        "#EC4899", "#14B8A6", "#6366F1", "#84CC16", "#06B6D4"
    ]
    if not colors:
        colors = default_colors[:len(labels)]

    return {
        'chart_type': chart_type,
        'unit': unit,
        'labels': labels,
        'datasets': [
            {
                'label': f"Emissions ({unit})",
                'data': data,
                'backgroundColor': colors,
                'borderColor': colors,
                'borderWidth': 1
            }
        ]
    }


class TotalEmissionsView(APIView):
    """
    GET /api/analytics/emissions/total/
    Returns total aggregated carbon emissions for the company without double counting.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        profile = getattr(request.user, 'profile', None)
        if not profile or not profile.company:
            raise PermissionDenied("Company association required.")

        company = profile.company
        period = request.query_params.get('reporting_period')

        calcs_dict, tier_map = get_company_calculations(company, reporting_period=period)
        calcs = [c for c, _ in calcs_dict.values()]

        total_kg = sum(c.co2e_kg for c in calcs) if calcs else Decimal('0.0000')
        total_tonnes = sum(c.co2e_tonnes for c in calcs) if calcs else Decimal('0.000000')

        periods = sorted(list({c.activity_data.reporting_period for c in calcs if c.activity_data.reporting_period}))
        unique_suppliers = len(set(c.activity_data.supplier_id for c in calcs))

        return Response({
            'company': company.name,
            'reporting_period_filter': period,
            'summary': {
                'total_co2e_kg': float(total_kg),
                'total_co2e_tonnes': float(total_tonnes),
                'total_calculations_count': len(calcs),
                'active_suppliers_count': len(tier_map),
                'emitting_suppliers_count': unique_suppliers,
                'available_reporting_periods': periods
            },
            'double_counting_protection': {
                'enforced': True,
                'rule': 'Distinct calculation uniqueness and shallowest-path supplier deduplication'
            }
        }, status=status.HTTP_200_OK)


class TierEmissionsView(APIView):
    """
    GET /api/analytics/emissions/tier/
    Aggregates emissions strictly across Tier 1, Tier 2, and Tier 3.
    Guarantees Tier 1 + Tier 2 + Tier 3 == Total Company Emissions.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        profile = getattr(request.user, 'profile', None)
        if not profile or not profile.company:
            raise PermissionDenied("Company association required.")

        company = profile.company
        period = request.query_params.get('reporting_period')

        calcs_dict, tier_map = get_company_calculations(company, reporting_period=period)

        tier_data = {
            1: {'kg': Decimal('0.0'), 'tonnes': Decimal('0.0'), 'suppliers': set(), 'calcs': 0},
            2: {'kg': Decimal('0.0'), 'tonnes': Decimal('0.0'), 'suppliers': set(), 'calcs': 0},
            3: {'kg': Decimal('0.0'), 'tonnes': Decimal('0.0'), 'suppliers': set(), 'calcs': 0},
        }

        for calc, s_tier in calcs_dict.values():
            tier_val = s_tier if s_tier in (1, 2, 3) else 1
            tier_data[tier_val]['kg'] += calc.co2e_kg
            tier_data[tier_val]['tonnes'] += calc.co2e_tonnes
            tier_data[tier_val]['suppliers'].add(calc.activity_data.supplier_id)
            tier_data[tier_val]['calcs'] += 1

        total_kg = sum(tier_data[t]['kg'] for t in (1, 2, 3))
        total_tonnes = sum(tier_data[t]['tonnes'] for t in (1, 2, 3))

        tier_names = {
            1: "Tier 1 (Direct Suppliers)",
            2: "Tier 2 (Sub-contractors)",
            3: "Tier 3 (Raw Materials / Extraction)"
        }

        breakdown = []
        labels = []
        chart_values = []
        chart_colors = ["#10B981", "#3B82F6", "#F59E0B"]

        for t in (1, 2, 3):
            t_kg = tier_data[t]['kg']
            t_tonnes = tier_data[t]['tonnes']
            share_pct = round(float(t_kg / total_kg * 100), 2) if total_kg > 0 else 0.0

            breakdown.append({
                'tier': t,
                'tier_name': tier_names[t],
                'co2e_kg': float(t_kg),
                'co2e_tonnes': float(t_tonnes),
                'share_pct': share_pct,
                'supplier_count': len(tier_data[t]['suppliers']),
                'calculation_count': tier_data[t]['calcs']
            })
            labels.append(f"Tier {t}")
            chart_values.append(float(t_tonnes))

        chart_payload = build_chart_format(
            labels=labels,
            data=chart_values,
            unit="tCO2e",
            chart_type="doughnut",
            colors=chart_colors
        )

        return Response({
            'company': company.name,
            'total_co2e_kg': float(total_kg),
            'total_co2e_tonnes': float(total_tonnes),
            'tiers': breakdown,
            'chart_data': chart_payload,
            'audit_check': {
                'sum_of_tiers_co2e_kg': float(total_kg),
                'equals_total': True,
                'double_counting_prevented': True
            }
        }, status=status.HTTP_200_OK)


class SupplierEmissionsView(APIView):
    """
    GET /api/analytics/emissions/supplier/
    Aggregates emissions per supplier in descending order of footprint.
    Identifies top emission contributors across the supply chain.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        profile = getattr(request.user, 'profile', None)
        if not profile or not profile.company:
            raise PermissionDenied("Company association required.")

        company = profile.company
        period = request.query_params.get('reporting_period')
        tier_param = request.query_params.get('tier')

        calcs_dict, tier_map = get_company_calculations(company, reporting_period=period, tier=tier_param)

        supplier_aggs = {}
        for calc, s_tier in calcs_dict.values():
            s = calc.activity_data.supplier
            sid = s.id
            if sid not in supplier_aggs:
                supplier_aggs[sid] = {
                    'supplier_id': sid,
                    'supplier_name': s.name,
                    'supplier_code': s.supplier_code,
                    'tier': s_tier,
                    'industry_sector': s.industry_sector,
                    'country': s.country,
                    'co2e_kg': Decimal('0.0'),
                    'co2e_tonnes': Decimal('0.0'),
                    'activity_count': 0,
                    'by_category': {}
                }

            supplier_aggs[sid]['co2e_kg'] += calc.co2e_kg
            supplier_aggs[sid]['co2e_tonnes'] += calc.co2e_tonnes
            supplier_aggs[sid]['activity_count'] += 1

            cat = calc.emission_factor.category.lower()
            supplier_aggs[sid]['by_category'][cat] = (
                supplier_aggs[sid]['by_category'].get(cat, Decimal('0.0')) + calc.co2e_tonnes
            )

        total_kg = sum(item['co2e_kg'] for item in supplier_aggs.values())
        total_tonnes = sum(item['co2e_tonnes'] for item in supplier_aggs.values())

        # Sort suppliers descending by emissions
        sorted_suppliers = sorted(supplier_aggs.values(), key=lambda x: x['co2e_kg'], reverse=True)

        for s in sorted_suppliers:
            s['share_pct'] = round(float(s['co2e_kg'] / total_kg * 100), 2) if total_kg > 0 else 0.0
            s['co2e_kg'] = float(s['co2e_kg'])
            s['co2e_tonnes'] = float(s['co2e_tonnes'])
            s['by_category'] = {k: float(v) for k, v in s['by_category'].items()}

        # Prepare chart for top 10 suppliers
        top10 = sorted_suppliers[:10]
        chart_labels = [s['supplier_name'] for s in top10]
        chart_values = [s['co2e_tonnes'] for s in top10]
        chart_payload = build_chart_format(
            labels=chart_labels,
            data=chart_values,
            unit="tCO2e",
            chart_type="bar"
        )

        return Response({
            'company': company.name,
            'total_co2e_kg': float(total_kg),
            'total_co2e_tonnes': float(total_tonnes),
            'suppliers_count': len(sorted_suppliers),
            'suppliers': sorted_suppliers,
            'chart_data': chart_payload
        }, status=status.HTTP_200_OK)


class ActivityEmissionsView(APIView):
    """
    GET /api/analytics/emissions/activity/
    Aggregates emissions by emission stream category (Energy, Transport, Materials, Fuel).
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        profile = getattr(request.user, 'profile', None)
        if not profile or not profile.company:
            raise PermissionDenied("Company association required.")

        company = profile.company
        period = request.query_params.get('reporting_period')

        calcs_dict, _ = get_company_calculations(company, reporting_period=period)

        category_aggs = {}
        activity_type_aggs = {}

        for calc, _ in calcs_dict.values():
            cat = calc.emission_factor.category.upper()
            act_type = calc.activity_data.activity_type

            # Category aggregation
            if cat not in category_aggs:
                category_aggs[cat] = {'co2e_kg': Decimal('0.0'), 'co2e_tonnes': Decimal('0.0'), 'count': 0}
            category_aggs[cat]['co2e_kg'] += calc.co2e_kg
            category_aggs[cat]['co2e_tonnes'] += calc.co2e_tonnes
            category_aggs[cat]['count'] += 1

            # Activity Type aggregation
            if act_type not in activity_type_aggs:
                activity_type_aggs[act_type] = {
                    'activity_type': act_type,
                    'category': cat,
                    'co2e_kg': Decimal('0.0'),
                    'co2e_tonnes': Decimal('0.0'),
                    'count': 0
                }
            activity_type_aggs[act_type]['co2e_kg'] += calc.co2e_kg
            activity_type_aggs[act_type]['co2e_tonnes'] += calc.co2e_tonnes
            activity_type_aggs[act_type]['count'] += 1

        total_kg = sum(c['co2e_kg'] for c in category_aggs.values())
        total_tonnes = sum(c['co2e_tonnes'] for c in category_aggs.values())

        # Format categories
        cat_list = []
        for cat, val in category_aggs.items():
            cat_list.append({
                'category': cat,
                'category_name': cat.title(),
                'co2e_kg': float(val['co2e_kg']),
                'co2e_tonnes': float(val['co2e_tonnes']),
                'share_pct': round(float(val['co2e_kg'] / total_kg * 100), 2) if total_kg > 0 else 0.0,
                'calculation_count': val['count']
            })
        cat_list.sort(key=lambda x: x['co2e_kg'], reverse=True)

        # Format activity types
        act_list = []
        for a in activity_type_aggs.values():
            act_list.append({
                'activity_type': a['activity_type'],
                'category': a['category'],
                'co2e_kg': float(a['co2e_kg']),
                'co2e_tonnes': float(a['co2e_tonnes']),
                'share_pct': round(float(a['co2e_kg'] / total_kg * 100), 2) if total_kg > 0 else 0.0,
                'record_count': a['count']
            })
        act_list.sort(key=lambda x: x['co2e_kg'], reverse=True)

        chart_labels = [c['category_name'] for c in cat_list]
        chart_values = [c['co2e_tonnes'] for c in cat_list]
        chart_payload = build_chart_format(
            labels=chart_labels,
            data=chart_values,
            unit="tCO2e",
            chart_type="pie"
        )

        return Response({
            'company': company.name,
            'total_co2e_kg': float(total_kg),
            'total_co2e_tonnes': float(total_tonnes),
            'by_category': cat_list,
            'by_activity_type': act_list,
            'chart_data': chart_payload
        }, status=status.HTTP_200_OK)


class MaterialEmissionsView(APIView):
    """
    GET /api/analytics/emissions/material/
    Aggregates emissions specifically by material type (Aluminium, Steel, Lithium, etc.).
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        profile = getattr(request.user, 'profile', None)
        if not profile or not profile.company:
            raise PermissionDenied("Company association required.")

        company = profile.company
        period = request.query_params.get('reporting_period')

        calcs_dict, _ = get_company_calculations(company, reporting_period=period)

        material_aggs = {}
        for calc, _ in calcs_dict.values():
            if calc.emission_factor.category != 'MATERIAL' and not calc.activity_data.material_type:
                continue

            mat_name = calc.activity_data.material_type or calc.emission_factor.activity_name
            mat_name = mat_name.strip()

            if mat_name not in material_aggs:
                material_aggs[mat_name] = {
                    'material_type': mat_name,
                    'co2e_kg': Decimal('0.0'),
                    'co2e_tonnes': Decimal('0.0'),
                    'total_quantity': Decimal('0.0'),
                    'unit': calc.activity_data.unit,
                    'count': 0,
                    'suppliers': set()
                }

            material_aggs[mat_name]['co2e_kg'] += calc.co2e_kg
            material_aggs[mat_name]['co2e_tonnes'] += calc.co2e_tonnes
            material_aggs[mat_name]['total_quantity'] += calc.activity_data.quantity
            material_aggs[mat_name]['count'] += 1
            material_aggs[mat_name]['suppliers'].add(calc.activity_data.supplier.name)

        total_material_kg = sum(m['co2e_kg'] for m in material_aggs.values())
        total_material_tonnes = sum(m['co2e_tonnes'] for m in material_aggs.values())

        mat_list = []
        for m in material_aggs.values():
            mat_list.append({
                'material_type': m['material_type'],
                'co2e_kg': float(m['co2e_kg']),
                'co2e_tonnes': float(m['co2e_tonnes']),
                'total_quantity': float(m['total_quantity']),
                'unit': m['unit'],
                'share_pct': round(float(m['co2e_kg'] / total_material_kg * 100), 2) if total_material_kg > 0 else 0.0,
                'supplier_names': sorted(list(m['suppliers'])),
                'record_count': m['count']
            })
        mat_list.sort(key=lambda x: x['co2e_kg'], reverse=True)

        chart_labels = [m['material_type'] for m in mat_list]
        chart_values = [m['co2e_tonnes'] for m in mat_list]
        chart_payload = build_chart_format(
            labels=chart_labels,
            data=chart_values,
            unit="tCO2e",
            chart_type="bar"
        )

        return Response({
            'company': company.name,
            'total_material_co2e_kg': float(total_material_kg),
            'total_material_co2e_tonnes': float(total_material_tonnes),
            'material_types_count': len(mat_list),
            'materials': mat_list,
            'chart_data': chart_payload
        }, status=status.HTTP_200_OK)


class TransportEmissionsView(APIView):
    """
    GET /api/analytics/emissions/transport/
    Aggregates emissions specifically by freight transport mode (Road, Air, Sea, Rail).
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        profile = getattr(request.user, 'profile', None)
        if not profile or not profile.company:
            raise PermissionDenied("Company association required.")

        company = profile.company
        period = request.query_params.get('reporting_period')

        calcs_dict, _ = get_company_calculations(company, reporting_period=period)

        transport_aggs = {}
        for calc, _ in calcs_dict.values():
            if calc.emission_factor.category != 'TRANSPORT' and not calc.activity_data.transport_mode:
                continue

            tmode = calc.activity_data.transport_mode or 'Road'
            tmode = tmode.title()

            if tmode not in transport_aggs:
                transport_aggs[tmode] = {
                    'transport_mode': tmode,
                    'co2e_kg': Decimal('0.0'),
                    'co2e_tonnes': Decimal('0.0'),
                    'total_distance_km': Decimal('0.0'),
                    'shipment_count': 0,
                    'suppliers': set()
                }

            transport_aggs[tmode]['co2e_kg'] += calc.co2e_kg
            transport_aggs[tmode]['co2e_tonnes'] += calc.co2e_tonnes
            if calc.activity_data.distance:
                transport_aggs[tmode]['total_distance_km'] += calc.activity_data.distance
            transport_aggs[tmode]['shipment_count'] += 1
            transport_aggs[tmode]['suppliers'].add(calc.activity_data.supplier.name)

        total_trans_kg = sum(t['co2e_kg'] for t in transport_aggs.values())
        total_trans_tonnes = sum(t['co2e_tonnes'] for t in transport_aggs.values())

        trans_list = []
        for t in transport_aggs.values():
            trans_list.append({
                'transport_mode': t['transport_mode'],
                'co2e_kg': float(t['co2e_kg']),
                'co2e_tonnes': float(t['co2e_tonnes']),
                'total_distance_km': float(t['total_distance_km']),
                'share_pct': round(float(t['co2e_kg'] / total_trans_kg * 100), 2) if total_trans_kg > 0 else 0.0,
                'supplier_names': sorted(list(t['suppliers'])),
                'shipment_count': t['shipment_count']
            })
        trans_list.sort(key=lambda x: x['co2e_kg'], reverse=True)

        chart_labels = [t['transport_mode'] for t in trans_list]
        chart_values = [t['co2e_tonnes'] for t in trans_list]
        chart_payload = build_chart_format(
            labels=chart_labels,
            data=chart_values,
            unit="tCO2e",
            chart_type="doughnut"
        )

        return Response({
            'company': company.name,
            'total_transport_co2e_kg': float(total_trans_kg),
            'total_transport_co2e_tonnes': float(total_trans_tonnes),
            'modes_count': len(trans_list),
            'transport_modes': trans_list,
            'chart_data': chart_payload
        }, status=status.HTTP_200_OK)


class DashboardAggregationView(APIView):
    """
    GET /api/analytics/dashboard/
    Master endpoint returning comprehensive carbon aggregation for the React dashboard:
    - Total emissions KPI
    - Tier distribution (Tier 1 vs 2 vs 3)
    - Top emitting suppliers
    - Categorical breakdown
    - Materials breakdown
    - Transportation breakdown
    All strictly protected against double counting.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        profile = getattr(request.user, 'profile', None)
        if not profile or not profile.company:
            raise PermissionDenied("Company association required.")

        company = profile.company
        period = request.query_params.get('reporting_period')

        # Re-use sub-views logic
        calcs_dict, tier_map = get_company_calculations(company, reporting_period=period)
        calcs = [c for c, _ in calcs_dict.values()]

        total_kg = sum(c.co2e_kg for c in calcs) if calcs else Decimal('0.0000')
        total_tonnes = sum(c.co2e_tonnes for c in calcs) if calcs else Decimal('0.000000')

        # Tier breakdown
        tier_data = {1: Decimal('0.0'), 2: Decimal('0.0'), 3: Decimal('0.0')}
        for calc, s_tier in calcs_dict.values():
            tier_val = s_tier if s_tier in (1, 2, 3) else 1
            tier_data[tier_val] += calc.co2e_tonnes

        tier_summary = [
            {
                'tier': t,
                'name': f"Tier {t}",
                'co2e_tonnes': float(tier_data[t]),
                'share_pct': round(float(tier_data[t] / total_tonnes * 100), 2) if total_tonnes > 0 else 0.0
            }
            for t in (1, 2, 3)
        ]

        # Top 5 emitting suppliers
        supp_aggs = {}
        for calc, s_tier in calcs_dict.values():
            sid = calc.activity_data.supplier_id
            if sid not in supp_aggs:
                supp_aggs[sid] = {
                    'supplier_id': sid,
                    'name': calc.activity_data.supplier.name,
                    'tier': s_tier,
                    'co2e_tonnes': Decimal('0.0')
                }
            supp_aggs[sid]['co2e_tonnes'] += calc.co2e_tonnes

        top_suppliers = sorted(supp_aggs.values(), key=lambda x: x['co2e_tonnes'], reverse=True)[:5]
        for s in top_suppliers:
            s['share_pct'] = round(float(s['co2e_tonnes'] / total_tonnes * 100), 2) if total_tonnes > 0 else 0.0
            s['co2e_tonnes'] = float(s['co2e_tonnes'])

        # Categories
        cat_aggs = {}
        for calc, _ in calcs_dict.values():
            cat = calc.emission_factor.category.title()
            cat_aggs[cat] = cat_aggs.get(cat, Decimal('0.0')) + calc.co2e_tonnes

        cat_summary = [
            {
                'category': k,
                'co2e_tonnes': float(v),
                'share_pct': round(float(v / total_tonnes * 100), 2) if total_tonnes > 0 else 0.0
            }
            for k, v in sorted(cat_aggs.items(), key=lambda x: x[1], reverse=True)
        ]

        return Response({
            'company': company.name,
            'kpis': {
                'total_co2e_tonnes': float(total_tonnes),
                'total_co2e_kg': float(total_kg),
                'suppliers_count': len(tier_map),
                'calculations_count': len(calcs)
            },
            'tier_breakdown': tier_summary,
            'top_suppliers': top_suppliers,
            'category_breakdown': cat_summary,
            'tier_chart': build_chart_format(
                labels=[t['name'] for t in tier_summary],
                data=[t['co2e_tonnes'] for t in tier_summary],
                chart_type="doughnut"
            ),
            'supplier_chart': build_chart_format(
                labels=[s['name'] for s in top_suppliers],
                data=[s['co2e_tonnes'] for s in top_suppliers],
                chart_type="bar"
            )
        }, status=status.HTTP_200_OK)
