import mongoose from 'mongoose';
import { badRequest } from '../utils/httpError.js';

const isPlainObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const isNonEmptyString = (value) => typeof value === 'string' && value.trim().length > 0;
const isFiniteNumber = (value) => typeof value === 'number' && Number.isFinite(value);

export function validateProductPayload(body, { partial }) {
  const errors = [];
  if (!isPlainObject(body)) return ['Request body must be a JSON object'];
  if (partial && Object.keys(body).length === 0) return ['Request body must contain at least one field to update'];

  for (const field of ['name', 'category', 'description', 'brand', 'imageUrl']) {
    const required = ['name', 'category'].includes(field);
    if (body[field] === undefined) {
      if (required && !partial) errors.push(`${field} is required`);
    } else if (required ? !isNonEmptyString(body[field]) : typeof body[field] !== 'string') {
      errors.push(`${field} must be a ${required ? 'non-empty ' : ''}string`);
    }
  }
  if (body.price !== undefined) {
    if (!isFiniteNumber(body.price)) errors.push('price must be a number');
    else if (body.price < 0) errors.push('price must be >= 0');
  }
  if (body.sustainability !== undefined) {
    if (!isPlainObject(body.sustainability)) errors.push('sustainability must be an object');
    else {
      const { score, summary, factors } = body.sustainability;
      if (score !== undefined) {
        if (!isFiniteNumber(score)) errors.push('sustainability.score must be a number');
        else if (score < 0 || score > 100) errors.push('sustainability.score must be between 0 and 100');
      }
      if (summary !== undefined && typeof summary !== 'string') errors.push('sustainability.summary must be a string');
      if (factors !== undefined) {
        if (!Array.isArray(factors)) errors.push('sustainability.factors must be an array');
        else factors.forEach((factor, i) => {
          if (!isPlainObject(factor) || !isNonEmptyString(factor.name)) errors.push(`sustainability.factors[${i}].name is required`);
          if (factor?.impact !== undefined && !['positive', 'neutral', 'negative'].includes(factor.impact)) {
            errors.push(`sustainability.factors[${i}].impact must be positive, neutral or negative`);
          }
          if (factor?.description !== undefined && typeof factor.description !== 'string') errors.push(`sustainability.factors[${i}].description must be a string`);
        });
      }
    }
  }
  if (body.ecoAlternatives !== undefined) {
    if (!Array.isArray(body.ecoAlternatives)) errors.push('ecoAlternatives must be an array');
    else body.ecoAlternatives.forEach((alt, i) => {
      if (!isPlainObject(alt) || !isNonEmptyString(alt.name)) errors.push(`ecoAlternatives[${i}].name is required`);
      if (alt?.productId !== undefined && !mongoose.isObjectIdOrHexString(alt.productId)) errors.push(`ecoAlternatives[${i}].productId must be a valid id`);
      if (alt?.reason !== undefined && typeof alt.reason !== 'string') errors.push(`ecoAlternatives[${i}].reason must be a string`);
    });
  }
  return errors;
}

const pick = (object, fields) => Object.fromEntries(
  fields.filter((field) => Object.hasOwn(object, field) && object[field] !== undefined)
    .map((field) => [field, object[field]]),
);

/** Nested allowlists block client-controlled cache metadata and MongoDB operators. */
export function pickWritableProduct(body) {
  const data = pick(body, ['name', 'description', 'category', 'brand', 'price', 'imageUrl']);
  if (body.sustainability) {
    const sustainability = pick(body.sustainability, ['score', 'summary', 'factors']);
    if (sustainability.factors) sustainability.factors = sustainability.factors.map((f) => pick(f, ['name', 'impact', 'description']));
    if (Object.keys(sustainability).length) data.sustainability = sustainability;
  }
  if (body.ecoAlternatives) data.ecoAlternatives = body.ecoAlternatives.map((a) => pick(a, ['productId', 'name', 'reason']));
  return data;
}

export const validateProductBody = ({ partial = false } = {}) => (req, _res, next) => {
  const errors = validateProductPayload(req.body, { partial });
  if (errors.length) return next(badRequest('Invalid product data', errors));
  req.body = pickWritableProduct(req.body);
  if (partial && !Object.keys(req.body).length) return next(badRequest('Request body must contain at least one writable product field'));
  next();
};

export function validateParam(name, label) {
  return function validateObjectIdParam(req, _res, next) {
    if (!mongoose.isObjectIdOrHexString(req.params[name])) {
      return next(badRequest(`Invalid ${label || name}`));
    }
    next();
  };
}

export function validateObjectId(req, _res, next) {
  if (!mongoose.isObjectIdOrHexString(req.params.id)) return next(badRequest('Invalid product id'));
  next();
}
