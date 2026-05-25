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
          status:    { type: "string", enum: ["OPEN", "IN_PROGRESS", "COMPLETED", "CANCELLED"] },
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
        tags:    ["Auth"],
        summary: "Register a new user",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                oneOf: [
                  {
                    title: "STUDENT",
                    type: "object",
                    required: ["userType", "fullName", "email", "password", "course", "registrationCode"],
                    properties: {
                      userType:         { type: "string", enum: ["STUDENT"] },
                      fullName:         { type: "string" },
                      email:            { type: "string", format: "email" },
                      password:         { type: "string", minLength: 8 },
                      course:           { type: "string" },
                      registrationCode: { type: "string" },
                    },
                  },
                  {
                    title: "TEACHER",
                    type: "object",
                    required: ["userType", "fullName", "email", "password", "registrationCode", "cndb"],
                    properties: {
                      userType:         { type: "string", enum: ["TEACHER"] },
                      fullName:         { type: "string" },
                      email:            { type: "string", format: "email" },
                      password:         { type: "string", minLength: 8 },
                      registrationCode: { type: "string" },
                      cndb:             { type: "string" },
                      course:           { type: "string" },
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
            content: { "application/json": { schema: { $ref: "#/components/schemas/AuthResponse" } } },
          },
          400: { description: "Validation error.",     content: { "application/json": { schema: { $ref: "#/components/schemas/ValidationError" } } } },
          409: { description: "Email already in use.", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
          500: { description: "Internal server error.", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
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
            content: { "application/json": { schema: { $ref: "#/components/schemas/ActivityResponse" } } },
          },
          400: { description: "Validation error.",      content: { "application/json": { schema: { $ref: "#/components/schemas/ValidationError" } } } },
          401: { description: "Unauthenticated.",       content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
          500: { description: "Internal server error.", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
        },
      },
    },
  },
};