import express from 'express';
import { Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell, WidthType } from 'docx';

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

    // Send DOCX as response
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename="${title.replace(/[^a-zA-Z0-9]/g, '_')}.docx"`);
    res.send(docxBuffer);

  } catch (error) {
    console.error('Error generating Word document:', error);
    res.status(500).json({ 
      error: 'Failed to generate Word document',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export { router as generateWordDocxRouter };
