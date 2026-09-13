import React, { useState, useMemo, useEffect } from 'react';

const ESG_CATEGORIES = [
  { id: 'all', label: 'All Topics', icon: '🌐' },
  { id: 'accounting', label: 'GHG Accounting', icon: '📊' },
  { id: 'supply-chain', label: 'Multi-Tier Chains', icon: '🕸️' },
  { id: 'calculations', label: 'Formulas & Math', icon: '🔢' },
  { id: 'standards', label: 'Compliance Standards', icon: '📜' },
  { id: 'assurance', label: 'Assurance & ML', icon: '🛡️' },
];

const CONCEPTS = [
  {
    id: 'scope3',
    categoryId: 'accounting',
    title: 'Scope 3 Value Chain Emissions',
    subtitle: 'Upstream & Downstream GHG Protocol Accounting',
    tag: 'GHG Protocol Standard',
    tagClass: 'badge-emerald',
    icon: '🌍',
    badgeColor: '#059669',
    summary: 'Indirect emissions across the upstream supply chain and downstream product lifecycle, typically representing 75% to 90% of a manufacturing company\'s carbon footprint.',
    diagramType: 'scopes',
    details: [
      {
        heading: 'Scope 1 vs Scope 2 vs Scope 3 Breakdown',
        content: 'Scope 1 covers direct combustion at company facilities and fleet vehicles. Scope 2 accounts for purchased electricity and heating. Scope 3 covers all other upstream supplier extraction, transport logistics, and customer product use.'
      },
      {
        heading: '15 Standard Scope 3 Categories',
        content: 'Category 1 (Purchased Goods & Services) and Category 4 (Upstream Transportation & Logistics) dominate heavy industry and automotive manufacturing.'
      },
      {
        heading: 'Determinism & Zero Double Counting',
        content: 'Each activity stream is assigned to its distinct tier level without duplicating emissions between sub-tier component suppliers and primary tier assemblers.'
      }
    ],
    formula: 'Total Scope 3 = Σ (Category 1 Purchased Goods) + Σ (Category 4 Freight Logistics) + Σ (Upstream Tier 1..3 Telemetry)',
    standardRef: 'GHG Protocol Corporate Value Chain (Scope 3) Standard & CSRD ESRS E1',
    regulatoryMandates: ['EU Corporate Sustainability Due Diligence (CSDDD)', 'CSRD ESRS E1 Climate Change', 'SEC Climate Disclosure Rule']
  },
  {
    id: 'co2e',
    categoryId: 'accounting',
    title: 'CO₂e (Carbon Dioxide Equivalent)',
    subtitle: 'Universal Greenhouse Gas Metric & Global Warming Potential',
    tag: 'Universal Metric',
    tagClass: 'badge-blue',
    icon: '⚖️',
    badgeColor: '#2563EB',
    summary: 'The universal unit of measurement used to compare emissions from various greenhouse gases on the basis of their 100-year Global Warming Potential (GWP100).',
    diagramType: 'gases',
    details: [
      {
        heading: 'Greenhouse Gases Included',
        content: 'Carbon Dioxide (CO₂, GWP=1), Methane (CH₄, GWP=28), Nitrous Oxide (N₂O, GWP=273), and fluorinated industrial refrigerant gases (HFCs, PFCs, SF₆, GWP up to 24,000).'
      },
      {
        heading: 'Standard Mass Equivalence',
        content: '1 Metric Tonne CO₂e (tCO₂e) = 1,000 kg CO₂e = 1,000,000 grams CO₂e. Enterprise reports aggregate in metric tonnes (t).'
      }
    ],
    formula: 'Emissions (tCO₂e) = Mass of Gas (t) × GWP100 Value',
    standardRef: 'IPCC Sixth Assessment Report (AR6) Climate Change Matrix',
    regulatoryMandates: ['ISO 14064-1:2018', 'EPA Greenhouse Gas Reporting Program (GHGRP)']
  },
  {
    id: 'tiers',
    categoryId: 'supply-chain',
    title: 'Multi-Tier Supply Chain Architecture',
    subtitle: 'Tier 1 Direct, Tier 2 Sub-Assembly, Tier 3 Raw Materials',
    tag: 'Supply Hierarchy',
    tagClass: 'badge-violet',
    icon: '🏢',
    badgeColor: '#7C3AED',
    summary: 'The recursive hierarchical layers of procurement relationships spanning direct component integrators down to extraction mines and smelters.',
    diagramType: 'tiers',
    details: [
      {
        heading: 'Tier 1 — Direct OEM Contractors',
        content: 'Direct commercial suppliers delivering finished subsystems (e.g. Battery Packs, Chassis Assemblies, Electronic Inverters).'
      },
      {
        heading: 'Tier 2 — Sub-tier Component Producers',
        content: 'Suppliers feeding Tier 1 vendors (e.g. Battery Cell Fabricators, Semiconductor Foundries, Wiring Harness Manufacturers).'
      },
      {
        heading: 'Tier 3 — Commodity Refineries & Mines',
        content: 'Primary extraction and refining entities (e.g. Lithium Hydroxide Refineries, Bauxite Smelters, Cobalt Mines).'
      }
    ],
    formula: 'Supply Chain Footprint = Tier 1 Direct + Tier 2 Sub-Components + Tier 3 Raw Commodity Smelting',
    standardRef: 'ISO 20400:2017 Sustainable Procurement Guidance',
    regulatoryMandates: ['German Supply Chain Due Diligence Act (LkSG)', 'EU Battery Regulation (2023/1542)']
  },
  {
    id: 'emission-factor',
    categoryId: 'calculations',
    title: 'Emission Factor (EF) Modeling',
    subtitle: 'Activity-to-Emissions Scientific Conversion Multipliers',
    tag: 'Calculation Engine',
    tagClass: 'badge-amber',
    icon: '🔢',
    badgeColor: '#D97706',
    summary: 'Scientifically validated coefficients representing the quantity of greenhouse gas released per unit of human activity (e.g., kg CO₂e per kWh of grid electricity or per kg of virgin aluminum).',
    diagramType: 'formula',
    details: [
      {
        heading: 'Activity Data Integration',
        content: 'Operational telemetry including electricity bills (kWh), transport waybills (tonne-km), and material delivery receipts (kg).'
      },
      {
        heading: 'Hierarchical Factor Selection',
        content: '1. Supplier-specific verified EPDs (Environmental Product Declarations) → 2. Regional grid mixes (DEFRA/EPA) → 3. Life-Cycle Inventories (ecoinvent 3.9, IPCC AR6).'
      }
    ],
    formula: 'Calculated CO₂e (t) = [ Activity Amount (Units) × Emission Factor (kg CO₂e/Unit) ] ÷ 1,000',
    standardRef: 'UK DEFRA Conversion Factors 2024 & ecoinvent v3.9 Database',
    regulatoryMandates: ['GHG Protocol Calculation Tools', 'ISO 14044 Life Cycle Assessment']
  },
  {
    id: 'hotspot',
    categoryId: 'accounting',
    title: 'Carbon Hotspots & Decarbonization Thresholds',
    subtitle: '80/20 Pareto Prioritization for Decarbonization Action',
    tag: 'Risk & Strategy',
    tagClass: 'badge-rose',
    icon: '🔥',
    badgeColor: '#E11D48',
    summary: 'Specific supplier nodes, material components, or freight transport lanes that contribute a disproportionately massive share of overall supply chain emissions.',
    diagramType: 'hotspot',
    details: [
      {
        heading: 'HIGH HOTSPOT (≥ 20% Total Share)',
        content: 'Immediate strategic decarbonization priority. Requires direct renewable PPA co-funding, circular material redesign, or tier-supplier switching.'
      },
      {
        heading: 'MEDIUM HOTSPOT (5% – 20% Share)',
        content: 'Operational efficiency focus: route optimization, freight electrification, and energy efficiency upgrades.'
      },
      {
        heading: 'LOW HOTSPOT (< 5% Share)',
        content: 'Continuous monitoring and standard periodic reporting.'
      }
    ],
    formula: 'Hotspot Share (%) = [ Entity CO₂e (t) ÷ Total Supply Chain Scope 3 CO₂e (t) ] × 100',
    standardRef: 'UNEP / SETAC Hotspot Analysis Framework & Science Based Targets initiative (SBTi)',
    regulatoryMandates: ['SBTi Net-Zero Standard', 'CDP Supply Chain Disclosure']
  },
  {
    id: 'ml-estimate',
    categoryId: 'assurance',
    title: 'ML Gap-Filling & Non-Reporting Estimation',
    subtitle: 'Supervised Random Forest Telemetry Prediction',
    tag: 'Statistical AI Engine',
    tagClass: 'badge-teal',
    icon: '🤖',
    badgeColor: '#0D9488',
    summary: 'A deterministic machine learning pipeline trained to predict missing Scope 3 emissions when sub-tier suppliers fail to submit activity telemetry, maintaining full audit traceability.',
    diagramType: 'ml',
    details: [
      {
        heading: 'Model Architecture',
        content: 'Trained on 10,000+ validated manufacturing supply chain profiles using Industry Sector, Tier Level, Procurement Share, Shipment Weight, and Facility Region as feature inputs.'
      },
      {
        heading: 'Strict Governance Rule',
        content: 'ML estimates are strictly tagged as `ML_ESTIMATED` in the SQLite database and NEVER overwrite verified primary supplier invoices.'
      }
    ],
    formula: 'y_pred = RF_Regressor(Industry, Tier, Distance_km, Weight_t, Region)',
    standardRef: 'Partnership for Carbon Accounting Financials (PCAF) Data Quality Score 4/5',
    regulatoryMandates: ['PCAF Global GHG Standard for Supply Chain Finance', 'EU Corporate Sustainability Reporting Directive']
  },
  {
    id: 'assurance-trail',
    categoryId: 'assurance',
    title: 'Immutable Audit Trail & Ledger Verification',
    subtitle: 'Third-Party Assurance and Cryptographic State Integrity',
    tag: 'Assurance Ready',
    tagClass: 'badge-emerald',
    icon: '🛡️',
    badgeColor: '#059669',
    summary: 'A tamper-resistant SQLite operational ledger capturing every user login, CSV upload, factor amendment, and status verification with immutable timestamps.',
    diagramType: 'audit',
    details: [
      {
        heading: 'Role-Based Lifecycle Verification',
        content: 'Suppliers submit raw telemetry (`UNDER_REVIEW`), Third-Party Auditors review and issue compliance stamp (`VERIFIED`), and Company Managers audit total corporate disclosures.'
      },
      {
        heading: 'Regulatory Assurance Level',
        content: 'Designed to satisfy ISO 14064-3 limited and reasonable assurance audits for mandatory ESG filings.'
      }
    ],
    formula: 'Audit Record = { Timestamp, User, Role, Action, Target_Entity, Payload_Diff, Signature }',
    standardRef: 'ISO 14064-3:2019 Greenhouse Gas Verification & ISAE 3410',
    regulatoryMandates: ['EU CSRD Mandatory Third-Party Assurance', 'SEC Attestation Requirement']
  },
  {
    id: 'csrd-esrs',
    categoryId: 'standards',
    title: 'CSRD & European Sustainability Standards (ESRS E1)',
    subtitle: 'Mandatory EU Corporate Climate Reporting Framework',
    tag: 'Regulatory Mandate',
    tagClass: 'badge-indigo',
    icon: '📜',
    badgeColor: '#4F46E5',
    summary: 'The comprehensive European Union mandate requiring large companies and listed SMEs to disclose detailed Scope 1, 2, and 3 GHG footprints, reduction targets, and transition plans.',
    diagramType: 'standards',
    details: [
      {
        heading: 'Double Materiality Principle',
        content: 'Companies must report both their impact on global climate change (Impact Materiality) and how climate risks financially impact the company (Financial Materiality).'
      },
      {
        heading: 'Scope 3 Phase-in Requirements',
        content: 'Mandatory full Scope 3 disclosure across all upstream and downstream material categories from reporting year 2024 onwards.'
      }
    ],
    formula: 'Disclosure Score = (Verified Scope 3 Coverage % × Data Quality Score) ÷ Target Trajectory',
    standardRef: 'Directive (EU) 2022/2464 (CSRD) & EFRAG ESRS E1 Climate Change',
    regulatoryMandates: ['EU CSRD', 'EU Taxonomy Regulation (2020/852)']
  }
];

export default function SustainabilityConceptsModal({ isOpen, onClose, initialConceptId = 'scope3' }) {
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedConcept, setSelectedConcept] = useState(initialConceptId || 'scope3');
  const [searchQuery, setSearchQuery] = useState('');

  // Update selected concept when initialConceptId changes
  useEffect(() => {
    if (initialConceptId) {
      setSelectedConcept(initialConceptId);
      const found = CONCEPTS.find(c => c.id === initialConceptId);
      if (found) {
        setSelectedCategory('all');
      }
    }
  }, [initialConceptId, isOpen]);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Filter concepts based on search & category
  const filteredConcepts = useMemo(() => {
    return CONCEPTS.filter(c => {
      const matchCat = selectedCategory === 'all' || c.categoryId === selectedCategory;
      const query = searchQuery.toLowerCase().trim();
      const matchSearch = !query || 
        c.title.toLowerCase().includes(query) ||
        c.subtitle.toLowerCase().includes(query) ||
        c.summary.toLowerCase().includes(query) ||
        c.standardRef.toLowerCase().includes(query) ||
        c.details.some(d => d.heading.toLowerCase().includes(query) || d.content.toLowerCase().includes(query));
      return matchCat && matchSearch;
    });
  }, [selectedCategory, searchQuery]);

  // Active concept
  const active = useMemo(() => {
    const found = CONCEPTS.find(c => c.id === selectedConcept);
    if (found) return found;
    return filteredConcepts[0] || CONCEPTS[0];
  }, [selectedConcept, filteredConcepts]);

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(6px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px 16px',
        animation: 'fadeIn 0.2s ease-out'
      }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        style={{
          width: '100%',
          maxWidth: '1120px',
          maxHeight: '90vh',
          backgroundColor: '#FFFFFF',
          borderRadius: '20px',
          border: '1px solid #E2E8F0',
          boxShadow: '0 25px 50px -12px rgba(15, 23, 42, 0.25), 0 0 0 1px rgba(0, 0, 0, 0.05)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          animation: 'slideUp 0.25s cubic-bezier(0.16, 1, 0.3, 1)'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{
          padding: '24px 32px',
          borderBottom: '1px solid #E2E8F0',
          background: 'linear-gradient(135deg, #F8FAFC 0%, #FFFFFF 100%)',
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: '20px'
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
              <span style={{
                background: 'rgba(6, 95, 70, 0.1)',
                color: '#065F46',
                fontSize: '12px',
                fontWeight: 800,
                padding: '4px 10px',
                borderRadius: '20px',
                letterSpacing: '0.04em',
                textTransform: 'uppercase'
              }}>
                📖 Scope 3 & ESG Knowledge Hub
              </span>
              <span style={{ color: '#64748B', fontSize: '13px' }}>GHG Protocol • ISO 14064 • CSRD ESRS E1</span>
            </div>
            <h2 style={{ fontSize: '22px', fontWeight: 800, color: '#0F172A', margin: 0, letterSpacing: '-0.02em' }}>
              Sustainability & Carbon Accounting Standards Reference
            </h2>
            <p style={{ fontSize: '13px', color: '#64748B', margin: '4px 0 0 0', lineHeight: 1.4 }}>
              Interactive guide to multi-tier emission calculations, standard conversion factors, and audit compliance mechanisms.
            </p>
          </div>

          <button
            onClick={onClose}
            style={{
              background: '#F1F5F9',
              border: 'none',
              borderRadius: '50%',
              width: '36px',
              height: '36px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: '#475569',
              fontSize: '18px',
              fontWeight: 700,
              transition: 'all 0.15s ease'
            }}
            onMouseOver={(e) => { e.currentTarget.style.background = '#E2E8F0'; e.currentTarget.style.color = '#0F172A'; }}
            onMouseOut={(e) => { e.currentTarget.style.background = '#F1F5F9'; e.currentTarget.style.color = '#475569'; }}
            aria-label="Close Guide"
          >
            ✕
          </button>
        </div>

        {/* Filter & Search Bar */}
        <div style={{
          padding: '16px 32px',
          background: '#FFFFFF',
          borderBottom: '1px solid #E2E8F0',
          display: 'flex',
          flexWrap: 'wrap',
          gap: '12px',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          {/* Category Tabs */}
          <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '2px' }}>
            {ESG_CATEGORIES.map(cat => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                style={{
                  padding: '6px 14px',
                  borderRadius: '20px',
                  fontSize: '12px',
                  fontWeight: 600,
                  border: selectedCategory === cat.id ? '1px solid #065F46' : '1px solid #E2E8F0',
                  background: selectedCategory === cat.id ? '#065F46' : '#F8FAFC',
                  color: selectedCategory === cat.id ? '#FFFFFF' : '#475569',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  whiteSpace: 'nowrap',
                  transition: 'all 0.15s ease'
                }}
              >
                <span>{cat.icon}</span>
                <span>{cat.label}</span>
              </button>
            ))}
          </div>

          {/* Search Box */}
          <div style={{ position: 'relative', minWidth: '240px' }}>
            <span style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', fontSize: '13px', color: '#94A3B8' }}>🔍</span>
            <input
              type="text"
              placeholder="Search concepts, formulas..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '7px 12px 7px 32px',
                borderRadius: '8px',
                border: '1px solid #CBD5E1',
                fontSize: '13px',
                color: '#0F172A',
                outline: 'none',
                background: '#F8FAFC'
              }}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                style={{
                  position: 'absolute',
                  right: '8px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  color: '#94A3B8',
                  cursor: 'pointer',
                  fontSize: '12px'
                }}
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Modal Body (2 Columns) */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '320px 1fr',
          flex: 1,
          overflow: 'hidden',
          minHeight: '440px'
        }}>
          {/* Left Column: Concept List */}
          <div style={{
            borderRight: '1px solid #E2E8F0',
            overflowY: 'auto',
            background: '#F8FAFC',
            padding: '12px'
          }}>
            {filteredConcepts.length === 0 ? (
              <div style={{ padding: '32px 16px', textAlign: 'center', color: '#64748B', fontSize: '13px' }}>
                No topics found matching "{searchQuery}".
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {filteredConcepts.map(c => {
                  const isCurrent = c.id === active.id;
                  return (
                    <button
                      key={c.id}
                      onClick={() => setSelectedConcept(c.id)}
                      style={{
                        padding: '12px 14px',
                        borderRadius: '10px',
                        border: isCurrent ? '1.5px solid #065F46' : '1px solid #E2E8F0',
                        background: isCurrent ? '#FFFFFF' : '#FFFFFF',
                        boxShadow: isCurrent ? '0 4px 6px -1px rgba(6, 95, 70, 0.1)' : 'none',
                        cursor: 'pointer',
                        textAlign: 'left',
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '12px',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <div style={{
                        fontSize: '20px',
                        background: isCurrent ? 'rgba(6, 95, 70, 0.1)' : '#F1F5F9',
                        padding: '6px',
                        borderRadius: '8px',
                        lineHeight: 1
                      }}>
                        {c.icon}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{
                          fontSize: '13px',
                          fontWeight: isCurrent ? 700 : 600,
                          color: isCurrent ? '#065F46' : '#0F172A',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis'
                        }}>
                          {c.title}
                        </div>
                        <div style={{
                          fontSize: '11px',
                          color: '#64748B',
                          marginTop: '2px',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis'
                        }}>
                          {c.subtitle}
                        </div>
                        <span style={{
                          display: 'inline-block',
                          marginTop: '6px',
                          fontSize: '10px',
                          fontWeight: 700,
                          padding: '2px 6px',
                          borderRadius: '4px',
                          background: isCurrent ? 'rgba(6, 95, 70, 0.12)' : '#F1F5F9',
                          color: isCurrent ? '#065F46' : '#475569'
                        }}>
                          {c.tag}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Right Column: Deep-Dive Content */}
          <div style={{
            overflowY: 'auto',
            padding: '28px 32px',
            background: '#FFFFFF'
          }}>
            {/* Active Title Banner */}
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px', marginBottom: '20px' }}>
              <div style={{
                width: '52px',
                height: '52px',
                borderRadius: '12px',
                background: 'rgba(6, 95, 70, 0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '26px'
              }}>
                {active.icon}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                  <span style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    padding: '3px 8px',
                    borderRadius: '12px',
                    background: 'rgba(6, 95, 70, 0.12)',
                    color: '#065F46',
                    letterSpacing: '0.04em'
                  }}>
                    {active.tag}
                  </span>
                  <span style={{ fontSize: '12px', color: '#64748B' }}>
                    {active.subtitle}
                  </span>
                </div>
                <h3 style={{ fontSize: '20px', fontWeight: 800, color: '#0F172A', margin: 0 }}>
                  {active.title}
                </h3>
              </div>
            </div>

            {/* Executive Summary Box */}
            <div style={{
              background: '#F8FAFC',
              borderRadius: '12px',
              padding: '16px 20px',
              border: '1px solid #E2E8F0',
              borderLeft: '4px solid #065F46',
              marginBottom: '24px'
            }}>
              <div style={{ fontSize: '11px', fontWeight: 800, color: '#065F46', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>
                Executive Summary
              </div>
              <div style={{ fontSize: '14px', color: '#1E293B', lineHeight: 1.6, fontWeight: 500 }}>
                {active.summary}
              </div>
            </div>

            {/* Mathematical / Calculation Formula */}
            {active.formula && (
              <div style={{
                background: '#0F172A',
                borderRadius: '10px',
                padding: '16px 20px',
                color: '#FFFFFF',
                marginBottom: '24px',
                boxShadow: '0 4px 6px -1px rgba(15, 23, 42, 0.1)'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span style={{ fontSize: '11px', fontWeight: 700, color: '#10B981', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    📐 Mathematical Calculation Derivation
                  </span>
                  <span style={{ fontSize: '11px', color: '#94A3B8' }}>Deterministic Engine</span>
                </div>
                <div style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace', fontSize: '13px', color: '#38BDF8', lineHeight: 1.5, wordBreak: 'break-word' }}>
                  {active.formula}
                </div>
              </div>
            )}

            {/* Core Mechanisms List */}
            <div style={{ marginBottom: '24px' }}>
              <h4 style={{ fontSize: '14px', fontWeight: 700, color: '#0F172A', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '14px' }}>
                Core Principles & Methodologies
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {active.details.map((item, idx) => (
                  <div
                    key={idx}
                    style={{
                      background: '#FFFFFF',
                      borderRadius: '10px',
                      padding: '14px 16px',
                      border: '1px solid #E2E8F0',
                      display: 'flex',
                      gap: '12px'
                    }}
                  >
                    <span style={{
                      color: '#059669',
                      fontWeight: 800,
                      fontSize: '14px',
                      marginTop: '1px'
                    }}>
                      ✓
                    </span>
                    <div>
                      <strong style={{ color: '#0F172A', fontSize: '13.5px', display: 'block', marginBottom: '4px' }}>
                        {item.heading}
                      </strong>
                      <p style={{ color: '#475569', fontSize: '13px', lineHeight: 1.5, margin: 0 }}>
                        {item.content}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Regulatory & Standards Footer Cards */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
              gap: '12px',
              marginTop: '20px'
            }}>
              <div style={{
                background: '#F8FAFC',
                borderRadius: '8px',
                padding: '12px 14px',
                border: '1px solid #E2E8F0',
                fontSize: '12px'
              }}>
                <div style={{ fontWeight: 700, color: '#0F172A', marginBottom: '4px' }}>📋 Primary Reference Standard:</div>
                <div style={{ color: '#475569' }}>{active.standardRef}</div>
              </div>

              {active.regulatoryMandates && (
                <div style={{
                  background: '#F8FAFC',
                  borderRadius: '8px',
                  padding: '12px 14px',
                  border: '1px solid #E2E8F0',
                  fontSize: '12px'
                }}>
                  <div style={{ fontWeight: 700, color: '#0F172A', marginBottom: '4px' }}>⚖️ Applicable Mandates:</div>
                  <div style={{ color: '#065F46', fontWeight: 600 }}>{active.regulatoryMandates.join(' • ')}</div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div style={{
          padding: '16px 32px',
          borderTop: '1px solid #E2E8F0',
          background: '#F8FAFC',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px'
        }}>
          <div style={{ fontSize: '12.5px', color: '#64748B' }}>
            💡 <em>Tip: Click any <span style={{ background: '#E2E8F0', padding: '1px 6px', borderRadius: '4px', color: '#0F172A', fontWeight: 600 }}>📖 ESG Guide</span> button in the header or tables to jump straight to relevant standards.</em>
          </div>

          <button
            onClick={onClose}
            style={{
              background: '#065F46',
              color: '#FFFFFF',
              border: 'none',
              padding: '10px 24px',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              boxShadow: '0 2px 4px rgba(6, 95, 70, 0.2)',
              transition: 'background 0.15s ease'
            }}
            onMouseOver={(e) => e.currentTarget.style.background = '#044e3a'}
            onMouseOut={(e) => e.currentTarget.style.background = '#065F46'}
          >
            Got it, Return to Workspace
          </button>
        </div>
      </div>
    </div>
  );
}
