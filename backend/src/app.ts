import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import Router from "@/routers/index.js";
import errorHandler from "@/controllers/error/ErrorHandler.js";
import { env } from "@/config/env.js";
import { createGeneralRateLimiters } from "@/middlewares/rateLimit/generalRateLimiters.js";

const app = express();
const { globalRateLimiter, clientRateLimiter } = createGeneralRateLimiters();

app.set("trust proxy", env.TRUST_PROXY);

app.use(
  cors({
    origin: env.CORS_ORIGIN,
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    exposedHeaders: ["Retry-After", "RateLimit", "RateLimit-Policy"],
  }),
);

app.use(globalRateLimiter);
app.use(cookieParser());
app.use(clientRateLimiter);
app.use(express.json());

app.use(Router);

app.use(errorHandler.zodErrorHandler.bind(errorHandler));
app.use(errorHandler.validationErrorHandler.bind(errorHandler));
app.use(errorHandler.prismaErrorHandler.bind(errorHandler));
app.use(errorHandler.defaultHandler.bind(errorHandler));

export { app };
