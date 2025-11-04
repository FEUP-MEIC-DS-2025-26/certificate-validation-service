// package: certificates
// file: certificates.proto

/* tslint:disable */
/* eslint-disable */

import * as grpc from "grpc";
import * as certificates_pb from "./certificates_pb";

interface ICertificatesServiceService
	extends grpc.ServiceDefinition<grpc.UntypedServiceImplementation> {
	uploadCertificate: ICertificatesServiceService_IUploadCertificate;
}

interface ICertificatesServiceService_IUploadCertificate
	extends grpc.MethodDefinition<
		certificates_pb.UploadCertificateRequest,
		certificates_pb.UploadCertificateResponse
	> {
	path: "/certificates.CertificatesService/UploadCertificate";
	requestStream: false;
	responseStream: false;
	requestSerialize: grpc.serialize<certificates_pb.UploadCertificateRequest>;
	requestDeserialize: grpc.deserialize<certificates_pb.UploadCertificateRequest>;
	responseSerialize: grpc.serialize<certificates_pb.UploadCertificateResponse>;
	responseDeserialize: grpc.deserialize<certificates_pb.UploadCertificateResponse>;
}

export const CertificatesServiceService: ICertificatesServiceService;

export interface ICertificatesServiceServer {
	uploadCertificate: grpc.handleUnaryCall<
		certificates_pb.UploadCertificateRequest,
		certificates_pb.UploadCertificateResponse
	>;
}

export interface ICertificatesServiceClient {
	uploadCertificate(
		request: certificates_pb.UploadCertificateRequest,
		callback: (
			error: grpc.ServiceError | null,
			response: certificates_pb.UploadCertificateResponse,
		) => void,
	): grpc.ClientUnaryCall;
	uploadCertificate(
		request: certificates_pb.UploadCertificateRequest,
		metadata: grpc.Metadata,
		callback: (
			error: grpc.ServiceError | null,
			response: certificates_pb.UploadCertificateResponse,
		) => void,
	): grpc.ClientUnaryCall;
	uploadCertificate(
		request: certificates_pb.UploadCertificateRequest,
		metadata: grpc.Metadata,
		options: Partial<grpc.CallOptions>,
		callback: (
			error: grpc.ServiceError | null,
			response: certificates_pb.UploadCertificateResponse,
		) => void,
	): grpc.ClientUnaryCall;
}

export class CertificatesServiceClient
	extends grpc.Client
	implements ICertificatesServiceClient
{
	constructor(
		address: string,
		credentials: grpc.ChannelCredentials,
		options?: object,
	);
	public uploadCertificate(
		request: certificates_pb.UploadCertificateRequest,
		callback: (
			error: grpc.ServiceError | null,
			response: certificates_pb.UploadCertificateResponse,
		) => void,
	): grpc.ClientUnaryCall;
	public uploadCertificate(
		request: certificates_pb.UploadCertificateRequest,
		metadata: grpc.Metadata,
		callback: (
			error: grpc.ServiceError | null,
			response: certificates_pb.UploadCertificateResponse,
		) => void,
	): grpc.ClientUnaryCall;
	public uploadCertificate(
		request: certificates_pb.UploadCertificateRequest,
		metadata: grpc.Metadata,
		options: Partial<grpc.CallOptions>,
		callback: (
			error: grpc.ServiceError | null,
			response: certificates_pb.UploadCertificateResponse,
		) => void,
	): grpc.ClientUnaryCall;
}
