/**
 * CSV Parser Utility (Node.js side)
 * ===================================
 * Light-weight CSV parsing using csv-parse.
 * Used for fast schema-level validation BEFORE sending to Django/Pandas.
 *
 * Django handles deep statistical validation and emission calculation.
 * This layer catches obvious errors immediately to provide fast feedback.
 */
const { parse } = require('csv-parse/sync');

// ─── Expected columns per data type ───────────────────────────────────────────
const REQUIRED_COLUMNS = {
  energy: ['energy_source', 'energy_consumption', 'unit'],
  transport: ['transport_mode', 'distance', 'distance_unit', 'weight', 'weight_unit'],
  material: ['material_type', 'quantity', 'unit'],
};

const OPTIONAL_COLUMNS = {
  energy: ['reporting_start', 'reporting_end', 'notes'],
  transport: ['reporting_start', 'reporting_end', 'passenger_count', 'notes'],
  material: ['material_category', 'recycled_content_pct', 'origin_country', 'reporting_start', 'reporting_end', 'notes'],
};

// ─── Valid enum values ─────────────────────────────────────────────────────────
const VALID_ENERGY_SOURCES = [
  'Grid Electricity', 'Natural Gas', 'Diesel', 'Petrol', 'Heavy Fuel Oil',
  'Coal', 'Biomass', 'Solar', 'Wind', 'Hydroelectric', 'LPG', 'Other',
];
const VALID_ENERGY_UNITS = ['kWh', 'MWh', 'GJ', 'MJ', 'litres', 'kg', 'tonnes', 'm3', 'MMBtu'];
const VALID_TRANSPORT_MODES = [
  'Road – HGV (Diesel)', 'Road – HGV (Electric)', 'Road – Van', 'Rail',
  'Sea – Container', 'Sea – Bulk Carrier', 'Air – Freight', 'Air – Passenger',
  'Pipeline', 'Inland Waterway', 'Other',
];
const VALID_DISTANCE_UNITS = ['km', 'miles', 'nautical miles'];
const VALID_WEIGHT_UNITS = ['kg', 'tonnes', 'metric tons', 'lbs'];
const VALID_MATERIAL_UNITS = ['kg', 'tonnes', 'metric tons', 'lbs', 'litres', 'm3', 'units', 'pallets'];

// ─── Row validator ─────────────────────────────────────────────────────────────
const validateRow = (row, dataType, rowNumber) => {
  const errors = [];
  const warnings = [];
  const coerced = { ...row };

  const addError = (field, msg, val) => errors.push({ field, message: msg, value: val });
  const addWarn  = (field, msg) => warnings.push({ field, message: msg });

  const isEmpty = (v) => v === undefined || v === null || String(v).trim() === '';

  if (dataType === 'energy') {
    // Required: energy_source
    if (isEmpty(row.energy_source)) {
      addError('energy_source', 'Energy source is required', row.energy_source);
    } else if (!VALID_ENERGY_SOURCES.map(s => s.toLowerCase()).includes(String(row.energy_source).trim().toLowerCase())) {
      addError('energy_source', `Invalid energy source. Valid options: ${VALID_ENERGY_SOURCES.join(', ')}`, row.energy_source);
    }

    // Required: energy_consumption (must be a positive number)
    const consumption = parseFloat(row.energy_consumption);
    if (isEmpty(row.energy_consumption)) {
      addError('energy_consumption', 'Energy consumption is required', row.energy_consumption);
    } else if (isNaN(consumption) || consumption < 0) {
      addError('energy_consumption', 'Energy consumption must be a non-negative number', row.energy_consumption);
    } else {
      coerced.energy_consumption = consumption;
      if (consumption === 0) addWarn('energy_consumption', 'Energy consumption is zero — please verify');
    }

    // Required: unit
    if (isEmpty(row.unit)) {
      addError('unit', 'Unit is required', row.unit);
    } else if (!VALID_ENERGY_UNITS.includes(row.unit.trim())) {
      addError('unit', `Invalid unit. Valid options: ${VALID_ENERGY_UNITS.join(', ')}`, row.unit);
    }
  }

  if (dataType === 'transport') {
    // Required: transport_mode
    if (isEmpty(row.transport_mode)) {
      addError('transport_mode', 'Transport mode is required', row.transport_mode);
    } else if (!VALID_TRANSPORT_MODES.map(m => m.toLowerCase()).includes(String(row.transport_mode).trim().toLowerCase())) {
      addError('transport_mode', `Invalid transport mode. Valid: ${VALID_TRANSPORT_MODES.join(' | ')}`, row.transport_mode);
    }

    // Required: distance
    const distance = parseFloat(row.distance);
    if (isEmpty(row.distance)) {
      addError('distance', 'Distance is required', row.distance);
    } else if (isNaN(distance) || distance < 0) {
      addError('distance', 'Distance must be a non-negative number', row.distance);
    } else {
      coerced.distance = distance;
    }

    // Required: distance_unit
    if (isEmpty(row.distance_unit)) {
      addError('distance_unit', 'Distance unit is required', row.distance_unit);
    } else if (!VALID_DISTANCE_UNITS.includes(row.distance_unit.trim())) {
      addError('distance_unit', `Invalid distance unit. Valid: ${VALID_DISTANCE_UNITS.join(', ')}`, row.distance_unit);
    }

    // Optional: weight
    if (!isEmpty(row.weight)) {
      const weight = parseFloat(row.weight);
      if (isNaN(weight) || weight < 0) {
        addError('weight', 'Weight must be a non-negative number', row.weight);
      } else {
        coerced.weight = weight;
      }
    } else {
      addWarn('weight', 'Weight is missing — emission calculation will use default load factor');
    }

    // Optional: weight_unit (default tonnes)
    if (!isEmpty(row.weight_unit) && !VALID_WEIGHT_UNITS.includes(row.weight_unit.trim())) {
      addError('weight_unit', `Invalid weight unit. Valid: ${VALID_WEIGHT_UNITS.join(', ')}`, row.weight_unit);
    }
  }

  if (dataType === 'material') {
    // Required: material_type
    if (isEmpty(row.material_type)) {
      addError('material_type', 'Material type is required', row.material_type);
    }

    // Required: quantity
    const quantity = parseFloat(row.quantity);
    if (isEmpty(row.quantity)) {
      addError('quantity', 'Quantity is required', row.quantity);
    } else if (isNaN(quantity) || quantity < 0) {
      addError('quantity', 'Quantity must be a non-negative number', row.quantity);
    } else {
      coerced.quantity = quantity;
    }

    // Required: unit
    if (isEmpty(row.unit)) {
      addError('unit', 'Unit is required', row.unit);
    } else if (!VALID_MATERIAL_UNITS.includes(row.unit.trim())) {
      addError('unit', `Invalid unit. Valid: ${VALID_MATERIAL_UNITS.join(', ')}`, row.unit);
    }

    // Optional: recycled_content_pct
    if (!isEmpty(row.recycled_content_pct)) {
      const pct = parseFloat(row.recycled_content_pct);
      if (isNaN(pct) || pct < 0 || pct > 100) {
        addError('recycled_content_pct', 'Recycled content % must be between 0 and 100', row.recycled_content_pct);
      } else {
        coerced.recycled_content_pct = pct;
      }
    }
  }

  return {
    rowNumber,
    isValid: errors.length === 0,
    errors,
    warnings,
    data: coerced,
  };
};

// ─── Main Parser ───────────────────────────────────────────────────────────────
/**
 * Parse a CSV Buffer and validate each row.
 *
 * @param {Buffer} buffer     - CSV file buffer from multer
 * @param {string} dataType   - 'energy' | 'transport' | 'material'
 * @returns {{ validRows, invalidRows, summary, headers }}
 */
const parseCsvBuffer = (buffer, dataType) => {
  if (!['energy', 'transport', 'material'].includes(dataType)) {
    throw new Error(`Invalid dataType: "${dataType}". Must be energy, transport, or material.`);
  }

  // Parse CSV
  let records;
  try {
    records = parse(buffer, {
      columns: true,           // Use first row as column headers
      skip_empty_lines: true,
      trim: true,
      bom: true,               // Handle UTF-8 BOM from Excel exports
    });
  } catch (err) {
    throw new Error(`CSV parse error: ${err.message}`);
  }

  if (records.length === 0) {
    throw new Error('CSV file is empty. No data rows found.');
  }

  // Check required columns present
  const headers = Object.keys(records[0]).map((h) => h.trim().toLowerCase());
  const requiredCols = REQUIRED_COLUMNS[dataType];
  const missingCols = requiredCols.filter((col) => !headers.includes(col));
  if (missingCols.length > 0) {
    throw new Error(
      `Missing required column(s): ${missingCols.join(', ')}. ` +
      `Expected columns: ${[...requiredCols, ...(OPTIONAL_COLUMNS[dataType] || [])].join(', ')}`
    );
  }

  // Validate each row
  const validRows = [];
  const invalidRows = [];

  records.forEach((row, idx) => {
    const result = validateRow(row, dataType, idx + 2); // +2 = header row is row 1
    if (result.isValid) {
      validRows.push(result);
    } else {
      invalidRows.push(result);
    }
  });

  return {
    headers,
    totalRows: records.length,
    validRows,
    invalidRows,
    summary: {
      total: records.length,
      valid: validRows.length,
      invalid: invalidRows.length,
      validationRate: records.length > 0
        ? Math.round((validRows.length / records.length) * 100)
        : 0,
    },
  };
};

module.exports = { parseCsvBuffer, REQUIRED_COLUMNS, OPTIONAL_COLUMNS };
