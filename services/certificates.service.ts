// services/certificates.service.ts
import fs from "node:fs";
import path from "node:path";

export class CertificatesService {
	private certificatesDir = "/tmp/certificates";

	constructor() {
		if (!fs.existsSync(this.certificatesDir)) {
			fs.mkdirSync(this.certificatesDir, { recursive: true });
		}
	}

	uploadCertificate(productId: number, file: Buffer): boolean {
		if (Math.random() > 0.3) {
			fs.writeFileSync(path.join(this.certificatesDir, `${productId}.pdf`), file);
			return true;
		} else {
			return false;
		}
	}

	listCertificates(): number[] {
		const files = fs
			.readdirSync(this.certificatesDir)
			.map((file) => Number(file.slice(0, -4)));
		return files;
	}

	deleteCertificate(productId: number): boolean {
		try {
			fs.unlinkSync(path.join(this.certificatesDir, `${productId}.pdf`));
			return true;
		} catch (_err) {
			return false;
		}
	}
}
