import express from 'express';
import { Document, Packer, Paragraph, TextRun } from 'docx';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
const router = express.Router();

function cleanAndParseContent(content: string): Paragraph[] {
  const paragraphs = content.split('\n\n').filter(p => p.trim());
  const docParagraphs: Paragraph[] = [];
  
  paragraphs.forEach((para) => {
    const trimmedPara = para.trim();
    
    // Check if it's a header using ChatGPT's markdown formatting
    const isMarkdownHeader = trimmedPara.startsWith('###') || trimmedPara.startsWith('##') || trimmedPara.startsWith('#');
    const hasBoldFormatting = trimmedPara.includes('**');
    
    // Clean the text by removing ALL markdown markers thoroughly
    let cleanText = trimmedPara
      .replace(/^#+\s*/g, '') // Remove ### ## # from start
      .replace(/\*\*\*/g, '') // Remove triple asterisks
      .replace(/\*\*/g, '') // Remove double asterisks
      .replace(/\*([^*]+)\*/g, '$1') // Remove single asterisks but keep content
      .replace(/#+/g, '') // Remove any remaining # symbols
      .replace(/\*/g, '') // Remove any remaining * symbols
      .replace(/_{2,}/g, '') // Remove underscores __ 
      .replace(/_([^_]+)_/g, '$1') // Remove single underscores but keep content
      .replace(/`{1,3}/g, '') // Remove backticks ``` `` `
      .replace(/~~([^~]+)~~/g, '$1') // Remove strikethrough ~~ but keep content
      .trim(); // Clean up whitespace
    
    if (isMarkdownHeader || hasBoldFormatting) {
      // It's a header - check if it has a colon to split bold/regular parts
      const colonIndex = cleanText.indexOf(':');
      if (colonIndex > -1) {
        const headerLabel = cleanText.substring(0, colonIndex + 1); // Include the colon
        const remainingText = cleanText.substring(colonIndex + 1).trim(); // Rest of the text
        
        // Create paragraph with bold header and regular text
        docParagraphs.push(
          new Paragraph({
            children: [
              new TextRun({
                text: headerLabel + " ",
                bold: true,
                size: 20, // 10pt font
                color: "000000", // Black text
                font: {
                  name: "Times New Roman"
                }
              }),
              new TextRun({
                text: remainingText,
                bold: false,
                size: 20, // 10pt font
                color: "000000", // Black text
                font: {
                  name: "Times New Roman"
                }
              })
            ],
            spacing: { before: 240, after: 120 },
            alignment: "both"
          })
        );
      } else {
        // Header without colon (entire thing is bold)
        docParagraphs.push(
          new Paragraph({
            children: [
              new TextRun({
                text: cleanText,
                bold: true,
                size: 20, // 10pt font
                color: "000000", // Black text
                font: {
                  name: "Times New Roman"
                }
              })
            ],
            spacing: { before: 240, after: 120 },
            alignment: "both"
          })
        );
      }
    } else {
      // Create regular paragraph
      docParagraphs.push(
        new Paragraph({
          children: [
            new TextRun({
              text: cleanText,
              size: 20, // 10pt font
              color: "000000", // Black text
              bold: false,
              font: {
                name: "Times New Roman"
              }
            })
          ],
          spacing: { after: 120 },
          alignment: "both"
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
          // Simple document title
          new Paragraph({
            children: [
              new TextRun({ 
                text: title, 
                bold: true, 
                size: 24, // 12pt font
                color: "000000", // Black text
                font: {
                  name: "Times New Roman"
                }
              })
            ],
            spacing: { after: 360 },
            alignment: "center"
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
