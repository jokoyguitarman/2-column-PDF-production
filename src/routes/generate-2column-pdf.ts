import express from 'express';
import { Document, Packer, Paragraph, TextRun, HeadingLevel, SectionType, PageOrientation } from 'docx';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
const router = express.Router();

function cleanAndParseContent(content: string): Paragraph[] {
  // Remove formatting markers and split into paragraphs
  const cleanContent = content
    .replace(/\*\*\*/g, '') // Remove triple asterisks
    .replace(/\*\*/g, '') // Remove double asterisks
    .replace(/###/g, '') // Remove hashtags
    .replace(/\*([^*]+)\*/g, '$1') // Remove single asterisks but keep content
    .trim();

  const paragraphs = cleanContent.split('\n\n').filter(p => p.trim());
  const docParagraphs: Paragraph[] = [];
  
  paragraphs.forEach(para => {
    const trimmedPara = para.trim();
    
    // Check if it's a header (contains "Main Idea:", "Expert Insight:", etc.)
    const isHeader = /^(Page \d+ Analysis:|Main Idea:|Expert Insight:|Detailed Walkthrough:|Potential Confusion:|Relevance:|Create and Refine|Influence Claude|Evaluate Model|Build, Update)/i.test(trimmedPara);
    
    if (isHeader) {
      // Create header paragraph
      docParagraphs.push(
        new Paragraph({
          children: [
            new TextRun({
              text: trimmedPara,
              bold: true,
              size: 28, // 14pt font
              color: "2563EB" // Blue color
            })
          ],
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 400, after: 200 }
        })
      );
    } else {
      // Create regular paragraph
      docParagraphs.push(
        new Paragraph({
          children: [
            new TextRun({
              text: trimmedPara,
              size: 22 // 11pt font
            })
          ],
          spacing: { after: 200 },
          alignment: "justify"
        })
      );
    }
  });
  
  return docParagraphs;
}

router.post('/', async (req, res): Promise<void> => {
  try {
    const { title = 'Study Guide', content = 'No content provided.' } = req.body;

    // Parse and clean the content
    const contentParagraphs = cleanAndParseContent(content);
    
    const doc = new Document({
      sections: [{
        properties: {
          page: {
            margin: {
              top: 1440,    // 1 inch
              right: 1440,  // 1 inch  
              bottom: 1440, // 1 inch
              left: 1440,   // 1 inch
            },
          },
          column: {
            space: 708,  // Space between columns (0.5 inch)
            count: 2,    // 2 columns
            separate: true, // Add separator line between columns
          },
        },
        children: [
          // Title (spans across both columns)
          new Paragraph({
            children: [
              new TextRun({ 
                text: title, 
                bold: true, 
                size: 36, // 18pt font
                color: "1F2937" // Dark gray
              })
            ],
            heading: HeadingLevel.TITLE,
            spacing: { after: 600 },
            alignment: "center"
          }),
          // Add a line break after title
          new Paragraph({
            children: [new TextRun({ text: "", size: 20 })],
            spacing: { after: 400 }
          }),
          // Content paragraphs (will flow in 2 columns)
          ...contentParagraphs
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
