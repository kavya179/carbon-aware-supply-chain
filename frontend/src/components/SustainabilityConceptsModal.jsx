import React, { useState } from 'react';

const CONCEPTS = [
  {
    id: 'scope3',
    title: 'Scope 3 Greenhouse Gas Emissions',
    tag: 'GHG Protocol Standard',
    tagClass: 'badge-emerald',
    icon: '🌍',
    summary: 'Indirect value chain emissions that occur outside an enterprise\'s direct physical operations.',
    details: [
      'Scope 1: Direct emissions from company-owned facilities and vehicle fleets.',
      'Scope 2: Indirect emissions from purchased grid electricity, steam, heating, and cooling.',
      'Scope 3: Upstream and downstream value chain emissions (purchased goods, raw material extraction, logistics, product lifecycle). Scope 3 typically accounts for 70% to 90% of a manufacturing enterprise\'s total footprint.'
    ],
    standardRef: 'GHG Protocol Corporate Value Chain (Scope 3) Accounting and Reporting Standard'
  },
  {
    id: 'co2e',
    title: 'CO₂e (Carbon Dioxide Equivalent)',
    tag: 'Metric & Unit',
    tagClass: 'badge-blue',
    icon: '⚖️',
    summary: 'The standard universal metric used to aggregate and compare different greenhouse gases.',
    details: [
      'Different greenhouse gases (Carbon Dioxide CO₂, Methane CH₄, Nitrous Oxide N₂O, and F-gases) trap heat in the atmosphere at different rates.',
      'CO₂e converts all gases into the equivalent mass of CO₂ based on their 100-year Global Warming Potential (GWP100). For example, 1 metric ton of CH₄ equals ~28 tCO₂e.',
      '1 tCO₂e (Metric Tonne CO₂e) = 1,000 kg CO₂e.'
    ],
    standardRef: 'IPCC Sixth Assessment Report (AR6) Global Warming Potentials'
  },
  {
    id: 'tiers',
    title: 'Multi-Tier Supply Chain Levels (Tier 1, 2, 3)',
    tag: 'Supply Hierarchy',
    tagClass: 'badge-violet',
    icon: '🏢',
    summary: 'The hierarchical depth of suppliers supplying components and raw materials.',
    details: [
      'Tier 1 (Direct Suppliers): Vendors with direct commercial contracts and purchase orders (e.g. Battery Assemblers, Chassis Fabricators).',
      'Tier 2 (Sub-tier Manufacturers): Suppliers that provide sub-assemblies and components to Tier 1 vendors (e.g. Semiconductor Foundries, Cell Producers).',
      'Tier 3 (Raw Material & Mining): Upstream entities extracting, refining, and smelting base commodities (e.g. Cobalt Mines, Lithium Refineries, Aluminum Smelters).'
    ],
    standardRef: 'ISO 20400:2017 Sustainable Procurement Guidance'
  },
  {
    id: 'emission-factor',
    title: 'Emission Factor (EF)',
    tag: 'Calculation Core',
    tagClass: 'badge-amber',
    icon: '🔢',
    summary: 'A scientifically validated multiplier converting activity volume into equivalent GHG mass.',
    details: [
      'Deterministic Calculation: Emissions (kg CO₂e) = Activity Quantity × Emission Factor.',
      'Material Example: 1,000 kg of Virgin Aluminum × 8.24 kg CO₂e/kg = 8,240 kg CO₂e.',
      'Transport Example: 50 tonnes over 500 km by Air Freight = 25,000 t·km × 0.602 kg CO₂e/t·km = 15,050 kg CO₂e.',
      'Sources: DEFRA, ecoinvent, US EPA GHG Hub.'
    ],
    standardRef: 'EPA Emission Factors for GHG Inventories & UK DEFRA Conversion Factors'
  },
  {
    id: 'hotspot',
    title: 'Carbon Hotspot',
    tag: 'Risk & Priority',
    tagClass: 'badge-rose',
    icon: '🔥',
    summary: 'A supplier, material, or route contributing disproportionately to overall emissions.',
    details: [
      'HIGH Hotspot (≥ 20% Contribution): Critical driver of enterprise footprint. Highest priority for supplier decarbonization partnerships or circular material substitution.',
      'MEDIUM Hotspot (5% – 20% Contribution): Significant contributor requiring targeted efficiency improvements and renewable energy adoption.',
      'LOW Hotspot (< 5% Contribution): Baseline operational emissions subject to standard periodic review.'
    ],
    standardRef: 'UNEP / SETAC Life Cycle Initiative Hotspot Analysis Framework'
  },
  {
    id: 'ml-estimate',
    title: 'ML-Estimated Value',
    tag: 'Statistical Gap-Filling',
    tagClass: 'badge-teal',
    icon: '🤖',
    summary: 'A supervised machine learning prediction used when supplier primary data is missing.',
    details: [
      'Purpose: Fills data gaps for unverified or non-responsive Tier 2/3 suppliers using trained Random Forest Regressors based on industry, distance, energy, and material weight.',
      'Governance Rule: ML predictions are explicitly flagged as ML_ESTIMATED in the database.',
      'Integrity: ML predictions NEVER overwrite audited supplier primary data and do not substitute for formal regulatory verification.'
    ],
    standardRef: 'Partnership for Carbon Accounting Financials (PCAF) Data Quality Hierarchy'
  }
];

export default function SustainabilityConceptsModal({ isOpen, onClose, initialConceptId = null }) {
  const [selectedConcept, setSelectedConcept] = useState(initialConceptId || 'scope3');

  if (!isOpen) return null;

  const active = CONCEPTS.find(c => c.id === selectedConcept) || CONCEPTS[0];

  return (
    <div className="modal-backdrop" onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="modal-title">
      <div className="concepts-modal-card" onClick={e => e.stopPropagation()}>
        {/* Modal Header */}
        <div className="concepts-modal-header">
          <div className="concepts-modal-title-group">
            <span className="concepts-modal-badge">📖 ESG Knowledge Center</span>
            <h2 id="modal-title" className="concepts-modal-title">Scope 3 & Sustainability Concepts Guide</h2>
            <p className="concepts-modal-desc">
              Understand key carbon accounting principles, calculation standards, and supply chain governance terminology.
            </p>
          </div>
          <button className="btn-close-modal" onClick={onClose} aria-label="Close Guide">
            ✕
          </button>
        </div>

        {/* Modal Body: 2-Column Layout */}
        <div className="concepts-modal-body">
          {/* Left: Concept Selector Tabs */}
          <div className="concepts-nav-list">
            {CONCEPTS.map(c => {
              const isCurrent = c.id === selectedConcept;
              return (
                <button
                  key={c.id}
                  className={`concept-nav-item ${isCurrent ? 'concept-nav-item-active' : ''}`}
                  onClick={() => setSelectedConcept(c.id)}
                >
                  <span className="concept-item-icon">{c.icon}</span>
                  <div className="concept-item-info">
                    <div className="concept-item-name">{c.title}</div>
                    <span className={`concept-tag ${c.tagClass}`}>{c.tag}</span>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Right: Concept Deep-Dive Pane */}
          <div className="concept-detail-pane">
            <div className="concept-detail-header">
              <div className="concept-detail-icon">{active.icon}</div>
              <div>
                <span className={`concept-tag ${active.tagClass}`}>{active.tag}</span>
                <h3 className="concept-detail-title">{active.title}</h3>
              </div>
            </div>

            <div className="concept-summary-box">
              <strong>Executive Summary:</strong> {active.summary}
            </div>

            <div className="concept-points-section">
              <h4 className="concept-points-heading">Core Mechanisms & Definitions</h4>
              <ul className="concept-points-list">
                {active.details.map((point, idx) => (
                  <li key={idx} className="concept-point-item">
                    <span className="point-bullet">✓</span>
                    <span>{point}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="concept-standard-ref">
              <span className="ref-icon">📋</span>
              <span><strong>Reporting Framework Reference:</strong> {active.standardRef}</span>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="concepts-modal-footer">
          <div className="footer-tip">
            💡 <em>Tip: Look for the <span className="help-icon-preview">ℹ️</span> icons across charts and tables for context-specific explanations.</em>
          </div>
          <button className="btn btn-primary" onClick={onClose}>
            Got it, return to Dashboard
          </button>
        </div>
      </div>
    </div>
  );
}
