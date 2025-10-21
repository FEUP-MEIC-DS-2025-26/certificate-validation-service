// services/certificates.service.ts
import fs from 'fs';

export class CertificatesService {

	UploadCertificate(productId: number, file: NonSharedBuffer): boolean {
        if (Math.random() > 0.3) {
            fs.writeFileSync(`certificates/${productId}.pdf`, file);
            return true;
        }
        else {
            return false;
        }
    }

}
