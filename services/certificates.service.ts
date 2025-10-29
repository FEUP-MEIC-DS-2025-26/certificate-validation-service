// services/certificates.service.ts
import fs from 'fs';

export class CertificatesService {

	uploadCertificate(productId: number, file: NonSharedBuffer): boolean {
        if (Math.random() > 0.3) {
            fs.writeFileSync(`certificates/${productId}.pdf`, file);
            return true;
        }
        else {
            return false;
        }
    }

    listCertificates(): number[] {
        const files = fs.readdirSync('certificates').map(file => Number(file.slice(0, -4)));
		return files;
	}

    deleteCertificate(productId: number): boolean {
        try {
            fs.unlinkSync(`certificates/${productId}.pdf`);
            return true;
        }
        catch (err) {
            return false;
        }
    }
}
