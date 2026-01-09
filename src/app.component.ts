import { Component, signal, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { GeminiService } from './services/gemini.service';
import { ZipService, GeneratedFile } from './services/zip.service';

interface FolderData {
  name: string;
  images: { url: string; base64: string; name: string }[];
}

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './app.component.html',
  styleUrls: [] // Using Tailwind classes
})
export class AppComponent {
  private fb = inject(FormBuilder);
  private geminiService = inject(GeminiService);
  private zipService = inject(ZipService);

  // Form
  configForm: FormGroup = this.fb.group({
    theme: ['Farmacia', [Validators.required, Validators.minLength(2)]],
    folderCount: [5, [Validators.required, Validators.min(1), Validators.max(20)]],
    imagesPerFolder: [2, [Validators.required, Validators.min(1), Validators.max(5)]]
  });

  // State
  isGenerating = signal(false);
  progress = signal(0);
  logs = signal<string[]>([]);
  folders = signal<FolderData[]>([]);
  lastTheme = signal<string>('');
  
  // Computed
  hasResults = computed(() => this.folders().length > 0);
  isSameTheme = computed(() => this.lastTheme().toLowerCase() === this.configForm.value.theme?.trim().toLowerCase());
  
  // Actions
  async startGeneration() {
    if (this.configForm.invalid || this.isGenerating()) return;

    const { theme, folderCount, imagesPerFolder } = this.configForm.value;
    const currentTheme = theme.trim();

    this.isGenerating.set(true);
    
    // Memory Logic:
    // If theme changed, clear everything.
    // If theme is same, keep existing folders and append new ones (exclude existing names).
    if (this.lastTheme().toLowerCase() !== currentTheme.toLowerCase()) {
      this.folders.set([]);
      this.lastTheme.set(currentTheme);
      this.progress.set(0);
      this.logs.set([`Initializing new generation for "${currentTheme}"...`]);
    } else {
      this.logs.update(prev => [...prev, `Adding more folders to "${currentTheme}"...`]);
    }

    const existingCategories = this.folders().map(f => f.name);

    try {
      // Step 1: Brainstorm Categories (with exclusions)
      this.addLog(`Brainstorming ${folderCount} new categories (Spanish)...`);
      if (existingCategories.length > 0) {
        this.addLog(`Ignoring ${existingCategories.length} existing categories.`);
      }

      const categories = await this.geminiService.generateCategories(currentTheme, folderCount, existingCategories);
      
      if (categories.length === 0) {
        throw new Error('Could not find new distinct categories. Try changing the theme or clearing the list.');
      }

      this.addLog(`New categories found: ${categories.join(', ')}`);
      
      // Calculate progress base
      // If appending, we just restart progress bar for this batch visually or we could try to be fancy.
      // Let's just make it 0-100% for *this batch*.
      this.progress.set(10);

      // Step 2: Generate Images for each Category
      const totalImages = categories.length * imagesPerFolder;
      let completedImages = 0;
      const newFolders: FolderData[] = [];

      for (const category of categories) {
        this.addLog(`Processing folder: ${category}...`);
        
        const folder: FolderData = {
          name: category,
          images: []
        };

        // Generate N images for this category
        for (let i = 1; i <= imagesPerFolder; i++) {
          const imageName = `img${i}.jpg`;
          this.addLog(`  > Generating ${category}/${imageName}...`);
          
          const base64Data = await this.geminiService.generateImage(currentTheme, category);
          
          if (base64Data) {
            folder.images.push({
              name: imageName,
              base64: base64Data,
              url: `data:image/jpeg;base64,${base64Data}`
            });
          } else {
             this.addLog(`  ! Failed to generate ${imageName} for ${category}`);
          }

          completedImages++;
          this.progress.set(10 + Math.floor((completedImages / totalImages) * 90));
        }

        newFolders.push(folder);
        // Append incrementally
        this.folders.update(current => [...current, folder]);
      }

      this.addLog('Batch generation complete!');
      this.progress.set(100);

    } catch (error: any) {
      this.addLog(`Error: ${error.message || 'Unknown error occurred'}`);
      console.error(error);
    } finally {
      this.isGenerating.set(false);
    }
  }

  resetAll() {
    this.folders.set([]);
    this.lastTheme.set('');
    this.logs.set(['Session cleared.']);
    this.progress.set(0);
  }

  downloadZip() {
    if (!this.hasResults()) return;

    const theme = this.lastTheme() || this.configForm.value.theme;
    const allFiles: GeneratedFile[] = [];

    this.folders().forEach(folder => {
      folder.images.forEach(img => {
        allFiles.push({
          category: folder.name,
          filename: img.name,
          base64Data: img.base64
        });
      });
    });

    this.zipService.downloadZip(theme, allFiles);
  }

  private addLog(message: string) {
    this.logs.update(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${message}`]);
  }
}