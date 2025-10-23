// package: certificates
// file: certificates.proto

/* tslint:disable */
/* eslint-disable */

import * as jspb from "google-protobuf";

export class UploadCertificateRequest extends jspb.Message { 
    getProductid(): number;
    setProductid(value: number): UploadCertificateRequest;
    getFile(): Uint8Array | string;
    getFile_asU8(): Uint8Array;
    getFile_asB64(): string;
    setFile(value: Uint8Array | string): UploadCertificateRequest;

    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): UploadCertificateRequest.AsObject;
    static toObject(includeInstance: boolean, msg: UploadCertificateRequest): UploadCertificateRequest.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: UploadCertificateRequest, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): UploadCertificateRequest;
    static deserializeBinaryFromReader(message: UploadCertificateRequest, reader: jspb.BinaryReader): UploadCertificateRequest;
}

export namespace UploadCertificateRequest {
    export type AsObject = {
        productid: number,
        file: Uint8Array | string,
    }
}

export class UploadCertificateResponse extends jspb.Message { 
    getMessage(): string;
    setMessage(value: string): UploadCertificateResponse;

    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): UploadCertificateResponse.AsObject;
    static toObject(includeInstance: boolean, msg: UploadCertificateResponse): UploadCertificateResponse.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: UploadCertificateResponse, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): UploadCertificateResponse;
    static deserializeBinaryFromReader(message: UploadCertificateResponse, reader: jspb.BinaryReader): UploadCertificateResponse;
}

export namespace UploadCertificateResponse {
    export type AsObject = {
        message: string,
    }
}
