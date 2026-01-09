import { Injectable } from '@angular/core';

// Declare external globals from CDN
declare const JSZip: any;
declare const saveAs: any;

export interface GeneratedFile {
  category: string;
  filename: string;
  base64Data: string;
}

@Injectable({
  providedIn: 'root'
})
export class ZipService {

  constructor() {}

  async downloadZip(theme: string, files: GeneratedFile[]) {
    if (typeof JSZip === 'undefined' || typeof saveAs === 'undefined') {
      console.error('JSZip or FileSaver libraries not loaded.');
      alert('Error: Export libraries not loaded properly.');
      return;
    }

    const zip = new JSZip();
    
    // Create root folder named after theme
    const root = zip.folder(theme.replace(/[^a-z0-9]/gi, '_').toLowerCase());

    files.forEach(file => {
      // Create category folder inside theme folder
      const folderName = file.category.replace(/[^a-z0-9]/gi, '_');
      const folder = root.folder(folderName);
      
      // Add image to that folder
      // JSZip expects base64 without the data URI prefix for 'base64' option
      folder.file(file.filename, file.base64Data, { base64: true });
    });

    try {
      const content = await zip.generateAsync({ type: 'blob' });
      saveAs(content, `${theme}_dataset.zip`);
    } catch (err) {
      console.error('Error generating zip:', err);
    }
  }
}