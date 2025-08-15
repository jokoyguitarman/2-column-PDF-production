import express from 'express';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
const router = express.Router();

router.post('/', async (req, res) => {
  try {
    const { docxBuffer } = req.body;

    if (!docxBuffer) {
      return res.status(400).json({ error: 'No DOCX buffer provided' });
    }

    // Decode base64 buffer
    const buffer = Buffer.from(docxBuffer, 'base64');

    // Create temporary files
    const tempDir = os.tmpdir();
    const docxPath = path.join(tempDir, `temp-${Date.now()}.docx`);
    const pdfPath = path.join(tempDir, `temp-${Date.now()}.pdf`);

    // Write DOCX to temporary file
    fs.writeFileSync(docxPath, buffer);

    try {
      // Try LibreOffice first
      await execAsync(`soffice --headless --convert-to pdf --outdir "${tempDir}" "${docxPath}"`);
    } catch (libreofficeError) {
      console.log('LibreOffice failed, trying Pandoc...');
      try {
        // Fallback to Pandoc
        await execAsync(`pandoc "${docxPath}" -o "${pdfPath}" --pdf-engine=wkhtmltopdf`);
      } catch (pandocError) {
        throw new Error('Both LibreOffice and Pandoc conversion failed');
      }
    }

    // Read the generated PDF
    const pdfBuffer = fs.readFileSync(pdfPath);

    // Clean up temporary files
    try {
      fs.unlinkSync(docxPath);
      fs.unlinkSync(pdfPath);
    } catch (cleanupError) {
      console.warn('Failed to clean up temporary files:', cleanupError);
    }

    // Send PDF as response
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="converted.pdf"');
    res.send(pdfBuffer);

  } catch (error) {
    console.error('Error converting DOCX to PDF:', error);
    res.status(500).json({ 
      error: 'Failed to convert DOCX to PDF',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export { router as convertDocxToPdfRouter };
