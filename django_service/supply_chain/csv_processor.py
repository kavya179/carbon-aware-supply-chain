import io
import re
from decimal import Decimal
import pandas as pd
import numpy as np
from django.db import transaction
from .models import Supplier, SupplierRelationship, SupplierActivityData, AuditLog

REQUIRED_COLUMNS = [
    'supplier_id',
    'tier',
    'energy_consumption_kwh',
    'material_type',
    'material_quantity_kg',
    'distance_km',
    'transport_mode',
    'reporting_period'
]

VALID_TRANSPORT_MODES = {
    'road', 'truck', 'heavy truck', 'light commercial vehicle',
    'air', 'air freight', 'plane', 'flight',
    'sea', 'maritime', 'ship', 'container ship', 'ocean',
    'rail', 'train', 'freight train'
}

REPORTING_PERIOD_REGEX = re.compile(
    r'^(\d{4}-Q[1-4]|\d{4}-(0[1-9]|1[0-2])|\d{4}-H[1-2]|\d{4}|\d{4}-\d{2}-\d{2}(\s*(to|/)\s*)\d{4}-\d{2}-\d{2})$',
    re.IGNORECASE
)


class CSVValidationProcessor:
    """
    Validates and processes supplier activity data CSV files using Pandas.
    Enforces strict column validation, data types, unit/domain constraints,
    missing field detection, invalid value detection, and duplicate handling.
    Persists only valid records into SQLite.
    """

    def __init__(self, company, user=None):
        self.company = company
        self.user = user

    def process_csv(self, file_or_content):
        """
        Parses and validates CSV input.
        Input can be an uploaded file object (InMemoryUploadedFile), bytes, or a string.
        """
        # 1. Read content
        content = None
        if hasattr(file_or_content, 'read'):
            raw = file_or_content.read()
            if isinstance(raw, bytes):
                content = raw.decode('utf-8-sig', errors='replace')
            else:
                content = str(raw)
        elif isinstance(file_or_content, bytes):
            content = file_or_content.decode('utf-8-sig', errors='replace')
        else:
            content = str(file_or_content)

        # Handle empty content
        if not content or not content.strip():
            return {
                'success': False,
                'status': 'EMPTY_CSV',
                'error': 'The provided CSV file is completely empty.',
                'summary': {
                    'total_rows': 0,
                    'valid_rows_count': 0,
                    'invalid_rows_count': 0,
                    'duplicate_rows_count': 0,
                    'imported_records_count': 0
                },
                'validation_report': {
                    'valid_rows': [],
                    'invalid_rows': [],
                    'missing_fields': ['All required columns are missing (empty file)'],
                    'invalid_values': [],
                    'duplicate_rows': []
                }
            }

        # 2. Parse into Pandas DataFrame
        try:
            df = pd.read_csv(io.StringIO(content))
        except Exception as e:
            return {
                'success': False,
                'status': 'PARSE_ERROR',
                'error': f"Failed to parse CSV file: {str(e)}",
                'summary': {
                    'total_rows': 0,
                    'valid_rows_count': 0,
                    'invalid_rows_count': 0,
                    'duplicate_rows_count': 0,
                    'imported_records_count': 0
                },
                'validation_report': {
                    'valid_rows': [],
                    'invalid_rows': [],
                    'missing_fields': [],
                    'invalid_values': [str(e)],
                    'duplicate_rows': []
                }
            }

        # Handle DataFrame with no rows
        if len(df) == 0:
            return {
                'success': False,
                'status': 'NO_DATA_ROWS',
                'error': 'CSV contains column headers but zero data rows.',
                'summary': {
                    'total_rows': 0,
                    'valid_rows_count': 0,
                    'invalid_rows_count': 0,
                    'duplicate_rows_count': 0,
                    'imported_records_count': 0
                },
                'validation_report': {
                    'valid_rows': [],
                    'invalid_rows': [],
                    'missing_fields': [],
                    'invalid_values': [],
                    'duplicate_rows': []
                }
            }

        # Normalize column names (lowercase, strip whitespace, replace spaces with underscores)
        normalized_cols = {col: str(col).strip().lower().replace(' ', '_') for col in df.columns}
        df.rename(columns=normalized_cols, inplace=True)

        # 3. Validate Required Columns
        missing_columns = [col for col in REQUIRED_COLUMNS if col not in df.columns]
        if missing_columns:
            return {
                'success': False,
                'status': 'MISSING_COLUMNS',
                'error': f"Missing required columns in CSV: {', '.join(missing_columns)}",
                'missing_columns': missing_columns,
                'summary': {
                    'total_rows': len(df),
                    'valid_rows_count': 0,
                    'invalid_rows_count': len(df),
                    'duplicate_rows_count': 0,
                    'imported_records_count': 0
                },
                'validation_report': {
                    'valid_rows': [],
                    'invalid_rows': [{'row_number': 'all', 'error': f"CSV missing required columns: {missing_columns}"}],
                    'missing_fields': missing_columns,
                    'invalid_values': [],
                    'duplicate_rows': []
                }
            }

        # 4. Check for Duplicate Rows using Pandas
        # Identify duplicates across the key business identifiers
        key_cols = ['supplier_id', 'reporting_period', 'transport_mode', 'material_type']
        duplicate_mask = df.duplicated(subset=key_cols, keep='first')

        # 5. Row-by-Row Validation & Standardization
        valid_rows = []
        invalid_rows = []
        duplicate_rows = []
        missing_fields_summary = []
        invalid_values_summary = []
        records_to_create = []

        # Cache company's authorized suppliers
        authorized_suppliers = {}
        if self.company:
            rels = SupplierRelationship.objects.filter(company=self.company).select_related('supplier')
            for r in rels:
                authorized_suppliers[r.supplier_id] = r
                authorized_suppliers[str(r.supplier_id)] = r
                authorized_suppliers[r.supplier.supplier_code.lower()] = r

        for idx, row in df.iterrows():
            row_num = idx + 2  # 1-indexed, accounting for header
            row_missing = []
            row_invalid = []
            row_data = row.to_dict()

            # Clean NaNs in row_data for clean reporting
            clean_row_dict = {}
            for k, v in row_data.items():
                if pd.isna(v):
                    clean_row_dict[k] = None
                else:
                    clean_row_dict[k] = v

            is_dup = bool(duplicate_mask.iloc[idx])
            if is_dup:
                dup_info = {
                    'row_number': row_num,
                    'supplier_id': clean_row_dict.get('supplier_id'),
                    'reporting_period': clean_row_dict.get('reporting_period'),
                    'reason': 'Duplicate row identical to an earlier record in this upload.'
                }
                duplicate_rows.append(dup_info)
                row_invalid.append("Duplicate row identical to an earlier record in the CSV.")

            # Validate supplier_id
            raw_supp_id = clean_row_dict.get('supplier_id')
            matched_rel = None
            if raw_supp_id is None or str(raw_supp_id).strip() == '':
                row_missing.append('supplier_id')
            else:
                s_str = str(raw_supp_id).strip()
                # Handle float conversion from pandas (e.g. 8.0 -> 8)
                if s_str.endswith('.0'):
                    s_str = s_str[:-2]

                matched_rel = authorized_suppliers.get(s_str) or authorized_suppliers.get(s_str.lower())
                if not matched_rel:
                    try:
                        int_id = int(float(s_str))
                        matched_rel = authorized_suppliers.get(int_id)
                    except ValueError:
                        pass

                if not matched_rel:
                    row_invalid.append(
                        f"supplier_id '{raw_supp_id}': Supplier does not exist or does not belong to your company's supply chain."
                    )

            # Validate tier
            raw_tier = clean_row_dict.get('tier')
            tier_val = None
            if raw_tier is None:
                row_missing.append('tier')
            else:
                try:
                    tier_val = int(raw_tier)
                    if tier_val not in (1, 2, 3):
                        row_invalid.append(f"tier '{raw_tier}': Tier must be 1, 2, or 3.")
                except (ValueError, TypeError):
                    row_invalid.append(f"tier '{raw_tier}': Tier must be a valid integer (1, 2, or 3).")

            # Validate reporting_period
            raw_period = clean_row_dict.get('reporting_period')
            period_str = ''
            if raw_period is None or str(raw_period).strip() == '':
                row_missing.append('reporting_period')
            else:
                period_str = str(raw_period).strip()
                if not REPORTING_PERIOD_REGEX.match(period_str):
                    row_invalid.append(
                        f"reporting_period '{period_str}': Invalid period format. Expected 'YYYY-Q1'..'YYYY-Q4', 'YYYY-MM', 'YYYY', or 'YYYY-MM-DD to YYYY-MM-DD'."
                    )

            # Validate energy_consumption_kwh
            raw_energy = clean_row_dict.get('energy_consumption_kwh')
            energy_val = None
            if raw_energy is not None:
                try:
                    energy_val = float(raw_energy)
                    if np.isnan(energy_val):
                        energy_val = None
                    elif energy_val < 0:
                        row_invalid.append(f"energy_consumption_kwh '{energy_val}': Negative energy value is not permitted.")
                except (ValueError, TypeError):
                    row_invalid.append(f"energy_consumption_kwh '{raw_energy}': Must be a valid numeric decimal.")

            # Validate material_quantity_kg
            raw_mat_qty = clean_row_dict.get('material_quantity_kg')
            mat_qty_val = None
            if raw_mat_qty is not None:
                try:
                    mat_qty_val = float(raw_mat_qty)
                    if np.isnan(mat_qty_val):
                        mat_qty_val = None
                    elif mat_qty_val < 0:
                        row_invalid.append(f"material_quantity_kg '{mat_qty_val}': Negative material quantity is not permitted.")
                except (ValueError, TypeError):
                    row_invalid.append(f"material_quantity_kg '{raw_mat_qty}': Must be a valid numeric decimal.")

            # Validate distance_km
            raw_dist = clean_row_dict.get('distance_km')
            dist_val = None
            if raw_dist is not None:
                try:
                    dist_val = float(raw_dist)
                    if np.isnan(dist_val):
                        dist_val = None
                    elif dist_val < 0:
                        row_invalid.append(f"distance_km '{dist_val}': Negative transportation distance is not permitted.")
                except (ValueError, TypeError):
                    row_invalid.append(f"distance_km '{raw_dist}': Must be a valid numeric decimal.")

            # Validate transport_mode
            raw_tmode = clean_row_dict.get('transport_mode')
            tmode_str = ''
            if raw_tmode is not None and not pd.isna(raw_tmode):
                tmode_str = str(raw_tmode).strip()
                if tmode_str and tmode_str.lower() not in VALID_TRANSPORT_MODES:
                    row_invalid.append(
                        f"transport_mode '{tmode_str}': Unrecognized transport mode. Must be Road, Air, Sea, or Rail."
                    )

            # Ensure at least one activity stream is provided
            has_energy = energy_val is not None and energy_val > 0
            has_mat = mat_qty_val is not None and mat_qty_val > 0
            has_trans = dist_val is not None and dist_val > 0

            if not has_energy and not has_mat and not has_trans and not row_missing and not row_invalid:
                row_invalid.append("Row contains zero activity quantities across energy, transportation, and materials.")

            # Aggregate row results
            if row_missing or row_invalid or is_dup:
                invalid_info = {
                    'row_number': row_num,
                    'data': clean_row_dict,
                    'missing_fields': row_missing,
                    'invalid_values': row_invalid,
                    'is_duplicate': is_dup
                }
                invalid_rows.append(invalid_info)
                if row_missing:
                    missing_fields_summary.extend([f"Row {row_num}: Missing {f}" for f in row_missing])
                if row_invalid:
                    invalid_values_summary.extend([f"Row {row_num}: {e}" for e in row_invalid])
            else:
                # Valid Row: Standardize and prepare records for SQLite persistence
                supplier_entity = matched_rel.supplier
                created_count = 0

                # 1. Energy Record
                if has_energy:
                    records_to_create.append(SupplierActivityData(
                        supplier=supplier_entity,
                        reporting_period=period_str,
                        activity_type='Electricity Consumption',
                        quantity=Decimal(str(round(energy_val, 4))),
                        unit='kWh',
                        source='CSV Upload',
                        verification_status='UNVERIFIED',
                        submitted_by=self.user,
                        metadata={
                            'csv_row': row_num,
                            'tier': tier_val,
                            'raw_source': 'Pandas CSV Processor'
                        }
                    ))
                    created_count += 1

                # 2. Transportation Record
                if has_trans:
                    records_to_create.append(SupplierActivityData(
                        supplier=supplier_entity,
                        reporting_period=period_str,
                        activity_type='Freight Transportation',
                        quantity=Decimal(str(round(dist_val, 2))),
                        unit='km',
                        distance=Decimal(str(round(dist_val, 2))),
                        transport_mode=tmode_str.title() if tmode_str else 'Road',
                        source='CSV Upload',
                        verification_status='UNVERIFIED',
                        submitted_by=self.user,
                        metadata={
                            'csv_row': row_num,
                            'tier': tier_val,
                            'raw_source': 'Pandas CSV Processor'
                        }
                    ))
                    created_count += 1

                # 3. Materials Record
                if has_mat:
                    mat_type_str = str(clean_row_dict.get('material_type') or 'General Materials').strip()
                    records_to_create.append(SupplierActivityData(
                        supplier=supplier_entity,
                        reporting_period=period_str,
                        activity_type='Raw Material Procurement',
                        quantity=Decimal(str(round(mat_qty_val, 4))),
                        unit='kg',
                        material_type=mat_type_str,
                        source='CSV Upload',
                        verification_status='UNVERIFIED',
                        submitted_by=self.user,
                        metadata={
                            'csv_row': row_num,
                            'tier': tier_val,
                            'material_type': mat_type_str,
                            'raw_source': 'Pandas CSV Processor'
                        }
                    ))
                    created_count += 1

                valid_rows.append({
                    'row_number': row_num,
                    'supplier_id': supplier_entity.id,
                    'supplier_name': supplier_entity.name,
                    'tier': tier_val,
                    'reporting_period': period_str,
                    'records_created': created_count
                })

        # 6. Database Persistence (Strict SQLite insertion only for valid rows)
        inserted_count = 0
        if records_to_create:
            with transaction.atomic():
                for rec in records_to_create:
                    rec.save()
                    inserted_count += 1

                # Audit Log
                if self.user:
                    AuditLog.objects.create(
                        user=self.user,
                        action='CSV_DATA_UPLOADED',
                        entity_type='SupplierActivityData',
                        entity_id=str(records_to_create[0].id) if records_to_create else 'bulk',
                        details={
                            'total_rows': len(df),
                            'valid_rows': len(valid_rows),
                            'invalid_rows': len(invalid_rows),
                            'inserted_records': inserted_count
                        }
                    )

        overall_status = 'SUCCESS' if not invalid_rows else ('PARTIAL_SUCCESS' if valid_rows else 'VALIDATION_FAILED')

        return {
            'success': len(valid_rows) > 0,
            'status': overall_status,
            'summary': {
                'total_rows': len(df),
                'valid_rows_count': len(valid_rows),
                'invalid_rows_count': len(invalid_rows),
                'duplicate_rows_count': len(duplicate_rows),
                'imported_records_count': inserted_count
            },
            'validation_report': {
                'valid_rows': valid_rows,
                'invalid_rows': invalid_rows,
                'missing_fields': missing_fields_summary,
                'invalid_values': invalid_values_summary,
                'duplicate_rows': duplicate_rows
            }
        }
