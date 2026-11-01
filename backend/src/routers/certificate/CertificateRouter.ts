import express from "express";
import CertificateController from "@/controllers/certificate/CertificateController.js";
import type { ICertificateController } from "@/controllers/certificate/ICertificateController.js";
import AuthMiddleware from "@/middlewares/auth/AuthMiddleware.js";

const router = express.Router();
const certificateController: ICertificateController =
  new CertificateController();
const authMiddleware = new AuthMiddleware();

// No param validation on purpose: a malformed id must answer the same 404 as
// an unknown or someone else's certificate, never a 400 INVALID_UUID.
router.get(
  "/certificates/:certificateId/file",
  authMiddleware.auth({ userTypes: "all" }),
  (req, res) => certificateController.downloadFile(req, res),
);

// Public on purpose: whoever checks a certificate has no HELPA account, and a
// stale session cookie in their browser must not turn the answer into a 401.
router.get("/certificate-validations/:validationCode", (req, res) =>
  certificateController.validate(req, res),
);

export default router;
