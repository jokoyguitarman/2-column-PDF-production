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
  // Remove formatting markers and split into paragraphs
  const cleanContent = content
    .replace(/\*\*\*/g, '') // Remove triple asterisks
    .replace(/\*\*/g, '') // Remove double asterisks
    .replace(/###/g, '') // Remove hashtags
    .replace(/\*([^*]+)\*/g, '$1') // Remove single asterisks but keep content
    .trim();

  const paragraphs = cleanContent.split('\n\n').filter(p => p.trim());
  const docParagraphs: Paragraph[] = [];
  
  paragraphs.forEach((para, index) => {
    const trimmedPara = para.trim();
    
    // Check if it's a header (contains "Main Idea:", "Expert Insight:", etc.)
    const isHeader = /^(Page \d+ Analysis:|Main Idea:|Expert Insight:|Detailed Walkthrough:|Potential Confusion:|Relevance:|Create and Refine|Influence Claude|Evaluate Model|Build, Update)/i.test(trimmedPara);
    
    if (isHeader) {
      // Create flashy header with gradient-like styling
      const headerColors = ["2563EB", "7C3AED", "DC2626", "059669", "D97706"]; // Blue, Purple, Red, Green, Orange
      const headerColor = headerColors[index % headerColors.length];
      
      docParagraphs.push(
        new Paragraph({
          children: [
            new TextRun({
              text: "● ", // Bullet point
              bold: true,
              size: 24,
              color: headerColor
            }),
            new TextRun({
              text: trimmedPara,
              bold: true,
              size: 22, // 11pt font
              color: headerColor
            })
          ],
          spacing: { before: 360, after: 180 },
          shading: {
            type: "solid",
            color: "F8FAFC", // Very light gray background
            fill: "F8FAFC"
          },
          border: {
            left: {
              color: headerColor,
              space: 1,
              style: "single",
              size: 12 // Thick left border
            }
          },
          indent: {
            left: 144 // Indent from left border
          }
        })
      );
    } else {
      // Create styled regular paragraph with modern typography
      docParagraphs.push(
        new Paragraph({
          children: [
            new TextRun({
              text: trimmedPara,
              size: 20, // 10pt font
              color: "1F2937", // Dark text for readability
              bold: false // Explicitly set to false
            })
          ],
          spacing: { after: 160 },
          alignment: "both",
          indent: {
            left: 144, // Align with header content
            hanging: 0
          }
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
          // Document title with flashy styling
          new Paragraph({
            children: [
              new TextRun({ 
                text: "✦ ", 
                bold: true, 
                size: 32,
                color: "2563EB" // Blue
              }),
              new TextRun({ 
                text: title, 
                bold: true, 
                size: 28, // 14pt font
                color: "1F2937"
              }),
              new TextRun({ 
                text: " ✦", 
                bold: true, 
                size: 32,
                color: "2563EB" // Blue
              })
            ],
            spacing: { after: 480 },
            alignment: "center",
            shading: {
              type: "solid",
              color: "F0F9FF", // Very light blue background
              fill: "F0F9FF"
            },
            border: {
              top: {
                color: "2563EB",
                space: 2,
                style: "double",
                size: 6
              },
              bottom: {
                color: "2563EB",
                space: 2,
                style: "double", 
                size: 6
              }
            }
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
