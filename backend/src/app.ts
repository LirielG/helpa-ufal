import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import Router from "@/routers/index.js";
import errorHandler from "@/controllers/error/ErrorHandler.js";
import { env } from "@/config/env.js";

const app = express();

app.use(
  cors({
    origin: env.CORS_ORIGIN,
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);

app.use(express.json());
app.use(cookieParser());

app.use(Router);

app.use(errorHandler.zodErrorHandler.bind(errorHandler));
app.use(errorHandler.validationErrorHandler.bind(errorHandler));
app.use(errorHandler.defaultHandler.bind(errorHandler));

export { app };
