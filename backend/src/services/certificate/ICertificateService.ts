export type CertificateFile = {
  fileName: string;
  content: Uint8Array;
};

export interface ICertificateService {
  getFile(userId: string, certificateId: string): Promise<CertificateFile>;
}
