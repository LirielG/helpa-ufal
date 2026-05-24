import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { env } from "@/config/env.js";
import Router from "@/routers/index.js";
import errorHandler from "@/controllers/error/ErrorHandler.js";

const app = express();

app.use(cors({
  origin: "http://localhost:5173",
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));

app.use(express.json());
app.use(cookieParser());

app.use(Router);

app.use(errorHandler.zodErrorHandler.bind(errorHandler));
app.use(errorHandler.defaultHandler.bind(errorHandler));

app.listen(env.PORT, () => {
  console.log(`Server running on port ${env.PORT}`);
});
