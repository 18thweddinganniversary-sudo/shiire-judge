const proxy = require('./_proxy');
module.exports = async (req, res) => proxy(req, res, '/api/keepa');
