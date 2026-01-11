import { CommonModule } from '@angular/common';
import { Component, inject, OnInit } from '@angular/core';
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

  // Data lists
  unservedCustomers: any[] = [];
  priceList: any[] = [];
  barbers: any[] = [];
  
  // UI State Management
  showJoinModal = false;
  loading = false;
  
  // New Client Form Data
  newClient = { 
    name: '', 
    cellphoneNumber: '+27', 
    barber: '' 
  };

  // Checkout Selection Logic
  selectedCustomer: any = null; // When this is not null, show the "PAY" modal
  selectedProducts: any[] = [];

 // Add these to your class properties
currentTime = new Date();

// Inside que.ts
ngOnInit() {
  this.loadData();
  this.fetchPrices(); // Make sure this is called
  this.fetchBarbers();
  
  setInterval(() => {
    this.currentTime = new Date();
  }, 60000);
}

fetchPrices() {
  this.db.getPrices().subscribe({
    next: (data: any[]) => {
      this.priceList = data;
      console.log('Prices loaded:', this.priceList);
    },
    error: (err) => this.showToaster('Failed to load services', false)
  });
}

getWaitTime(timeInStr: string): string {
  if (!timeInStr) return '0m';
  
  // Parse the "HH:mm:ss" string from the sheet
  const [hours, minutes] = timeInStr.split(':').map(Number);
  const checkIn = new Date();
  checkIn.setHours(hours, minutes, 0);

  // If the calculation results in a future time (e.g., checking at 1 AM for an 11 PM entry)
  if (checkIn > this.currentTime) {
    checkIn.setDate(checkIn.getDate() - 1);
  }

  const diffMs = this.currentTime.getTime() - checkIn.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 60) {
    return `${diffMins}m`;
  } else {
    const h = Math.floor(diffMins / 60);
    const m = diffMins % 60;
    return `${h}h ${m}m`;
  }
}
// Inside your loadData() method in que.ts
loadData() {
  this.db.getQueue('Queue').subscribe({
    next: (data: any[]) => {
      // 1. Keep the full list for calculating averages
      this.allCustomers = data; 

      // 2. Filter for the UI list (only people who HAVEN'T paid yet)
      this.unservedCustomers = data.filter(c => !c['Time Out'] || c['Time Out'].trim() === '');
      
      console.log('Average Calculation Data:', this.allCustomers.length);
    },
    error: (err) => this.showToaster('Failed to load queue', false)
  });
}

getAvgServiceTime(): string {
  // Look for rows where Time Out has been set
  const served = this.allCustomers.filter(c => c['Time In'] && c['Time Out'] && c['Time Out'].trim() !== '');
  
  if (served.length === 0) return '0m';

  const totalDiff = served.reduce((acc, c) => {
    // Parse HH:mm:ss strings
    const parseTime = (timeStr: string) => {
      const [h, m] = timeStr.split(':').map(Number);
      const d = new Date();
      d.setHours(h, m, 0);
      return d.getTime();
    };

    const diff = (parseTime(c['Time Out']) - parseTime(c['Time In'])) / 60000;
    return acc + (diff > 0 ? diff : 0);
  }, 0);

  const avg = Math.round(totalDiff / served.length);
  return avg < 60 ? `${avg}m` : `${Math.floor(avg / 60)}h ${avg % 60}m`;
}

  fetchBarbers() {
    this.db.getBarbers().subscribe((data) => {
      this.barbers = data;
    });
  }

 // Add these to your class properties
isSubmitting = false;
// Ensure these properties exist at the top of your class
toaster = { show: false, message: '', success: true };

showToaster(msg: string, isSuccess: boolean) {
  console.log('Toaster Triggered:', msg); // Debugging line
  this.toaster = { 
    show: true, 
    message: msg, 
    success: isSuccess 
  };

  // Hide it after 3 seconds
  setTimeout(() => {
    this.toaster.show = false;
  }, 10000);
}

submitToQueue() {
  const phoneRegex = /^\+27\d{9}$/;
  
  if (!this.newClient.name || !this.newClient.barber) {
    this.showToaster('Please enter a name and select a barber.', false);
    return;
  }

  if (!phoneRegex.test(this.newClient.cellphoneNumber)) {
    this.showToaster('Invalid Phone! Must be +27 followed by 9 digits.', false);
    return;
  }

  // Start Loading State
  this.isSubmitting = true;

  const payload = {
    action: 'append',
    cellphoneNumber: this.newClient.cellphoneNumber,
    name: this.newClient.name,
    barber: this.newClient.barber
  };

  this.db.updateClient(payload).subscribe({
    next: (response: any) => {
      if (response && response.status === 'ok') {
        this.showToaster('Success! Added to the queue.', true);
        // Refresh after a short delay so user sees the success message
        setTimeout(() => window.location.reload(), 1000);
      } else {
        this.isSubmitting = false;
        this.showToaster(response.message || 'Try again.', false);
      }
    },
    error: (err) => {
      this.isSubmitting = false;
      this.showToaster('Connection failed. Please try again.', false);
    }
  });
}

// Helper to manage toaster timing

  resetJoinForm() {
    this.newClient = { name: '', cellphoneNumber: '+27', barber: '' };
  }

  /**
   * CHECKOUT / PAYMENT LOGIC
   */
  openCheckout(customer: any) {
    this.selectedCustomer = customer;
    this.selectedProducts = []; // Reset shopping cart
  }

  toggleProduct(product: any) {
    const index = this.selectedProducts.findIndex(p => p.CutType === product.CutType);
    if (index > -1) {
      this.selectedProducts.splice(index, 1);
    } else if (this.selectedProducts.length < 5) {
      this.selectedProducts.push(product);
    }
  }

  getTotal(): number {
    return this.selectedProducts.reduce((sum, p) => sum + Number(p.Price || 0), 0);
  }

 // Add these properties to your class
showCashModal = false;
showDigitalModal = false;
cashReceived = 0;

get changeDue(): number {
  const change = this.cashReceived - this.getTotal();
  return change > 0 ? change : 0;
}

// Update your processPayment method
processPayment(method: 'Cash' | 'Card') {
  if (!this.selectedCustomer || this.selectedProducts.length === 0) {
    this.showToaster('Please select at least one service.', false);
    return;
  }

  if (method === 'Cash') {
    this.showCashModal = true;
  } else {
    this.showDigitalModal = true;
  }
}

// Final submission after modal confirmation
confirmFinalPayment(method: string) {
  this.isSubmitting = true;
  
  const payload = {
    action: 'update',
    row: this.selectedCustomer._row,
    totalAmount: this.getTotal(),
    paymentType: method,
    selectedProducts: this.selectedProducts.map(p => p.CutType)
  };

  this.db.updateClient(payload).subscribe({
    next: (res: any) => {
      this.showToaster(`Payment Recorded: ${method}`, true);
      this.showCashModal = false;
      this.showDigitalModal = false;
      this.selectedCustomer = null;
      
      setTimeout(() => window.location.reload(), 500);
    },
    error: (err) => {
      this.isSubmitting = false;
      this.showToaster('Payment failed. Try again.', false);
    }
  });
}

  // Add these to your class properties
showSkipModal = false;
customerToSkip: any = null;

// Open the confirmation window
confirmSkip(customer: any) {
  this.customerToSkip = customer;
  this.showSkipModal = true;
}

// Perform the actual removal
executeSkip() {
  if (!this.customerToSkip) return;

  this.isSubmitting = true;

  const payload = {
    action: 'skip',
    row: this.customerToSkip._row
  };

  this.db.updateClient(payload).subscribe({
    next: (res: any) => {
      if (res && res.status === 'ok') {
        // 1. Show Success Toaster
        this.showToaster('Customer removed from queue', true);
        
        // 2. Close the modal
        this.showSkipModal = false;
        
        // 3. Refresh page after a short delay so they see the toaster
        setTimeout(() => {
          window.location.reload();
        }, 1000);
      } else {
        this.isSubmitting = false;
        this.showToaster(res.message || 'Error removing customer', false);
      }
    },
    error: (err) => {
      this.isSubmitting = false;
      this.showToaster('Connection error. Try again.', false);
      console.error('Skip error:', err);
    }
  });
}
// Add these to your class properties
allCustomers: any[] = []; // Ensure this is populated when you fetch data



  
}