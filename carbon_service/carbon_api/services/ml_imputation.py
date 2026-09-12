"""
ML Imputation Service
=====================
Uses Scikit-Learn RandomForestRegressor to estimate missing continuous values
(like transport distance, or energy consumption) based on available features
from the supplier's footprint data.
"""

import pandas as pd
import numpy as np
from sklearn.ensemble import RandomForestRegressor
from sklearn.preprocessing import LabelEncoder
import logging

logger = logging.getLogger(__name__)

class MLImputationEngine:
    _is_trained = False
    _rf_distance = None
    _rf_energy = None
    _le_material = LabelEncoder()
    _le_transport = LabelEncoder()
    _le_energy_source = LabelEncoder()

    @classmethod
    def _train_dummy_models(cls):
        """
        Since we lack a massive historical DB, we bootstrap synthetic data
        to train a basic Random Forest Regressor on startup.
        In production, this would load pre-trained .pkl models.
        """
        if cls._is_trained:
            return

        logger.info("Training ML Imputation Engine (Synthetic Data)...")
        np.random.seed(42)
        n_samples = 1000

        # Features: Material Quantity, Material Type (encoded), Transport Mode (encoded)
        # Targets: Transport Distance, Energy Consumption

        # Generate synthetic categories
        materials = ['Steel', 'Plastic', 'Chemical', 'Wood', 'Electronics']
        modes = ['Road', 'Rail', 'Sea', 'Air']
        sources = ['Grid', 'Diesel', 'Natural Gas', 'Renewable PPA']

        df = pd.DataFrame({
            'mat_type': np.random.choice(materials, n_samples),
            'mat_quantity': np.random.uniform(10, 10000, n_samples), # tonnes
            'trans_mode': np.random.choice(modes, n_samples),
            'energy_source': np.random.choice(sources, n_samples),
        })

        # Synthetic relationships
        # e.g., Air freight implies longer distances
        def synth_distance(row):
            base = row['mat_quantity'] * 0.1
            if row['trans_mode'] == 'Air': return base + np.random.uniform(1000, 5000)
            if row['trans_mode'] == 'Sea': return base + np.random.uniform(2000, 10000)
            if row['trans_mode'] == 'Rail': return base + np.random.uniform(200, 2000)
            return base + np.random.uniform(10, 500) # Road

        # e.g., Steel/Chemicals take more energy per tonne
        def synth_energy(row):
            base = row['mat_quantity'] * np.random.uniform(5, 10)
            if row['mat_type'] in ['Steel', 'Chemical']:
                base *= np.random.uniform(2, 5)
            return base

        df['trans_distance'] = df.apply(synth_distance, axis=1)
        df['energy_consumption'] = df.apply(synth_energy, axis=1)

        # Encode categorical
        df['mat_type_enc'] = cls._le_material.fit_transform(df['mat_type'])
        df['trans_mode_enc'] = cls._le_transport.fit_transform(df['trans_mode'])
        df['energy_source_enc'] = cls._le_energy_source.fit_transform(df['energy_source'])

        # Train Distance Predictor
        # Features: mat_quantity, mat_type_enc, trans_mode_enc
        X_dist = df[['mat_quantity', 'mat_type_enc', 'trans_mode_enc']]
        y_dist = df['trans_distance']
        cls._rf_distance = RandomForestRegressor(n_estimators=50, random_state=42)
        cls._rf_distance.fit(X_dist, y_dist)

        # Train Energy Predictor
        # Features: mat_quantity, mat_type_enc, energy_source_enc
        X_energy = df[['mat_quantity', 'mat_type_enc', 'energy_source_enc']]
        y_energy = df['energy_consumption']
        cls._rf_energy = RandomForestRegressor(n_estimators=50, random_state=42)
        cls._rf_energy.fit(X_energy, y_energy)

        cls._is_trained = True
        logger.info("ML Imputation Models ready.")

    @classmethod
    def _safe_encode(cls, encoder, val, fallback=0):
        try:
            return encoder.transform([val])[0]
        except ValueError:
            return fallback

    @classmethod
    def impute_missing_data(cls, payload: dict) -> dict:
        """
        Receives a footprint payload and imputes missing continuous values using ML.
        Returns the mutated payload with an 'isEstimated' flag on imputed fields.
        """
        if not cls._is_trained:
            cls._train_dummy_models()

        inputs = payload.get('inputs', payload) # Handle nested or flat payloads
        flags = {"energy": False, "transport": False}

        energy = inputs.get('energy', {})
        transport = inputs.get('transport', {})
        material = inputs.get('material', {})

        # Extract known features
        mat_qty = float(material.get('quantity', 0) or 0)
        mat_type = str(material.get('type', 'Other'))
        
        # 1. Impute Transport Distance
        if not transport.get('distance'):
            trans_mode = str(transport.get('mode', 'Road'))
            
            # Prepare feature vector
            mat_type_enc = cls._safe_encode(cls._le_material, mat_type)
            trans_mode_enc = cls._safe_encode(cls._le_transport, trans_mode)
            
            X_pred = pd.DataFrame({
                'mat_quantity': [mat_qty],
                'mat_type_enc': [mat_type_enc],
                'trans_mode_enc': [trans_mode_enc]
            })
            
            predicted_dist = cls._rf_distance.predict(X_pred)[0]
            transport['distance'] = round(predicted_dist, 2)
            flags['transport'] = True

        # 2. Impute Energy Consumption
        if not energy.get('consumption'):
            energy_source = str(energy.get('source', 'Grid'))
            
            # Prepare feature vector
            mat_type_enc = cls._safe_encode(cls._le_material, mat_type)
            energy_source_enc = cls._safe_encode(cls._le_energy_source, energy_source)
            
            X_pred = pd.DataFrame({
                'mat_quantity': [mat_qty],
                'mat_type_enc': [mat_type_enc],
                'energy_source_enc': [energy_source_enc]
            })
            
            predicted_energy = cls._rf_energy.predict(X_pred)[0]
            energy['consumption'] = round(predicted_energy, 2)
            flags['energy'] = True

        inputs['energy'] = energy
        inputs['transport'] = transport
        inputs['estimationFlags'] = flags
        
        # If payload was flat, just return inputs
        if 'inputs' in payload:
            payload['inputs'] = inputs
            return payload
        return inputs
