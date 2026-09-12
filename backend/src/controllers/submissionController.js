/**
 * Submission Controller
 * ======================
 *
 * Handles supplier data submissions (manual form + CSV upload).
 *
 * Manual:
 *   POST /api/submissions/energy       → Submit energy data row
 *   POST /api/submissions/transport    → Submit transport data row
 *   POST /api/submissions/material     → Submit material data row
 *
 * CSV Bulk:
 *   POST /api/submissions/upload/energy    → Upload CSV of energy records
 *   POST /api/submissions/upload/transport → Upload CSV of transport records
 *   POST /api/submissions/upload/material  → Upload CSV of material records
 *
 * Read:
 *   GET  /api/submissions              → List submissions (filtered)
 *   GET  /api/submissions/:id          → Get single submission
 *   GET  /api/submissions/batch/:batchId → All records from a batch upload
 *   GET  /api/submissions/templates/:type → Download CSV template
 *
 * Management:
 *   DELETE /api/submissions/:id        → Delete a submission
 *   PATCH  /api/submissions/:id/status → Update status (manager only)
 */
const crypto = require('crypto');
const axios = require('axios');
const ActivitySubmission = require('../models/ActivitySubmission');
const Supplier = require('../models/Supplier');
const { parseCsvBuffer } = require('../utils/csvParser');

const CARBON_SERVICE_URL = process.env.CARBON_SERVICE_URL || 'http://localhost:8001';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Generate a batch ID for CSV uploads */
const generateBatchId = () =>
  `BATCH-${Date.now()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;

/**
 * Call Django to calculate emission for one validated row.
 * Falls back gracefully if Django is unavailable.
 */
const calculateEmission = async (dataType, rowData) => {
  try {
    const payload = buildCalculationPayload(dataType, rowData);
    const { data } = await axios.post(
      `${CARBON_SERVICE_URL}/api/carbon/calculate/`,
      payload,
      { timeout: 5000 }
    );
    return data;
  } catch {
    return null; // Non-blocking — store data even without emission calc
  }
};

const buildCalculationPayload = (dataType, row) => {
  const typeMap = {
    energy:    { activityType: row.energy_source || row.energyData?.source, value: row.energy_consumption ?? row.energyData?.consumption, unit: row.unit ?? row.energyData?.unit },
    transport: { activityType: `Transportation (${(row.transport_mode || row.transportData?.mode || '').split('–')[0].trim()})`, value: row.distance ?? row.transportData?.distance, unit: row.distance_unit ?? row.transportData?.distanceUnit },
    material:  { activityType: 'Raw Material Production', value: row.quantity ?? row.materialData?.quantity, unit: row.unit ?? row.materialData?.unit },
  };
  return typeMap[dataType] || {};
};

/** Map a validated CSV row into an ActivitySubmission document */
const rowToSubmissionDoc = (row, dataType, supplierId, userId, batchId, reportingPeriod, rowNumber) => {
  const base = {
    supplier:        supplierId,
    submittedBy:     userId,
    dataType,
    batchId,
    sourceRow:       rowNumber,
    status:          'validated',
    reportingPeriod,
    validation: {
      isValid:   true,
      errors:    row.errors || [],
      warnings:  row.warnings || [],
    },
  };

  if (dataType === 'energy') {
    base.energyData = {
      source:      (row.data?.energy_source || row.energy_source || '').trim(),
      consumption: parseFloat(row.data?.energy_consumption ?? row.energy_consumption),
      unit:        (row.data?.unit || row.unit || '').trim(),
    };
  } else if (dataType === 'transport') {
    base.transportData = {
      mode:         (row.data?.transport_mode || row.transport_mode || '').trim(),
      distance:     parseFloat(row.data?.distance ?? row.distance),
      distanceUnit: (row.data?.distance_unit || row.distance_unit || 'km').trim(),
      weight:       row.data?.weight != null ? parseFloat(row.data.weight) : null,
      weightUnit:   (row.data?.weight_unit || row.weight_unit || 'tonnes').trim(),
    };
  } else if (dataType === 'material') {
    base.materialData = {
      materialType:        (row.data?.material_type || row.material_type || '').trim(),
      quantity:            parseFloat(row.data?.quantity ?? row.quantity),
      unit:                (row.data?.unit || row.unit || '').trim(),
      recycledContent_pct: row.data?.recycled_content_pct != null ? parseFloat(row.data.recycled_content_pct) : 0,
      originCountry:       row.data?.origin_country || null,
    };
  }

  return base;
};

// ─── CSV TEMPLATES ────────────────────────────────────────────────────────────

const CSV_TEMPLATES = {
  energy: [
    'energy_source,energy_consumption,unit,reporting_start,reporting_end,notes',
    'Grid Electricity,10000,kWh,2026-01-01,2026-03-31,Q1 2026',
    'Natural Gas,500,MWh,2026-01-01,2026-03-31,',
    'Diesel,2000,litres,2026-01-01,2026-03-31,Backup generator',
  ].join('\n'),

  transport: [
    'transport_mode,distance,distance_unit,weight,weight_unit,reporting_start,reporting_end,notes',
    'Road – HGV (Diesel),1200,km,40,tonnes,2026-01-01,2026-03-31,Regular deliveries',
    'Sea – Container,8500,nautical miles,500,tonnes,2026-01-01,2026-03-31,',
    'Air – Freight,3000,km,2,tonnes,2026-01-01,2026-03-31,Urgent shipment',
  ].join('\n'),

  material: [
    'material_type,quantity,unit,material_category,recycled_content_pct,origin_country,reporting_start,reporting_end,notes',
    'Steel Coil,250,tonnes,Metals & Alloys,15,India,2026-01-01,2026-03-31,',
    'PET Pellets,80,tonnes,Plastics & Polymers,0,China,2026-01-01,2026-03-31,',
    'Cardboard Packaging,12,tonnes,Packaging,70,Germany,2026-01-01,2026-03-31,',
  ].join('\n'),
};

// ─── GET TEMPLATE ─────────────────────────────────────────────────────────────
exports.getTemplate = (req, res) => {
  const { type } = req.params;
  if (!CSV_TEMPLATES[type]) {
    return res.status(400).json({ success: false, error: 'Template type must be energy, transport, or material.' });
  }
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="template_${type}.csv"`);
  return res.send(CSV_TEMPLATES[type]);
};

// ─── MANUAL SUBMISSION ────────────────────────────────────────────────────────
/**
 * POST /api/submissions/:type  (type = energy | transport | material)
 * Submit a single activity data record manually.
 */
exports.submitManual = async (req, res, next) => {
  try {
    const { type } = req.params;
    if (!['energy', 'transport', 'material'].includes(type)) {
      return res.status(400).json({ success: false, error: 'Type must be energy, transport, or material.' });
    }

    const { supplierId, reportingPeriod, ...dataFields } = req.body;

    // Resolve supplier
    const supplier = await Supplier.findOne(
      supplierId.match(/^[0-9a-fA-F]{24}$/)
        ? { _id: supplierId }
        : { supplierId: supplierId.toUpperCase() }
    ).select('_id name supplierId tier');

    if (!supplier) {
      return res.status(404).json({ success: false, error: 'Supplier not found.' });
    }

    // Supplier-role users can only submit for their own linked supplier
    if (req.user.role === 'supplier' &&
        req.user.linkedSupplierId &&
        req.user.linkedSupplierId.toString() !== supplier._id.toString()) {
      return res.status(403).json({
        success: false,
        error: 'You can only submit data for your own linked supplier.',
      });
    }

    // Calculate emission via Django (non-blocking)
    const emissionResult = await calculateEmission(type, dataFields);

    // Build the submission doc
    const submissionData = {
      supplier:    supplier._id,
      submittedBy: req.user.id,
      dataType:    type,
      reportingPeriod: {
        startDate: new Date(reportingPeriod.startDate),
        endDate:   new Date(reportingPeriod.endDate),
      },
      status: 'validated',
      validation: {
        isValid: true,
        calculatedEmission_tCO2e: emissionResult?.emissionValue || null,
        emissionFactor: emissionResult?.emissionFactor || null,
        validatedAt: new Date(),
      },
      notes: dataFields.notes,
    };

    if (type === 'energy')    submissionData.energyData    = dataFields;
    if (type === 'transport') submissionData.transportData = dataFields;
    if (type === 'material')  submissionData.materialData  = dataFields;

    const submission = await ActivitySubmission.create(submissionData);

    // Update supplier data status
    const statusKey = type === 'energy' ? 'energy' : type === 'transport' ? 'transport' : 'materials';
    await Supplier.findByIdAndUpdate(supplier._id, {
      [`dataStatus.${statusKey}.submitted`]: true,
      [`dataStatus.${statusKey}.lastUpdated`]: new Date(),
    });

    return res.status(201).json({
      success: true,
      message: `${type} data submitted successfully.`,
      data: submission,
      emissionCalculated: !!emissionResult,
      emission: emissionResult || null,
    });
  } catch (err) {
    next(err);
  }
};

// ─── CSV UPLOAD ───────────────────────────────────────────────────────────────
/**
 * POST /api/submissions/upload/:type
 * Upload a CSV file. Validates rows locally, then sends to Django for
 * emission calculation, stores valid records in MongoDB.
 */
exports.uploadCsv = async (req, res, next) => {
  try {
    const { type } = req.params;
    if (!['energy', 'transport', 'material'].includes(type)) {
      return res.status(400).json({ success: false, error: 'Type must be energy, transport, or material.' });
    }

    if (!req.file) {
      return res.status(422).json({ success: false, error: 'No CSV file uploaded. Use field name "file".' });
    }

    const { supplierId, reportingStart, reportingEnd } = req.body;

    if (!supplierId) {
      return res.status(400).json({ success: false, error: 'supplierId is required.' });
    }

    // Resolve supplier
    const supplier = await Supplier.findOne(
      supplierId.match(/^[0-9a-fA-F]{24}$/)
        ? { _id: supplierId }
        : { supplierId: supplierId.toUpperCase() }
    ).select('_id name supplierId tier');

    if (!supplier) {
      return res.status(404).json({ success: false, error: 'Supplier not found.' });
    }

    // Role check
    if (req.user.role === 'supplier' &&
        req.user.linkedSupplierId &&
        req.user.linkedSupplierId.toString() !== supplier._id.toString()) {
      return res.status(403).json({ success: false, error: 'You can only submit data for your own supplier.' });
    }

    // ── Step 1: Local CSV parse + validation ──────────────────────────────────
    let parseResult;
    try {
      parseResult = parseCsvBuffer(req.file.buffer, type);
    } catch (parseErr) {
      return res.status(422).json({
        success: false,
        error: parseErr.message,
        stage: 'csv_parse',
      });
    }

    const { validRows, invalidRows, summary } = parseResult;

    // ── Step 2: Send valid rows to Django for Pandas processing ───────────────
    let djangoResult = null;
    if (validRows.length > 0) {
      try {
        const formData = new URLSearchParams();
        const csvPayload = JSON.stringify(validRows.map((r) => r.data));
        const { data } = await axios.post(
          `${CARBON_SERVICE_URL}/api/carbon/process-csv/`,
          { dataType: type, rows: validRows.map((r) => r.data) },
          { timeout: 30000 }
        );
        djangoResult = data;
      } catch (djangoErr) {
        // Django unavailable — continue storing without emission calc
        console.warn('[Django] CSV processing unavailable:', djangoErr.message);
      }
    }

    // ── Step 3: Persist valid rows to MongoDB ─────────────────────────────────
    const batchId = generateBatchId();
    const reportingPeriod = {
      startDate: reportingStart ? new Date(reportingStart) : new Date(),
      endDate:   reportingEnd   ? new Date(reportingEnd)   : new Date(),
    };

    const docsToInsert = validRows.map((row, idx) => {
      const doc = rowToSubmissionDoc(row, type, supplier._id, req.user.id, batchId, reportingPeriod, row.rowNumber);

      // Attach emission from Django if available
      if (djangoResult?.processedRows?.[idx]) {
        const pr = djangoResult.processedRows[idx];
        doc.validation.calculatedEmission_tCO2e = pr.emission_tCO2e || null;
        doc.validation.emissionFactor = pr.emissionFactor || null;
        doc.validation.validatedAt = new Date();
        if (pr.warnings) doc.validation.warnings.push(...pr.warnings);
      }

      return doc;
    });

    let insertedDocs = [];
    if (docsToInsert.length > 0) {
      insertedDocs = await ActivitySubmission.insertMany(docsToInsert, { ordered: false });

      // Update supplier data-status
      const statusKey = type === 'energy' ? 'energy' : type === 'transport' ? 'transport' : 'materials';
      await Supplier.findByIdAndUpdate(supplier._id, {
        [`dataStatus.${statusKey}.submitted`]: true,
        [`dataStatus.${statusKey}.lastUpdated`]: new Date(),
      });
    }

    return res.status(207).json({
      success: true,
      message: `CSV processed. ${insertedDocs.length} records stored.`,
      batchId,
      supplier: { id: supplier._id, supplierId: supplier.supplierId, name: supplier.name },
      summary: {
        ...summary,
        stored: insertedDocs.length,
        djangoProcessed: djangoResult !== null,
      },
      validRows: validRows.map((r) => ({
        rowNumber: r.rowNumber,
        data: r.data,
        warnings: r.warnings,
      })),
      invalidRows: invalidRows.map((r) => ({
        rowNumber: r.rowNumber,
        data: r.data,
        errors: r.errors,
        warnings: r.warnings,
      })),
    });
  } catch (err) {
    next(err);
  }
};

// ─── LIST ─────────────────────────────────────────────────────────────────────
exports.getAll = async (req, res, next) => {
  try {
    const { supplier, dataType, status, batchId, page = 1, limit = 20 } = req.query;
    const filter = {};

    // Suppliers auto-scoped to their own data
    if (req.user.role === 'supplier') {
      if (!req.user.linkedSupplierId) {
        return res.status(403).json({ success: false, error: 'Account not linked to a supplier.' });
      }
      filter.supplier = req.user.linkedSupplierId;
    } else {
      if (supplier) filter.supplier = supplier;
    }

    if (dataType) filter.dataType = dataType;
    if (status)   filter.status   = status;
    if (batchId)  filter.batchId  = batchId;

    const sanitisedLimit = Math.min(Number(limit), 100);
    const skip = (Number(page) - 1) * sanitisedLimit;

    const [submissions, total] = await Promise.all([
      ActivitySubmission.find(filter)
        .populate('supplier', 'name supplierId tier')
        .populate('submittedBy', 'name email role')
        .skip(skip)
        .limit(sanitisedLimit)
        .sort({ createdAt: -1 }),
      ActivitySubmission.countDocuments(filter),
    ]);

    return res.status(200).json({
      success: true,
      data: submissions,
      pagination: { total, page: Number(page), limit: sanitisedLimit, pages: Math.ceil(total / sanitisedLimit) },
    });
  } catch (err) {
    next(err);
  }
};

// ─── GET BY ID ────────────────────────────────────────────────────────────────
exports.getById = async (req, res, next) => {
  try {
    const sub = await ActivitySubmission.findById(req.params.id)
      .populate('supplier', 'name supplierId tier location.country')
      .populate('submittedBy', 'name email role');

    if (!sub) {
      return res.status(404).json({ success: false, error: 'Submission not found.' });
    }

    if (req.user.role === 'supplier' &&
        req.user.linkedSupplierId &&
        sub.supplier._id.toString() !== req.user.linkedSupplierId.toString()) {
      return res.status(403).json({ success: false, error: 'Access denied.' });
    }

    return res.status(200).json({ success: true, data: sub });
  } catch (err) {
    next(err);
  }
};

// ─── GET BATCH ────────────────────────────────────────────────────────────────
exports.getBatch = async (req, res, next) => {
  try {
    const subs = await ActivitySubmission.find({ batchId: req.params.batchId })
      .populate('supplier', 'name supplierId')
      .sort({ sourceRow: 1 });

    const summary = {
      total:    subs.length,
      valid:    subs.filter((s) => s.status === 'validated').length,
      rejected: subs.filter((s) => s.status === 'rejected').length,
      totalEmissions: subs.reduce((acc, s) => acc + (s.validation?.calculatedEmission_tCO2e || 0), 0),
    };

    return res.status(200).json({ success: true, batchId: req.params.batchId, summary, data: subs });
  } catch (err) {
    next(err);
  }
};

// ─── DELETE ───────────────────────────────────────────────────────────────────
exports.remove = async (req, res, next) => {
  try {
    const sub = await ActivitySubmission.findById(req.params.id);
    if (!sub) return res.status(404).json({ success: false, error: 'Submission not found.' });

    if (req.user.role === 'supplier' &&
        req.user.linkedSupplierId &&
        sub.supplier.toString() !== req.user.linkedSupplierId.toString()) {
      return res.status(403).json({ success: false, error: 'Access denied.' });
    }

    await sub.deleteOne();
    return res.status(200).json({ success: true, message: 'Submission deleted.' });
  } catch (err) {
    next(err);
  }
};

// ─── UPDATE STATUS ────────────────────────────────────────────────────────────
exports.updateStatus = async (req, res, next) => {
  try {
    const { status } = req.body;
    const validStatuses = ['pending', 'validated', 'rejected', 'processed'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, error: `Status must be: ${validStatuses.join(', ')}` });
    }
    const sub = await ActivitySubmission.findByIdAndUpdate(req.params.id, { status }, { new: true });
    if (!sub) return res.status(404).json({ success: false, error: 'Submission not found.' });
    return res.status(200).json({ success: true, data: sub });
  } catch (err) {
    next(err);
  }
};
