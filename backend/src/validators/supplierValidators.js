/**
 * Supplier Validation Rules
 * ==========================
 * express-validator chains for supplier create and update endpoints.
 */
const { body, param, query } = require('express-validator');

// ─── Reusable sub-rules ──────────────────────────────────────────────────────

const locationRules = [
  body('location.country')
    .trim()
    .notEmpty().withMessage('Location country is required'),
  body('location.countryCode')
    .optional()
    .trim()
    .isLength({ max: 3 }).withMessage('Country code must be 2-3 characters')
    .isAlpha().withMessage('Country code must be letters only'),
  body('location.coordinates.coordinates')
    .optional()
    .isArray({ min: 2, max: 2 }).withMessage('Coordinates must be [longitude, latitude]')
    .custom((val) => {
      const [lng, lat] = val;
      if (lng < -180 || lng > 180) throw new Error('Longitude must be between -180 and 180');
      if (lat < -90 || lat > 90) throw new Error('Latitude must be between -90 and 90');
      return true;
    }),
];

const materialRules = [
  body('materialSupplied.primaryMaterial')
    .trim()
    .notEmpty().withMessage('Primary material supplied is required')
    .isLength({ max: 200 }),
  body('materialSupplied.annualVolume')
    .optional()
    .isFloat({ min: 0 }).withMessage('Annual volume must be a non-negative number'),
  body('materialSupplied.recycledContent_pct')
    .optional()
    .isFloat({ min: 0, max: 100 }).withMessage('Recycled content % must be between 0 and 100'),
];

const energyRules = [
  body('energyConsumption.electricityConsumption_MWh')
    .optional()
    .isFloat({ min: 0 }).withMessage('Electricity consumption must be ≥ 0'),
  body('energyConsumption.renewablePercentage')
    .optional()
    .isFloat({ min: 0, max: 100 }).withMessage('Renewable % must be between 0 and 100'),
  body('energyConsumption.reportingYear')
    .optional()
    .isInt({ min: 2000, max: 2100 }).withMessage('Reporting year must be between 2000 and 2100'),
];

const transportRules = [
  body('transport.inbound.annualDistance_km')
    .optional()
    .isFloat({ min: 0 }).withMessage('Inbound distance must be ≥ 0'),
  body('transport.outbound.annualDistance_km')
    .optional()
    .isFloat({ min: 0 }).withMessage('Outbound distance must be ≥ 0'),
  body('transport.inbound.averageLoadFactor_pct')
    .optional()
    .isFloat({ min: 0, max: 100 }).withMessage('Load factor % must be between 0 and 100'),
];

// ─── Create Supplier ─────────────────────────────────────────────────────────
const createSupplierValidation = [
  body('name')
    .trim()
    .notEmpty().withMessage('Supplier name is required')
    .isLength({ max: 200 }).withMessage('Name cannot exceed 200 characters'),

  body('tier')
    .notEmpty().withMessage('Tier level is required')
    .isInt({ min: 1, max: 3 }).withMessage('Tier must be 1, 2, or 3'),

  body('parentSupplier')
    .optional({ nullable: true })
    .custom((value, { req }) => {
      const tier = Number(req.body.tier);
      if (tier === 1 && value) {
        throw new Error('Tier 1 suppliers cannot have a parent supplier');
      }
      if ((tier === 2 || tier === 3) && value) {
        if (!/^[0-9a-fA-F]{24}$/.test(value)) {
          throw new Error('parentSupplier must be a valid MongoDB ID');
        }
      }
      return true;
    }),

  body('category')
    .notEmpty().withMessage('Supply category is required')
    .isIn([
      'Raw Materials', 'Manufacturing', 'Transportation & Logistics',
      'Packaging', 'Energy', 'Electronics & Components',
      'Waste Management', 'Agricultural', 'Construction', 'Services', 'Other',
    ]).withMessage('Invalid supply category'),

  body('status')
    .optional()
    .isIn(['Active', 'Inactive', 'Under Review', 'High Risk', 'Onboarding', 'Offboarded'])
    .withMessage('Invalid status value'),

  body('esgScore')
    .optional({ nullable: true })
    .isFloat({ min: 0, max: 100 }).withMessage('ESG score must be between 0 and 100'),

  body('contact.primaryContactEmail')
    .optional()
    .isEmail().withMessage('Invalid primary contact email'),

  body('contact.sustainabilityContactEmail')
    .optional()
    .isEmail().withMessage('Invalid sustainability contact email'),

  ...locationRules,
  ...materialRules,
  ...energyRules,
  ...transportRules,
];

// ─── Update Supplier ─────────────────────────────────────────────────────────
// All fields optional for PATCH-style updates
const updateSupplierValidation = [
  body('name')
    .optional()
    .trim()
    .isLength({ min: 1, max: 200 }).withMessage('Name must be between 1 and 200 characters'),

  body('tier')
    .optional()
    .isInt({ min: 1, max: 3 }).withMessage('Tier must be 1, 2, or 3'),

  body('status')
    .optional()
    .isIn(['Active', 'Inactive', 'Under Review', 'High Risk', 'Onboarding', 'Offboarded'])
    .withMessage('Invalid status value'),

  body('esgScore')
    .optional({ nullable: true })
    .isFloat({ min: 0, max: 100 }).withMessage('ESG score must be between 0 and 100'),

  body('contact.primaryContactEmail')
    .optional()
    .isEmail().withMessage('Invalid primary contact email'),

  // Location, material, energy, transport sub-rules (all optional for update)
  ...locationRules.map((rule) => rule.optional()),
  ...materialRules.map((rule) => rule.optional()),
  ...energyRules,
  ...transportRules,
];

// ─── Update Data Status ───────────────────────────────────────────────────────
const updateDataStatusValidation = [
  body('category')
    .notEmpty().withMessage('Category is required')
    .isIn(['energy', 'transport', 'materials'])
    .withMessage('Category must be energy, transport, or materials'),
  body('submitted')
    .optional()
    .isBoolean().withMessage('submitted must be a boolean'),
  body('verified')
    .optional()
    .isBoolean().withMessage('verified must be a boolean'),
];

// ─── Get By Tier param ────────────────────────────────────────────────────────
const tierParamValidation = [
  param('tier')
    .isInt({ min: 1, max: 3 }).withMessage('Tier must be 1, 2, or 3'),
];

// ─── Relationship ─────────────────────────────────────────────────────────────
const setParentValidation = [
  body('parentSupplierId')
    .optional({ nullable: true })
    .custom((value) => {
      if (value !== null && !/^[0-9a-fA-F]{24}$/.test(value)) {
        throw new Error('parentSupplierId must be a valid MongoDB ID or null');
      }
      return true;
    }),
];

module.exports = {
  createSupplierValidation,
  updateSupplierValidation,
  updateDataStatusValidation,
  tierParamValidation,
  setParentValidation,
};
