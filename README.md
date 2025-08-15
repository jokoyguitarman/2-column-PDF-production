# PDF Generation Microservice

A standalone microservice for generating Word documents and converting them to PDF with true 2-column layouts.

## Features

- **2-Column PDF Generation**: Automated Word document creation with proper 2-column layout using tables
- **Word Document Generation**: Create DOCX files with professional formatting
- **DOCX to PDF Conversion**: Convert Word documents to PDF using LibreOffice or Pandoc
- **Health Monitoring**: Built-in health check endpoint
- **Docker Support**: Containerized deployment with all dependencies

## Tech Stack

- **Node.js** with TypeScript
- **Express.js** for REST API
- **docx** library for Word document generation
- **LibreOffice** and **Pandoc** for PDF conversion
- **Docker** for containerization

## Prerequisites

### Local Development
- Node.js 18+
- npm 9+
- LibreOffice (for PDF conversion)
- Pandoc (fallback for PDF conversion)

### Docker Deployment
- Docker
- All dependencies included in container

## Quick Start

### Local Development

1. Install dependencies:
```bash
npm install
```

2. Build the project:
```bash
npm run build
```

3. Start the server:
```bash
npm start
```

### Docker

1. Build the image:
```bash
docker build -t pdf-microservice .
```

2. Run the container:
```bash
docker run -p 3000:3000 pdf-microservice
```

## API Endpoints

### Health Check
- **GET** `/health`
- Returns service status and timestamp

### Generate 2-Column PDF
- **POST** `/api/generate-2column-pdf`
- Body: `{ "title": "Study Guide", "content": "Your content here..." }`
- Returns: PDF file download

### Generate Word Document
- **POST** `/api/generate-word-docx`
- Body: `{ "title": "Study Guide", "content": "Your content here..." }`
- Returns: DOCX file download

### Convert DOCX to PDF
- **POST** `/api/convert-docx-to-pdf`
- Body: `{ "docxBuffer": "base64-encoded-docx-data" }`
- Returns: PDF file download

## Docker Configuration

The Dockerfile includes:
- Node.js 18 runtime
- LibreOffice, Pandoc, wkhtmltopdf
- Build tools for TypeScript compilation
- Health check monitoring
- Optimized layer caching

## Deployment on Render

1. Connect your repository to Render
2. Select "Web Service"
3. Configure:
   - **Build Command**: `docker build -t pdf-service .`
   - **Start Command**: `docker run -p $PORT:3000 pdf-service`
   - **Dockerfile**: Use existing Dockerfile

## Troubleshooting

### PDF Conversion Issues
- Ensure LibreOffice and Pandoc are installed
- Check temporary file permissions
- Verify system dependencies in Docker container

### Build Failures
- Confirm all npm dependencies are installed
- Check TypeScript compilation errors
- Verify Docker base image compatibility

## License

MIT
