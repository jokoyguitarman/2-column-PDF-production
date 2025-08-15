import express from 'express';
import { Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell, WidthType } from 'docx';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
const router = express.Router();

function createTwoColumnContent(content: string): Table[] {
  const paragraphs = content.split('\n\n').filter(p => p.trim());
  const tables: Table[] = [];
  
  // Process paragraphs in pairs for 2-column layout
  for (let i = 0; i < paragraphs.length; i += 2) {
    const leftContent = paragraphs[i];
    const rightContent = paragraphs[i + 1] || ''; // Handle odd number of paragraphs
    
    const table = new Table({
      width: {
        size: 100,
        type: WidthType.PERCENTAGE,
      },
      rows: [
        new TableRow({
          children: [
            new TableCell({
              children: [
                new Paragraph({
                  children: [new TextRun(leftContent)],
                  spacing: { after: 200 }
                })
              ],
              width: {
                size: 48,
                type: WidthType.PERCENTAGE,
              },
            }),
            new TableCell({
              children: [
                new Paragraph({
                  children: [new TextRun(rightContent)],
                  spacing: { after: 200 }
                })
              ],
              width: {
                size: 48,
                type: WidthType.PERCENTAGE,
              },
            }),
          ],
        }),
      ],
    });
    
    tables.push(table);
  }
  
  return tables;
}

router.post('/', async (req, res) => {
  try {
    const { title = 'Study Guide', content = 'No content provided.' } = req.body;

    // Create Word document with 2-column layout using tables
    const tables = createTwoColumnContent(content);
    
    const doc = new Document({
      sections: [{
        children: [
          new Paragraph({
            children: [new TextRun({ text: title, bold: true, size: 32 })],
            heading: HeadingLevel.TITLE,
            spacing: { after: 400 }
          }),
          ...tables
        ],
      }],
    });

    // Generate DOCX buffer
    const docxBuffer = await Packer.toBuffer(doc);

    // Create temporary files
    const tempDir = os.tmpdir();
    const docxPath = path.join(tempDir, `temp-${Date.now()}.docx`);
    const pdfPath = path.join(tempDir, `temp-${Date.now()}.pdf`);

    // Write DOCX to temporary file
    fs.writeFileSync(docxPath, docxBuffer);

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
    res.setHeader('Content-Disposition', `attachment; filename="${title.replace(/[^a-zA-Z0-9]/g, '_')}.pdf"`);
    res.send(pdfBuffer);

  } catch (error) {
    console.error('Error generating 2-column PDF:', error);
    res.status(500).json({ 
      error: 'Failed to generate PDF',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export { router as generate2ColumnPdfRouter };
