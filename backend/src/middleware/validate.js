/**
 * Request Validation Middleware — validate()
 * ===========================================
 * Wraps express-validator's validationResult.
 * Use after a chain of check() rules in route definitions.
 *
 * Usage:
 *   router.post('/login', loginValidation, validate, controller)
 */
const { validationResult } = require('express-validator');

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({
      success: false,
      error: 'Validation failed',
      details: errors.array().map((e) => ({
        field: e.path,
        message: e.msg,
        value: e.value,
      })),
    });
  }
  next();
};

module.exports = validate;
