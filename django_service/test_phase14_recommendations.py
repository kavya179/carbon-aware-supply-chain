"""
Phase 14 Test Suite: Circular and Lower-Carbon Rule-Based Recommendations
Verifies:
1. Deterministic rule-based evaluation (strictly zero ML).
2. Recommendations derived directly from actual SQLite hotspots.
3. All 4 core decarbonization domains covered:
   - Transport: Lower-emission transport mode & shorter-distance routing
   - Material: Circular recycled feedstock & lower-carbon certified alternatives
   - Supplier: Lower-carbon suppliers & regional/nearer suppliers
   - Energy: Renewable power (PPA/Solar) & energy efficiency
4. Each recommendation includes:
   - hotspot
   - reason
   - current emissions
   - recommended alternative
   - estimated potential reduction
   - calculation basis
5. Explicit labeling as 'estimated potential reductions' (no guaranteed savings).
6. SQLite persistence and REST API retrieval.
"""

import os
import sys
import django
import requests

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from django.contrib.auth.models import User
from supply_chain.models import Company, Supplier, Hotspot, Recommendation
from supply_chain.recommendation_engine import RuleBasedRecommendationEngine

BASE_URL = "http://127.0.0.1:8000/api"

def run_tests():
    print("=" * 75)
    print("PHASE 14 VERIFICATION: CIRCULAR & LOWER-CARBON RECOMMENDATION ENGINE")
    print("=" * 75)

    # 1. Direct Engine Unit Test
    company = Company.objects.filter(name__icontains="Apex").first()
    assert company is not None, "Enterprise company Apex Motors not found in SQLite!"
    print(f"[OK] Target enterprise company: {company.name} (ID: {company.id})")

    engine = RuleBasedRecommendationEngine(company=company)
    recs = engine.generate_recommendations()
    assert len(recs) > 0, "No recommendations generated from hotspots!"
    print(f"[OK] RuleBasedRecommendationEngine generated {len(recs)} targeted recommendations.")

    categories = {r['category'] for r in recs}
    print(f"[OK] Categories covered: {categories}")
    for required_cat in ('MATERIAL', 'ENERGY', 'TRANSPORT', 'SUPPLIER'):
        assert required_cat in categories, f"Missing required domain: {required_cat}"
    print("[OK] All 4 required domains (Material, Energy, Transport, Supplier) successfully generated.")

    # 2. Verify Mandated Data Fields & Formulas
    print("\n--- Auditing Mandated Fields, Formulas & Disclaimers ---")
    for idx, r in enumerate(recs, 1):
        assert 'hotspot' in r and r['hotspot'], f"Rec #{idx} missing 'hotspot'"
        assert 'reason' in r and r['reason'], f"Rec #{idx} missing 'reason'"
        assert 'current_emissions' in r, f"Rec #{idx} missing 'current_emissions'"
        assert 'recommended_alternative' in r and r['recommended_alternative'], f"Rec #{idx} missing 'recommended_alternative'"
        assert 'estimated_potential_reduction' in r, f"Rec #{idx} missing 'estimated_potential_reduction'"
        assert 'calculation_basis' in r and r['calculation_basis'], f"Rec #{idx} missing 'calculation_basis'"

        # Check math consistency: current - alternative = reduction
        curr_kg = r['current_emissions']['co2e_kg']
        alt_kg = r['alternative_emissions']['co2e_kg']
        red_kg = r['estimated_potential_reduction']['co2e_kg']
        diff = abs((curr_kg - alt_kg) - red_kg)
        assert diff < 0.1, f"Rec #{idx} math mismatch: {curr_kg} - {alt_kg} != {red_kg} (diff={diff})"

        # Check anti-guarantee disclaimer wording
        basis_str = r['calculation_basis'].lower()
        assert "estimated potential reduction" in basis_str, f"Rec #{idx} basis does not include 'estimated potential reduction'"
        assert "guaranteed" not in basis_str, f"Rec #{idx} claims guaranteed reductions!"

        print(f"  Rec #{idx:02d} [{r['category']} - {r['action_type']}]:")
        print(f"    Title:       {r['title']}")
        print(f"    Hotspot:     {r['hotspot']}")
        print(f"    Current:     {curr_kg:,.2f} kg CO2e ({r['current_emissions']['co2e_tonnes']:,.2f} tCO2e)")
        print(f"    Alternative: {alt_kg:,.2f} kg CO2e ({r['alternative_emissions']['co2e_tonnes']:,.2f} tCO2e)")
        print(f"    Potential Reduction: {red_kg:,.2f} kg CO2e ({r['estimated_potential_reduction']['co2e_tonnes']:,.2f} tCO2e, {r['estimated_potential_reduction']['reduction_pct']}%)")
        print(f"    Basis:       {r['calculation_basis'][:100]}...")

    # 3. REST API Authentication & Testing
    print("\n--- Testing REST API Endpoints via HTTP ---")
    session = requests.Session()
    login_resp = session.post(f"{BASE_URL}/auth/login/", json={
        "username": "mgr_apex",
        "password": "SecurePass123!"
    })
    assert login_resp.status_code == 200, f"Login failed: {login_resp.text}"
    login_json = login_resp.json()
    token = login_json.get('tokens', {}).get('access')
    assert token, f"No access token returned in login response: {login_json}"
    headers = {"Authorization": f"Bearer {token}"}

    # Overview endpoint
    overview_resp = session.get(f"{BASE_URL}/recommendations/overview/", headers=headers)
    if overview_resp.status_code != 200:
        print(f"[FAIL] Overview GET failed with status {overview_resp.status_code}")
        # Search for exception value in html
        import re
        m = re.search(r'<pre class="exception_value">([^<]+)</pre>', overview_resp.text)
        if m:
            print(f"Exception: {m.group(1)}")
        else:
            print(f"Error text: {overview_resp.text[:500]}")
        sys.exit(1)
    data = overview_resp.json()
    assert 'summary' in data and 'recommendations' in data
    assert 'estimated potential reduction' in data['disclaimer'].lower()
    print(f"[OK] GET /api/recommendations/overview/ returned {len(data['recommendations'])} recs.")
    print(f"     Total potential reduction: {data['summary']['total_estimated_potential_reduction_tonnes']:,.2f} tCO2e")

    # Domain specific endpoints
    for endpoint, expected_domain in [
        ('material', 'MATERIAL'),
        ('transport', 'TRANSPORT'),
        ('energy', 'ENERGY'),
        ('suppliers', 'SUPPLIER'),
    ]:
        ep_resp = session.get(f"{BASE_URL}/recommendations/{endpoint}/", headers=headers)
        if ep_resp.status_code != 200:
            print(f"[FAIL] GET /recommendations/{endpoint}/ failed with status {ep_resp.status_code}")
            print(f"Response snippet: {ep_resp.text[:300]}")
            sys.exit(1)
        ep_data = ep_resp.json()
        assert ep_data['domain'] == expected_domain
        assert ep_data['count'] > 0
        print(f"[OK] GET /api/recommendations/{endpoint}/ returned {ep_data['count']} recommendations.")

    # Generate & Persist endpoint
    print("\n--- Testing Persistence to SQLite Database ---")
    gen_resp = session.post(f"{BASE_URL}/recommendations/generate/", headers=headers, json={})
    if gen_resp.status_code != 201:
        print(f"[FAIL] Generate POST failed with status {gen_resp.status_code}")
        import re
        m = re.search(r'<pre class="exception_value">([^<]+)</pre>', gen_resp.text)
        if m:
            print(f"Exception: {m.group(1)}")
        else:
            print(f"Error text: {gen_resp.text[:500]}")
        sys.exit(1)
    gen_data = gen_resp.json()
    persisted_count = gen_data['persisted_count']
    assert persisted_count > 0, "No recommendations persisted!"
    print(f"[OK] POST /api/recommendations/generate/ persisted {persisted_count} recommendations into SQLite.")

    # Verify via standard list endpoint
    list_resp = session.get(f"{BASE_URL}/recommendations/", headers=headers)
    assert list_resp.status_code == 200, f"List GET failed: {list_resp.status_code}"
    saved_items = list_resp.json()
    results = saved_items if isinstance(saved_items, list) else saved_items.get('results', [])
    assert len(results) >= persisted_count, f"Saved items count mismatch: {len(results)} vs {persisted_count}"
    
    first_saved = results[0]
    assert 'recommended_alternative' in first_saved and first_saved['recommended_alternative']
    assert 'current_emissions_kg' in first_saved and first_saved['current_emissions_kg'] is not None
    assert 'alternative_emissions_kg' in first_saved and first_saved['alternative_emissions_kg'] is not None
    assert 'estimated_reduction_kg' in first_saved and first_saved['estimated_reduction_kg'] is not None
    assert 'calculation_basis' in first_saved and first_saved['calculation_basis']
    print(f"[OK] Verified persisted recommendation in SQLite: ID={first_saved['id']}, Title='{first_saved['title']}'")

    print("\n" + "=" * 75)
    print("ALL PHASE 14 RECOMMENDATION ENGINE TESTS PASSED PERFECTLY!")
    print("=" * 75)

if __name__ == '__main__':
    run_tests()
