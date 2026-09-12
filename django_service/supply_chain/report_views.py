"""
Phase 16 — Carbon Reporting
Full report generation engine: data aggregation, PDF creation via ReportLab,
and report metadata persistence in SQLite.

Model relationships:
  CarbonCalculation
    → activity_data (OneToOneField → SupplierActivityData)
        → supplier (ForeignKey → Supplier)
        → reporting_period, activity_type, verification_status, transport_mode, material_type

All values labelled:
  CALCULATED  : derived from emission factor × activity quantity
  ESTIMATED   : modelled/interpolated
  ESTIMATED_POTENTIAL : possible reduction, not guaranteed
"""

import io
import logging
from decimal import Decimal

from django.http import HttpResponse
from django.db.models import Sum, Q
from django.utils import timezone
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework import permissions

from .models import (
    Company,
    Supplier,
    SupplierRelationship,
    CarbonCalculation,
    Hotspot,
    Recommendation,
    AuditLog,
    Report,
)

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _safe_float(value, default=0.0):
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def _build_report_data(period=None):
    """
    Aggregate all data required for a full Scope 3 report.
    CarbonCalculation → activity_data (SupplierActivityData) → supplier / period / etc.
    Returns a structured dict — the canonical report payload.
    """
    # ── Company info ────────────────────────────────────────────────────────
    company = Company.objects.first()
    company_name = company.name if company else "Apex Motors Corporation"
    reporting_year = company.reporting_year if company else 2024

    # ── Filter helpers ───────────────────────────────────────────────────────
    calc_qs = CarbonCalculation.objects.select_related('activity_data__supplier')
    if period:
        calc_qs = calc_qs.filter(activity_data__reporting_period=period)

    # ── Emissions totals ─────────────────────────────────────────────────────
    total_agg = calc_qs.aggregate(
        total_kg=Sum('co2e_kg'),
        total_tonnes=Sum('co2e_tonnes'),
    )
    total_kg = _safe_float(total_agg['total_kg'])
    total_tonnes = _safe_float(total_agg['total_tonnes'])

    # ── Tier breakdown ───────────────────────────────────────────────────────
    tier_data = {}
    for tier_num in [1, 2, 3]:
        tier_calcs = calc_qs.filter(
            activity_data__supplier__customer_relationships__tier_level=tier_num
        )
        agg = tier_calcs.aggregate(kg=Sum('co2e_kg'), tonnes=Sum('co2e_tonnes'))
        t_kg = _safe_float(agg['kg'])
        t_tonnes = _safe_float(agg['tonnes'])
        pct = round((t_tonnes / total_tonnes * 100), 2) if total_tonnes > 0 else 0.0
        tier_data[tier_num] = {
            'tier': tier_num,
            'tier_name': f'Tier {tier_num}',
            'co2e_kg': round(t_kg, 2),
            'co2e_tonnes': round(t_tonnes, 4),
            'percentage': pct,
        }

    # ── Supplier emissions ───────────────────────────────────────────────────
    supplier_agg = (
        calc_qs
        .values(
            'activity_data__supplier__id',
            'activity_data__supplier__name',
            'activity_data__supplier__supplier_code',
            'activity_data__supplier__country',
            'activity_data__supplier__industry_sector',
        )
        .annotate(total_kg=Sum('co2e_kg'), total_tonnes=Sum('co2e_tonnes'))
        .order_by('-total_tonnes')[:10]
    )

    supplier_emissions = []
    for s in supplier_agg:
        s_id = s['activity_data__supplier__id']
        pct = round(_safe_float(s['total_tonnes']) / total_tonnes * 100, 2) if total_tonnes > 0 else 0.0
        rel = SupplierRelationship.objects.filter(supplier_id=s_id).first()
        tier_level = rel.tier_level if rel else 1
        supplier_emissions.append({
            'supplier_name': s['activity_data__supplier__name'],
            'supplier_code': s['activity_data__supplier__supplier_code'],
            'country': s['activity_data__supplier__country'],
            'industry_sector': s['activity_data__supplier__industry_sector'],
            'tier_level': tier_level,
            'co2e_kg': round(_safe_float(s['total_kg']), 2),
            'co2e_tonnes': round(_safe_float(s['total_tonnes']), 4),
            'contribution_pct': pct,
            'value_type': 'CALCULATED',
        })

    # ── Activity breakdown ───────────────────────────────────────────────────
    act_agg = (
        calc_qs
        .values('activity_data__activity_type')
        .annotate(total_kg=Sum('co2e_kg'), total_tonnes=Sum('co2e_tonnes'))
        .order_by('-total_tonnes')
    )
    activity_emissions = []
    for a in act_agg:
        pct = round(_safe_float(a['total_tonnes']) / total_tonnes * 100, 2) if total_tonnes > 0 else 0.0
        activity_emissions.append({
            'activity_type': a['activity_data__activity_type'] or '—',
            'co2e_kg': round(_safe_float(a['total_kg']), 2),
            'co2e_tonnes': round(_safe_float(a['total_tonnes']), 4),
            'contribution_pct': pct,
            'value_type': 'CALCULATED',
        })

    # ── Hotspots ─────────────────────────────────────────────────────────────
    hotspot_qs = Hotspot.objects.select_related('supplier').all()

    hotspots = []
    for h in hotspot_qs.order_by('-total_co2e_tonnes')[:8]:
        supplier_name = h.supplier.name if h.supplier else 'Unknown'
        hotspots.append({
            'entity_name': supplier_name,
            'entity_type': f'Tier {h.tier_level} Supplier' if h.tier_level else 'Supplier',
            'impact': h.severity,
            'total_emissions_tonnes': round(_safe_float(h.total_co2e_tonnes), 4),
            'contribution_pct': round(_safe_float(h.contribution_pct), 2),
            'main_source': h.emission_category,
            'explanation': f"{supplier_name} contributes {round(_safe_float(h.contribution_pct), 2)}% of total Scope 3 via {h.emission_category or 'mixed activities'}.",
        })

    hotspot_counts = {
        'high': hotspot_qs.filter(severity='HIGH').count(),
        'medium': hotspot_qs.filter(severity='MEDIUM').count(),
        'low': hotspot_qs.filter(severity='LOW').count(),
    }

    # ── Recommendations ───────────────────────────────────────────────────────
    rec_qs = Recommendation.objects.select_related('supplier', 'hotspot').all()

    recommendations = []
    total_potential_reduction_kg = Decimal('0')
    for r in rec_qs.order_by('-estimated_reduction_kg')[:8]:
        red_kg = r.estimated_reduction_kg or Decimal('0')
        total_potential_reduction_kg += red_kg
        recommendations.append({
            'domain': r.action_type or 'GENERAL',
            'title': r.title,
            'reason': r.reason or r.description or '',
            'current_emissions_kg': round(_safe_float(r.current_emissions_kg), 2),
            'estimated_reduction_kg': round(_safe_float(red_kg), 2),
            'estimated_reduction_pct': round(_safe_float(r.reduction_pct), 2),
            'calculation_basis': r.calculation_basis or '',
            'value_type': 'ESTIMATED_POTENTIAL',
        })

    total_potential_reduction_tonnes = round(_safe_float(total_potential_reduction_kg) / 1000, 4)

    # ── Verification status ───────────────────────────────────────────────────
    verified_count = calc_qs.filter(activity_data__verification_status='VERIFIED').count()
    unverified_count = calc_qs.filter(
        ~Q(activity_data__verification_status='VERIFIED')
    ).count()
    total_calcs = calc_qs.count()
    verification_pct = round(verified_count / total_calcs * 100, 1) if total_calcs > 0 else 0.0

    # ── Calculation periods ───────────────────────────────────────────────────
    from .models import SupplierActivityData
    periods = list(
        SupplierActivityData.objects.values_list('reporting_period', flat=True)
        .distinct().order_by('reporting_period')
    )

    return {
        'report_metadata': {
            'company_name': company_name,
            'reporting_year': reporting_year,
            'reporting_period': period or 'All Periods (Consolidated)',
            'available_periods': periods,
            'generated_at': timezone.now().isoformat(),
            'framework': 'GHG Protocol Scope 3 (Category 1–15)',
            'engine': 'Rule-Based Deterministic (Zero ML)',
            'disclaimer': (
                'This report contains CALCULATED emissions derived from verified activity data '
                'and emission factors. Values labelled ESTIMATED_POTENTIAL represent modelled '
                'reduction opportunities and are not guaranteed reductions. '
                'No sustainability claims should be made based solely on estimated values.'
            ),
        },
        'summary': {
            'total_co2e_kg': round(total_kg, 2),
            'total_co2e_tonnes': round(total_tonnes, 4),
            'total_suppliers': Supplier.objects.count(),
            'total_calculations': total_calcs,
            'potential_reduction_tonnes': total_potential_reduction_tonnes,
            'potential_reduction_pct': round(
                total_potential_reduction_tonnes / total_tonnes * 100, 2
            ) if total_tonnes > 0 else 0.0,
            'value_type': 'CALCULATED',
        },
        'tier_breakdown': list(tier_data.values()),
        'top_suppliers': supplier_emissions,
        'activity_breakdown': activity_emissions,
        'hotspots': {
            'counts': hotspot_counts,
            'items': hotspots,
        },
        'recommendations': {
            'total_potential_reduction_tonnes': total_potential_reduction_tonnes,
            'items': recommendations,
        },
        'verification_status': {
            'verified_calculations': verified_count,
            'unverified_calculations': unverified_count,
            'total_calculations': total_calcs,
            'verification_rate_pct': verification_pct,
            'status': 'VERIFIED' if verification_pct >= 80 else ('PARTIAL' if verification_pct > 0 else 'UNVERIFIED'),
        },
    }


# ---------------------------------------------------------------------------
# API Views
# ---------------------------------------------------------------------------

class ReportDataView(APIView):
    """GET /api/reports/data/?period=2024-Q1 — full structured report payload."""
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        period = request.query_params.get('period') or None
        if period == 'All Periods':
            period = None
        try:
            data = _build_report_data(period)
            return Response(data)
        except Exception as exc:
            logger.exception("Report data generation failed")
            return Response({'error': str(exc)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class ReportGenerateView(APIView):
    """POST /api/reports/generate/ — generate, persist metadata to SQLite, audit log."""
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        period = request.data.get('period') or None
        if period == 'All Periods':
            period = None
        title = request.data.get('title') or f"Scope 3 Emissions Report — {period or 'All Periods'}"
        try:
            data = _build_report_data(period)
            summary = data['summary']
            tier_bd = {t['tier']: t for t in data['tier_breakdown']}

            company = Company.objects.first()
            report_id = None
            if company:
                report = Report.objects.create(
                    company=company,
                    title=title,
                    reporting_year=data['report_metadata']['reporting_year'],
                    total_scope3_tonnes=Decimal(str(summary['total_co2e_tonnes'])),
                    tier1_emissions_tonnes=Decimal(str(tier_bd.get(1, {}).get('co2e_tonnes', 0))),
                    tier2_emissions_tonnes=Decimal(str(tier_bd.get(2, {}).get('co2e_tonnes', 0))),
                    tier3_emissions_tonnes=Decimal(str(tier_bd.get(3, {}).get('co2e_tonnes', 0))),
                    report_format='JSON',
                    status='FINAL',
                )
                report_id = report.id
                data['report_metadata']['report_id'] = report_id

                AuditLog.log_action(
                    user=None,
                    action='REPORT_GENERATED',
                    entity_type='Report',
                    entity_id=report.id,
                    details={
                        'title': title,
                        'period': period or 'All Periods',
                        'total_scope3_tonnes': str(summary['total_co2e_tonnes']),
                    },
                    request=request,
                )

            return Response({'report': data, 'status': 'generated', 'report_id': report_id})
        except Exception as exc:
            logger.exception("Report generation failed")
            return Response({'error': str(exc)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class ReportPDFView(APIView):
    """GET /api/reports/pdf/?period=2024-Q1 — streams a PDF report via ReportLab."""
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        period = request.query_params.get('period') or None
        if period == 'All Periods':
            period = None
        title = request.query_params.get('title') or f"Scope 3 Carbon Report — {period or 'All Periods'}"
        try:
            data = _build_report_data(period)
        except Exception as exc:
            return Response({'error': str(exc)}, status=500)
        try:
            return self._build_pdf(data, title)
        except ImportError:
            return Response({
                'error': 'PDF generation requires reportlab. Install via: pip install reportlab',
                'data': data,
            }, status=503)

    def _build_pdf(self, data, title):
        from reportlab.lib.pagesizes import A4
        from reportlab.lib import colors
        from reportlab.lib.units import cm
        from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
        from reportlab.platypus import (
            SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
            HRFlowable,
        )

        buf = io.BytesIO()
        doc = SimpleDocTemplate(buf, pagesize=A4,
                                rightMargin=2*cm, leftMargin=2*cm,
                                topMargin=2*cm, bottomMargin=2*cm, title=title)
        styles = getSampleStyleSheet()
        meta = data['report_metadata']
        summary = data['summary']
        GREEN = colors.HexColor('#059669')
        DARK = colors.HexColor('#0f2017')
        MUTED = colors.HexColor('#5a8a6a')
        PALE = colors.HexColor('#f0fdf4')
        LGREY = colors.HexColor('#f8fafc')
        RED = colors.HexColor('#dc2626')
        AMBER = colors.HexColor('#d97706')
        BLUE = colors.HexColor('#2563eb')

        h1 = ParagraphStyle('H1', parent=styles['Heading1'], textColor=DARK, fontSize=20, spaceAfter=4)
        h2 = ParagraphStyle('H2', parent=styles['Heading2'], textColor=GREEN, fontSize=13, spaceBefore=14, spaceAfter=5)
        body = ParagraphStyle('Body', parent=styles['Normal'], textColor=DARK, fontSize=9, leading=14)
        muted = ParagraphStyle('Muted', parent=styles['Normal'], textColor=MUTED, fontSize=8, leading=12)
        disc = ParagraphStyle('Disc', parent=styles['Normal'], textColor=MUTED, fontSize=7.5, leading=11,
                              backColor=PALE, borderPadding=6, borderWidth=0.5, borderColor=GREEN)

        story = []
        story.append(Paragraph("Carbon Intelligence Platform", muted))
        story.append(Spacer(1, 4))
        story.append(Paragraph(title, h1))
        story.append(Paragraph(
            f"{meta['company_name']}  ·  Year {meta['reporting_year']}  ·  "
            f"Period: {meta['reporting_period']}  ·  Generated: {meta['generated_at'][:19].replace('T',' ')}",
            muted))
        story.append(Spacer(1, 8))
        story.append(HRFlowable(width='100%', thickness=2, color=GREEN))
        story.append(Spacer(1, 6))
        story.append(Paragraph(f"<b>DISCLAIMER:</b> {meta['disclaimer']}", disc))
        story.append(Spacer(1, 12))

        # 1. Executive Summary
        story.append(Paragraph("1. Executive Summary", h2))
        verif = data['verification_status']
        rows = [
            ['Metric', 'Value', 'Label'],
            ['Total Scope 3 Emissions', f"{summary['total_co2e_tonnes']:,.4f} tCO\u2082e", 'CALCULATED'],
            ['Total (kg CO\u2082e)', f"{summary['total_co2e_kg']:,.2f}", 'CALCULATED'],
            ['Suppliers Tracked', str(summary['total_suppliers']), 'DATA'],
            ['Calculation Records', str(summary['total_calculations']), 'DATA'],
            ['Potential Reduction', f"{summary['potential_reduction_tonnes']:,.4f} tCO\u2082e (~{summary['potential_reduction_pct']:.1f}%)", 'EST. POTENTIAL'],
            ['Verification Rate', f"{verif['verification_rate_pct']}%  ({verif['verified_calculations']}/{verif['total_calculations']})", 'STATUS'],
        ]
        t = Table(rows, colWidths=[7*cm, 7*cm, 5*cm])
        t.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), GREEN), ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'), ('FONTSIZE', (0, 0), (-1, -1), 8.5),
            ('GRID', (0, 0), (-1, -1), 0.4, colors.HexColor('#d1fae5')),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [LGREY, PALE]),
            ('ALIGN', (1, 0), (-1, -1), 'CENTER'), ('PADDING', (0, 0), (-1, -1), 5),
            ('TEXTCOLOR', (2, 1), (2, -1), GREEN), ('FONTNAME', (2, 1), (2, -1), 'Helvetica-Bold'),
        ]))
        story.append(t)
        story.append(Spacer(1, 12))

        # 2. Tier Breakdown
        story.append(Paragraph("2. Emissions by Supply Chain Tier", h2))
        tier_desc = {1: 'Direct (Tier 1) Suppliers', 2: 'Sub-Contractors (Tier 2)', 3: 'Raw Materials / Mining (Tier 3)'}
        trows = [['Tier', 'Description', 'CO\u2082e (tCO\u2082e)', 'CO\u2082e (kg)', '% Share', 'Label']]
        for td in data['tier_breakdown']:
            trows.append([f"Tier {td['tier']}", tier_desc.get(td['tier'], ''),
                          f"{td['co2e_tonnes']:,.4f}", f"{td['co2e_kg']:,.2f}",
                          f"{td['percentage']:.2f}%", 'CALCULATED'])
        tt = Table(trows, colWidths=[2*cm, 5*cm, 3*cm, 3.5*cm, 2.5*cm, 3*cm])
        tt.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), GREEN), ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'), ('FONTSIZE', (0, 0), (-1, -1), 8),
            ('GRID', (0, 0), (-1, -1), 0.4, colors.HexColor('#d1fae5')),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [LGREY, PALE]),
            ('ALIGN', (2, 0), (-1, -1), 'RIGHT'), ('PADDING', (0, 0), (-1, -1), 5),
        ]))
        story.append(tt)
        story.append(Spacer(1, 12))

        # 3. Top Suppliers
        story.append(Paragraph("3. Top Suppliers by Emissions", h2))
        srows = [['#', 'Supplier', 'Country', 'Tier', 'CO\u2082e (tCO\u2082e)', '% Share', 'Label']]
        for i, s in enumerate(data['top_suppliers'][:8], 1):
            srows.append([str(i), s['supplier_name'], s['country'], f"T{s['tier_level']}",
                          f"{s['co2e_tonnes']:,.4f}", f"{s['contribution_pct']:.2f}%", 'CALCULATED'])
        st = Table(srows, colWidths=[1*cm, 6*cm, 2.5*cm, 1.5*cm, 3*cm, 2.5*cm, 2.5*cm])
        st.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), DARK), ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'), ('FONTSIZE', (0, 0), (-1, -1), 8),
            ('GRID', (0, 0), (-1, -1), 0.4, colors.HexColor('#e2e8f0')),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [LGREY, PALE]),
            ('ALIGN', (4, 0), (-1, -1), 'RIGHT'), ('PADDING', (0, 0), (-1, -1), 5),
            ('TEXTCOLOR', (6, 1), (6, -1), GREEN), ('FONTNAME', (6, 1), (6, -1), 'Helvetica-Bold'),
        ]))
        story.append(st)
        story.append(Spacer(1, 12))

        # 4. Activity Categories
        story.append(Paragraph("4. Emissions by Activity Category", h2))
        arows = [['Activity Type', 'CO\u2082e (tCO\u2082e)', 'CO\u2082e (kg)', '% Share', 'Label']]
        for a in data['activity_breakdown']:
            arows.append([a['activity_type'], f"{a['co2e_tonnes']:,.4f}",
                          f"{a['co2e_kg']:,.2f}", f"{a['contribution_pct']:.2f}%", 'CALCULATED'])
        if not data['activity_breakdown']:
            arows.append(['No data', '—', '—', '—', '—'])
        at = Table(arows, colWidths=[6*cm, 3.5*cm, 3.5*cm, 2.5*cm, 3.5*cm])
        at.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#0891b2')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'), ('FONTSIZE', (0, 0), (-1, -1), 8),
            ('GRID', (0, 0), (-1, -1), 0.4, colors.HexColor('#cffafe')),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [LGREY, colors.HexColor('#ecfeff')]),
            ('ALIGN', (1, 0), (-1, -1), 'RIGHT'), ('PADDING', (0, 0), (-1, -1), 5),
        ]))
        story.append(at)
        story.append(Spacer(1, 12))

        # 5. Hotspots
        story.append(Paragraph("5. Carbon Hotspot Analysis", h2))
        hc = data['hotspots']['counts']
        story.append(Paragraph(
            f"<b>Detected:</b> {hc['high']} HIGH · {hc['medium']} MEDIUM · {hc['low']} LOW", body))
        story.append(Spacer(1, 6))
        if data['hotspots']['items']:
            hrows = [['Entity', 'Type', 'Impact', 'CO\u2082e (tCO\u2082e)', '% Share', 'Primary Driver']]
            for h in data['hotspots']['items']:
                hrows.append([h['entity_name'], h['entity_type'], h['impact'],
                              f"{h['total_emissions_tonnes']:,.4f}",
                              f"{h['contribution_pct']:.2f}%", h['main_source'] or '—'])
            ht = Table(hrows, colWidths=[5*cm, 2.5*cm, 2*cm, 3*cm, 2.5*cm, 4*cm])
            ht.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#7f1d1d')),
                ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
                ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'), ('FONTSIZE', (0, 0), (-1, -1), 8),
                ('GRID', (0, 0), (-1, -1), 0.4, colors.HexColor('#fee2e2')),
                ('ROWBACKGROUNDS', (0, 1), (-1, -1), [LGREY, colors.HexColor('#fff1f2')]),
                ('ALIGN', (3, 0), (-1, -1), 'RIGHT'), ('PADDING', (0, 0), (-1, -1), 5),
            ]))
            story.append(ht)
        else:
            story.append(Paragraph("No hotspots recorded for this period.", muted))
        story.append(Spacer(1, 12))

        # 6. Recommendations
        story.append(Paragraph("6. Decarbonization Recommendations", h2))
        story.append(Paragraph(
            f"<b>Total Estimated Potential Reduction: "
            f"{data['recommendations']['total_potential_reduction_tonnes']:,.4f} tCO\u2082e</b>  "
            f"[ESTIMATED_POTENTIAL — not guaranteed]", body))
        story.append(Spacer(1, 6))
        if data['recommendations']['items']:
            rrows = [['Domain', 'Title', 'Current (kg)', 'Potential Red. (kg)', '% Red.', 'Label']]
            for r in data['recommendations']['items']:
                rrows.append([r['domain'], r['title'][:60],
                              f"{r['current_emissions_kg']:,.0f}",
                              f"{r['estimated_reduction_kg']:,.0f}",
                              f"{r['estimated_reduction_pct']:.1f}%", 'EST. POTENTIAL'])
            rt = Table(rrows, colWidths=[2.5*cm, 5.5*cm, 3*cm, 3.5*cm, 1.8*cm, 2.7*cm])
            rt.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#065f46')),
                ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
                ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'), ('FONTSIZE', (0, 0), (-1, -1), 7.5),
                ('GRID', (0, 0), (-1, -1), 0.4, colors.HexColor('#d1fae5')),
                ('ROWBACKGROUNDS', (0, 1), (-1, -1), [LGREY, PALE]),
                ('ALIGN', (2, 0), (-1, -1), 'RIGHT'), ('PADDING', (0, 0), (-1, -1), 5),
                ('TEXTCOLOR', (5, 1), (5, -1), AMBER), ('FONTNAME', (5, 1), (5, -1), 'Helvetica-Bold'),
            ]))
            story.append(rt)
        else:
            story.append(Paragraph("No recommendations generated for this period.", muted))
        story.append(Spacer(1, 12))

        # 7. Verification
        story.append(Paragraph("7. Data Verification Status", h2))
        vrows = [
            ['Parameter', 'Value'],
            ['Verified Records', str(verif['verified_calculations'])],
            ['Unverified Records', str(verif['unverified_calculations'])],
            ['Total Records', str(verif['total_calculations'])],
            ['Verification Rate', f"{verif['verification_rate_pct']}%"],
            ['Overall Status', verif['status']],
        ]
        vt = Table(vrows, colWidths=[8*cm, 11*cm])
        vt.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), DARK), ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'), ('FONTSIZE', (0, 0), (-1, -1), 9),
            ('GRID', (0, 0), (-1, -1), 0.4, colors.HexColor('#e2e8f0')),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [LGREY, PALE]),
            ('PADDING', (0, 0), (-1, -1), 6),
        ]))
        story.append(vt)
        story.append(Spacer(1, 16))

        story.append(HRFlowable(width='100%', thickness=1, color=GREEN))
        story.append(Spacer(1, 6))
        story.append(Paragraph(
            f"Carbon Intelligence Platform · GHG Protocol Scope 3 · SQLite Engine · "
            f"{meta['generated_at'][:10]}  |  {meta['framework']}  |  {meta['engine']}",
            muted))

        doc.build(story)
        buf.seek(0)
        period_val = meta.get('reporting_period') or 'all'
        filename = f"scope3_report_{str(period_val).replace(' ', '_').replace('/', '-')}.pdf"
        response = HttpResponse(buf.read(), content_type='application/pdf')
        response['Content-Disposition'] = f'attachment; filename="{filename}"'
        response['Access-Control-Allow-Origin'] = '*'
        return response


class ReportListView(APIView):
    """GET /api/reports/list/ — saved report metadata from SQLite."""
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        try:
            reports = Report.objects.select_related('company').order_by('-generated_at')[:50]
            result = [{
                'id': r.id,
                'title': r.title,
                'company': r.company.name if r.company else '',
                'reporting_year': r.reporting_year,
                'status': r.status,
                'report_format': r.report_format,
                'total_scope3_tonnes': float(r.total_scope3_tonnes),
                'tier1_emissions_tonnes': float(r.tier1_emissions_tonnes),
                'tier2_emissions_tonnes': float(r.tier2_emissions_tonnes),
                'tier3_emissions_tonnes': float(r.tier3_emissions_tonnes),
                'generated_at': r.generated_at.isoformat(),
            } for r in reports]
            return Response({'reports': result, 'total': len(result)})
        except Exception as exc:
            logger.exception("Failed to list reports")
            return Response({'error': str(exc)}, status=500)
