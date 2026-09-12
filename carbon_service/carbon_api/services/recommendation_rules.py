"""
Recommendation Rules Engine
===========================
Generates lower-carbon alternatives for Energy, Transport, and Material 
inputs using a transparent rule-based system.
"""

class RecommendationEngineRules:

    @staticmethod
    def evaluate_energy(energy_data, current_co2e):
        """
        Evaluate energy inputs and recommend renewable alternatives.
        """
        if not energy_data or not current_co2e:
            return None
            
        source = str(energy_data.get('source', '')).strip().lower()
        
        # If already renewable, no major recommendation
        if source in ['solar', 'wind', 'hydroelectric', 'renewable ppa']:
            return None
            
        # For Grid or Fossil fuels
        # Assume moving to 100% Renewable PPA drops emissions to 0 (Scope 2 market-based)
        alternative_co2e = 0.0
        savings = current_co2e
        reduction_pct = 100.0
        
        return {
            "type": "Energy",
            "currentSituation": f"Using {energy_data.get('source')} for electricity/power.",
            "recommendedAlternative": "Switch to a 100% Renewable Energy PPA (Power Purchase Agreement) or install on-site Solar.",
            "currentCO2e": round(current_co2e, 2),
            "alternativeCO2e": alternative_co2e,
            "co2Savings": round(savings, 2),
            "percentageReduction": reduction_pct
        }

    @staticmethod
    def evaluate_transport(transport_data, current_co2e):
        """
        Evaluate transport inputs and recommend modal shifts.
        """
        if not transport_data or not current_co2e:
            return None
            
        mode = str(transport_data.get('mode', '')).strip().lower()
        distance = float(transport_data.get('distance', 0))
        
        # Rule 1: Shift long-distance road freight to rail
        if ('road' in mode or 'hgv' in mode or 'van' in mode) and distance > 500:
            # Rail is roughly 70-80% more efficient than road freight per tonne-km
            reduction_pct = 75.0
            savings = current_co2e * (reduction_pct / 100)
            alternative_co2e = current_co2e - savings
            
            return {
                "type": "Transport",
                "currentSituation": f"Long-distance freight ({distance} {transport_data.get('distanceUnit', 'km')}) via {transport_data.get('mode')}.",
                "recommendedAlternative": "Shift freight from Road to Rail network for the primary long-haul leg.",
                "currentCO2e": round(current_co2e, 2),
                "alternativeCO2e": round(alternative_co2e, 2),
                "co2Savings": round(savings, 2),
                "percentageReduction": reduction_pct
            }
            
        # Rule 2: Shift short-haul road to electric
        if ('road' in mode or 'van' in mode) and distance <= 500:
            # EV shift saves ~65% on grid averages
            reduction_pct = 65.0
            savings = current_co2e * (reduction_pct / 100)
            alternative_co2e = current_co2e - savings
            
            return {
                "type": "Transport",
                "currentSituation": f"Short-haul logistics via ICE {transport_data.get('mode')}.",
                "recommendedAlternative": "Transition local logistics fleet to Electric Vehicles (EVs).",
                "currentCO2e": round(current_co2e, 2),
                "alternativeCO2e": round(alternative_co2e, 2),
                "co2Savings": round(savings, 2),
                "percentageReduction": reduction_pct
            }
            
        # Rule 3: Air freight
        if 'air' in mode:
            reduction_pct = 90.0
            savings = current_co2e * (reduction_pct / 100)
            alternative_co2e = current_co2e - savings
            return {
                "type": "Transport",
                "currentSituation": f"High-impact Air Freight used.",
                "recommendedAlternative": "Shift from Air to Sea (Container) Freight where lead times allow.",
                "currentCO2e": round(current_co2e, 2),
                "alternativeCO2e": round(alternative_co2e, 2),
                "co2Savings": round(savings, 2),
                "percentageReduction": reduction_pct
            }
            
        return None

    @staticmethod
    def evaluate_material(material_data, current_co2e):
        """
        Evaluate material inputs and recommend circular alternatives.
        """
        if not material_data or not current_co2e:
            return None
            
        mat_type = str(material_data.get('type', '')).strip().lower()
        
        # Rule 1: Plastics
        if 'plastic' in mat_type or 'polymer' in mat_type:
            # 100% recycled plastic saves ~40-50% emissions vs virgin
            reduction_pct = 45.0
            savings = current_co2e * (reduction_pct / 100)
            alternative_co2e = current_co2e - savings
            return {
                "type": "Material",
                "currentSituation": f"Using virgin {material_data.get('type')}.",
                "recommendedAlternative": "Switch to 100% Post-Consumer Recycled (PCR) Plastics.",
                "currentCO2e": round(current_co2e, 2),
                "alternativeCO2e": round(alternative_co2e, 2),
                "co2Savings": round(savings, 2),
                "percentageReduction": reduction_pct
            }
            
        # Rule 2: Metals
        if 'metal' in mat_type or 'steel' in mat_type or 'aluminum' in mat_type:
            # Recycled metals save 60-90% (using conservative 65% average)
            reduction_pct = 65.0
            savings = current_co2e * (reduction_pct / 100)
            alternative_co2e = current_co2e - savings
            return {
                "type": "Material",
                "currentSituation": f"Using primary {material_data.get('type')}.",
                "recommendedAlternative": "Source secondary (scrap/recycled) metals. e.g. EAF steel or recycled aluminum.",
                "currentCO2e": round(current_co2e, 2),
                "alternativeCO2e": round(alternative_co2e, 2),
                "co2Savings": round(savings, 2),
                "percentageReduction": reduction_pct
            }
            
        # Default circular recommendation for general materials
        reduction_pct = 30.0
        savings = current_co2e * (reduction_pct / 100)
        alternative_co2e = current_co2e - savings
        return {
            "type": "Material",
            "currentSituation": f"Using {material_data.get('type') or 'standard material'}.",
            "recommendedAlternative": "Increase recycled content and implement circular take-back schemes.",
            "currentCO2e": round(current_co2e, 2),
            "alternativeCO2e": round(alternative_co2e, 2),
            "co2Savings": round(savings, 2),
            "percentageReduction": reduction_pct
        }

    @classmethod
    def generate(cls, footprint_data):
        """
        Main entry point. Takes the footprint output from ComprehensiveCalculator
        and the raw inputs, and returns a list of viable recommendations.
        """
        recommendations = []
        
        inputs = footprint_data.get('inputs', {})
        results = footprint_data.get('results', {})
        
        # Check Energy
        energy_rec = cls.evaluate_energy(inputs.get('energy'), results.get('energyEmissions'))
        if energy_rec:
            recommendations.append(energy_rec)
            
        # Check Transport
        transport_rec = cls.evaluate_transport(inputs.get('transport'), results.get('transportEmissions'))
        if transport_rec:
            recommendations.append(transport_rec)
            
        # Check Material
        material_rec = cls.evaluate_material(inputs.get('material'), results.get('materialEmissions'))
        if material_rec:
            recommendations.append(material_rec)
            
        # Supplier recommendation (if transport distance is very high, suggest local sourcing)
        transport_data = inputs.get('transport', {})
        if transport_data and float(transport_data.get('distance', 0)) > 3000:
            savings = results.get('transportEmissions', 0) * 0.8 # Assume 80% drop in transport by near-shoring
            if savings > 0:
                recommendations.append({
                    "type": "Supplier",
                    "currentSituation": f"Sourcing from distant supplier ({transport_data.get('distance')} km).",
                    "recommendedAlternative": "Near-shore sourcing to a local/regional supplier.",
                    "currentCO2e": round(results.get('totalEmissions_tCO2e', 0), 2),
                    "alternativeCO2e": round(results.get('totalEmissions_tCO2e', 0) - savings, 2),
                    "co2Savings": round(savings, 2),
                    "percentageReduction": round((savings / results.get('totalEmissions_tCO2e', 1)) * 100, 2)
                })
                
        # Sort by biggest savings
        recommendations.sort(key=lambda x: x['co2Savings'], reverse=True)
        return recommendations
