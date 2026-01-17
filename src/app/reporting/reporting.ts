import { CommonModule, DecimalPipe } from '@angular/common';
import { Component, OnInit, ChangeDetectorRef, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Database } from '../database';

@Component({
  selector: 'app-reporting',
  standalone: true,
  imports: [CommonModule, FormsModule, DecimalPipe],
  templateUrl: './reporting.html',
  styleUrl: './reporting.css',
})
export class Reporting implements OnInit {
  private cdr = inject(ChangeDetectorRef);
  private db = inject(Database);

  rawHistory: any[] = [];
  filteredHistory: any[] = [];
  isLoading: boolean = true;

  // These link to the search bars in the HTML
  filterText: string = '';
  startDate: string = '';
  endDate: string = '';
  sortDirection: 'asc' | 'desc' = 'desc';

  ngOnInit() {
    this.loadArchivedData();
  }

  loadArchivedData() {
    this.isLoading = true;
    this.cdr.detectChanges();
    
    // Set a timeout to prevent infinite loading - max 5 seconds
    const loadingTimeout = setTimeout(() => {
      if (this.isLoading) {
        console.warn('History loading timeout - force close loading screen');
        this.isLoading = false;
        this.cdr.detectChanges();
      }
    }, 5000);
    
    this.db.getAssisted().subscribe({
      next: (data) => {
        clearTimeout(loadingTimeout);
        this.rawHistory = data;
        this.applyFilters();
        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        clearTimeout(loadingTimeout);
        console.error('Error loading history:', err);
        this.isLoading = false;
        this.cdr.detectChanges();
      }
    });
  }

  getProductsList(row: any): string[] {
    const products = [row['Product 1'], row['Product 2'], row['Product 3'], row['Product 4'], row['Product 5']];
    return products.filter(p => p && p.toString().trim() !== '');
  }

  applyFilters() {
    this.filteredHistory = this.rawHistory.filter(item => {
      const search = this.filterText.toLowerCase();
      const matchesText = !search || 
        item['Name']?.toLowerCase().includes(search) || 
        item['Cellphone Number']?.toString().includes(search);

      if (!this.startDate && !this.endDate) return matchesText;
      
      const itemDate = new Date(item['Date']).getTime();
      const start = this.startDate ? new Date(this.startDate).getTime() : null;
      const end = this.endDate ? new Date(this.endDate).getTime() : null;
      
      return matchesText && (!start || itemDate >= start) && (!end || itemDate <= end);
    });
    this.sortData();
  }

  sortData() {
    this.filteredHistory.sort((a, b) => {
      const valA = new Date(a['Date']).getTime();
      const valB = new Date(b['Date']).getTime();
      return this.sortDirection === 'asc' ? valA - valB : valB - valA;
    });
  }

  toggleSort() {
    this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    this.sortData();
  }

  get totalRevenue(): number {
    return this.filteredHistory.reduce((acc, curr) => {
      const amt = parseFloat(curr['Amount']) || 0;
      return acc + amt;
    }, 0);
  }
}