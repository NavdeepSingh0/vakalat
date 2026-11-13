const { createEcourtsClient, ...rest } = require('./client');
const { config } = require('../../config/env');

// Default process-wide client. Tests build their own with createEcourtsClient({ http }).
const defaultClient = createEcourtsClient({ caseSessionTtlMs: config.caseCacheTtlMs });

module.exports = { ...defaultClient, createEcourtsClient, ...rest };
