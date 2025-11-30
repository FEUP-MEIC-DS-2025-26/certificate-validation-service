import { CertificatesService } from "./certificates.service";

const certificatesService = new CertificatesService();

export class CommunicationService {
	async handleRequest(
		requestType: string,
		productId: string = "",
		file: any = null,
		certificateId: string = "",
	): Promise<any> {
		switch (requestType) {
			case "upload": {
				const status = await certificatesService.uploadCertificate(
					productId,
					file,
					certificateId,
				);
				return {
					operationType: "uploadResponse",
					status: status,
				};
			}
			case "delete": {
				const deleteStatus =
					await certificatesService.deleteCertificate(productId);
				return {
					operationType: "deleteResponse",
					status: deleteStatus,
				};
			}
			case "list": {
				const productIds = await certificatesService.listCertificates();
				return {
					operationType: "listResponse",
					productIds: productIds,
					total: productIds.length,
				};
			}
		}
	}
}
