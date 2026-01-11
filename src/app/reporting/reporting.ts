import { CommonModule, DecimalPipe } from '@angular/common';
import { Component, OnInit } from '@angular/core';
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
  rawHistory: any[] = [];
  filteredHistory: any[] = [];

  // These link to the search bars in the HTML
  filterText: string = '';
  startDate: string = '';
  endDate: string = '';
  sortDirection: 'asc' | 'desc' = 'desc';

  constructor(private db: Database) {}

  ngOnInit() {
    this.loadArchivedData();
  }

  loadArchivedData() {
    this.db.getAssisted().subscribe({
      next: (data) => {
        this.rawHistory = data;
        this.applyFilters();
      },
      error: (err) => console.error('Error loading history:', err)
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