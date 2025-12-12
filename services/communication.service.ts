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
				const deleteStatus = await certificatesService.deleteProductCertificate(
					productId,
					certificateId,
				);
				return {
					operationType: "deleteResponse",
					status: deleteStatus,
				};
			}
			case "deleteProductCertificate": {
				const deleteStatus = await certificatesService.deleteProductCertificate(
					productId,
					certificateId,
				);
				return {
					operationType: "deleteProductCertificateResponse",
					productId: productId,
					certificateId: certificateId,
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
			case "listProductCertificates": {
				const certificates =
					await certificatesService.listProductCertificates(productId);
				return {
					operationType: "listProductCertificatesResponse",
					productId: productId,
					certificates: certificates,
					total: certificates.length,
				};
			}
		}
	}
}
