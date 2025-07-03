import * as pdfjsLib from 'pdfjs-dist';

// Configure PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString();

/**
 * Interface for extracted PDF data
 */
export interface ExtractedPDFData {
  text: string;
  pageBreaks: number[];
  pageCount: number;
}

/**
 * Fetch a PDF file from a URL and convert it to a File object
 * @param url - The URL to fetch the PDF from
 * @param filename - Optional filename for the File object
 * @returns Promise containing a File object
 */
export async function fetchPdfFile(url: string, filename: string = 'document.pdf'): Promise<File> {
  try {
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch PDF: ${response.status} ${response.statusText}`);
    }
    
    const blob = await response.blob();
    
    // Verify it's a PDF
    if (blob.type !== 'application/pdf' && !url.endsWith('.pdf')) {
      throw new Error('Fetched file is not a PDF');
    }
    
    // Create File object from blob
    const file = new File([blob], filename, { type: 'application/pdf' });
    
    return file;
  } catch (error) {
    console.error('Error fetching PDF file:', error);
    throw new Error(`Failed to load PDF from ${url}: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Process a PDF file and extract text content
 * @param file - The PDF file to process
 * @param onProcessingStateChange - Callback for processing state changes
 * @param setProcessingStage - Callback for processing stage updates
 * @returns Promise containing extracted PDF data
 */
export async function processPdfDocument(
  file: File,
  onProcessingStateChange: (processing: boolean) => void,
  setProcessingStage: (stage: string) => void
): Promise<ExtractedPDFData> {
  if (file.type !== 'application/pdf') {
    throw new Error('Please select a PDF file');
  }

  onProcessingStateChange(true);
  
  try {
    // Stage 1: Extract text from PDF
    setProcessingStage('Extracting text from PDF...');
    const extractedData = await extractTextFromPDF(file);
    
    // Stage 2: Finalize
    setProcessingStage('Finalizing document processing...');
    await new Promise(resolve => setTimeout(resolve, 100));
    
    setProcessingStage('');
    return extractedData;
    
  } catch (err) {
    console.error('PDF processing error:', err);
    setProcessingStage('');
    throw new Error(err instanceof Error ? err.message : 'Failed to process PDF');
  } finally {
    onProcessingStateChange(false);
  }
}

/**
 * Extracts text content from a PDF file using PDF.js
 * This is a fully client-side operation - no external APIs involved
 * 
 * @param file - The PDF file to process
 * @returns Promise containing extracted text and page information
 */
export async function extractTextFromPDF(file: File): Promise<ExtractedPDFData> {
  try {
    // Convert file to array buffer for PDF.js
    const arrayBuffer = await file.arrayBuffer();
    
    // Load the PDF document
    const pdf = await pdfjsLib.getDocument({
      data: arrayBuffer,
      // Disable network requests and external resources
      disableFontFace: true,
      disableRange: false,
      disableStream: false
    }).promise;

    let fullText = '';
    const pageBreaks: number[] = [];
    
    // Extract text from each page
    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();
      
      // Record page break position
      if (pageNum > 1) {
        pageBreaks.push(fullText.length);
      }
      
      // Combine text items from the page
      let pageText = '';
      const textItems = textContent.items;
      
      for (let i = 0; i < textItems.length; i++) {
        const item = textItems[i];
        
        // Check if this is a text item (not just positioning info)
        if ('str' in item) {
          pageText += item.str;
          
          // Add space between text items if needed
          // PDF.js sometimes splits words across items
          if (i < textItems.length - 1) {
            const nextItem = textItems[i + 1];
            if ('str' in nextItem && !item.str.endsWith(' ') && !nextItem.str.startsWith(' ')) {
              // Check if there's significant spacing between items
              const currentTransform = item.transform;
              const nextTransform = nextItem.transform;
              
              if (currentTransform && nextTransform) {
                const currentX = currentTransform[4];
                const nextX = nextTransform[4];
                const gap = Math.abs(nextX - currentX);
                
                // If there's a reasonable gap, add a space
                if (gap > 5) {
                  pageText += ' ';
                }
              }
            }
          }
        }
      }
      
      // Clean up the page text
      pageText = pageText
        .replace(/\s+/g, ' ') // Normalize whitespace
        .trim();
      
      // Add page text to full document
      if (pageText) {
        if (fullText && !fullText.endsWith('\n')) {
          fullText += '\n';
        }
        fullText += pageText;
      }
    }

    // Final cleanup of extracted text
    fullText = fullText
      .replace(/\n\s*\n/g, '\n\n') // Normalize paragraph breaks
      .replace(/([.!?])\s*\n/g, '$1\n\n') // Ensure sentence endings are properly spaced
      .trim();

    if (!fullText) {
      throw new Error('No text content found in PDF. The document may be image-based or encrypted.');
    }

    return {
      text: fullText,
      pageBreaks,
      pageCount: pdf.numPages
    };

  } catch (error) {
    console.error('PDF extraction error:', error);
    
    if (error instanceof Error) {
      // Provide more specific error messages
      if (error.message.includes('Invalid PDF')) {
        throw new Error('Invalid PDF format. Please ensure the file is a valid PDF document.');
      } else if (error.message.includes('password')) {
        throw new Error('Password-protected PDFs are not supported.');
      } else {
        throw new Error(`PDF processing failed: ${error.message}`);
      }
    } else {
      throw new Error('Unknown error occurred while processing PDF');
    }
  }
}

/**
 * Utility function to validate PDF file
 */
export function isValidPDFFile(file: File): boolean {
  return file.type === 'application/pdf' && file.size > 0;
}

/**
 * Get basic PDF metadata without full processing
 */
export async function getPDFMetadata(file: File): Promise<{ title?: string; author?: string; pageCount: number }> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const metadata = await pdf.getMetadata();
    
    return {
      title: metadata.info?.Title || file.name,
      author: metadata.info?.Author,
      pageCount: pdf.numPages
    };
  } catch (error) {
    console.error('PDF metadata extraction error:', error);
    return { pageCount: 0 };
  }
}