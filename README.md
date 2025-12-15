<div align="center">

# Certificate Validation Service

[![Code quality](https://github.com/FEUP-MEIC-DS-2025-26/certificate-validation-service/actions/workflows/ci.yml/badge.svg)](https://github.com/FEUP-MEIC-DS-2025-26/certificate-validation-service/actions/workflows/ci.yml)
[![Deploy changes](https://github.com/FEUP-MEIC-DS-2025-26/certificate-validation-service/actions/workflows/build-and-deploy.yml/badge.svg)](https://github.com/FEUP-MEIC-DS-2025-26/certificate-validation-service/actions/workflows/build-and-deploy.yml)

**A RESTful microservice for validating and managing certificates for *Made In Portugal*.**

[Features](#-features) • [Quick Start](#-quick-start) • [Development](#-development) • [Deployment](#-deployment) • [Contributors](#-contributors)

</div>

---

## 📋 Overview

The **Certificate Validation Service** is a cloud-native microservice built with Bun and TypeScript that provides RESTful APIs for certificate validation and management for the *Made In Portugal* project. It validates certificates against the ISCC certification database, stores certificate files in Google Cloud Storage, and maintains metadata in Firestore.

### Key Technologies

- **Runtime**: [Bun](https://bun.sh) - Fast all-in-one JavaScript runtime
- **API**: RESTful HTTP endpoints for certificate operations
- **Storage**: Google Cloud Storage - Certificate file storage
- **Database**: Google Cloud Firestore - NoSQL document database
- **Validation**: ISCC Certificate Database integration
- **Infrastructure**: Terraform - Infrastructure as Code
- **CI/CD**: GitHub Actions - Automated deployment pipeline

## ✨ Features

- ✅ **Certificate Validation**: Automatic verification against ISCC certification database
- 📄 **PDF Management**: Upload, list, and delete certificate documents
- ☁️ **Cloud-Native**: Fully integrated with Google Cloud Platform services
- 🐳 **Containerized**: Docker support for consistent deployments
- 🚀 **Auto-Deployment**: Automated CI/CD pipeline to Google Cloud Run
- 🧪 **Mock Storage**: Local development mode without GCP dependencies

## 🚀 Quick Start

### Prerequisites

- [Bun](https://bun.sh) v1.0 or higher
- Docker and Docker Compose (optional)
- Google Cloud Platform account (for production deployment)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/FEUP-MEIC-DS-2025-26/certificate-validation-service.git
   cd certificate-validation-service
   ```

2. **Install dependencies**
   ```bash
   bun install
   ```

3. **Configure environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

## 💻 Development

### Running Locally

1. **Start the server**
   ```bash
   bun run server
   ```

   The server will start on port 8080 (or the port specified in your .env file).

2. **Test the API**

   The service provides the following REST endpoints:

   - `GET /` - Health check
   - `GET /healthz` - Kubernetes health check
   - `POST /certificates/upload` - Upload a certificate
   - `GET /certificates` - List all products with certificates
   - `GET /certificates/:productId` - List certificates for a specific product
   - `DELETE /certificates/:productId/:certId` - Delete a specific certificate

### Code Quality

Run Biome linter and formatter:
```bash
bun run biome check .
bun run biome format --write .
```

### API Examples

**Upload a certificate:**
```bash
curl -X POST http://localhost:8080/certificates/upload \
  -H "Content-Type: application/json" \
  -d '{
    "productId": "ISCC-EU-123456",
    "certificateId": "ISCC-EU-123456",
    "file": "<base64-encoded-pdf>"
  }'
```

**List all products:**
```bash
curl http://localhost:8080/certificates
```

**List certificates for a product:**
```bash
curl http://localhost:8080/certificates/ISCC-EU-123456
```

**Delete a certificate:**
```bash
curl -X DELETE http://localhost:8080/certificates/ISCC-EU-123456/ISCC-EU-123456
```

### Testing Scripts

Use the provided test scripts for quick testing:
```bash
./test_upload.sh    # Test certificate upload
./test_list.sh      # Test listing all certificates
./test_list_product.sh  # Test listing product certificates
./test_delete.sh    # Test deleting certificates
```

## 🐳 Docker

Build and run the service in a container:

```bash
# Build the image
docker build -t certificate-validation-service .

# Run the container
docker run -p 8080:8080 certificate-validation-service
```

Or use Docker Compose:
```bash
docker compose up
```

## 🌐 Deployment

The service is automatically deployed to Google Cloud Run on push to the `main` branch using GitHub Actions.

### Manual Deployment

1. **Authenticate with Google Cloud**
   ```bash
   gcloud auth login
   gcloud config set project made-in-portugal-dsle
   ```

2. **Deploy infrastructure with Terraform**
   ```bash
   cd infra
   terraform init
   terraform plan
   terraform apply
   ```

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | `8080` |
| `PROJECT_ID` | GCP Project ID | `test-project` |
| `BUCKET_NAME` | GCS bucket for certificates | `made-in-portugal-certificates` |
| `FIRESTORE_COLLECTION` | Firestore collection name | `certificates` |
| `USE_MOCK_STORAGE` | Enable mock storage for local dev | `true` (when not in production) |

## 📁 Project Structure

```
certificate-validation-service/
├── .github/workflows/     # CI/CD pipelines
├── certificates/          # Local certificate storage
├── infra/                 # Terraform infrastructure code
├── services/              # Business logic services
│   ├── certificates.service.ts    # Certificate validation and storage
│   └── communication.service.ts   # Request handling
├── tests/                 # Test files
├── server.ts              # Main HTTP server application
├── Dockerfile             # Container configuration
├── docker-compose.yaml    # Docker Compose setup
├── test_*.sh              # Testing scripts
└── package.json           # Project dependencies
```

## 👥 Contributors

<table>
  <tr>
    <td align="center">
      <a href="https://github.com/goncaloconceicao">
        <img src="https://github.com/goncaloconceicao.png" width="100px;" alt="Gonçalo Conceição"/>
        <br />
        <sub><b>Gonçalo Conceição</b></sub>
      </a>
    </td>
    <td align="center">
      <a href="https://github.com/HenriqueSFernandes">
        <img src="https://github.com/HenriqueSFernandes.png" width="100px;" alt="Henrique Fernandes"/>
        <br />
        <sub><b>Henrique Fernandes</b></sub>
      </a>
    </td>
    <td align="center">
      <a href="https://github.com/PedroOliveira42">
        <img src="https://github.com/PedroOliveira42.png" width="100px;" alt="Pedro Oliveira"/>
        <br />
        <sub><b>Pedro Oliveira</b></sub>
      </a>
    </td>
    <td align="center">
      <a href="https://github.com/rubuy-74">
        <img src="https://github.com/rubuy-74.png" width="100px;" alt="Rubem Neto"/>
        <br />
        <sub><b>Rubem Neto</b></sub>
      </a>
    </td>
    <td align="center">
      <a href="https://github.com/esperaumbocado">
        <img src="https://github.com/esperaumbocado.png" width="100px;" alt="Rui Borges"/>
        <br />
        <sub><b>Rui Borges</b></sub>
      </a>
    </td>
    <td align="center">
      <a href="https://github.com/Etieltomas">
        <img src="https://github.com/Etieltomas.png" width="100px;" alt="Tomás Leite"/>
        <br />
        <sub><b>Tomás Leite</b></sub>
      </a>
    </td>
  </tr>
</table>

## 📄 License

This project is part of the FEUP MEIC - Large Scale Software Development course (2025-26).

