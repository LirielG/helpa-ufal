import type { OpenAPIV3 } from "openapi-types";

export const swaggerDocument: OpenAPIV3.Document = {
  openapi: "3.0.0",
  info: {
    title:   "Your API",
    version: "1.0.0",
  },
  components: {
    securitySchemes: {
      cookieAuth: {
        type: "apiKey",
        in:   "cookie",
        name: "token",
      },
    },
    responses: {
      Conflict: {
        description: "Conflict.",
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/ErrorResponse" },
          },
        },
      },
    },
    schemas: {
      UserResponse: {
        type: "object",
        properties: {
          id:        { type: "string", format: "uuid" },
          fullName:  { type: "string" },
          email:     { type: "string", format: "email" },
          userType:  { type: "string", enum: ["STUDENT", "TEACHER"] },
          isManager: { type: "boolean" },
          createdAt: { type: "string", format: "date-time" },
          updatedAt: { type: "string", format: "date-time" },
        },
      },
      AuthResponse: {
        type: "object",
        properties: {
          token: { type: "string" },
          user:  { $ref: "#/components/schemas/UserResponse" },
        },
      },
      ActivityResponse: {
        type: "object",
        properties: {
          id:        { type: "string", format: "uuid" },
          authorId:  { type: "string", format: "uuid" },
          title:     { type: "string" },
          type:      { type: "string", enum: ["EXTENSION", "COURSE", "EVENT", "LECTURE", "OTHER"] },
          campus:    { type: "string", enum: ["MACEIO", "ARAPIRACA", "PALMEIRA", "PENEDO", "RIO_LARGO", "DELMIRO_GOUVEIA", "SANTANA_IPANEMA"] },
          startDate: { type: "string", format: "date-time" },
          endDate:   { type: "string", format: "date-time" },
          slots:     { type: "integer" },
          availableSlots: {
            type: "integer",
            minimum: 0,
            description: "Remaining available slots. Calculated as slots minus approved enrollments. Never negative.",
          },
          status:    { type: "string", enum: ["OPEN", "IN_PROGRESS", "COMPLETED", "CANCELLED"] },
        },
      },
      ActivityFullResponse: {
        allOf: [
          { $ref: "#/components/schemas/ActivityResponse" },
          {
            type: "object",
            properties: {
              details: {
                nullable: true,
                type: "object",
                properties: {
                  description:   { type: "string" },
                  area:          { type: "string" },
                  format:        { type: "string", enum: ["IN_PERSON", "ONLINE", "HYBRID"] },
                  url:           { type: "string", format: "uri", nullable: true },
                  workloadHours: { type: "integer" },
                  address: {
                    nullable: true,
                    type: "object",
                    properties: {
                      id:          { type: "string", format: "uuid" },
                      addressLine: { type: "string" },
                      district:    { type: "string" },
                      zipCode:     { type: "string" },
                      city:        { type: "string" },
                      state:       { type: "string" },
                    },
                  },
                },
              },
            },
          },
        ],
      },
      UpdateActivityRequest: {
        description: "Partial update of an activity. At least one field must be provided. Fields discriminated by format; address is required for IN_PERSON and HYBRID; url is required for ONLINE and HYBRID.",
        type: "object",
        properties: {
          title:        { type: "string" },
          type:         { type: "string", enum: ["EXTENSION", "COURSE", "EVENT", "LECTURE", "OTHER"] },
          campus:       { type: "string", enum: ["MACEIO", "ARAPIRACA", "PALMEIRA", "PENEDO", "RIO_LARGO", "DELMIRO_GOUVEIA", "SANTANA_IPANEMA"] },
          startDate:    { type: "string", format: "date-time" },
          endDate:      { type: "string", format: "date-time" },
          slots:        { type: "integer", minimum: 1, description: "Cannot be reduced below the current number of approved enrollments." },
          description:  { type: "string" },
          area:         { type: "string" },
          format:       { type: "string", enum: ["IN_PERSON", "ONLINE", "HYBRID"] },
          workloadHours:{ type: "integer", minimum: 1 },
          url:          { type: "string", format: "uri", nullable: true },
          address: {
            nullable: true,
            type: "object",
            properties: {
              addressLine: { type: "string" },
              district:    { type: "string" },
              zipCode:     { type: "string", pattern: "^\\d{8}$" },
              city:        { type: "string" },
              state:       { type: "string", enum: ["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"] },
            },
          },
        },
      },
      SigaaActivityResponse: {
        type: "object",
        properties: {
          id:         { type: "string", format: "uuid" },
          sigaaId:    { type: "string" },
          title:      { type: "string" },
          type:           { type: "string", enum: ["EVENTO", "CURSO", "PRODUTO", "PROGRAMA", "PROJETO", "PRESTAÇÃO DE SERVIÇOS"] },
          normalizedType: { type: "string", enum: ["EXTENSION", "COURSE", "EVENT", "LECTURE", "OTHER"] },
          department:     { type: "string", nullable: true },
          lastSeenAt: { type: "string", format: "date-time" },
        },
      },
      ActivityReportResponse: {
        type: "object",
        properties: {
          id:         { type: "string", format: "uuid" },
          activityId: { type: "string", format: "uuid" },
          userId:     { type: "string", format: "uuid", nullable: true},
          category:     { type: "string", enum: ["SPAM", "INAPPROPRIATE_CONTENT", "MISINFORMATION", "DUPLICATE", "OTHER"] },
          description: { type: "string", nullable: true },  
          createdAt:  { type: "string", format: "date-time" },
        },
      },
      ValidationError: {
        type: "object",
        properties: {
          status:  { type: "integer", example: 400 },
          message: { type: "string", example: "Validation error." },
          errors: {
            type: "array",
            items: {
              type: "object",
              properties: {
                field:   { type: "string" },
                message: { type: "string" },
              },
            },
          },
        },
      },
      ErrorResponse: {
        type: "object",
        properties: {
          status:  { type: "integer" },
          message: { type: "string" },
        },
      },
    },
  },
  paths: {
    "/auth/login": {
      post: {
        tags:    ["Auth"],
        summary: "Login with email and password",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["email", "password"],
                properties: {
                  email:    { type: "string", format: "email" },
                  password: { type: "string", minLength: 1 },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: "Logged in successfully.",
            content: { "application/json": { schema: { $ref: "#/components/schemas/AuthResponse" } } },
          },
          400: { description: "Validation error.",      content: { "application/json": { schema: { $ref: "#/components/schemas/ValidationError" } } } },
          401: { description: "Invalid credentials.",   content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
          500: { description: "Internal server error.", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
        },
      },
    },
    "/auth/register": {
      post: {
        tags: ["Auth"],
        summary: "Register a new user",
        description:
          "Creates a new user account (STUDENT or TEACHER). This endpoint only creates the account: it does NOT authenticate the user — the response body contains no token and no session cookie (Set-Cookie) is sent. To authenticate, use POST /auth/login.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                // INALTERADO — o payload de entrada não é afetado pela refatoração.
                oneOf: [
                  {
                    title: "STUDENT",
                    type: "object",
                    required: [
                      "userType",
                      "fullName",
                      "email",
                      "password",
                      "course",
                      "registrationCode",
                    ],
                    properties: {
                      userType: { type: "string", enum: ["STUDENT"] },
                      fullName: { type: "string" },
                      email: { type: "string", format: "email" },
                      password: { type: "string", minLength: 8 },
                      course: { type: "string" },
                      registrationCode: { type: "string" },
                    },
                  },
                  {
                    title: "TEACHER",
                    type: "object",
                    required: [
                      "userType",
                      "fullName",
                      "email",
                      "password",
                      "registrationCode",
                      "cndb",
                    ],
                    properties: {
                      userType: { type: "string", enum: ["TEACHER"] },
                      fullName: { type: "string" },
                      email: { type: "string", format: "email" },
                      password: { type: "string", minLength: 8 },
                      registrationCode: { type: "string" },
                      cndb: { type: "string" },
                      course: { type: "string" },
                    },
                  },
                ],
              },
            },
          },
        },
        responses: {
          201: {
            description: "Registered successfully.",
            content: {
              "application/json": {
                // ALTERADO — era: { $ref: "#/components/schemas/AuthResponse" }
                // O corpo agora é o próprio usuário criado (UserResponse),
                // sem envelope { token, user }.
                schema: { $ref: "#/components/schemas/UserResponse" },
                // NOVO — exemplo concreto do novo contrato, alinhado ao
                // exemplo do Bruno (facilita o frontend e o Swagger UI).
                example: {
                  id: "3f8a1c2e-4b5d-4e6f-8a9b-0c1d2e3f4a5b",
                  fullName: "Gabryel Adriano Borges de Souza",
                  email: "user@email.com",
                  userType: "STUDENT",
                  isManager: false,
                  createdAt: "2026-08-26T22:00:00.000Z",
                  updatedAt: "2026-08-26T22:00:00.000Z",
                },
              },
            },
          },
          // 400, 409 e 500 INALTERADOS — a semântica dos erros não muda.
          400: {
            description: "Validation error.",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ValidationError" },
              },
            },
          },
          409: {
            description: "Email already in use.",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
          500: {
            description: "Internal server error.",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
        },
      },
    },
    "/activities": {
      post: {
        tags:     ["Activities"],
        summary:  "Create a new activity",
        security: [{ cookieAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                oneOf: [
                  {
                    title: "IN_PERSON",
                    type: "object",
                    required: ["title", "type", "campus", "startDate", "endDate", "slots", "description", "area", "workloadHours", "format", "address"],
                    properties: {
                      title:         { type: "string" },
                      type:          { type: "string", enum: ["EXTENSION", "COURSE", "EVENT", "LECTURE", "OTHER"] },
                      campus:        { type: "string", enum: ["MACEIO", "ARAPIRACA", "PALMEIRA", "PENEDO", "RIO_LARGO", "DELMIRO_GOUVEIA", "SANTANA_IPANEMA"] },
                      startDate:     { type: "string", format: "date-time" },
                      endDate:       { type: "string", format: "date-time" },
                      slots:         { type: "integer", minimum: 1 },
                      description:   { type: "string" },
                      area:          { type: "string" },
                      workloadHours: { type: "integer", minimum: 1 },
                      format:        { type: "string", enum: ["IN_PERSON"] },
                      address: {
                        type: "object",
                        required: ["addressLine", "district", "zipCode", "city", "state"],
                        properties: {
                          addressLine: { type: "string" },
                          district:    { type: "string" },
                          zipCode:     { type: "string", pattern: "^\\d{8}$" },
                          city:        { type: "string" },
                          state:       { type: "string", enum: ["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"] },
                        },
                      },
                    },
                  },
                  {
                    title: "ONLINE",
                    type: "object",
                    required: ["title", "type", "campus", "startDate", "endDate", "slots", "description", "area", "workloadHours", "format", "url"],
                    properties: {
                      title:         { type: "string" },
                      type:          { type: "string", enum: ["EXTENSION", "COURSE", "EVENT", "LECTURE", "OTHER"] },
                      campus:        { type: "string", enum: ["MACEIO", "ARAPIRACA", "PALMEIRA", "PENEDO", "RIO_LARGO", "DELMIRO_GOUVEIA", "SANTANA_IPANEMA"] },
                      startDate:     { type: "string", format: "date-time" },
                      endDate:       { type: "string", format: "date-time" },
                      slots:         { type: "integer", minimum: 1 },
                      description:   { type: "string" },
                      area:          { type: "string" },
                      workloadHours: { type: "integer", minimum: 1 },
                      format:        { type: "string", enum: ["ONLINE"] },
                      url:           { type: "string", format: "uri" },
                    },
                  },
                  {
                    title: "HYBRID",
                    type: "object",
                    required: ["title", "type", "campus", "startDate", "endDate", "slots", "description", "area", "workloadHours", "format", "url", "address"],
                    properties: {
                      title:         { type: "string" },
                      type:          { type: "string", enum: ["EXTENSION", "COURSE", "EVENT", "LECTURE", "OTHER"] },
                      campus:        { type: "string", enum: ["MACEIO", "ARAPIRACA", "PALMEIRA", "PENEDO", "RIO_LARGO", "DELMIRO_GOUVEIA", "SANTANA_IPANEMA"] },
                      startDate:     { type: "string", format: "date-time" },
                      endDate:       { type: "string", format: "date-time" },
                      slots:         { type: "integer", minimum: 1 },
                      description:   { type: "string" },
                      area:          { type: "string" },
                      workloadHours: { type: "integer", minimum: 1 },
                      format:        { type: "string", enum: ["HYBRID"] },
                      url:           { type: "string", format: "uri" },
                      address: {
                        type: "object",
                        required: ["addressLine", "district", "zipCode", "city", "state"],
                        properties: {
                          addressLine: { type: "string" },
                          district:    { type: "string" },
                          zipCode:     { type: "string", pattern: "^\\d{8}$" },
                          city:        { type: "string" },
                          state:       { type: "string", enum: ["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"] },
                        },
                      },
                    },
                  },
                ],
              },
            },
          },
        },
        responses: {
          201: {
            description: "Activity created successfully.",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ActivityFullResponse" },
                example: {
                  id: "a1b2c3d4-0000-4000-8000-000000000001",
                  authorId: "a1b2c3d4-0000-4000-8000-000000000099",
                  title: "Oficina de Introdução à Programação",
                  type: "COURSE",
                  campus: "ARAPIRACA",
                  startDate: "2026-08-01T08:00:00.000Z",
                  endDate: "2026-08-15T12:00:00.000Z",
                  slots: 40,
                  availableSlots: 40,
                  status: "OPEN",
                  details: {
                    description: "Introdução à lógica de programação para iniciantes.",
                    area: "Tecnologia",
                    format: "IN_PERSON",
                    url: null,
                    workloadHours: 20,
                    address: {
                      id: "a1b2c3d4-0000-4000-8000-000000000002",
                      addressLine: "Av. Manoel Severino Barbosa, s/n",
                      district: "Bom Sucesso",
                      zipCode: "57309005",
                      city: "Arapiraca",
                      state: "AL",
                    },
                  },
                },
              },
            },
          },
          400: { description: "Validation error.",      content: { "application/json": { schema: { $ref: "#/components/schemas/ValidationError" } } } },
          401: { description: "Unauthenticated.",       content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
          500: { description: "Internal server error.", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
        },
      },
      get: {
        tags:    ["Activities"],
        summary: "List activities",
        description: "Returns a paginated list of activities. When `search` is provided, all other filters are ignored. Results are ordered by `startDate` ascending.",
        parameters: [
          // Pagination
          {
            name:        "page",
            in:          "query",
            required:    false,
            description: "Page number (default: 1)",
            schema:      { type: "integer", minimum: 1, default: 1 },
          },
          {
            name:        "limit",
            in:          "query",
            required:    false,
            description: "Items per page (default: 20, max: 100)",
            schema:      { type: "integer", minimum: 1, maximum: 100, default: 20 },
          },

          // Free text — mutually exclusive with filters below
          {
            name:        "search",
            in:          "query",
            required:    false,
            description: "Free text search on activity title. When provided, all other filters (status, type, campus, format, startAfter, endBefore) are ignored.",
            schema:      { type: "string" },
          },

          // Filters
          {
            name:        "status",
            in:          "query",
            required:    false,
            description: "Filter by activity status. Ignored when `search` is present.",
            schema:      { type: "string", enum: ["OPEN", "IN_PROGRESS", "COMPLETED", "CANCELLED"] },
          },
          {
            name:        "type",
            in:          "query",
            required:    false,
            description: "Filter by activity type. Ignored when `search` is present.",
            schema:      { type: "string", enum: ["EXTENSION", "COURSE", "EVENT", "LECTURE", "OTHER"] },
          },
          {
            name:        "campus",
            in:          "query",
            required:    false,
            description: "Filter by campus. Ignored when `search` is present.",
            schema:      { type: "string", enum: ["MACEIO", "ARAPIRACA", "PALMEIRA", "PENEDO", "RIO_LARGO", "DELMIRO_GOUVEIA", "SANTANA_IPANEMA"] },
          },
          {
            name:        "format",
            in:          "query",
            required:    false,
            description: "Filter by activity format. Ignored when `search` is present.",
            schema:      { type: "string", enum: ["IN_PERSON", "ONLINE", "HYBRID"] },
          },
          {
            name:        "startAfter",
            in:          "query",
            required:    false,
            description: "Return only activities starting after this date (ISO 8601). Ignored when `search` is present.",
            schema:      { type: "string", format: "date-time" },
          },
          {
            name:        "endBefore",
            in:          "query",
            required:    false,
            description: "Return only activities ending before this date (ISO 8601). Ignored when `search` is present.",
            schema:      { type: "string", format: "date-time" },
          },
        ],
        responses: {
          200: {
            description: "Paginated list of activities.",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    data: {
                      type:  "array",
                      items: { $ref: "#/components/schemas/ActivityResponse" },
                    },
                    meta: {
                      type: "object",
                      properties: {
                        total:       { type: "integer", description: "Total number of matching activities." },
                        page:        { type: "integer" },
                        limit:       { type: "integer" },
                        totalPages:  { type: "integer" },
                      },
                    },
                  },
                },
              },
            },
          },
          400: { description: "Validation error.",      content: { "application/json": { schema: { $ref: "#/components/schemas/ValidationError" } } } },
          500: { description: "Internal server error.", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
        },
      },
    },
    "/sigaa-activities": {
      get: {
        tags:    ["SIGAA"],
        summary: "List SIGAA extension activities",
        description: "Returns paginated SIGAA activities. Syncs with SIGAA on demand (12h cache).",
        parameters: [
          {
            name:        "search",
            in:          "query",
            required:    false,
            description: "Partial, case-insensitive search on title.",
            schema:      { type: "string" },
          },
          {
            name:        "type",
            in:          "query",
            required:    false,
            description: "Exact match on SIGAA type.",
            schema:      { type: "string", enum: ["EVENTO", "CURSO", "PRODUTO", "PROGRAMA", "PROJETO", "PRESTAÇÃO DE SERVIÇOS"] },
          },
          {
            name:        "department",
            in:          "query",
            required:    false,
            description: "Exact match on department acronym. Use /sigaa-activities/departments for valid values.",
            schema:      { type: "string" },
          },
          {
            name:        "page",
            in:          "query",
            required:    false,
            description: "Page number.",
            schema:      { type: "integer", minimum: 1, default: 1 },
          },
          {
            name:        "limit",
            in:          "query",
            required:    false,
            description: "Items per page.",
            schema:      { type: "integer", minimum: 1, maximum: 100, default: 10 },
          },
          {
            name:        "orderBy",
            in:          "query",
            required:    false,
            description: "Sort field.",
            schema:      { type: "string", enum: ["title", "lastSeenAt"], default: "lastSeenAt" },
          },
          {
            name:        "order",
            in:          "query",
            required:    false,
            description: "Sort direction.",
            schema:      { type: "string", enum: ["asc", "desc"], default: "desc" },
          },
        ],
        responses: {
          200: {
            description: "Paginated SIGAA activities.",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    items: {
                      type:  "array",
                      items: { $ref: "#/components/schemas/SigaaActivityResponse" },
                    },
                    total: { type: "integer" },
                    page:  { type: "integer" },
                    limit: { type: "integer" },
                  },
                },
              },
            },
          },
          400: { description: "Validation error.",      content: { "application/json": { schema: { $ref: "#/components/schemas/ValidationError" } } } },
          500: { description: "Internal server error.", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
        },
      },
    },
    "/sigaa-activities/departments": {
      get: {
        tags:    ["SIGAA"],
        summary: "List distinct SIGAA departments",
        description: "Returns a list of unique department acronyms from active SIGAA activities. Use to populate filter dropdowns.",
        responses: {
          200: {
            description: "List of department acronyms.",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    departments: { type: "array", items: { type: "string" } },
                  },
                },
              },
            },
          },
          500: { description: "Internal server error.", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
        },
      },
    },
    "/activities/{id}": {
      get: {
        tags:        ["Activities"],
        summary:     "Get activity by ID",
        description: "Returns the full data of an activity, including details and address if available.",
        parameters: [
          {
            name:        "id",
            in:          "path",
            required:    true,
            description: "Activity UUID",
            schema:      { type: "string", format: "uuid" },
          },
        ],
        responses: {
          200: {
            description: "Full activity data.",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ActivityFullResponse" },
                example: {
                  id: "a1b2c3d4-0000-4000-8000-000000000001",
                  authorId: "a1b2c3d4-0000-4000-8000-000000000099",
                  title: "Oficina de Introdução à Programação",
                  type: "COURSE",
                  campus: "ARAPIRACA",
                  startDate: "2026-08-01T08:00:00.000Z",
                  endDate: "2026-08-15T12:00:00.000Z",
                  slots: 40,
                  availableSlots: 27,
                  status: "OPEN",
                  details: {
                    description: "Introdução à lógica de programação para iniciantes.",
                    area: "Tecnologia",
                    format: "HYBRID",
                    url: "https://meet.example.com/oficina",
                    workloadHours: 20,
                    address: {
                      id: "a1b2c3d4-0000-4000-8000-000000000002",
                      addressLine: "Av. Manoel Severino Barbosa, s/n",
                      district: "Bom Sucesso",
                      zipCode: "57309005",
                      city: "Arapiraca",
                      state: "AL",
                    },
                  },
                },
              },
            },
          },
          404: { description: "Activity not found.", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
          500: { description: "Internal server error.", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
        },
      },
      patch: {
        tags: ["Activities"],
        summary: "Update an activity",
        description: "Partially updates an activity. Only the author or a manager can perform this operation. Activities with status `COMPLETED` or `CANCELLED`, or that have been soft-deleted, cannot be updated. At least one field must be provided.",
        security: [{ cookieAuth: [] }],
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            description: "Activity UUID",
            schema: { type: "string", format: "uuid" },
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/UpdateActivityRequest" },
              example: {
                title: "Oficina de Introdução à Programação — Turma 2",
                slots: 50,
                format: "HYBRID",
                url: "https://meet.example.com/turma2",
                address: {
                  addressLine: "Av. Manoel Severino Barbosa, s/n",
                  district: "Bom Sucesso",
                  zipCode: "57309005",
                  city: "Arapiraca",
                  state: "AL",
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: "Activity updated successfully.",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ActivityFullResponse" },
              },
            },
          },
          400: { description: "Validation error or empty body.", content: { "application/json": { schema: { $ref: "#/components/schemas/ValidationError" } } } },
          401: { description: "Unauthenticated.", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
          403: { description: "Forbidden. Requester is not the author or a manager.", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
          404: { description: "Activity not found or deleted.", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
          409: { description: "Activity cannot be updated (status COMPLETED or CANCELLED).", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
          500: { description: "Internal server error.", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
        },
      },
      delete: {
        tags: ["Activities"],
        summary: "Delete an activity (coming soon)",
        description: "⚠️ **Not yet implemented.** Performs a soft delete on the activity by setting `deletedAt`. The record is preserved in the database but excluded from all listings and lookups. Only the author or a manager can delete an activity.",
        security: [{ cookieAuth: [] }],
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            description: "Activity UUID",
            schema: { type: "string", format: "uuid" },
          },
        ],
        responses: {
          204: { description: "Activity soft-deleted successfully. No content returned." },
          400: { description: "Invalid id parameter. Must be a valid UUID.", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
          401: { description: "Unauthenticated.", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
          403: { description: "Forbidden.", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
          404: { description: "Activity not found or already deleted.", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
          500: { description: "Internal server error.", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
        },
      },
    },
    "/activities/{id}/status": {
      patch: {
        tags: ["Activities"],
        summary: "Transition activity status",
        description: [
          "Transitions an activity through its lifecycle. Status is treated as a business state with controlled transitions, not a free-update field.",
          "",
          "**Allowed transitions:**",
          "- `OPEN => IN_PROGRESS | CANCELLED`",
          "- `IN_PROGRESS => COMPLETED | CANCELLED`",
          "",
          "`COMPLETED` and `CANCELLED` are terminal states and cannot be transitioned further.",
          "",
          "Only the activity author or a manager can perform transitions.",
        ].join("\n"),
        security: [{ cookieAuth: [] }],
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            description: "Activity UUID",
            schema: { type: "string", format: "uuid" },
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["status"],
                additionalProperties: false,
                properties: {
                  status: {
                    type: "string",
                    enum: ["IN_PROGRESS", "COMPLETED", "CANCELLED"],
                    description: "Target status. Must be a valid transition from the current status.",
                  },
                },
              },
              example: { status: "IN_PROGRESS" },
            },
          },
        },
        responses: {
          200: {
            description: "Status transitioned successfully.",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ActivityResponse" },
                example: {
                  id: "a1b2c3d4-0000-4000-8000-000000000001",
                  authorId: "a1b2c3d4-0000-4000-8000-000000000099",
                  title: "Oficina de Introdução à Programação",
                  type: "COURSE",
                  campus: "ARAPIRACA",
                  startDate: "2026-08-01T08:00:00.000Z",
                  endDate: "2026-08-15T12:00:00.000Z",
                  slots: 40,
                  availableSlots: 27,
                  status: "IN_PROGRESS",
                },
              },
            },
          },
          400: {
            description: "Validation error: invalid UUID, missing `status`, or extra fields in body.",
            content: { "application/json": { schema: { $ref: "#/components/schemas/ValidationError" } } },
          },
          401: {
            description: "Unauthenticated.",
            content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } },
          },
          403: {
            description: "Forbidden. Requester is not the author or a manager.",
            content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } },
          },
          404: {
            description: "Activity not found",
            content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } },
          },
          409: {
            description: "Invalid transition. Either the target status is not reachable from the current one, or the activity is in a terminal state.",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
                examples: {
                  terminal: {
                    summary: "Activity is in a terminal state",
                    value: { status: 409, message: "Activity is already CANCELLED and cannot be transitioned." },
                  },
                  invalid_transition: {
                    summary: "Invalid transition from current status",
                    value: { status: 409, message: "Cannot transition from OPEN to COMPLETED." },
                  },
                },
              },
            },
          },
          500: {
            description: "Internal server error.",
            content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } },
          },
        },
      },
    },
    "/activities/{id}/reports": {
      post: {
        tags: ["Activities"],
        summary: "Report an activity",
        description: "Registers a report against an activity. Any authenticated user can report, except the activity's own author. Each user can only report a given activity once.",
        security: [{ cookieAuth: [] }],
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            description: "Activity UUID",
            schema: { type: "string", format: "uuid" },
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["category"],
                properties: {
                  category: {
                    type: "string",
                    enum: ["SPAM", "INAPPROPRIATE_CONTENT", "MISINFORMATION", "DUPLICATE", "OTHER"],
                  },
                  description: {                                    
                    type: "string",
                    nullable: true,
                    maxLength: 500,
                    description: "Optional free-text description explaining the report.",
                  },
                },
              },
              example: { category: "MISINFORMATION", description: "The address provided is incorrect." },
            },
          },
        },
        responses: {
          201: {
            description: "Report registered successfully.",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ActivityReportResponse" },
              },
            },
          },
          400: { description: "Validation error.", content: { "application/json": { schema: { $ref: "#/components/schemas/ValidationError" } } } },
          401: { description: "Unauthenticated.", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
          403: { description: "Forbidden. The activity author cannot report their own activity.", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
          404: { description: "Activity not found or deleted.", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
          409: { $ref: "#/components/responses/Conflict" },
          500: { description: "Internal server error.", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
        },
      },
    },
  },
};