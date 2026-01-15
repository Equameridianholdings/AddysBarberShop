import { CommonModule } from '@angular/common';
import { Component, inject, OnInit, ChangeDetectorRef } from '@angular/core';
import { Database } from '../database';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-que',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './que.html',
  styleUrl: './que.css',
})
export class Que implements OnInit {
  private db = inject(Database);
  private cdr = inject(ChangeDetectorRef);

  // Data lists
  unservedCustomers: any[] = [];
  allCustomers: any[] = [];
  allAssistedData: any[] = []; 
  priceList: any[] = [];
  barbers: any[] = [];
  
  // UI State Management
  isLoading = true; 
  isSubmitting = false;
  showJoinModal = false;
  isUserSelected = false; 
  isExistingUser = false; 
  currentTime = new Date();
  toaster = { show: false, message: '', success: true };

  // New Client Form Data
  newClient = { 
    name: '', 
    cellphoneNumber: '+27', 
    barber: '' 
  };

  // Checkout Selection Logic
  selectedCustomer: any = null;
  selectedProducts: any[] = [];
  showCashModal = false;
  showDigitalModal = false;
  cashReceived = 0;

  // Skip Logic
  showSkipModal = false;
  customerToSkip: any = null;

  ngOnInit() {
    this.initialLoad();

    // Auto-refresh clock for wait times
    setInterval(() => {
      this.currentTime = new Date();
      this.cdr.detectChanges();
    }, 60000);
  }

  /**
   * Core Data Loading with Error/Timeout Handling
   */
 initialLoad() {
  this.isLoading = true;
  this.cdr.detectChanges();

  this.db.getQueue('Queue').subscribe({
    next: (data: any[]) => {
      this.allCustomers = data; 
      this.unservedCustomers = data.filter(c => !c['Time Out'] || c['Time Out'].trim() === '');
      this.isLoading = false; // Data arrived, hide loader
      this.cdr.detectChanges();
    },
    error: (err) => {
      console.error('Connection failed:', err);
      this.isLoading = false; // STOP the "Opening Shop" spinner so the error shows
      this.showToaster('Connection error. Please check your internet or refresh.', false);
      this.cdr.detectChanges();
    }
  });
}

  loadAssistedHistory() {
    this.db.getAssisted().subscribe({
      next: (data) => {
        this.allAssistedData = data;
        this.cdr.detectChanges();
      },
      error: () => console.log('Assisted history retry pending...')
    });
  }

  fetchPrices() {
    this.db.getPrices().subscribe({
      next: (data) => {
        this.priceList = data;
        this.cdr.detectChanges();
      }
    });
  }

  fetchBarbers() {
    this.db.getBarbers().subscribe(data => {
      this.barbers = data;
      this.cdr.detectChanges();
    });
  }

  /**
   * Selection Logic (Fixes the highlighting issue)
   */
  toggleProduct(product: any) {
    const index = this.selectedProducts.findIndex(p => p.CutType === product.CutType);
    
    if (index > -1) {
      this.selectedProducts.splice(index, 1);
    } else if (this.selectedProducts.length < 5) {
      this.selectedProducts.push(product);
    }
    this.cdr.detectChanges(); 
  }

  isProductSelected(product: any): boolean {
    return this.selectedProducts.some(p => p.CutType === product.CutType);
  }

  getTotal(): number {
    return this.selectedProducts.reduce((sum, p) => sum + Number(p.Price || 0), 0);
  }

  get changeDue(): number {
    return Math.max(0, this.cashReceived - this.getTotal());
  }

  /**
   * Form & Queue Actions
   */
  onPhoneInput() {
    const typedPhone = this.newClient.cellphoneNumber.trim();
    const existingUser = this.allAssistedData.find(u => {
      let sheetCell = u['Cellphone Number']?.toString() || '';
      if (sheetCell && !sheetCell.startsWith('+')) sheetCell = '+' + sheetCell;
      return sheetCell === typedPhone;
    });

    if (existingUser) {
      this.newClient.name = existingUser['Name'];
      this.newClient.barber = existingUser['Barber'];
      this.isExistingUser = true; 
      this.isUserSelected = true;
    } else {
      this.isExistingUser = false;
      this.isUserSelected = typedPhone.length >= 12; 
    }
    this.cdr.detectChanges();
  }

  submitToQueue() {
  const phoneRegex = /^\+27\d{9}$/;
  if (!this.newClient.name || !this.newClient.barber) {
    this.showToaster('Name and Barber required.', false);
    return;
  }
  if (!phoneRegex.test(this.newClient.cellphoneNumber)) {
    this.showToaster('Invalid Phone (+27 + 9 digits).', false);
    return;
  }

  this.isSubmitting = true;
  this.cdr.detectChanges();

  this.db.updateClient({
    action: 'append',
    cellphoneNumber: this.newClient.cellphoneNumber,
    name: this.newClient.name,
    barber: this.newClient.barber
  }).subscribe({
    next: (res: any) => {
      if (res.status === 'ok') {
        this.showToaster('Success! Added to the queue.', true);
        this.closeModal(); // Close the modal immediately
        
        // Wait 1.5 seconds for Google Sheets to stabilize, then refresh data
        setTimeout(() => {
          this.initialLoad(); 
          this.isSubmitting = false;
        }, 1500);
        
      } else {
        this.isSubmitting = false;
        this.showToaster(res.message || 'Try again.', false);
        this.cdr.detectChanges();
      }
    },
    error: () => {
      this.isSubmitting = false;
      this.showToaster('Server busy. Try again.', false);
      this.cdr.detectChanges();
    }
  });
}

  confirmSkip(customer: any) {
    this.customerToSkip = customer;
    this.showSkipModal = true;
    this.cdr.detectChanges();
  }

  executeSkip() {
    if (!this.customerToSkip) return;
    this.isSubmitting = true;
    this.db.updateClient({ action: 'skip', row: this.customerToSkip._row }).subscribe({
      next: () => {
        this.showToaster('Removed from queue', true);
        setTimeout(() => window.location.reload(), 800);
      },
      error: () => { 
        this.isSubmitting = false; 
        this.showToaster('Delete failed', false); 
        this.cdr.detectChanges();
      }
    });
  }

  openCheckout(customer: any) {
    this.selectedCustomer = customer;
    this.selectedProducts = [];
    this.cashReceived = 0;
    this.cdr.detectChanges();
  }

  processPayment(method: 'Cash' | 'Card') {
    if (method === 'Cash') this.showCashModal = true;
    else this.showDigitalModal = true;
    this.cdr.detectChanges();
  }

  confirmFinalPayment(method: string) {
    this.isSubmitting = true;
    this.db.updateClient({
      action: 'update',
      row: this.selectedCustomer._row,
      totalAmount: this.getTotal(),
      paymentType: method,
      selectedProducts: this.selectedProducts.map(p => p.CutType)
    }).subscribe({
      next: () => {
        this.showToaster('Payment Sync Successful', true);
        setTimeout(() => window.location.reload(), 500);
      },
      error: () => { 
        this.isSubmitting = false; 
        this.showToaster('Sync failed', false); 
        this.cdr.detectChanges();
      }
    });
  }

  /**
   * Helpers
   */
  getWaitTimeData(timeInStr: string) {
    if (!timeInStr) return { text: '0m', color: 'text-green-500', bg: 'bg-green-500/10', border: 'border-green-500/20' };
    const [h, m] = timeInStr.split(':').map(Number);
    const checkIn = new Date();
    checkIn.setHours(h, m, 0);
    if (checkIn > this.currentTime) checkIn.setDate(checkIn.getDate() - 1);
    const diffMins = Math.floor((this.currentTime.getTime() - checkIn.getTime()) / 60000);
    const text = diffMins < 60 ? `${diffMins}m` : `${Math.floor(diffMins / 60)}h ${diffMins % 60}m`;
    if (diffMins < 30) return { text, color: 'text-green-500', bg: 'bg-green-500/10', border: 'border-green-500/20' };
    if (diffMins < 60) return { text, color: 'text-amber-500', bg: 'bg-amber-500/10', border: 'border-amber-500/20' };
    return { text, color: 'text-red-500', bg: 'bg-red-500/10', border: 'border-red-500/20' };
  }

  getAvgServiceTime(): string {
    const served = this.allCustomers.filter(c => c['Time In'] && c['Time Out'] && c['Time Out'].trim() !== '');
    if (served.length === 0) return '0m';
    const totalDiff = served.reduce((acc, c) => {
      const parse = (s: string) => { const [h, m] = s.split(':').map(Number); const d = new Date(); d.setHours(h, m, 0); return d.getTime(); };
      const diff = (parse(c['Time Out']) - parse(c['Time In'])) / 60000;
      return acc + (diff > 0 ? diff : 0);
    }, 0);
    const avg = Math.round(totalDiff / served.length);
    return avg < 60 ? `${avg}m` : `${Math.floor(avg / 60)}h ${avg % 60}m`;
  }

  showToaster(msg: string, isSuccess: boolean) {
    this.toaster = { show: true, message: msg, success: isSuccess };
    this.cdr.detectChanges();
    setTimeout(() => { this.toaster.show = false; this.cdr.detectChanges(); }, 4000);
  }

  closeModal() {
    this.showJoinModal = false;
    this.newClient = { name: '', cellphoneNumber: '+27', barber: '' };
    this.isUserSelected = false;
    this.isExistingUser = false;
    this.cdr.detectChanges();
  }
}