import React, { useState } from 'react';

export default function ConceptTooltip({ conceptId, label, tooltipText, onOpenGuide }) {
  const [showTooltip, setShowTooltip] = useState(false);

  return (
    <span
      className="concept-tooltip-wrapper"
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
      onFocus={() => setShowTooltip(true)}
      onBlur={() => setShowTooltip(false)}
    >
      <button
        type="button"
        className="concept-tooltip-trigger"
        onClick={(e) => {
          e.stopPropagation();
          if (onOpenGuide) onOpenGuide(conceptId);
        }}
        aria-label={`Learn more about ${label || conceptId}`}
        title={`Click to open ${label || conceptId} in ESG Guide`}
      >
        ℹ️
      </button>

      {showTooltip && (
        <span className="concept-tooltip-bubble" role="tooltip">
          <span className="tooltip-title">{label}</span>
          <span className="tooltip-text">{tooltipText}</span>
          <span className="tooltip-cta">Click icon for full ESG standard & guide ↗</span>
        </span>
      )}
    </span>
  );
}
