const validateBody = (schema) => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.body, { abortEarly: false, stripUnknown: true });
    if (error) {
      return res.status(400).json({
        status: 'error',
        message: 'Validasi data request gagal.',
        errors: error.details.map((d) => d.message),
      });
    }
    req.body = value;
    next();
  };
};

module.exports = { validateBody };