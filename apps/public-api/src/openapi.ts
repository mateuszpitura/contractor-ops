/**
 * OpenAPI 3.1 specification for the Contractor Ops Enterprise REST API.
 * Served at GET /api/v1/openapi.json
 */
export const openApiSpec = {
  openapi: '3.1.0',
  info: {
    title: 'Contractor Ops Enterprise API',
    version: '1.0.0',
    description:
      'REST API for Enterprise customers to integrate Contractor Ops with external systems.',
  },
  servers: [
    {
      url: '/api/v1',
      description: 'API v1',
    },
  ],
  security: [{ bearerAuth: [] }],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http' as const,
        scheme: 'bearer',
        description: 'Organization API key (format: co_live_...)',
      },
    },
    schemas: {
      Error: {
        type: 'object' as const,
        properties: {
          error: {
            type: 'object' as const,
            properties: {
              code: { type: 'string' as const },
              message: { type: 'string' as const },
              status: { type: 'integer' as const },
            },
            required: ['code', 'message', 'status'],
          },
        },
      },
      PaginationMeta: {
        type: 'object' as const,
        properties: {
          total: { type: 'integer' as const },
          page: { type: 'integer' as const },
          pageSize: { type: 'integer' as const },
        },
      },
    },
    parameters: {
      page: {
        name: 'page',
        in: 'query' as const,
        schema: { type: 'integer' as const, default: 1, minimum: 1 },
      },
      pageSize: {
        name: 'pageSize',
        in: 'query' as const,
        schema: { type: 'integer' as const, default: 25, minimum: 1, maximum: 100 },
      },
      sortOrder: {
        name: 'sortOrder',
        in: 'query' as const,
        schema: { type: 'string' as const, enum: ['asc', 'desc'], default: 'desc' },
      },
    },
  },
  paths: {
    '/contractors': {
      get: {
        tags: ['Contractors'],
        summary: 'List contractors',
        parameters: [
          { $ref: '#/components/parameters/page' },
          { $ref: '#/components/parameters/pageSize' },
          { $ref: '#/components/parameters/sortOrder' },
          {
            name: 'status',
            in: 'query',
            schema: { type: 'string', enum: ['ACTIVE', 'INACTIVE', 'ARCHIVED'] },
          },
          {
            name: 'sortBy',
            in: 'query',
            schema: { type: 'string', enum: ['legalName', 'createdAt', 'updatedAt'] },
          },
        ],
        responses: {
          '200': { description: 'Paginated list of contractors' },
          '401': { description: 'Invalid or missing API key' },
          '403': { description: 'Insufficient tier or scopes' },
        },
      },
    },
    '/contractors/{id}': {
      get: {
        tags: ['Contractors'],
        summary: 'Get contractor by ID',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          '200': { description: 'Contractor details' },
          '404': { description: 'Contractor not found' },
        },
      },
    },
    '/invoices': {
      get: {
        tags: ['Invoices'],
        summary: 'List invoices',
        parameters: [
          { $ref: '#/components/parameters/page' },
          { $ref: '#/components/parameters/pageSize' },
          { $ref: '#/components/parameters/sortOrder' },
          {
            name: 'status',
            in: 'query',
            schema: {
              type: 'string',
              enum: [
                'RECEIVED',
                'UNDER_REVIEW',
                'APPROVED',
                'SCHEDULED',
                'PAID',
                'VOID',
                'REJECTED',
              ],
            },
          },
          { name: 'contractorId', in: 'query', schema: { type: 'string' } },
          {
            name: 'sortBy',
            in: 'query',
            schema: { type: 'string', enum: ['issueDate', 'dueDate', 'createdAt', 'totalMinor'] },
          },
        ],
        responses: {
          '200': { description: 'Paginated list of invoices' },
        },
      },
    },
    '/invoices/{id}': {
      get: {
        tags: ['Invoices'],
        summary: 'Get invoice by ID',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          '200': { description: 'Invoice details with contractor and contract' },
          '404': { description: 'Invoice not found' },
        },
      },
    },
    '/contracts': {
      get: {
        tags: ['Contracts'],
        summary: 'List contracts',
        parameters: [
          { $ref: '#/components/parameters/page' },
          { $ref: '#/components/parameters/pageSize' },
          { $ref: '#/components/parameters/sortOrder' },
          {
            name: 'status',
            in: 'query',
            schema: {
              type: 'string',
              enum: [
                'DRAFT',
                'PENDING_SIGNATURE',
                'ACTIVE',
                'EXPIRING',
                'EXPIRED',
                'TERMINATED',
                'SUPERSEDED',
                'ARCHIVED',
              ],
            },
          },
          { name: 'contractorId', in: 'query', schema: { type: 'string' } },
          {
            name: 'sortBy',
            in: 'query',
            schema: { type: 'string', enum: ['title', 'startDate', 'endDate', 'createdAt'] },
          },
        ],
        responses: {
          '200': { description: 'Paginated list of contracts' },
        },
      },
    },
    '/contracts/{id}': {
      get: {
        tags: ['Contracts'],
        summary: 'Get contract by ID',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          '200': { description: 'Contract details with contractor' },
          '404': { description: 'Contract not found' },
        },
      },
    },
    '/documents': {
      get: {
        tags: ['Documents'],
        summary: 'List documents',
        parameters: [
          { $ref: '#/components/parameters/page' },
          { $ref: '#/components/parameters/pageSize' },
          { $ref: '#/components/parameters/sortOrder' },
          {
            name: 'entityType',
            in: 'query',
            schema: { type: 'string', enum: ['CONTRACTOR', 'CONTRACT', 'INVOICE'] },
          },
          { name: 'entityId', in: 'query', schema: { type: 'string' } },
        ],
        responses: {
          '200': { description: 'Paginated list of documents' },
        },
      },
    },
    '/documents/{id}/download-url': {
      get: {
        tags: ['Documents'],
        summary: 'Get presigned download URL',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          '200': { description: 'Presigned URL with expiry' },
          '403': { description: 'Document is infected' },
          '404': { description: 'Document not found' },
        },
      },
    },
    '/health': {
      get: {
        tags: ['System'],
        summary: 'Health check',
        security: [],
        responses: {
          '200': { description: 'API is healthy' },
        },
      },
    },
  },
} as const;
