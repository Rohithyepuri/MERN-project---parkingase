export class ApiError extends Error {
  constructor(status, message, code = 'error', details = undefined) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

export const notFound = (req, res, next) => {
  next(new ApiError(404, `Route ${req.method} ${req.originalUrl} not found`, 'not_found'));
};
