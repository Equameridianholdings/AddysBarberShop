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

    // Auto-refresh clock for wait times every second for accurate counting
    setInterval(() => {
      this.currentTime = new Date();
      this.cdr.detectChanges();
    }, 1000);
  }

  /**
   * Core Data Loading - Blocks UI with "Opening Shop" screen.
   * Clears existing lists to ensure the user doesn't see old data.
   */
  initialLoad() {
    this.isLoading = true;
    this.unservedCustomers = []; // Force clear the list to kill cached views
    this.cdr.detectChanges();

    // Set a timeout to prevent infinite loading - max 10 seconds
    const loadingTimeout = setTimeout(() => {
      if (this.isLoading) {
        console.warn('Loading timeout - forcing close of loading screen');
        this.isLoading = false;
        this.showToaster('Taking longer than expected, please refresh if needed', false);
        this.cdr.detectChanges();
      }
    }, 10000);

    // Primary data fetch
    this.db.getQueue('Queue').subscribe({
      next: (data: any[]) => {
        clearTimeout(loadingTimeout);
        if (data && data.length > 0) {
          this.allCustomers = data; 
          this.unservedCustomers = data.filter(c => !c['Time Out'] || c['Time Out'].trim() === '');
        } else {
          this.allCustomers = [];
          this.unservedCustomers = [];
        }
        
        // Show rows immediately without artificial delay
        this.isLoading = false; 
        this.cdr.detectChanges();
      },
      error: (err) => {
        clearTimeout(loadingTimeout);
        console.error('Connection failed:', err);
        this.isLoading = false; 
        this.showToaster('Connection error. Please check your internet or refresh.', false);
        this.cdr.detectChanges();
      }
    });

    // Background loads
    this.fetchPrices();
    this.fetchBarbers();
    this.loadAssistedHistory();
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
   * Selection Logic
   */
  getDistinctAssistedUsers(): any[] {
    // Return distinct users by phone number (keep first occurrence only)
    const seenPhones = new Set<string>();
    return this.allAssistedData.filter(user => {
      const phone = user['Cellphone Number']?.toString().trim();
      if (!phone) return false;
      
      if (seenPhones.has(phone)) {
        return false; // Skip duplicates
      }
      seenPhones.add(phone);
      return true;
    });
  }

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
    if (!this.newClient.name || !this.newClient.barber) {
      this.showToaster('Name and Barber required.', false);
      return;
    }
    
    this.isSubmitting = true;
    this.cdr.detectChanges();

    // Create a "Temporary" object to show on screen immediately (Optimistic UI)
    const tempUser = {
      Name: this.newClient.name,
      Barber: this.newClient.barber,
      'Cellphone Number': this.newClient.cellphoneNumber,
      'Time In': new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }),
      _row: 'temp-' + Date.now() 
    };

    this.db.updateClient({
      action: 'append',
      cellphoneNumber: this.newClient.cellphoneNumber,
      name: this.newClient.name,
      barber: this.newClient.barber
    }).subscribe({
      next: (res: any) => {
        if (res.status === 'ok') {
          this.showToaster('Success! Added to the queue.', true);
          
          // Add locally for instant feedback
          this.unservedCustomers = [...this.unservedCustomers, tempUser];
          
          this.closeModal();
          this.isSubmitting = false;

          // Crucial: Wait 2 seconds for Google to process, then force fresh initialLoad
          setTimeout(() => {
            this.initialLoad(); 
          }, 2000);
          
        } else {
          this.isSubmitting = false;
          this.showToaster(res.message || 'Try again.', false);
        }
        this.cdr.detectChanges();
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
        this.showSkipModal = false;
        // Trigger initialLoad immediately to show loader while updating
        setTimeout(() => this.initialLoad(), 800);
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
        this.showCashModal = false;
        this.showDigitalModal = false;
        this.selectedCustomer = null;
        this.selectedProducts = [];
        // Refresh queue data without full page reload for faster response
        setTimeout(() => {
          this.initialLoad();
        }, 1000);
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
    const served = this.allCustomers.filter(c => {
      const timeIn = c['Time In']?.toString().trim();
      const timeOut = c['Time Out']?.toString().trim();
      return timeIn && timeOut && timeIn.length > 0 && timeOut.length > 0;
    });
    
    if (served.length === 0) return '0m';
    
    const totalDiff = served.reduce((acc, c) => {
      try {
        const parseTime = (timeStr: string) => {
          const parts = timeStr.trim().split(':');
          const h = parseInt(parts[0], 10);
          const m = parseInt(parts[1], 10);
          if (isNaN(h) || isNaN(m)) return null;
          return { h, m };
        };
        
        const timeInParsed = parseTime(c['Time In']);
        const timeOutParsed = parseTime(c['Time Out']);
        
        if (!timeInParsed || !timeOutParsed) return acc;
        
        // Convert to minutes from midnight
        const timeInMinutes = timeInParsed.h * 60 + timeInParsed.m;
        const timeOutMinutes = timeOutParsed.h * 60 + timeOutParsed.m;
        
        // Calculate difference, handling midnight wrap-around
        let diff = timeOutMinutes - timeInMinutes;
        if (diff < 0) diff += 24 * 60; // If negative, it crossed midnight
        
        return acc + (diff > 0 ? diff : 0);
      } catch (e) {
        console.warn('Error parsing time:', e);
        return acc;
      }
    }, 0);
    
    const avg = Math.round(totalDiff / served.length);
    
    // Display in hours if >= 60 minutes, otherwise display in minutes
    if (avg >= 60) {
      const hours = Math.floor(avg / 60);
      const mins = avg % 60;
      return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
    }
    return `${avg}m`;
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
