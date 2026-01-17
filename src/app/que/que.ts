import { CommonModule } from '@angular/common';
import { Component, inject, OnInit, ChangeDetectorRef } from '@angular/core';
import { Database } from '../database';
import { FormsModule } from '@angular/forms';
import { timeout } from 'rxjs';

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
  distinctAssistedUsers: any[] = [];
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
    phoneDigits: '',
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
    this.unservedCustomers = [];
    this.cdr.detectChanges();

    // Force close loading screen after 5 seconds MAXIMUM - fallback timeout
    const forceCloseTimeout = setTimeout(() => {
      if (this.isLoading) {
        console.warn('Force closing loading screen after timeout');
        this.isLoading = false;
        this.cdr.detectChanges();
      }
    }, 5000);

    let dataLoadedCount = 0;
    const requiredDataLoads = 1; // Only Queue is required to show rows

    const checkIfAllDataLoaded = () => {
      dataLoadedCount++;
      // Close loading screen once required data is loaded
      if (dataLoadedCount >= requiredDataLoads && this.isLoading) {
        clearTimeout(forceCloseTimeout);
        this.isLoading = false;
        this.cdr.detectChanges();
      }
    };

    // Fetch Queue - REQUIRED to show rows
    this.db.getQueue('Queue').pipe(
      timeout(4000)
    ).subscribe({
      next: (data: any[]) => {
        if (data && data.length > 0) {
          this.allCustomers = data; 
          this.unservedCustomers = data.filter(c => !c['Time Out'] || c['Time Out'].trim() === '');
        } else {
          this.allCustomers = [];
          this.unservedCustomers = [];
        }
        checkIfAllDataLoaded();
      },
      error: (err) => {
        console.error('Queue fetch error:', err);
        checkIfAllDataLoaded();
      }
    });

    // Fetch Prices - needed for checkout modal
    this.db.getPrices().pipe(
      timeout(3000)
    ).subscribe({
      next: (data) => {
        this.priceList = data;
        this.cdr.detectChanges();
      },
      error: (err) => console.error('Price fetch error:', err)
    });

    // Fetch Barbers - needed for join form
    this.db.getBarbers().pipe(
      timeout(3000)
    ).subscribe({
      next: (data) => {
        this.barbers = data;
        this.cdr.detectChanges();
      },
      error: (err) => console.error('Barber fetch error:', err)
    });

    // Fetch Assisted - needed for phone suggestions
    this.db.getAssisted().pipe(
      timeout(3000)
    ).subscribe({
      next: (data) => {
        this.allAssistedData = data;
        this.updateDistinctAssistedUsers();
        this.cdr.detectChanges();
      },
      error: (err) => console.error('Assisted fetch error:', err)
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
   * Selection Logic
   */
  getDistinctAssistedUsers(): any[] {
    // Return cached distinct users
    return this.distinctAssistedUsers;
  }

  // Call this when allAssistedData changes to update the cache
  updateDistinctAssistedUsers() {
    const seenPhones = new Set<string>();
    this.distinctAssistedUsers = this.allAssistedData.filter(user => {
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
    // Construct full phone number from +27 + digits
    const fullPhone = '+27' + this.newClient.phoneDigits.trim();
    
    // Check if phone number is complete (exactly 9 digits)
    const isPhoneComplete = this.newClient.phoneDigits.length === 9;
    
    // Look for matching customer in assisted list
    const existingUser = this.allAssistedData.find(u => {
      let sheetCell = u['Cellphone Number']?.toString() || '';
      if (sheetCell && !sheetCell.startsWith('+')) sheetCell = '+' + sheetCell;
      return sheetCell === fullPhone;
    });

    if (existingUser) {
      // Found in assisted list - auto-fill and disable inputs
      this.newClient.name = existingUser['Name'];
      this.newClient.barber = existingUser['Barber'];
      this.newClient.cellphoneNumber = fullPhone;
      this.isExistingUser = true; 
      this.isUserSelected = true;
    } else {
      // Not found in assisted list
      this.isExistingUser = false;
      this.newClient.cellphoneNumber = fullPhone;
      // Only enable inputs if phone is complete AND not found
      this.isUserSelected = isPhoneComplete;
      
      // If phone is incomplete, clear name/barber
      if (!isPhoneComplete) {
        this.newClient.name = '';
        this.newClient.barber = '';
      }
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

          // Wait 1.5 seconds to show success message, then refresh page
          setTimeout(() => {
            window.location.reload();
          }, 1500);
          
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
    this.newClient = { name: '', phoneDigits: '', cellphoneNumber: '+27', barber: '' };
    this.isUserSelected = false;
    this.isExistingUser = false;
    this.cdr.detectChanges();
  }
}
